/**
 * WLA-008 Cross-Provider Tenant Isolation Tests
 *
 * Covers three sub-findings discovered during the WLA-008 route inventory:
 *
 *   WLA-008-A: /api/instructor/invoices/[transactionId]
 *     - Was: findUnique(id) then post-fetch providerId check → IDOR pattern
 *     - Fix: findFirst({ where: { id, providerId } }) → DB-scoped ownership
 *
 *   WLA-008-B: /api/bookings/mobile POST
 *     - Was: accepted any customerId from body (no ownership check)
 *     - Was: created CONFIRMED bookings with no wallet debit (payment bypass)
 *     - Fix: verify customer belongs to provider; conditional CONFIRMED/PENDING_PAYMENT
 *            with wallet debit
 *
 *   WLA-008-C: /api/bookings/combined POST
 *     - Was: no rate limiting → calendar slot-squatting with zero-cost PENDING bookings
 *     - Fix: bookingRateLimit applied before request processing
 */

import { describe, it, test, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ─── Constants ───────────────────────────────────────────────────────────────

const PROVIDER_A_ID = 'prov-aaa-001'
const PROVIDER_B_ID = 'prov-bbb-002'
const PROVIDER_A_USER_ID = 'user-aaa-001'

const CUSTOMER_A_ID = 'cust-aaa-001'  // belongs to Provider A
const CUSTOMER_B_ID = 'cust-bbb-002'  // belongs to Provider B (foreign)

const TXN_A_ID = 'txn-aaa-001'
const TXN_B_ID = 'txn-bbb-002'

/** Build a minimal NextRequest with JSON body and optional Authorization header */
function buildRequest(
  method: string,
  path: string,
  body?: object,
  headers?: Record<string, string>
): NextRequest {
  const url = `http://localhost${path}`
  return new NextRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

// ─── WLA-008-A: Invoice IDOR source verification ──────────────────────────────
// These tests read the actual source to confirm the fix is in place — they do
// not mock the DB. The fix (findFirst with { id, providerId }) is structural
// and can be verified by reading the file.

describe('WLA-008-A: Invoice IDOR — source verification', () => {
  const invoiceSource = readFileSync(
    resolve(process.cwd(), 'app/api/instructor/invoices/[transactionId]/route.ts'),
    'utf-8'
  )

  it('A01 — route uses findFirst (not findUnique) for transaction lookup', () => {
    // Pre-fix used findUnique which has no WHERE clause for providerId.
    // Post-fix uses findFirst so { id, providerId } can be composed.
    expect(invoiceSource).toMatch(/findFirst/)
    expect(invoiceSource).not.toMatch(/findUnique.*transactionId/)
  })

  it('A02 — providerId is included in the WHERE clause of the DB query', () => {
    // The fix scopes the query so Provider A cannot retrieve Provider B records.
    // Confirm the WHERE clause contains providerId from session, not just the id param.
    expect(invoiceSource).toMatch(/where:\s*\{[^}]*id:\s*transactionId[^}]*providerId/)
  })

  it('A03 — no separate post-fetch ownership check exists (removed, replaced by DB scope)', () => {
    // The old pattern was: fetch first, then check transaction.providerId !== session.user.providerId
    // That pattern is removed — the DB scope is the only gate.
    expect(invoiceSource).not.toMatch(/transaction\.providerId\s*!==/)
  })

  it('A04 — a null result from findFirst returns 404 (not 403), hiding record existence', () => {
    // Returning 404 for both "doesn't exist" and "belongs to another provider" prevents
    // Provider A from distinguishing Provider B's transactions from non-existent IDs.
    const nullHandlingSection = invoiceSource.slice(
      invoiceSource.indexOf('if (!transaction)'),
      invoiceSource.indexOf('if (!transaction)') + 200
    )
    expect(nullHandlingSection).toMatch(/404/)
    expect(nullHandlingSection).not.toMatch(/403/)
  })
})

// ─── WLA-008-B: Mobile POST — source verification ────────────────────────────

describe('WLA-008-B: Mobile POST — source verification', () => {
  const mobileSource = readFileSync(
    resolve(process.cwd(), 'app/api/bookings/mobile/route.ts'),
    'utf-8'
  )

  it('B01 — customer ownership check is present (bookings.some + providerId)', () => {
    // Fix requires the customer to belong to this provider via a prior booking.
    // This is the same scoping pattern used by /api/instructor/clients/[id].
    expect(mobileSource).toMatch(/bookings.*some.*providerId.*decoded\.providerId/)
  })

  it('B02 — CONFIRMED status is conditional on wallet balance, not hardcoded', () => {
    // Pre-fix: status was hardcoded to 'CONFIRMED' regardless of wallet balance.
    // Post-fix: bookingStatus is 'CONFIRMED' only when wallet >= price.
    expect(mobileSource).toMatch(/bookingStatus.*CONFIRMED.*PENDING_PAYMENT|PENDING_PAYMENT.*bookingStatus.*CONFIRMED/)
    // The booking.create data block must use the variable, not the string literal directly
    // (status: bookingStatus, not status: 'CONFIRMED')
    expect(mobileSource).toMatch(/status:\s*bookingStatus/)
    // The booking create data must NOT have status: 'CONFIRMED' as a literal —
    // check specifically in the create data context (after 'data: {')
    const createDataSection = mobileSource.slice(
      mobileSource.indexOf('status: bookingStatus'),
      mobileSource.indexOf('status: bookingStatus') + 50
    )
    expect(createDataSection).not.toMatch(/status:\s*'CONFIRMED'/)
  })

  it('B03 — wallet debit is created when booking is CONFIRMED', () => {
    // A CONFIRMED booking must have an accompanying wallet DEBIT transaction.
    expect(mobileSource).toMatch(/type:\s*'DEBIT'/)
  })

  it('B04 — isPaid reflects computed bookingStatus, not hardcoded', () => {
    // isPaid must track the computed status, not be a bare true literal.
    expect(mobileSource).toMatch(/isPaid:\s*bookingStatus\s*===\s*'CONFIRMED'/)
  })

  it('B05 — customer ownership check fires before booking creation', () => {
    // Ownership check must appear before prisma.$transaction (booking create).
    const ownershipPos = mobileSource.indexOf('bookings: { some: { providerId: decoded.providerId }')
    const txnPos = mobileSource.indexOf('prisma.$transaction')
    expect(ownershipPos).toBeGreaterThan(0)
    expect(txnPos).toBeGreaterThan(ownershipPos)
  })
})

// ─── WLA-008-C: Combined route — source verification ─────────────────────────

describe('WLA-008-C: Combined booking rate limit — source verification', () => {
  const combinedSource = readFileSync(
    resolve(process.cwd(), 'app/api/bookings/combined/route.ts'),
    'utf-8'
  )

  it('C01 — bookingRateLimit is imported', () => {
    expect(combinedSource).toMatch(/bookingRateLimit/)
  })

  it('C02 — checkRateLimit is called inside the POST handler', () => {
    expect(combinedSource).toMatch(/checkRateLimit\s*\(/)
  })

  it('C03 — rate limit is applied before any DB query', () => {
    // checkRateLimit must appear before any prisma call.
    const rlPos = combinedSource.indexOf('checkRateLimit')
    const prismaPos = combinedSource.indexOf('prisma.')
    expect(rlPos).toBeGreaterThan(0)
    expect(prismaPos).toBeGreaterThan(rlPos)
  })

  it('C04 — 429 response is returned on rate limit exceeded', () => {
    // The rate limit handler must produce a 429 response.
    expect(combinedSource).toMatch(/429/)
  })

  it('C05 — getRateLimitIdentifier is used to scope limit per user', () => {
    // Must not use a hardcoded global key — rate limit is per user/email.
    expect(combinedSource).toMatch(/getRateLimitIdentifier/)
  })
})

// ─── WLA-008: Regression guard — other routes remain unaffected ───────────────

describe('WLA-008: Regression — secured routes still have correct scoping', () => {
  it('R01 — bookings/[id] PATCH still uses session.user.providerId in WHERE clause', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/bookings/[id]/route.ts'),
      'utf-8'
    )
    // Instructor-scoped query: bookingWhere.providerId = providerId (from session)
    expect(source).toMatch(/bookingWhere\.providerId\s*=\s*providerId/)
  })

  it('R02 — bookings/batch POST still uses providerId from session (not body)', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/bookings/batch/route.ts'),
      'utf-8'
    )
    // providerId must come from session, not from request body
    expect(source).toMatch(/session!\.user!\.providerId/)
    // Must NOT accept providerId from body
    expect(source).not.toMatch(/body\.providerId\s*|data\.providerId/)
  })

  it('R03 — schedule-package-hours providerId is used only for redirect URL, not DB query', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/client/schedule-package-hours/route.ts'),
      'utf-8'
    )
    // The booking lookup uses userId from session, not providerId from body
    expect(source).toMatch(/userId:\s*user\.id/)
    // The redirectUrl construction uses providerId (client-supplied) — acceptable for a URL
    expect(source).toMatch(/redirectUrl.*providerId/)
  })
})
