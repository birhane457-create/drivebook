import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getWalletBalance, getOrCreateWallet } from '@/lib/services/wallet-helpers';
import { notifyBookingRescheduled, notifyClientBookingRescheduled } from '@/lib/services/notifications';
import { getNotifChannels } from '@/lib/config/platform-settings';


export const dynamic = 'force-dynamic';
interface RescheduleRequest {
  date?: string;
  time?: string;
  duration?: number; // New duration in hours
  pickupLocation?: string;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: RescheduleRequest = await request.json();
    const bookingId = params.id;

    // Get the booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        instructor: true,
        client: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Verify user owns this booking
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || booking.client?.userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Check reschedule policy - must be at least 12 hours before lesson
    if (!booking.startTime) {
      return NextResponse.json(
        { error: 'Booking has no start time' },
        { status: 400 }
      );
    }

    const now = new Date();
    const bookingTime = new Date(booking.startTime);
    const hoursUntilBooking = (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilBooking < 12) {
      return NextResponse.json(
        {
          error: 'Cannot reschedule within 12 hours of lesson',
          message: 'Rescheduling is not allowed within 12 hours of the lesson start time. Please cancel the booking if you cannot attend.',
          hoursUntilBooking: Math.floor(hoursUntilBooking * 10) / 10
        },
        { status: 400 }
      );
    }

    // P0-6 FIX: Mirror the instructor route's isNonRefundable logic.
    // If the current lesson is inside the 48h penalty window, rescheduling
    // must mark the booking non-refundable so a subsequent cancellation
    // can't exploit the new (future) date for a "full refund".
    const HOURS_48 = 48 * 60 * 60 * 1000;
    const isInsidePenaltyWindow = (bookingTime.getTime() - now.getTime()) < HOURS_48;
    // Also preserve originalStartTime on first client reschedule
    const originalStartTime = booking.originalStartTime ?? booking.startTime;

    // Get wallet and current balance
    const wallet = await getOrCreateWallet(user.id);
    const walletBalance = await getWalletBalance(user.id);

    // Prepare update data
    const updateData: any = {};
    let newStartTime: Date = booking.startTime;
    let newEndTime: Date = booking.endTime || new Date(booking.startTime.getTime() + 60 * 60 * 1000);
    let newPrice = booking.price;
    let priceDifference = 0;

    // Handle date/time change
    if (body.date || body.time) {
      const date = body.date || booking.startTime.toISOString().split('T')[0];
      const time = body.time || `${String(booking.startTime.getHours()).padStart(2, '0')}:${String(booking.startTime.getMinutes()).padStart(2, '0')}`;

      const [year, month, day] = date.split('-').map(Number);
      const [hour, minute] = time.split(':').map(Number);

      newStartTime = new Date(year, month - 1, day, hour, minute);
      newEndTime = new Date(newStartTime);

      // Handle duration change
      if (body.duration !== undefined) {
        newEndTime.setHours(newEndTime.getHours() + body.duration);
        const oldDuration = booking.duration || (booking.endTime ? (new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime()) / (1000 * 60 * 60) : 1);
        
        newPrice = (booking.instructor.hourlyRate || 0) * body.duration;
        priceDifference = newPrice - booking.price;
      } else {
        newEndTime.setHours(newEndTime.getHours() + (booking.duration || 1));
      }

      updateData.startTime = newStartTime;
      updateData.endTime = newEndTime;
    } else if (body.duration !== undefined) {
      // Only duration changed
      const oldDuration = booking.duration || (booking.endTime ? (new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime()) / (1000 * 60 * 60) : 1);

      newEndTime = new Date(newStartTime);
      newEndTime.setHours(newEndTime.getHours() + body.duration);

      newPrice = (booking.instructor.hourlyRate || 0) * body.duration;
      priceDifference = newPrice - booking.price;

      updateData.endTime = newEndTime;
      updateData.duration = body.duration;
    }

    // Handle pickup location change
    if (body.pickupLocation) {
      updateData.pickupAddress = body.pickupLocation;
    }

