import { prisma } from '@/lib/prisma';

export interface CommissionCalculation {
  totalAmount: number;
  platformFee: number;
  instructorPayout: number;
  commissionRate: number;
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
    instructorId: string,
    clientId: string,
    bookingAmount: number
  ): Promise<CommissionCalculation> {
    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
      select: { subscriptionTier: true },
    });

    if (!instructor) {
      throw new Error('Instructor not found');
    }

    const isFirstBooking = await this.isFirstBookingWithClient(instructorId, clientId);

    // Always use platform-level commission rate — never a per-instructor value
    const { getCommissionRate } = await import('@/lib/services/platform-pricing');
    const commissionRate = await getCommissionRate(instructor.subscriptionTier ?? 'BASIC');

    const platformFee = bookingAmount * (commissionRate / 100);
    const instructorPayout = bookingAmount - platformFee;

    return {
      totalAmount: bookingAmount,
      platformFee: Math.round(platformFee * 100) / 100,
      instructorPayout: Math.round(instructorPayout * 100) / 100,
      commissionRate,
      isFirstBooking,
    };
  }

  /**
   * Check if this is the first completed booking between instructor and client.
   * Recorded on bookings for analytics — no longer affects commission rate.
   */
  async isFirstBookingWithClient(
    instructorId: string,
    clientId: string
  ): Promise<boolean> {
    const completedBookings = await prisma.booking.count({
      where: {
        instructorId,
        clientId,
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
    instructorId: string,
    calculation: CommissionCalculation,
    paymentIntentId?: string
  ) {
    return await prisma.transaction.create({
      data: {
        bookingId,
        instructorId,
        type: 'BOOKING_PAYMENT',
        amount: calculation.totalAmount,
        platformFee: calculation.platformFee,
        instructorPayout: calculation.instructorPayout,
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
        instructorPayout: calculation.instructorPayout,
        commissionRate: calculation.commissionRate,
        isFirstBooking: calculation.isFirstBooking,
      } as any,
    });
  }

  /**
   * Get instructor's financial summary for a period.
   */
  async getInstructorFinancials(instructorId: string, startDate: Date, endDate: Date) {
    const bookings = await prisma.booking.findMany({
      where: {
        instructorId,
        status: 'COMPLETED',
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    const subscription = await prisma.subscription.findFirst({
      where: { instructorId, status: 'ACTIVE' },
    });

    const totalBookings = bookings.length;
    const firstBookings = bookings.filter((b: any) => b.isFirstBooking).length;
    const repeatBookings = totalBookings - firstBookings;
    const grossRevenue = bookings.reduce((sum, b) => sum + b.price, 0);
    const platformFees = bookings.reduce((sum, b: any) => sum + (b.platformFee || 0), 0);
    const netRevenue = bookings.reduce((sum, b: any) => sum + (b.instructorPayout || 0), 0);

    return {
      period: { start: startDate, end: endDate },
      subscription: subscription
        ? { tier: subscription.tier, monthlyFee: subscription.monthlyAmount }
        : null,
      bookings: { total: totalBookings, firstBookings, repeatBookings },
      revenue: {
        gross: Math.round(grossRevenue * 100) / 100,
        platformFees: Math.round(platformFees * 100) / 100,
        subscriptionFees: subscription?.monthlyAmount || 0,
        totalPlatformCost: Math.round((platformFees + (subscription?.monthlyAmount || 0)) * 100) / 100,
        net: Math.round(netRevenue * 100) / 100,
      },
    };
  }
}

export const paymentService = new PaymentService();

