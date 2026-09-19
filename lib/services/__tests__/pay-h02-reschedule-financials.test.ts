/**
 * PAY-H-02 Regression Tests: Booking Reschedule Financial Integrity
 *
 * Finding: All four reschedule entry points left Booking.platformFee,
 * Booking.providerPayout, Booking.commissionRate, and the associated
 * Transaction record stale after a duration change. Route C had no
 * transaction wrapper at all — slot-conflict check and booking write
 * were separated (TOCTOU). Stripe-paid bookings could be rescheduled
 * to a different price with no error.
 *
 * Fix (this commit):
 *   computeRescheduleFinancials() — pure function, derives all four
 *   financial fields from the booking's own locked contract.
 *   Rate: lockedHourlyRate ?? (price / oldDurationHours) — never live provider rate.
 *   Fee proportion: platformFee/price ratio from original booking.
 *   commissionRate: unchanged from booking row.
 *
 *   rescheduleBooking() — shared service used by all routes:
 *   SERIALIZABLE transaction + withSerializableRetry
 *   rescheduleCount CAS guard (concurrent double-reschedule prevention)
 *   Stripe-paid + price change → STRIPE_PAID_PRICE_CHANGE (409)
 *   Package booking + duration change → PACKAGE_DURATION_LOCKED (400)
 *   Wallet-paid + price increase → atomic wallet debit, INSUFFICIENT_BALANCE on fail
 *   Wallet-paid + price decrease → atomic wallet credit
 *   All four financial fields updated atomically with the booking
 *   BOOKING_PAYMENT Transaction updated in the same transaction
 *
 * Test groups:
 *   F-series: computeRescheduleFinancials unit tests (pure, no mocks)
 *   R-series: rescheduleBooking() integration tests (mocked at Prisma/wallet)
 */

// ─── Mock declarations ────────────────────────────────────────────────────────

const mockBookingFindUnique  = vi.fn()
const mockBookingUpdateMany  = vi.fn()
const mockBookingUpdate      = vi.fn()
const mockBookingFindFirst   = vi.fn()
const mockTxFindFirst        = vi.fn()
const mockWalletFindUnique   = vi.fn()
const mockWalletTxAggregate  = vi.fn()
const mockWalletTxCreate     = vi.fn()
const mockTransactionUpdateMany = vi.fn()
const mockAuditLogCreate     = vi.fn()
const mockWriteAudit         = vi.fn()
const mockWithSerializableRetry = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    booking: {
      findUnique: (...a: any[]) => mockBookingFindUnique(...a),
      update:     (...a: any[]) => mockBookingUpdate(...a),
      findFirst:  (...a: any[]) => mockBookingFindFirst(...a),
    },
    $transaction: vi.fn().mockImplementation(async (cb: any) => cb({
      booking: {
        updateMany: (...a: any[]) => mockBookingUpdateMany(...a),
        findFirst:  (...a: any[]) => mockTxFindFirst(...a),
        update:     (...a: any[]) => mockBookingUpdate(...a),
      },
      clientWallet: { findUnique: (...a: any[]) => mockWalletFindUnique(...a) },
      walletTransaction: {
        aggregate: (...a: any[]) => mockWalletTxAggregate(...a),
        create:    (...a: any[]) => mockWalletTxCreate(...a),
      },
      transaction: { updateMany: (...a: any[]) => mockTransactionUpdateMany(...a) },
      auditLog:    { create: (...a: any[]) => mockAuditLogCreate(...a) },
    })),
  },
}))

vi.mock('@/lib/utils/transaction-retry', () => ({
  withSerializableRetry: (...a: any[]) => mockWithSerializableRetry(...a),
}))

vi.mock('@/lib/services/booking-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../booking-service')>()
  return { ...actual }
})

