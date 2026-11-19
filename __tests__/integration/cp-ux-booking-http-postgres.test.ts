import { randomUUID } from 'crypto'
import { PrismaClient } from '@prisma/client'
import { NextRequest } from 'next/server'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getRateLimitIdentifier: vi.fn(),
  checkRateLimit: vi.fn(),
  calculateCommission: vi.fn(),
  notifyBookingRequest: vi.fn(),
  notifyClientBookingConfirmed: vi.fn(),
  sendWalletLessonReceipt: vi.fn(),
  failNextLedgerWrite: false,
}))

vi.mock('next-auth/next', () => ({
  getServerSession: mocks.getServerSession,
}))

vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/ratelimit', () => ({
  bulkBookingRateLimit: {},
  checkRateLimit: mocks.checkRateLimit,
  getRateLimitIdentifier: mocks.getRateLimitIdentifier,
}))
vi.mock('@/lib/services/payment', () => ({
  paymentService: { calculateCommission: mocks.calculateCommission },
}))
vi.mock('@/lib/services/notifications', () => ({
  notifyBookingRequest: mocks.notifyBookingRequest,
  notifyClientBookingConfirmed: mocks.notifyClientBookingConfirmed,
}))
vi.mock('@/lib/services/receipt-email', () => ({
  sendWalletLessonReceipt: mocks.sendWalletLessonReceipt,
}))
vi.mock('@/lib/services/ledger-operations', async () => {
  const actual = await vi.importActual<typeof import('@/lib/services/ledger-operations')>(
    '@/lib/services/ledger-operations',
  )
  return {
    ...actual,
    recordBookingPayment: vi.fn((...args: Parameters<typeof actual.recordBookingPayment>) => {
      if (mocks.failNextLedgerWrite) {
        mocks.failNextLedgerWrite = false
        return Promise.reject(new Error('simulated post-commit ledger outage'))
      }
      return actual.recordBookingPayment(...args)
    }),
  }
})

import { POST as createWalletBooking } from '@/app/api/client/bookings/create-bulk/route'
import { POST as cancelPdaBookingHttp } from '@/app/api/client/pda-bookings/[id]/cancel/route'
import { prisma } from '@/lib/prisma'
import * as ledgerOperations from '@/lib/services/ledger-operations'
import { getPdaFundsHeldReconciliation } from '@/lib/services/pda-financial-operations'

const testDatabaseUrl = process.env.TEST_DATABASE_URL

type Fixture = {
  userId: string
  email: string
  walletId: string
  customerId: string
  providerId: string
  configId: string
  testCentreId: string
}

