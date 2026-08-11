import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { callTool, TOOL_DEFINITIONS } from '@/lib/admin/ai-tools'
import { checkRateLimitStrict, adminActionRateLimit } from '@/lib/ratelimit'

import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';
export const dynamic = 'force-dynamic'

// ── Cost / safety controls ────────────────────────────────────────────────
const MAX_ROUNDS   = 5      // max tool-calling iterations per request
const MAX_TOKENS   = 1500   // max tokens per LLM response
const TIMEOUT_MS   = 15000  // 15s hard timeout on each LLM fetch
const MAX_HISTORY  = 20     // max past messages sent to LLM

const SYSTEM_PROMPT = `You are the DriveBook Admin Operations Copilot — an AI assistant embedded in the admin dashboard of DriveBook, an Australian driving lesson booking platform.

Your job is to help the admin understand platform performance, identify issues, and make decisions.

You have access to a set of read-only tools that query live platform data. Always call the appropriate tool(s) before answering questions that require data. You may call multiple tools if needed.

Guidelines:
- Be concise and direct. Admins are busy — get to the point.
- Lead with the most important finding, then supporting detail.
- When there are problems, always state the estimated impact and a recommended action.
- Use Australian English and dollar amounts in AUD.
- Never make up data. If a tool returns no data, say so clearly.
- Do not describe what tools you are calling — just answer the question.
- Format numbers clearly: $1,240 not 1240, 94% not 0.94.
- Keep responses under 300 words unless the admin asks for more detail.`

// ── Audit log helper ──────────────────────────────────────────────────────
async function logAIQuery(opts: {
  actorId: string
  actorEmail: string
  question: string
  toolsUsed: string[]
  durationMs: number
  success: boolean
  errorMessage?: string
  ipAddress?: string
}) {
  await prisma.auditLog.create({
    data: {
      action: 'ADMIN_AI_QUERY',
      actorId: opts.actorId,
      actorRole: 'ADMIN',
      targetType: 'AI_COPILOT',
      targetId: 'ai-query',
      ipAddress: opts.ipAddress ?? null,
      metadata: {
        question: opts.question.slice(0, 500), // cap stored question length
        toolsUsed: opts.toolsUsed,
        durationMs: opts.durationMs,
        actorEmail: opts.actorEmail,
      },
      success: opts.success,
      errorMessage: opts.errorMessage ?? null,
    },
  }).catch((err: unknown) => {
    // Non-fatal — never let audit failure break the response
    console.error('[ai-query] audit log failed:', err)
  })
}

