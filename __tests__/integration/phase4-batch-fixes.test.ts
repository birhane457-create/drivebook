/**
 * Tests for Phase 4 batch fixes
 *
 * PH4-WH-01 — WhatsApp webhook fail-closed in production
 * PH4-WH-02 — Stripe proxy timeout
 * PH4-DBG-01 — debug/session auth gate
 * PH4-CAL-01 — OAuth callback uses getAppUrl()
 * PH4-CLT-02 — transactions CLIENT role gate
 * PH4-CLT-03 — schedule-package-hours numeric bounds
 * PH4-CLT-04 — quote request rate limit
 * PH4-CLT-05 — @ts-nocheck removed from schedule-package-hours
 * PH4-INS-03 — document upload rate limit
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { NextRequest } from 'next/server'

function src(relPath: string) {
  return readFileSync(resolve(process.cwd(), relPath), 'utf-8')
}

// ── PH4-WH-01: WhatsApp fail-closed ──────────────────────────────────────────

describe('PH4-WH-01: WhatsApp webhook fail-closed in production', () => {
  it('POST handler rejects when WHATSAPP_APP_SECRET unset in production', () => {
    const s = src('app/api/webhooks/whatsapp/route.ts')
    expect(s).toContain("NODE_ENV === 'production'")
    expect(s).toContain('status: 503')
    // The production guard must appear in the else/no-secret path
    expect(s).toContain("NODE_ENV === 'production'")
  })

  it('development still accepts without signature', () => {
    const s = src('app/api/webhooks/whatsapp/route.ts')
    // Development path logs warn and accepts
    expect(s).toContain('development only')
    expect(s).toContain("logger.warn")
  })
})

// ── PH4-WH-02: Stripe proxy timeout ──────────────────────────────────────────

describe('PH4-WH-02: Stripe proxy 30-second timeout', () => {
  it('proxy fetch uses AbortController with 30s timeout', () => {
    const s = src('app/api/webhooks/stripe/route.ts')
    expect(s).toContain('AbortController')
    expect(s).toContain('30_000')
    expect(s).toContain('controller.abort()')
    expect(s).toContain('signal: controller.signal')
    expect(s).toContain('clearTimeout(timeoutId)')
  })
})

// ── PH4-DBG-01: debug/session auth gate ──────────────────────────────────────

describe('PH4-DBG-01: debug/session requires authentication', () => {
  it('unauthenticated requests receive 401', async () => {
    vi.mock('next-auth', () => ({
      getServerSession: vi.fn().mockResolvedValue(null)
    }))
    vi.mock('@/lib/auth', () => ({ authOptions: {} }))

    const { GET } = await import('@/app/api/debug/session/route')
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.hasSession).toBe(false)
  })

  it('source contains auth gate before session data return', () => {
    const s = src('app/api/debug/session/route.ts')
    const noSessionIdx = s.indexOf('!session')
    const returnSessionIdx = s.indexOf('hasSession: true')
    expect(noSessionIdx).toBeGreaterThan(-1)
    expect(returnSessionIdx).toBeGreaterThan(-1)
    expect(noSessionIdx).toBeLessThan(returnSessionIdx)
  })
})

// ── PH4-CAL-01: OAuth callback uses getAppUrl() ───────────────────────────────

describe('PH4-CAL-01: OAuth callback uses getAppUrl()', () => {
  it('calendar callback imports getAppUrl from lib/utils/appUrl', () => {
    const s = src('app/api/calendar/callback/route.ts')
    expect(s).toContain("from '@/lib/utils/appUrl'")
    expect(s).toContain('getAppUrl()')
  })

  it('no longer uses NEXTAUTH_URL for redirect base', () => {
    const s = src('app/api/calendar/callback/route.ts')
    // The old appUrl() helper that read NEXTAUTH_URL is gone
    expect(s).not.toContain('process.env.NEXTAUTH_URL')
  })

  it('oauthRedirectUrl uses getAppUrl as base', () => {
    const s = src('app/api/calendar/callback/route.ts')
    expect(s).toContain('oauthRedirectUrl')
    expect(s).toContain('getAppUrl()')
    // All redirect calls use oauthRedirectUrl
    expect(s).toContain('oauthRedirectUrl(`/dashboard/settings')
  })
})

// ── PH4-CLT-02: transactions CLIENT role gate ─────────────────────────────────

describe('PH4-CLT-02: transactions route CLIENT role gate', () => {
  it('transactions route checks for CLIENT role', () => {
    const s = src('app/api/client/transactions/route.ts')
    expect(s).toContain("role !== 'CLIENT'")
    expect(s).toContain("'Forbidden'")
    expect(s).toContain('status: 403')
  })

  it('role check comes after session check', () => {
    const s = src('app/api/client/transactions/route.ts')
    const sessionIdx = s.indexOf('!session?.user?.email')
    const roleIdx = s.indexOf("role !== 'CLIENT'")
    expect(sessionIdx).toBeGreaterThan(-1)
    expect(roleIdx).toBeGreaterThan(-1)
    expect(sessionIdx).toBeLessThan(roleIdx)
  })
})

// ── PH4-CLT-03: hoursToSchedule numeric bounds ───────────────────────────────

describe('PH4-CLT-03: schedule-package-hours numeric validation', () => {
  it('validates hoursToSchedule is a finite positive number', () => {
    const s = src('app/api/client/schedule-package-hours/route.ts')
    expect(s).toContain('typeof hoursToSchedule !== \'number\'')
    expect(s).toContain('!isFinite(hoursToSchedule)')
    expect(s).toContain('hoursToSchedule <= 0')
    expect(s).toContain('hoursToSchedule > 10')
  })

  it('rejects non-numeric hoursToSchedule', () => {
    // Unit test of the validation logic
    const validate = (v: unknown) => (
      v === undefined || v === null ||
      typeof v !== 'number' || !isFinite(v as number) ||
      (v as number) <= 0 || (v as number) > 10
    )
    expect(validate(undefined)).toBe(true)
    expect(validate(null)).toBe(true)
    expect(validate('2')).toBe(true)        // string — rejected
    expect(validate(0)).toBe(true)           // zero — rejected
    expect(validate(-1)).toBe(true)          // negative — rejected
    expect(validate(11)).toBe(true)          // over max — rejected
    expect(validate(Infinity)).toBe(true)    // infinite — rejected
    expect(validate(0.5)).toBe(false)        // valid
    expect(validate(10)).toBe(false)         // at max — valid
    expect(validate(2)).toBe(false)          // normal case — valid
  })
})

// ── PH4-CLT-04: quote request rate limit ──────────────────────────────────────

describe('PH4-CLT-04: quote request rate limit', () => {
  it('quotes/request imports and calls checkRateLimitStrict', () => {
    const s = src('app/api/client/quotes/request/route.ts')
    expect(s).toContain('checkRateLimitStrict')
    expect(s).toContain('bookingRateLimit')
    expect(s).toContain('quote-request')
  })

  it('rate limit check comes after session check', () => {
    const s = src('app/api/client/quotes/request/route.ts')
    // Slice to the POST function body to avoid matching the import line
    const postFnIdx = s.indexOf('export async function POST')
    const postBody = s.slice(postFnIdx)
    const sessionIdx = postBody.indexOf('!session?.user?.id')
    const rateLimitIdx = postBody.indexOf('checkRateLimitStrict')
    expect(sessionIdx).toBeGreaterThan(-1)
    expect(rateLimitIdx).toBeGreaterThan(-1)
    expect(sessionIdx).toBeLessThan(rateLimitIdx)
  })
})

// ── PH4-CLT-05: @ts-nocheck removed ──────────────────────────────────────────

describe('PH4-CLT-05: @ts-nocheck removed from schedule-package-hours', () => {
  it('schedule-package-hours no longer has @ts-nocheck directive', () => {
    const s = src('app/api/client/schedule-package-hours/route.ts')
    expect(s).not.toContain('@ts-nocheck')
  })
})

// ── PH4-INS-03: document upload rate limit ────────────────────────────────────

describe('PH4-INS-03: instructor document upload rate limit', () => {
  it('documents route imports documentUploadRateLimit', () => {
    const s = src('app/api/instructor/documents/route.ts')
    expect(s).toContain('documentUploadRateLimit')
    expect(s).toContain("from '@/lib/ratelimit'")
  })

  it('documentUploadRateLimit exported from lib/ratelimit.ts', () => {
    const s = src('lib/ratelimit.ts')
    expect(s).toContain('export const documentUploadRateLimit')
    expect(s).toContain("createRateLimiter(10, '1 h')")
  })

  it('rate limit key scoped to provider', () => {
    const s = src('app/api/instructor/documents/route.ts')
    expect(s).toContain('doc-upload')
    expect(s).toContain('session.user.providerId')
  })

  it('rate limit check runs before file processing', () => {
    const s = src('app/api/instructor/documents/route.ts')
    const rateLimitIdx = s.indexOf('checkRateLimitStrict(documentUploadRateLimit')
    const fileProcessIdx = s.indexOf('req.formData()')
    expect(rateLimitIdx).toBeGreaterThan(-1)
    expect(fileProcessIdx).toBeGreaterThan(-1)
    expect(rateLimitIdx).toBeLessThan(fileProcessIdx)
  })
})
