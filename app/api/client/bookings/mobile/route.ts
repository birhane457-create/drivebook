import { NextRequest, NextResponse } from 'next/server';
import { validateMobileToken } from '../../../../lib/mobile-auth';
import { prisma } from '../../../../lib/prisma';

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

    // Get client record
    const client = await prisma.client.findFirst({
      where: { userId: auth.user!.id },
      select: { id: true },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client profile not found' }, { status: 404 });
    }

    // Get filter from query params
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') || 'all';

    // Build where clause based on filter
    let whereClause: any = {
      clientId: client.id,
    };

    const now = new Date();

    if (filter === 'upcoming') {
      whereClause.startTime = { gte: now };
      whereClause.status = { in: ['PENDING', 'CONFIRMED'] };
    } else if (filter === 'completed') {
      whereClause.status = 'COMPLETED';
    } else if (filter === 'cancelled') {
      whereClause.status = 'CANCELLED';
    }

    // Fetch bookings
    const bookings = await prisma.booking.findMany({
      where: whereClause,
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
            phone: true,
            profileImage: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        startTime: 'desc',
      },
    });

    // Format response
    const formattedBookings = bookings.map((booking) => ({
      id: booking.id,
      instructorId: booking.instructorId,
      instructorName: booking.instructor.name,
      instructorPhone: booking.instructor.phone,
      instructorEmail: booking.instructor.user.email,
      instructorImage: booking.instructor.profileImage,
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
      duration: booking.duration,
      status: booking.status,
      bookingType: booking.bookingType,
      price: booking.price,
      pickupAddress: booking.pickupAddress,
      dropoffAddress: booking.dropoffAddress,
      notes: booking.notes,
      isPackageBooking: booking.isPackageBooking,
      packageHours: booking.packageHours,
      packageHoursUsed: booking.packageHoursUsed,
      packageHoursRemaining: booking.packageHoursRemaining,
      checkInTime: booking.checkInTime?.toISOString(),
      checkOutTime: booking.checkOutTime?.toISOString(),
      createdAt: booking.createdAt.toISOString(),
    }));

    return NextResponse.json(formattedBookings);
  } catch (error) {
    console.error('Error fetching client bookings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
