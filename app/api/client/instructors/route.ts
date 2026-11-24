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

    // Include instructors from both lesson bookings and standalone PDA bookings.
    // A learner can have a PDA booking without a normal lesson booking.
    const [lessonProviderRows, pdaProviderRows] = await Promise.all([
      prisma.booking.findMany({
        where: {
          customerId: { in: customerIds },
          deletedAt: null,
          provider: { isActive: true },
        },
        select: { providerId: true },
        distinct: ['providerId'],
      }),
      prisma.pDATestBooking.findMany({
        where: {
          customerId: { in: customerIds },
          provider: { isActive: true },
        },
        select: { providerId: true },
        distinct: ['providerId'],
      }),
    ]);
    const providerIds = Array.from(new Set([
      ...lessonProviderRows.map((row) => row.providerId),
      ...pdaProviderRows.map((row) => row.providerId),
    ]));

    if (providerIds.length === 0) return NextResponse.json([]);

    const providers = await prisma.provider.findMany({
      where: { id: { in: providerIds }, isActive: true },
      select: { id: true, name: true, phone: true, profileImage: true },
    });

    const instructors = await Promise.all(
      providers.map(async (provider) => {
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
