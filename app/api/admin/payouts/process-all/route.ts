import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const payoutRef = `PAYOUT-ALL-${Date.now()}`;

    const result = await (prisma as any).transaction.updateMany({
      where: {
        status: 'PENDING',
        type: 'BOOKING_PAYMENT',
        booking: {
          status: { in: ['CONFIRMED', 'COMPLETED'] },
          endTime: { lte: now },
          deletedAt: null,
        },
      },
      data: {
        status: 'COMPLETED',
        description: `Bulk payout ${payoutRef} by ${session.user.email || session.user.id}`,
      },
    });

    return NextResponse.json({
      success: true,
      count: result.count,
      payoutRef,
      message: `${result.count} transactions marked as paid`,
    });
  } catch (error) {
    console.error('Process-all error:', error);
    return NextResponse.json({ error: 'Failed to process all payouts' }, { status: 500 });
  }
}
