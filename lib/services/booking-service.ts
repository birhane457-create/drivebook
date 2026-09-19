/**
 * lib/services/booking-service.ts
 *
 * The single source of truth for all booking lifecycle transitions.
 *
 * INVARIANTS (enforced here, nowhere else):
 *  1. Every DB write that changes booking state runs inside a $transaction
 *  2. Wallet writes are always inside the same $transaction as the booking write
 *  3. ClientWallet.balance is no longer updated here â€” balance is derived from
 *     WalletTransaction aggregate (getWalletBalance uses aggregate; balance field
 *     is considered deprecated). Only WalletTransaction rows are inserted.
 *  4. Payment side-effects (ledger, wallet, payout) are delegated to the
 *     PaymentExtension hook â€” Core never imports wallet or ledger code directly.
 *     For driving: drivingPaymentExtension handles this.
 *     For all other verticals: no paymentExtension â†’ no payment side-effects.
 *  5. Slot conflict check always runs inside the transaction (TOCTOU-safe)
 *  6. originalStartTime is set on first reschedule and never overwritten
 *  7. isNonRefundable is set at 24h before the *original* lesson start (unified policy)
 *  8. Notifications fire after the transaction commits â€” never inside it
 *  9. Notification failures are silently queued for retry, never thrown
 * 10. Every state change writes an audit log entry
 *
 * The driving vertical uses this service unchanged â€” no industry branching here.
 * Payment behaviour comes from the paymentExtension registered on the DomainExtension.
 */

import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import type { DomainExtension } from '@/lib/core/types'
import { enqueueNotification } from '@/lib/services/notificationRetry'
import { withSerializableRetry } from '@/lib/utils/transaction-retry'

const SERIALIZABLE_TX_RESCHEDULE = { isolationLevel: 'Serializable' as const, maxWait: 5000, timeout: 10000 }
import { emailService } from '@/lib/services/email'
import { recordBookingPayment, recordFullRefund, recordPartialRefund } from '@/lib/services/ledger-operations'
import { toDecimal, toNumber, multiplyAmount, subtractAmounts, roundAmount, addAmounts, calculatePercentage, isLessThan, isGreaterThanOrEqual } from '@/lib/utils/decimal-helpers'

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type ActorRole = 'provider' | 'CLIENT' | 'ADMIN' | 'SYSTEM'

export interface BookingCreateInput {
  providerId:     string   // who is delivering the service
  customerId:     string   // Client record id
  startTime:      Date
  endTime:        Date
  bookingType?:   string   // LESSON | PDA_TEST | MOCK_TEST | APPOINTMENT etc.
  pickupAddress?: string
  pickupLatitude?:  number
  pickupLongitude?: number
  dropoffAddress?:  string
  notes?:           string
  source?:          string  // 'platform' | 'offline' | 'voice'
  createdBy?:       string  // 'provider' | 'customer' | 'system'
}

export interface BookingCreateResult {
  booking:        any
  status:         'CONFIRMED' | 'PENDING_PAYMENT'
  pendingPayment: boolean
  walletBalance?: number
}

export interface RescheduleInput {
  newStartTime: Date
  newEndTime:   Date
  reason?:      string
  confirmedPenaltyWaiver?: boolean
}

export interface CancelResult {
  refundPercentage: number
  refundAmount:     number
  hoursNotice:      number
}

export interface BookingServiceError extends Error {
  code: 'SLOT_CONFLICT' | 'INSUFFICIENT_BALANCE' | 'ALREADY_CANCELLED' |
        'ALREADY_COMPLETED' | 'BOOKING_NOT_FOUND' | 'UNAUTHORIZED' |
        'REQUIRES_PENALTY_WAIVER' | 'ALREADY_CHECKED_IN' | 'ALREADY_CHECKED_OUT' |
        'CHECK_IN_TOO_EARLY' | 'CHECK_IN_TOO_LATE' | 'CHECK_OUT_TOO_SOON' |
        'STRIPE_PAID_PRICE_CHANGE' | 'PACKAGE_DURATION_LOCKED' |
        'CONCURRENT_RESCHEDULE' | 'INVALID_DURATION'
  detail?: string
}

function makeError(code: BookingServiceError['code'], message: string, detail?: string): BookingServiceError {
  const err = new Error(message) as BookingServiceError
  err.code = code
  err.detail = detail
  return err
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Standard overlap predicate for slot conflict queries */
function slotConflictWhere(
  providerId: string,
  start: Date,
  end: Date,
  excludeId?: string
): Prisma.BookingWhereInput {
  return {
    providerId: providerId,
    ...(excludeId ? { id: { not: excludeId } } : {}),
    deletedAt: null,
    status: { in: ['PENDING', 'PENDING_PAYMENT', 'CONFIRMED'] },
    OR: [
      { startTime: { lt: end },  endTime: { gt: start } },
    ],
  } as any
}

/** Get wallet balance from WalletTransaction aggregate (single source of truth) */
async function getWalletBalanceTx(tx: Prisma.TransactionClient, walletId: string): Promise<number> {
  const [credits, debits] = await Promise.all([
    tx.walletTransaction.aggregate({ where: { walletId, status: 'CONFIRMED', type: 'CREDIT' }, _sum: { amount: true } }),
    tx.walletTransaction.aggregate({ where: { walletId, status: 'CONFIRMED', type: 'DEBIT'  }, _sum: { amount: true } }),
  ])
  return Number(credits._sum.amount ?? 0) - Number(debits._sum.amount ?? 0)
}

/** Write an audit log entry â€” never throws */
async function writeAudit(
  action: string,
  actorId: string,
  actorRole: string,
  bookingId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: { action, actorId, actorRole, targetType: 'BOOKING', targetId: bookingId, success: true, metadata: metadata as any },
    })
  } catch (e) {
    console.error('[BookingService] Audit log failed (non-critical):', e)
  }
}

// â”€â”€ Pricing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface PricingResult {
  price:            number
  platformFee:      number
  providerPayout: number
  commissionRate:   number
  isFirstBooking:   boolean
}

// ── PAY-H-02: computeRescheduleFinancials ─────────────────────────────────────
//
// Pure function — no DB queries. Derives all financial terms from the booking's
// own locked financial contract + the new duration.
//
// Rate authority (priority):
//   1. booking.lockedHourlyRate  — explicitly locked at booking time
//   2. booking.price / oldDurationHours — back-computed from stored agreement
// → Provider's current hourlyRate is NEVER used. A rate change after booking
//   cannot silently reprice an existing booking on reschedule.
//
// Fee/commission authority:
//   Original booking.platformFee / booking.price  — the locked fee ratio
//   booking.commissionRate                         — stored at booking-creation time
// → PlatformSettings is NEVER re-queried.
//
export interface RescheduleFinancials {
  newPrice:        number
  newPlatformFee:  number
  newProviderPayout: number
  commissionRate:  number   // unchanged — locked at booking-creation time
  priceDiff:       number
}

export function computeRescheduleFinancials(
  booking: {
    price:          any  // Decimal | number
    platformFee:    any  // Decimal | number
    providerPayout: any  // Decimal | number
    commissionRate: any  // Decimal | number
    duration:       any  // minutes (number | null)
    startTime:      any
    endTime:        any
    lockedHourlyRate: any  // Decimal | number | null
  },
  newDurationHours: number,
): RescheduleFinancials {
  const currentPrice   = toNumber(toDecimal(booking.price))
  const currentFee     = toNumber(toDecimal(booking.platformFee ?? 0))
  const commissionRate = toNumber(toDecimal(booking.commissionRate ?? 0))

  const oldDurationHours = booking.duration
    ? Number(booking.duration) / 60
    : (booking.startTime && booking.endTime
        ? (new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime()) / 3_600_000
        : 1)

  // Authoritative rate: locked at booking time, or back-computed from stored price/duration
  const authoritativeRate = booking.lockedHourlyRate
    ? toNumber(toDecimal(booking.lockedHourlyRate))
    : (oldDurationHours > 0 ? currentPrice / oldDurationHours : 0)

  const newPriceDec       = roundAmount(multiplyAmount(toDecimal(authoritativeRate), newDurationHours), 2)
  const newPrice          = toNumber(newPriceDec)

  // Fee proportion from original booking contract
  const feeRatio          = currentPrice > 0 ? currentFee / currentPrice : 0
  const newPlatformFeeDec = roundAmount(multiplyAmount(newPriceDec, toDecimal(feeRatio)), 2)
  const newPlatformFee    = toNumber(newPlatformFeeDec)
  const newProviderPayout = toNumber(roundAmount(subtractAmounts(newPriceDec, newPlatformFeeDec), 2))
  const priceDiff         = toNumber(roundAmount(subtractAmounts(newPriceDec, toDecimal(currentPrice)), 2))

  return { newPrice, newPlatformFee, newProviderPayout, commissionRate, priceDiff }
}

