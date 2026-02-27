import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
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

    // Get all clients associated with this user
    const clients = await prisma.client.findMany({
      where: { userId: user.id }
    });

    const clientIds = clients.map(c => c.id);

    if (clientIds.length === 0) {
      return NextResponse.json({
        packages: [],
        summary: {
          total: 0,
          used: 0,
          remaining: 0,
          activeCount: 0,
          expiring_soon: 0
        }
      });
    }

    // Get all package bookings (parent bookings with isPackageBooking=true)
    const packageBookings = await prisma.booking.findMany({
      where: {
        clientId: { in: clientIds },
        isPackageBooking: true
      },
      include: { 
        instructor: { 
          select: { id: true, name: true } 
        },
        client: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // For each package, get child bookings and calculate hours
    const packages = await Promise.all(packageBookings.map(async (packageBooking) => {
      // Get all child bookings (scheduled lessons from this package)
      const childBookings = await prisma.booking.findMany({
        where: {
          parentBookingId: packageBooking.id,
          isPackageBooking: false
        },
        orderBy: { startTime: 'asc' }
      });

      // Calculate hours used from completed/confirmed bookings
      const hoursUsed = childBookings
        .filter(b => b.status === 'COMPLETED' || b.status === 'CONFIRMED')
        .reduce((sum, b) => {
          const duration = (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / (1000 * 60 * 60);
          return sum + duration;
        }, 0);

      // Calculate remaining hours
      const packageHours = packageBooking.packageHours || 0;
      const remaining = Math.max(0, packageHours - hoursUsed);

      // Determine status
      const now = new Date();
      const isExpired = packageBooking.packageExpiryDate && new Date(packageBooking.packageExpiryDate) < now;
      const isCompleted = remaining === 0;
      const status = isExpired ? 'expired' : isCompleted ? 'completed' : packageBooking.packageStatus || 'active';

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
        bookings: childBookings.map(b => ({
          id: b.id,
          date: b.startTime,
          instructor: packageBooking.instructor.name,
          duration: (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / (1000 * 60 * 60),
          status: b.status,
          price: b.price
        }))
      };
    }));

    // Calculate summary
    const summary = {
      total: packages.reduce((sum, p) => sum + p.hoursTotal, 0),
      used: packages.reduce((sum, p) => sum + p.hoursUsed, 0),
      remaining: packages.reduce((sum, p) => sum + p.hoursRemaining, 0),
      activeCount: packages.filter(p => p.status === 'active').length,
      expiring_soon: packages.filter(p => {
        if (!p.expiryDate) return false;
        const daysUntilExpiry = (new Date(p.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
        return daysUntilExpiry <= 7 && daysUntilExpiry >= 0;
      }).length
    };

    return NextResponse.json({
      packages,
      summary
    });

  } catch (error) {
    console.error('Get packages error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
