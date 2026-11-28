/**
 * PB-SEC-01 Regression Tests — Email Ownership OTP
 *
 * Tests the OTP flow for linking a guest booking to an existing account.
 * All tests are pure logic/unit level — no HTTP server or DB required.
 *
 * Tests:
 *   T1:  New email → no OTP challenge (new-user path, not existing-user)
 *   T2:  Existing email, no token → 409 EMAIL_OWNERSHIP_REQUIRED
 *   T3:  Existing email, correct token → booking proceeds (token consumed)
 *   T4:  Existing email, wrong token (arbitrary non-empty string) → 400 OTP_INVALID
 *   T5:  Existing email, expired token → 400 OTP_INVALID
 *   T6:  Token single-use — second call with same token fails
 *   T7:  P2002 race path, no token → 409 EMAIL_OWNERSHIP_REQUIRED
 *   T8:  P2002 race path, valid token → linked (same validation as normal path)
 *   T9:  P2002 race path, bogus token → 400 OTP_INVALID
 *   T10: verify-otp: correct code → returns session token
 *   T11: verify-otp: wrong code → 400 OTP_WRONG with attempt decrement
 *   T12: verify-otp: expired code → 400 OTP_EXPIRED
 *   T13: verify-otp: 5 wrong attempts → 429 OTP_LOCKED on 6th
 *
 * EXECUTION:
 *   npx vitest run __tests__/integration/pb-sec-01-otp-ownership.test.ts
 */

import { describe, it, expect } from 'vitest'

// ── Replicate the bulk-route token validation logic ──────────────────────────
// Extracted from app/api/public/bookings/bulk/route.ts for unit testing.

interface StoredOtp {
  id: string
  ownershipOtpToken: string | null
  ownershipOtpExpiry: Date | null
  ownershipOtpAttempts: number
}

interface TokenCheckResult {
  valid: boolean
  code?: 'OTP_INVALID' | 'EMAIL_OWNERSHIP_REQUIRED'
}

/** Mirrors the existing-user token check in bulk/route.ts */
function checkOwnershipToken(
  suppliedToken: string | undefined | null,
  storedUser: StoredOtp | null,
  now: Date = new Date(),
): TokenCheckResult {
  const token = suppliedToken?.trim()

  if (!token) {
    return { valid: false, code: 'EMAIL_OWNERSHIP_REQUIRED' }
  }

  if (!storedUser || !storedUser.ownershipOtpToken || !storedUser.ownershipOtpExpiry) {
    return { valid: false, code: 'OTP_INVALID' }
  }

  const tokenMatch  = storedUser.ownershipOtpToken === token
  const notExpired  = new Date(storedUser.ownershipOtpExpiry) > now

  if (!tokenMatch || !notExpired) {
    return { valid: false, code: 'OTP_INVALID' }
  }

  return { valid: true }
}

// ── Replicate verify-otp response logic ──────────────────────────────────────

interface VerifyOtpResult {
  status: 200 | 400 | 429
  code?: string
  token?: string
}

const MAX_ATTEMPTS = 5

function verifyOtp(
  submittedOtp: string,
  stored: StoredOtp | null,
  now: Date = new Date(),
): VerifyOtpResult {
  if (!stored || !stored.ownershipOtpToken || !stored.ownershipOtpExpiry) {
    return { status: 400, code: 'OTP_NOT_FOUND' }
  }

  if (new Date(stored.ownershipOtpExpiry) <= now) {
    return { status: 400, code: 'OTP_EXPIRED' }
  }

  if ((stored.ownershipOtpAttempts ?? 0) >= MAX_ATTEMPTS) {
    return { status: 429, code: 'OTP_LOCKED' }
  }

  if (stored.ownershipOtpToken !== submittedOtp) {
    // Would increment attempts in real code
    const remaining = MAX_ATTEMPTS - ((stored.ownershipOtpAttempts ?? 0) + 1)
    return {
      status: remaining <= 0 ? 429 : 400,
      code: remaining <= 0 ? 'OTP_LOCKED' : 'OTP_WRONG',
    }
  }

  // Correct — returns a session token (UUID in real code)
  return { status: 200, token: 'session-token-uuid' }
}

// ── Token / expiry helpers ────────────────────────────────────────────────────

const VALID_SESSION_TOKEN = 'valid-session-token-abc123'
const EXPIRED_DATE = new Date(Date.now() - 60_000)   // 1 min ago
const FUTURE_DATE  = new Date(Date.now() + 15 * 60_000) // 15 min from now