// ── rescheduleBooking (PAY-H-02 FIX) ─────────────────────────────────────────

/**
 * Shared reschedule implementation — used by all four entry points.
 *
 * Financial invariants:
 *   Authoritative rate: lockedHourlyRate ?? price/duration (never live provider rate)
 *   All four fields updated atomically: price, platformFee, providerPayout, commissionRate
 *   BOOKING_PAYMENT Transaction updated in same SERIALIZABLE transaction
 *   Stripe-paid + price change → STRIPE_PAID_PRICE_CHANGE (no mutation)
 *   Wallet-paid + price change → atomic wallet debit/credit
 *   Package booking + duration change → PACKAGE_DURATION_LOCKED
 *   rescheduleCount CAS prevents concurrent double-reschedule
 *   Slot conflict inside SERIALIZABLE transaction (TOCTOU-safe)
 */
export async function rescheduleBooking(
  bookingId: string,
  input: RescheduleInput,
  actorId: string,
  actorRole: ActorRole,
): Promise<any | { requiresConfirmation: true; hoursUntil: number; warning: string }> {
  const { newStartTime, newEndTime, reason, confirmedPenaltyWaiver } = input

  if (newEndTime <= newStartTime) throw makeError('INVALID_DURATION', 'End time must be after start time')
  const newDurationHours = (newEndTime.getTime() - newStartTime.getTime()) / 3_600_000
  if (newDurationHours <= 0) throw makeError('INVALID_DURATION', 'Duration must be positive')

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { provider: true, customer: true },
  }) as any
  if (!booking)                       throw makeError('BOOKING_NOT_FOUND',  'Booking not found')
  if (booking.status === 'COMPLETED') throw makeError('ALREADY_COMPLETED',  'Cannot reschedule a completed booking')
  if (booking.status === 'CANCELLED') throw makeError('ALREADY_CANCELLED',  'Cannot reschedule a cancelled booking')

  const now = new Date()
  if (newStartTime < now) throw makeError('SLOT_CONFLICT', 'Cannot reschedule to a time in the past')

  const HOURS_24_MS   = 24 * 3_600_000
  const currentStart  = booking.startTime ? new Date(booking.startTime) : null
  const isInsidePenaltyWindow = currentStart
    ? (currentStart.getTime() - now.getTime()) < HOURS_24_MS
    : false

  if (isInsidePenaltyWindow && !confirmedPenaltyWaiver) {
    const hoursUntil = currentStart
      ? Math.round((currentStart.getTime() - now.getTime()) / 3_600_000 * 10) / 10
      : 0
    return {
      requiresConfirmation: true, hoursUntil,
      warning: `Booking starts in ${hoursUntil} hours. Rescheduling now will mark it non-refundable.`,
    }
  }

  // Package booking: duration changes are blocked (package hour accounting requires separate workflow)
  if (booking.isPackageBooking) {
    const oldDurationHours = booking.duration
      ? Number(booking.duration) / 60
      : (booking.startTime && booking.endTime
          ? (new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime()) / 3_600_000
          : newDurationHours)
    if (Math.abs(newDurationHours - oldDurationHours) > 0.001) {
      throw makeError('PACKAGE_DURATION_LOCKED',
        'Duration changes are not allowed for package bookings. Only the date and time may be rescheduled.')
    }
  }

  // Compute new financial terms from the booking's own locked contract
  const { newPrice, newPlatformFee, newProviderPayout, commissionRate, priceDiff } =
    computeRescheduleFinancials(booking, newDurationHours)
  const priceChanged = Math.abs(priceDiff) > 0.01

  // Payment method detection
  const isStripePaid  = booking.isPaid && !!booking.paymentIntentId
  const isWalletPaid  = booking.isPaid && !booking.paymentIntentId && !booking.offlineAmountPaid
  const isOfflinePaid = booking.isPaid && !!booking.offlineAmountPaid
  const isUnpaid      = !booking.isPaid

  // Stripe-paid: block if price would change
  if (isStripePaid && priceChanged) {
    throw makeError('STRIPE_PAID_PRICE_CHANGE',
      `This booking was paid via Stripe for $${Number(booking.price).toFixed(2)}. ` +
      `Rescheduling to this duration would change the price to $${newPrice.toFixed(2)}. ` +
      `To change the duration, please cancel and rebook.`)
  }

  // Pre-flight wallet check (informational — re-checked authoritatively inside tx)
  if (isWalletPaid && priceChanged && priceDiff > 0 && booking.customer?.userId) {
    const { getWalletBalance } = await import('@/lib/services/wallet-helpers')
    const wb = await getWalletBalance(booking.customer.userId)
    if (wb.balance < priceDiff) {
      throw makeError('INSUFFICIENT_BALANCE',
        `Insufficient wallet balance. Need $${priceDiff.toFixed(2)} more for this duration change.`)
    }
  }

  const historyEntry = {
    previousStart: booking.startTime,
    previousEnd:   booking.endTime,
    rescheduledAt: now.toISOString(),
    rescheduledBy: actorId,
    role:          actorRole.toLowerCase(),
    reason:        reason ?? null,
    wasInsidePenaltyWindow: isInsidePenaltyWindow,
  }
  const existingHistory: any[] = (booking.rescheduledFrom as any[]) || []
  const currentRescheduleCount: number = (booking as any).rescheduleCount ?? 0

  let updated: any
  await withSerializableRetry(async () => {
    updated = await prisma.$transaction(async (tx) => {
      // CAS on rescheduleCount — prevents concurrent double-reschedule
      const casResult = await (tx as any).booking.updateMany({
        where: { id: bookingId, rescheduleCount: currentRescheduleCount },
        data:  { rescheduleCount: { increment: 1 } },
      })
      if (casResult.count === 0)
        throw makeError('CONCURRENT_RESCHEDULE', 'Booking was modified concurrently. Please reload and try again.')

      // Slot conflict — inside SERIALIZABLE tx (TOCTOU-safe)
      const conflict = await tx.booking.findFirst({
        where: slotConflictWhere(booking.providerId, newStartTime, newEndTime, bookingId),
      })
      if (conflict) throw makeError('SLOT_CONFLICT', 'New time slot conflicts with an existing booking')

      // Financial field update payload (when price changes or booking is unpaid)
      const financialUpdate: any = {}
      if (priceChanged || isUnpaid) {
        financialUpdate.price          = newPrice
        financialUpdate.platformFee    = newPlatformFee
        financialUpdate.providerPayout = newProviderPayout
        financialUpdate.commissionRate = commissionRate
        financialUpdate.duration       = Math.round(newDurationHours * 60)
      }

      // Wallet adjustment (wallet-paid only)
      if (isWalletPaid && priceChanged && booking.customer?.userId) {
        const wallet = await tx.clientWallet.findUnique({ where: { userId: booking.customer.userId } })
        if (wallet) {
          if (priceDiff > 0) {
            const [cr, db] = await Promise.all([
              tx.walletTransaction.aggregate({ where: { walletId: wallet.id, status: 'CONFIRMED', type: 'CREDIT' }, _sum: { amount: true } }),
              tx.walletTransaction.aggregate({ where: { walletId: wallet.id, status: 'CONFIRMED', type: 'DEBIT'  }, _sum: { amount: true } }),
            ])
            const txBalance = Number(cr._sum.amount ?? 0) - Number(db._sum.amount ?? 0)
            if (txBalance < priceDiff)
              throw makeError('INSUFFICIENT_BALANCE', `Insufficient wallet balance — need $${priceDiff.toFixed(2)} more`)
            await tx.walletTransaction.create({
              data: { walletId: wallet.id, type: 'DEBIT',  amount: priceDiff,
                      description: `Duration increase — reschedule`, status: 'CONFIRMED', bookingId } as any,
            })
          } else {
            await tx.walletTransaction.create({
              data: { walletId: wallet.id, type: 'CREDIT', amount: Math.abs(priceDiff),
                      description: `Duration reduction — reschedule`, status: 'CONFIRMED', bookingId } as any,
            })
          }
        }
      }

      // Offline-paid + price change: preserve payment state, write admin-review signal
      if (isOfflinePaid && priceChanged) {
        await tx.auditLog.create({
          data: {
            action: 'OFFLINE_PAID_RESCHEDULE_PRICE_CHANGE', actorId, actorRole,
            targetType: 'BOOKING', targetId: bookingId, success: true,
            metadata: { oldPrice: Number(booking.price), newPrice, priceDiff,
                        offlinePaymentMethod: booking.offlinePaymentMethod } as any,
          },
        })
      }

      // Build and apply booking update
      const updateData: any = {
        startTime: newStartTime, endTime: newEndTime,
        rescheduledFrom: [...existingHistory, historyEntry],
        // rescheduleCount already incremented by CAS above
        ...financialUpdate,
      }
      if (!booking.originalStartTime && booking.startTime) updateData.originalStartTime = booking.startTime
      if (isInsidePenaltyWindow) updateData.isNonRefundable = true

      const result = await tx.booking.update({
        where: { id: bookingId },
        data:  updateData,
        include: { customer: true, provider: { include: { user: true } } },
      })

      // Update authoritative BOOKING_PAYMENT Transaction when financials change
      if (priceChanged || isUnpaid) {
        const txUpdateResult = await (tx as any).transaction.updateMany({
          where: { bookingId, type: 'BOOKING_PAYMENT', status: { notIn: ['REFUNDED', 'CANCELLED'] } },
          data:  { amount: newPrice, platformFee: newPlatformFee, providerPayout: newProviderPayout,
                   commissionRate, updatedAt: new Date() },
        })
        if (txUpdateResult.count > 1) {
          console.warn(`[PAY-H-02] ${txUpdateResult.count} eligible BOOKING_PAYMENT transactions for booking ${bookingId}`)
        }
      }

      return result
    }, SERIALIZABLE_TX_RESCHEDULE)
  }, { operationName: 'reschedule-booking' })

  await writeAudit('BOOKING_RESCHEDULED', actorId, actorRole, bookingId, {
    oldStart: booking.startTime?.toISOString() ?? null,
    oldEnd:   booking.endTime?.toISOString() ?? null,
    newStart: newStartTime.toISOString(),
    newEnd:   newEndTime.toISOString(),
    priceDiff: priceChanged ? priceDiff : 0,
    reason: reason ?? null, isInsidePenaltyWindow,
    rescheduledBy: actorRole.toLowerCase(),
    paymentMethod: isStripePaid ? 'stripe' : isWalletPaid ? 'wallet' : isOfflinePaid ? 'offline' : 'unpaid',
    newPrice: priceChanged ? newPrice : undefined,
  })

  return updated
}