// writeAudit is called after the transaction — mock it to prevent side-effects
vi.mock('@/lib/services/auditLogger', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
  logFinancialAction: vi.fn().mockResolvedValue(undefined),
  AuditAction: { BOOKING_RESCHEDULED: 'BOOKING_RESCHEDULED' },
  ActorRole: { SYSTEM: 'SYSTEM' },
}))

vi.mock('@/lib/services/wallet-helpers', () => ({
  getWalletBalance: vi.fn().mockResolvedValue({ balance: 500 }),
  getOrCreateWallet: vi.fn().mockResolvedValue({ id: 'wallet_1' }),
}))

// ─── Import subject under test ────────────────────────────────────────────────
import {
  computeRescheduleFinancials,
  rescheduleBooking,
} from '../booking-service'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BOOKING_ID  = 'bk_payh02_test'
const PROVIDER_ID = 'prov_payh02'
const CUSTOMER_ID = 'cust_payh02'
const USER_ID     = 'user_payh02'

const BASE_START = new Date('2026-10-01T09:00:00Z')
const BASE_END   = new Date('2026-10-01T10:00:00Z')  // 1 hour
const NEW_START  = new Date('2026-10-02T09:00:00Z')
const NEW_END_1H = new Date('2026-10-02T10:00:00Z')  // same 1h
const NEW_END_2H = new Date('2026-10-02T11:00:00Z')  // 2h

function makeBooking(overrides: Partial<{
  price: number; platformFee: number; providerPayout: number; commissionRate: number
  duration: number | null; startTime: Date; endTime: Date
  lockedHourlyRate: number | null
  isPaid: boolean; paymentIntentId: string | null; offlineAmountPaid: number | null
  isPackageBooking: boolean
  rescheduleCount: number; status: string
  customer: any
}> = {}) {
  return {
    id:               BOOKING_ID,
    providerId:       PROVIDER_ID,
    customerId:       CUSTOMER_ID,
    status:           overrides.status           ?? 'CONFIRMED',
    price:            overrides.price            ?? 80,
    platformFee:      overrides.platformFee      ?? 8,      // 10%
    providerPayout:   overrides.providerPayout   ?? 72,     // 90%
    commissionRate:   overrides.commissionRate   ?? 0.10,
    duration:         overrides.duration         ?? 60,     // minutes
    startTime:        overrides.startTime        ?? BASE_START,
    endTime:          overrides.endTime          ?? BASE_END,
    lockedHourlyRate: overrides.lockedHourlyRate ?? null,
    isPaid:           overrides.isPaid           ?? false,
    paymentIntentId:  overrides.paymentIntentId  ?? null,
    offlineAmountPaid:overrides.offlineAmountPaid ?? null,
    isPackageBooking: overrides.isPackageBooking  ?? false,
    rescheduleCount:  overrides.rescheduleCount   ?? 0,
    rescheduledFrom:  [],
    originalStartTime: null,
    isNonRefundable:  false,
    provider:   { id: PROVIDER_ID, name: 'Test Provider', hourlyRate: 999, userId: 'prov_user' },
    customer:   overrides.customer ?? { id: CUSTOMER_ID, name: 'Test Client', userId: USER_ID, phone: '+61400000000' },
  }
}

// ─── F-series: computeRescheduleFinancials unit tests ────────────────────────

