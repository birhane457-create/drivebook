import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { googleCalendarService } from '@/lib/services/googleCalendar'
import { emailService } from '@/lib/services/email'
import { validateTransition, getTransitionErrorMessage } from '@/lib/services/bookingStateMachine'
import { logBookingAction, AuditAction, ActorRole } from '@/lib/services/auditLogger'
import { bookingActionRateLimit, checkRateLimitStrict, getRateLimitIdentifier } from '@/lib/ratelimit'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
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

    // Get booking with full details
    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: { 
        client: true, 
        instructor: {
          include: {
            user: true
          }
        }
      }
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // 🔴 CRITICAL FIX #1: Authorization check
    // Verify user owns this booking
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
        errorMessage: 'Attempted to cancel booking they do not own',
        metadata: {
          bookingInstructorId: booking.instructorId,
          bookingClientId: booking.clientId
        }
      });

      return NextResponse.json({ 
        error: 'Forbidden - You do not have permission to cancel this booking' 
      }, { status: 403 })
    }

    // 🔴 CRITICAL FIX #2: State machine validation
    // Check if booking can be cancelled
    const validation = validateTransition(booking.status, 'CANCELLED');
    if (!validation.valid) {
      return NextResponse.json({ 
        error: getTransitionErrorMessage(booking.status, 'CANCELLED')
      }, { status: 400 });
    }

    // Calculate refund based on cancellation policy
    const now = new Date()
    const bookingTimeForPolicy = (booking as any).originalBookingTime || booking.startTime
    const policyTime = new Date(bookingTimeForPolicy)
    const hoursUntilBooking = (policyTime.getTime() - now.getTime()) / (1000 * 60 * 60)

    let refundAmount = 0
    let refundPercentage = 0

    if (hoursUntilBooking >= 48) {
      refundPercentage = 100
      refundAmount = booking.price
    } else if (hoursUntilBooking >= 24) {
      refundPercentage = 50
      refundAmount = booking.price * 0.5
    } else {
      refundPercentage = 0
      refundAmount = 0
    }

    const policyNote = (booking as any).originalBookingTime 
      ? `\n(Policy based on original booking time: ${new Date((booking as any).originalBookingTime).toLocaleString()})`
      : '';

    // Process wallet refund if applicable
    if (refundAmount > 0 && (booking.userId || booking.clientId)) {
      const walletUserId = booking.userId || (await prisma.client.findUnique({
        where: { id: booking.clientId! },
        select: { userId: true }
      }))?.userId;

      if (walletUserId) {
        const wallet = await prisma.clientWallet.findUnique({
          where: { userId: walletUserId }
        });

        if (wallet) {
          await prisma.$transaction([
            prisma.clientWallet.update({
              where: { id: wallet.id },
              data: {
                balance: { increment: refundAmount }
              }
            }),
            prisma.walletTransaction.create({
              data: {
                walletId: wallet.id,
                amount: refundAmount,
                type: 'CREDIT',
                description: `Booking cancelled - ${refundPercentage}% refund`,
                status: 'COMPLETED'
              }
            }),
            prisma.ledgerEntry.create({
              data: {
                userId: walletUserId,
                amount: refundAmount,
                type: 'CREDIT',
                category: 'REFUND',
                description: `Booking cancellation refund - ${refundPercentage}%`,
                bookingId: booking.id
              }
            })
          ]);
        }
      }
    }

    // 🔴 CRITICAL FIX #3: Atomic update of booking AND transaction
    const updated = await prisma.$transaction(async (tx) => {
      // Update booking
      const updatedBooking = await tx.booking.update({
        where: { id: params.id },
        data: {
          status: 'CANCELLED',
          notes: `${booking.notes || ''}\n\nCancelled on ${now.toISOString()}. Refund: ${refundPercentage}% ($${refundAmount.toFixed(2)})${policyNote}`
        }
      });

      // Update transaction status to CANCELLED
      await (tx as any).transaction.updateMany({
        where: { bookingId: params.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date()
        }
      });

      return updatedBooking;
    });

    // 🔴 CRITICAL FIX #4: Audit logging
    await logBookingAction({
      bookingId: params.id,
      action: AuditAction.BOOKING_CANCELLED,
      actorId: user.id,
      actorRole: user.role as ActorRole,
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
      metadata: {
        refundPercentage,
        refundAmount,
        hoursNotice: Math.floor(hoursUntilBooking),
        cancelledBy: isInstructor ? 'instructor' : isClient ? 'client' : 'admin'
      }
    });

    // Delete from Google Calendar if synced
    const googleEventId = (booking as any).googleCalendarEventId
    if (googleEventId && booking.instructor.syncGoogleCalendar) {
      try {
        await googleCalendarService.deleteCalendarEvent(
          booking.instructorId,
          googleEventId
        )
      } catch (error) {
        console.error('Failed to delete from Google Calendar:', error)
      }
    }

    // Send cancellation emails
    try {
      await emailService.sendGenericEmail({
        to: booking.client.email,
        subject: `Booking Cancelled - Refund ${refundPercentage}%`,
        html: `
          <h2>Your booking has been cancelled</h2>
          <p>Hi ${booking.client.name},</p>
          <p>Your booking with ${booking.instructor.name} on ${new Date(booking.startTime).toLocaleDateString()} has been cancelled.</p>
          <h3>Refund Details:</h3>
          <ul>
            <li>Original Price: $${booking.price.toFixed(2)}</li>
            <li>Refund Percentage: ${refundPercentage}%</li>
            <li>Refund Amount: $${refundAmount.toFixed(2)}</li>
            <li>Notice Given: ${Math.floor(hoursUntilBooking)} hours</li>
          </ul>
          <p>The refund will be processed to your original payment method within 3-5 business days.</p>
        `
      })
    } catch (emailError) {
      console.error('Failed to send cancellation email to client:', emailError)
    }

    try {
      await emailService.sendGenericEmail({
        to: booking.instructor.user.email,
        subject: `Booking Cancelled - ${booking.client.name}`,
        html: `
          <h2>Booking Cancelled</h2>
          <p>Hi ${booking.instructor.name},</p>
          <p>A booking with ${booking.client.name} on ${new Date(booking.startTime).toLocaleDateString()} has been cancelled.</p>
          <p>Refund to client: ${refundPercentage}% ($${refundAmount.toFixed(2)})</p>
          <p>This slot is now available for new bookings.</p>
        `
      })
    } catch (emailError) {
      console.error('Failed to send cancellation email to instructor:', emailError)
    }

    return NextResponse.json({
      success: true,
      booking: updated,
      refund: {
        percentage: refundPercentage,
        amount: refundAmount,
        hoursNotice: Math.floor(hoursUntilBooking)
      }
    })
  } catch (error) {
    console.error('Cancel booking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
