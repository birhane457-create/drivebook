/**
 * Tests for PH4-AV-01 and PH4-ABN-01 source fixes
 *
 * PH4-AV-01: POST /api/availability requires voice service authentication
 * PH4-ABN-01: POST /api/abn/verify requires provider session and rate limit
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { NextRequest } from 'next/server'

// ── PH4-AV-01: Availability POST auth ────────────────────────────────────────

describe('PH4-AV-01: POST /api/availability requires voice service auth', () => {
  it('availability route imports withVoiceServiceAuth', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'app/api/availability/route.ts'),
      'utf-8'
    )
    expect(src).toContain('withVoiceServiceAuth')
    expect(src).toContain("from '@/lib/middleware/voiceServiceAuth'")
  })

  it('availability POST export uses withVoiceServiceAuth wrapper', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'app/api/availability/route.ts'),
      'utf-8'
    )
    // The export must be wrapped, not a bare async function
    expect(src).toContain('export const POST = withVoiceServiceAuth(handler)')
    expect(src).not.toContain('export async function POST')
  })

  it('denies unauthenticated POST requests', async () => {
    // Mock voice service auth to reject (no API key)
    vi.mock('@/lib/middleware/voiceServiceAuth', () => ({
      withVoiceServiceAuth: (handler: any) => async (req: any) => {
        const apiKey = req.headers.get('x-api-key')
        if (!apiKey || apiKey !== 'test-voice-key') {
          const { NextResponse } = await import('next/server')
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        return handler(req)
      }
    }))

    const { POST } = await import('@/app/api/availability/route')
    const req = new NextRequest('http://localhost/api/availability', {
      method: 'POST',
      body: JSON.stringify({ providerId: 'p1', date: '2026-01-01' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })
})

// ── PH4-ABN-01: ABN verify auth and rate limit ────────────────────────────────

describe('PH4-ABN-01: POST /api/abn/verify requires provider session', () => {
  it('ABN route imports getServerSession', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'app/api/abn/verify/route.ts'),
      'utf-8'
    )
    expect(src).toContain('getServerSession')
    expect(src).toContain('authOptions')
  })

  it('ABN route imports abnVerifyRateLimit from ratelimit', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'app/api/abn/verify/route.ts'),
      'utf-8'
    )
    expect(src).toContain('abnVerifyRateLimit')
    expect(src).toContain("from '@/lib/ratelimit'")
  })

  it('ABN route checks for provider role', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'app/api/abn/verify/route.ts'),
      'utf-8'
    )
    // Must reject non-provider roles
    expect(src).toContain("role !== 'provider'")
    expect(src).toContain("'Unauthorized'")
    expect(src).toContain("'Forbidden'")
  })

  it('ABN rate limit key is per-provider (uses session user id)', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'app/api/abn/verify/route.ts'),
      'utf-8'
    )
    // Rate limit key must be scoped to the provider, not global
    expect(src).toContain('abn-verify:')
    expect(src).toContain('session.user.id')
  })

  it('abnVerifyRateLimit is exported from lib/ratelimit.ts', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'lib/ratelimit.ts'),
      'utf-8'
    )
    expect(src).toContain('export const abnVerifyRateLimit')
    expect(src).toContain("createRateLimiter(10, '1 h')")
  })

  it('denies unauthenticated ABN requests', async () => {
    // Source-level confirmation that the route checks for a missing session
    // before applying the rate limit
    const src = readFileSync(
      resolve(process.cwd(), 'app/api/abn/verify/route.ts'),
      'utf-8'
    )
    // Find the POST function body — everything after 'export async function POST'
    const postFnIdx = src.indexOf('export async function POST')
    expect(postFnIdx).toBeGreaterThan(-1)
    const postBody = src.slice(postFnIdx)

    // Within the function body, session check comes before rate limit call
    const sessionCheckIdx = postBody.indexOf('!session?.user')
    const rateLimitCallIdx = postBody.indexOf('checkRateLimitStrict')
    expect(sessionCheckIdx).toBeGreaterThan(-1)
    expect(rateLimitCallIdx).toBeGreaterThan(-1)
    expect(sessionCheckIdx).toBeLessThan(rateLimitCallIdx)

    // Returns 401 for missing session, 403 for wrong role
    expect(postBody).toContain("'Unauthorized'")
    expect(postBody).toContain("'Forbidden'")
  })

  it('denies non-provider role (CLIENT) from ABN verification', async () => {
    vi.mock('next-auth/next', () => ({
      getServerSession: vi.fn().mockResolvedValue({
        user: { id: 'user-1', role: 'CLIENT' }
      })
    }))

    const { POST } = await import('@/app/api/abn/verify/route')
    const req = new NextRequest('http://localhost/api/abn/verify', {
      method: 'POST',
      body: JSON.stringify({ abn: '51824753556' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })
})
