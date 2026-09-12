import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import {
  calculatePercentage,
  subtractAmounts,
  roundAmount,
  sumAmounts,
  toNumber,
  toDecimal,
  addAmounts,
} from '@/lib/utils/decimal-helpers';

export interface CommissionCalculation {
  totalAmount: Decimal;
  platformFee: Decimal;
  providerPayout: Decimal;
  commissionRate: Decimal;
  isFirstBooking: boolean;
}

export class PaymentService {
  /**
   * Calculate commission for a booking.
   *
   * Commission rate is derived from the instructor's subscription tier via
   * getCommissionRate() (DB-backed PlatformSettings, not per-instructor field).
   *
   * newStudentBonus was removed in May 2026 — commission is a flat rate per tier.
   * isFirstBooking is still recorded for analytics but does NOT affect the rate.
   */
  async calculateCommission(
    providerId: string,
    customerId: string,
    bookingAmount: number | Decimal
  ): Promise<CommissionCalculation> {
    const instructor = await prisma.provider.findUnique({
      where: { id: providerId },
      select: { subscriptionTier: true },
    });

    if (!instructor) {
      throw new Error('Instructor not found');
    }

    const isFirstBooking = await this.isFirstBookingWithClient(providerId, customerId);

    // Always use platform-level commission rate — never a per-instructor value
    const { getCommissionRate } = await import('@/lib/services/platform-pricing');
    const commissionRate = await getCommissionRate(instructor.subscriptionTier ?? 'BASIC');

    // Convert to Decimal for exact calculation
    const amount = toDecimal(bookingAmount);
    const rate = toDecimal(commissionRate);
    
    // Calculate platform fee (commission)
    const platformFee = roundAmount(calculatePercentage(amount, rate), 2);
    const providerPayout = roundAmount(subtractAmounts(amount, platformFee), 2);

    return {
      totalAmount: amount,
      platformFee,
      providerPayout,
      commissionRate: rate,
      isFirstBooking,
    };
  }

  /**
   * Check if this is the first completed booking between instructor and client.
   * Recorded on bookings for analytics — no longer affects commission rate.
   */
  async isFirstBookingWithClient(
    providerId: string,
    customerId: string
  ): Promise<boolean> {
    const completedBookings = await prisma.booking.count({
      where: {
        providerId,
        customerId,
        status: 'COMPLETED',
      },
    });

    return completedBookings === 0;
  }

  /**
   * Create transaction record for a booking.
   */
  async createBookingTransaction(
    bookingId: string,
    providerId: string,
    calculation: CommissionCalculation,
    paymentIntentId?: string
  ) {
    return await prisma.transaction.create({
      data: {
        bookingId,
        providerId,
        type: 'BOOKING_PAYMENT',
        amount: calculation.totalAmount,
        platformFee: calculation.platformFee,
        providerPayout: calculation.providerPayout,
        commissionRate: calculation.commissionRate,
        status: 'PENDING',
        stripePaymentIntentId: paymentIntentId,
        description: `Booking payment — ${calculation.isFirstBooking ? 'First booking with client' : 'Repeat booking'}`,
        metadata: {
          isFirstBooking: calculation.isFirstBooking,
        },
      },
    });
  }

  /**
   * Update booking with commission details.
   */
  async updateBookingCommission(
    bookingId: string,
    calculation: CommissionCalculation
  ) {
    return await prisma.booking.update({
      where: { id: bookingId },
      data: {
        platformFee: calculation.platformFee,
        providerPayout: calculation.providerPayout,
        commissionRate: calculation.commissionRate,
        isFirstBooking: calculation.isFirstBooking,
      } as any,
    });
  }

  /**
   * Get instructor's financial summary for a period.
   */
  async getInstructorFinancials(providerId: string, startDate: Date, endDate: Date) {
    const bookings = await prisma.booking.findMany({
      where: {
        providerId,
        status: 'COMPLETED',
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    const subscription = await prisma.subscription.findFirst({
      where: { providerId, status: 'ACTIVE' },
    });

    const totalBookings = bookings.length;
    const firstBookings = bookings.filter((b: any) => b.isFirstBooking).length;
    const repeatBookings = totalBookings - firstBookings;
    
    // Use Decimal for exact aggregation
    const grossRevenue = sumAmounts(bookings.map((b: any) => b.price));
    const platformFees = sumAmounts(bookings.map((b: any) => b.platformFee || 0));
    const netRevenue = sumAmounts(bookings.map((b: any) => b.providerPayout || 0));
    const subscriptionFee = subscription?.monthlyAmount || toDecimal(0);
    const totalPlatformCost = addAmounts(platformFees, subscriptionFee);

    return {
      period: { start: startDate, end: endDate },
      subscription: subscription
        ? { tier: subscription.tier, monthlyFee: toNumber(subscription.monthlyAmount) }
        : null,
      bookings: { total: totalBookings, firstBookings, repeatBookings },
      revenue: {
        gross: toNumber(roundAmount(grossRevenue, 2)),
        platformFees: toNumber(roundAmount(platformFees, 2)),
        subscriptionFees: toNumber(subscriptionFee),
        totalPlatformCost: toNumber(roundAmount(totalPlatformCost, 2)),
        net: toNumber(roundAmount(netRevenue, 2)),
      },
    };
  }
}

export const paymentService = new PaymentService();