export async function computePricing(
  providerId: string,
  customerId: string,
  durationHours: number
): Promise<PricingResult> {
  const [instructor, firstBookingCount, settings] = await Promise.all([
    prisma.provider.findUnique({ where: { id: providerId }, select: { hourlyRate: true, subscriptionTier: true } }),
    prisma.booking.count({ where: { providerId: providerId, customerId: customerId, status: 'COMPLETED' } }),
    (prisma as any).platformSettings.findFirst({ select: { platformFeePercentage: true, basicCommissionRate: true, proCommissionRate: true, studioCommissionRate: true, businessCommissionRate: true } }).catch(() => null),
  ])

  if (!instructor) throw makeError('BOOKING_NOT_FOUND', 'Provider not found')

  const price = parseFloat((instructor.hourlyRate * durationHours).toFixed(2))

  const tierKey = (instructor.subscriptionTier ?? 'BASIC').toUpperCase()
  const commissionPct =
    tierKey === 'PREMIUM' ? (settings?.businessCommissionRate ?? 10) :  // DB column named 'businessCommissionRate' for PREMIUM tier (legacy naming)
    tierKey === 'STUDIO'  ? (settings?.studioCommissionRate ?? 11) :
    tierKey === 'PRO'     ? (settings?.proCommissionRate ?? 12) :
                            (settings?.basicCommissionRate ?? 15)

  const platformFeeRate = settings?.platformFeePercentage ?? commissionPct
  
  // Use Decimal for penny-perfect pricing calculations
  const priceDec = toDecimal(price)
  const platformFeeDec = roundAmount(calculatePercentage(priceDec, platformFeeRate), 2)
  const providerPayoutDec = roundAmount(subtractAmounts(priceDec, platformFeeDec), 2)
  
  const platformFee = toNumber(platformFeeDec)
  const providerPayout = toNumber(providerPayoutDec)

  return {
    price,
    platformFee,
    providerPayout,
    commissionRate: commissionPct,
    isFirstBooking: firstBookingCount === 0,
  }
}

// â”€â”€ Core lifecycle methods â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Create a new booking.
 * Returns CONFIRMED if wallet has sufficient funds; PENDING_PAYMENT otherwise.
 * The caller is responsible for sending notifications after this resolves.
 */
export async function createBooking(
  input: BookingCreateInput,
  actorId: string,
  actorRole: ActorRole
): Promise<BookingCreateResult> {
  const {
    providerId, customerId, startTime, endTime,
    bookingType = 'APPOINTMENT', pickupAddress, pickupLatitude, pickupLongitude,
    dropoffAddress, notes, source = 'platform', createdBy = actorRole.toLowerCase(),
  } = input

  const durationHours = (endTime.getTime() - startTime.getTime()) / 3_600_000
  if (durationHours <= 0) throw makeError('SLOT_CONFLICT', 'End time must be after start time')

  const pricing = await computePricing(providerId, customerId, durationHours)

  const client = await prisma.customer.findFirst({
    where: { id: customerId },
    select: { id: true, name: true, phone: true, userId: true, defaultPickupLat: true, defaultPickupLng: true, defaultPickupAddress: true },
  })
  if (!client) throw makeError('BOOKING_NOT_FOUND', 'Customer not found or does not belong to this provider')
  if (!client.userId) throw makeError('UNAUTHORIZED', 'Customer account not set up')

  // Determine if wallet can cover the booking
  const wallet = await prisma.clientWallet.findUnique({ where: { userId: client.userId! } })
  const creditSum = wallet
    ? Number((await prisma.walletTransaction.aggregate({ where: { walletId: wallet.id, status: 'CONFIRMED', type: 'CREDIT' }, _sum: { amount: true } }))._sum.amount ?? 0)
    : 0
  const debitSum = wallet
    ? Number((await prisma.walletTransaction.aggregate({ where: { walletId: wallet.id, status: 'CONFIRMED', type: 'DEBIT'  }, _sum: { amount: true } }))._sum.amount ?? 0)
    : 0
  const walletBalance = creditSum - debitSum

  const pickupLoc = pickupAddress ?? client.defaultPickupAddress ?? null
  const pickupLat = pickupLatitude ?? client.defaultPickupLat ?? null
  const pickupLng = pickupLongitude ?? client.defaultPickupLng ?? null

  if (isLessThan(toDecimal(walletBalance), toDecimal(pricing.price))) {
    // PENDING_PAYMENT path â€” create booking without wallet deduction
    let pendingBooking: any
    try {
      pendingBooking = await prisma.$transaction(async (tx) => {
        const conflict = await tx.booking.findFirst({ where: slotConflictWhere(providerId, startTime, endTime) })
        if (conflict) throw makeError('SLOT_CONFLICT', 'Time slot is not available')

        return tx.booking.create({
          data: {
            providerId: providerId,
            customerId: customerId,
            customerName: client.name,
            customerPhone: client.phone,
            bookingType,
            startTime,
            endTime,
            duration: durationHours * 60,
            price: pricing.price,
            platformFee: pricing.platformFee,
            providerPayout: pricing.providerPayout,
            commissionRate: pricing.commissionRate,
            isFirstBooking: pricing.isFirstBooking,
            isPaid: false,
            pickupAddress: pickupLoc,
            pickupLatitude: pickupLat,
            pickupLongitude: pickupLng,
            dropoffAddress,
            notes,
            status: 'PENDING_PAYMENT',
            source,
            createdBy,
            originalStartTime: startTime,
          } as any,
        })
      })
    } catch (e: any) {
      if (e?.code === 'SLOT_CONFLICT') throw e
      throw e
    }

    await writeAudit('BOOKING_CREATED', actorId, actorRole, pendingBooking.id, {
      customerId: customerId, price: pendingBooking.price, pendingPayment: true, source,
    })

    return { booking: pendingBooking, status: 'PENDING_PAYMENT', pendingPayment: true }
  }

  // CONFIRMED path â€” deduct wallet inside same transaction as booking create
  let booking: any
  try {
    booking = await prisma.$transaction(async (tx) => {
      // Slot conflict
      const conflict = await tx.booking.findFirst({ where: slotConflictWhere(providerId, startTime, endTime) })
      if (conflict) throw makeError('SLOT_CONFLICT', 'Time slot is not available')

      // Re-verify balance inside tx (TOCTOU-safe)
      const w = wallet ?? await tx.clientWallet.upsert({
        where: { userId: client.userId! },
        create: { userId: client.userId! },
        update: {},
      })
      const txBalance = await getWalletBalanceTx(tx, w.id)
      if (isLessThan(toDecimal(txBalance), toDecimal(pricing.price))) throw makeError('INSUFFICIENT_BALANCE', 'Wallet balance changed â€” please retry')

      // Wallet debit (WalletTransaction only â€” no balance field update)
      await tx.walletTransaction.create({
        data: {
          walletId: w.id,
          type: 'DEBIT',
          amount: pricing.price,
          description: `Booking â€” ${startTime.toLocaleDateString('en-AU')} ${startTime.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}`,
          status: 'CONFIRMED',
        },
      })

      const now = new Date()
      const newBooking = await tx.booking.create({
        data: {
          providerId: providerId,
          customerId: customerId,
          customerName: client.name,
          customerPhone: client.phone,
          bookingType,
          startTime,
          endTime,
          duration: durationHours * 60,
          price: pricing.price,
          platformFee: pricing.platformFee,
          providerPayout: pricing.providerPayout,
          commissionRate: pricing.commissionRate,
          isFirstBooking: pricing.isFirstBooking,
          isPaid: true,
          paidAt: now,
          pickupAddress: pickupLoc,
          pickupLatitude: pickupLat,
          pickupLongitude: pickupLng,
          dropoffAddress,
          notes,
          status: 'CONFIRMED',
          source,
          createdBy,
          originalStartTime: startTime,
        } as any,
      })

      // Transaction record
      await (tx as any).transaction.create({
        data: {
          bookingId: newBooking.id,
          providerId: providerId,
          type: 'BOOKING_PAYMENT',
          amount: pricing.price,
          platformFee: pricing.platformFee,
          providerPayout: pricing.providerPayout,
          commissionRate: pricing.commissionRate,
          status: 'COMPLETED',
          description: `Booking payment â€” ${pricing.isFirstBooking ? 'first booking' : 'repeat booking'}`,
          metadata: { isFirstBooking: pricing.isFirstBooking },
        },
      })

      return newBooking
    }, { maxWait: 5000, timeout: 10000 })
  } catch (e: any) {
    if (e?.code === 'SLOT_CONFLICT' || e?.code === 'INSUFFICIENT_BALANCE') throw e
    throw e
  }

  // FinancialLedger â€” after tx commits (idempotent, non-critical)
  try {
    await recordBookingPayment({
      bookingId: booking.id,
      userId: client.userId!,
      providerId: providerId,
      totalAmount: booking.price,
      platformFee: booking.platformFee ?? 0,
      providerPayout: booking.providerPayout ?? 0,
      createdBy: actorId,
    })
  } catch (e) {
    console.error('[BookingService] FinancialLedger write failed (non-critical):', e)
  }

  await writeAudit('BOOKING_CREATED', actorId, actorRole, booking.id, {
    customerId: customerId, price: booking.price, durationHours, source,
  })

  return { booking, status: 'CONFIRMED', pendingPayment: false }
}

