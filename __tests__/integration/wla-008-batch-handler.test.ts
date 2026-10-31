/**
 * WLA-008-BATCH: Batch booking route-level Provider A/B test
 *
 * Invokes the actual POST /api/bookings/batch handler as Provider A
 * submitting Provider B's customer ID. The scoped customer query returns
 * zero customers (the fix), so processBooking() receives an empty clientMap
 * and the customer is reported as a per-booking failure.
 *
 * This is distinct from BATCH-01/02 (which test the DB query directly)
 * and BATCH-03 (which reads source). This test exercises the full request
 * path through the handler.
 *
 * ROUTE-01 — Provider A submits batch booking for Provider B's customer
 *   → handler returns HTTP 200 (partial result format)
 *   → the booking is in the `failed` array, not `successful`
 *   → no booking is created (booking.create is never called)
 *   → no wallet debit occurs (walletTransaction.create is never called)
 */

import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

const PROVIDER_A_ID = 'batch-prov-a'
const PROVIDER_A_USER_ID = 'batch-user-a'
const CUSTOMER_B_ID = 'batch-cust-b'   // belongs to Provider B

// ── Session: Provider A ───────────────────────────────────────────────────────
vi.mock('next-auth', () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: {
      id:         'batch-user-a',
      providerId: 'batch-prov-a',
      email:      'prov-a@test.com',
      role:       'PROVIDER',
    },
  }),
}))

// ── next/headers stub ─────────────────────────────────────────────────────────
vi.mock('next/headers', () => ({
  headers:  vi.fn(() => new Map()),
  cookies:  vi.fn(() => ({ get: vi.fn(), set: vi.fn() })),
}))

// ── Subscription / rate-limit stubs ──────────────────────────────────────────
vi.mock('@/lib/middleware/subscriptionValidation', () => ({
  checkSubscriptionAccess: vi.fn().mockResolvedValue({ valid: true }),
}))
vi.mock('@/lib/ratelimit', () => ({
  bulkBookingRateLimit:    {},
  checkRateLimit:          vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier:  vi.fn().mockReturnValue('batch:prov-a'),
}))

// ── Pricing stubs ─────────────────────────────────────────────────────────────
vi.mock('@/lib/services/platform-pricing', () => ({
  getCommissionRate:  vi.fn().mockResolvedValue(12),
  getPlatformFeeRate: vi.fn().mockResolvedValue(3.5),
}))

// ── Payment service stub ──────────────────────────────────────────────────────
vi.mock('@/lib/services/payment', () => ({
  paymentService: {
    calculateCommission: vi.fn().mockResolvedValue({
      platformFee:    4.2,
      providerPayout: 75.8,
      commissionRate: 0.12,
      isFirstBooking: false,
      totalAmount:    80,
    }),
  },
}))

// ── Google Calendar stub ──────────────────────────────────────────────────────
vi.mock('@/lib/services/googleCalendar', () => ({
  googleCalendarService: {
    createCalendarEvent: vi.fn().mockResolvedValue({ success: false }),
  },
}))

// ── Email stub ────────────────────────────────────────────────────────────────
vi.mock('@/lib/services/email', () => ({
  emailService: { sendGenericEmail: vi.fn().mockResolvedValue(undefined) },
}))

// ── Ledger stub ───────────────────────────────────────────────────────────────
vi.mock('@/lib/services/ledger-operations', () => ({
  recordBookingPayment: vi.fn().mockResolvedValue(undefined),
}))

// ── Audit stub ────────────────────────────────────────────────────────────────
vi.mock('@/lib/services/audit', () => ({
  writeAuditLogSafe: vi.fn().mockResolvedValue(undefined),
}))

// ── Timezone stub ─────────────────────────────────────────────────────────────
vi.mock('@/lib/utils/timezone', () => ({
  resolveTimezone:   vi.fn().mockReturnValue('Australia/Sydney'),
  timezoneFromState: vi.fn().mockReturnValue('Australia/Sydney'),
  DEFAULT_TIMEZONE:  'Australia/Sydney',
}))

// ── Prisma mock ───────────────────────────────────────────────────────────────
// provider.findUnique → Provider A is APPROVED
// customer.findMany  → SCOPED query returns empty (Provider A has no relationship
//                      with Customer B — this is what the fix produces)
// booking.create / walletTransaction.create are NOT expected to be called

