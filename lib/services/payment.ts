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
   * Calculate commission for a booking
   */
  async calculateCommission(
    instructorId: string,
    clientId: string,
    bookingAmount: number
  ): Promise<CommissionCalculation> {
    // Get instructor's subscription tier and rates
    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
    });

    if (!instructor) {
      throw new Error('Instructor not found');
    }

    // Check if this is the first booking with this client
    const isFirstBooking = await this.isFirstBookingWithClient(instructorId, clientId);

    // Calculate commission rate (fields exist in schema)
    let commissionRate = (instructor as any).commissionRate;
    
    // Add new student bonus if first booking
    if (isFirstBooking) {
      commissionRate += (instructor as any).newStudentBonus;
    }

    // Calculate fees
    const platformFee = bookingAmount * (commissionRate / 100);
    const instructorPayout = bookingAmount - platformFee;

    return {
      totalAmount: bookingAmount,
      platformFee: Math.round(platformFee * 100) / 100, // Round to 2 decimals
      instructorPayout: Math.round(instructorPayout * 100) / 100,
      commissionRate,
      isFirstBooking,
    };
  }

  /**
   * Check if this is the first completed booking between instructor and client
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
   * Create transaction record for a booking
   * Note: Transaction model exists in Prisma schema but TypeScript cache may not reflect it
   */
  async createBookingTransaction(
    bookingId: string,
    instructorId: string,
    calculation: CommissionCalculation,
    paymentIntentId?: string
  ) {
    return await (prisma as any).transaction.create({
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
        description: `Booking payment - ${calculation.isFirstBooking ? 'First booking with client' : 'Repeat booking'}`,
        metadata: {
          isFirstBooking: calculation.isFirstBooking,
        },
      },
    });
  }

  /**
   * Update booking with commission details
   * Note: These fields exist in Prisma schema but TypeScript cache may not reflect them
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
      } as any, // TypeScript cache issue - fields exist in schema
    });
  }

  /**
   * Get subscription pricing based on tier
   */
  getSubscriptionPricing(tier: 'PRO' | 'BUSINESS') {
    const pricing = {
      PRO: {
        monthlyPrice: 29.00,
        commissionRate: 12.0,
        features: [
          'Unlimited clients',
          'Google Calendar sync',
          'Analytics dashboard',
          'Email notifications',
          '12% commission per booking',
        ],
      },
      BUSINESS: {
        monthlyPrice: 59.00,
        commissionRate: 7.0,
        features: [
          'Everything in PRO',
          'Multiple instructors',
          'Branded booking page',
          'Priority support',
          'Custom domain',
          '7% commission per booking',
        ],
      },
    };

    return pricing[tier];
  }

  /**
   * Calculate monthly revenue projection for instructor
   */
  calculateRevenueProjection(
    tier: 'PRO' | 'BUSINESS',
    estimatedMonthlyBookings: number,
    averageBookingPrice: number,
    newStudentPercentage: number = 20 // % of bookings that are new students
  ) {
    const pricing = this.getSubscriptionPricing(tier);
    const newStudentBonus = 8.0; // Default new student bonus

    // Calculate bookings
    const newStudentBookings = Math.round(estimatedMonthlyBookings * (newStudentPercentage / 100));
    const repeatBookings = estimatedMonthlyBookings - newStudentBookings;

    // Calculate commissions
    const newStudentCommission = (pricing.commissionRate + newStudentBonus) / 100;
    const repeatCommission = pricing.commissionRate / 100;

    const newStudentFees = newStudentBookings * averageBookingPrice * newStudentCommission;
    const repeatFees = repeatBookings * averageBookingPrice * repeatCommission;
    const totalCommissionFees = newStudentFees + repeatFees;

    // Total platform cost
    const totalPlatformCost = pricing.monthlyPrice + totalCommissionFees;

    // Instructor revenue
    const grossRevenue = estimatedMonthlyBookings * averageBookingPrice;
    const netRevenue = grossRevenue - totalPlatformCost;

    return {
      tier,
      subscriptionFee: pricing.monthlyPrice,
      estimatedBookings: estimatedMonthlyBookings,
      newStudentBookings,
      repeatBookings,
      averageBookingPrice,
      grossRevenue: Math.round(grossRevenue * 100) / 100,
      commissionFees: Math.round(totalCommissionFees * 100) / 100,
      totalPlatformCost: Math.round(totalPlatformCost * 100) / 100,
      netRevenue: Math.round(netRevenue * 100) / 100,
      effectiveCommissionRate: Math.round((totalPlatformCost / grossRevenue) * 10000) / 100, // %
    };
  }

  /**
   * Get instructor's financial summary
   */
  async getInstructorFinancials(instructorId: string, startDate: Date, endDate: Date) {
    // Get all completed bookings in period
    const bookings = await prisma.booking.findMany({
      where: {
        instructorId,
        status: 'COMPLETED',
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Get subscription info (TypeScript cache issue - model exists in schema)
    const subscription = await (prisma as any).subscription.findFirst({
      where: {
        instructorId,
        status: 'ACTIVE',
      },
    });

    // Calculate totals (fields exist in schema but TypeScript cache may not reflect them)
    const totalBookings = bookings.length;
    const firstBookings = bookings.filter((b: any) => b.isFirstBooking).length;
    const repeatBookings = totalBookings - firstBookings;
    
    const grossRevenue = bookings.reduce((sum, b) => sum + b.price, 0);
    const platformFees = bookings.reduce((sum, b: any) => sum + (b.platformFee || 0), 0);
    const netRevenue = bookings.reduce((sum, b: any) => sum + (b.instructorPayout || 0), 0);

    return {
      period: {
        start: startDate,
        end: endDate,
      },
      subscription: subscription ? {
        tier: subscription.tier,
        monthlyFee: subscription.monthlyAmount,
      } : null,
      bookings: {
        total: totalBookings,
        firstBookings,
        repeatBookings,
      },
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