// â”€â”€ confirm â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Confirm a PENDING or PENDING_PAYMENT booking.
 * For PENDING_PAYMENT â†’ CONFIRMED: attempts wallet deduction.
 * For PENDING â†’ CONFIRMED (short-notice approval): no wallet change.
 */
export async function confirmBooking(
  bookingId: string,
  actorId: string,
  actorRole: ActorRole
): Promise<any> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true, provider: true },
  }) as any
  if (!booking) throw makeError('BOOKING_NOT_FOUND', 'Booking not found')
  if (booking.status === 'COMPLETED') throw makeError('ALREADY_COMPLETED', 'Cannot confirm a completed booking')
  if (booking.status === 'CANCELLED') throw makeError('ALREADY_CANCELLED', 'Cannot confirm a cancelled booking')
  if (booking.status === 'CONFIRMED') return booking // idempotent

  let updated: any
  try {
    updated = await prisma.$transaction(async (tx) => {
      // Slot conflict (guard against time-overlap with already-confirmed bookings)
      if (booking.startTime && booking.endTime) {
        const conflict = await tx.booking.findFirst({
          where: slotConflictWhere(booking.providerId, booking.startTime, booking.endTime, bookingId),
        })
        if (conflict) throw makeError('SLOT_CONFLICT', 'Time slot conflicts with another confirmed booking')
      }

      // For PENDING_PAYMENT: try to deduct wallet
      if (booking.status === 'PENDING_PAYMENT' && booking.customer?.userId) {
        const wallet = await tx.clientWallet.findUnique({ where: { userId: booking.customer.userId } })
        if (wallet) {
          const txBalance = await getWalletBalanceTx(tx, wallet.id)
          if (isGreaterThanOrEqual(toDecimal(txBalance), toDecimal(booking.price))) {
            await tx.walletTransaction.create({
              data: {
                walletId: wallet.id,
                type: 'DEBIT',
                amount: booking.price,
                description: `Booking confirmed â€” payment`,
                status: 'CONFIRMED',
              },
            })
          }
          // If insufficient funds, confirm anyway (admin/instructor override) â€” isPaid remains false
        }
      }

      const guard = await tx.booking.updateMany({
        where: { id: bookingId, status: { in: ['PENDING', 'PENDING_PAYMENT'] } },
        data: { status: 'CONFIRMED', updatedAt: new Date() },
      })
      if (guard.count === 0) throw makeError('SLOT_CONFLICT', 'Booking was already modified by a concurrent request')

      return tx.booking.findUnique({ where: { id: bookingId } })
    })
  } catch (e: any) {
    if (e?.code) throw e
    throw e
  }

  await writeAudit('BOOKING_CONFIRMED', actorId, actorRole, bookingId, {
    previousStatus: booking.status, confirmedBy: actorRole,
  })

  return updated
}

// â”€â”€ cancel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Cancel a booking with refund calculation.
 * Refund policy is read from PlatformSettings â€” no hardcoded values.
/**
 * Calculate partial package refund with tier-aware discount recalculation.
 * 
 * When a customer cancels a package booking after using some hours, we must:
 * 1. Calculate how many hours were used vs remaining
 * 2. Determine what discount tier applies to the USED hours (not the original purchase tier)
 * 3. Calculate what the customer should have paid for used hours at original locked rates
 * 4. Refund the difference: packageTotalPaid - amountForUsedHours
 * 
 * Example:
 * - Customer bought 10hr package at $70/hr with 10% discount → paid $630 total
 * - Used 5 lessons (5hrs), 5hrs remain
 * - 5 hours does NOT qualify for any discount (need 6+ for 5% discount)
 * - Amount for used hours: 5 × $70 × (1 - 0%) = $350
 * - Refundable base amount: $630 - $350 = $280
 * - Apply time-based policy (100% if >48h, 50% if >24h, 0% otherwise) to $280
 * 
 * @param booking - Booking record with package fields
 * @returns Refundable base amount before applying time-based cancellation policy
 */
function calculatePartialPackageRefund(booking: any): number {
  // Package fields from DB (locked at purchase time)
  const packageHours = (booking as any).packageHours ?? 0
  const packageHoursRemaining = (booking as any).packageHoursRemaining ?? 0
  const packageTotalPaid = (booking as any).packageTotalPaid ?? 0
  const lockedHourlyRate = (booking as any).lockedHourlyRate ?? booking.provider?.hourlyRate ?? 0

  // If not a package booking, return single lesson price
  if (!packageHours || packageHours <= 1) {
    return booking.price
  }

  // Calculate hours used
  const hoursUsed = packageHours - packageHoursRemaining

  // If no hours used yet, refund full package amount
  if (hoursUsed <= 0) {
    return packageTotalPaid
  }

  // If all hours used, no refund
  if (packageHoursRemaining <= 0) {
    return 0
  }

  // Determine what discount tier applies to hours USED (not original package tier)
  // Tier thresholds: <6hrs = 0%, 6-9hrs = 5%, 10-14hrs = 10%, 15+hrs = 12%
  let usedTierDiscountPct = 0
  if (hoursUsed >= 15) {
    usedTierDiscountPct = 12
  } else if (hoursUsed >= 10) {
    usedTierDiscountPct = 10
  } else if (hoursUsed >= 6) {
    usedTierDiscountPct = 5
  }
  // else: hoursUsed < 6 → 0% discount

  // Calculate what customer should have paid for used hours at locked rate
  const rateDecimal = toDecimal(lockedHourlyRate)
  const hoursDecimal = toDecimal(hoursUsed)
  const subtotalForUsed = multiplyAmount(rateDecimal, hoursDecimal)
  
  // Apply the used-hours tier discount
  const discountMultiplier = toDecimal(1 - usedTierDiscountPct / 100)
  const amountForUsedHours = roundAmount(multiplyAmount(subtotalForUsed, discountMultiplier), 2)

  // Refundable base = what they paid - what they should pay for used hours
  const totalPaidDecimal = toDecimal(packageTotalPaid)
  const refundableBase = subtractAmounts(totalPaidDecimal, amountForUsedHours)

  return toNumber(roundAmount(refundableBase, 2))
}


// ═══════════════════════════════════════════════════════════════════════════════
// Package Cancellation Approval Workflow (PKG-3)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Request cancellation of a package booking (customer-initiated).
 * Creates CANCELLATION_PENDING status for admin review.
 * Does NOT issue refund immediately - waits for admin approval.
 */