// ── Fetch with timeout ────────────────────────────────────────────────────
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * POST /api/admin/ai-query
 *
 * Permissions: ADMIN | SUPER_ADMIN — verified server-side via getServerSession.
 * The AI is NEVER trusted to enforce permissions. Auth happens before any tool runs.
 *
 * Body: { messages: Array<{ role: 'user' | 'assistant', content: string }> }
 * Returns: { reply: string, toolsUsed: string[] }
 *
 * Safety controls:
 *   - MAX_ROUNDS = 5       prevents runaway tool loops
 *   - MAX_TOKENS = 1500    caps cost per request
 *   - TIMEOUT_MS = 15000   hard timeout per LLM fetch
 *   - MAX_HISTORY = 20     limits context window
 *   - Audit log on every request (success + failure)
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()

  // ── 1. Auth — server-side, always first ──────────────────────────────────
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const actorId    = session.user.id ?? 'unknown'
  const actorEmail = session.user.email ?? 'unknown'
  const ipAddress  = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined

  // ── 2. Rate limit — 20 AI queries per minute per admin ───────────────────
  const rlResult = await checkRateLimitStrict(adminActionRateLimit, `ai-query:${actorId}`)
  if (!rlResult.success) {
    return NextResponse.json({ error: rlResult.error }, { status: 429 })
  }

  // ── 2. AI key check ───────────────────────────────────────────────────────
  const openaiKey    = process.env.OPENAI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  if (!openaiKey && !anthropicKey) {
    return NextResponse.json(
      { error: 'No AI key configured. Add OPENAI_API_KEY or ANTHROPIC_API_KEY to your .env file.' },
      { status: 503 }
    )
  }

  // ── 3. Parse body ─────────────────────────────────────────────────────────
  let body: { messages: Array<{ role: string; content: string }> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: 'messages array is required' }, { status: 400 })
  }

  const history   = body.messages.slice(-MAX_HISTORY)
  const question  = history.filter(m => m.role === 'user').at(-1)?.content ?? ''
  const toolsUsed: string[] = []

  try {
    // ── 4a. OpenAI tool-calling loop ────────────────────────────────────────
    if (openaiKey) {
      const messages: any[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history,
      ]

      let rounds = 0

      while (rounds < MAX_ROUNDS) {
        rounds++

        const res = await fetchWithTimeout(
          'https://api.openai.com/v1/chat/completions',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages,
              tools: TOOL_DEFINITIONS,
              tool_choice: 'auto',
              max_tokens: MAX_TOKENS,
              temperature: 0.3,
            }),
          },
          TIMEOUT_MS
        )

        if (!res.ok) {
          const err = await res.text()
          throw new Error(`OpenAI error: ${res.status} ${err.slice(0, 200)}`)
        }

        const data   = await res.json()
        const choice = data.choices?.[0]
        const msg    = choice?.message

        // No more tool calls — final answer
        if (!msg?.tool_calls || msg.tool_calls.length === 0) {
          const reply = msg?.content ?? 'No response generated.'
          await logAIQuery({ actorId, actorEmail, question, toolsUsed, durationMs: Date.now() - startTime, success: true, ipAddress })
          return NextResponse.json({ reply, toolsUsed })
        }

        messages.push(msg)

        // Execute each tool — permission already verified above; AI cannot bypass this
        for (const tc of msg.tool_calls) {
          const toolName = tc.function?.name
          let toolArgs: Record<string, unknown> = {}
          try { toolArgs = JSON.parse(tc.function?.arguments ?? '{}') } catch { /* use empty */ }

          let toolResult: unknown
          try {
            toolResult = await callTool(toolName, toolArgs)
            if (!toolsUsed.includes(toolName)) toolsUsed.push(toolName)
          } catch (err: unknown) {
            toolResult = { error: err instanceof Error ? err.message : 'Tool call failed' }
          }

          messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(toolResult) })
        }
      }

      // Hit MAX_ROUNDS — force a plain summary
      messages.push({ role: 'user', content: 'Please summarise what you found based on the data retrieved so far.' })
      const finalRes = await fetchWithTimeout(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 400, temperature: 0.3 }),
        },
        TIMEOUT_MS
      )
      const finalData = await finalRes.json()
      const reply = finalData.choices?.[0]?.message?.content ?? 'I retrieved the data but could not summarise it.'
      await logAIQuery({ actorId, actorEmail, question, toolsUsed, durationMs: Date.now() - startTime, success: true, ipAddress })
      return NextResponse.json({ reply, toolsUsed })
    }

    // ── 4b. Anthropic fallback — pre-fetch context, single-shot ────────────
    const [summary, health, risk, weekly] = await Promise.all([
      callTool('getDailySummary', {}).catch(() => ({})),
      callTool('getHealthScore', {}).catch(() => ({})),
      callTool('getInstructorRisk', { limit: 3, minScore: 30 }).catch(() => ({})),
      callTool('getWeeklyReport', {}).catch(() => ({})),
    ])
    toolsUsed.push('getDailySummary', 'getHealthScore', 'getInstructorRisk', 'getWeeklyReport')

    const contextBlock = `Current platform data:
Daily Summary: ${JSON.stringify(summary)}
Health Score: ${JSON.stringify(health)}
Instructor Risk (top 3): ${JSON.stringify(risk)}
Weekly Report: ${JSON.stringify(weekly)}`

    const anthropicMessages = [
      ...history.slice(-6),
      { role: 'user', content: `${contextBlock}\n\n${question}` },
    ]

    const res = await fetchWithTimeout(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: MAX_TOKENS,
          system: SYSTEM_PROMPT,
          messages: anthropicMessages,
        }),
      },
      TIMEOUT_MS
    )

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Anthropic error: ${res.status} ${err.slice(0, 200)}`)
    }

    const data  = await res.json()
    const reply = data.content?.[0]?.text ?? 'No response generated.'

    await logAIQuery({ actorId, actorEmail, question, toolsUsed, durationMs: Date.now() - startTime, success: true, ipAddress })
    return NextResponse.json({ reply, toolsUsed })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'AI request failed'
    const isTimeout = message.includes('abort') || message.includes('AbortError')

    await logAIQuery({
      actorId, actorEmail, question, toolsUsed,
      durationMs: Date.now() - startTime,
      success: false,
      errorMessage: isTimeout ? 'Request timed out after 15s' : message,
      ipAddress,
    })

    console.error('[ai-query] error:', error)
    return NextResponse.json(
      { error: isTimeout ? 'Request timed out — please try again.' : message },
      { status: isTimeout ? 504 : 500 }
    )
  }
}
