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

    // Fetch instructor's actual hourly rate — used for all earnings calculations
    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
      select: { hourlyRate: true },
    });
    const instructorHourlyRate = instructor?.hourlyRate ?? 0;

    // Get all active packages (parent bookings with remaining hours)
    // Include PENDING_PAYMENT so instructors can see packages awaiting payment too
    const packages = await prisma.booking.findMany({
      where: {
        instructorId,
        isPackageBooking: true,
        parentBookingId: null,
        packageHoursRemaining: { gt: 0 },
        status: { in: ['CONFIRMED', 'COMPLETED', 'PENDING_PAYMENT'] },
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

        // Use instructor's actual hourly rate — not derived from package price
        // (pkg.price is the discounted package total, not hourlyRate × hours)
        const potentialGross = (pkg.packageHoursRemaining || 0) * instructorHourlyRate;

        // Potential net = gross minus platform commission
        // Derive commission rate from the booking's stored payout ratio if available,
        // otherwise fall back to the instructor's current rate from PlatformSettings.
        let commissionRatio = 0
        if (pkg.price && pkg.price > 0 && pkg.instructorPayout && pkg.instructorPayout > 0) {
          commissionRatio = 1 - (pkg.instructorPayout / pkg.price)
        } else {
          const { getCommissionRate } = await import('@/lib/services/platform-pricing')
          const session2 = await prisma.instructor.findUnique({ where: { id: instructorId }, select: { subscriptionTier: true } })
          const rate = await getCommissionRate(session2?.subscriptionTier ?? 'BASIC')
          commissionRatio = rate / 100
        }
        const potentialNet = potentialGross * (1 - commissionRatio);

        const daysUntilExpiry = pkg.packageExpiryDate
          ? Math.ceil((new Date(pkg.packageExpiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null;
        const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry < 30;

        const usagePercentage = pkg.packageHours
          ? ((pkg.packageHoursUsed || 0) / pkg.packageHours) * 100
          : 0;

        // Expiry date: null means package has no expiry set — show as null, never epoch
        const packageExpiryDate = pkg.packageExpiryDate ?? null;

        return {
          id: pkg.id,
          client: pkg.client,
          packageHours: pkg.packageHours || 0,
          packageHoursUsed: pkg.packageHoursUsed || 0,
          packageHoursRemaining: pkg.packageHoursRemaining || 0,
          usagePercentage: Math.round(usagePercentage),
          packageStatus: pkg.packageStatus || 'active',
          isPaid: pkg.isPaid ?? false,
          bookingStatus: pkg.status,
          packageExpiryDate,
          daysUntilExpiry,
          isExpiringSoon,
          purchaseDate: pkg.createdAt,
          totalPrice: pkg.price,
          instructorPayout: pkg.instructorPayout || 0,
          hourlyRate: instructorHourlyRate,
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
