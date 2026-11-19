import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getWalletBalance: vi.fn(),
  checkDoubleBooking: vi.fn(),
  checkProviderEligible: vi.fn(),
  getRateLimitIdentifier: vi.fn(),
  checkRateLimit: vi.fn(),
  userFindUnique: vi.fn(),
  customerFindFirst: vi.fn(),
  bookingCreate: vi.fn(),
  pdaConfigFindUnique: vi.fn(),
  pdaBookingFindFirst: vi.fn(),
  pdaBookingFindMany: vi.fn(),
  pdaBookingCreate: vi.fn(),
  transaction: vi.fn(),
  walletFindUnique: vi.fn(),
  transactionCreate: vi.fn(),
  calculateCommission: vi.fn(),
  notifyBookingRequest: vi.fn(),
  notifyClientBookingConfirmed: vi.fn(),
  sendWalletLessonReceipt: vi.fn(),
  recordBookingPayment: vi.fn(),
  txWalletFindUnique: vi.fn(),
  txBookingFindFirst: vi.fn(),
  txBookingCreate: vi.fn(),
  txPdaBookingUpdateMany: vi.fn(),
  txWalletTransactionCreate: vi.fn(),
  idempotencyFindUnique: vi.fn(),
  txIdempotencyCreate: vi.fn(),
  txIdempotencyUpdate: vi.fn(),
  completeWalletBookingFinancialRecords: vi.fn(),
}))

vi.mock('next-auth/next', () => ({
  getServerSession: mocks.getServerSession,
}))

vi.mock('next-auth', () => ({
  getServerSession: mocks.getServerSession,
}))

vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/services/wallet-helpers', () => ({
  getWalletBalance: mocks.getWalletBalance,
}))
vi.mock('@/lib/services/availability', () => ({
  availabilityService: { checkDoubleBooking: mocks.checkDoubleBooking },
}))
vi.mock('@/lib/booking/checkProviderEligible', () => ({
  checkProviderEligible: mocks.checkProviderEligible,
}))
vi.mock('@/lib/ratelimit', () => ({
  bookingRateLimit: {},
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
vi.mock('@/lib/services/ledger-operations', () => ({
  recordBookingPayment: mocks.recordBookingPayment,
}))
vi.mock('@/lib/services/wallet-booking-post-commit', () => ({
  completeWalletBookingFinancialRecords: mocks.completeWalletBookingFinancialRecords,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    customer: { findFirst: mocks.customerFindFirst },
    booking: { create: mocks.bookingCreate },
    pDATestConfig: { findUnique: mocks.pdaConfigFindUnique },
    pDATestBooking: {
      findFirst: mocks.pdaBookingFindFirst,
      create: mocks.pdaBookingCreate,
    },
    clientWallet: { findUnique: mocks.walletFindUnique },
    bookingIdempotencyKey: { findUnique: mocks.idempotencyFindUnique },
    transaction: { create: mocks.transactionCreate },
    $transaction: mocks.transaction,
  },
}))

import { POST as createCombinedBooking } from '@/app/api/bookings/combined/route'
import { POST as createPdaBooking } from '@/app/api/pda-bookings/route'
import { POST as createWalletBooking } from '@/app/api/client/bookings/create-bulk/route'
import { createWalletBookingRequestFingerprint } from '@/lib/services/wallet-booking'

const customer = { id: 'customer-1', userId: 'user-1', name: 'Client', phone: '0400000000' }

function request(path: string, body: unknown, idempotencyKey = 'client-test-key') {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(body),
  })
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  mocks.getServerSession.mockResolvedValue({ user: { id: 'user-1', email: 'client@example.com' } })
  mocks.getWalletBalance.mockResolvedValue({ balance: 500 })
  mocks.checkDoubleBooking.mockResolvedValue(false)
  mocks.checkProviderEligible.mockResolvedValue({
    allowed: true,
    provider: { id: 'provider-1', hourlyRate: 60 },
  })

  mocks.getRateLimitIdentifier.mockReturnValue('client-test')
  mocks.checkRateLimit.mockResolvedValue({ success: true })
  mocks.userFindUnique.mockResolvedValue({ id: 'user-1', email: 'client@example.com', name: 'Client' })
  mocks.customerFindFirst.mockImplementation(async (args: { where?: { userId?: string; id?: string } }) =>
    args.where?.userId === 'user-1' ? customer : null,
  )
  mocks.bookingCreate.mockResolvedValue({
    id: 'booking-1',
    providerId: 'provider-1',
    customerId: 'customer-1',
    startTime: new Date('2099-01-02T10:00:00.000Z'),
    endTime: new Date('2099-01-02T11:00:00.000Z'),
    duration: 60,
    price: 60,
    status: 'PENDING',
  })
  mocks.pdaConfigFindUnique.mockResolvedValue({
    id: 'config-1',
    providerId: 'provider-1',
    name: 'PDA test',
    durationMinutes: 165,
    price: 199.99,
    discountPercent: 15,
    includes: {},
    isActive: true,
    testCentres: [{
      testCentreId: 'centre-1',
      testCentre: { id: 'centre-1', name: 'Test Centre', address: '1 Test Rd' },
    }],
    provider: { id: 'provider-1', name: 'Instructor' },
  })
  mocks.pdaBookingFindFirst.mockResolvedValue(null)
  mocks.pdaBookingFindMany.mockResolvedValue([])
  mocks.pdaBookingCreate.mockResolvedValue({
    id: 'pda-1',
    provider: { id: 'provider-1', name: 'Instructor' },
    testCentre: { id: 'centre-1', name: 'Test Centre' },
    testDate: new Date('2099-01-02T10:00:00.000Z'),
    testTime: '10:00',
    price: 169.99,
    discountPercent: 15,
    status: 'PENDING_PAYMENT',
  })
  const wallet = {
    id: 'wallet-1',
    transactions: [{ type: 'CREDIT', amount: 500, expiresAt: null }],
  }
  mocks.walletFindUnique.mockResolvedValue(wallet)
  mocks.transactionCreate.mockResolvedValue({})
  mocks.calculateCommission.mockResolvedValue({
    totalAmount: 60,
    platformFee: 6,
    providerPayout: 54,
    commissionRate: 0.1,
    isFirstBooking: false,
  })
  mocks.notifyBookingRequest.mockResolvedValue(undefined)
  mocks.notifyClientBookingConfirmed.mockResolvedValue(undefined)
  mocks.sendWalletLessonReceipt.mockResolvedValue(undefined)
  mocks.recordBookingPayment.mockResolvedValue(undefined)
  mocks.txWalletFindUnique.mockResolvedValue(wallet)
  mocks.txBookingFindFirst.mockResolvedValue(null)
  mocks.txBookingCreate.mockResolvedValue({
    id: 'wallet-booking-1',
    providerId: 'provider-1',
    customerId: 'customer-1',
    startTime: new Date('2099-01-02T10:00:00.000Z'),
    endTime: new Date('2099-01-02T11:00:00.000Z'),
    duration: 60,
    price: 60,
    status: 'CONFIRMED',
  })
  mocks.txPdaBookingUpdateMany.mockResolvedValue({ count: 1 })
  mocks.txWalletTransactionCreate.mockResolvedValue({ id: 'wallet-transaction-1' })
  mocks.idempotencyFindUnique.mockResolvedValue(null)
  mocks.txIdempotencyCreate.mockResolvedValue({})
  mocks.txIdempotencyUpdate.mockResolvedValue({})
  mocks.completeWalletBookingFinancialRecords.mockResolvedValue(undefined)
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
    clientWallet: { findUnique: mocks.txWalletFindUnique },
    bookingIdempotencyKey: {
      create: mocks.txIdempotencyCreate,
      update: mocks.txIdempotencyUpdate,
    },
    booking: { findFirst: mocks.txBookingFindFirst, create: mocks.txBookingCreate },
    pDATestBooking: {
      findFirst: mocks.pdaBookingFindFirst,
      findMany: mocks.pdaBookingFindMany,
      create: mocks.pdaBookingCreate,
      updateMany: mocks.txPdaBookingUpdateMany,
    },
    walletTransaction: { create: mocks.txWalletTransactionCreate },
  }))
})

