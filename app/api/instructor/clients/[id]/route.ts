import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await prisma.client.findFirst({
      where: { id: params.id, instructorId: session.user.instructorId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Wallet balance — sum of confirmed credit minus debit transactions
    let walletBalance: number | null = null;
    if (client.userId) {
      const [credits, debits] = await Promise.all([
        prisma.walletTransaction.aggregate({
          where: { userId: client.userId, type: 'CREDIT', status: 'CONFIRMED' } as any,
          _sum: { amount: true },
        }),
        prisma.walletTransaction.aggregate({
          where: { userId: client.userId, type: 'DEBIT', status: 'CONFIRMED' } as any,
          _sum: { amount: true },
        }),
      ]);
      const creditTotal = credits._sum?.amount ?? 0;
      const debitTotal = debits._sum?.amount ?? 0;
      walletBalance = creditTotal - debitTotal;
    }

    // Last 20 bookings with this instructor
    const bookings = await prisma.booking.findMany({
      where: {
        clientId: client.id,
        instructorId: session.user.instructorId,
      },
      orderBy: { startTime: 'desc' },
      take: 20,
      select: {
        id: true,
        startTime: true,
        endTime: true,
        duration: true,
        price: true,
        status: true,
        isPaid: true,
        source: true,
      },
    });

    return NextResponse.json({
      id: client.id,
      name: client.name,
      phone: client.phone,
      email: client.email,
      addressText: (client as any).addressText || (client as any).defaultPickupAddress || null,
      notes: (client as any).notes || null,
      userId: client.userId,
      hasAccount: !!client.userId,
      walletBalance,
      createdAt: client.createdAt,
      bookings: bookings.map(b => ({
        id: b.id,
        startTime: b.startTime?.toISOString() ?? null,
        duration: b.duration,
        price: b.price,
        status: b.status,
        isPaid: b.isPaid,
        source: (b as any).source ?? 'platform',
      })),
    });
  } catch (error) {
    console.error('Instructor client detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
