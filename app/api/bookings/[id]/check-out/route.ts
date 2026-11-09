import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { smsService } from '@/lib/services/sms';
import { bookingActionRateLimit, checkRateLimitStrict, getRateLimitIdentifier } from '@/lib/ratelimit';
import jwt from 'jsonwebtoken';


export const dynamic = 'force-dynamic';
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Try JWT authentication first (for mobile)
    const authHeader = req.headers.get('authorization');
    let userId: string | undefined;
    let userRole: string | undefined;
    let providerId: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Mobile JWT authentication
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as {
          userId: string;
          role: string;
          providerId?: string;
        };
        userId = decoded.userId;
        userRole = decoded.role;
        providerId = decoded.providerId;
      } catch (error) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
    } else {
      // Web NextAuth authentication
      const session = await getServerSession(authOptions);
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      userId = session!.user!.id;
      userRole = session!.user!.role;
      providerId = session!.user!.providerId;
    }

    const { location, photo } = await req.json();
    const bookingId = params.id;

    // FIXED: Rate limiting for financial operations
    const rateLimitId = getRateLimitIdentifier(
      providerId,
      req.headers.get('x-forwarded-for'),
      'booking-action'
    );
    
    const rateLimitResult = await checkRateLimitStrict(bookingActionRateLimit, rateLimitId);
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { 
          status: 429,
          headers: rateLimitResult.headers 
        }
      );
    }

    // Get booking details — scope instructor fetch to their own bookings to prevent IDOR.
    // For clients, fetch without scope then verify client.userId below.
    const bookingWhere = (userRole === 'provider' && providerId)
      ? { id: bookingId, providerId }
      : { id: bookingId };

    const booking = await prisma.booking.findFirst({
      where: bookingWhere,
      include: {
        provider: { select: { name: true, phone: true } },
        customer: { select: { name: true, phone: true, userId: true } },
      },
    }) as any;

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Authorization — for client callers verify ownership (instructor scope handled by WHERE above)
    const isInstructor = userRole === 'provider';
    const isClient = userRole === 'CLIENT';

    // Only instructors and clients can check out — admins must not bypass ownership
    if (!isInstructor && !isClient) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (isClient && booking.customer.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if checked in
    if (!booking.checkInTime) {
      return NextResponse.json({ error: 'Must check in first' }, { status: 400 });
    }

    // Checkout time validation — fraud prevention
    const checkOutTime = new Date();
    const minutesSinceCheckIn = (checkOutTime.getTime() - new Date(booking.checkInTime).getTime()) / (1000 * 60);
    const hoursSinceCheckIn = minutesSinceCheckIn / 60;

    // Block checkout less than 5 minutes after check-in (prevents instant fake completions)
    if (minutesSinceCheckIn < 5) {
      return NextResponse.json({
        error: `Cannot check out yet — only ${Math.round(minutesSinceCheckIn)} minute(s) since check-in. Minimum lesson duration is 5 minutes.`,
        minutesSinceCheckIn: Math.round(minutesSinceCheckIn),
      }, { status: 400 });
    }

    // Block checkout more than 24 hours after check-in (stale/forgotten check-in)
    if (hoursSinceCheckIn > 24) {
      return NextResponse.json({
        error: `Check-in was ${Math.round(hoursSinceCheckIn)} hours ago. Please contact support to resolve this booking.`,
        requiresSupport: true,
        hoursSinceCheckIn: Math.round(hoursSinceCheckIn),
      }, { status: 400 });
    }

    // Log early checkout if instructor checks out in less than 50% of scheduled duration
    const scheduledDurationMinutes = booking.endTime && booking.startTime
      ? (new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime()) / (1000 * 60)
      : null;
    if (scheduledDurationMinutes && minutesSinceCheckIn < scheduledDurationMinutes * 0.5) {
      console.warn(`[check-out] Early checkout: booking ${booking.id}, scheduled ${scheduledDurationMinutes}min, actual ${Math.round(minutesSinceCheckIn)}min (${Math.round(minutesSinceCheckIn / scheduledDurationMinutes * 100)}%)`);
    }

    const actualDuration = Math.round(minutesSinceCheckIn);
    const checkOutBy = isInstructor ? 'provider' : 'customer';

    // 🔴 CRITICAL FIX #2 & #3: Atomic checkout with idempotency
    // Use updateMany with conditional check to prevent double checkout
    const updatedBooking = await prisma.$transaction(async (tx) => {
      // Atomic update - only succeeds if checkOutTime is null
      const updateResult = await tx.booking.updateMany({
        where: {
          id: bookingId,
          checkOutTime: null // ✅ Only update if not already checked out
        },
        data: {
          checkOutTime,
          checkOutLocation: location,
          checkOutBy,
          checkOutPhoto: photo,
          actualDuration,
          status: 'COMPLETED',
          smsCheckOutSent: true,
        } as any,
      });

      // If no rows updated, booking was already checked out
      if (updateResult.count === 0) {
        throw new Error('ALREADY_CHECKED_OUT');
      }

      // Fetch the updated booking
      const updated = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          provider: { select: { name: true, phone: true } },
          customer: { select: { name: true, phone: true } },
        }
      });

      if (!updated) {
        throw new Error('Booking not found after update');
      }

      // ✅ IDEMPOTENCY: Check if transaction already exists
      const existingTransaction = await (tx as any).transaction.findFirst({
        where: { bookingId }
      });

      if (existingTransaction) {
        // Only mark COMPLETED if payment was confirmed AND the transaction is in a
        // promotable state. FAILED and REFUNDED transactions must never become
        // payout-eligible merely because the booking's isPaid flag is true.
        if (!updated.isPaid) {
          console.error(`[check-out] RECONCILIATION REQUIRED: booking ${bookingId} has an existing transaction but isPaid=false. Transaction left in current state; payout eligibility blocked.`);
          // Leave the transaction in its current status — do NOT advance to COMPLETED.
          // The payout builder requires checkOutTime lte bufferCutoff AND a COMPLETED
          // transaction, so this booking will never reach payout without manual admin review.
        } else {
          // Statuses that must never be promoted to COMPLETED — they represent
          // terminal financial states (refunded or already failed).
          const NON_PROMOTABLE_STATUSES = ['FAILED', 'REFUNDED', 'REFUND_ISSUED', 'REFUND_SYNCED', 'DISPUTE_LOST'];
          if (NON_PROMOTABLE_STATUSES.includes(existingTransaction.status)) {
            console.error(
              `[check-out] RECONCILIATION REQUIRED: booking ${bookingId} has a ${existingTransaction.status} transaction ` +
              `(id ${existingTransaction.id}). Cannot promote to COMPLETED. Manual admin review required.`
            );
            // Leave in current status — payout builder will never see it as eligible.
          } else {
            await (tx as any).transaction.update({
              where: { id: existingTransaction.id },
              data: { status: 'COMPLETED', processedAt: new Date() },
            });
          }
        }
      } else {
        // No transaction row at all. Only create one if payment is confirmed.
        if (!updated.isPaid) {
          // Booking was never paid (PENDING_PAYMENT that bypassed check-in gate, or
          // an admin-confirmed override). Do NOT invent a payable record.
          // Flag for reconciliation — admin must resolve before any payout can occur.
          console.error(`[check-out] RECONCILIATION REQUIRED: booking ${bookingId} completed with no payment evidence (isPaid=false, no transaction row). Creating a FAILED reconciliation record.`);

          const { PaymentService } = await import('@/lib/services/payment');
          const paymentService = new PaymentService();
          const calculation = await paymentService.calculateCommission(
            booking.providerId,
            booking.customerId,
            booking.price
          );

          await (tx as any).transaction.create({
            data: {
              bookingId,
              providerId: booking.providerId,
              type: 'BOOKING_PAYMENT',
              amount: calculation.totalAmount,
              platformFee: calculation.platformFee,
              providerPayout: calculation.providerPayout,
              commissionRate: calculation.commissionRate,
              status: 'FAILED', // NOT payable — payment evidence missing
              processedAt: new Date(),
              description: `Booking completed without confirmed payment — reconciliation required`,
              metadata: {
                reconciliationRequired: true,
                isFirstBooking: calculation.isFirstBooking,
                reason: 'isPaid=false at checkout; no prior payment transaction found',
              },
            },
          });
        } else {
          // Payment confirmed but transaction row is missing — create it now.
          console.warn(`[check-out] Transaction missing for paid booking ${bookingId}, creating now`);

          const { PaymentService } = await import('@/lib/services/payment');
          const paymentService = new PaymentService();
          const calculation = await paymentService.calculateCommission(
            booking.providerId,
            booking.customerId,
            booking.price
          );

          await (tx as any).transaction.create({
            data: {
              bookingId,
              providerId: booking.providerId,
              type: 'BOOKING_PAYMENT',
              amount: calculation.totalAmount,
              platformFee: calculation.platformFee,
              providerPayout: calculation.providerPayout,
              commissionRate: calculation.commissionRate,
              status: 'COMPLETED',
              processedAt: new Date(),
              description: `Booking payment - ${calculation.isFirstBooking ? 'First booking with client' : 'Repeat booking'}`,
              metadata: {
                isFirstBooking: calculation.isFirstBooking,
              },
            },
          });
        }
      }

      return updated;
    });

    // Send SMS non-blocking — only if phone is available
    const otherPartyPhone = isInstructor ? booking.customer.phone : booking.provider.phone;
    const checkedOutName = isInstructor ? booking.provider.name : booking.customer.name;

    if (otherPartyPhone) {
      smsService.sendSMS({
        to: otherPartyPhone,
        message: `${checkedOutName} has checked out. Lesson completed. Duration: ${actualDuration} minutes. Please leave a review!`,
      }).catch(error => {
        console.error('Failed to send checkout SMS:', error);
      });
    }

    return NextResponse.json({
      success: true,
      checkOutTime: (updatedBooking as any).checkOutTime,
      actualDuration,
      message: 'Checked out successfully',
    });
  } catch (error: any) {
    // Handle specific error for already checked out
    if (error.message === 'ALREADY_CHECKED_OUT') {
      return NextResponse.json({ 
        error: 'Already checked out' 
      }, { status: 400 });
    }

    console.error('Error checking out:', error);
    return NextResponse.json(
      { error: 'Failed to check out' },
      { status: 500 }
    );
  }
}
