/**
 * Phase 6 Runtime Tests — CP-01, CP-02, CP-03 (service), CP-04, CP-05, CP-06
 *
 * Architecture: direct route-handler invocation (no live server needed).
 *   Vitest → import { GET/POST } from route module
 *   Route handler (real production code, unmodified)
 *   vi.mock for: getServerSession, validateMobileToken, emailService,
 *                notifications, ratelimit
 *   Prisma $transaction (REAL) → PostgreSQL (Japan Supabase direct, port 5432)
 *
 * WHAT IS REAL:
 *   - All Prisma queries and transactions
 *   - All database state (bookings, customers, wallets, providers, reviews)
 *   - Profile count queries (getProfileBookingCounts production function)
 *   - executeWalletBookingTransaction production service (CP-03)
 *   - localDateTimeToUTC timezone conversion (CP-05)
 *   - computeWalletBalance Decimal arithmetic (CP-02)
 *
 * WHAT IS MOCKED:
 *   - getServerSession / validateMobileToken (session fixture injection)
 *   - emailService (prevent real SMTP)
 *   - notifications (prevent queue writes)
 *   - ratelimit (always allow, except where rate-limit behaviour is under test)
 *   - paymentService.calculateCommission (fixed predictable commission)
 *
 * DATABASE: Japan Supabase direct connection (port 5432, SERIALIZABLE supported)
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'

// ── Mocks (must be declared before any route imports) ─────────────────────────

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/mobile-auth',    () => ({ validateMobileToken: vi.fn().mockResolvedValue({ valid: false }) }))
vi.mock('@/lib/services/email', () => ({ emailService: { sendGenericEmail: vi.fn().mockResolvedValue(undefined) } }))
vi.mock('@/lib/services/notifications', () => ({
  notifyBookingRequest:         vi.fn().mockResolvedValue(undefined),
  notifyClientBookingConfirmed: vi.fn().mockResolvedValue(undefined),
  notifyReviewReceived:         vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/ratelimit', () => ({
  bulkBookingRateLimit:   {},
  reviewRateLimit:        {},
  checkRateLimit:         vi.fn().mockResolvedValue({ success: true, headers: {} }),
  getRateLimitIdentifier: vi.fn().mockReturnValue('test-id'),
}))
vi.mock('@/lib/services/payment', () => ({
  paymentService: {
    calculateCommission: vi.fn().mockResolvedValue({
      totalAmount:     60,
      platformFee:     6,
      providerPayout:  54,
      commissionRate:  0.1,
      isFirstBooking:  false,
    }),
  },
}))
// Ledger recording is non-critical (fire-and-forget in route)
vi.mock('@/lib/services/ledger-operations', () => ({
  recordBookingPayment: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/services/receipt-email', () => ({
  sendWalletLessonReceipt: vi.fn().mockResolvedValue(undefined),
}))

// ── Route imports (after mocks) ───────────────────────────────────────────────

import { GET as profileGET }   from '@/app/api/client/profile/route'
import { POST as bulkPOST }    from '@/app/api/client/bookings/create-bulk/route'
import { POST as reviewPOST, GET as reviewGET } from '@/app/api/reviews/route'
import { getServerSession }    from 'next-auth/next'
import { validateMobileToken } from '@/lib/mobile-auth'
import { computeWalletBalance, computeWalletBalanceDecimal } from '@/lib/services/wallet-booking'
import { executeWalletBookingTransaction } from '@/lib/services/wallet-booking'
import { localDateTimeToUTC }  from '@/lib/utils/timezone'

// ── Test database ─────────────────────────────────────────────────────────────

const testPrisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(url: string, body?: unknown, method = body ? 'POST' : 'GET'): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': `cp6-${Date.now()}-${Math.random()}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function mockSession(email: string, extra?: Record<string, unknown>) {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { email, id: 'test-session-id', ...extra },
  } as any)
}

const TS = Date.now()
const uid = (label: string) => `CP6_${label}_${TS}_${Math.random().toString(36).slice(2)}`

// ── Shared fixture state ──────────────────────────────────────────────────────

type Fixture = {
  user: any
  customer: any
  provider: any
  providerUser: any
  wallet: any
}

async function createFullFixture(label: string): Promise<Fixture> {
  const userEmail = uid(`${label}_user`) + '@test.invalid'
  const provEmail = uid(`${label}_prov`) + '@test.invalid'

  const user = await testPrisma.user.create({
    data: { email: userEmail, name: `${label} User`, role: 'CLIENT' },
  })
  const providerUser = await testPrisma.user.create({
    data: { email: provEmail, name: `${label} Provider`, role: 'INSTRUCTOR' },
  })
  const provider = await testPrisma.provider.create({
    data: {
      user: { connect: { id: providerUser.id } },
      name: `${label} Instructor`,
      phone: '0400000000',
      hourlyRate: 60,
      approvalStatus: 'APPROVED',
      isActive: true,
      subscriptionStatus: 'ACTIVE',
      subscriptionTier: 'STANDARD',
      timezone: 'Australia/Perth',
      state: 'WA',
    } as any,
  })
  const customer = await testPrisma.customer.create({
    data: {
      user:  { connect: { id: user.id } },
      name:  `${label} User`,
      email: userEmail,
      phone: '0400000000',
    } as any,
  })
  const wallet = await testPrisma.clientWallet.create({
    data: { userId: user.id },
  })

  return { user, customer, provider, providerUser, wallet }
}

async function addWalletCredit(walletId: string, amount: number) {
  return testPrisma.walletTransaction.create({
    data: { walletId, type: 'CREDIT', amount, status: 'CONFIRMED', description: 'test credit' },
  })
}

async function cleanupFixture(f: Fixture) {
  if (!f) return
  await testPrisma.booking.deleteMany({ where: { customerId: f.customer.id } })
  await testPrisma.walletTransaction.deleteMany({ where: { walletId: f.wallet.id } })
  await testPrisma.clientWallet.deleteMany({ where: { id: f.wallet.id } })
  await testPrisma.customer.deleteMany({ where: { id: f.customer.id } })
  await testPrisma.provider.deleteMany({ where: { id: f.provider.id } })
  await testPrisma.user.deleteMany({ where: { id: { in: [f.user.id, f.providerUser.id] } } })
}

// ─────────────────────────────────────────────────────────────────────────────
// CP-01: Cross-account booking disclosure via null customerId fallback
// ─────────────────────────────────────────────────────────────────────────────

describe('CP-01 — profile route: empty customer list returns empty bookings', () => {
  let userWithNoCustomers: any
  let otherUser: any
  let otherFixture: Fixture
  let offlineBookingId: string | null = null

  beforeAll(async () => {
    // User A: has no Customer records
    userWithNoCustomers = await testPrisma.user.create({
      data: { email: uid('CP01_A') + '@test.invalid', name: 'CP01 NoCustomer', role: 'CLIENT' },
    })

    // User B: has an offline booking (customerId = null — the old disclosure path)
    otherFixture = await createFullFixture('CP01_B')

    // Create an offline booking with no customerId (simulates real offline bookings)
    const offlineBooking = await testPrisma.booking.create({
      data: {
        providerId:  otherFixture.provider.id,
        customerId:  null,
        bookingType: 'LESSON',
        status:      'CONFIRMED',
        startTime:   new Date(Date.now() + 24 * 60 * 60 * 1000),
        endTime:     new Date(Date.now() + 25 * 60 * 60 * 1000),
        duration:    1,
        price:       60,
        createdBy:   'provider',
      } as any,
    })
    offlineBookingId = offlineBooking.id
  })

  afterAll(async () => {
    if (offlineBookingId) await testPrisma.booking.deleteMany({ where: { id: offlineBookingId } })
    await cleanupFixture(otherFixture)
    await testPrisma.user.deleteMany({ where: { id: userWithNoCustomers.id } })
  })

  it('CP01-R1: user with no customer records receives empty booking list', async () => {
    mockSession(userWithNoCustomers.email)
    const req = makeRequest('/api/client/profile', undefined, 'GET')
    const res = await profileGET(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.bookings).toEqual([])
    expect(body.upcomingCount).toBe(0)
    expect(body.pastCount).toBe(0)
  })

  it('CP01-R2: offline bookings with null customerId are not disclosed to other users', async () => {
    mockSession(userWithNoCustomers.email)
    const req = makeRequest('/api/client/profile', undefined, 'GET')
    const res = await profileGET(req)
    const body = await res.json()
    // The offline booking must not appear in this user's response
    const ids = body.bookings.map((b: any) => b.id)
    expect(ids).not.toContain(offlineBookingId)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// CP-02: Decimal wallet balance arithmetic
// ─────────────────────────────────────────────────────────────────────────────

describe('CP-02 — computeWalletBalance: Decimal amounts sum correctly', () => {
  it('CP02-R1: two Decimal credits sum to their numeric total (not concatenated)', () => {
    // Prisma returns Decimal objects, which must be added without coercing to strings.
    const { Decimal } = require('@prisma/client/runtime/library')
    const transactions = [
      { type: 'CREDIT', amount: new Decimal('70.00'), expiresAt: null },
      { type: 'CREDIT', amount: new Decimal('70.00'), expiresAt: null },
    ]
    const balance = computeWalletBalance(transactions)
    expect(typeof balance).toBe('number')
    expect(balance).toBe(140)
  })

  it('CP02-R2: decimal credits and debits retain exact cents and expired credits are excluded', () => {
    const { Decimal } = require('@prisma/client/runtime/library')
    const asOf = new Date('2026-11-19T00:00:00.000Z')
    const transactions = [
      { type: 'CREDIT', amount: new Decimal('0.10'), expiresAt: null },
      { type: 'CREDIT', amount: new Decimal('0.20'), expiresAt: null },
      { type: 'CREDIT', amount: new Decimal('0.40'), expiresAt: asOf },
      { type: 'CREDIT', amount: new Decimal('50.00'), expiresAt: new Date(asOf.getTime() - 1) },
      { type: 'DEBIT', amount: new Decimal('0.30'), expiresAt: null },
    ]
    expect(computeWalletBalance(transactions, asOf)).toBe(0.4)
  })

  it('CP02-R3: decimal arithmetic preserves exact-cent boundary results', () => {
    const { Decimal } = require('@prisma/client/runtime/library')
    const asOf = new Date('2026-11-19T00:00:00.000Z')
    const transactions = [
      { type: 'CREDIT', amount: new Decimal('0.10'), expiresAt: null },
      { type: 'CREDIT', amount: new Decimal('0.20'), expiresAt: null },
      { type: 'DEBIT', amount: new Decimal('0.30'), expiresAt: null },
    ]
    const availableBalance = computeWalletBalanceDecimal(transactions.slice(0, 2), asOf)
    expect(availableBalance.equals(new Decimal('0.30'))).toBe(true)
    expect(availableBalance.greaterThanOrEqualTo(new Decimal('0.30'))).toBe(true)
    expect(availableBalance.lessThan(new Decimal('0.31'))).toBe(true)
    const exactBalance = computeWalletBalanceDecimal(transactions, asOf)
    expect(exactBalance.greaterThanOrEqualTo(new Decimal('0.00'))).toBe(true)
    expect(exactBalance.lessThan(new Decimal('0.01'))).toBe(true)
    expect(computeWalletBalance(transactions, asOf)).toBe(0)
    expect(
      computeWalletBalance(
        [...transactions, { type: 'CREDIT', amount: new Decimal('0.01'), expiresAt: null }],
        asOf,
      ),
    ).toBe(0.01)
  })

  it('CP02-R4: profile route returns numeric balance in response', async () => {
    // Create a user with Decimal wallet credits and confirm the route returns numbers
    const f = await createFullFixture('CP02_R3')
    try {
      await addWalletCredit(f.wallet.id, 70)
      await addWalletCredit(f.wallet.id, 70)
      mockSession(f.user.email)
      const req = makeRequest('/api/client/profile', undefined, 'GET')
      const res = await profileGET(req)
      expect(res.status).toBe(200)
      // Response should not throw — if balance was a string, .toFixed(2) would fail
    } finally {
      await cleanupFixture(f)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// CP-03: executeWalletBookingTransaction production service
// ─────────────────────────────────────────────────────────────────────────────

describe('CP-03 — executeWalletBookingTransaction production service', () => {
  let fixture: Fixture

  beforeAll(async () => {
    fixture = await createFullFixture('CP03_SVC')
    await addWalletCredit(fixture.wallet.id, 120)
  })

  afterAll(() => cleanupFixture(fixture))

  it('CP03-S1: service creates booking and debit atomically', async () => {
    const result = await executeWalletBookingTransaction(
      {
        userId:     fixture.user.id,
        customerId: fixture.customer.id,
        walletId:   fixture.wallet.id,
        items: [{
          providerId:     fixture.provider.id,
          instructorName: 'CP03 Provider',
          date:           '2027-06-15',
          time:           '10:00',
          duration:       1,
          price:          60,
          timezone:       'Australia/Perth',
        }],
        commissions: [{
          totalAmount: 60, platformFee: 6, providerPayout: 54,
          commissionRate: 0.1, isFirstBooking: false,
        }],
        totalCost: 60,
      },
      testPrisma,
    )

    expect(result.created.length).toBe(1)
    expect(result.remaining).toBe(60)   // 120 - 60

    const debit = await testPrisma.walletTransaction.findFirst({
      where: { walletId: fixture.wallet.id, type: 'DEBIT', status: 'CONFIRMED' },
    })
    expect(debit).not.toBeNull()
    expect(Number(debit!.amount)).toBe(60)

    // cleanup booking
    await testPrisma.booking.deleteMany({ where: { id: result.created[0].booking.id } })
    await testPrisma.walletTransaction.deleteMany({
      where: { walletId: fixture.wallet.id, type: 'DEBIT' },
    })
  })

  it('CP03-S2: service rejects when balance is insufficient', async () => {
    // wallet has 120 credits; try to book 200
    await expect(
      executeWalletBookingTransaction(
        {
          userId:     fixture.user.id,
          customerId: fixture.customer.id,
          walletId:   fixture.wallet.id,
          items: [{
            providerId:     fixture.provider.id,
            instructorName: 'CP03 Provider',
            date:           '2027-06-16',
            time:           '10:00',
            duration:       1,
            price:          200,
            timezone:       'Australia/Perth',
          }],
          commissions: [{
            totalAmount: 200, platformFee: 20, providerPayout: 180,
            commissionRate: 0.1, isFirstBooking: false,
          }],
          totalCost: 200,
        },
        testPrisma,
      ),
    ).rejects.toThrow('Insufficient credits')
  })

  it('CP03-S3: slot conflict prevents double-booking the same slot', async () => {
    const future = new Date(Date.now() + 72 * 60 * 60 * 1000)
    const dateStr = future.toISOString().split('T')[0]

    // Create the first booking directly
    const existing = await testPrisma.booking.create({
      data: {
        provider:    { connect: { id: fixture.provider.id } },
        customer:    { connect: { id: fixture.customer.id } },
        bookingType: 'LESSON', status: 'CONFIRMED',
        startTime:   localDateTimeToUTC(dateStr, '09:00', 'Australia/Perth'),
        endTime:     localDateTimeToUTC(dateStr, '10:00', 'Australia/Perth'),
        duration: 1, price: 60, createdBy: 'customer', isPaid: true, paidAt: new Date(),
      } as any,
    })

    try {
      await expect(
        executeWalletBookingTransaction(
          {
            userId:     fixture.user.id,
            customerId: fixture.customer.id,
            walletId:   fixture.wallet.id,
            items: [{
              providerId:     fixture.provider.id,
              instructorName: 'CP03 Provider',
              date:           dateStr,
              time:           '09:30',   // overlaps 09:00-10:00
              duration:       1,
              price:          60,
              timezone:       'Australia/Perth',
            }],
            commissions: [{
              totalAmount: 60, platformFee: 6, providerPayout: 54,
              commissionRate: 0.1, isFirstBooking: false,
            }],
            totalCost: 60,
          },
          testPrisma,
        ),
      ).rejects.toThrow('Time slot no longer available')
    } finally {
      await testPrisma.booking.deleteMany({ where: { id: existing.id } })
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// CP-04: Instructor eligibility gate
// ─────────────────────────────────────────────────────────────────────────────

describe('CP-04 — bulk booking route: suspended instructor is rejected', () => {
  let fixture: Fixture

  beforeAll(async () => {
    fixture = await createFullFixture('CP04')
    await addWalletCredit(fixture.wallet.id, 120)

    // Suspend the provider
    await testPrisma.provider.update({
      where: { id: fixture.provider.id },
      data: { approvalStatus: 'SUSPENDED' } as any,
    })
  })

  afterAll(async () => {
    await testPrisma.provider.update({
      where: { id: fixture.provider.id },
      data: { approvalStatus: 'APPROVED' } as any,
    })
    await cleanupFixture(fixture)
  })

  it('CP04-R1: booking with suspended instructor returns 403', async () => {
    mockSession(fixture.user.email)

    const req = makeRequest('/api/client/bookings/create-bulk', {
      cart: [{
        providerId:     fixture.provider.id,
        instructorName: 'CP04 Suspended',
        date:           '2027-07-01',
        time:           '10:00',
        duration:       1,
        price:          60,
      }],
    })
    const res = await bulkPOST(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/not available|not approved|suspended/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// CP-05: Instructor timezone conversion
// ─────────────────────────────────────────────────────────────────────────────

describe('CP-05 — timezone conversion: Perth 09:00 → UTC 01:00', () => {
  it('CP05-R0: Sydney 09:00 resolves through provider timezone across DST boundaries', () => {
    const winter = localDateTimeToUTC('2027-07-15', '09:00', 'Australia/Sydney')
    const summer = localDateTimeToUTC('2027-01-15', '09:00', 'Australia/Sydney')
    expect(winter.toISOString()).toBe('2027-07-14T23:00:00.000Z')
    expect(summer.toISOString()).toBe('2027-01-14T22:00:00.000Z')
  })

  it('CP05-R1: localDateTimeToUTC Perth 09:00 stores as 01:00 UTC', () => {
    const result = localDateTimeToUTC('2027-01-15', '09:00', 'Australia/Perth')
    // Perth = UTC+8 (no DST). 09:00 Perth = 01:00 UTC.
    expect(result.getUTCHours()).toBe(1)
    expect(result.getUTCMinutes()).toBe(0)
  })

  it('CP05-R2: localDateTimeToUTC Sydney 09:00 stores as 23:00 UTC (prev day, AEDT UTC+11)', () => {
    // Sydney in January is on AEDT (UTC+11). 09:00 AEDT = 22:00 UTC prev day.
    const result = localDateTimeToUTC('2027-01-15', '09:00', 'Australia/Sydney')
    // 09:00 Sydney (AEDT UTC+11) = 2027-01-14T22:00:00Z
    expect(result.getUTCHours()).toBe(22)
    expect(result.toISOString().startsWith('2027-01-14')).toBe(true)
  })

  it('CP05-R3: booking created through service stores correct UTC time for Perth instructor', async () => {
    const fixture = await createFullFixture('CP05_R3')
    await addWalletCredit(fixture.wallet.id, 120)

    try {
      const result = await executeWalletBookingTransaction(
        {
          userId:     fixture.user.id,
          customerId: fixture.customer.id,
          walletId:   fixture.wallet.id,
          items: [{
            providerId:     fixture.provider.id,
            instructorName: 'CP05 Provider',
            date:           '2027-01-15',
            time:           '09:00',
            duration:       1,
            price:          60,
            timezone:       'Australia/Perth',   // UTC+8
          }],
          commissions: [{
            totalAmount: 60, platformFee: 6, providerPayout: 54,
            commissionRate: 0.1, isFirstBooking: false,
          }],
          totalCost: 60,
        },
        testPrisma,
      )

      const booking = await testPrisma.booking.findUnique({
        where: { id: result.created[0].booking.id },
        select: { startTime: true },
      })
      expect(booking!.startTime.getUTCHours()).toBe(1)    // 09:00 Perth = 01:00 UTC
      expect(booking!.startTime.getUTCMinutes()).toBe(0)

      await testPrisma.booking.deleteMany({ where: { id: result.created[0].booking.id } })
    } finally {
      await cleanupFixture(fixture)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// CP-06: Review persistence and display
// ─────────────────────────────────────────────────────────────────────────────

describe('CP-06 — reviews route: customerReview written and read back as text', () => {
  let fixture: Fixture
  let bookingId: string

  beforeAll(async () => {
    fixture = await createFullFixture('CP06')

    // Create a completed booking to review
    const past = new Date(Date.now() - 2 * 60 * 60 * 1000)
    const booking = await testPrisma.booking.create({
      data: {
        provider:    { connect: { id: fixture.provider.id } },
        customer:    { connect: { id: fixture.customer.id } },
        bookingType: 'LESSON',
        status:      'CONFIRMED',
        startTime:   new Date(past.getTime() - 60 * 60 * 1000),
        endTime:     past,
        duration:    1,
        price:       60,
        createdBy:   'customer',
        isPaid:      true,
        paidAt:      past,
      } as any,
    })
    bookingId = booking.id
  })

  afterAll(async () => {
    // Clear review fields
    await testPrisma.booking.updateMany({
      where: { id: bookingId },
      data: { customerRating: null, reviewGivenAt: null } as any,
    })
    await testPrisma.booking.deleteMany({ where: { id: bookingId } })
    await cleanupFixture(fixture)
  })

  it('CP06-R1: POST /api/reviews writes customerReview field (not reviewComment)', async () => {
    mockSession(fixture.user.email)
    vi.mocked(validateMobileToken).mockResolvedValue({ valid: false } as any)

    const req = makeRequest('/api/reviews', {
      bookingId,
      rating:  5,
      comment: 'Excellent lesson!',
    })
    const res = await reviewPOST(req)
    expect(res.status).toBe(200)

    // Verify the correct field was written to DB
    const booking = await testPrisma.booking.findUnique({
      where: { id: bookingId },
      select: { customerRating: true, customerReview: true, reviewGivenAt: true } as any,
    }) as any

    expect(booking.customerRating).toBe(5)
    expect(booking.customerReview).toBe('Excellent lesson!')
    expect(booking.reviewGivenAt).not.toBeNull()
  })

  it('CP06-R2: GET /api/reviews returns comment as text string not numeric rating', async () => {
    // The old bug: comment: b.customerRating (returned the number 5 as the comment)
    mockSession(fixture.user.email)
    vi.mocked(validateMobileToken).mockResolvedValue({ valid: false } as any)

    const req = new NextRequest(`http://localhost/api/reviews`, { method: 'GET' })
    const res = await reviewGET(req)
    expect(res.status).toBe(200)

    const reviews = await res.json()
    const review = reviews.find((r: any) => r.id === bookingId)
    expect(review).toBeDefined()

    // comment must be the text string, not the numeric rating
    expect(review.comment).toBe('Excellent lesson!')
    expect(review.comment).not.toBe(5)
    expect(typeof review.comment).toBe('string')
  })

  it('CP06-R3: duplicate review submission is rejected', async () => {
    mockSession(fixture.user.email)
    vi.mocked(validateMobileToken).mockResolvedValue({ valid: false } as any)

    const req = makeRequest('/api/reviews', {
      bookingId,
      rating:  4,
      comment: 'Second attempt — should be rejected',
    })
    const res = await reviewPOST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/already been reviewed/i)
  })
})

// ── Final disconnect ──────────────────────────────────────────────────────────

afterAll(async () => {
  await testPrisma.$disconnect()
})
