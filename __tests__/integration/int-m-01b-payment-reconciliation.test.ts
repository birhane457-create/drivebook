/**
 * INT-M-01B: Stripe Payment Reconciliation (Missed Webhooks)
 *
 * FINDING (PHASE1_REMEDIATION_REGISTER.md):
 *   If payment succeeds in Stripe but the webhook fails or is delayed, the booking
 *   remains PENDING_PAYMENT indefinitely. The reconciliation cron's Check 1 is the
 *   recovery mechanism — but it had no targeted tests.
 *
 * VERIFICATION CRITERION (from register):
 *   "Test: Block webhook delivery, verify reconciliation detects discrepancy."
 *
 * WHAT IS TESTED (Check 1 of reconcile-stripe cron):
 *   R1 Auto-confirm: PI succeeded, booking PENDING_PAYMENT < 24h, price matches → CONFIRMED
 *   R2 Idempotency: LedgerEntry(PAYMENT_COLLECTED) already present → no-op
 *   R3 Flag-only: booking > 24h old → flaggedMissingPayments, NOT auto-confirmed
 *   R4 Skip conditions: non-AUD PI, no bookingId metadata, non-succeeded status, missing booking
 *   R5 Auto-confirm failure → graceful fallback to flag (no crash)
 *   R6 Auth guard: wrong/missing CRON_SECRET → 401
 *   R7 Concurrency lock: RUNNING report → skipped without calling Stripe
 *
 * WHAT IS MOCKED:
 *   stripe.paymentIntents.list() — cannot call real Stripe in tests
 *   prisma — fully mocked (same approach as pay-h01-refund-reconciliation.test.ts)
 *   appendLedgerEntry, incrementLedger, sendAlert, pingCronHealth — side effects
 *
 * WHAT IS REAL:
 *   The GET handler from app/api/cron/reconcile-stripe/route.ts (no modification)
 *   All Check 1 business logic: auto-confirm conditions, flag conditions, currency guard
 *
 * EVIDENCE FOR: INT-M-01B TEST-VERIFIED gate
 */

// ─── Mock function declarations (must precede vi.mock() factories) ────────────

const mockPaymentIntentsList = vi.fn()
const mockBookingFindUnique  = vi.fn()
const mockBookingUpdate      = vi.fn()
const mockBookingFindMany    = vi.fn().mockResolvedValue([])
const mockLedgerEntryFindFirst = vi.fn()
const mockLedgerEntryFindMany  = vi.fn().mockResolvedValue([])
const mockAuditLogCreate     = vi.fn().mockResolvedValue({})
const mockReportCreate       = vi.fn()
const mockReportUpdate       = vi.fn()
const mockReportFindFirst    = vi.fn().mockResolvedValue(null)
const mockPayoutFindMany     = vi.fn().mockResolvedValue([])
const mockFinancialLedgerFindUnique = vi.fn().mockResolvedValue({ id: 'existing' })
const mockAppendLedgerEntry  = vi.fn().mockResolvedValue(undefined)
const mockIncrementLedger    = vi.fn().mockResolvedValue(undefined)
const mockSendAlert          = vi.fn().mockResolvedValue(undefined)

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      paymentIntents: { list: (...a: any[]) => mockPaymentIntentsList(...a) },
      refunds:        { list: vi.fn().mockResolvedValue({ data: [], has_more: false }) },
      transfers:      { retrieve: vi.fn().mockResolvedValue({}) },
    })),
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: {
    booking:      {
      findUnique: (...a: any[]) => mockBookingFindUnique(...a),
      update:     (...a: any[]) => mockBookingUpdate(...a),
      findMany:   (...a: any[]) => mockBookingFindMany(...a),
    },
    ledgerEntry:  {
      findFirst: (...a: any[]) => mockLedgerEntryFindFirst(...a),
      findMany:  (...a: any[]) => mockLedgerEntryFindMany(...a),
    },
    auditLog:     { create: (...a: any[]) => mockAuditLogCreate(...a) },
    payout:       { findMany: (...a: any[]) => mockPayoutFindMany(...a) },
    reconciliationReport: {
      create:    (...a: any[]) => mockReportCreate(...a),
      update:    (...a: any[]) => mockReportUpdate(...a),
      findFirst: (...a: any[]) => mockReportFindFirst(...a),
    },
    financialLedger: {
      findUnique: (...a: any[]) => mockFinancialLedgerFindUnique(...a),
    },
  } as any,
}))

vi.mock('@/lib/services/ledger-service', () => ({
  appendLedgerEntry: (...a: any[]) => mockAppendLedgerEntry(...a),
  incrementLedger:   (...a: any[]) => mockIncrementLedger(...a),
}))