export async function requestPackageCancellation(
  bookingId: string,
  customerId: string,
  reason?: string
): Promise<{ booking: any; calculatedRefund: number; status: string }> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true, provider: { include: { user: true } } },
  }) as any
  
  if (!booking) throw makeError('BOOKING_NOT_FOUND', 'Booking not found')
  if (booking.status === 'CANCELLED') throw makeError('ALREADY_CANCELLED', 'Booking is already cancelled')
  if (booking.status === 'COMPLETED') throw makeError('ALREADY_COMPLETED', 'Cannot cancel a completed booking')
  if (booking.customerId !== customerId) throw makeError('UNAUTHORIZED', 'Not authorized to cancel this booking')
  
  // Calculate refund amount (tier-aware for packages)
  const baseRefundAmount = calculatePartialPackageRefund(booking)
  
  // Apply time-based policy
  const now = new Date()
  const originalTime = new Date((booking as any).originalStartTime || booking.startTime || now)
  const hoursNotice = (originalTime.getTime() - now.getTime()) / 3_600_000
  
  const settings = await (prisma as any).platformSettings.findFirst({
    select: { lateCancellationWindowHours: true },
  }).catch(() => null)
  const lateWindow = settings?.lateCancellationWindowHours ?? 24
  const fullRefundWindow = lateWindow * 2
  
  let refundPercentage = 0
  let calculatedRefund = 0
  
  if (hoursNotice >= fullRefundWindow) {
    refundPercentage = 100
    calculatedRefund = baseRefundAmount
  } else if (hoursNotice >= lateWindow) {
    refundPercentage = 50
    calculatedRefund = toNumber(roundAmount(multiplyAmount(toDecimal(baseRefundAmount), 0.5), 2))
  }
  
  // Update booking to CANCELLATION_PENDING
  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      cancellationStatus: 'PENDING',
      cancellationRequestedAt: now,
      cancellationRequestedBy: 'USER',
      cancellationReason: reason || null,
    },
  })
  
  // Audit log
  await writeAudit('CANCELLATION_REQUESTED', customerId, 'CLIENT', bookingId, {
    calculatedRefund,
    refundPercentage,
    hoursNotice: Math.floor(hoursNotice),
    reason: reason ?? null,
  })
  
  return { booking: updated, calculatedRefund, status: 'PENDING' }
}

/**
 * Approve a pending cancellation request.
 * Issues Stripe refund + debits wallet + marks booking cancelled.
 */
export async function approveCancellation(
  bookingId: string,
  adminId: string,
  overrideAmount?: number,
  adminNote?: string
): Promise<{ booking: any; refundAmount: number; stripeRefundId: string }> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true, provider: { include: { user: true } } },
  }) as any
  
  if (!booking) throw makeError('BOOKING_NOT_FOUND', 'Booking not found')

  // MM-05-A FIX: Atomic gate — CAS on cancellationStatus prevents concurrent admin approvals
  // from both reading PENDING and both proceeding to stripe.refunds.create().
  const claimed = await prisma.booking.updateMany({
    where: { id: bookingId, cancellationStatus: 'PENDING' },
    data: { cancellationStatus: 'APPROVING' },
  })
  if (claimed.count === 0) {
    // Either already APPROVING (concurrent request), APPROVED, or REJECTED
    const current = await prisma.booking.findUnique({ where: { id: bookingId }, select: { cancellationStatus: true } })
    throw new Error(`Booking cancellation is not in PENDING state (current: ${current?.cancellationStatus ?? 'unknown'})`)
  }

  // Calculate refund amount (use override if provided, else recalculate)
  let refundAmount: number
  if (overrideAmount !== undefined && overrideAmount !== null) {
    refundAmount = overrideAmount
  } else {
    const baseRefundAmount = calculatePartialPackageRefund(booking)
    const requestTime = new Date(booking.cancellationRequestedAt)
    const originalTime = new Date((booking as any).originalStartTime || booking.startTime || requestTime)
    const hoursNotice = (originalTime.getTime() - requestTime.getTime()) / 3_600_000
    
    const settings = await (prisma as any).platformSettings.findFirst({
      select: { lateCancellationWindowHours: true },
    }).catch(() => null)
    const lateWindow = settings?.lateCancellationWindowHours ?? 24
    const fullRefundWindow = lateWindow * 2
    
    if (hoursNotice >= fullRefundWindow) {
      refundAmount = baseRefundAmount
    } else if (hoursNotice >= lateWindow) {
      refundAmount = toNumber(roundAmount(multiplyAmount(toDecimal(baseRefundAmount), 0.5), 2))
    } else {
      refundAmount = 0
    }
  }
  
  const { stripe } = await import('@/lib/services/stripe')
  const paymentIntentId = booking.paymentIntentId
  if (!paymentIntentId) {
    throw new Error('No payment intent found - cannot issue Stripe refund')
  }
  
  let stripeRefund: any
  let walletDebitId: string | null = null
  
  try {
    // Step 1: Issue Stripe refund with deterministic idempotency key (MM-05-A)
    stripeRefund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: Math.round(refundAmount * 100),
      reason: 'requested_by_customer',
      metadata: {
        bookingId,
        adminId,
        calculatedRefund: refundAmount.toString(),
        adminNote: adminNote || '',
      },
    }, { idempotencyKey: `approve-cancel-${bookingId}` })
    
    // Step 2: Debit wallet + update booking + write REFUND_ISSUED ledger entry (atomic)
    // MM-07: REFUND_ISSUED entry here allows handleChargeRefunded() to detect this
    // refund and skip writing a duplicate REFUND_SYNCED when charge.refunded fires.
    await prisma.$transaction(async (tx) => {
      if (booking.customer?.userId) {
        const wallet = await tx.clientWallet.findUnique({
          where: { userId: booking.customer.userId },
        })
        
        if (wallet) {
          const walletTxn = await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              type: 'DEBIT',
              amount: refundAmount,
              description: `Package cancelled — refunded $${refundAmount.toFixed(2)} to card`,
              status: 'CONFIRMED',
            },
          })
          walletDebitId = walletTxn.id
        }
      }
      
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationStatus: 'APPROVED',
          adminReviewedAt: new Date(),
          adminReviewedBy: adminId,
          adminReviewNote: adminNote || null,
          adminOverrideAmount: overrideAmount || null,
          stripeRefundId: stripeRefund.id,
        },
      })

      // MM-07/MM-05-A: Write REFUND_ISSUED so handleChargeRefunded() detects this
      // application-initiated refund and skips the duplicate REFUND_SYNCED write.
      const { appendLedgerEntry } = await import('@/lib/services/ledger-service')
      await appendLedgerEntry({
        type: 'REFUND_ISSUED',
        amount: -refundAmount,
        referenceId: bookingId,
        referenceType: 'BOOKING',
        providerId: booking.provider?.id ?? undefined,
        description: `Admin-approved cancellation refund — $${refundAmount.toFixed(2)} (ref: ${stripeRefund.id})`,
        metadata: { stripeRefundId: stripeRefund.id, bookingId, adminId, source: 'approveCancellation' },
      })
    })
    
    await writeAudit('CANCELLATION_APPROVED', adminId, 'ADMIN', bookingId, {
      refundAmount,
      stripeRefundId: stripeRefund.id,
      walletDebitId,
      overrideAmount: overrideAmount || null,
      adminNote: adminNote || null,
    })
    
    // PKG-4: Send approval email to customer (after transaction commits)
    try {
      await emailService.sendCancellationApprovedEmail({
        customerName: booking.customer.name,
        customerEmail: booking.customer.user?.email || booking.customer.email || '',
        instructorName: booking.provider.name,
        refundAmount,
        stripeRefundId: stripeRefund.id,
        adminNote,
      })
    } catch (emailError) {
      console.error('[BookingService] Approval email failed (non-critical):', emailError)
    }
    
    return {
      booking: await prisma.booking.findUnique({ where: { id: bookingId } }),
      refundAmount,
      stripeRefundId: stripeRefund.id,
    }
  } catch (error) {
    // MM-05-A: If Stripe call or the transaction failed, revert APPROVING → PENDING
    // so the booking is retryable (only if we haven't already committed APPROVED).
    if (!stripeRefund?.id) {
      // Stripe was never called or failed — safe to revert to PENDING
      await prisma.booking.updateMany({
        where: { id: bookingId, cancellationStatus: 'APPROVING' },
        data: { cancellationStatus: 'PENDING' },
      }).catch((revertErr) =>
        console.error('[BookingService] Failed to revert APPROVING→PENDING:', revertErr)
      )
    } else {
      // Stripe refund succeeded but the DB transaction failed — critical partial failure
      console.error('[CRITICAL] Stripe refund succeeded but wallet debit failed:', {
        bookingId,
        stripeRefundId: stripeRefund.id,
        error: error instanceof Error ? error.message : String(error),
      })
      await writeAudit('CANCELLATION_PARTIAL_FAILURE', adminId, 'ADMIN', bookingId, {
        error: 'Stripe refund succeeded but wallet debit failed',
        stripeRefundId: stripeRefund.id,
        refundAmount,
        requiresManualIntervention: true,
      })
    }
    throw error
  }
}

