import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { bookingId, packageBookingId, hoursToDeduct } = body;

    if (!bookingId || !packageBookingId || !hoursToDeduct) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get the current booking to finalize
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        instructor: true,
        user: true
      }
    });

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Verify user owns the booking
    if (booking.user?.email !== session.user.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Get the package booking to validate hours
    const packageBooking = await prisma.booking.findUnique({
      where: { id: packageBookingId },
      include: {
        instructor: true
      }
    });

    if (!packageBooking) {
      return NextResponse.json(
        { error: 'Package booking not found' },
        { status: 404 }
      );
    }

    // Calculate available hours from package booking by summing already used child bookings
    const packageTotalHours = packageBooking.packageHours || 0;
    const packageUsedStored = packageBooking.packageHoursUsed || 0;

    // Sum durations of other child bookings (confirmed/completed) for this package
    const otherChildBookings = await prisma.booking.findMany({
      where: {
        parentBookingId: packageBookingId,
        id: { not: bookingId },
        status: { in: ['COMPLETED', 'CONFIRMED'] }
      },
      select: { startTime: true, endTime: true }
    });

    const otherUsedHours = otherChildBookings.reduce((sum, b) => {
      const dur = (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / (1000 * 60 * 60);
      return sum + dur;
    }, 0);

    const availableHours = packageTotalHours - packageUsedStored - otherUsedHours;

    if (availableHours < hoursToDeduct) {
      return NextResponse.json(
        { error: `Insufficient hours. Available: ${availableHours.toFixed(2)}, Requested: ${hoursToDeduct}` },
        { status: 400 }
      );
    }

    // Update booking to mark it as a child booking using package hours
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CONFIRMED',
        price: 0,
        isPackageBooking: false, // child booking should NOT be flagged as the package parent
        parentBookingId: packageBookingId,
        paymentIntentId: `package-${packageBookingId}-${bookingId}`,
        paidAt: new Date()
      },
      include: {
        instructor: true,
        user: true
      }
    });

    // Increment packageHoursUsed on the parent package booking
    await prisma.booking.update({
      where: { id: packageBookingId },
      data: {
        packageHoursUsed: { increment: hoursToDeduct },
        packageHoursRemaining: { set: Math.max(0, packageTotalHours - (packageUsedStored + otherUsedHours + hoursToDeduct)) },
        packageStatus: (packageUsedStored + otherUsedHours + hoursToDeduct) >= packageTotalHours ? 'completed' : 'active'
      }
    });

    // Create transaction record and update wallet totals (monetary representation)
    const userWallet = await prisma.clientWallet.findFirst({
      where: { user: { email: session.user.email } }
    });

    if (userWallet) {
      const transactionAmount = hoursToDeduct * (booking.instructor?.hourlyRate || 0);
      await prisma.transaction.create({
        data: {
          bookingId: bookingId,
          instructorId: booking.instructorId,
          amount: transactionAmount,
          platformFee: 0,
          instructorPayout: transactionAmount,
          type: 'BOOKING_PAYMENT',
          status: 'COMPLETED',
          description: `Booking with ${booking.instructor?.name} - ${hoursToDeduct} hours from package`,
          metadata: {
            bookingId: bookingId,
            packageBookingId: packageBookingId,
            hoursDeducted: hoursToDeduct,
            instructorName: booking.instructor?.name
          }
        }
      } as any);

      // Update wallet totals (monetary equivalent deducted)
      await prisma.clientWallet.update({
        where: { id: userWallet.id },
        data: {
          totalSpent: { increment: transactionAmount },
          creditsRemaining: { decrement: transactionAmount }
        }
      });
    }

    return NextResponse.json({
      success: true,
      bookingId: updatedBooking.id,
      message: 'Booking confirmed using package hours'
    });
  } catch (error) {
    console.error('Error confirming package booking:', error);
    return NextResponse.json(
      { error: 'Failed to confirm package booking' },
      { status: 500 }
    );
  }
}