describe.skipIf(!testDatabaseUrl)('Client wallet checkout HTTP flow - PostgreSQL', () => {
  let fixture: Fixture | null = null

  async function createFixture(): Promise<Fixture> {
    const token = randomUUID()
    return prisma.$transaction(async tx => {
      const email = `CPUX_HTTP_${token}@test.invalid`
      const user = await tx.user.create({
        data: { email, name: 'Checkout HTTP test', role: 'CLIENT' },
      })
      const customer = await tx.customer.create({
        data: {
          userId: user.id,
          email: `CPUX_HTTP_CUSTOMER_${token}@test.invalid`,
          name: 'Checkout HTTP test',
          phone: '0400000000',
        },
      })
      const wallet = await tx.clientWallet.create({ data: { userId: user.id } })
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'CREDIT',
          amount: 1000,
          status: 'CONFIRMED',
          description: 'Checkout HTTP test credit',
        },
      })
      const provider = await tx.provider.create({
        data: {
          name: 'Checkout HTTP test instructor',
          phone: `04${token.replace(/-/g, '').slice(0, 8)}`,
          hourlyRate: 60,
          approvalStatus: 'APPROVED',
          isActive: true,
          subscriptionStatus: 'ACTIVE',
          subscriptionTier: 'STANDARD',
          timezone: 'Australia/Perth',
          businessModel: 'MARKETPLACE',
        },
      })
      const testCentre = await tx.testCentre.create({
        data: {
          name: `CPUX HTTP test centre ${token}`,
          address: '1 Test Road',
          suburb: 'Perth',
          state: 'WA',
        },
      })
      const config = await tx.pDATestConfig.create({
        data: {
          providerId: provider.id,
          name: 'HTTP test PDA',
          durationMinutes: 120,
          price: 100,
          discountPercent: 10,
          isActive: true,
        },
      })
      await tx.pDAConfigTestCentre.create({
        data: { pdaConfigId: config.id, testCentreId: testCentre.id },
      })

      return {
        userId: user.id,
        email,
        walletId: wallet.id,
        customerId: customer.id,
        providerId: provider.id,
        configId: config.id,
        testCentreId: testCentre.id,
      }
    })
  }

  async function cleanupFixture() {
    if (!fixture) return

    const bookingIds = (await prisma.booking.findMany({
      where: { customerId: fixture.customerId },
      select: { id: true },
    })).map(booking => booking.id)
    const pdaBookingIds = (await prisma.pDATestBooking.findMany({
      where: { customerId: fixture.customerId },
      select: { id: true },
    })).map(booking => booking.id)

    await prisma.bookingIdempotencyKey.deleteMany({
      where: { key: { startsWith: `client-wallet:${fixture.userId}:` } },
    })
    if (bookingIds.length || pdaBookingIds.length) {
      await prisma.financialLedger.deleteMany({
        where: {
          OR: [
            { bookingId: { in: bookingIds } },
            { pdaBookingId: { in: pdaBookingIds } },
          ],
        },
      })
    }
    if (pdaBookingIds.length) {
      await prisma.pDARefund.deleteMany({ where: { pdaBookingId: { in: pdaBookingIds } } })
    }
    if (bookingIds.length) {
      await prisma.transaction.deleteMany({ where: { bookingId: { in: bookingIds } } })
    }
    await prisma.pDATestBooking.deleteMany({ where: { customerId: fixture.customerId } })
    await prisma.booking.deleteMany({ where: { customerId: fixture.customerId } })
    await prisma.walletTransaction.deleteMany({ where: { walletId: fixture.walletId } })
    await prisma.pDAConfigTestCentre.deleteMany({ where: { pdaConfigId: fixture.configId } })
    await prisma.pDATestConfig.deleteMany({ where: { id: fixture.configId } })
    await prisma.testCentre.deleteMany({ where: { id: fixture.testCentreId } })
    await prisma.customer.deleteMany({ where: { id: fixture.customerId } })
    await prisma.provider.deleteMany({ where: { id: fixture.providerId } })
    await prisma.clientWallet.deleteMany({ where: { id: fixture.walletId } })
    await prisma.user.deleteMany({ where: { id: fixture.userId } })
    fixture = null
  }

  function makeRequest(payload: unknown, key = randomUUID()) {
    return new NextRequest('http://localhost/api/client/bookings/create-bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      body: JSON.stringify(payload),
    })
  }

  function makeCancellationRequest(idempotencyKey: string) {
    return new NextRequest('http://localhost/api/client/pda-bookings/test-booking/cancel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ reason: 'PostgreSQL accounting test' }),
    })
  }

  function testTime(hoursFromNow: number) {
    const start = new Date(Date.now() + hoursFromNow * 3_600_000)
    start.setSeconds(0, 0)
    return {
      date: start.toISOString().slice(0, 10),
      time: start.toISOString().slice(11, 16),
    }
  }

  function lesson(date: string, time: string) {
    return {
      providerId: fixture!.providerId,
      instructorName: 'Checkout HTTP test instructor',
      date,
      time,
      duration: 1,
      price: 999,
      pickupLocation: '1 Test Road',
      service: '1 hour lesson',
    }
  }

  function pda(testDate: string, testTime: string) {
    return {
      providerId: fixture!.providerId,
      configId: fixture!.configId,
      testCentreId: fixture!.testCentreId,
      testDate,
      testTime,
      expectedPrice: 90,
    }
  }

  async function confirmedWalletTransactions() {
    return prisma.walletTransaction.findMany({
      where: { walletId: fixture!.walletId, status: 'CONFIRMED' },
    })
  }

  async function currentBalance() {
    const transactions = await confirmedWalletTransactions()
    const credits = transactions
      .filter(transaction => transaction.type === 'CREDIT')
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0)
    const debits = transactions
      .filter(transaction => transaction.type === 'DEBIT')
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0)
    return credits - debits
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    mocks.failNextLedgerWrite = false
    fixture = await createFixture()
    mocks.getServerSession.mockResolvedValue({
      user: { id: fixture.userId, email: fixture.email, name: 'Checkout HTTP test' },
    })
    mocks.getRateLimitIdentifier.mockReturnValue('checkout-http-test')
    mocks.checkRateLimit.mockResolvedValue({ success: true })
    mocks.calculateCommission.mockImplementation(async (
      _providerId: string,
      _customerId: string,
      amount: number,
    ) => ({
      totalAmount: amount,
      platformFee: Number((amount * 0.1).toFixed(2)),
      providerPayout: Number((amount * 0.9).toFixed(2)),
      commissionRate: 0.1,
      isFirstBooking: false,
    }))
    mocks.notifyBookingRequest.mockResolvedValue(undefined)
    mocks.notifyClientBookingConfirmed.mockResolvedValue(undefined)
    mocks.sendWalletLessonReceipt.mockResolvedValue(undefined)
  })

  afterEach(async () => {
    await cleanupFixture()
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('persists and debits a lesson-only checkout, including reporting rows', async () => {
    const response = await createWalletBooking(makeRequest({
      cart: [lesson('2099-01-02', '10:00')],
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.totalCost).toBe(60)
    expect(body.remainingBalance).toBe(940)

    const bookings = await prisma.booking.findMany({ where: { customerId: fixture!.customerId } })
    expect(bookings).toHaveLength(1)
    expect(bookings[0].duration).toBe(60)
    expect(bookings[0].price.toNumber()).toBe(60)
    expect(await prisma.pDATestBooking.count({ where: { customerId: fixture!.customerId } })).toBe(0)

    const debits = (await confirmedWalletTransactions()).filter(item => item.type === 'DEBIT')
    expect(debits).toHaveLength(1)
    expect(debits[0].amount.toNumber()).toBe(60)
    expect(await currentBalance()).toBe(940)
    expect(await prisma.transaction.count({ where: { bookingId: bookings[0].id } })).toBe(1)
    expect(await prisma.financialLedger.count({ where: { bookingId: bookings[0].id } })).toBe(3)
  })

  it('persists a PDA-only checkout at the configured price with one debit', async () => {
    const response = await createWalletBooking(makeRequest({
      cart: [],
      pdaBookings: [pda('2099-01-03', '10:00')],
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.totalCost).toBe(90)
    expect(body.remainingBalance).toBe(910)

    const bookings = await prisma.pDATestBooking.findMany({
      where: { customerId: fixture!.customerId },
    })
    expect(bookings).toHaveLength(1)
    expect(bookings[0].price.toNumber()).toBe(90)
    expect(bookings[0].status).toBe('CONFIRMED')
    expect(await prisma.booking.count({ where: { customerId: fixture!.customerId } })).toBe(0)

    const debits = (await confirmedWalletTransactions()).filter(item => item.type === 'DEBIT')
    expect(debits).toHaveLength(1)
    expect(debits[0].amount.toNumber()).toBe(90)
    expect(await currentBalance()).toBe(910)
    expect(await prisma.transaction.count({ where: { providerId: fixture!.providerId } })).toBe(0)
    expect(bookings[0].financialStatus).toBe('HELD')
    expect(bookings[0].walletTransactionId).toBe(debits[0].id)
    expect(await prisma.financialLedger.count({
      where: { pdaBookingId: bookings[0].id, entryType: 'PDA_FUNDS_HELD' },
    })).toBe(1)

    expect(await getPdaFundsHeldReconciliation(prisma)).toMatchObject({
      totalPaid: '90.00',
      totalRefunded: '0.00',
      expectedFundsHeld: '90.00',
      ledgerFundsHeld: '90.00',
      discrepancyCount: 0,
    })
  })

  it('commits a lesson and its associated PDA with exactly one combined debit', async () => {
    const response = await createWalletBooking(makeRequest({
      cart: [lesson('2099-01-04', '10:00')],
      pdaBookings: [{ ...pda('2099-01-05', '10:00'), parentBookingIndex: 0 }],
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.totalCost).toBe(150)
    expect(body.remainingBalance).toBe(850)

    const lessons = await prisma.booking.findMany({ where: { customerId: fixture!.customerId } })
    const tests = await prisma.pDATestBooking.findMany({
      where: { customerId: fixture!.customerId },
    })
    expect(lessons).toHaveLength(1)
    expect(tests).toHaveLength(1)
    expect(tests[0].price.toNumber()).toBe(90)
    expect(tests[0].parentBookingId).toBe(lessons[0].id)

    const debits = (await confirmedWalletTransactions()).filter(item => item.type === 'DEBIT')
    expect(debits).toHaveLength(1)
    expect(debits[0].amount.toNumber()).toBe(150)
    expect(await currentBalance()).toBe(850)
    expect(await prisma.transaction.count({ where: { bookingId: lessons[0].id } })).toBe(1)
    expect(await prisma.financialLedger.count({ where: { bookingId: lessons[0].id } })).toBe(3)
    expect(await prisma.transaction.count({ where: { bookingId: tests[0].id } })).toBe(0)
    expect(tests[0].financialStatus).toBe('HELD')
    expect(await prisma.financialLedger.count({
      where: { pdaBookingId: tests[0].id, entryType: 'PDA_FUNDS_HELD' },
    })).toBe(1)
  })

  it('replays concurrent HTTP submissions and rejects changed content for the same key', async () => {
    const key = randomUUID()
    const payload = { cart: [lesson('2099-01-06', '10:00')] }
    const [first, second] = await Promise.all([
      createWalletBooking(makeRequest(payload, key)),
      createWalletBooking(makeRequest(payload, key)),
    ])
    const [firstBody, secondBody] = await Promise.all([first.json(), second.json()])

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(firstBody).toEqual(secondBody)

    const retry = await createWalletBooking(makeRequest(payload, key))
    expect(retry.status).toBe(200)
    expect(await retry.json()).toEqual(firstBody)

    const changed = await createWalletBooking(makeRequest({
      cart: [lesson('2099-01-06', '11:00')],
    }, key))
    expect(changed.status).toBe(409)

    const bookings = await prisma.booking.findMany({ where: { customerId: fixture!.customerId } })
    expect(bookings).toHaveLength(1)
    const debits = (await confirmedWalletTransactions()).filter(item => item.type === 'DEBIT')
    expect(debits).toHaveLength(1)
    expect(debits[0].amount.toNumber()).toBe(60)
    expect(await currentBalance()).toBe(940)
    expect(await prisma.transaction.count({ where: { bookingId: bookings[0].id } })).toBe(1)
    expect(await prisma.financialLedger.count({ where: { bookingId: bookings[0].id } })).toBe(3)
  })

  it('recovers failed post-commit ledger writes on same-key retry without another debit', async () => {
    const key = randomUUID()
    const payload = { cart: [lesson('2099-01-07', '10:00')] }
    mocks.failNextLedgerWrite = true

    const first = await createWalletBooking(makeRequest(payload, key))
    expect(first.status).toBe(503)
    expect(await first.json()).toMatchObject({
      code: 'FINANCIAL_RECORDS_PENDING',
      checkoutStatus: 'COMMITTED',
      financialRecordsStatus: 'PENDING',
      fullyProcessed: false,
    })
    expect(ledgerOperations.recordBookingPayment).toHaveBeenCalledTimes(1)

    const retry = await createWalletBooking(makeRequest(payload, key))
    expect(retry.status).toBe(200)
    expect(await retry.json()).toMatchObject({ success: true, totalCost: 60 })
    expect(ledgerOperations.recordBookingPayment).toHaveBeenCalledTimes(2)

    const [booking] = await prisma.booking.findMany({
      where: { customerId: fixture!.customerId },
    })
    expect(await prisma.walletTransaction.count({
      where: { walletId: fixture!.walletId, type: 'DEBIT', status: 'CONFIRMED' },
    })).toBe(1)
    expect(await prisma.financialLedger.count({ where: { bookingId: booking.id } })).toBe(3)
    expect(await prisma.transaction.count({ where: { bookingId: booking.id } })).toBe(1)
    const idempotency = await prisma.bookingIdempotencyKey.findFirstOrThrow({
      where: { key: { startsWith: `client-wallet:${fixture!.userId}:` } },
    })
    expect(idempotency.response).toMatchObject({ financialRecordsStatus: 'COMPLETED' })
  })

  it('refunds PDA held funds in full and replays the refund without a second credit', async () => {
    const bookingResponse = await createWalletBooking(makeRequest({
      cart: [],
      pdaBookings: [pda('2099-01-08', '10:00')],
    }))
    const bookingBody = await bookingResponse.json()
    const bookingId = bookingBody.pdaBookings[0].id
    const key = randomUUID()

    const first = await cancelPdaBookingHttp(makeCancellationRequest(key), { params: { id: bookingId } })
    expect(first.status).toBe(200)
    expect(await first.json()).toMatchObject({
      bookingStatus: 'CANCELLED',
      financialStatus: 'REFUNDED',
      refundAmount: 90,
      replayed: false,
    })
    expect(await currentBalance()).toBe(1000)

    const replay = await cancelPdaBookingHttp(makeCancellationRequest(key), { params: { id: bookingId } })
    expect(replay.status).toBe(200)
    expect(await replay.json()).toMatchObject({ refundAmount: 90, replayed: true })
    expect(await prisma.walletTransaction.count({
      where: { walletId: fixture!.walletId, type: 'CREDIT', description: { startsWith: 'PDA cancellation refund' } },
    })).toBe(1)
    expect(await prisma.financialLedger.count({
      where: { pdaBookingId: bookingId, entryType: 'PDA_REFUND' },
    })).toBe(1)
    expect(await getPdaFundsHeldReconciliation(prisma)).toMatchObject({
      totalPaid: '90.00',
      totalRefunded: '90.00',
      expectedFundsHeld: '0.00',
      ledgerFundsHeld: '0.00',
      discrepancyCount: 0,
    })
  })

  it('records a policy-based partial PDA cancellation refund and reconciles the remaining held amount', async () => {
    const settings = await prisma.platformSettings.findFirst({
      select: { lateCancellationWindowHours: true },
    })
    const lateWindowHours = Number(settings?.lateCancellationWindowHours ?? 24)
    const testStart = testTime(lateWindowHours * 1.5)
    const bookingResponse = await createWalletBooking(makeRequest({
      cart: [],
      pdaBookings: [pda(testStart.date, testStart.time)],
    }))
    const bookingBody = await bookingResponse.json()
    const bookingId = bookingBody.pdaBookings[0].id

    const response = await cancelPdaBookingHttp(
      makeCancellationRequest(randomUUID()),
      { params: { id: bookingId } },
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      bookingStatus: 'CANCELLED',
      financialStatus: 'PARTIALLY_REFUNDED',
      refundAmount: 45,
    })
    expect(await currentBalance()).toBe(955)
    expect(await getPdaFundsHeldReconciliation(prisma)).toMatchObject({
      totalPaid: '90.00',
      totalRefunded: '45.00',
      expectedFundsHeld: '45.00',
      ledgerFundsHeld: '45.00',
      discrepancyCount: 0,
    })
  })

  it('cancels a PDA booking inside the late window without refunding or releasing held funds', async () => {
    const settings = await prisma.platformSettings.findFirst({
      select: { lateCancellationWindowHours: true },
    })
    const lateWindowHours = Number(settings?.lateCancellationWindowHours ?? 24)
    const testStart = testTime(lateWindowHours / 2)
    const bookingResponse = await createWalletBooking(makeRequest({
      cart: [],
      pdaBookings: [pda(testStart.date, testStart.time)],
    }))
    const bookingBody = await bookingResponse.json()
    const bookingId = bookingBody.pdaBookings[0].id

    const response = await cancelPdaBookingHttp(
      makeCancellationRequest(randomUUID()),
      { params: { id: bookingId } },
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      bookingStatus: 'CANCELLED',
      financialStatus: 'HELD',
      refundAmount: 0,
    })
    expect(await currentBalance()).toBe(910)
    expect(await prisma.pDARefund.count({ where: { pdaBookingId: bookingId, status: 'NO_REFUND' } })).toBe(1)
    expect(await getPdaFundsHeldReconciliation(prisma)).toMatchObject({
      totalPaid: '90.00',
      totalRefunded: '0.00',
      expectedFundsHeld: '90.00',
      ledgerFundsHeld: '90.00',
      discrepancyCount: 0,
    })
  })
})
