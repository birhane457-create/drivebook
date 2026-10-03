/**
 * MM-12-HTTP: Concurrent Same-Key Race Returns 409 Not 500
 *
 * FINDING (MM-12-HTTP-500-FOLLOW-UP.md):
 *   During MM-12 production verification, Check 3 (concurrent same-key credit)
 *   showed: Request A → 200, Request B → 500 (expected 409).
 *   The financial invariant (1 tx, correct balance) was proven correct — but
 *   the losing concurrent request received 500 instead of a deterministic 409.
 *
 * ROOT CAUSE:
 *   Prisma serialization errors (P2034, P40001) thrown inside the $transaction
 *   were not caught by the inner IDEMPOTENCY_IN_FLIGHT handler and propagated
 *   to the outer catch (error) → 500.
 *
 * FIX:
 *   Added serialization error detection in the inner catch block of both:
 *     - add-credit/route.ts
 *     - deduct-credit/route.ts
 *   Serialization failures → 409 "Request in progress — retry after a moment"
 *   (same message as IDEMPOTENCY_IN_FLIGHT — same client retry action)
 *
 * ACCEPTANCE CRITERIA (from follow-up doc):
 *   - Concurrent same-key requests return deterministic responses (200 or 409, never 500)
 *   - No change to financial postcondition (1 transaction, correct balance)
 *
 * WHAT IS TESTED:
 *   S1 P2034 from $transaction → 409 on add-credit
 *   S2 P40001 from $transaction → 409 on add-credit
 *   S3 P2034 from $transaction → 409 on deduct-credit
 *   S4 P40001 from $transaction → 409 on deduct-credit
 *   S5 IDEMPOTENCY_IN_FLIGHT → 409 still works (regression check)
 *   S6 IDEMPOTENCY_REPLAY → 200 with stored response still works
 *   S7 Genuine unexpected error → still 500 (not swallowed)
 *   S8 Deadlock error string → 409 on add-credit
 *   S9 "could not serialize" string → 409 on add-credit
 *
 * EVIDENCE FOR: MM-12-HTTP FIX-VERIFIED gate
 */

// ─── Mock function declarations ───────────────────────────────────────────────

const mockGetServerSession   = vi.fn()
const mockCheckPermission    = vi.fn()
const mockPrismaTransaction  = vi.fn()
const mockPrismaCustomerFindUnique = vi.fn()
const mockPrismaUserFindUnique     = vi.fn()
const mockPrismaAuditLogCreate     = vi.fn()
const mockGetOrCreateWallet  = vi.fn()
const mockGetWalletBalance   = vi.fn()
const mockSendAdminCreditReceipt = vi.fn()
const mockSendAdminDeductReceipt = vi.fn()

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('next-auth', () => ({
  getServerSession: (...a: any[]) => mockGetServerSession(...a),
}))

vi.mock('@/lib/rbac/checkPermission', () => ({
  checkPermission: (...a: any[]) => mockCheckPermission(...a),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction:   (...a: any[]) => mockPrismaTransaction(...a),
    customer:       { findUnique: (...a: any[]) => mockPrismaCustomerFindUnique(...a) },
    user:           { findUnique: (...a: any[]) => mockPrismaUserFindUnique(...a) },
    auditLog:       { create:     (...a: any[]) => mockPrismaAuditLogCreate(...a) },
  } as any,
}))

vi.mock('@/lib/services/wallet-helpers', () => ({
  getOrCreateWallet: (...a: any[]) => mockGetOrCreateWallet(...a),
  getWalletBalance:  (...a: any[]) => mockGetWalletBalance(...a),
}))

vi.mock('@/lib/services/receipt-email', () => ({
  sendAdminCreditReceipt: (...a: any[]) => mockSendAdminCreditReceipt(...a),
  sendAdminDeductReceipt: (...a: any[]) => mockSendAdminDeductReceipt(...a),
}))

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

// ─── Handler imports (after mocks) ────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as AddCredit }    from '@/app/api/admin/clients/[id]/wallet/add-credit/route'
import { POST as DeductCredit } from '@/app/api/admin/clients/[id]/wallet/deduct-credit/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAddRequest(body: unknown = { amount: 50, reason: 'test' }): NextRequest {
  return new NextRequest('http://localhost/api/admin/clients/client_001/wallet/add-credit', {
    method:  'POST',
    headers: {
      'Content-Type':   'application/json',
      'Idempotency-Key': 'idem-test-key-001',
    },
    body: JSON.stringify(body),
  })
}

function makeDeductRequest(body: unknown = { amount: 25, reason: 'test deduct' }): NextRequest {
  return new NextRequest('http://localhost/api/admin/clients/client_001/wallet/deduct-credit', {
    method:  'POST',
    headers: {
      'Content-Type':   'application/json',
      'Idempotency-Key': 'idem-test-key-002',
    },
    body: JSON.stringify(body),
  })
}

const ADMIN_SESSION = {
  user: { id: 'admin_001', email: 'admin@example.com', role: 'SUPER_ADMIN' },
  expires: new Date(Date.now() + 3600_000).toISOString(),
}

const ALLOWED_CHECK = {
  allowed:     true,
  isSuperAdmin: true,
  response:    null,
  staffMember: null,
}

