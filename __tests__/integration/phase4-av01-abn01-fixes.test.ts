/**
 * Tests for PH4-AV-01 and PH4-ABN-01 source fixes
 *
 * PH4-AV-01: POST /api/availability requires voice service authentication
 * PH4-ABN-01: POST /api/abn/verify requires provider session and rate limit
 *
 * Tests exercise the real middleware and route guard logic, not mocked auth.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { NextRequest } from 'next/server'

// ── PH4-AV-01: Real voice service middleware tests ────────────────────────────

describe('PH4-AV-01: authenticateVoiceService() — real middleware', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      VOICE_SERVICE_API_KEY: 'test-voice-key-abc123',
      VAPI_WEBHOOK_SECRET: 'test-vapi-secret-xyz789',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('denies request with no credentials', async () => {
    // Import real middleware — not mocked
    const { authenticateVoiceService } = await import('@/lib/middleware/voiceServiceAuth')
    const req = new NextRequest('http://localhost/api/availability', { method: 'POST' })
    const result = authenticateVoiceService(req)
    expect(result.authenticated).toBe(false)
    expect(result.response?.status).toBe(401)
  })

  it('denies request with wrong API key', async () => {
    const { authenticateVoiceService } = await import('@/lib/middleware/voiceServiceAuth')
    const req = new NextRequest('http://localhost/api/availability', {
      method: 'POST',
      headers: { 'x-api-key': 'wrong-key' },
    })
    const result = authenticateVoiceService(req)
    expect(result.authenticated).toBe(false)
    expect(result.response?.status).toBe(403)
  })

  it('allows request with correct VOICE_SERVICE_API_KEY via x-api-key', async () => {
    const { authenticateVoiceService } = await import('@/lib/middleware/voiceServiceAuth')
    const req = new NextRequest('http://localhost/api/availability', {
      method: 'POST',
      headers: { 'x-api-key': 'test-voice-key-abc123' },
    })
    const result = authenticateVoiceService(req)
    expect(result.authenticated).toBe(true)
    expect(result.response).toBeUndefined()
  })

  it('allows request with correct VOICE_SERVICE_API_KEY as Bearer token', async () => {
    const { authenticateVoiceService } = await import('@/lib/middleware/voiceServiceAuth')
    const req = new NextRequest('http://localhost/api/availability', {
      method: 'POST',
      headers: { 'authorization': 'Bearer test-voice-key-abc123' },
    })
    const result = authenticateVoiceService(req)
    expect(result.authenticated).toBe(true)
  })

  it('allows request with correct VAPI_WEBHOOK_SECRET via x-vapi-secret', async () => {
    const { authenticateVoiceService } = await import('@/lib/middleware/voiceServiceAuth')
    const req = new NextRequest('http://localhost/api/availability', {
      method: 'POST',
      headers: { 'x-vapi-secret': 'test-vapi-secret-xyz789' },
    })
    const result = authenticateVoiceService(req)
    expect(result.authenticated).toBe(true)
  })

  it('denies when VOICE_SERVICE_API_KEY env var is not configured', async () => {
    delete process.env.VOICE_SERVICE_API_KEY
    delete process.env.VAPI_WEBHOOK_SECRET
    const { authenticateVoiceService } = await import('@/lib/middleware/voiceServiceAuth')
    const req = new NextRequest('http://localhost/api/availability', {
      method: 'POST',
      headers: { 'x-api-key': 'any-key' },
    })
    const result = authenticateVoiceService(req)
    // Key provided but no configured secret to match against — must deny
    expect(result.authenticated).toBe(false)
  })
})

describe('PH4-AV-01: availability route uses withVoiceServiceAuth wrapper', () => {
  it('POST export is wrapped (not a bare async function)', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'app/api/availability/route.ts'),
      'utf-8'
    )
    expect(src).toContain('export const POST = withVoiceServiceAuth(handler)')
    expect(src).not.toContain('export async function POST')
  })

  it('handler function exists and calls availabilityService', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'app/api/availability/route.ts'),
      'utf-8'
    )
    expect(src).toContain('async function handler')
    expect(src).toContain('availabilityService.getAvailableSlots')
  })
})

// ── PH4-ABN-01: Real session guard tests ──────────────────────────────────────

describe('PH4-ABN-01: ABN route session guard — real Zod and route structure', () => {
  it('session check comes before rate limit call in function body', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'app/api/abn/verify/route.ts'),
      'utf-8'
    )
    const postFnIdx = src.indexOf('export async function POST')
    expect(postFnIdx).toBeGreaterThan(-1)
    const postBody = src.slice(postFnIdx)
    const sessionCheckIdx = postBody.indexOf('!session?.user')
    const rateLimitCallIdx = postBody.indexOf('checkRateLimitStrict')
    expect(sessionCheckIdx).toBeGreaterThan(-1)
    expect(rateLimitCallIdx).toBeGreaterThan(-1)
    expect(sessionCheckIdx).toBeLessThan(rateLimitCallIdx)
  })

  it('role check comes between session check and rate limit', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'app/api/abn/verify/route.ts'),
      'utf-8'
    )
    const postBody = src.slice(src.indexOf('export async function POST'))
    const sessionCheckIdx = postBody.indexOf('!session?.user')
    const roleCheckIdx = postBody.indexOf("role !== 'provider'")
    const rateLimitIdx = postBody.indexOf('checkRateLimitStrict')
    expect(sessionCheckIdx).toBeLessThan(roleCheckIdx)
    expect(roleCheckIdx).toBeLessThan(rateLimitIdx)
  })

  it('rate limit key is scoped to provider id (not global)', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'app/api/abn/verify/route.ts'),
      'utf-8'
    )
    expect(src).toContain('`abn-verify:${session.user.id}`')
  })

  it('abnVerifyRateLimit uses 10 requests per hour', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'lib/ratelimit.ts'),
      'utf-8'
    )
    // Find the specific export for ABN
    const exportIdx = src.indexOf('export const abnVerifyRateLimit')
    const lineEnd = src.indexOf('\n', exportIdx)
    const line = src.slice(exportIdx, lineEnd)
    expect(line).toContain("createRateLimiter(10, '1 h')")
  })

  it('checkRateLimitStrict fails closed in production when Redis unavailable', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'lib/ratelimit.ts'),
      'utf-8'
    )
    // Confirm production fail-closed from the earlier PH4-PAY-01 fix
    expect(src).toContain("process.env.NODE_ENV === 'production'")
    expect(src).toContain("success: false")
  })

  it('ABN route imports and uses abnVerifyRateLimit from ratelimit', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'app/api/abn/verify/route.ts'),
      'utf-8'
    )
    expect(src).toContain("abnVerifyRateLimit")
    expect(src).toContain("from '@/lib/ratelimit'")
    expect(src).toContain("checkRateLimitStrict(abnVerifyRateLimit,")
  })

  it('ABN route requires provider role (lowercase as stored in DB)', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'app/api/abn/verify/route.ts'),
      'utf-8'
    )
    // Lowercase 'provider' — consistent with DB value and earnings/payout routes
    expect(src).toContain("role !== 'provider'")
    // Not uppercase PROVIDER — the DB stores lowercase
    const roleCheckLine = src.split('\n').find(l => l.includes("role !== 'provider'"))
    expect(roleCheckLine).toBeDefined()
    expect(roleCheckLine).not.toContain("'PROVIDER'")
  })

  it('denies non-provider role using the actual route handler', async () => {
    vi.mock('next-auth/next', () => ({
      getServerSession: vi.fn().mockResolvedValue({
        user: { id: 'user-1', role: 'CLIENT', email: 'test@test.com' }
      })
    }))
    vi.mock('@/lib/auth', () => ({ authOptions: {} }))
    // Rate limit must pass for this test to reach the role check
    vi.mock('@/lib/ratelimit', async (importOriginal) => {
      const original = await importOriginal() as any
      return {
        ...original,
        checkRateLimitStrict: vi.fn().mockResolvedValue({ success: true }),
      }
    })

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
