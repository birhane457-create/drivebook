/**
 * lib/extensions/driving/payment-extension.ts
 *
 * Driving vertical payment extension.
 *
 * The driving school model is a marketplace:
 *   Customer prepays → Platform holds funds → Platform pays provider (Stripe Connect)
 *
 * This is vertical-specific. Core BookingService calls the hooks defined here.
 * Core never imports wallet, ledger, or payout code directly.
 *
 * Other verticals (plumber, tax, beauty) do NOT register a payment extension.
 * Their bookings confirm without any payment side-effects — providers charge
 * customers directly, platform earns via SaaS subscription only.
 */

import { prisma } from '@/lib/prisma'
import { enqueueNotification } from '@/lib/services/notificationRetry'

export interface PaymentExtension {
  mode: 'wallet' | 'stripe_direct' | 'invoice' | 'external'

  /**
   * Called by BookingService after a booking is confirmed and payment is expected.
   * For driving: deduct from customer wallet, record in FinancialLedger.
   */
  onBookingConfirmed?(bookingId: string, amount: number): Promise<void>

  /**
   * Called by BookingService after a booking is cancelled.
   * For driving: credit refund to customer wallet, record in FinancialLedger.
   */
  onBookingCancelled?(bookingId: string, refundAmount: number): Promise<void>

  /**
   * Called by BookingService after a booking is completed (checked out).
   * For driving: recognise revenue in FinancialLedger, mark payout as due.
   */
  onBookingCompleted?(bookingId: string): Promise<void>
}

/**
 * Driving payment extension implementation.
 * Registered on the DomainExtension in lib/extensions/driving/index.ts.
 */
export const drivingPaymentExtension: PaymentExtension = {
  mode: 'wallet',

  async onBookingConfirmed(bookingId, amount) {
    // FinancialLedger — non-critical, never throws
    try {
      const { recordBookingPayment } = await import('@/lib/services/ledger-operations')
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: {
          customerId: true,
          platformFee: true,
          providerPayout: true,
          customer: { select: { userId: true } },
        },
      }) as any
      if (booking?.customer?.userId) {
        await recordBookingPayment({
          bookingId,
          userId:           booking.customer.userId,
          providerId:       booking.providerId,
          totalAmount:      amount,
          platformFee:      booking.platformFee ?? 0,
          providerPayout:   booking.providerPayout ?? 0,
          createdBy:        'system',
        })
      }
    } catch (e) {
      console.error('[drivingPaymentExtension.onBookingConfirmed] Ledger write failed (non-critical):', e)
    }
  },

  async onBookingCancelled(bookingId, refundAmount) {
    if (refundAmount <= 0) return
    try {
      const { recordFullRefund } = await import('@/lib/services/ledger-operations')
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: {
          providerId: true,
          platformFee: true,
          providerPayout: true,
          customer: { select: { userId: true } },
        },
      }) as any
      if (booking?.customer?.userId) {
        await recordFullRefund({
          refundId:       `cancel-${bookingId}`,
          bookingId,
          userId:         booking.customer.userId,
          providerId:     booking.providerId,
          totalAmount:    refundAmount,
          platformFee:    booking.platformFee ?? 0,
          providerPayout: booking.providerPayout ?? 0,
          reason:         'Booking cancelled',
          createdBy:      'system',
        })
      }
    } catch (e) {
      console.error('[drivingPaymentExtension.onBookingCancelled] Ledger refund failed (non-critical):', e)
    }
  },

  async onBookingCompleted(bookingId) {
    try {
      const { appendLedgerEntry, incrementLedger } = await import('@/lib/services/ledger-service')
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { price: true, providerPayout: true, isPaid: true },
      }) as any
      if (booking?.isPaid) {
        await appendLedgerEntry({
          type:          'PAYMENT_COLLECTED',
          amount:        booking.price,
          referenceId:   bookingId,
          referenceType: 'BOOKING',
          description:   'Booking completed — revenue recognised',
        })
        await incrementLedger({ totalCollected: booking.providerPayout ?? booking.price })
      }
    } catch (e) {
      console.error('[drivingPaymentExtension.onBookingCompleted] Ledger completion failed (non-critical):', e)
    }
  },
}