vi.mock('@/lib/services/ledger-operations', () => ({
  recordBookingPayment: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/services/alert-service', () => ({
  sendAlert: (...a: any[]) => mockSendAlert(...a),
}))

vi.mock('@/lib/services/cron-health', () => ({
  pingCronHealth: vi.fn().mockResolvedValue(undefined),
  failCronHealth: vi.fn().mockResolvedValue(undefined),
}))

// ─── Handler import (after mocks) ─────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/cron/reconcile-stripe/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CRON_SECRET = 'test-cron-secret-int-m-01b'
const REPORT_ID   = 'report_test_001'

function makeCronRequest(): NextRequest {
  return new NextRequest('http://localhost/api/cron/reconcile-stripe', {
    method:  'GET',
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  })
}

function makeStripePI(overrides: Partial<{
  id: string; status: string; currency: string;
  amount: number; created: number; metadata: Record<string, string>;
}> = {}) {
  return {
    id:       overrides.id       ?? 'pi_test_001',
    status:   overrides.status   ?? 'succeeded',
    currency: overrides.currency ?? 'aud',
    amount:   overrides.amount   ?? 10000,          // $100.00 AUD in cents
    created:  overrides.created  ?? Math.floor(Date.now() / 1000),
    metadata: overrides.metadata ?? { bookingId: 'booking_test_001' },
  }
}

function makeBooking(overrides: Partial<{
  id: string; status: string; createdAt: Date; price: number; providerPayout: number;
}> = {}) {
  return {
    id:             overrides.id             ?? 'booking_test_001',
    status:         overrides.status         ?? 'PENDING_PAYMENT',
    createdAt:      overrides.createdAt      ?? new Date(),      // default: just now (< 24h)
    price:          overrides.price          ?? 100.00,
    providerPayout: overrides.providerPayout ?? 85.00,
  }
}

