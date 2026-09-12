import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getDisplayName } from '@/lib/utils/account';

export const dynamic = 'force-dynamic';

/**
 * GET /api/client/pending-reviews
 * Returns completed bookings (past startTime, status CONFIRMED or COMPLETED)
 * that have not yet been reviewed by this client.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session!.user!.email } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const client = await prisma.customer.findFirst({ where: { userId: user.id } });
    if (!client) return NextResponse.json([]);

    const now = new Date();

    const bookings = await prisma.booking.findMany({
      where: {
        customerId: client.id,
        status: { in: ['CONFIRMED', 'COMPLETED'] },
        startTime: { lt: now },
        customerRating: null,
        reviewGivenAt: null,
      },
      include: {
        provider: { select: { name: true, businessName: true, accountType: true, subscriptionTier: true } },
      },
      orderBy: { startTime: 'desc' },
      take: 20,
    });

    const pending = bookings.map((b: any) => ({
      id: b.id,
      bookingId: b.id,
      instructorName: getDisplayName(b.provider),
      // Guard null startTime — page renders new Date(bookingDate) so empty string → Invalid Date
      bookingDate: b.startTime ? b.startTime.toISOString() : null,
    }));

    return NextResponse.json(pending);
  } catch (error) {
    console.error('Pending reviews error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