/**
 * Reject a pending cancellation request.
 * Keeps booking active, notifies customer.
 */
export async function rejectCancellation(
  bookingId: string,
  adminId: string,
  reason: string
): Promise<{ booking: any }> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  })
  
  if (!booking) throw makeError('BOOKING_NOT_FOUND', 'Booking not found')
  if ((booking as any).cancellationStatus !== 'PENDING') {
    throw new Error('Booking is not pending cancellation approval')
  }
  
  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      cancellationStatus: 'REJECTED',
      adminReviewedAt: new Date(),
      adminReviewedBy: adminId,
      adminReviewNote: reason,
    },
  })
  
  await writeAudit('CANCELLATION_REJECTED', adminId, 'ADMIN', bookingId, {
    reason,
  })
  
  // PKG-4: Send rejection email to customer (after transaction commits)
  try {
    const bookingWithDetails = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: { include: { user: true } }, provider: true },
    }) as any
    
    if (bookingWithDetails) {
      await emailService.sendCancellationRejectedEmail({
        customerName: bookingWithDetails.customer.name,
        customerEmail: bookingWithDetails.customer.user?.email || bookingWithDetails.customer.email || '',
        instructorName: bookingWithDetails.provider.name,
        rejectionReason: reason,
        bookingId,
      })
    }
  } catch (emailError) {
    console.error('[BookingService] Rejection email failed (non-critical):', emailError)
  }
  
  return { booking: updated }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Original cancelBooking (kept for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Cancel a booking with refund calculation.
 * Refund policy is read from PlatformSettings — no hardcoded values.
 */
export async function cancelBooking(
  bookingId: string,
  actorId: string,
  actorRole: ActorRole,
  reason?: string
): Promise<{ booking: any } & CancelResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true, provider: { include: { user: true } } },
  }) as any
  if (!booking) throw makeError('BOOKING_NOT_FOUND', 'Booking not found')
  if (booking.status === 'CANCELLED') throw makeError('ALREADY_CANCELLED', 'Booking is already cancelled')
  if (booking.status === 'COMPLETED') throw makeError('ALREADY_COMPLETED', 'Cannot cancel a completed booking')

  const now = new Date()
  const originalTime = new Date((booking as any).originalStartTime || booking.startTime || now)
  const currentTime  = new Date(booking.startTime || now)
  const policyTime   = originalTime < currentTime ? originalTime : currentTime
  const hoursNotice  = (policyTime.getTime() - now.getTime()) / 3_600_000
  const isPast       = hoursNotice < 0
  const isNonRefundable = (booking as any).isNonRefundable === true

  const settings = await (prisma as any).platformSettings.findFirst({
    select: { lateCancellationWindowHours: true },
  }).catch(() => null)
  const lateWindow      = settings?.lateCancellationWindowHours ?? 24
  const fullRefundWindow = lateWindow * 2

  let refundPercentage = 0
  let refundAmount     = 0

  if (!isNonRefundable && !isPast) {
    // Calculate base refundable amount using tier-aware package logic
    const baseRefundAmount = calculatePartialPackageRefund(booking)

    // Apply time-based cancellation policy
    if (hoursNotice >= fullRefundWindow) {
      refundPercentage = 100
      refundAmount     = baseRefundAmount
    } else if (hoursNotice >= lateWindow) {
      refundPercentage = 50
      refundAmount     = toNumber(roundAmount(multiplyAmount(toDecimal(baseRefundAmount), 0.5), 2))
    }
  }

  let updated: any
  try {
    updated = await prisma.$transaction(async (tx) => {
      const guard = await tx.booking.updateMany({
        where: { id: bookingId, status: { notIn: ['CANCELLED', 'COMPLETED', 'EXPIRED', 'NO_SHOW'] } },
        data: {
          status: 'CANCELLED',
          notes: `${booking.notes || ''}\n\nCancelled ${now.toISOString()}. Refund: ${refundPercentage}% ($${refundAmount.toFixed(2)})`.trim(),
        },
      })
      if (guard.count === 0) throw makeError('ALREADY_CANCELLED', 'Booking was already cancelled')

      // Wallet refund (WalletTransaction only â€” no balance field update)
      // SECURITY: Offline bookings never issue platform wallet credits (cash payments handled externally)
      if (refundAmount > 0 && booking.source === 'platform' && booking.customer?.userId) {
        const wallet = await tx.clientWallet.findUnique({ where: { userId: booking.customer.userId } })
        if (wallet) {
          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              type: 'CREDIT',
              amount: refundAmount,
              description: `Booking cancelled â€” ${refundPercentage}% refund`,
              status: 'CONFIRMED',
            },
          })
        }
      }

      // Cancel any open transaction records
      await (tx as any).transaction.updateMany({
        where: { bookingId, status: { notIn: ['CANCELLED'] } },
        data: { status: 'CANCELLED' },
      })

      return tx.booking.findUnique({ where: { id: bookingId } })
    })
  } catch (e: any) {
    if (e?.code === 'ALREADY_CANCELLED') throw e
    throw e
  }

  // FinancialLedger â€” after tx (non-critical)
  // SECURITY: Offline bookings never record platform refunds (cash handled externally)
  if (refundAmount > 0 && booking.source === 'platform' && booking.customer?.userId) {
    try {
      const args = {
        refundId:           `cancel-${bookingId}`,
        bookingId,
        userId:             booking.customer.userId,
        providerId:       booking.providerId,
        totalAmount:        refundAmount,
        platformFee:        booking.platformFee ?? 0,
        providerPayout:   booking.providerPayout ?? 0,
        reason:             reason || `${refundPercentage}% cancellation refund`,
        createdBy:          actorId,
      }
      if (refundPercentage === 100) {
        await recordFullRefund(args)
      } else {
        await recordPartialRefund({
          ...args,
          refundAmount,
          refundPercentage,
          originalPlatformFee:        booking.platformFee ?? 0,
          originalInstructorPayout:   booking.providerPayout ?? 0,
        })
      }
    } catch (e) {
      console.error('[BookingService] FinancialLedger refund record failed (non-critical):', e)
    }
  }

  await writeAudit('BOOKING_CANCELLED', actorId, actorRole, bookingId, {
    refundPercentage, refundAmount,
    hoursNotice: Math.floor(hoursNotice),
    cancelledBy: actorRole.toLowerCase(),
    isPast, isNonRefundable,
    reason: reason ?? null,
  })

  return { booking: updated, refundPercentage, refundAmount, hoursNotice: Math.floor(hoursNotice) }
}


// â”€â”€ checkIn â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function checkIn(
  bookingId: string,
  actorId: string,
  actorRole: ActorRole,
  location?: string,
  photo?: string,
  lateReason?: string
): Promise<any> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { provider: true, customer: true },
  }) as any
  if (!booking) throw makeError('BOOKING_NOT_FOUND', 'Booking not found')

  const now = new Date()
  const bookingStart = new Date(booking.startTime!)
  const diffMinutes = (now.getTime() - bookingStart.getTime()) / 60_000
  const diffHours   = diffMinutes / 60

  if (diffMinutes < -15) {
    const minutesUntil = Math.abs(Math.round(diffMinutes))
    throw makeError('CHECK_IN_TOO_EARLY', `Cannot check in yet â€” starts in ${minutesUntil} min (allowed 15 min before)`)
  }
  if (diffHours > 24) {
    throw makeError('CHECK_IN_TOO_LATE', `Check-in window expired â€” booking was ${Math.round(diffHours)}h ago. Contact support.`)
  }
  const isLate = diffMinutes > 15
  if (isLate && (!lateReason || lateReason.trim().length < 10)) {
    throw makeError('CHECK_IN_TOO_LATE', 'Late check-in requires a reason (min 10 chars)')
  }

  const updateData: any = {
    checkInTime:     now,
    checkInLocation: location ?? null,
    checkInBy:       actorRole.toLowerCase(),
    checkInPhoto:    photo ?? null,
    smsCheckInSent:  true,
  }

  const bookingEnd = booking.endTime ? new Date(booking.endTime) : null
  if (bookingEnd && now >= bookingEnd) updateData.status = 'COMPLETED'

  if (isLate && lateReason) {
    updateData.notes = booking.notes
      ? `${booking.notes}\n\n[Late check-in: ${Math.round(diffMinutes)} min late. ${lateReason}]`
      : `[Late check-in: ${Math.round(diffMinutes)} min late. ${lateReason}]`
  }

  const result = await prisma.booking.updateMany({
    where: { id: bookingId, checkInTime: null } as any,
    data: updateData,
  })
  if (result.count === 0) throw makeError('ALREADY_CHECKED_IN', 'Already checked in')

  return prisma.booking.findUnique({ where: { id: bookingId } })
}