describe('client wallet booking flow with mocked Prisma', () => {
  it("uses the authenticated user's Customer record for combined bookings", async () => {
    const response = await createCombinedBooking(request('/api/bookings/combined', {
      customerId: 'user-1',
      providerId: 'provider-1',
      lesson: {
        startTime: '2099-01-02T10:00:00.000Z',
        duration: 60,
      },
    }))

    expect(response.status).toBe(201)
    expect(mocks.customerFindFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { id: 'desc' },
    })
    expect(mocks.bookingCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ customerId: 'customer-1' }),
    })
  })
  it('derives the Customer record when PDA request omits customerId', async () => {
    const response = await createPdaBooking(request('/api/pda-bookings', {
      configId: 'config-1',
      testCentreId: 'centre-1',
      testDate: '2099-01-02',
      testTime: '10:00',
    }))

    expect(response.status).toBe(201)
    expect(mocks.customerFindFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { id: 'desc' },
    })
    expect(mocks.pdaBookingCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ customerId: 'customer-1' }),
      include: expect.any(Object),
    })
  })

  it('charges a normal lesson through the wallet transaction', async () => {
    const response = await createWalletBooking(request('/api/client/bookings/create-bulk', {
      cart: [{
        providerId: 'provider-1',
        instructorName: 'Instructor',
        date: '2099-01-02',
        time: '10:00',
        duration: 1,
        price: 60,
        pickupLocation: '1 Test Rd',
        service: '1h Lesson',
      }],
    }))

    expect(response.status).toBe(200)
    expect((await response.json()).totalCost).toBe(60)
    expect(mocks.txBookingCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        duration: 60,
        price: 60,
        customer: { connect: { id: 'customer-1' } },
      }),
    })
    expect(mocks.pdaBookingCreate).not.toHaveBeenCalled()
    expect(mocks.txWalletTransactionCreate).toHaveBeenCalledTimes(1)
    expect(Number(mocks.txWalletTransactionCreate.mock.calls[0][0].data.amount)).toBe(60)
    expect(mocks.txIdempotencyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        key: 'client-wallet:user-1:client-test-key',
        bookingId: '__pending__',
      }),
    })
    expect(mocks.txIdempotencyUpdate).toHaveBeenCalledWith({
      where: { key: 'client-wallet:user-1:client-test-key' },
      data: expect.objectContaining({
        bookingId: 'wallet-booking-1',
        response: expect.objectContaining({
          requestFingerprint: expect.any(String),
          body: expect.objectContaining({ totalCost: 60 }),
        }),
      }),
    })
  })

  it('replays a completed checkout without opening another transaction', async () => {
    const body = {
      cart: [{
        providerId: 'provider-1',
        instructorName: 'Instructor',
        date: '2099-01-02',
        time: '10:00',
        duration: 1,
        price: 60,
      }],
    }
    const storedResponse = {
      success: true,
      bookings: [{ id: 'wallet-booking-1', date: '2099-01-02', time: '10:00', instructor: 'Instructor' }],
      pdaBookings: [],
      totalCost: 60,
      remainingBalance: 440,
    }
    const storedRecord = {
      email: 'client@example.com',
      bookingId: 'wallet-booking-1',
      response: {
        requestFingerprint: createWalletBookingRequestFingerprint({
          cart: body.cart,
          pdaBookings: [],
        }),
        body: storedResponse,
      },
    }
    mocks.idempotencyFindUnique.mockResolvedValue(storedRecord)

    const response = await createWalletBooking(
      request('/api/client/bookings/create-bulk', body, 'repeat-key'),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(storedResponse)
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.txWalletTransactionCreate).not.toHaveBeenCalled()
  })

  it('returns committed pending status after ledger failure and retries financial recovery without a second debit', async () => {
    const body = {
      cart: [{
        providerId: 'provider-1',
        instructorName: 'Instructor',
        date: '2099-01-02',
        time: '10:00',
        duration: 1,
        price: 60,
      }],
    }
    const storedBody = {
      success: true,
      bookings: [{ id: 'wallet-booking-1', date: '2099-01-02', time: '10:00', instructor: 'Instructor' }],
      pdaBookings: [],
      totalCost: 60,
      remainingBalance: 440,
    }
    const idempotencyRecord = {
      email: 'client@example.com',
      bookingId: 'wallet-booking-1',
      response: {
        requestFingerprint: createWalletBookingRequestFingerprint({
          cart: body.cart,
          pdaBookings: [],
        }),
        body: storedBody,
        walletTransactionId: 'wallet-transaction-1',
        financialRecordsStatus: 'PENDING',
      },
    }
    mocks.idempotencyFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(idempotencyRecord)
    mocks.completeWalletBookingFinancialRecords
      .mockRejectedValueOnce(new Error('simulated ledger outage'))

    const first = await createWalletBooking(request(
      '/api/client/bookings/create-bulk',
      body,
      'recover-key',
    ))
    expect(first.status).toBe(503)
    expect(await first.json()).toMatchObject({
      code: 'FINANCIAL_RECORDS_PENDING',
      checkoutStatus: 'COMMITTED',
      financialRecordsStatus: 'PENDING',
      fullyProcessed: false,
    })

    const retry = await createWalletBooking(request(
      '/api/client/bookings/create-bulk',
      body,
      'recover-key',
    ))
    expect(retry.status).toBe(200)
    expect(await retry.json()).toEqual(storedBody)
    expect(mocks.completeWalletBookingFinancialRecords).toHaveBeenCalledTimes(2)
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
    expect(mocks.txWalletTransactionCreate).toHaveBeenCalledTimes(1)
  })

  it('replays the winner when a concurrent request loses the idempotency-key claim', async () => {
    const body = {
      cart: [{
        providerId: 'provider-1',
        instructorName: 'Instructor',
        date: '2099-01-02',
        time: '10:00',
        duration: 1,
        price: 60,
      }],
    }
    const storedResponse = {
      success: true,
      bookings: [{ id: 'wallet-booking-1', date: '2099-01-02', time: '10:00', instructor: 'Instructor' }],
      pdaBookings: [],
      totalCost: 60,
      remainingBalance: 440,
    }
    const storedRecord = {
      email: 'client@example.com',
      bookingId: 'wallet-booking-1',
      response: {
        requestFingerprint: createWalletBookingRequestFingerprint({
          cart: body.cart,
          pdaBookings: [],
        }),
        body: storedResponse,
      },
    }
    mocks.idempotencyFindUnique.mockResolvedValue(storedRecord)
    mocks.idempotencyFindUnique.mockImplementationOnce(async () => null)
    mocks.txIdempotencyCreate.mockRejectedValue({ code: 'P2002' })

    const response = await createWalletBooking(
      request('/api/client/bookings/create-bulk', body, 'concurrent-key'),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(storedResponse)
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
    expect(mocks.txBookingCreate).not.toHaveBeenCalled()
    expect(mocks.txWalletTransactionCreate).not.toHaveBeenCalled()
  })

  it('rejects reuse of a checkout key with a different payload', async () => {
    mocks.idempotencyFindUnique.mockResolvedValue({
      email: 'client@example.com',
      bookingId: 'wallet-booking-1',
      response: {
        requestFingerprint: 'different-payload',
        body: {
          success: true,
          bookings: [],
          pdaBookings: [],
          totalCost: 60,
          remainingBalance: 440,
        },
      },
    })

    const response = await createWalletBooking(request(
      '/api/client/bookings/create-bulk',
      { cart: [{
        providerId: 'provider-1',
        instructorName: 'Instructor',
        date: '2099-01-02',
        time: '10:00',
        duration: 1,
        price: 60,
      }] },
      'reused-key',
    ))

    expect(response.status).toBe(409)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('charges lessons and the instructor-priced PDA once and records both', async () => {
    const response = await createWalletBooking(request('/api/client/bookings/create-bulk', {
      cart: [{
        providerId: 'provider-1',
        instructorName: 'Instructor',
        date: '2099-01-02',
        time: '10:00',
        duration: 1,
        price: 60,
        pickupLocation: '1 Test Rd',
        service: '1h Lesson',
      }],
      pdaBookings: [{
        providerId: 'provider-1',
        configId: 'config-1',
        testCentreId: 'centre-1',
        testDate: '2099-01-02',
        testTime: '12:00',
        expectedPrice: 169.99,
        parentBookingIndex: 0,
      }],
    }))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.totalCost).toBe(229.99)
    expect(mocks.txBookingCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        duration: 60,
        price: 60,
        customer: { connect: { id: 'customer-1' } },
      }),
    })
    expect(mocks.transaction.mock.calls[0][1]).toEqual({
      isolationLevel: 'Serializable',
      timeout: 15000,
    })
    expect(mocks.pdaBookingCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        providerId: 'provider-1',
        customerId: 'customer-1',
        configId: 'config-1',
        price: 169.99,
        discountPercent: 15,
        status: 'CONFIRMED',
        parentBookingId: 'wallet-booking-1',
      }),
    })
    expect(mocks.txWalletTransactionCreate).toHaveBeenCalledTimes(1)
    const combinedDebit = mocks.txWalletTransactionCreate.mock.calls[0][0].data
    expect(combinedDebit.type).toBe('DEBIT')
    expect(Number(combinedDebit.amount)).toBe(229.99)
    expect(combinedDebit.status).toBe('CONFIRMED')
  })

  it('books a standalone PDA with one wallet debit and no lesson booking', async () => {
    const response = await createWalletBooking(request('/api/client/bookings/create-bulk', {
      cart: [],
      pdaBookings: [{
        providerId: 'provider-1',
        configId: 'config-1',
        testCentreId: 'centre-1',
        testDate: '2099-01-02',
        testTime: '10:00',
        expectedPrice: 169.99,
      }],
    }))

    expect(response.status).toBe(200)
    expect((await response.json()).totalCost).toBe(169.99)
    expect(mocks.txBookingCreate).not.toHaveBeenCalled()
    expect(mocks.pdaBookingCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerId: 'customer-1',
        price: 169.99,
        status: 'CONFIRMED',
        parentBookingId: null,
      }),
    })
    expect(mocks.txWalletTransactionCreate).toHaveBeenCalledTimes(1)
    const pdaDebit = mocks.txWalletTransactionCreate.mock.calls[0][0].data
    expect(pdaDebit.type).toBe('DEBIT')
    expect(Number(pdaDebit.amount)).toBe(169.99)
    expect(pdaDebit.status).toBe('CONFIRMED')
  })

  it('rejects a PDA time that is past in the provider timezone', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-19T17:00:00.000Z'))

    const response = await createWalletBooking(request('/api/client/bookings/create-bulk', {
      cart: [],
      pdaBookings: [{
        providerId: 'provider-1',
        configId: 'config-1',
        testCentreId: 'centre-1',
        testDate: '2026-11-20',
        testTime: '00:30',
      }],
    }))

    expect(response.status).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.pdaBookingCreate).not.toHaveBeenCalled()
  })

  it('rejects a PDA linked to a missing lesson before opening a transaction', async () => {
    const response = await createWalletBooking(request('/api/client/bookings/create-bulk', {
      cart: [],
      pdaBookings: [{
        providerId: 'provider-1',
        configId: 'config-1',
        testCentreId: 'centre-1',
        testDate: '2099-01-02',
        testTime: '10:00',
        parentBookingIndex: 0,
      }],
    }))

    expect(response.status).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('creates no booking or debit when the serializable balance recheck fails', async () => {
    mocks.txWalletFindUnique.mockResolvedValue({
      id: 'wallet-1',
      transactions: [{ type: 'CREDIT', amount: 100, expiresAt: null }],
    })

    const response = await createWalletBooking(request('/api/client/bookings/create-bulk', {
      cart: [{
        providerId: 'provider-1',
        instructorName: 'Instructor',
        date: '2099-01-02',
        time: '10:00',
        duration: 1,
        price: 60,
        pdaTest: {
          configId: 'config-1',
          testCentreId: 'centre-1',
          testDate: '2099-01-02',
          testTime: '12:00',
          expectedPrice: 169.99,
        },
      }],
    }))

    expect(response.status).toBe(400)
    expect(mocks.txBookingCreate).not.toHaveBeenCalled()
    expect(mocks.pdaBookingCreate).not.toHaveBeenCalled()
    expect(mocks.txWalletTransactionCreate).not.toHaveBeenCalled()
  })

  it('does not charge a stale PDA price shown before checkout', async () => {
    const response = await createWalletBooking(request('/api/client/bookings/create-bulk', {
      cart: [],
      pdaBookings: [{
        providerId: 'provider-1',
        configId: 'config-1',
        testCentreId: 'centre-1',
        testDate: '2099-01-02',
        testTime: '10:00',
        expectedPrice: 150,
      }],
    }))

    expect(response.status).toBe(409)
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.txWalletTransactionCreate).not.toHaveBeenCalled()
  })

  it('rejects a conflicting PDA slot without creating a booking or debit', async () => {
    mocks.pdaBookingFindMany.mockResolvedValue([{
      testTime: '10:30',
      config: { durationMinutes: 165 },
    }])

    const response = await createWalletBooking(request('/api/client/bookings/create-bulk', {
      cart: [],
      pdaBookings: [{
        providerId: 'provider-1',
        configId: 'config-1',
        testCentreId: 'centre-1',
        testDate: '2099-01-02',
        testTime: '10:00',
        expectedPrice: 169.99,
      }],
    }))

    expect(response.status).toBe(409)
    expect(mocks.pdaBookingCreate).not.toHaveBeenCalled()
    expect(mocks.txWalletTransactionCreate).not.toHaveBeenCalled()
  })
})
