import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { smsService } from '@/lib/services/sms';
import { notifyBookingConfirmed, notifyClientBookingConfirmed } from '@/lib/services/notifications';
import { getNotifChannels } from '@/lib/config/platform-settings';
import { getDisplayName } from '@/lib/utils/account';

export const dynamic = 'force-dynamic';

/**
 * Manual booking confirmation API
 * Allows instructors/admins to confirm PENDING bookings
 * Use case: When webhook fails or for manual approval workflows
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bookingId = params.id;

    // Get user role
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { instructor: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        instructor: true,
        client: true
      }
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Check authorization
    const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
    const isInstructor = user.instructor?.id === booking.instructorId;

    if (!isAdmin && !isInstructor) {
      return NextResponse.json({ error: 'Not authorized to confirm this booking' }, { status: 403 });
    }

    // Check if booking is in PENDING or PENDING_PAYMENT status
    if (booking.status !== 'PENDING' && booking.status !== 'PENDING_PAYMENT') {
      return NextResponse.json({ 
        error: `Cannot confirm booking with status: ${booking.status}. Only PENDING or PENDING_PAYMENT bookings can be confirmed.` 
      }, { status: 400 });
    }

    // P0-5 FIX: Wrap conflict check + status update in a single $transaction.
    // Previously: findFirst ran outside the transaction, leaving a race window where
    // two concurrent confirmations could both pass the read check before either write
    // lands, resulting in a double-booked slot.
    // Now we use updateMany with a status guard — if count === 0 the booking was
    // already confirmed or cancelled by a concurrent request.
    let updatedBooking: Awaited<ReturnType<typeof prisma.booking.findUnique>>;
    try {
      updatedBooking = await prisma.$transaction(async (tx) => {
        // Conflict check inside the transaction
        if (booking.startTime && booking.endTime) {
          const conflictingBooking = await tx.booking.findFirst({
            where: {
              id: { not: bookingId },
              instructorId: booking.instructorId,
              status: { in: ['CONFIRMED', 'COMPLETED'] },
              OR: [
                { startTime: { lte: booking.startTime }, endTime: { gt: booking.startTime } },
                { startTime: { lt: booking.endTime }, endTime: { gte: booking.endTime } },
                { startTime: { gte: booking.startTime }, endTime: { lte: booking.endTime } },
              ],
            },
          });
          if (conflictingBooking) {
            throw Object.assign(new Error('SLOT_CONFLICT'), { code: 'SLOT_CONFLICT' });
          }
        }

        // Status guard: only advance if still PENDING/PENDING_PAYMENT
        const guard = await tx.booking.updateMany({
          where: { id: bookingId, status: { in: ['PENDING', 'PENDING_PAYMENT'] } },
          data: { status: 'CONFIRMED', updatedAt: new Date() },
        });
        if (guard.count === 0) {
          throw Object.assign(new Error('ALREADY_CONFIRMED_OR_STALE'), { code: 'ALREADY_CONFIRMED_OR_STALE' });
        }

        return tx.booking.findUnique({ where: { id: bookingId } });
      });
    } catch (txErr: any) {
      if (txErr?.code === 'SLOT_CONFLICT') {
        return NextResponse.json({
          error: 'Time slot is no longer available. Another booking has been confirmed for this time.',
        }, { status: 409 });
      }
      if (txErr?.code === 'ALREADY_CONFIRMED_OR_STALE') {
        return NextResponse.json({
          error: `Booking is already confirmed or was modified by a concurrent request.`,
        }, { status: 409 });
      }
      throw txErr;
    }

    // Audit log — manual confirmation by instructor/admin must be traceable
    try {
      await prisma.auditLog.create({
        data: {
          action: 'BOOKING_CONFIRMED',
          actorId: user.id,
          actorRole: isAdmin ? 'ADMIN' : 'INSTRUCTOR',
          targetType: 'BOOKING',
          targetId: bookingId,
          success: true,
          metadata: {
            previousStatus: booking.status,
            confirmedBy: isAdmin ? 'admin' : 'instructor',
            manualConfirmation: true,
          } as any,
        },
      });
    } catch (auditErr) {
      console.error('Audit log failed for manual booking confirmation:', auditErr);
    }

    const notifChannels = getNotifChannels('BOOKING_CONFIRMED');

    // Send SMS notification to client
    try {
      if (notifChannels.sms && booking.client?.phone && booking.startTime) {
        await smsService.sendBookingConfirmation({
          clientPhone: booking.client.phone,
          clientName: booking.client.name,
          instructorName: getDisplayName(booking.instructor),
          startTime: booking.startTime,
          price: booking.price,
          pickupAddress: booking.pickupAddress || 'TBD'
        } as any);
      }
    } catch (smsError) {
      console.error('Failed to send SMS notification:', smsError);
    }

    // Send in-app notification to instructor
    try {
      if (notifChannels.inApp && booking.instructor?.userId && booking.startTime) {
        await notifyBookingConfirmed(
          booking.instructor.userId,
          booking.client?.name || booking.clientName || 'Client',
          bookingId,
          new Date(booking.startTime)
        );
      }
    } catch (notifError) {
      console.error('Failed to create notification:', notifError);
    }

    // Send in-app notification to client
    try {
      if (notifChannels.inApp && booking.client?.userId && booking.startTime) {
        await notifyClientBookingConfirmed(
          booking.client.userId,
          getDisplayName(booking.instructor),
          bookingId,
          new Date(booking.startTime)
        );
      }
    } catch (notifError) {
      console.error('Failed to create client notification:', notifError);
    }

    return NextResponse.json({
      success: true,
      booking: updatedBooking,
      message: 'Booking confirmed successfully'
    });

  } catch (error) {
    console.error('Confirm booking error:', error);
    // P2-2 FIX: Do not expose internal error details (Prisma constraint names etc.) to client
    return NextResponse.json({ 
      error: 'Internal server error',
    }, { status: 500 });
  }
}