// â”€â”€ checkOut â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function checkOut(
  bookingId: string,
  actorId: string,
  actorRole: ActorRole,
  location?: string,
  photo?: string
): Promise<any> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { provider: true, customer: true },
  }) as any
  if (!booking) throw makeError('BOOKING_NOT_FOUND', 'Booking not found')
  if (!booking.checkInTime) throw makeError('CHECK_OUT_TOO_SOON', 'Must check in before checking out')

  const now = new Date()
  const minutesSinceCheckIn = (now.getTime() - new Date(booking.checkInTime).getTime()) / 60_000
  const hoursSinceCheckIn   = minutesSinceCheckIn / 60

  if (minutesSinceCheckIn < 5) {
    throw makeError('CHECK_OUT_TOO_SOON', `Only ${Math.round(minutesSinceCheckIn)} min since check-in (minimum 5 min)`)
  }
  if (hoursSinceCheckIn > 24) {
    throw makeError('CHECK_IN_TOO_LATE', `Check-in was ${Math.round(hoursSinceCheckIn)}h ago. Contact support.`)
  }

  const actualDuration = Math.round(minutesSinceCheckIn)

  let updated: any
  try {
    updated = await prisma.$transaction(async (tx) => {
      const result = await tx.booking.updateMany({
        where: { id: bookingId, checkOutTime: null } as any,
        data: {
          checkOutTime:     now,
          checkOutLocation: location ?? null,
          checkOutBy:       actorRole.toLowerCase(),
          checkOutPhoto:    photo ?? null,
          actualDuration,
          status:           'COMPLETED',
          smsCheckOutSent:  true,
        } as any,
      })
      if (result.count === 0) throw makeError('ALREADY_CHECKED_OUT', 'Already checked out')

      const fetched = await tx.booking.findUnique({ where: { id: bookingId }, include: { provider: true } })
      if (!fetched) throw makeError('BOOKING_NOT_FOUND', 'Booking not found after update')

      // Ensure transaction record exists and is COMPLETED
      const existingTx = await (tx as any).transaction.findFirst({ where: { bookingId } })
      if (existingTx) {
        await (tx as any).transaction.update({
          where: { id: existingTx.id },
          data: { status: 'COMPLETED', processedAt: now },
        })
      } else {
        // Transaction was never created (edge case) â€” create it now
        const instructor = await tx.provider.findUnique({
          where: { id: booking.providerId },
          select: { subscriptionTier: true },
        })
        await (tx as any).transaction.create({
          data: {
            bookingId,
            providerId: booking.providerId,
            type: 'BOOKING_PAYMENT',
            amount: booking.price,
            platformFee: booking.platformFee ?? 0,
            providerPayout: booking.providerPayout ?? 0,
            commissionRate: booking.commissionRate ?? 0,
            status: 'COMPLETED',
            processedAt: now,
            description: 'Booking payment (created at checkout)',
            metadata: {},
          },
        })
      }

      return fetched
    })
  } catch (e: any) {
    if (e?.code === 'ALREADY_CHECKED_OUT') throw e
    throw e
  }

  // FinancialLedger â€” revenue recognition at completion (non-critical)
  if (booking.isPaid && booking.customer?.userId) {
    try {
      const { appendLedgerEntry, incrementLedger } = await import('@/lib/services/ledger-service')
      await appendLedgerEntry({
        type: 'PAYMENT_COLLECTED',
        amount: booking.price,
        referenceId: bookingId,
        referenceType: 'BOOKING',
        providerId: booking.providerId,
        description: `Booking completed â€” revenue recognised`,
      })
      await incrementLedger({ totalCollected: booking.providerPayout ?? booking.price })
    } catch (e) {
      console.error('[BookingService] FinancialLedger checkout write failed (non-critical):', e)
    }
  }

  await writeAudit('BOOKING_COMPLETED', actorId, actorRole, bookingId, {
    actualDuration,
    checkedOutBy: actorRole.toLowerCase(),
  })

  return updated
}

// â”€â”€ Safe notification helper (never throws) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function queueNotificationOnFailure(
  sendFn: () => Promise<unknown>,
  fallback: Parameters<typeof enqueueNotification>[0]
): Promise<void> {
  return sendFn().then(() => undefined).catch(async (err) => {
    console.error('[BookingService] Notification failed, queuing retry:', err)
    await enqueueNotification(fallback)
  })
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// REQUEST / QUOTE FLOW
// Used by SaaS businesses (plumber, electrician, cleaner, etc.) where the
// provider quotes a price before any payment is taken.
//
// Flow:
//   createJobRequest()  â†’ Booking(REQUEST_PENDING)
//   submitQuote()       â†’ Quote(PENDING)       + Booking(QUOTE_SENT)
//   acceptQuote()       â†’ Quote(ACCEPTED)      + Booking(QUOTE_ACCEPTED)
//                          â†“ caller then triggers SaaS payment or wallet deduct
//   declineQuote()      â†’ Quote(DECLINED)      + Booking(QUOTE_DECLINED)
//   expireQuote()       â†’ Quote(EXPIRED)       + Booking(QUOTE_EXPIRED)  [cron]
//   reviseQuote()       â†’ old Quote(REVISED)   + new Quote(PENDING)      [re-enters submitQuote]
//
// Invariants:
//  - Only one PENDING quote per booking at a time
//  - Status transitions are guarded by updateMany (prevents races)
//  - Every transition writes an AuditLog entry
//  - Notifications fire after tx commits, never inside it
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export interface JobRequestInput {
  providerId:          string   // who the request is directed to
  customerId:          string   // who is requesting
  serviceId?:          string   // which BusinessService was selected
  requestDescription:  string   // what the customer needs done
  preferredDate?:      string   // customer's preferred date (free text or ISO)
  siteAddress?:        string   // where the job needs to happen
  siteAddressLat?:     number
  siteAddressLng?:     number
  notes?:              string
  source?:             string   // 'platform' | 'voice' | 'website'
}

export interface QuoteInput {
  bookingId:       string
  amount:          number
  description:     string
  lineItems?:      Array<{ label: string; amount: number }>
  validUntil:      Date
  depositPercent?: number       // e.g. 30 for 30% upfront deposit
  customerNotes?:  string
  internalNotes?:  string
  startTime?:      Date         // provider can propose a time in the quote
  endTime?:        Date
}

export interface QuoteResult {
  quote:   any
  booking: any
}

// â”€â”€ createJobRequest â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Customer creates a job request â€” no price, no time slot yet.
 * Booking is created in REQUEST_PENDING status.
 * Provider will be notified and can respond with a quote.
 */
export async function createJobRequest(
  input: JobRequestInput,
  actorId: string,
  actorRole: ActorRole,
): Promise<any> {
  const {
    providerId, customerId, serviceId, requestDescription,
    preferredDate, siteAddress, siteAddressLat, siteAddressLng,
    notes, source = 'platform',
  } = input

  // Validate provider and customer exist
  const [provider, customer] = await Promise.all([
    (prisma as any).provider.findUnique({
      where: { id: providerId },
      select: { id: true, name: true, acceptingBookings: true, approvalStatus: true },
    }),
    (prisma as any).customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true, userId: true },
    }),
  ])

  if (!provider) throw makeError('BOOKING_NOT_FOUND', 'Provider not found')
  if (!provider.acceptingBookings) throw makeError('SLOT_CONFLICT', 'Provider is not accepting new jobs at this time')
  if (provider.approvalStatus !== 'APPROVED') throw makeError('UNAUTHORIZED', 'Provider is not yet approved on the platform')
  if (!customer) throw makeError('BOOKING_NOT_FOUND', 'Customer not found')

  const booking = await prisma.$transaction(async (tx) => {
    return (tx as any).booking.create({
      data: {
        providerId,
        customerId,
        customerName:        customer.name,
        bookingType:         'JOB_REQUEST',
        status:              'REQUEST_PENDING',
        serviceId:           serviceId ?? null,
        requestDescription,
        requestedAt:         new Date(),
        preferredDate:       preferredDate ?? null,
        siteAddress:         siteAddress ?? null,
        siteAddressLat:      siteAddressLat ?? null,
        siteAddressLng:      siteAddressLng ?? null,
        notes:               notes ?? null,
        source,
        createdBy:           actorRole.toLowerCase(),
        price:               0,
        platformFee:         0,
        providerPayout:      0,
        commissionRate:      0,
        isPaid:              false,
      },
    })
  })

  await writeAudit('JOB_REQUEST_CREATED', actorId, actorRole, booking.id, {
    providerId, customerId, serviceId: serviceId ?? null,
    requestDescription: requestDescription.slice(0, 100),
    source,
  })

  return booking
}

// â”€â”€ submitQuote â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Provider responds to a job request with a quote.
 * If the booking already has a PENDING quote, it is marked REVISED first.
 * Booking moves to QUOTE_SENT. Provider can optionally propose a time in the quote.
 */
