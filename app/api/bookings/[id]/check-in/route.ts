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

    const { location, photo, lateCheckInReason, acknowledgeLateCheckIn } = await req.json();
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

    // 🔴 CRITICAL FIX: Authorization check
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

    // Determine who is checking in
    const checkInBy = isInstructor ? 'instructor' : 'client';

    // ✅ CHECK-IN TIME VALIDATION - FRAUD PREVENTION
    const now = new Date();
    const bookingStartTime = new Date(booking.startTime);
    const timeDiffMinutes = (now.getTime() - bookingStartTime.getTime()) / (1000 * 60);
    const timeDiffHours = timeDiffMinutes / 60;

    // CRITICAL: Prevent premature check-in (more than 15 minutes early)
    if (timeDiffMinutes < -15) {
      const minutesUntilStart = Math.abs(Math.round(timeDiffMinutes));
      return NextResponse.json({ 
        error: `Cannot check in yet. Lesson starts in ${minutesUntilStart} minutes. You can check in up to 15 minutes before the scheduled time.`,
        canCheckIn: false,
        minutesUntilCheckIn: minutesUntilStart - 15
      }, { status: 400 });
    }

    // CRITICAL: Block check-in for bookings older than 24 hours (FRAUD PREVENTION)
    // If instructor forgot to check in, they must contact support
    if (timeDiffHours > 24) {
      return NextResponse.json({ 
        error: `Cannot check in to bookings older than 24 hours. This lesson was scheduled ${Math.round(timeDiffHours)} hours ago. Please contact support to resolve this issue.`,
        canCheckIn: false,
        requiresSupport: true,
        hoursLate: Math.round(timeDiffHours)
      }, { status: 400 });
    }

    // Late check-in (15 minutes to 24 hours) requires reason and acknowledgment
    const isLateCheckIn = timeDiffMinutes > 15; // More than 15 minutes late (but less than 24 hours)
    
    if (isLateCheckIn) {
      if (!acknowledgeLateCheckIn) {
        return NextResponse.json({ 
          error: 'Late check-in requires acknowledgment',
          requiresLateCheckInAcknowledgment: true,
          minutesLate: Math.round(timeDiffMinutes),
          hoursLate: Math.round(timeDiffHours)
        }, { status: 400 });
      }

      if (!lateCheckInReason || lateCheckInReason.trim().length < 10) {
        return NextResponse.json({ 
          error: 'Please provide a detailed reason for late check-in (minimum 10 characters)',
          requiresLateCheckInReason: true,
          minutesLate: Math.round(timeDiffMinutes),
          hoursLate: Math.round(timeDiffHours)
        }, { status: 400 });
      }
    }

    // 🔴 FIX: Atomic check-in with idempotency
    const updateData: any = {
      checkInTime: new Date(),
      checkInLocation: location,
      checkInBy,
      checkInPhoto: photo,
      smsCheckInSent: true,
    };

    // Add late check-in metadata if applicable
    if (isLateCheckIn) {
      updateData.notes = booking.notes 
        ? `${booking.notes}\n\n[Late Check-In: ${Math.round(timeDiffMinutes)} minutes late. Reason: ${lateCheckInReason}]`
        : `[Late Check-In: ${Math.round(timeDiffMinutes)} minutes late. Reason: ${lateCheckInReason}]`;
    }

    const updateResult = await prisma.booking.updateMany({
      where: {
        id: bookingId,
        checkInTime: null // ✅ Only update if not already checked in
      },
      data: updateData,
    });

    // If no rows updated, booking was already checked in
    if (updateResult.count === 0) {
      return NextResponse.json({ error: 'Already checked in' }, { status: 400 });
    }

    const checkInTime = new Date();

    // 🔴 FIX: SMS sending non-blocking
    const otherPartyPhone = isInstructor ? booking.client.phone : booking.instructor.phone;
    const otherPartyName = isInstructor ? booking.client.name : booking.instructor.name;
    const checkedInName = isInstructor ? booking.instructor.name : booking.client.name;

    smsService.sendSMS({
      to: otherPartyPhone,
      message: `${checkedInName} has checked in for your lesson. Lesson started at ${checkInTime.toLocaleTimeString()}.`,
    }).catch(error => {
      console.error('Failed to send check-in SMS:', error);
      // Don't fail the check-in if SMS fails
    });

    return NextResponse.json({
      success: true,
      checkInTime,
      message: 'Checked in successfully',
    });
  } catch (error) {
    console.error('Error checking in:', error);
    return NextResponse.json(
      { error: 'Failed to check in' },
      { status: 500 }
    );
  }
}
