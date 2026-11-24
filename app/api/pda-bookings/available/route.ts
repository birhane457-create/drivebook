import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * List only PDA test bookings belonging to the authenticated customer.
 * The legacy client PDA page consumes a flat array with centre/provider labels.
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

    const bookings = await prisma.pDATestBooking.findMany({
      where: { customer: { userId: user.id } },
      include: {
        provider: { select: { id: true, name: true } },
        config: { select: { name: true, durationMinutes: true } },
        testCentre: { select: { name: true, address: true, suburb: true, state: true } },
      },
      orderBy: [{ testDate: 'desc' }, { testTime: 'desc' }],
    });

    return NextResponse.json(bookings.map((booking) => ({
      id: booking.id,
      providerId: booking.providerId,
      instructor: booking.provider,
      testDate: booking.testDate.toISOString(),
      testTime: booking.testTime,
      testCenterName: booking.testCentre.name,
      testCenterAddress: [booking.testCentre.address, booking.testCentre.suburb, booking.testCentre.state].filter(Boolean).join(', '),
      result: booking.result,
      price: Number(booking.price),
      status: booking.status,
      bookedAt: booking.createdAt.toISOString(),
      configName: booking.config.name,
      durationMinutes: booking.config.durationMinutes,
    })));
  } catch (error) {
    console.error('Get client PDA bookings error:', error);
    return NextResponse.json({ error: 'Failed to load PDA bookings' }, { status: 500 });
  }
}