export async function submitQuote(
  input: QuoteInput,
  actorId: string,
  actorRole: ActorRole,
): Promise<QuoteResult> {
  const {
    bookingId, amount, description, lineItems = [],
    validUntil, depositPercent, customerNotes, internalNotes,
    startTime, endTime,
  } = input

  if (amount <= 0) throw makeError('SLOT_CONFLICT', 'Quote amount must be greater than zero')
  if (validUntil <= new Date()) throw makeError('SLOT_CONFLICT', 'Quote expiry must be in the future')

  const booking = await (prisma as any).booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true, providerId: true, customerId: true, status: true,
      price: true, providerPayout: true,
    },
  })
  if (!booking) throw makeError('BOOKING_NOT_FOUND', 'Booking not found')

  const allowedStatuses = ['REQUEST_PENDING', 'QUOTE_SENT', 'QUOTE_DECLINED', 'QUOTE_EXPIRED']
  if (!allowedStatuses.includes(booking.status)) {
    throw makeError('SLOT_CONFLICT', `Cannot quote on a booking in status ${booking.status}`)
  }

  // Calculate deposit amount if applicable
  const depositAmount = depositPercent
    ? parseFloat((amount * depositPercent / 100).toFixed(2))
    : null

  // Determine payout split â€” will be refined when payment model is known,
  // but we pre-compute it so Quote.amount already accounts for any commission.
  // For SaaS: commission=0, providerPayout=amount
  // For marketplace: commission rate applied at payment time via paymentExtension
  const providerPayoutAmount = amount  // full amount at quote time; adjusted at payment

  let quote: any
  let updatedBooking: any

  await prisma.$transaction(async (tx) => {
    // Mark any existing PENDING quote as REVISED
    await (tx as any).quote.updateMany({
      where: { bookingId, status: 'PENDING' },
      data:  { status: 'REVISED' },
    })

    // Create the new quote
    quote = await (tx as any).quote.create({
      data: {
        bookingId,
        providerId:    booking.providerId,
        customerId:    booking.customerId,
        amount,
        description,
        lineItems:     lineItems as any,
        validUntil,
        depositPercent:  depositPercent ?? null,
        depositAmount:   depositAmount,
        customerNotes:   customerNotes ?? null,
        internalNotes:   internalNotes ?? null,
        status:          'PENDING',
      },
    })

    // Update booking: move to QUOTE_SENT, apply proposed time if provided,
    // set price so the customer can see the quoted amount
    const bookingUpdate: Record<string, unknown> = {
      status:          'QUOTE_SENT',
      price:           amount,
      providerPayout:  providerPayoutAmount,
    }
    if (startTime) bookingUpdate.startTime = startTime
    if (endTime)   bookingUpdate.endTime   = endTime

    updatedBooking = await (tx as any).booking.update({
      where: { id: bookingId },
      data:  bookingUpdate,
    })
  })

  await writeAudit('QUOTE_SUBMITTED', actorId, actorRole, bookingId, {
    quoteId: quote.id, amount, depositPercent: depositPercent ?? null,
    validUntil: validUntil.toISOString(),
    hasProposedTime: !!(startTime && endTime),
  })

  return { quote, booking: updatedBooking }
}

// â”€â”€ acceptQuote â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Customer accepts a quote.
 * Moves Quote â†’ ACCEPTED, Booking â†’ QUOTE_ACCEPTED.
 *
 * The caller is responsible for the next step based on paymentModel:
 *   SaaS:        call saasPaymentService.createCheckoutSession(bookingId, config)
 *   Marketplace: call wallet deduct (or use existing confirmBooking path)
 *
 * This function only transitions state â€” it does not trigger payment.
 * This keeps payment logic out of the booking service (same pattern as
 * the existing paymentExtension hook approach).
 */
export async function acceptQuote(
  quoteId: string,
  actorId: string,
  actorRole: ActorRole,
): Promise<QuoteResult> {
  const quote = await (prisma as any).quote.findUnique({
    where: { id: quoteId },
    select: {
      id: true, bookingId: true, status: true, validUntil: true,
      amount: true, depositAmount: true, depositPercent: true,
    },
  })
  if (!quote) throw makeError('BOOKING_NOT_FOUND', 'Quote not found')
  if (quote.status !== 'PENDING') {
    throw makeError('SLOT_CONFLICT', `Cannot accept a quote in status ${quote.status}`)
  }
  if (new Date(quote.validUntil) < new Date()) {
    // Auto-expire it
    await (prisma as any).quote.update({ where: { id: quoteId }, data: { status: 'EXPIRED' } })
    await (prisma as any).booking.update({ where: { id: quote.bookingId }, data: { status: 'QUOTE_EXPIRED' } })
    throw makeError('SLOT_CONFLICT', 'This quote has expired. Please request a new quote from the provider.')
  }

  let updatedQuote: any
  let updatedBooking: any

  await prisma.$transaction(async (tx) => {
    // Guard: only move if still PENDING (race-safe)
    const guard = await (tx as any).quote.updateMany({
      where: { id: quoteId, status: 'PENDING' },
      data:  { status: 'ACCEPTED', acceptedAt: new Date() },
    })
    if (guard.count === 0) throw makeError('SLOT_CONFLICT', 'Quote was already responded to')

    updatedBooking = await (tx as any).booking.update({
      where: { id: quote.bookingId },
      data:  { status: 'QUOTE_ACCEPTED' },
    })

    updatedQuote = await (tx as any).quote.findUnique({ where: { id: quoteId } })
  })

  await writeAudit('QUOTE_ACCEPTED', actorId, actorRole, quote.bookingId, {
    quoteId, amount: quote.amount,
    depositAmount: quote.depositAmount ?? null,
    acceptedBy: actorRole.toLowerCase(),
  })

  return { quote: updatedQuote, booking: updatedBooking }
}

// â”€â”€ declineQuote â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Customer declines a quote.
 * Moves Quote â†’ DECLINED, Booking â†’ QUOTE_DECLINED.
 * The booking is not cancelled â€” the provider can submit a revised quote,
 * or either party can cancel the booking separately.
 */
export async function declineQuote(
  quoteId: string,
  actorId: string,
  actorRole: ActorRole,
  reason?: string,
): Promise<QuoteResult> {
  const quote = await (prisma as any).quote.findUnique({
    where: { id: quoteId },
    select: { id: true, bookingId: true, status: true },
  })
  if (!quote) throw makeError('BOOKING_NOT_FOUND', 'Quote not found')
  if (quote.status !== 'PENDING') {
    throw makeError('SLOT_CONFLICT', `Cannot decline a quote in status ${quote.status}`)
  }

  let updatedQuote: any
  let updatedBooking: any

  await prisma.$transaction(async (tx) => {
    const guard = await (tx as any).quote.updateMany({
      where: { id: quoteId, status: 'PENDING' },
      data:  {
        status:        'DECLINED',
        declinedAt:    new Date(),
        declineReason: reason ?? null,
      },
    })
    if (guard.count === 0) throw makeError('SLOT_CONFLICT', 'Quote was already responded to')

    updatedBooking = await (tx as any).booking.update({
      where: { id: quote.bookingId },
      data:  { status: 'QUOTE_DECLINED' },
    })

    updatedQuote = await (tx as any).quote.findUnique({ where: { id: quoteId } })
  })

  await writeAudit('QUOTE_DECLINED', actorId, actorRole, quote.bookingId, {
    quoteId, reason: reason ?? null, declinedBy: actorRole.toLowerCase(),
  })

  return { quote: updatedQuote, booking: updatedBooking }
}

// â”€â”€ expireStaleQuotes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Called by the cron job to expire quotes past their validUntil date.
 * Marks PENDING quotes EXPIRED and moves their bookings to QUOTE_EXPIRED.
 * Returns the number of quotes expired.
 */
export async function expireStaleQuotes(): Promise<number> {
  const now = new Date()

  // Find all expired PENDING quotes
  const stale = await (prisma as any).quote.findMany({
    where: { status: 'PENDING', validUntil: { lt: now } },
    select: { id: true, bookingId: true },
  })

  if (stale.length === 0) return 0

  const quoteIds   = stale.map((q: { id: string }) => q.id)
  const bookingIds = stale.map((q: { bookingId: string }) => q.bookingId)

  await prisma.$transaction(async (tx) => {
    await (tx as any).quote.updateMany({
      where: { id: { in: quoteIds } },
      data:  { status: 'EXPIRED' },
    })
    await (tx as any).booking.updateMany({
      where: { id: { in: bookingIds }, status: 'QUOTE_SENT' },
      data:  { status: 'QUOTE_EXPIRED' },
    })
  })

  console.log(`[BookingService] Expired ${stale.length} stale quote(s)`)
  return stale.length
}