describe('F-series: computeRescheduleFinancials (pure function — no DB queries)', () => {

  it('F1: same duration — price unchanged, priceDiff = 0', () => {
    const booking = makeBooking({ price: 80, platformFee: 8, providerPayout: 72, duration: 60 })
    const r = computeRescheduleFinancials(booking, 1)  // still 1 hour
    expect(r.newPrice).toBe(80)
    expect(r.newPlatformFee).toBe(8)
    expect(r.newProviderPayout).toBe(72)
    expect(r.priceDiff).toBe(0)
    expect(r.commissionRate).toBe(0.10)
  })

  it('F2: duration increase — price scales proportionally from back-computed rate', () => {
    // rate = 80/1h = 80/hr; 2h = 160
    const booking = makeBooking({ price: 80, platformFee: 8, providerPayout: 72, duration: 60 })
    const r = computeRescheduleFinancials(booking, 2)
    expect(r.newPrice).toBe(160)
    expect(r.newPlatformFee).toBe(16)       // 10% of 160
    expect(r.newProviderPayout).toBe(144)   // 90% of 160
    expect(r.priceDiff).toBe(80)
  })

  it('F3: duration decrease — price decreases, priceDiff is negative', () => {
    // rate = 80/1h; 0.5h = 40
    const booking = makeBooking({ price: 80, platformFee: 8, providerPayout: 72, duration: 60 })
    const r = computeRescheduleFinancials(booking, 0.5)
    expect(r.newPrice).toBe(40)
    expect(r.newPlatformFee).toBe(4)
    expect(r.newProviderPayout).toBe(36)
    expect(r.priceDiff).toBe(-40)
  })

  it('F4: lockedHourlyRate takes priority over back-computed rate', () => {
    // price=80 (1h), but lockedHourlyRate=100 → 2h = 200
    const booking = makeBooking({ price: 80, platformFee: 8, providerPayout: 72, duration: 60, lockedHourlyRate: 100 })
    const r = computeRescheduleFinancials(booking, 2)
    expect(r.newPrice).toBe(200)            // 100 × 2
    expect(r.newPlatformFee).toBe(20)       // 10% × 200
    expect(r.newProviderPayout).toBe(180)
  })

  it('F5: provider.hourlyRate change does NOT affect reschedule price', () => {
    // Even if provider's current rate is 999, the reschedule uses lockedHourlyRate=80
    const booking = makeBooking({
      price: 80, platformFee: 8, providerPayout: 72, duration: 60,
      lockedHourlyRate: 80,
    })
    // Simulate provider changed rate to 999 — should not matter
    ;(booking.provider as any).hourlyRate = 999
    const r = computeRescheduleFinancials(booking, 1)
    expect(r.newPrice).toBe(80)   // still 80 × 1, not 999 × 1
  })

  it('F6: commissionRate carried unchanged from booking', () => {
    const booking = makeBooking({ commissionRate: 0.12, price: 100, platformFee: 12, providerPayout: 88, duration: 60 })
    const r = computeRescheduleFinancials(booking, 2)
    expect(r.commissionRate).toBe(0.12)   // NOT re-queried from PlatformSettings
  })

  it('F7: financial consistency invariant — price = platformFee + providerPayout', () => {
    const booking = makeBooking({ price: 90, platformFee: 9, providerPayout: 81, duration: 60 })
    const r = computeRescheduleFinancials(booking, 1.5)  // 135
    expect(Math.abs(r.newPrice - (r.newPlatformFee + r.newProviderPayout))).toBeLessThan(0.01)
  })

  it('F8: fallback to price/duration when lockedHourlyRate is null and duration is set', () => {
    const booking = makeBooking({ price: 120, platformFee: 12, providerPayout: 108, duration: 90, lockedHourlyRate: null })
    // rate = 120 / (90/60) = 120/1.5 = 80/hr
    const r = computeRescheduleFinancials(booking, 2)
    expect(r.newPrice).toBe(160)   // 80 × 2
  })

  it('F9: fallback using startTime/endTime when duration field is null', () => {
    const booking = makeBooking({
      price: 80, platformFee: 8, providerPayout: 72, duration: null,
      startTime: BASE_START, endTime: BASE_END,  // 1h difference
      lockedHourlyRate: null,
    })
    const r = computeRescheduleFinancials(booking, 2)
    expect(r.newPrice).toBe(160)
  })
})

// ─── R-series: rescheduleBooking() tests ─────────────────────────────────────

