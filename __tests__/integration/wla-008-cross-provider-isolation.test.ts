/**
 * WLA-008 Cross-Provider Tenant Isolation Tests
 *
 * Covers sub-findings discovered during the WLA-008 route inventory:
 *
 *   WLA-008-A: /api/instructor/invoices/[transactionId]
 *              /api/instructor/invoices/[transactionId]/data   ← reviewer addition
 *     - Was: findUnique(id) then post-fetch providerId check → IDOR pattern
 *     - Fix: findFirst({ where: { id, providerId } }) → DB-scoped ownership;
 *            404 for both "not found" and "belongs to another provider"
 *
 *   WLA-008-B: /api/bookings/mobile POST
 *     - Was: accepted any customerId from body (no ownership check)
 *     - Was v1: balance check outside $transaction → race condition (double-spend)
 *     - Was v1: wallet could vanish between outer check and inner debit
 *     - Fix v2: balance check, booking create, and wallet debit all inside
 *               $transaction (atomic, concurrent-safe)
 *
 *   WLA-008-C: /api/bookings/combined POST
 *     - Was: no rate limiting → calendar slot-squatting with zero-cost PENDING bookings
 *     - Fix: bookingRateLimit applied before request processing
 *     - Limitation: checkRateLimit is fail-open (documented; not further mitigated here)
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

// ─── WLA-008-A (data): Invoice data endpoint IDOR fix ────────────────────────

describe('WLA-008-A (data): Invoice /data endpoint — source verification', () => {
  const dataSource = readFileSync(
    resolve(process.cwd(), 'app/api/instructor/invoices/[transactionId]/data/route.ts'),
    'utf-8'
  )

  it('D01 — /data route uses findFirst (not findUnique)', () => {
    expect(dataSource).toMatch(/findFirst/)
    expect(dataSource).not.toMatch(/findUnique/)
  })

  it('D02 — providerId is in the WHERE clause of the /data DB query', () => {
    expect(dataSource).toMatch(/where:\s*\{[^}]*id:\s*params\.transactionId[^}]*providerId/)
  })

  it('D03 — post-fetch ownership check removed from /data route', () => {
    // The old 403 branch must be gone — only the DB-scoped 404 remains
    expect(dataSource).not.toMatch(/transaction\.providerId\s*!==/)
    expect(dataSource).not.toMatch(/status:\s*403/)
  })

  it('D04 — null result returns 404, not 403, in /data route', () => {
    const nullBlock = dataSource.slice(
      dataSource.indexOf('if (!transaction)'),
      dataSource.indexOf('if (!transaction)') + 150
    )
    expect(nullBlock).toMatch(/404/)
    expect(nullBlock).not.toMatch(/403/)
  })
})

describe('WLA-008-B: Mobile POST — source verification', () => {
  const mobileSource = readFileSync(
    resolve(process.cwd(), 'app/api/bookings/mobile/route.ts'),
    'utf-8'
  )

  it('B01 — customer ownership check is present (bookings.some + providerId)', () => {
    expect(mobileSource).toMatch(/bookings.*some.*providerId.*decoded\.providerId/)
  })

  it('B02 — CONFIRMED status is conditional on wallet balance, not hardcoded', () => {
    expect(mobileSource).toMatch(/bookingStatus.*CONFIRMED.*PENDING_PAYMENT|PENDING_PAYMENT.*bookingStatus.*CONFIRMED/)
    expect(mobileSource).toMatch(/status:\s*bookingStatus/)
    const createDataSection = mobileSource.slice(
      mobileSource.indexOf('status: bookingStatus'),
      mobileSource.indexOf('status: bookingStatus') + 50
    )
    expect(createDataSection).not.toMatch(/status:\s*'CONFIRMED'/)
  })

  it('B03 — wallet debit is created when booking is CONFIRMED', () => {
    expect(mobileSource).toMatch(/type:\s*'DEBIT'/)
  })

  it('B04 — isPaid reflects computed bookingStatus, not hardcoded', () => {
    expect(mobileSource).toMatch(/isPaid:\s*bookingStatus\s*===\s*'CONFIRMED'/)
  })

  it('B05 — customer ownership check fires before booking creation', () => {
    const ownershipPos = mobileSource.indexOf('bookings: { some: { providerId: decoded.providerId }')
    const txnPos = mobileSource.indexOf('prisma.$transaction')
    expect(ownershipPos).toBeGreaterThan(0)
    expect(txnPos).toBeGreaterThan(ownershipPos)
  })

  it('B06 — wallet balance is re-read INSIDE $transaction (concurrent-safe)', () => {
    // Reviewer finding: balance check outside $transaction allowed two concurrent
    // requests to both read a sufficient balance before either debit committed.
    // Fix v2: wallet read uses tx.clientWallet (inside the transaction callback).
    const txStart = mobileSource.indexOf('prisma.$transaction(async (tx) =>')
    const walletReadInTx = mobileSource.indexOf('tx.clientWallet.findUnique', txStart)
    expect(txStart).toBeGreaterThan(0)
    // tx.clientWallet.findUnique must appear inside the $transaction body
    expect(walletReadInTx).toBeGreaterThan(txStart)
  })

  it('B07 — no outer (pre-transaction) wallet balance check remains', () => {
    // After fix v2, the only clientWallet read is inside the $transaction.
    // Confirm no prisma.clientWallet.findUnique call appears before the $transaction.
    const txStart = mobileSource.indexOf('prisma.$transaction(async (tx) =>')
    const outerWalletRead = mobileSource.lastIndexOf('prisma.clientWallet.findUnique', txStart)
    expect(outerWalletRead).toBe(-1)
  })

  it('B08 — walletIdForDebit is assigned inside the transaction, not carried in from outside', () => {
    // The debit gate variable must be assigned inside the tx callback so it is
    // consistent with the in-tx balance check result.
    const txStart = mobileSource.indexOf('prisma.$transaction(async (tx) =>')
    const debitVarAssign = mobileSource.indexOf('walletIdForDebit = wallet.id', txStart)
    expect(debitVarAssign).toBeGreaterThan(txStart)
  })

  it('B09 — withSerializableRetry wraps the $transaction call', () => {
    // After retry utility was added, P2034 serialization failures are retried
    // with exponential backoff before surfacing. The import and call must be present.
    expect(mobileSource).toMatch(/withSerializableRetry/)
    expect(mobileSource).toMatch(/operationName.*mobile-booking/)
  })

  it('B10 — P2034 exhausted returns 409 (not 500)', () => {
    // After all retries are exhausted a P2034 should surface as 409 to the client
    // (retryable conflict), not 500 (unexpected error). Matches SLOT_CONFLICT pattern.
    expect(mobileSource).toMatch(/P2034/)
    // The P2034 catch must return 409 — find both in the catch block
    const catchStart = mobileSource.indexOf('if (error?.code')
    const after = mobileSource.slice(catchStart, catchStart + 200)
    expect(after).toMatch(/P2034/)
    expect(after).toMatch(/409/)
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

// ─── WLA-008-TENANT: submitQuote service defence-in-depth ────────────────────

describe('WLA-008-TENANT: submitQuote service boundary', () => {
  const routeSource = readFileSync(
    resolve(process.cwd(), 'app/api/instructor/quotes/[bookingId]/submit/route.ts'),
    'utf-8'
  )
  const serviceSource = readFileSync(
    resolve(process.cwd(), 'lib/services/booking-service.ts'),
    'utf-8'
  )

  it('SQ01 — route passes providerId into submitQuote input (defence-in-depth)', () => {
    // The route's own scoped lookup already checks ownership, but it must also
    // pass providerId into the service so the service enforces ownership itself.
    expect(routeSource).toMatch(/providerId:\s*session!\.user!\.providerId/)
  })

  it('SQ02 — QuoteInput.providerId is mandatory (no optional marker)', () => {
    // The field must be required, not optional, so no caller can bypass ownership.
    // Check that the interface declares providerId without the ? optional marker.
    const ifaceStart = serviceSource.indexOf('export interface QuoteInput {')
    const ifaceEnd   = serviceSource.indexOf('}', ifaceStart)
    const ifaceBody  = serviceSource.slice(ifaceStart, ifaceEnd)
    // Must have providerId as a required field
    expect(ifaceBody).toMatch(/providerId:\s*string/)
    // Must NOT be optional
    expect(ifaceBody).not.toMatch(/providerId\?:/)
  })

  it('SQ03 — submitQuote service uses findFirst (not findUnique) for booking lookup', () => {
    // findFirst supports compound WHERE; findUnique only accepts unique keys.
    // Search specifically in the submitQuote function body.
    const fnStart = serviceSource.indexOf('export async function submitQuote(')
    const fnEnd   = serviceSource.indexOf('export async function', fnStart + 10)
    const fnBody  = serviceSource.slice(fnStart, fnEnd > fnStart ? fnEnd : fnStart + 3000)
    expect(fnBody).toMatch(/findFirst/)
    expect(fnBody).not.toMatch(/findUnique/)
  })

  it('SQ04 — service enforces providerId unconditionally (no conditional guard)', () => {
    const fnStart = serviceSource.indexOf('export async function submitQuote(')
    const fnEnd   = serviceSource.indexOf('export async function', fnStart + 10)
    const fnBody  = serviceSource.slice(fnStart, fnEnd > fnStart ? fnEnd : fnStart + 3000)
    // The lookup must always include providerId — no `if (callerProviderId)` bypass
    expect(fnBody).toMatch(/where:\s*\{\s*id:\s*bookingId,\s*providerId:\s*callerProviderId/)
    // The optional-guard pattern must be gone
    expect(fnBody).not.toMatch(/if\s*\(\s*callerProviderId\s*\)/)
  })

  it('SQ05 — booking.update is scoped by booking.providerId inside the transaction', () => {
    // The update must include providerId to prevent mutation of a different provider's booking.
    const fnStart = serviceSource.indexOf('export async function submitQuote(')
    const fnEnd   = serviceSource.indexOf('export async function', fnStart + 10)
    const fnBody  = serviceSource.slice(fnStart, fnEnd > fnStart ? fnEnd : fnStart + 3000)
    expect(fnBody).toMatch(/where:\s*\{\s*id:\s*bookingId,\s*providerId:\s*booking\.providerId/)
  })
})

// ─── WLA-008-TENANT: 13-route ownership review ───────────────────────────────

describe('WLA-008-TENANT: 13-route ownership review results', () => {
  it('T01 — /api/instructor/quotes/[bookingId]/submit uses findFirst with providerId (not post-fetch check)', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/instructor/quotes/[bookingId]/submit/route.ts'),
      'utf-8'
    )
    // Must use findFirst (not findUnique) with providerId in WHERE
    expect(source).toMatch(/findFirst/)
    // The actual DB lookup must not be findUnique — findUnique doesn't accept
    // compound WHERE with providerId. Check only the lookup call, not comments.
    expect(source).not.toMatch(/prisma\.\w+\.findUnique/)
    // providerId must be in the WHERE clause
    expect(source).toMatch(/where:\s*\{[^}]*id:\s*bookingId[^}]*providerId/)
    // Post-fetch ownership check must be removed
    expect(source).not.toMatch(/booking\.providerId\s*!==/)
    // 403 branch must be removed (404 for both cases)
    expect(source).not.toMatch(/status:\s*403/)
  })

  it('T02 — /api/instructor/clients/[id] is pre-scoped by bookings.some + providerId', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/instructor/clients/[id]/route.ts'),
      'utf-8'
    )
    expect(source).toMatch(/bookings.*some.*providerId.*session/)
  })

  it('T03 — /api/client/quotes/request accepts providerId from body (by design, marketplace flow)', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/client/quotes/request/route.ts'),
      'utf-8'
    )
    // Client picks the provider — providerId from body is intentional
    expect(source).toMatch(/providerId:\s*data\.providerId/)
    // Must use session.user.id for customer identity
    expect(source).toMatch(/customerId:\s*session/)
  })

  it('T04 — /api/client/bookings/[id] scopes by clientIds from session user', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/client/bookings/[id]/route.ts'),
      'utf-8'
    )
    expect(source).toMatch(/customerId:\s*\{\s*in:\s*clientIds/)
  })

  it('T05 — /api/client/bookings/create-bulk recalculates price from instructor.hourlyRate (no client price trust)', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/client/bookings/create-bulk/route.ts'),
      'utf-8'
    )
    // Server recalculates price from the instructor's current rate
    expect(source).toMatch(/instructor\.hourlyRate\s*\*\s*item\.duration/)
  })

  it('T06 — /api/business/branding scopes by biz_${session.user.providerId}', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/business/branding/route.ts'),
      'utf-8'
    )
    expect(source).toMatch(/biz_\$\{session/)
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
    // WLA-008-BATCH: customer query must be scoped to this provider's clients
    // (added after reviewer found the unscoped findMany vulnerability)
    expect(source).toMatch(/bookings.*some.*providerId/)
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
