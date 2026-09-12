import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCommissionRate } from '@/lib/services/platform-pricing';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    const { resolveProviderId } = await import('@/lib/auth/resolveProvider')
    const providerId = await resolveProviderId(session)
    if (!providerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const now = new Date();

    // Fetch instructor's hourly rate and subscription tier in a single query
    const instructor = await prisma.provider.findUnique({
      where: { id: providerId },
      select: { hourlyRate: true, subscriptionTier: true },
    });
    const instructorHourlyRate = instructor?.hourlyRate ?? 0;

    // Resolve commission rate once � not per package
    const currentCommissionRate = await getCommissionRate(instructor?.subscriptionTier ?? 'BASIC');
    const fallbackCommissionRatio = currentCommissionRate / 100;

    // Get all active packages (parent bookings with remaining hours)
    const packages = await prisma.booking.findMany({
      where: {
        providerId,
        isPackageBooking: true,
        parentBookingId: null,
        packageHoursRemaining: { gt: 0 },
        status: { in: ['CONFIRMED', 'COMPLETED', 'PENDING_PAYMENT'] },
        OR: [
          { packageStatus: 'active' },
          { packageStatus: null }
        ]
      },
      include: { customer: {
          select: { id: true, name: true, email: true, phone: true }
        }
      },
      orderBy: { packageExpiryDate: 'asc' }
    });

    // Batch-fetch all upcoming child bookings in one query � eliminates N+1
    const packageIds = packages.map(p => p.id);
    const allUpcomingBookings = packageIds.length > 0
      ? await prisma.booking.findMany({
          where: {
            parentBookingId: { in: packageIds },
            status: 'CONFIRMED',
            startTime: { gte: now },
          },
          select: {
            id: true,
            parentBookingId: true,
            startTime: true,
            endTime: true,
            duration: true,
            price: true,
            providerPayout: true,
          },
          orderBy: { startTime: 'asc' },
        }) as any[]
      : [];

    // Group child bookings by parent package id
    const bookingsByPackage = new Map<string, typeof allUpcomingBookings>();
    for (const b of allUpcomingBookings) {
      const key = b.parentBookingId!;
      if (!bookingsByPackage.has(key)) bookingsByPackage.set(key, []);
      bookingsByPackage.get(key)!.push(b);
    }

    const packagesWithBookings = packages.map((pkg) => {
      const upcomingBookings = bookingsByPackage.get(pkg.id) ?? [];

      const potentialGross = (Number(pkg.packageHoursRemaining) || 0) * instructorHourlyRate;

      // Use stored payout ratio if available, otherwise use pre-resolved fallback
      let commissionRatio = fallbackCommissionRatio;
      if (pkg.price && Number(pkg.price) > 0 && pkg.providerPayout && Number(pkg.providerPayout) > 0) {
        commissionRatio = 1 - (Number(pkg.providerPayout) / Number(pkg.price));
      }
      const potentialNet = potentialGross * (1 - commissionRatio);

      const daysUntilExpiry = pkg.packageExpiryDate
        ? Math.ceil((new Date(pkg.packageExpiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry < 30;

      const usagePercentage = pkg.packageHours
        ? ((Number(pkg.packageHoursUsed) || 0) / Number(pkg.packageHours)) * 100
        : 0;

      return {
        id: pkg.id,
        client: pkg.customer,
        packageHours: pkg.packageHours || 0,
        packageHoursUsed: pkg.packageHoursUsed || 0,
        packageHoursRemaining: pkg.packageHoursRemaining || 0,
        usagePercentage: Math.round(usagePercentage),
        packageStatus: pkg.packageStatus || 'active',
        isPaid: pkg.isPaid ?? false,
        bookingStatus: pkg.status,
        packageExpiryDate: pkg.packageExpiryDate ?? null,
        daysUntilExpiry,
        isExpiringSoon,
        purchaseDate: pkg.createdAt,
        totalPrice: pkg.price,
        providerPayout: pkg.providerPayout || 0,
        hourlyRate: instructorHourlyRate,
        potentialGross,
        potentialNet,
        upcomingBookings: upcomingBookings.map((b: any) => ({
          id: b.id,
          startTime: b.startTime,
          endTime: b.endTime,
          duration: b.duration,
          price: b.price,
          providerPayout: b.providerPayout,
        })),
        upcomingBookingsCount: upcomingBookings.length,
        upcomingBookingsValue: upcomingBookings.reduce((sum: any, b: any) => sum + (b.providerPayout || 0), 0),
      };
    });

    const totalPackages = packagesWithBookings.length;
    const totalHoursRemaining = packagesWithBookings.reduce((sum: any, p: any) => sum + p.packageHoursRemaining, 0);
    const totalPotentialNet = packagesWithBookings.reduce((sum: any, p: any) => sum + p.potentialNet, 0);
    const totalUpcomingValue = packagesWithBookings.reduce((sum: any, p: any) => sum + p.upcomingBookingsValue, 0);
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
