/**
 * WLA-008-B HTTP response tests — mobile booking route
 *
 * These tests invoke the actual POST /api/bookings/mobile handler with mocked
 * dependencies to verify HTTP status codes. They are kept in a separate file
 * from the PostgreSQL concurrency tests so vi.mock() hoisting does not affect
 * the real Prisma client used by the DB-backed tests.
 *
 * HTTP-01 — exhausted P2034 → HTTP 409
 * HTTP-02 — successful booking → HTTP 201
 * RETRY-01..RETRY-04 — withSerializableRetry behavioral tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import { withSerializableRetry } from '@/lib/utils/transaction-retry'

// ── JWT mock — hoisted so the route handler receives a decoded token ──────────
vi.mock('jsonwebtoken', () => ({
  default: { verify: vi.fn().mockReturnValue({ userId: 'mock-user-id', providerId: 'mock-provider-id' }) },
}))

// ── availability + eligibility stubs ─────────────────────────────────────────
vi.mock('@/lib/booking/checkProviderEligible', () => ({
  checkProviderEligible: vi.fn().mockResolvedValue({
    allowed: true,
    provider: { id: 'mock-provider-id', hourlyRate: 60, syncGoogleCalendar: false },
  }),
}))
vi.mock('@/lib/services/availability', () => ({
  availabilityService: { checkDoubleBooking: vi.fn().mockResolvedValue(false) },
}))

// ── Google Calendar stub ──────────────────────────────────────────────────────
vi.mock('@/lib/services/googleCalendar', () => ({
  googleCalendarService: { createCalendarEvent: vi.fn().mockResolvedValue({ success: false }) },
}))

// ── Prisma mock — overridden per test ─────────────────────────────────────────
vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'cust-001', name: 'Test Client', phone: '0400000000', email: 'c@test.com',
      }),
      findUnique: vi.fn().mockResolvedValue({ userId: 'client-user-001' }),
    },
    provider: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'mock-provider-id', hourlyRate: 60, syncGoogleCalendar: false,
        user: { email: 'p@test.com' },
      }),
    },
    clientWallet: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'wallet-001',
        transactions: [{ type: 'CREDIT', amount: 200, status: 'CONFIRMED' }],
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    walletTransaction: { create: vi.fn().mockResolvedValue({}) },
    booking: {
      create: vi.fn().mockResolvedValue({
        id: 'booking-new-001',
        status: 'CONFIRMED',
        isPaid: true,
        paidAt: new Date(),
        startTime: new Date('2026-12-01T09:00:00Z'),
        endTime:   new Date('2026-12-01T10:00:00Z'),
        price: 60,
        bookingType: 'LESSON',
        pickupAddress: null,
        dropoffAddress: null,
        notes: null,
        customer: { name: 'Test Client', phone: '0400000000', email: 'c@test.com' },
        googleCalendarEventId: null,
        providerId: 'mock-provider-id',
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    pDATest: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn(),
  },
}))

// ── Import route AFTER all mocks are in place ─────────────────────────────────
import { POST } from '@/app/api/bookings/mobile/route'
import { prisma } from '@/lib/prisma'

function buildMobileRequest(body: object): NextRequest {
  return new NextRequest('http://localhost/api/bookings/mobile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer header.payload.signature',
    },
    body: JSON.stringify(body),
  })
}

function makeP2034(): PrismaClientKnownRequestError {
  return new PrismaClientKnownRequestError('serialization failure', {
    code: 'P2034',
    clientVersion: '5.22.0',
  })
}

const VALID_BODY = {
  customerId: 'cust-001',
  startTime:  '2026-12-01T09:00:00.000Z',
  endTime:    '2026-12-01T10:00:00.000Z',
  bookingType: 'LESSON',
}

// ─── Group 2: withSerializableRetry behavioral tests ─────────────────────────

describe('WLA-008-B: withSerializableRetry behavioral tests', () => {
  it('RETRY-01 — P2034 on first attempt, success on retry → returns result', async () => {
    let calls = 0
    const result = await withSerializableRetry(async () => {
      calls++
      if (calls === 1) throw makeP2034()
      return 'ok'
    }, { operationName: 'retry-01' })
    expect(result).toBe('ok')
    expect(calls).toBe(2)
  })

  it('RETRY-02 — all retries exhausted → rethrows P2034', async () => {
    let calls = 0
    await expect(
      withSerializableRetry(async () => {
        calls++
        throw makeP2034()
      }, { operationName: 'retry-02', maxRetries: 2 })
    ).rejects.toMatchObject({ code: 'P2034' })
    // 1 initial + 2 retries = 3 total calls
    expect(calls).toBe(3)
  })

  it('RETRY-03 — non-P2034 error rethrown immediately (no retry)', async () => {
    let calls = 0
    await expect(
      withSerializableRetry(async () => {
        calls++
        throw new Error('SLOT_CONFLICT')
      }, { operationName: 'retry-03' })
    ).rejects.toThrow('SLOT_CONFLICT')
    expect(calls).toBe(1)
  })

  it('RETRY-04 — first-call success → result returned, called once', async () => {
    let calls = 0
    const result = await withSerializableRetry(async () => {
      calls++
      return { id: 'booking-1' }
    }, { operationName: 'retry-04' })
    expect(result).toEqual({ id: 'booking-1' })
    expect(calls).toBe(1)
  })
})

// ─── Group 3: Route HTTP response tests ──────────────────────────────────────

describe('WLA-008-B: Mobile route HTTP response tests', () => {
  beforeEach(() => {
    // Reset $transaction to a neutral state between tests without disturbing
    // the other hoisted module-level mocks (clearAllMocks would reset those too)
    const p = prisma as any
    p.$transaction.mockReset()
  })

  it('HTTP-01 — exhausted P2034 from $transaction → HTTP 409', async () => {
    // withSerializableRetry calls $transaction (maxRetries=2 default → 3 times).
    // After all retries throw P2034, the route catch block must return 409.
    const p = prisma as any
    p.$transaction.mockRejectedValue(makeP2034())

    const res = await POST(buildMobileRequest(VALID_BODY))

    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toMatch(/concurrent|conflict|try again/i)
    // withSerializableRetry default maxRetries=2 → 3 total attempts (1 initial + 2 retries)
    expect(p.$transaction).toHaveBeenCalledTimes(3)
  })

  it('HTTP-02 — successful $transaction → HTTP 201 with booking data', async () => {
    const p = prisma as any
    p.$transaction.mockImplementation(async (fn: any) => fn({
      clientWallet: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'wallet-001',
          transactions: [{ type: 'CREDIT', amount: 200, status: 'CONFIRMED' }],
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      walletTransaction: { create: vi.fn().mockResolvedValue({}) },
      booking: {
        create: vi.fn().mockResolvedValue({
          id: 'booking-new-001',
          status: 'CONFIRMED',
          isPaid: true,
          paidAt: new Date(),
          startTime: new Date('2026-12-01T09:00:00Z'),
          endTime:   new Date('2026-12-01T10:00:00Z'),
          price: 60,
          bookingType: 'LESSON',
          pickupAddress: null,
          dropoffAddress: null,
          notes: null,
          googleCalendarEventId: null,
          providerId: 'mock-provider-id',
          customer: { name: 'Test Client', phone: '0400000000', email: 'c@test.com' },
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    }))

    const res = await POST(buildMobileRequest(VALID_BODY))

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.booking.id).toBe('booking-new-001')
    expect(json.booking.status).toBe('CONFIRMED')
  })
})
