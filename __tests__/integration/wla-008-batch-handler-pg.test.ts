/**
 * WLA-008-BATCH-04: Batch handler with real PostgreSQL
 *
 * Invokes the actual POST /api/bookings/batch handler as Provider A,
 * submitting Provider B's customer ID. Uses the REAL Prisma client
 * (not mocked) so the customer.findMany query executes against PostgreSQL.
 *
 * The scoped query returns empty (Provider A has no relationship with
 * Provider B's customer), processBooking() receives an empty clientMap,
 * and the customer is reported as a per-booking failure.
 *
 * WHAT IS BEING TESTED
 *   - The actual production route handler (not a copy of its query)
 *   - Real PostgreSQL customer.findMany with the scoped WHERE clause
 *   - No booking.create, no walletTransaction.create, no wallet update
 *
 * DATABASE: postgresql://postgres:testpass@127.0.0.1:5433/drivebook_test
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

// ── Session: Provider A (hoisted mock) ───────────────────────────────────────
vi.mock('next-auth', () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: {
      id:         'batch-pg-user-a',
      providerId: '',  // filled in beforeAll after provider A is created
      email:      'batch-pg-prov-a@test.com',
      role:       'PROVIDER',
    },
  }),
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Map()),
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn() })),
}))

// ── Non-DB service mocks (these are imported by the route but not reached
//    because processBooking fails before any booking creation) ────────────────
vi.mock('@/lib/ratelimit', () => ({
  bulkBookingRateLimit:    {},
  checkRateLimit:          vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier:  vi.fn().mockReturnValue('batch-pg-test'),
}))

vi.mock('@/lib/middleware/subscriptionValidation', () => ({
  checkSubscriptionAccess: vi.fn().mockResolvedValue({ valid: true }),
}))

vi.mock('@/lib/services/platform-pricing', () => ({
  getCommissionRate:  vi.fn().mockResolvedValue(12),
  getPlatformFeeRate: vi.fn().mockResolvedValue(3.5),
}))

vi.mock('@/lib/services/email', () => ({
  emailService: { sendGenericEmail: vi.fn().mockResolvedValue(undefined) },
}))

vi.mock('@/lib/services/googleCalendar', () => ({
  googleCalendarService: { createCalendarEvent: vi.fn().mockResolvedValue({ success: false }) },
}))

vi.mock('@/lib/services/audit', () => ({
  writeAuditLogSafe: vi.fn().mockResolvedValue(undefined),
  writeAuditLog:     vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/services/auditLogger', () => ({
  logBookingAction: vi.fn().mockResolvedValue(undefined),
  AuditAction: {},
  ActorRole: {},
}))

vi.mock('@/lib/services/wallet-helpers', () => ({
  getWalletBalance: vi.fn().mockResolvedValue({ balance: 1000 }),
}))

vi.mock('@/lib/services/ledger-operations', () => ({
  recordBookingPayment: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/services/notificationRetry', () => ({
  enqueueNotification:   vi.fn().mockResolvedValue(undefined),
  drainRetryQueueAsync:  vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('@/lib/services/alert-service', () => ({
  sendAlert: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/config/platform-settings', () => ({
  getNotifChannels:  vi.fn().mockReturnValue({}),
  getBookingSettings: vi.fn().mockReturnValue({ minAdvanceHours: 0, maxAdvanceDays: 365 }),
}))

vi.mock('@/lib/utils/account', () => ({
  getDisplayName: vi.fn().mockReturnValue('Provider A'),
}))

// ── Import route AFTER mocks are hoisted ──────────────────────────────────────
import { POST } from '@/app/api/bookings/batch/route'
import { NextRequest } from 'next/server'

// ── Test fixtures ─────────────────────────────────────────────────────────────

const PREFIX = 'WLA008B4'
let providerAId: string
let providerBId: string
let customerBId: string
let clientBUserId: string

async function cleanup() {
  await prisma.booking.deleteMany({
    where: { providerId: { in: [providerAId ?? '__none__', providerBId ?? '__none__'] } },
  }).catch(() => {})
  await prisma.customer.deleteMany({ where: { id: customerBId ?? '__none__' } }).catch(() => {})
  await prisma.user.deleteMany({
    where: { email: { in: [
      `${PREFIX}-prov-a@test.com`, `${PREFIX}-prov-b@test.com`, `${PREFIX}-client-b@test.com`,
    ]}},
  }).catch(() => {})
  await prisma.provider.deleteMany({
    where: { id: { in: [providerAId ?? '__none__', providerBId ?? '__none__'] } },
  }).catch(() => {})
}

beforeAll(async () => {
  await cleanup()

  // Provider A
  const userA = await prisma.user.create({
    data: { email: `${PREFIX}-prov-a@test.com`, name: 'B4 Provider A', role: 'PROVIDER' },
  })
  const provA = await (prisma.provider as any).create({
    data: {
      user:               { connect: { id: userA.id } },
      name:               'B4 Provider A',
      phone:              '0400000030',
      hourlyRate:         80,
      approvalStatus:     'APPROVED',
      isActive:           true,
      subscriptionStatus: 'ACTIVE',
      subscriptionTier:   'BASIC',
    },
  })
  providerAId = provA.id

  // Provider B
  const userB = await prisma.user.create({
    data: { email: `${PREFIX}-prov-b@test.com`, name: 'B4 Provider B', role: 'PROVIDER' },
  })
  const provB = await (prisma.provider as any).create({
    data: {
      user:               { connect: { id: userB.id } },
      name:               'B4 Provider B',
      phone:              '0400000031',
      hourlyRate:         80,
      approvalStatus:     'APPROVED',
      isActive:           true,
      subscriptionStatus: 'ACTIVE',
      subscriptionTier:   'BASIC',
    },
  })
  providerBId = provB.id

  // Client B user + customer (belongs to Provider B only)
  const clientBUser = await prisma.user.create({
    data: { email: `${PREFIX}-client-b@test.com`, name: 'B4 Client B', role: 'CLIENT' },
  })
  clientBUserId = clientBUser.id
  const customer_raw = `${PREFIX}-cust-${Date.now()}`
  await prisma.$executeRawUnsafe(
    `INSERT INTO "Customer" (id, "userId", name, email, phone, status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, 'ACTIVE', NOW(), NOW())`,
    customer_raw, clientBUserId, 'B4 Client B',
    `${PREFIX}-client-b@test.com`, '0400000032'
  )
  customerBId = customer_raw

  // Seed a COMPLETED booking so Provider B owns this customer via booking history
  await (prisma.booking as any).create({
    data: {
      providerId:  providerBId,
      customerId:  customerBId,
      bookingType: 'LESSON',
      startTime:   new Date(Date.now() - 86_400_000 * 2),
      endTime:     new Date(Date.now() - 86_400_000 * 2 + 3_600_000),
      duration:    60,
      price:       80,
      status:      'COMPLETED',
      isPaid:      true,
      createdBy:   'customer',
    },
  })

  // Update the mocked session to use the real providerAId
  const { getServerSession } = await import('next-auth')
  vi.mocked(getServerSession).mockResolvedValue({
    user: {
      id:         userA.id,
      providerId: providerAId,
      email:      `${PREFIX}-prov-a@test.com`,
      role:       'PROVIDER',
    },
  } as any)
}, 30000)

afterAll(async () => {
  await cleanup()
}, 30000)

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WLA-008-BATCH-04: Actual batch handler + real PostgreSQL', () => {
  it('BATCH-04 — handler rejects Provider B customer; no booking or wallet debit created', async () => {
    // Count existing bookings for Provider A with Customer B (should be 0)
    const bookingsBefore = await prisma.booking.count({
      where: { providerId: providerAId, customerId: customerBId },
    })

    // Count existing wallet transactions for Client B
    const walletBefore = await prisma.clientWallet.findUnique({
      where: { userId: clientBUserId },
      select: { balance: true },
    }).catch(() => null)
    const balanceBefore = walletBefore ? Number(walletBefore.balance) : 0

    // Build the request: Provider A tries to batch-book Provider B's customer
    const tomorrow = new Date(Date.now() + 86_400_000)
    const req = new NextRequest('http://localhost/api/bookings/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookings: [
          {
            customerId: customerBId,
            startTime: tomorrow.toISOString(),
            endTime:   new Date(tomorrow.getTime() + 3_600_000).toISOString(),
            bookingType: 'LESSON',
          },
        ],
      }),
    })

    // Invoke the actual handler — real Prisma, real PostgreSQL
    const res = await POST(req)

    // The handler returns 200 (batch results format)
    expect(res.status).toBe(200)
    const json = await res.json()

    // The booking should be in `failed`, not `successful`
    expect(json.failed).toHaveLength(1)
    expect(json.successful).toHaveLength(0)
    expect(json.summary.created).toBe(0)
    expect(json.summary.failed).toBe(1)

    // No new booking was created
    const bookingsAfter = await prisma.booking.count({
      where: { providerId: providerAId, customerId: customerBId },
    })
    expect(bookingsAfter).toBe(bookingsBefore)  // unchanged

    // No wallet debit occurred
    const walletAfter = await prisma.clientWallet.findUnique({
      where: { userId: clientBUserId },
      select: { balance: true },
    }).catch(() => null)
    const balanceAfter = walletAfter ? Number(walletAfter.balance) : 0
    expect(balanceAfter).toBe(balanceBefore)  // unchanged

    // The failure entry identifies the customer
    expect(json.failed[0].customerId).toBe(customerBId)
    expect(typeof json.failed[0].error).toBe('string')
    expect(json.failed[0].error.length).toBeGreaterThan(0)
  }, 30000)
})
