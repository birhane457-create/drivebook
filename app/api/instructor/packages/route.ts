import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';


export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const instructorId = session.user.instructorId;
    const now = new Date();

    // Get all active packages (parent bookings with remaining hours)
    const packages = await prisma.booking.findMany({
      where: {
        instructorId,
        isPackageBooking: true,
        parentBookingId: null,
        packageHoursRemaining: { gt: 0 },
        status: { in: ['CONFIRMED', 'COMPLETED'] },
        OR: [
          { packageStatus: 'active' },
          { packageStatus: null }
        ]
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      },
      orderBy: {
        packageExpiryDate: 'asc'
      }
    });

    // For each package, get upcoming bookings
    const packagesWithBookings = await Promise.all(
      packages.map(async (pkg) => {
        const upcomingBookings = await prisma.booking.findMany({
          where: {
            parentBookingId: pkg.id,
            status: 'CONFIRMED',
            startTime: { gte: now }
          },
          select: {
            id: true,
            startTime: true,
            endTime: true,
            duration: true,
            price: true,
            instructorPayout: true
          },
          orderBy: {
            startTime: 'asc'
          }
        });

        const hourlyRate = pkg.price / (pkg.packageHours || 1);
        const potentialGross = (pkg.packageHoursRemaining || 0) * hourlyRate;
        const potentialNet = potentialGross * ((pkg.instructorPayout || 0) / (pkg.price || 1));

        const daysUntilExpiry = pkg.packageExpiryDate 
          ? Math.ceil((new Date(pkg.packageExpiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null;
        const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry < 30;

        const usagePercentage = pkg.packageHours 
          ? ((pkg.packageHoursUsed || 0) / pkg.packageHours) * 100
          : 0;

        return {
          id: pkg.id,
          client: pkg.client,
          packageHours: pkg.packageHours || 0,
          packageHoursUsed: pkg.packageHoursUsed || 0,
          packageHoursRemaining: pkg.packageHoursRemaining || 0,
          usagePercentage: Math.round(usagePercentage),
          packageStatus: pkg.packageStatus || 'active',
          packageExpiryDate: pkg.packageExpiryDate,
          daysUntilExpiry,
          isExpiringSoon,
          purchaseDate: pkg.createdAt,
          totalPrice: pkg.price,
          instructorPayout: pkg.instructorPayout || 0,
          hourlyRate,
          potentialGross,
          potentialNet,
          upcomingBookings: upcomingBookings.map(booking => ({
            id: booking.id,
            startTime: booking.startTime,
            endTime: booking.endTime,
            duration: booking.duration,
            price: booking.price,
            instructorPayout: booking.instructorPayout
          })),
          upcomingBookingsCount: upcomingBookings.length,
          upcomingBookingsValue: upcomingBookings.reduce((sum, b) => sum + (b.instructorPayout || 0), 0)
        };
      })
    );

    const totalPackages = packagesWithBookings.length;
    const totalHoursRemaining = packagesWithBookings.reduce((sum, p) => sum + p.packageHoursRemaining, 0);
    const totalPotentialNet = packagesWithBookings.reduce((sum, p) => sum + p.potentialNet, 0);
    const totalUpcomingValue = packagesWithBookings.reduce((sum, p) => sum + p.upcomingBookingsValue, 0);
    const expiringPackages = packagesWithBookings.filter(p => p.isExpiringSoon);

    return NextResponse.json({
      packages: packagesWithBookings,
      summary: {
        totalPackages,
        totalHoursRemaining,
        totalPotentialNet,
        totalUpcomingValue,
        expiringPackagesCount: expiringPackages.length
      }
    });
  } catch (error) {
    console.error('Packages fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch packages' },
      { status: 500 }
    );
  }
}
