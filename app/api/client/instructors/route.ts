import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { mergeDrivingProfile } from '@/lib/extensions/driving/providerProfile';

export const dynamic = 'force-dynamic';

/**
 * Return instructors the authenticated customer has previously booked with.
 * Driving-only PDA fields are merged from the extension table, keeping the
 * generic Provider model independent from driving-specific capabilities.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const customers = await prisma.customer.findMany({
      where: { userId: user.id, deletedAt: null },
      select: { id: true },
    });
    const customerIds = customers.map((customer) => customer.id);
    if (customerIds.length === 0) return NextResponse.json([]);

    const bookings = await prisma.booking.findMany({
      where: {
        customerId: { in: customerIds },
        deletedAt: null,
        provider: { isActive: true },
      },
      select: {
        provider: {
          select: {
            id: true,
            name: true,
            phone: true,
            profileImage: true,
          },
        },
      },
      distinct: ['providerId'],
      orderBy: { createdAt: 'desc' },
    });

    const uniqueProviders = new Map<string, { id: string; name: string; phone: string; profileImage: string | null }>();
    for (const booking of bookings) {
      if (booking.provider) uniqueProviders.set(booking.provider.id, booking.provider);
    }

    const instructors = await Promise.all(
      Array.from(uniqueProviders.values()).map(async (provider) => {
        const withDriving = await mergeDrivingProfile(provider.id, provider as any) as any;
        return {
          id: provider.id,
          name: provider.name,
          phone: provider.phone,
          profileImage: provider.profileImage,
          offersTestPackage: Boolean(withDriving.offersTestPackage),
          testPackagePrice: withDriving.testPackagePrice == null ? null : Number(withDriving.testPackagePrice),
          testPackageDuration: withDriving.testPackageDuration == null ? null : Number(withDriving.testPackageDuration),
        };
      }),
    );

    return NextResponse.json(instructors);
  } catch (error) {
    console.error('Get client instructors error:', error);
    return NextResponse.json({ error: 'Failed to load instructors' }, { status: 500 });
  }
}