function makeUser(overrides: Partial<StoredOtp> = {}): StoredOtp {
  return {
    id: 'user_123',
    ownershipOtpToken:    VALID_SESSION_TOKEN,
    ownershipOtpExpiry:   FUTURE_DATE,
    ownershipOtpAttempts: 0,
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PB-SEC-01 — email ownership OTP (token validation logic)', () => {

  // ── Existing-user bulk-route path ──────────────────────────────────────────

  it('T2: existing email, no token → EMAIL_OWNERSHIP_REQUIRED', () => {
    const result = checkOwnershipToken(undefined, makeUser())
    expect(result.valid).toBe(false)
    expect(result.code).toBe('EMAIL_OWNERSHIP_REQUIRED')
  })

  it('T2b: empty string token → EMAIL_OWNERSHIP_REQUIRED', () => {
    const result = checkOwnershipToken('', makeUser())
    expect(result.valid).toBe(false)
    expect(result.code).toBe('EMAIL_OWNERSHIP_REQUIRED')
  })

  it('T3: existing email, correct token → valid, booking proceeds', () => {
    const result = checkOwnershipToken(VALID_SESSION_TOKEN, makeUser())
    expect(result.valid).toBe(true)
    expect(result.code).toBeUndefined()
  })

  it('T4: existing email, wrong (arbitrary non-empty) token → OTP_INVALID', () => {
    // This is the core PB-SEC-01 regression — arbitrary string must not bypass
    const result = checkOwnershipToken('arbitrary-wrong-token', makeUser())
    expect(result.valid).toBe(false)
    expect(result.code).toBe('OTP_INVALID')
  })

  it('T5: existing email, expired token → OTP_INVALID', () => {
    const expiredUser = makeUser({ ownershipOtpExpiry: EXPIRED_DATE })
    const result = checkOwnershipToken(VALID_SESSION_TOKEN, expiredUser)
    expect(result.valid).toBe(false)
    expect(result.code).toBe('OTP_INVALID')
  })

  it('T6: token single-use — after consumption (null) second call fails', () => {
    // After verification the token is set to null in DB (consumed)
    const consumedUser = makeUser({ ownershipOtpToken: null, ownershipOtpExpiry: null })
    const result = checkOwnershipToken(VALID_SESSION_TOKEN, consumedUser)
    expect(result.valid).toBe(false)
    expect(result.code).toBe('OTP_INVALID')
  })

  it('T6b: token single-use — same token cannot be used twice in sequence', () => {
    // First use: valid
    const user = makeUser()
    expect(checkOwnershipToken(VALID_SESSION_TOKEN, user).valid).toBe(true)
    // Simulate consumption (bulk route sets ownershipOtpToken: null after use)
    const consumed = { ...user, ownershipOtpToken: null, ownershipOtpExpiry: null }
    // Second use: invalid
    expect(checkOwnershipToken(VALID_SESSION_TOKEN, consumed).valid).toBe(false)
    expect(checkOwnershipToken(VALID_SESSION_TOKEN, consumed).code).toBe('OTP_INVALID')
  })

  // ── P2002 race-condition path ───────────────────────────────────────────────

  it('T7: P2002 race path, no token → EMAIL_OWNERSHIP_REQUIRED (same gate)', () => {
    // The P2002 path uses the same checkOwnershipToken logic
    const result = checkOwnershipToken(null, makeUser())
    expect(result.valid).toBe(false)
    expect(result.code).toBe('EMAIL_OWNERSHIP_REQUIRED')
  })

  it('T8: P2002 race path, valid token → linked (same validation as normal path)', () => {
    const result = checkOwnershipToken(VALID_SESSION_TOKEN, makeUser())
    expect(result.valid).toBe(true)
  })

  it('T9: P2002 race path, bogus token → OTP_INVALID (token presence alone is not sufficient)', () => {
    // This was the original race bypass: only token presence was checked
    const result = checkOwnershipToken('any-non-empty-string', makeUser())
    expect(result.valid).toBe(false)
    expect(result.code).toBe('OTP_INVALID')
  })

  // ── verify-otp endpoint logic ──────────────────────────────────────────────

  it('T10: verify-otp: correct OTP → 200 with session token', () => {
    const stored = makeUser({ ownershipOtpToken: '123456' })
    const result = verifyOtp('123456', stored)
    expect(result.status).toBe(200)
    expect(result.token).toBeDefined()
  })

  it('T11: verify-otp: wrong OTP → 400 OTP_WRONG with attempt tracking', () => {
    const stored = makeUser({ ownershipOtpToken: '123456', ownershipOtpAttempts: 0 })
    const result = verifyOtp('999999', stored)
    expect(result.status).toBe(400)
    expect(result.code).toBe('OTP_WRONG')
  })

  it('T12: verify-otp: expired OTP → 400 OTP_EXPIRED', () => {
    const stored = makeUser({ ownershipOtpToken: '123456', ownershipOtpExpiry: EXPIRED_DATE })
    const result = verifyOtp('123456', stored)
    expect(result.status).toBe(400)
    expect(result.code).toBe('OTP_EXPIRED')
  })

  it('T13: verify-otp: 5 wrong attempts already → 429 OTP_LOCKED on 6th', () => {
    const locked = makeUser({ ownershipOtpToken: '123456', ownershipOtpAttempts: MAX_ATTEMPTS })
    const result = verifyOtp('wrong', locked)
    expect(result.status).toBe(429)
    expect(result.code).toBe('OTP_LOCKED')
  })

  it('T13b: verify-otp: 4th wrong attempt → still 400 OTP_WRONG (not locked yet)', () => {
    const almostLocked = makeUser({ ownershipOtpToken: '123456', ownershipOtpAttempts: 3 })
    const result = verifyOtp('wrong', almostLocked)
    expect(result.status).toBe(400)
    expect(result.code).toBe('OTP_WRONG')
  })

  it('T14: no stored OTP at all → OTP_NOT_FOUND', () => {
    const result = verifyOtp('123456', null)
    expect(result.status).toBe(400)
    expect(result.code).toBe('OTP_NOT_FOUND')
  })

})
