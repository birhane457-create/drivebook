import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// System prompt — tells the LLM its role and output format
const SYSTEM_PROMPT = `You are an operations analyst for DriveBook, an Australian driving lesson booking platform.
You will be given a JSON summary of yesterday's platform activity and this week's trends.
Write a concise, plain-English executive brief for the platform administrator.

Format your response as:
1. A 2-3 sentence overall summary of yesterday's performance
2. Key highlights (bullet points, max 4)
3. What to watch (1-2 items that need the admin's attention today, if any)
4. One forward-looking observation about this week's trend

Keep the tone professional but direct. Use Australian English. 
Do not repeat raw numbers that the dashboard already shows — interpret them.
Do not use markdown headers. Use plain text with short paragraph breaks.
Total response should be under 200 words.`

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * POST /api/admin/ai-brief
 *
 * Accepts the daily-summary JSON, generates an AI brief via OpenAI or Anthropic,
 * persists it to AdminBrief (upsert by date — one per day), and returns the brief.
 *
 * If a brief already exists for today and the request body contains
 * { forceRegenerate: true }, it will regenerate and overwrite.
 * Otherwise it returns the cached brief for today without calling the LLM.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const openaiKey = process.env.OPENAI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  if (!openaiKey && !anthropicKey) {
    return NextResponse.json(
      { error: 'No AI key configured. Add OPENAI_API_KEY or ANTHROPIC_API_KEY to your .env file.' },
      { status: 503 }
    )
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const forceRegenerate = body.forceRegenerate === true
  const summary = forceRegenerate
    ? (body.summary as Record<string, unknown>)
    : body

  const dateKey = todayKey()

  // ── Return cached brief for today unless force-regenerating ───────────────
  if (!forceRegenerate) {
    const cached = await (prisma as any).adminBrief.findUnique({
      where: { date: dateKey },
    }).catch(() => null)

    if (cached) {
      return NextResponse.json({
        brief: cached.brief,
        model: cached.model,
        tokens: cached.tokens,
        cached: true,
        date: cached.date,
        healthScore: cached.healthScore,
      })
    }
  }

  // Fetch today's health score to store alongside the brief
  let healthScore: number | null = null
  try {
    const hsRes = await fetch(
      `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/admin/health-score`,
      { headers: { Cookie: req.headers.get('cookie') ?? '' } }
    )
    if (hsRes.ok) {
      const hsData = await hsRes.json()
      healthScore = hsData.score ?? null
    }
  } catch {
    // Non-fatal — brief still saves without health score
  }

  // Build the user prompt
  const src = summary ?? {}
  const userPrompt = `Here is yesterday's DriveBook platform summary:

Yesterday (${new Date((src.period as any)?.from ?? Date.now()).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}):
- Bookings completed: ${(src.yesterday as any)?.bookingsCompleted ?? 0}
- Bookings cancelled: ${(src.yesterday as any)?.bookingsCancelled ?? 0}
- New bookings created: ${(src.yesterday as any)?.bookingsNew ?? 0}
- Revenue collected: $${(src.yesterday as any)?.revenueCollected ?? 0}
- New students: ${(src.yesterday as any)?.newStudents ?? 0}
- New instructors: ${(src.yesterday as any)?.newInstructors ?? 0}

This week vs last week:
- Bookings this week: ${(src.weeklyTrend as any)?.bookingsThisWeek ?? 0}
- Bookings last week: ${(src.weeklyTrend as any)?.bookingsLastWeek ?? 0}
- Week-over-week change: ${(src.weeklyTrend as any)?.bookingChangePercent ?? 0}%

Platform health score: ${healthScore !== null ? `${healthScore}/100` : 'unavailable'}

Attention items requiring action: ${(src.attentionCount as number) ?? 0}
${((src.attentionItems as any[]) ?? []).map((i: any) => `- [${i.severity.toUpperCase()}] ${i.message}`).join('\n')}

Top performers this week:
${((src.topPerformers as any[]) ?? []).map((p: any, idx: number) => `${idx + 1}. ${p.name}: ${p.completedLessons} lessons`).join('\n')}

Please write the operations brief now.`

  try {
    let brief = ''
    let model = ''
    let tokens = 0

    // ── OpenAI ────────────────────────────────────────────────────────────
    if (openaiKey) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 400,
          temperature: 0.4,
        }),
      })
      if (!res.ok) throw new Error(`OpenAI error: ${res.status} ${(await res.text()).slice(0, 200)}`)
      const data = await res.json()
      brief = data.choices?.[0]?.message?.content ?? ''
      model = 'gpt-4o-mini'
      tokens = data.usage?.total_tokens ?? 0
    } else {
      // ── Anthropic fallback ───────────────────────────────────────────────
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 400,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      })
      if (!res.ok) throw new Error(`Anthropic error: ${res.status} ${(await res.text()).slice(0, 200)}`)
      const data = await res.json()
      brief = data.content?.[0]?.text ?? ''
      model = 'claude-3-haiku'
      tokens = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0)
    }

    // ── Persist to DB (upsert by date) ────────────────────────────────────
    await (prisma as any).adminBrief.upsert({
      where: { date: dateKey },
      create: {
        date: dateKey,
        summaryJson: JSON.stringify(src),
        brief,
        model,
        tokens,
        healthScore,
        generatedBy: session.user.id ?? 'admin',
      },
      update: {
        summaryJson: JSON.stringify(src),
        brief,
        model,
        tokens,
        healthScore,
        generatedBy: session.user.id ?? 'admin',
      },
    }).catch((err: unknown) => {
      // Non-fatal — log but still return the brief to the client
      console.error('[ai-brief] failed to persist to DB:', err)
    })

    return NextResponse.json({ brief, model, tokens, cached: false, date: dateKey, healthScore })
  } catch (error: any) {
    console.error('[ai-brief] error:', error)
    return NextResponse.json({ error: error.message ?? 'AI request failed' }, { status: 500 })
  }
}
