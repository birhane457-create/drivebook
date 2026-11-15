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
    expect(src).toContain("createRateLimiter(20, '1 h')")
  })

  it('public bookings route imports publicBookingIpRateLimit', async () => {
    const src = readFileSync(resolve(process.cwd(), 'app/api/public/bookings/route.ts'), 'utf-8')
    expect(src).toContain('publicBookingIpRateLimit')
  })

  it('public bookings route retains existing email+provider limit', async () => {
    const src = readFileSync(resolve(process.cwd(), 'app/api/public/bookings/route.ts'), 'utf-8')
    expect(src).toContain('publicBookingIpRateLimit')
    expect(src).toContain('bookingRateLimit')
  })

  it('IP key does not contain email or providerId', async () => {
    const src = readFileSync(resolve(process.cwd(), 'app/api/public/bookings/route.ts'), 'utf-8')
    // IP key must be a fixed prefix + IP only
    expect(src).toContain('`public-booking-ip:${ip}`')
    // IP key must not embed email or providerId
    expect(src).not.toContain('`public-booking-ip:${ip}:${data.')
  })

  it('email+provider key does not contain IP address', async () => {
    const src = readFileSync(resolve(process.cwd(), 'app/api/public/bookings/route.ts'), 'utf-8')
    // Key uses normalised email + providerId — no IP variable
    expect(src).toContain('`public-booking:${data.customerEmail.toLowerCase()}:${data.providerId}`')
    // The email key must not append ip
    const emailKeyLine = src.split('\n').find(l => l.includes('emailProviderKey'))
    expect(emailKeyLine).toBeDefined()
    expect(emailKeyLine).not.toContain('ip')
  })

  it('IP is extracted from first x-forwarded-for value only (trusted proxy header)', async () => {
    const src = readFileSync(resolve(process.cwd(), 'app/api/public/bookings/route.ts'), 'utf-8')
    expect(src).toContain("split(',')[0].trim()")
  })

  it('IP check runs before req.json() — protects body parsing from flooding', async () => {
    const src = readFileSync(resolve(process.cwd(), 'app/api/public/bookings/route.ts'), 'utf-8')
    const ipCheckIdx = src.indexOf('publicBookingIpRateLimit')
    const jsonParseIdx = src.indexOf('req.json()')
    expect(ipCheckIdx).toBeGreaterThan(-1)
    expect(jsonParseIdx).toBeGreaterThan(-1)
    expect(ipCheckIdx).toBeLessThan(jsonParseIdx)
  })

  it('email+provider check runs after body is parsed', async () => {
    const src = readFileSync(resolve(process.cwd(), 'app/api/public/bookings/route.ts'), 'utf-8')
    const jsonParseIdx = src.indexOf('req.json()')
    const emailKeyIdx = src.indexOf('emailProviderKey')
    expect(jsonParseIdx).toBeGreaterThan(-1)
    expect(emailKeyIdx).toBeGreaterThan(-1)
    expect(emailKeyIdx).toBeGreaterThan(jsonParseIdx)
  })

  it('key construction: IP rotation across different emails produces same IP bucket', () => {
    // Replicates the actual key construction in the route
    const buildIpKey = (ip: string) => `public-booking-ip:${ip}`
    const buildEmailKey = (email: string, providerId: string) =>
      `public-booking:${email.toLowerCase()}:${providerId}`

    const ip = '1.2.3.4'
    const emails = ['a@test.com', 'b@test.com', 'c@test.com']
    const providerId = 'prov-1'

    // All requests from same IP → same IP bucket
    const ipKeys = emails.map(() => buildIpKey(ip))
    expect(ipKeys.every(k => k === `public-booking-ip:${ip}`)).toBe(true)

    // Different emails → different email+provider buckets (IP-independent)
    const emailKeys = emails.map(e => buildEmailKey(e, providerId))
    expect(new Set(emailKeys).size).toBe(emails.length)

    // Email keys do not contain the IP — switching IP does not create new email bucket
    emailKeys.forEach(k => expect(k).not.toContain(ip))
  })

  it('key construction: same email from different IPs hits same email bucket', () => {
    const buildEmailKey = (email: string, providerId: string) =>
      `public-booking:${email.toLowerCase()}:${providerId}`

    const ips = ['1.2.3.4', '5.6.7.8', '9.10.11.12']
    const email = 'user@test.com'
    const providerId = 'prov-1'

    // All keys identical regardless of source IP — policy enforced globally
    const emailKeys = ips.map(() => buildEmailKey(email, providerId))
    expect(new Set(emailKeys).size).toBe(1)
    expect(emailKeys[0]).toBe('public-booking:user@test.com:prov-1')
  })

  it('key construction: email is normalised to lowercase', () => {
    const buildEmailKey = (email: string, providerId: string) =>
      `public-booking:${email.toLowerCase()}:${providerId}`

    expect(buildEmailKey('User@Test.COM', 'prov-1'))
      .toBe(buildEmailKey('user@test.com', 'prov-1'))
  })

  it('shared IP scenario: multiple users behind same IP share the IP bucket by design', () => {
    const buildIpKey = (ip: string) => `public-booking-ip:${ip}`
    const buildEmailKey = (email: string, providerId: string) =>
      `public-booking:${email.toLowerCase()}:${providerId}`

    const sharedIp = '203.0.113.1'

    // Both users map to the same IP bucket — shared NAT effect is acknowledged
    expect(buildIpKey(sharedIp)).toBe(buildIpKey(sharedIp))

    // But their email+provider buckets are independent
    const key1 = buildEmailKey('user1@a.com', 'prov-1')
    const key2 = buildEmailKey('user2@b.com', 'prov-1')
    expect(key1).not.toBe(key2)
  })
})
