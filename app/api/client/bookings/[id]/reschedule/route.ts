/**
 * PUT /api/client/bookings/{id}/reschedule
 *
 * PAY-H-02 FIX: Financial logic delegated entirely to rescheduleBooking()
 * in booking-service.ts. This route handles auth, input parsing, and
 * response formatting only.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rescheduleBooking } from '@/lib/services/booking-service';
import { notifyBookingRescheduled, notifyClientBookingRescheduled } from '@/lib/services/notifications';
import { getNotifChannels } from '@/lib/config/platform-settings';

export const dynamic = 'force-dynamic';

interface RescheduleRequest {
  date?: string;
  time?: string;
  duration?: number;  // hours
  pickupLocation?: string;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: RescheduleRequest = await request.json();
    const bookingId = params.id;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { provider: true, customer: true },
    }) as any;
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const user = await prisma.user.findUnique({ where: { email: session!.user!.email } });
    if (!user || booking.customer?.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!booking.startTime) {
      return NextResponse.json({ error: 'Booking has no start time' }, { status: 400 });
    }

    const now = new Date();
    const hoursUntilBooking = (new Date(booking.startTime).getTime() - now.getTime()) / 3_600_000;
    if (hoursUntilBooking < 12) {
      return NextResponse.json(
        { error: 'Cannot reschedule within 12 hours of lesson', hoursUntilBooking: Math.floor(hoursUntilBooking * 10) / 10 },
        { status: 400 }
      );
    }

    // Build new start/end times from request body
    let newStartTime: Date = new Date(booking.startTime);
    let newEndTime: Date   = booking.endTime ? new Date(booking.endTime) : new Date(newStartTime.getTime() + 3_600_000);

    if (body.date || body.time) {
      const date = body.date || booking.startTime.toISOString().split('T')[0];
      const time = body.time || `${String(booking.startTime.getHours()).padStart(2, '0')}:${String(booking.startTime.getMinutes()).padStart(2, '0')}`;
      const [year, month, day] = date.split('-').map(Number);
      const [hour, minute]     = time.split(':').map(Number);
      newStartTime = new Date(year, month - 1, day, hour, minute);
    }

    // Duration: caller may specify a new duration in hours; otherwise keep existing
    if (body.duration !== undefined) {
      newEndTime = new Date(newStartTime.getTime() + body.duration * 3_600_000);
    } else {
      const existingDurationMs = newEndTime.getTime() - new Date(booking.startTime).getTime();
      newEndTime = new Date(newStartTime.getTime() + existingDurationMs);
    }

    // Handle pickup location separately (not financial — safe to update directly)
    if (body.pickupLocation) {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { pickupAddress: body.pickupLocation } as any,
      });
    }

    // Delegate all financial logic and atomicity to shared service
    const result = await rescheduleBooking(
      bookingId,
      { newStartTime, newEndTime },
      user.id,
      'CLIENT',
    );

    if ('requiresConfirmation' in result) {
      return NextResponse.json(result, { status: 200 });
    }

    // Notifications (best-effort, after commit)
    try {
      const reschedChannels = getNotifChannels('BOOKING_RESCHEDULED');
      if (reschedChannels.inApp) {
        if (booking.provider?.userId) {
          await notifyBookingRescheduled(booking.provider.userId, booking.customer?.name || 'Client', bookingId, newStartTime);
        }
        await notifyClientBookingRescheduled(user.id, booking.provider?.name || 'Instructor', bookingId, newStartTime);
      }
    } catch (e) { console.error('Reschedule notification failed:', e); }

    return NextResponse.json({ success: true, booking: result });
  } catch (error: any) {
    const code = error?.code;
    if (code === 'SLOT_CONFLICT')              return NextResponse.json({ error: 'The new time conflicts with an existing booking.', code }, { status: 409 });
    if (code === 'INSUFFICIENT_BALANCE')       return NextResponse.json({ error: error.message, code }, { status: 400 });
    if (code === 'STRIPE_PAID_PRICE_CHANGE')   return NextResponse.json({ error: error.message, code }, { status: 409 });
    if (code === 'PACKAGE_DURATION_LOCKED')    return NextResponse.json({ error: error.message, code }, { status: 400 });
    if (code === 'CONCURRENT_RESCHEDULE')      return NextResponse.json({ error: error.message, code }, { status: 409 });
    if (code === 'INVALID_DURATION')           return NextResponse.json({ error: error.message, code }, { status: 400 });
    console.error('Client reschedule error:', error);
    return NextResponse.json({ error: 'Failed to reschedule booking' }, { status: 500 });
  }
}
