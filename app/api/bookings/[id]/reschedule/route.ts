import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services/email';
import { availabilityService } from '@/lib/services/availability';
import { validateTransition, getTransitionErrorMessage } from '@/lib/services/bookingStateMachine';
import { logBookingAction, AuditAction, ActorRole } from '@/lib/services/auditLogger';
import { bookingActionRateLimit, checkRateLimitStrict, getRateLimitIdentifier } from '@/lib/ratelimit';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { newDate, newTime, newDuration } = await req.json();
    const bookingId = params.id;

    if (!newDate || !newTime) {
      return NextResponse.json({ error: 'New date and time are required' }, { status: 400 });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // FIXED: Rate limiting for financial operations
    const rateLimitId = getRateLimitIdentifier(
      user.id,
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

    // Get booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { 
        client: true,
        instructor: {
          include: {
            user: true
          }
        }
      }
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // 🔴 CRITICAL FIX #1: Authorization check
    const isInstructor = user.role === 'INSTRUCTOR' && booking.instructorId === session.user.instructorId;
    const isClient = user.role === 'CLIENT' && (booking.userId === user.id || booking.client.userId === user.id);
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

    if (!isInstructor && !isClient && !isAdmin) {
      // Log unauthorized attempt
      await logBookingAction({
        bookingId: params.id,
        action: AuditAction.UNAUTHORIZED_ATTEMPT,
        actorId: user.id,
        actorRole: user.role as ActorRole,
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
        success: false,
        errorMessage: 'Attempted to reschedule booking they do not own'
      });

      return NextResponse.json({ 
        error: 'Forbidden - You do not have permission to reschedule this booking' 
      }, { status: 403 });
    }

    // 🔴 CRITICAL FIX #2: State validation
    // Can only reschedule CONFIRMED bookings
    if (booking.status !== 'CONFIRMED' && booking.status !== 'PENDING') {
      return NextResponse.json({ 
        error: `Cannot reschedule ${booking.status.toLowerCase()} bookings. Only confirmed bookings can be rescheduled.`
      }, { status: 400 });
    }

    // Parse new date/time
    const [year, month, day] = newDate.split('-').map(Number);
    const [hours, minutes] = newTime.split(':').map(Number);
    const newStartTime = new Date(year, month - 1, day, hours, minutes);
    const duration = newDuration || booking.duration || 1;
    const newEndTime = new Date(newStartTime.getTime() + duration * 60 * 60 * 1000);

    // Validate new time is in the future
    if (newStartTime < new Date()) {
      return NextResponse.json({ 
        error: 'Cannot reschedule to a time in the past' 
      }, { status: 400 });
    }

    // 🔴 CRITICAL FIX #3: Check for double booking at new time
    const hasConflict = await availabilityService.checkDoubleBooking(
      booking.instructorId,
      newStartTime,
      newEndTime,
      bookingId // Exclude current booking from conflict check
    );

    if (hasConflict) {
      return NextResponse.json({ 
        error: 'The new time slot is already booked. Please choose a different time.' 
      }, { status: 409 });
    }

    // Store original booking time if not already stored
    const originalBookingTime = (booking as any).originalBookingTime || booking.startTime;

    // Update booking
    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        startTime: newStartTime,
        endTime: newEndTime,
        duration,
        originalBookingTime: originalBookingTime,
        notes: `${booking.notes || ''}\n\nRescheduled from ${new Date(booking.startTime).toLocaleString()} to ${newStartTime.toLocaleString()}`
      } as any
    });

    // 🔴 CRITICAL FIX #4: Audit logging
    await logBookingAction({
      bookingId: params.id,
      action: AuditAction.BOOKING_RESCHEDULED,
      actorId: user.id,
      actorRole: user.role as ActorRole,
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
      metadata: {
        oldStartTime: booking.startTime,
        newStartTime,
        oldEndTime: booking.endTime,
        newEndTime,
        rescheduledBy: isInstructor ? 'instructor' : isClient ? 'client' : 'admin'
      }
    });

    // Send notification emails
    try {
      await emailService.sendGenericEmail({
        to: booking.client.email,
        subject: 'Booking Rescheduled',
        html: `
          <h2>Your booking has been rescheduled</h2>
          <p>Hi ${booking.client.name},</p>
          <p>Your booking with ${booking.instructor.name} has been rescheduled.</p>
          <h3>New Details:</h3>
          <ul>
            <li>Date: ${newStartTime.toLocaleDateString()}</li>
            <li>Time: ${newStartTime.toLocaleTimeString()}</li>
            <li>Duration: ${duration} hour(s)</li>
          </ul>
          <p>If you have any questions, please contact your instructor.</p>
        `
      });
    } catch (emailError) {
      console.error('Failed to send reschedule email to client:', emailError);
    }

    try {
      await emailService.sendGenericEmail({
        to: booking.instructor.user.email,
        subject: `Booking Rescheduled - ${booking.client.name}`,
        html: `
          <h2>Booking Rescheduled</h2>
          <p>Hi ${booking.instructor.name},</p>
          <p>A booking with ${booking.client.name} has been rescheduled.</p>
          <h3>New Details:</h3>
          <ul>
            <li>Date: ${newStartTime.toLocaleDateString()}</li>
            <li>Time: ${newStartTime.toLocaleTimeString()}</li>
            <li>Duration: ${duration} hour(s)</li>
          </ul>
        `
      });
    } catch (emailError) {
      console.error('Failed to send reschedule email to instructor:', emailError);
    }

    return NextResponse.json({
      success: true,
      booking: updated,
      message: 'Booking rescheduled successfully'
    });
  } catch (error) {
    console.error('Reschedule booking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