    // Handle price difference
    if (priceDifference !== 0) {
      if (priceDifference > 0) {
        // Price increased - check if client has enough credits
        if (walletBalance.balance < priceDifference) {
          return NextResponse.json(
            {
              error: 'Insufficient credits for duration increase',
              required: priceDifference,
              available: walletBalance.balance,
            },
            { status: 400 }
          );
        }

        // ✅ P0 FIX #2: Create debit transaction (no stored balance update)
        await prisma.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'DEBIT',
            amount: priceDifference,
            status: 'CONFIRMED',
            description: `Duration increase: +${(priceDifference / (booking.instructor.hourlyRate || 1)).toFixed(1)}h`,
            bookingId,
          } as any,
        });
      } else if (priceDifference < 0) {
        // Price decreased - refund credits
        const refundAmount = Math.abs(priceDifference);

        // ✅ P0 FIX #2: Create credit transaction (no stored balance update)
        await prisma.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'CREDIT',
            amount: refundAmount,
            status: 'CONFIRMED',
            description: `Duration reduction: -${((refundAmount / (booking.instructor.hourlyRate || 1)).toFixed(1))}h`,
            bookingId,
          } as any,
        });
      }

      updateData.price = newPrice;
    }

    // Track original start time on first reschedule
    if (!booking.originalStartTime && booking.startTime) {
      updateData.originalStartTime = booking.startTime
    }

    // P0-6 FIX: Set isNonRefundable when rescheduling inside the 48h penalty window
    if (isInsidePenaltyWindow) {
      updateData.isNonRefundable = true;
    }

    // Append to reschedule history
    const historyEntry = {
      previousStart: booking.startTime,
      previousEnd: booking.endTime,
      rescheduledAt: now.toISOString(),
      rescheduledBy: user.id,
      role: 'client',
    }
    const existingHistory = ((booking as any).rescheduledFrom as any[]) || []
    updateData.rescheduledFrom = [...existingHistory, historyEntry]
    updateData.rescheduleCount = (booking.rescheduleCount || 0) + 1

    // Update the booking
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: updateData,
    });
    
    // Get updated balance
    const newBalance = await getWalletBalance(user.id);

    console.log('Booking updated:', {
      bookingId,
      changes: updateData,
      priceDifference,
      newPrice,
    });

    // Notifications
    try {
      const reschedChannels = getNotifChannels('BOOKING_RESCHEDULED');
      if (reschedChannels.inApp) {
        if (booking.instructor?.userId) {
          await notifyBookingRescheduled(
            booking.instructor.userId,
            booking.client?.name || booking.clientName || 'Client',
            bookingId,
            newStartTime
          );
        }
        await notifyClientBookingRescheduled(
          user.id,
          booking.instructor.name,
          bookingId,
          newStartTime
        );
      }
    } catch (e) { console.error('Reschedule notification failed:', e); }

    // FIX #13: Audit log on client reschedule.
    try {
      await (prisma as any).auditLog.create({
        data: {
          action: 'BOOKING_RESCHEDULED',
          actorId: user.id,
          actorRole: 'CLIENT',
          targetType: 'BOOKING',
          targetId: bookingId,
          success: true,
          metadata: {
            oldStartTime: booking.startTime?.toISOString() ?? null,
            oldEndTime: booking.endTime?.toISOString() ?? null,
            newStartTime: newStartTime.toISOString(),
            newEndTime: newEndTime.toISOString(),
            priceDifference,
            rescheduledBy: 'client',
          },
        },
      })
    } catch (auditErr) {
      console.error('Audit log failed for client reschedule:', auditErr)
    }

    return NextResponse.json({
      success: true,
      booking: updatedBooking,
      priceDifference,
      newPrice,
      remainingBalance: newBalance.balance,
    });
  } catch (error) {
    console.error('Reschedule error:', error);
    return NextResponse.json(
      { error: 'Failed to reschedule booking' },
      { status: 500 }
    );
  }
}
