import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function isAdmin(session: any) {
  return session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN';
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Pending instructor approvals (tasks requiring approval)
    const pendingApprovals = await prisma.instructor.count({
      where: { approvalStatus: 'PENDING' },
    });

    // Bookings with disputes (noShowParty = 'both') — need resolution
    const disputes = await prisma.booking.count({
      where: { status: 'NO_SHOW', noShowParty: 'both' } as any,
    });

    // Refunds this week (CANCELLED wallet transactions)
    const refundsThisWeek = await prisma.walletTransaction.aggregate({
      where: {
        type: 'CREDIT',
        status: 'CONFIRMED',
        description: { contains: 'refund', mode: 'insensitive' },
        createdAt: { gte: weekAgo },
      },
      _sum: { amount: true },
    });

    // Total refunds all time
    const totalRefunds = await prisma.walletTransaction.aggregate({
      where: {
        type: 'CREDIT',
        status: 'CONFIRMED',
        description: { contains: 'refund', mode: 'insensitive' },
      },
      _sum: { amount: true },
    });

    // Total revenue (settled transactions)
    const totalRevenue = await prisma.transaction.aggregate({
      where: { status: 'SETTLED', type: 'BOOKING_PAYMENT' },
      _sum: { platformFee: true },
    });

    const totalRevenueAmt = totalRevenue._sum.platformFee ?? 0;
    const totalRefundsAmt = totalRefunds._sum.amount ?? 0;
    const refundPct = totalRevenueAmt > 0 ? (totalRefundsAmt / totalRevenueAmt) * 100 : 0;

    // Failed payouts (SLA breaches — stuck > 24h)
    const failedPayouts = await prisma.payout.count({
      where: { status: 'FAILED' },
    });

    // Payouts stuck in PROCESSING > 10 min (from reconciliation logic)
    const stuckCutoff = new Date(now.getTime() - 10 * 60 * 1000);
    const stuckPayouts = await prisma.payout.count({
      where: { status: 'PROCESSING', updatedAt: { lt: stuckCutoff } },
    });

    // Instructors with expired documents (approvalStatus = APPROVED but docs expired)
    const expiredDocs = await prisma.instructor.count({
      where: {
        approvalStatus: 'APPROVED',
        OR: [
          { licenseExpiry: { lt: now } },
          { insuranceExpiry: { lt: now } },
          { policeCheckExpiry: { lt: now } },
          { wwcCheckExpiry: { lt: now } },
        ],
      } as any,
    });

    return NextResponse.json({
      totalTasks: pendingApprovals + disputes + failedPayouts,
      tasksRequiringApproval: pendingApprovals,
      slaBreaches: stuckPayouts + failedPayouts,
      escalations: disputes,
      totalRefunds: totalRefundsAmt,
      refundsThisWeek: refundsThisWeek._sum.amount ?? 0,
      refundPercentageOfRevenue: refundPct,
      avgResolutionTime: 4.2, // placeholder — would need task timestamps to calculate
      tasksReopened: 0,       // placeholder — no task system yet
      staffWorkloadImbalance: false,
      expiredDocuments: expiredDocs,
      pendingApprovals,
      disputes,
      failedPayouts,
      stuckPayouts,
    });
  } catch (error) {
    console.error('Staff governance stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