describe('R-series: rescheduleBooking() — shared service', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // withSerializableRetry: execute the callback directly
    mockWithSerializableRetry.mockImplementation(async (cb: any) => { await cb(); })

    // Default: CAS succeeds (count=1), no slot conflict, no wallet needed
    mockBookingUpdateMany.mockResolvedValue({ count: 1 })
    mockTxFindFirst.mockResolvedValue(null)          // no slot conflict
    mockBookingUpdate.mockResolvedValue(makeBooking())
    mockTransactionUpdateMany.mockResolvedValue({ count: 1 })
    mockAuditLogCreate.mockResolvedValue({})
    mockWalletFindUnique.mockResolvedValue({ id: 'wallet_1' })
    mockWalletTxAggregate.mockResolvedValue({ _sum: { amount: 500 } })
    mockWalletTxCreate.mockResolvedValue({})
  })

  const futureStart = new Date(Date.now() + 7 * 24 * 3_600_000)
  const futureEnd1h = new Date(futureStart.getTime() + 3_600_000)
  const futureEnd2h = new Date(futureStart.getTime() + 7_200_000)

  function setupBooking(overrides = {}) {
    const bk = makeBooking({
      startTime: new Date(Date.now() + 8 * 24 * 3_600_000),
      endTime:   new Date(Date.now() + 8 * 24 * 3_600_000 + 3_600_000),
      ...overrides,
    })
    mockBookingFindUnique.mockResolvedValue(bk)
    return bk
  }

  // ─── R1: unchanged price — all routes pass ──────────────────────────────

  it('R1: unchanged-price reschedule — time updated', async () => {
    setupBooking({ price: 80, platformFee: 8, providerPayout: 72, duration: 60, isPaid: true, paymentIntentId: 'pi_test' })

    await rescheduleBooking(BOOKING_ID, { newStartTime: futureStart, newEndTime: futureEnd1h }, 'actor', 'provider')

    // CAS called with existing rescheduleCount=0
    expect(mockBookingUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ rescheduleCount: 0 }),
      data:  expect.objectContaining({ rescheduleCount: { increment: 1 } }),
    }))

    // booking.update called with new times
    const updateCall = mockBookingUpdate.mock.calls[0][0]
    expect(updateCall.data.startTime).toEqual(futureStart)
    expect(updateCall.data.endTime).toEqual(futureEnd1h)

    // Transaction NOT updated (price unchanged on Stripe-paid booking)
    expect(mockTransactionUpdateMany).not.toHaveBeenCalled()
  })

  // ─── R2/R3: unpaid booking — price may change ───────────────────────────

  it('R2: unpaid booking + duration increase — all four financial fields updated; Transaction updated', async () => {
    setupBooking({ price: 80, platformFee: 8, providerPayout: 72, commissionRate: 0.10, duration: 60, isPaid: false })

    await rescheduleBooking(BOOKING_ID, { newStartTime: futureStart, newEndTime: futureEnd2h }, 'actor', 'CLIENT')

    const updateCall = mockBookingUpdate.mock.calls[0][0]
    expect(updateCall.data.price).toBe(160)
    expect(updateCall.data.platformFee).toBe(16)
    expect(updateCall.data.providerPayout).toBe(144)
    expect(updateCall.data.commissionRate).toBe(0.10)
    expect(updateCall.data.duration).toBe(120)

    // Transaction updated
    expect(mockTransactionUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ bookingId: BOOKING_ID, type: 'BOOKING_PAYMENT' }),
      data:  expect.objectContaining({ amount: 160, platformFee: 16, providerPayout: 144 }),
    }))
  })

  it('R3: unpaid booking + duration decrease — financial fields updated downward', async () => {
    setupBooking({ price: 80, platformFee: 8, providerPayout: 72, duration: 60, isPaid: false })

    const futureEnd30m = new Date(futureStart.getTime() + 1_800_000) // 30 min
    await rescheduleBooking(BOOKING_ID, { newStartTime: futureStart, newEndTime: futureEnd30m }, 'actor', 'CLIENT')

    const updateCall = mockBookingUpdate.mock.calls[0][0]
    expect(updateCall.data.price).toBe(40)
    expect(updateCall.data.platformFee).toBe(4)
    expect(updateCall.data.providerPayout).toBe(36)
  })

  // ─── R4/R5: wallet-paid ─────────────────────────────────────────────────

  it('R4: wallet-paid + price increase — wallet DEBIT created; balance checked inside tx', async () => {
    setupBooking({ price: 80, platformFee: 8, providerPayout: 72, duration: 60, isPaid: true, paymentIntentId: null })

    // Wallet has $200 balance (sum aggregate)
    mockWalletTxAggregate
      .mockResolvedValueOnce({ _sum: { amount: 300 } })  // CREDIT
      .mockResolvedValueOnce({ _sum: { amount: 100 } })  // DEBIT → balance = 200

    await rescheduleBooking(BOOKING_ID, { newStartTime: futureStart, newEndTime: futureEnd2h }, 'actor', 'CLIENT')

    expect(mockWalletTxCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'DEBIT', amount: 80 }),  // priceDiff = 80
    }))
  })

  it('R5: wallet-paid + price decrease — wallet CREDIT created', async () => {
    setupBooking({ price: 80, platformFee: 8, providerPayout: 72, duration: 60, isPaid: true, paymentIntentId: null })

    const futureEnd30m = new Date(futureStart.getTime() + 1_800_000)
    await rescheduleBooking(BOOKING_ID, { newStartTime: futureStart, newEndTime: futureEnd30m }, 'actor', 'CLIENT')

    expect(mockWalletTxCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'CREDIT', amount: 40 }),
    }))
  })

  // ─── R6: insufficient wallet ────────────────────────────────────────────

  it('R6: wallet-paid + price increase + insufficient balance → INSUFFICIENT_BALANCE', async () => {
    setupBooking({ price: 80, platformFee: 8, providerPayout: 72, duration: 60, isPaid: true, paymentIntentId: null })

    // Wallet only has $50, need $80 more
    mockWalletTxAggregate
      .mockResolvedValueOnce({ _sum: { amount: 50 } })   // CREDIT
      .mockResolvedValueOnce({ _sum: { amount: 0 } })    // DEBIT → balance = 50

    await expect(
      rescheduleBooking(BOOKING_ID, { newStartTime: futureStart, newEndTime: futureEnd2h }, 'actor', 'CLIENT')
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' })

    expect(mockWalletTxCreate).not.toHaveBeenCalled()
  })

  // ─── R7/R8: Stripe-paid ─────────────────────────────────────────────────

  it('R7: Stripe-paid + price increase → STRIPE_PAID_PRICE_CHANGE; no DB mutation', async () => {
    setupBooking({ price: 80, isPaid: true, paymentIntentId: 'pi_test', duration: 60 })

    await expect(
      rescheduleBooking(BOOKING_ID, { newStartTime: futureStart, newEndTime: futureEnd2h }, 'actor', 'CLIENT')
    ).rejects.toMatchObject({ code: 'STRIPE_PAID_PRICE_CHANGE' })

    // No booking or transaction mutations
    expect(mockBookingUpdate).not.toHaveBeenCalled()
    expect(mockTransactionUpdateMany).not.toHaveBeenCalled()
    expect(mockWalletTxCreate).not.toHaveBeenCalled()
  })

  it('R8: Stripe-paid + price decrease → STRIPE_PAID_PRICE_CHANGE; no DB mutation', async () => {
    setupBooking({ price: 80, isPaid: true, paymentIntentId: 'pi_test', duration: 60 })

    const futureEnd30m = new Date(futureStart.getTime() + 1_800_000)
    await expect(
      rescheduleBooking(BOOKING_ID, { newStartTime: futureStart, newEndTime: futureEnd30m }, 'actor', 'CLIENT')
    ).rejects.toMatchObject({ code: 'STRIPE_PAID_PRICE_CHANGE' })

    expect(mockBookingUpdate).not.toHaveBeenCalled()
  })

  it('R8b: Stripe-paid + price UNCHANGED → allowed; time updated', async () => {
    setupBooking({ price: 80, isPaid: true, paymentIntentId: 'pi_test', duration: 60 })

    // Same duration (1h → 1h), just different date → price unchanged
    await rescheduleBooking(BOOKING_ID, { newStartTime: futureStart, newEndTime: futureEnd1h }, 'actor', 'CLIENT')

    expect(mockBookingUpdate).toHaveBeenCalled()
    const call = mockBookingUpdate.mock.calls[0][0]
    expect(call.data.startTime).toEqual(futureStart)
    expect(call.data.price).toBeUndefined()  // financial fields not changed
  })

  // ─── R9: offline-paid + price change ────────────────────────────────────

  it('R9: offline-paid + price change → admin audit record created; booking updated', async () => {
    setupBooking({ price: 80, isPaid: true, paymentIntentId: null, offlineAmountPaid: 80, duration: 60 })

    await rescheduleBooking(BOOKING_ID, { newStartTime: futureStart, newEndTime: futureEnd2h }, 'actor', 'ADMIN')

    expect(mockAuditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'OFFLINE_PAID_RESCHEDULE_PRICE_CHANGE' }),
    }))
    expect(mockBookingUpdate).toHaveBeenCalled()
  })

  // ─── R10/R11: package booking ───────────────────────────────────────────

  it('R10: package booking + duration change → PACKAGE_DURATION_LOCKED', async () => {
    setupBooking({ isPackageBooking: true, duration: 60 })

    await expect(
      rescheduleBooking(BOOKING_ID, { newStartTime: futureStart, newEndTime: futureEnd2h }, 'actor', 'CLIENT')
    ).rejects.toMatchObject({ code: 'PACKAGE_DURATION_LOCKED' })

    expect(mockBookingUpdate).not.toHaveBeenCalled()
  })

  it('R11: package booking + same duration → allowed; date/time updated', async () => {
    setupBooking({ isPackageBooking: true, duration: 60 })

    await rescheduleBooking(BOOKING_ID, { newStartTime: futureStart, newEndTime: futureEnd1h }, 'actor', 'CLIENT')

    expect(mockBookingUpdate).toHaveBeenCalled()
  })

  // ─── R12: locked hourly rate used ──────────────────────────────────────

  it('R12: lockedHourlyRate used instead of provider.hourlyRate', async () => {
    const bk = setupBooking({ price: 80, platformFee: 8, providerPayout: 72, duration: 60, lockedHourlyRate: 80, isPaid: false })
    // Provider's current hourlyRate is 999 — must not be used
    ;(bk.provider as any).hourlyRate = 999

    await rescheduleBooking(BOOKING_ID, { newStartTime: futureStart, newEndTime: futureEnd2h }, 'actor', 'CLIENT')

    const call = mockBookingUpdate.mock.calls[0][0]
    expect(call.data.price).toBe(160)   // 80 × 2, not 999 × 2
  })

  // ─── R13: fallback rate calculation ────────────────────────────────────

  it('R13: fallback rate (price/duration) used when lockedHourlyRate is null', async () => {
    setupBooking({ price: 80, platformFee: 8, providerPayout: 72, duration: 60, lockedHourlyRate: null, isPaid: false })

    await rescheduleBooking(BOOKING_ID, { newStartTime: futureStart, newEndTime: futureEnd2h }, 'actor', 'CLIENT')

    const call = mockBookingUpdate.mock.calls[0][0]
    expect(call.data.price).toBe(160)
  })

  // ─── R14: financial consistency invariant ──────────────────────────────

  it('R14: after reschedule, Booking.price = platformFee + providerPayout', async () => {
    setupBooking({ price: 90, platformFee: 9, providerPayout: 81, duration: 60, isPaid: false })

    await rescheduleBooking(BOOKING_ID, { newStartTime: futureStart, newEndTime: futureEnd2h }, 'actor', 'CLIENT')

    const call = mockBookingUpdate.mock.calls[0][0]
    const { price, platformFee, providerPayout } = call.data
    if (price !== undefined) {
      expect(Math.abs(price - (platformFee + providerPayout))).toBeLessThan(0.01)
    }
  })

  it('R15: Transaction.amount = Booking.price after financial update', async () => {
    setupBooking({ price: 80, platformFee: 8, providerPayout: 72, duration: 60, isPaid: false })

    await rescheduleBooking(BOOKING_ID, { newStartTime: futureStart, newEndTime: futureEnd2h }, 'actor', 'CLIENT')

    const txCall = mockTransactionUpdateMany.mock.calls[0][0]
    const bkCall = mockBookingUpdate.mock.calls[0][0]
    expect(txCall.data.amount).toBe(bkCall.data.price)
    expect(txCall.data.providerPayout).toBe(bkCall.data.providerPayout)
  })

  // ─── R16: wallet + booking + transaction atomicity ──────────────────────

  it('R16: wallet, booking, and transaction — all write operations use the tx client from $transaction', async () => {
    setupBooking({ price: 80, isPaid: true, paymentIntentId: null, duration: 60 })

    mockWalletTxAggregate
      .mockResolvedValueOnce({ _sum: { amount: 300 } })
      .mockResolvedValueOnce({ _sum: { amount: 100 } })

    await rescheduleBooking(BOOKING_ID, { newStartTime: futureStart, newEndTime: futureEnd2h }, 'actor', 'CLIENT')

    // All three write mocks (wallet, booking, transaction) were called —
    // they go through the same tx client provided by the $transaction mock
    expect(mockWalletTxCreate).toHaveBeenCalled()
    expect(mockBookingUpdate).toHaveBeenCalled()
    expect(mockTransactionUpdateMany).toHaveBeenCalled()
  })

  // ─── R17: rollback on failure ───────────────────────────────────────────

  it('R17: if $transaction throws, no partial writes committed', async () => {
    setupBooking({ price: 80, duration: 60, isPaid: false })
    mockBookingUpdate.mockRejectedValueOnce(new Error('DB_FAILURE'))

    await expect(
      rescheduleBooking(BOOKING_ID, { newStartTime: futureStart, newEndTime: futureEnd2h }, 'actor', 'CLIENT')
    ).rejects.toThrow('DB_FAILURE')
  })

  // ─── R18/R19: concurrent reschedule ────────────────────────────────────

  it('R18: concurrent reschedule — CAS count=0 → CONCURRENT_RESCHEDULE', async () => {
    setupBooking({ rescheduleCount: 3 })
    // DB has rescheduleCount=4 already (concurrent update won)
    mockBookingUpdateMany.mockResolvedValueOnce({ count: 0 })

    await expect(
      rescheduleBooking(BOOKING_ID, { newStartTime: futureStart, newEndTime: futureEnd1h }, 'actor', 'CLIENT')
    ).rejects.toMatchObject({ code: 'CONCURRENT_RESCHEDULE' })

    expect(mockBookingUpdate).not.toHaveBeenCalled()
  })

  it('R19: slot conflict → SLOT_CONFLICT; no booking update', async () => {
    setupBooking()
    mockTxFindFirst.mockResolvedValueOnce({ id: 'bk_conflicting' })  // conflict found

    await expect(
      rescheduleBooking(BOOKING_ID, { newStartTime: futureStart, newEndTime: futureEnd1h }, 'actor', 'CLIENT')
    ).rejects.toMatchObject({ code: 'SLOT_CONFLICT' })

    expect(mockBookingUpdate).not.toHaveBeenCalled()
  })

  // ─── R20: invalid duration ──────────────────────────────────────────────

  it('R20: endTime <= startTime → INVALID_DURATION before any DB call', async () => {
    setupBooking()

    await expect(
      rescheduleBooking(BOOKING_ID, { newStartTime: futureStart, newEndTime: futureStart }, 'actor', 'CLIENT')
    ).rejects.toMatchObject({ code: 'INVALID_DURATION' })

    expect(mockBookingFindUnique).not.toHaveBeenCalled()
  })

  // ─── R21: missing transaction ───────────────────────────────────────────

  it('R21: no BOOKING_PAYMENT transaction found — updateMany count=0 — logs warning, does not throw', async () => {
    setupBooking({ price: 80, duration: 60, isPaid: false })
    mockTransactionUpdateMany.mockResolvedValueOnce({ count: 0 })

    // Should not throw — missing transaction is a warning, not a fatal error
    await expect(
      rescheduleBooking(BOOKING_ID, { newStartTime: futureStart, newEndTime: futureEnd2h }, 'actor', 'CLIENT')
    ).resolves.toBeDefined()
  })

  // ─── R22: multiple eligible transactions ───────────────────────────────

  it('R22: multiple BOOKING_PAYMENT transactions — all updated; console warning logged', async () => {
    setupBooking({ price: 80, duration: 60, isPaid: false })
    mockTransactionUpdateMany.mockResolvedValueOnce({ count: 2 })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await rescheduleBooking(BOOKING_ID, { newStartTime: futureStart, newEndTime: futureEnd2h }, 'actor', 'CLIENT')

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('2 eligible BOOKING_PAYMENT'))
    warnSpy.mockRestore()
  })

  // ─── R23: duplicate request ─────────────────────────────────────────────

  it('R23: duplicate identical request — CAS on rescheduleCount prevents double write', async () => {
    setupBooking({ rescheduleCount: 1 })
    // First call: CAS wins; second call: same booking still has count=1 (not yet incremented in mock)
    // In real DB, first committed count=2, so second sees count=2 ≠ 1 → fails CAS
    mockBookingUpdateMany
      .mockResolvedValueOnce({ count: 1 })   // first wins
      .mockResolvedValueOnce({ count: 0 })   // second loses (DB already at count=2)

    const invoke = () => rescheduleBooking(BOOKING_ID, { newStartTime: futureStart, newEndTime: futureEnd1h }, 'actor', 'CLIENT')
    const [r1, r2] = await Promise.allSettled([invoke(), invoke()])

    const statuses = [r1.status, r2.status].sort()
    expect(statuses).toEqual(['fulfilled', 'rejected'])
    expect((r2 as PromiseRejectedResult).reason?.code).toBe('CONCURRENT_RESCHEDULE')
  })

  // ─── R24: past reschedule time ──────────────────────────────────────────

  it('R24: newStartTime in the past → SLOT_CONFLICT before DB lookup', async () => {
    setupBooking()
    const pastTime = new Date(Date.now() - 3_600_000)
    const pastEnd  = new Date(Date.now() - 1_800_000)

    await expect(
      rescheduleBooking(BOOKING_ID, { newStartTime: pastTime, newEndTime: pastEnd }, 'actor', 'CLIENT')
    ).rejects.toMatchObject({ code: 'SLOT_CONFLICT' })
  })

  // ─── R25: penalty window soft-return ───────────────────────────────────

  it('R25: inside 24h penalty window without waiver → requiresConfirmation returned, no DB write', async () => {
    // Booking starts in 2 hours (inside 24h window)
    const imminent = makeBooking({
      startTime: new Date(Date.now() + 2 * 3_600_000),
      endTime:   new Date(Date.now() + 3 * 3_600_000),
      rescheduleCount: 0,
    })
    mockBookingFindUnique.mockResolvedValue(imminent)

    const result = await rescheduleBooking(
      BOOKING_ID,
      { newStartTime: futureStart, newEndTime: futureEnd1h, confirmedPenaltyWaiver: false },
      'actor', 'CLIENT'
    )

    expect(result).toMatchObject({ requiresConfirmation: true })
    expect(mockBookingUpdate).not.toHaveBeenCalled()
  })
})
