/**
 * Regression tests for Phase 4 audit finding fixes
 *
 * PH4-ADM-02 — Bootstrap endpoint returns 404 when SUPER_ADMIN exists
 * PH4-CRON-01 — slot-cleanup requires auth (x-vercel-cron or CRON_SECRET)
 * PH4-SUB-CHK-01 — Stripe checkout URLs use getAppUrl(), not NEXTAUTH_URL
 * PH4-ADM-01 — cancellations uses requirePermission, not raw role check
 * PH4-INS-01 — earnings enforces role === 'provider'
 * PH4-PAY-01 — create-intent uses bookingRateLimit (Upstash), not in-memory
 * PH4-PAY-02 — Stripe instantiated at module level, not inside handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { getAppUrl } from '@/lib/utils/appUrl'

// ── PH4-SUB-CHK-01: getAppUrl() helper ─────────────────────────────────────

describe('getAppUrl()', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns NEXT_PUBLIC_APP_URL when set', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://drivebook.com.au'
    delete process.env.NEXTAUTH_URL
    expect(getAppUrl()).toBe('https://drivebook.com.au')
  })

  it('falls back to NEXTAUTH_URL when NEXT_PUBLIC_APP_URL is absent', () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    process.env.NEXTAUTH_URL = 'https://staging.drivebook.com.au'
    expect(getAppUrl()).toBe('https://staging.drivebook.com.au')
  })

  it('falls back to localhost when both env vars are absent', () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    delete process.env.NEXTAUTH_URL
    expect(getAppUrl()).toBe('http://localhost:3000')
  })

  it('NEXT_PUBLIC_APP_URL takes priority over NEXTAUTH_URL', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://drivebook.com.au'
    process.env.NEXTAUTH_URL = 'http://localhost:3000'
    // Production domain wins, localhost does not leak into Stripe redirect URLs
    expect(getAppUrl()).toBe('https://drivebook.com.au')
    expect(getAppUrl()).not.toBe('http://localhost:3000')
  })
})

// ── PH4-CRON-01: slot-cleanup source check ───────────────────────────────────

describe('PH4-CRON-01: slot-cleanup auth (source verification)', () => {
  it('slot-cleanup route source contains x-vercel-cron check', async () => {
    const { readFileSync } = await import('fs')
    const { resolve } = await import('path')
    const src = readFileSync(
      resolve(process.cwd(), 'app/api/cron/slot-cleanup/route.ts'),
      'utf-8'
    )
    expect(src).toContain("x-vercel-cron")
    expect(src).toContain("CRON_SECRET")
    expect(src).toContain("Unauthorized")
  })

  it('slot-cleanup route denies requests without CRON_SECRET', async () => {
    const { GET } = await import('@/app/api/cron/slot-cleanup/route')
    const req = new NextRequest('http://localhost/api/cron/slot-cleanup')
    delete process.env.CRON_SECRET
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('slot-cleanup route denies x-vercel-cron header without CRON_SECRET — header alone is not proof of Vercel origin', async () => {
    const { GET } = await import('@/app/api/cron/slot-cleanup/route')
    const req = new NextRequest('http://localhost/api/cron/slot-cleanup', {
      headers: { 'x-vercel-cron': '1' }  // any caller can send this header
    })
    delete process.env.CRON_SECRET
    const res = await GET(req)
    // Must still be 401 — x-vercel-cron alone does not authenticate
    expect(res.status).toBe(401)
  })

  it('slot-cleanup route allows valid CRON_SECRET Bearer token', async () => {
    vi.mock('@/lib/jobs/slotReservationCleanup', () => ({
      cleanupExpiredSlotReservations: vi.fn().mockResolvedValue({ deletedCount: 0, timestamp: new Date() })
    }))
    vi.mock('@/lib/services/cron-health', () => ({
      pingCronHealth: vi.fn().mockResolvedValue(undefined),
      failCronHealth: vi.fn().mockResolvedValue(undefined),
    }))
    process.env.CRON_SECRET = 'test-cron-secret-abc123'
    const { GET } = await import('@/app/api/cron/slot-cleanup/route')
    const req = new NextRequest('http://localhost/api/cron/slot-cleanup', {
      headers: { 'authorization': 'Bearer test-cron-secret-abc123' }
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    delete process.env.CRON_SECRET
  })
})

// ── PH4-ADM-02: Bootstrap returns 404 when SUPER_ADMIN exists ───────────────

describe('PH4-ADM-02: admin/register bootstrap endpoint', () => {
  it('bootstrap route source checks for existing SUPER_ADMIN', async () => {
    const { readFileSync } = await import('fs')
    const { resolve } = await import('path')
    const src = readFileSync(
      resolve(process.cwd(), 'app/api/admin/register/route.ts'),
      'utf-8'
    )
    expect(src).toContain("SUPER_ADMIN")
    // After fix: returns 404, not 400, when admin exists
    expect(src).toContain('status: 404')
    expect(src).not.toContain("Admin account already exists")
  })
})

// ── PH4-ADM-01: cancellations uses requirePermission ─────────────────────────

describe('PH4-ADM-01: admin/cancellations permission check', () => {
  it('cancellations route uses requirePermission not raw role check', async () => {
    const { readFileSync } = await import('fs')
    const { resolve } = await import('path')
    const src = readFileSync(
      resolve(process.cwd(), 'app/api/admin/cancellations/route.ts'),
      'utf-8'
    )
    expect(src).toContain("requirePermission")
    expect(src).toContain("PERM.")
    // Raw role check removed
    expect(src).not.toContain("user?.role !== 'SUPER_ADMIN' && user?.role !== 'ADMIN'")
  })
})

// ── PH4-INS-01: earnings enforces provider role ───────────────────────────────

describe('PH4-INS-01: earnings route role guard', () => {
  it('earnings route source contains explicit role guard', async () => {
    const { readFileSync } = await import('fs')
    const { resolve } = await import('path')
    const src = readFileSync(
      resolve(process.cwd(), 'app/api/instructor/earnings/route.ts'),
      'utf-8'
    )
    expect(src).toContain("role !== 'provider'")
    expect(src).toContain("Forbidden")
  })
})

// ── PH4-PAY-01: create-intent uses bookingRateLimit ──────────────────────────

describe('PH4-PAY-01: create-intent rate limiter', () => {
  it('create-intent does not use in-memory rate limiter', async () => {
    const { readFileSync } = await import('fs')
    const { resolve } = await import('path')
    const src = readFileSync(
      resolve(process.cwd(), 'app/api/payments/create-intent/route.ts'),
      'utf-8'
    )
    // In-memory limiter removed
    expect(src).not.toContain('__createIntentRateLimits')
    expect(src).not.toContain('new Map()')
    // Upstash-backed limiter used
    expect(src).toContain('bookingRateLimit')
  })
})

// ── PH4-PAY-02: Stripe module-level instantiation ────────────────────────────

describe('PH4-PAY-02: Stripe instantiation in checkout and billing-portal routes', () => {
  it('subscriptions/checkout does not use require() inside handler', async () => {
    const { readFileSync } = await import('fs')
    const { resolve } = await import('path')
    const src = readFileSync(
      resolve(process.cwd(), 'app/api/subscriptions/checkout/route.ts'),
      'utf-8'
    )
    expect(src).not.toContain("require('stripe')")
    expect(src).toContain("import Stripe from 'stripe'")
    expect(src).toContain("new Stripe(")
  })

  it('billing-portal does not use require() inside handler', async () => {
    const { readFileSync } = await import('fs')
    const { resolve } = await import('path')
    const src = readFileSync(
      resolve(process.cwd(), 'app/api/instructor/subscription/billing-portal/route.ts'),
      'utf-8'
    )
    expect(src).not.toContain("require('stripe')")
    expect(src).not.toContain("require('@/lib/config/subscriptions')")
    expect(src).toContain("import Stripe from 'stripe'")
  })
})

// ── PH4-SUB-CHK-01: Billing portal return URL ────────────────────────────────

describe('PH4-SUB-CHK-01: billing-portal return URL uses getAppUrl()', () => {
  it('billing-portal does not use NEXTAUTH_URL for baseReturnUrl', async () => {
    const { readFileSync } = await import('fs')
    const { resolve } = await import('path')
    const src = readFileSync(
      resolve(process.cwd(), 'app/api/instructor/subscription/billing-portal/route.ts'),
      'utf-8'
    )
    // No fallback to NEXTAUTH_URL for return URL construction
    expect(src).not.toContain('NEXTAUTH_URL}/dashboard')
    // Uses getAppUrl() as fallback
    expect(src).toContain('getAppUrl()')
    // Open redirect protection: validates same-origin
    expect(src).toContain('same origin')
  })
})

// ── PH4-PAY-01: Production fail-closed when Redis unconfigured ───────────────

describe('PH4-PAY-01: ratelimit production fail-closed', () => {
  it('ratelimit.ts denies in production when Redis not configured', async () => {
    const { readFileSync } = await import('fs')
    const { resolve } = await import('path')
    const src = readFileSync(
      resolve(process.cwd(), 'lib/ratelimit.ts'),
      'utf-8'
    )
    // Production fail-closed branch present
    expect(src).toContain("process.env.NODE_ENV === 'production'")
    expect(src).toContain("success: false")
    // In-memory fallback restricted to non-production
    expect(src).toContain("Development/test only")
  })
})

// ── PH4-ADM-02: Bootstrap race fixed ─────────────────────────────────────────

describe('PH4-ADM-02: Bootstrap atomic guard', () => {
  it('admin/register uses SERIALIZABLE transaction', async () => {
    const { readFileSync } = await import('fs')
    const { resolve } = await import('path')
    const src = readFileSync(
      resolve(process.cwd(), 'app/api/admin/register/route.ts'),
      'utf-8'
    )
    // Atomic transaction wraps check+create
    expect(src).toContain("prisma.$transaction")
    expect(src).toContain("Serializable")
    // Returns 404 on existing admin (not 400)
    expect(src).toContain('status: 404')
    expect(src).not.toContain("Admin account already exists")
  })
})
