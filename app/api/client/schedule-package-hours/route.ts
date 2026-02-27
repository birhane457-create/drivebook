import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { bookingId, instructorId, hoursToSchedule } = await req.json();

    if (!bookingId || !instructorId || !hoursToSchedule) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify the package booking exists and belongs to this user
    const packageBooking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        userId: user.id,
        isPackageBooking: true
      },
      include: {
        client: true
      }
    });

    if (!packageBooking) {
      return NextResponse.json(
        { error: 'Package booking not found' },
        { status: 404 }
      );
    }

    // Check if package is still active
    if (packageBooking.packageStatus !== 'active') {
      return NextResponse.json(
        { error: 'Package is not active' },
        { status: 400 }
      );
    }

    // Check if package has expired
    if (packageBooking.packageExpiryDate && new Date(packageBooking.packageExpiryDate) < new Date()) {
      return NextResponse.json(
        { error: 'Package has expired' },
        { status: 400 }
      );
    }

    // Calculate remaining hours
    const packageHours = packageBooking.packageHours || 0;
    const hoursUsed = packageBooking.packageHoursUsed || 0;
    const hoursRemaining = packageHours - hoursUsed;

    if (hoursRemaining <= 0) {
      return NextResponse.json(
        { error: 'No hours remaining in package' },
        { status: 400 }
      );
    }

    if (hoursToSchedule > hoursRemaining) {
      return NextResponse.json(
        { error: `Only ${hoursRemaining} hours remaining in package` },
        { status: 400 }
      );
    }

    // Redirect to booking page with package context
    const redirectUrl = `/book/${instructorId}/booking-details?packageId=${bookingId}&clientId=${packageBooking.clientId}&hoursRemaining=${hoursRemaining}`;

    return NextResponse.json({
      success: true,
      redirectTo: redirectUrl,
      packageInfo: {
        id: bookingId,
        hoursRemaining,
        expiryDate: packageBooking.packageExpiryDate,
        clientId: packageBooking.clientId
      }
    });

  } catch (error) {
    console.error('Schedule package hours error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