function setupDefaults() {
  process.env.CRON_SECRET       = CRON_SECRET
  process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder'
  mockReportCreate.mockResolvedValue({ id: REPORT_ID })
  mockReportUpdate.mockResolvedValue({ id: REPORT_ID })
  mockReportFindFirst.mockResolvedValue(null)   // no RUNNING report → no lock
  mockPayoutFindMany.mockResolvedValue([])
  mockFinancialLedgerFindUnique.mockResolvedValue({ id: 'existing' })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('INT-M-01B: Stripe Payment Reconciliation (missed webhooks)', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaults()
  })

  // ── R1: Auto-confirm (core INT-M-01B scenario) ─────────────────────────────

  describe('R1: Missed webhook → auto-confirm (booking < 24h, PENDING_PAYMENT)', () => {

    it('R1a: auto-confirms booking to CONFIRMED when PI succeeded but no LedgerEntry', async () => {
      const booking = makeBooking()
      const pi      = makeStripePI({ amount: 10000 }) // $100.00

      mockPaymentIntentsList.mockResolvedValue({ data: [pi], has_more: false })
      mockLedgerEntryFindFirst.mockResolvedValue(null)        // no LedgerEntry = missed webhook
      mockBookingFindUnique.mockResolvedValue(booking)
      mockBookingUpdate.mockResolvedValue({ ...booking, status: 'CONFIRMED', isPaid: true })

      const res  = await GET(makeCronRequest())
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)

      // booking.update called with CONFIRMED + isPaid + paymentIntentId
      expect(mockBookingUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'booking_test_001' },
          data:  expect.objectContaining({
            status:          'CONFIRMED',
            isPaid:          true,
            paymentIntentId: 'pi_test_001',
          }),
        })
      )

      // LedgerEntry written for the missing payment
      expect(mockAppendLedgerEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          type:        'PAYMENT_COLLECTED',
          amount:      100,
          referenceId: 'booking_test_001',
        })
      )

      // AuditLog written with BOOKING_AUTO_RECONCILED
      expect(mockAuditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action:     'BOOKING_AUTO_RECONCILED',
            actorRole:  'SYSTEM',
            targetType: 'BOOKING',
            targetId:   'booking_test_001',
          }),
        })
      )

      expect(body.autoConfirmed).toBe(1)
      expect(body.missingPayments).toBe(0)
    })

    it('R1b: AuditLog and LedgerEntry metadata reference reconReportId', async () => {
      const booking = makeBooking()
      const pi      = makeStripePI({ amount: 10000 })

      mockPaymentIntentsList.mockResolvedValue({ data: [pi], has_more: false })
      mockLedgerEntryFindFirst.mockResolvedValue(null)
      mockBookingFindUnique.mockResolvedValue(booking)
      mockBookingUpdate.mockResolvedValue({ ...booking, status: 'CONFIRMED' })

      await GET(makeCronRequest())

      expect(mockAppendLedgerEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            autoReconciled:        true,
            stripePaymentIntentId: 'pi_test_001',
            reconReportId:         REPORT_ID,
          }),
        })
      )
    })

    it('R1c: price mismatch > 2 cents → not auto-confirmed, flagged', async () => {
      const booking = makeBooking({ price: 100.00 })
      const pi      = makeStripePI({ amount: 15000 }) // $150.00 — mismatch

      mockPaymentIntentsList.mockResolvedValue({ data: [pi], has_more: false })
      mockLedgerEntryFindFirst.mockResolvedValue(null)
      mockBookingFindUnique.mockResolvedValue(booking)

      const res  = await GET(makeCronRequest())
      const body = await res.json()

      expect(mockBookingUpdate).not.toHaveBeenCalled()
      expect(mockAppendLedgerEntry).not.toHaveBeenCalled()
      expect(body.missingPayments).toBe(1)
      expect(body.autoConfirmed).toBe(0)
    })

    it('R1d: booking status is CANCELLED (not PENDING_PAYMENT) → flagged, not auto-confirmed', async () => {
      const booking = makeBooking({ status: 'CANCELLED' })
      const pi      = makeStripePI()

      mockPaymentIntentsList.mockResolvedValue({ data: [pi], has_more: false })
      mockLedgerEntryFindFirst.mockResolvedValue(null)
      mockBookingFindUnique.mockResolvedValue(booking)

      const res  = await GET(makeCronRequest())
      const body = await res.json()

      expect(mockBookingUpdate).not.toHaveBeenCalled()
      expect(body.missingPayments).toBe(1)
      expect(body.autoConfirmed).toBe(0)
    })
  })

  // ── R2: Idempotency ────────────────────────────────────────────────────────

  describe('R2: Already-paid booking is a no-op (idempotency)', () => {

    it('R2a: LedgerEntry(PAYMENT_COLLECTED) exists → booking.update NOT called', async () => {
      const pi = makeStripePI()

      mockPaymentIntentsList.mockResolvedValue({ data: [pi], has_more: false })
      // LedgerEntry present → webhook was processed normally; no missed payment
      mockLedgerEntryFindFirst.mockResolvedValue({
        id: 'ledger_001', type: 'PAYMENT_COLLECTED', referenceId: 'booking_test_001', amount: 100,
      })

      const res  = await GET(makeCronRequest())
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(mockBookingUpdate).not.toHaveBeenCalled()
      expect(mockAppendLedgerEntry).not.toHaveBeenCalled()
      expect(body.autoConfirmed).toBe(0)
      expect(body.missingPayments).toBe(0)
      expect(body.paymentsChecked).toBe(1)
    })

    it('R2b: second cron run with same PI and existing LedgerEntry → still a no-op', async () => {
      const pi = makeStripePI()
      mockPaymentIntentsList.mockResolvedValue({ data: [pi], has_more: false })
      mockLedgerEntryFindFirst.mockResolvedValue({
        id: 'ledger_001', type: 'PAYMENT_COLLECTED', referenceId: 'booking_test_001',
      })

      // First run
      await GET(makeCronRequest())
      const calls1 = mockBookingUpdate.mock.calls.length

      // Reset lock for second run
      mockReportFindFirst.mockResolvedValue(null)

      // Second run
      await GET(makeCronRequest())
      const calls2 = mockBookingUpdate.mock.calls.length

      expect(calls1).toBe(0)
      expect(calls2).toBe(0)
    })
  })

  // ── R3: Flag-only for older bookings ───────────────────────────────────────

  describe('R3: Booking > 24h old → flagged, NOT auto-confirmed', () => {

    it('R3a: PENDING_PAYMENT booking 25h old → pushed to flaggedMissingPayments only', async () => {
      const createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000)
      const booking   = makeBooking({ createdAt })
      const pi        = makeStripePI()

      mockPaymentIntentsList.mockResolvedValue({ data: [pi], has_more: false })
      mockLedgerEntryFindFirst.mockResolvedValue(null)
      mockBookingFindUnique.mockResolvedValue(booking)

      const res  = await GET(makeCronRequest())
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(mockBookingUpdate).not.toHaveBeenCalled()
      expect(mockAppendLedgerEntry).not.toHaveBeenCalled()
      expect(body.missingPayments).toBe(1)
      expect(body.autoConfirmed).toBe(0)
    })

    it('R3b: flagged PI present in ReconciliationReport metadata', async () => {
      const createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000)
      const booking   = makeBooking({ createdAt, id: 'booking_old_001' })
      const pi        = makeStripePI({ id: 'pi_old_001', metadata: { bookingId: 'booking_old_001' } })

      mockPaymentIntentsList.mockResolvedValue({ data: [pi], has_more: false })
      mockLedgerEntryFindFirst.mockResolvedValue(null)
      mockBookingFindUnique.mockResolvedValue(booking)

      await GET(makeCronRequest())

      const updateCall = mockReportUpdate.mock.calls[0]?.[0]
      const flagged: any[] = updateCall?.data?.metadata?.flaggedMissingPayments ?? []
      const match = flagged.find((f: any) => f.stripePaymentIntentId === 'pi_old_001')
      expect(match).toBeTruthy()
      expect(match.amount).toBe(100)
    })
  })

  // ── R4: Skip conditions ────────────────────────────────────────────────────

  describe('R4: PIs that must be skipped without triggering auto-confirm', () => {

    it('R4a: non-AUD PI (USD) → skipped; paymentsChecked not incremented', async () => {
      const usdPi = makeStripePI({ currency: 'usd' })
      mockPaymentIntentsList.mockResolvedValue({ data: [usdPi], has_more: false })

      const res  = await GET(makeCronRequest())
      const body = await res.json()

      expect(mockBookingFindUnique).not.toHaveBeenCalled()
      expect(body.paymentsChecked).toBe(0)
    })

    it('R4b: PI with no bookingId in metadata (wallet top-up) → skipped silently', async () => {
      const walletPi = makeStripePI({ metadata: { type: 'wallet_topup' } })
      mockPaymentIntentsList.mockResolvedValue({ data: [walletPi], has_more: false })

      const res  = await GET(makeCronRequest())
      const body = await res.json()

      expect(mockBookingFindUnique).not.toHaveBeenCalled()
      expect(body.missingPayments).toBe(0)
      expect(body.autoConfirmed).toBe(0)
    })

    it('R4c: PI with status !== succeeded → skipped (not checked against LedgerEntry)', async () => {
      const pendingPi = makeStripePI({ status: 'requires_payment_method' })
      mockPaymentIntentsList.mockResolvedValue({ data: [pendingPi], has_more: false })

      const res  = await GET(makeCronRequest())
      const body = await res.json()

      expect(mockLedgerEntryFindFirst).not.toHaveBeenCalled()
      expect(body.paymentsChecked).toBe(0)
    })

    it('R4d: booking not found in DB → flagged (not silently swallowed)', async () => {
      const pi = makeStripePI({ metadata: { bookingId: 'booking_orphan_001' } })

      mockPaymentIntentsList.mockResolvedValue({ data: [pi], has_more: false })
      mockLedgerEntryFindFirst.mockResolvedValue(null)
      mockBookingFindUnique.mockResolvedValue(null)   // booking absent from DB

      const res  = await GET(makeCronRequest())
      const body = await res.json()

      expect(mockBookingUpdate).not.toHaveBeenCalled()
      expect(body.missingPayments).toBe(1)
    })
  })

  // ── R5: Auto-confirm failure → graceful fallback ───────────────────────────

  describe('R5: Auto-confirm DB failure → graceful fallback to flag', () => {

    it('R5a: booking.update throws → PI flagged, cron returns 200 (no crash)', async () => {
      const booking = makeBooking()
      const pi      = makeStripePI()

      mockPaymentIntentsList.mockResolvedValue({ data: [pi], has_more: false })
      mockLedgerEntryFindFirst.mockResolvedValue(null)
      mockBookingFindUnique.mockResolvedValue(booking)
      mockBookingUpdate.mockRejectedValue(new Error('DB write failed during auto-confirm'))

      const res  = await GET(makeCronRequest())
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.missingPayments).toBe(1)
      expect(body.autoConfirmed).toBe(0)
    })
  })

  // ── R6: Auth guard ─────────────────────────────────────────────────────────

  describe('R6: Authorization', () => {

    it('R6a: wrong CRON_SECRET → 401, Stripe not called', async () => {
      const req = new NextRequest('http://localhost/api/cron/reconcile-stripe', {
        method:  'GET',
        headers: { authorization: 'Bearer wrong-secret' },
      })

      const res = await GET(req)
      expect(res.status).toBe(401)
      expect(mockPaymentIntentsList).not.toHaveBeenCalled()
    })

    it('R6b: no authorization header → 401', async () => {
      const req = new NextRequest('http://localhost/api/cron/reconcile-stripe', {
        method: 'GET',
      })

      const res = await GET(req)
      expect(res.status).toBe(401)
    })
  })

  // ── R7: Concurrency lock ───────────────────────────────────────────────────

  describe('R7: Concurrency lock', () => {

    it('R7a: existing RUNNING report → skipped=true, Stripe not called', async () => {
      mockReportFindFirst.mockResolvedValue({ id: 'report_running', status: 'RUNNING' })

      const res  = await GET(makeCronRequest())
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.skipped).toBe(true)
      expect(mockPaymentIntentsList).not.toHaveBeenCalled()
    })
  })
})
