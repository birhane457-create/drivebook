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
    let instructorId: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Mobile JWT authentication
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as {
          userId: string;
          role: string;
          instructorId?: string;
        };
        userId = decoded.userId;
        userRole = decoded.role;
        instructorId = decoded.instructorId;
      } catch (error) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
    } else {
      // Web NextAuth authentication
      const session = await getServerSession(authOptions);
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      userId = session.user.id;
      userRole = session.user.role;
      instructorId = session.user.instructorId;
    }

    const { location, photo } = await req.json();
    const bookingId = params.id;

    // FIXED: Rate limiting for financial operations
    const rateLimitId = getRateLimitIdentifier(
      instructorId,
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

    // Get booking details
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        instructor: { select: { name: true, phone: true } },
        client: { select: { name: true, phone: true, userId: true } },
      },
    }) as any;

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // 🔴 CRITICAL FIX #1: Authorization check
    // Verify user owns this booking (as client OR instructor)
    const isInstructor = userRole === 'INSTRUCTOR';
    const isClient = userRole === 'CLIENT';

    if (isInstructor && booking.instructorId !== instructorId) {
      return NextResponse.json({ 
        error: 'Forbidden - This booking belongs to another instructor' 
      }, { status: 403 });
    }

    if (isClient && booking.client.userId !== userId) {
      return NextResponse.json({ 
        error: 'Forbidden - This booking belongs to another client' 
      }, { status: 403 });
    }

    // Check if checked in
    if (!booking.checkInTime) {
      return NextResponse.json({ error: 'Must check in first' }, { status: 400 });
    }

    // Calculate actual duration
    const checkOutTime = new Date();
    const actualDuration = Math.round(
      (checkOutTime.getTime() - new Date(booking.checkInTime).getTime()) / (1000 * 60)
    );

    const checkOutBy = isInstructor ? 'instructor' : 'client';

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
          instructor: { select: { name: true, phone: true } },
          client: { select: { name: true, phone: true } },
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
        // Update existing transaction to COMPLETED
        await (tx as any).transaction.update({
          where: { id: existingTransaction.id },
          data: {
            status: 'COMPLETED',
            processedAt: new Date()
          }
        });
        console.log(`✅ Transaction updated to COMPLETED for booking ${bookingId}`);
      } else {
        // Fallback: Create transaction if it doesn't exist (shouldn't happen)
        console.warn(`⚠️ Transaction missing for booking ${bookingId}, creating now`);
        
        const { PaymentService } = await import('@/lib/services/payment');
        const paymentService = new PaymentService();
        
        const calculation = await paymentService.calculateCommission(
          booking.instructorId,
          booking.clientId,
          booking.price
        );

        await (tx as any).transaction.create({
          data: {
            bookingId,
            instructorId: booking.instructorId,
            type: 'BOOKING_PAYMENT',
            amount: calculation.totalAmount,
            platformFee: calculation.platformFee,
            instructorPayout: calculation.instructorPayout,
            commissionRate: calculation.commissionRate,
            status: 'COMPLETED', // Immediately completed since booking is done
            processedAt: new Date(),
            description: `Booking payment - ${calculation.isFirstBooking ? 'First booking with client' : 'Repeat booking'}`,
            metadata: {
              isFirstBooking: calculation.isFirstBooking,
            },
          }
        });
      }

      return updated;
    });

    console.log(`✅ Check-out completed for booking ${bookingId}`);

    // 🔴 FIX #5: SMS sending non-blocking
    // Don't await SMS - send asynchronously
    const otherPartyPhone = isInstructor ? booking.client.phone : booking.instructor.phone;
    const checkedOutName = isInstructor ? booking.instructor.name : booking.client.name;

    smsService.sendSMS({
      to: otherPartyPhone,
      message: `${checkedOutName} has checked out. Lesson completed. Duration: ${actualDuration} minutes. Please leave a review!`,
    }).catch(error => {
      console.error('Failed to send checkout SMS:', error);
      // Don't fail the checkout if SMS fails
    });

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
