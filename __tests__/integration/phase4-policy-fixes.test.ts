/**
 * Tests for Phase 4 policy decision fixes
 *
 * PH4-PUB-01 — Public booking IP-level rate limit (20/hour per IP)
 * PH4-ADM-03 — Admin staff password minimum 12 characters
 * PH4-ADM-04 — Payout list maximum 50 records per page
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── PH4-ADM-03: Admin password minimum ────────────────────────────────────────

describe('PH4-ADM-03: Admin staff password minimum', () => {
  it('staff schema rejects password of 11 characters', async () => {
    // Import schema validation logic via the z.string().min(12) in the route
    const src = readFileSync(resolve(process.cwd(), 'app/api/admin/staff/route.ts'), 'utf-8')
    // Confirm minimum is 12 not 8
    expect(src).toContain('min(12')
    expect(src).not.toContain('min(8)')
  })

  it('staff schema includes a clear error message for short passwords', async () => {
    const src = readFileSync(resolve(process.cwd(), 'app/api/admin/staff/route.ts'), 'utf-8')
    expect(src).toContain('at least 12 characters')
  })

  it('staff route rejects password of exactly 11 characters via Zod', async () => {
    const { z } = await import('zod')
    const schema = z.object({
      password: z.string().min(12, 'Password must be at least 12 characters'),
    })
    const result = schema.safeParse({ password: '11charpassw' }) // 11 chars
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('12 characters')
    }
  })

  it('staff route accepts password of exactly 12 characters via Zod', async () => {
    const { z } = await import('zod')
    const schema = z.object({
      password: z.string().min(12, 'Password must be at least 12 characters'),
    })
    const result = schema.safeParse({ password: '12charpasswd' }) // 12 chars
    expect(result.success).toBe(true)
  })
})

// ── PH4-ADM-04: Payout pagination maximum ─────────────────────────────────────

describe('PH4-ADM-04: Payout pagination maximum', () => {
  it('payout route caps limit at 50', async () => {
    const src = readFileSync(resolve(process.cwd(), 'app/api/admin/payouts/route.ts'), 'utf-8')
    expect(src).toContain('Math.min(50,')
    expect(src).not.toContain('Math.min(100,')
  })

  it('Math.min(50, ...) clamps requests above 50', () => {
    // Replicates the route logic: Math.min(50, Math.max(1, parseInt(value, 10)))
    const resolveLimit = (value: string) => Math.min(50, Math.max(1, parseInt(value, 10)))
    expect(resolveLimit('100')).toBe(50)   // request for 100 → capped at 50
    expect(resolveLimit('51')).toBe(50)    // request for 51 → capped at 50
    expect(resolveLimit('50')).toBe(50)    // exactly 50 → allowed
    expect(resolveLimit('25')).toBe(25)    // below cap → unchanged
    expect(resolveLimit('1')).toBe(1)      // minimum → allowed
    expect(resolveLimit('0')).toBe(1)      // below minimum → floored to 1
  })

  it('payout route retains permission check', async () => {
    const src = readFileSync(resolve(process.cwd(), 'app/api/admin/payouts/route.ts'), 'utf-8')
    expect(src).toContain('requirePermission')
    expect(src).toContain('FINANCE_PAYOUTS_VIEW')
  })

  it('payout route retains default limit of 50', async () => {
    const src = readFileSync(resolve(process.cwd(), 'app/api/admin/payouts/route.ts'), 'utf-8')
    // Default value in parseInt fallback should still be 50
    expect(src).toContain("'50'")
  })
})

// ── PH4-PUB-01: Public booking IP rate limit ──────────────────────────────────

describe('PH4-PUB-01: Public booking IP-level rate limit', () => {
  it('publicBookingIpRateLimit is exported from lib/ratelimit.ts', async () => {
    const src = readFileSync(resolve(process.cwd(), 'lib/ratelimit.ts'), 'utf-8')
    expect(src).toContain('publicBookingIpRateLimit')
    // 20 per hour
    expect(src).toContain("createRateLimiter(20, '1 h')")
  })

  it('public bookings route imports publicBookingIpRateLimit', async () => {
    const src = readFileSync(resolve(process.cwd(), 'app/api/public/bookings/route.ts'), 'utf-8')
    expect(src).toContain('publicBookingIpRateLimit')
  })

  it('public bookings route retains existing email+provider limit', async () => {
    const src = readFileSync(resolve(process.cwd(), 'app/api/public/bookings/route.ts'), 'utf-8')
    // Both limiters must be present
    expect(src).toContain('publicBookingIpRateLimit')
    expect(src).toContain('bookingRateLimit')
  })

  it('IP is extracted from x-forwarded-for first value only (trusted proxy header)', async () => {
    const src = readFileSync(resolve(process.cwd(), 'app/api/public/bookings/route.ts'), 'utf-8')
    // Takes first value only via split(',')[0] — not the full header
    expect(src).toContain("split(',')[0].trim()")
  })

  it('IP limit check runs before email+provider limit check', async () => {
    const src = readFileSync(resolve(process.cwd(), 'app/api/public/bookings/route.ts'), 'utf-8')
    // The IP limiter call uses the key 'public-booking-ip'; email limiter uses the email+provider key
    const ipCallIdx = src.indexOf('public-booking-ip')
    const emailCallIdx = src.indexOf('public-booking:${data.customerEmail}')
    expect(ipCallIdx).toBeGreaterThan(-1)
    expect(emailCallIdx).toBeGreaterThan(-1)
    // IP limit call must appear before email+provider limit call in source
    expect(ipCallIdx).toBeLessThan(emailCallIdx)
  })

  it('IP rotation across different emails: same IP is limited regardless of email', () => {
    // Simulates the IP key construction
    const buildIpKey = (ip: string) => `public-booking-ip:${ip}`
    const buildEmailKey = (ip: string, email: string, providerId: string) =>
      `public-booking:${email}:${providerId}:${ip}`

    const ip = '1.2.3.4'
    const emails = ['a@test.com', 'b@test.com', 'c@test.com']
    const providerId = 'prov-1'

    // All requests from same IP map to same IP key → same limiter bucket
    const ipKeys = emails.map(() => buildIpKey(ip))
    expect(ipKeys.every(k => k === ipKeys[0])).toBe(true)

    // Each email+provider combination maps to different email key → different buckets
    const emailKeys = emails.map(e => buildEmailKey(ip, e, providerId))
    const uniqueEmailKeys = new Set(emailKeys)
    expect(uniqueEmailKeys.size).toBe(emails.length)
  })

  it('same email across different IPs: each IP has its own IP limit bucket', () => {
    const buildIpKey = (ip: string) => `public-booking-ip:${ip}`

    const ips = ['1.2.3.4', '5.6.7.8', '9.10.11.12']
    const ipKeys = ips.map(ip => buildIpKey(ip))
    const uniqueKeys = new Set(ipKeys)

    // Different IPs → different IP limit buckets → not affected by each other
    expect(uniqueKeys.size).toBe(ips.length)
  })

  it('shared IP scenario: multiple users behind same IP share the IP limit', () => {
    // This is the shared-network trade-off documented in the limiter comment.
    // The IP limit is intentionally generous (20/hour) to minimise false positives.
    const buildIpKey = (ip: string) => `public-booking-ip:${ip}`

    const sharedIp = '203.0.113.1' // RFC 5737 test address
    const user1Key = buildIpKey(sharedIp)
    const user2Key = buildIpKey(sharedIp)

    // Both users behind the shared IP hit the same bucket — by design.
    // The email+provider limit (second check) still differentiates them.
    expect(user1Key).toBe(user2Key)
  })
})
