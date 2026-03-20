import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { smsService } from '@/lib/services/sms';
import { notifyBookingConfirmed, notifyClientBookingConfirmed } from '@/lib/services/notifications';
import { getNotifChannels } from '@/lib/config/platform-settings';

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

    // Check if slot is still available
    if (booking.startTime && booking.endTime) {
      const conflictingBooking = await prisma.booking.findFirst({
        where: {
          id: { not: bookingId },
          instructorId: booking.instructorId,
          status: { in: ['CONFIRMED', 'COMPLETED'] },
          OR: [
            { startTime: { lte: booking.startTime }, endTime: { gt: booking.startTime } },
            { startTime: { lt: booking.endTime }, endTime: { gte: booking.endTime } },
            { startTime: { gte: booking.startTime }, endTime: { lte: booking.endTime } }
          ]
        }
      });

      if (conflictingBooking) {
        return NextResponse.json({ 
          error: 'Time slot is no longer available. Another booking has been confirmed for this time.' 
        }, { status: 409 });
      }
    }

    // Confirm the booking
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CONFIRMED',
        updatedAt: new Date()
      }
    });

    const notifChannels = getNotifChannels('BOOKING_CONFIRMED');

    // Send SMS notification to client
    try {
      if (notifChannels.sms && booking.client?.phone && booking.startTime) {
        await smsService.sendBookingConfirmation({
          clientPhone: booking.client.phone,
          clientName: booking.client.name,
          instructorName: booking.instructor.name,
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
          booking.instructor.name,
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
    return NextResponse.json({ 
      error: 'Failed to confirm booking',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
