import { NextRequest, NextResponse } from 'next/server';
import { validateMobileToken } from '@/lib/mobile-auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    // Validate mobile token
    const auth = await validateMobileToken(req);
    if (!auth.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is a client
    if (auth.user?.role !== 'CLIENT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get client records
    const clientRecords = await prisma.client.findMany({
      where: { userId: auth.user!.id },
    });

    const clientIds = clientRecords.map((c: typeof clientRecords[number]) => c.id);

    if (clientIds.length === 0) {
      return NextResponse.json({
        packages: [],
        summary: {
          total: 0,
          used: 0,
          remaining: 0,
          activeCount: 0,
          expiring_soon: 0,
        },
      });
    }

    // Get package bookings
    const packageBookings = await prisma.booking.findMany({
      where: {
        clientId: { in: clientIds },
        isPackageBooking: true,
      },
      include: {
        instructor: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Process packages
    const packages = await Promise.all(
      packageBookings.map(async (packageBooking: typeof packageBookings[number]) => {
        const childBookings = await prisma.booking.findMany({
          where: {
            parentBookingId: packageBooking.id,
            isPackageBooking: false,
          },
          orderBy: { startTime: 'asc' },
        });

        const hoursUsed = childBookings
          .filter((b: typeof childBookings[number]) => b.status === 'COMPLETED' || b.status === 'CONFIRMED')
          .reduce((sum, b) => {
            const duration =
              (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) /
              (1000 * 60 * 60);
            return sum + duration;
          }, 0);

        const packageHours = packageBooking.packageHours || 0;
        const remaining = Math.max(0, packageHours - hoursUsed);

        const now = new Date();
        const isExpired =
          packageBooking.packageExpiryDate &&
          new Date(packageBooking.packageExpiryDate) < now;
        const isCompleted = remaining === 0;
        const status = isExpired
          ? 'expired'
          : isCompleted
          ? 'completed'
          : packageBooking.packageStatus || 'active';

        return {
          id: packageBooking.id,
          purchaseDate: packageBooking.createdAt,
          expiryDate: packageBooking.packageExpiryDate,
          hoursTotal: packageHours,
          hoursUsed: hoursUsed,
          hoursRemaining: remaining,
          status: status,
          instructor: packageBooking.instructor,
          canScheduleMore: status === 'active' && remaining > 0,
        };
      })
    );

    // Calculate summary
    const summary = {
      total: packages.reduce((sum: number, p: typeof packages[number]) => sum + p.hoursTotal, 0),
      used: packages.reduce((sum: number, p: typeof packages[number]) => sum + p.hoursUsed, 0),
      remaining: packages.reduce((sum: number, p: typeof packages[number]) => sum + p.hoursRemaining, 0),
      activeCount: packages.filter((p: typeof packages[number]) => p.status === 'active').length,
      expiring_soon: packages.filter((p: typeof packages[number]) => {
        if (!p.expiryDate) return false;
        const daysUntilExpiry =
          (new Date(p.expiryDate).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24);
        return daysUntilExpiry <= 7 && daysUntilExpiry >= 0;
      }).length,
    };

    return NextResponse.json({
      packages,
      summary,
    });
  } catch (error) {
    console.error('Error fetching client packages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Validate mobile token
    const auth = await validateMobileToken(req);
    if (!auth.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { packageId, paymentMethod } = await req.json();

    if (!packageId) {
      return NextResponse.json(
        { error: 'Package ID is required' },
        { status: 400 }
      );
    }

    // Verify user is a client
    if (auth.user?.role !== 'CLIENT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get client
    const client = await prisma.client.findFirst({
      where: { userId: auth.user!.id },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client profile not found' },
        { status: 404 }
      );
    }

    // Create package booking from packageId (which is actually booking or instructor package)
    // For now, just create a basic package booking
    const booking = await prisma.booking.create({
      data: {
        clientId: client.id,
        instructorId: packageId, // packageId should be instructor ID in this context
        isPackageBooking: true,
        packageHours: 10, // Default package hours
        packageStatus: 'active',
        packageExpiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        price: 500,
        status: 'CONFIRMED',
        isPaid: paymentMethod !== 'manual',
        duration: 10,
        startTime: new Date(),
        endTime: new Date(Date.now() + 10 * 60 * 60 * 1000),
        createdBy: auth.user!.id,
      },
    });

    return NextResponse.json(
      {
        success: true,
        bookingId: booking.id,
        message: 'Package purchased successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating package booking:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
