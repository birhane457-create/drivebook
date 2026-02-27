import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    if (!user || booking.userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Check reschedule policy - must be at least 12 hours before lesson
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

    // Get wallet
    const wallet = await prisma.clientWallet.findUnique({
      where: { userId: user.id },
    });

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};
    let newStartTime = booking.startTime;
    let newEndTime = booking.endTime;
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
        const oldDuration = booking.duration || (new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime()) / (1000 * 60 * 60);
        const durationDifference = body.duration - oldDuration;
        
        newPrice = (booking.instructor.hourlyRate || 0) * body.duration;
        priceDifference = newPrice - booking.price;
      } else {
        newEndTime.setHours(newEndTime.getHours() + (booking.duration || 1));
      }

      updateData.startTime = newStartTime;
      updateData.endTime = newEndTime;
    } else if (body.duration !== undefined) {
      // Only duration changed
      const oldDuration = booking.duration || (new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime()) / (1000 * 60 * 60);
      const durationDifference = body.duration - oldDuration;

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
        if (wallet.balance < priceDifference) {
          return NextResponse.json(
            {
              error: 'Insufficient credits for duration increase',
              required: priceDifference,
              available: wallet.balance,
            },
            { status: 400 }
          );
        }

        // Deduct additional credits
        await prisma.clientWallet.update({
          where: { userId: user.id },
          data: {
            balance: wallet.balance - priceDifference,
          },
        });

        // Create debit transaction
        await prisma.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'DEBIT',
            amount: priceDifference,
            description: `Duration increase: +${(priceDifference / (booking.instructor.hourlyRate || 1)).toFixed(1)}h`,
            status: 'COMPLETED',
            bookingId,
          },
        });
      } else if (priceDifference < 0) {
        // Price decreased - refund credits
        const refundAmount = Math.abs(priceDifference);

        await prisma.clientWallet.update({
          where: { userId: user.id },
          data: {
            balance: wallet.balance + refundAmount,
          },
        });

        // Create credit transaction
        await prisma.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'CREDIT',
            amount: refundAmount,
            description: `Duration reduction: -${((refundAmount / (booking.instructor.hourlyRate || 1)).toFixed(1))}h`,
            status: 'COMPLETED',
            bookingId,
          },
        });
      }

      updateData.price = newPrice;
    }

    // Track original booking time for cancellation policy (prevents reschedule loophole)
    if (!booking.originalBookingTime) {
      updateData.originalBookingTime = booking.startTime;
    }
    updateData.rescheduledCount = (booking.rescheduledCount || 0) + 1;

    // Update the booking
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: updateData,
    });

    console.log('Booking updated:', {
      bookingId,
      changes: updateData,
      priceDifference,
      newPrice,
    });

    return NextResponse.json({
      success: true,
      booking: updatedBooking,
      priceDifference,
      newPrice,
      remainingBalance: wallet.balance + (priceDifference < 0 ? Math.abs(priceDifference) : -priceDifference),
    });
  } catch (error) {
    console.error('Reschedule error:', error);
    return NextResponse.json(
      { error: 'Failed to reschedule booking' },
      { status: 500 }
    );
  }
}