vi.mock('@/lib/prisma', () => ({
  prisma: {
    provider: {
      findUnique: vi.fn().mockResolvedValue({
        id:                 'batch-prov-a',
        name:               'Provider A',
        approvalStatus:     'APPROVED',
        isActive:           true,
        subscriptionStatus: 'ACTIVE',
        subscriptionTier:   'BASIC',
        syncGoogleCalendar: false,
        hourlyRate:         80,
        timezone:           'Australia/Sydney',
        state:              null,
        user:               { email: 'prov-a@test.com' },
      }),
    },
    customer: {
      // The scoped query returns NO customers because Customer B is not
      // related to Provider A. This is the critical assertion.
      findMany: vi.fn().mockResolvedValue([]),
    },
    clientWallet: {
      findUnique:  vi.fn().mockResolvedValue(null),
      update:      vi.fn().mockResolvedValue({}),
    },
    walletTransaction: {
      create: vi.fn().mockResolvedValue({}),
    },
    booking: {
      count:  vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({}),
    },
    transaction: {
      create: vi.fn().mockResolvedValue({}),
    },
    user: {
      update: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn().mockImplementation(async (fn: any) => fn({
      booking: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}), count: vi.fn().mockResolvedValue(0) },
      clientWallet: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn().mockResolvedValue({}) },
      walletTransaction: { create: vi.fn().mockResolvedValue({}) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    })),
  },
}))

// ── Import route AFTER all mocks are hoisted ──────────────────────────────────
import { POST } from '@/app/api/bookings/batch/route'
import { prisma } from '@/lib/prisma'

function buildBatchRequest(customerId: string): NextRequest {
  const tomorrow = new Date(Date.now() + 86_400_000)
  const dayAfter  = new Date(Date.now() + 86_400_000 * 2)
  return new NextRequest('http://localhost/api/bookings/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bookings: [
        {
          customerId,
          startTime:   tomorrow.toISOString(),
          endTime:     new Date(tomorrow.getTime() + 3_600_000).toISOString(),
          bookingType: 'LESSON',
        },
        {
          customerId,
          startTime:   dayAfter.toISOString(),
          endTime:     new Date(dayAfter.getTime() + 3_600_000).toISOString(),
          bookingType: 'LESSON',
        },
      ],
    }),
  })
}

describe('WLA-008-BATCH: Batch handler — Provider A / Provider B cross-tenant', () => {
  it('ROUTE-01 — handler returns HTTP 200 with all bookings in failed list', async () => {
    const req = buildBatchRequest(CUSTOMER_B_ID)
    const res = await POST(req)

    expect(res.status).toBe(200)
    const json = await res.json()

    // Both bookings should be in `failed`, not `successful`
    expect(json.failed).toHaveLength(2)
    expect(json.successful).toHaveLength(0)
    expect(json.summary.created).toBe(0)
    expect(json.summary.failed).toBe(2)
  })

  it('ROUTE-02 — no booking.create called for Provider B customer', async () => {
    const p = prisma as any
    expect(p.booking.create).not.toHaveBeenCalled()
  })

  it('ROUTE-03 — no wallet debit for Provider B customer', async () => {
    const p = prisma as any
    expect(p.walletTransaction.create).not.toHaveBeenCalled()
    expect(p.clientWallet.update).not.toHaveBeenCalled()
  })

  it('ROUTE-04 — customer.findMany was called with provider-scoped WHERE clause', async () => {
    const p = prisma as any
    expect(p.customer.findMany).toHaveBeenCalledTimes(1)
    const callArgs = p.customer.findMany.mock.calls[0][0]
    // The WHERE must include OR with bookings.some.providerId
    expect(callArgs.where.OR).toBeDefined()
    const hasSomeClause = callArgs.where.OR.some((clause: any) =>
      clause.bookings?.some?.providerId === PROVIDER_A_ID
    )
    expect(hasSomeClause).toBe(true)
  })

  it('ROUTE-05 — failed entries report the customer as unavailable to Provider A', async () => {
    const req = buildBatchRequest(CUSTOMER_B_ID)
    const res = await POST(req)
    const json = await res.json()
    // Each failure should identify the customer ID and include an error
    for (const failure of json.failed) {
      expect(failure.customerId).toBe(CUSTOMER_B_ID)
      expect(typeof failure.error).toBe('string')
      expect(failure.error.length).toBeGreaterThan(0)
    }
  })
})