function setupCommonMocks() {
  mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
  mockCheckPermission.mockResolvedValue(ALLOWED_CHECK)
  mockPrismaCustomerFindUnique.mockResolvedValue({ userId: 'user_001' })
  mockPrismaUserFindUnique.mockResolvedValue({ id: 'user_001', email: 'client@example.com', name: 'Test Client' })
  mockGetOrCreateWallet.mockResolvedValue({ id: 'wallet_001' })
  mockGetWalletBalance.mockResolvedValue({ balance: 100 })
  mockPrismaAuditLogCreate.mockResolvedValue({})
  mockSendAdminCreditReceipt.mockResolvedValue(undefined)
  mockSendAdminDeductReceipt.mockResolvedValue(undefined)
}

/** Build a Prisma-style error with a code property */
function prismaError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code })
}

/** Build an error that contains a Postgres error string in the message */
function pgStringError(message: string): Error {
  return new Error(message)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MM-12-HTTP: Serialization errors return 409 not 500', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    setupCommonMocks()
  })

  // ── S1–S2: add-credit serialization errors ─────────────────────────────────

  describe('add-credit route', () => {

    it('S1: Prisma P2034 from $transaction → 409, not 500', async () => {
      mockPrismaTransaction.mockRejectedValue(prismaError('P2034', 'Transaction failed due to a write conflict or a deadlock'))

      const res  = await AddCredit(makeAddRequest(), { params: { id: 'client_001' } })
      const body = await res.json()

      expect(res.status).toBe(409)
      expect(body.error).toContain('retry')
    })

    it('S2: PostgreSQL P40001 error message in exception → 409', async () => {
      // Some Prisma versions surface the raw PG error code in the message
      mockPrismaTransaction.mockRejectedValue(
        pgStringError('P40001: could not serialize access due to concurrent update')
      )

      const res  = await AddCredit(makeAddRequest(), { params: { id: 'client_001' } })
      const body = await res.json()

      expect(res.status).toBe(409)
      expect(body.error).toContain('retry')
    })

    it('S8: "deadlock detected" string → 409', async () => {
      mockPrismaTransaction.mockRejectedValue(
        pgStringError('deadlock detected while waiting for resource')
      )

      const res = await AddCredit(makeAddRequest(), { params: { id: 'client_001' } })
      expect(res.status).toBe(409)
    })

    it('S9: "could not serialize" string → 409', async () => {
      mockPrismaTransaction.mockRejectedValue(
        pgStringError('ERROR: could not serialize access due to read/write dependencies')
      )

      const res = await AddCredit(makeAddRequest(), { params: { id: 'client_001' } })
      expect(res.status).toBe(409)
    })

    it('S5: IDEMPOTENCY_IN_FLIGHT → 409 (regression: existing behavior preserved)', async () => {
      mockPrismaTransaction.mockRejectedValue(new Error('IDEMPOTENCY_IN_FLIGHT'))

      const res  = await AddCredit(makeAddRequest(), { params: { id: 'client_001' } })
      const body = await res.json()

      expect(res.status).toBe(409)
      expect(body.error).toBeTruthy()
    })

    it('S6: IDEMPOTENCY_REPLAY → 200 with stored response (regression: existing behavior preserved)', async () => {
      const storedResponse = {
        success: true,
        transactionId: 'tx_replay_001',
        newBalance: 150,
        previousBalance: 100,
        wallet: { id: 'wallet_001', balance: 150 },
        message: "Added 50 to client@example.com's wallet",
      }
      mockPrismaTransaction.mockRejectedValue(
        Object.assign(new Error('IDEMPOTENCY_REPLAY'), { replay: storedResponse })
      )

      const res  = await AddCredit(makeAddRequest(), { params: { id: 'client_001' } })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.transactionId).toBe('tx_replay_001')
      expect(body.newBalance).toBe(150)
    })

    it('S7a: genuine unexpected error on add-credit → 500 (not swallowed)', async () => {
      mockPrismaTransaction.mockRejectedValue(new Error('Unexpected database connection lost'))

      const res = await AddCredit(makeAddRequest(), { params: { id: 'client_001' } })
      expect(res.status).toBe(500)
    })
  })

  // ── S3–S4: deduct-credit serialization errors ──────────────────────────────

  describe('deduct-credit route', () => {

    it('S3: Prisma P2034 from $transaction → 409 on deduct-credit', async () => {
      mockPrismaTransaction.mockRejectedValue(prismaError('P2034', 'Transaction failed due to a write conflict'))

      const res  = await DeductCredit(makeDeductRequest(), { params: { id: 'client_001' } })
      const body = await res.json()

      expect(res.status).toBe(409)
      expect(body.error).toContain('retry')
    })

    it('S4: PostgreSQL P40001 message on deduct-credit → 409', async () => {
      mockPrismaTransaction.mockRejectedValue(
        pgStringError('P40001: could not serialize access due to concurrent update')
      )

      const res  = await DeductCredit(makeDeductRequest(), { params: { id: 'client_001' } })
      const body = await res.json()

      expect(res.status).toBe(409)
      expect(body.error).toContain('retry')
    })

    it('S7b: genuine unexpected error on deduct-credit → 500 (not swallowed)', async () => {
      mockPrismaTransaction.mockRejectedValue(new Error('Unexpected database failure'))

      const res = await DeductCredit(makeDeductRequest(), { params: { id: 'client_001' } })
      expect(res.status).toBe(500)
    })
  })
})
