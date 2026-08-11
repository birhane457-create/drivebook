import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getPlatformLedger } from '@/lib/services/ledger-service';
import { DEFAULT_TIMEZONE } from '@/lib/utils/timezone';

import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    const now = new Date();
    const from = fromParam ? new Date(`${fromParam}T00:00:00.000Z`) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    const to   = toParam   ? new Date(`${toParam}T23:59:59.999Z`)   : now;

    const dateFilter = { gte: from, lte: to };

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    /**
     * COMMISSION = platformFee on BOOKING_PAYMENT transactions with status COMPLETED.
     * Bookings stay CONFIRMED after payment (not marked COMPLETED separately),
     * so we filter on transaction status only — not booking status.
     * This excludes wallet top-ups (no bookingId / different type) and PENDING/REFUNDED/CANCELLED txns.
     */
    const commissionWhere = {
      type: 'BOOKING_PAYMENT',
      status: 'COMPLETED',
      createdAt: dateFilter,
    };

    const commissionWhereAllTime = {
      type: 'BOOKING_PAYMENT',
      status: 'COMPLETED',
    };

    const commissionWhereThisMonth = { ...commissionWhereAllTime, createdAt: { gte: startOfMonth, lte: now } };
    const commissionWhereLastMonth = { ...commissionWhereAllTime, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } };

    const [
      commissionAgg,
      commissionAllTime,
      commissionThisMonth,
      commissionLastMonth,
      pendingAgg,
      completedPayoutsAgg,
      refundedAgg,
      totalCompletedLessons,
      pendingRefundCount,
      platformLedger,
    ] = await Promise.all([
      prisma.transaction.aggregate({ where: commissionWhere, _sum: { platformFee: true, amount: true, instructorPayout: true }, _count: { id: true } }),
      prisma.transaction.aggregate({ where: commissionWhereAllTime, _sum: { platformFee: true, amount: true, instructorPayout: true }, _count: { id: true } }),
      prisma.transaction.aggregate({ where: commissionWhereThisMonth, _sum: { platformFee: true, amount: true } }),
      prisma.transaction.aggregate({ where: commissionWhereLastMonth, _sum: { platformFee: true, amount: true } }),
      prisma.transaction.aggregate({ where: { status: 'PENDING', type: 'BOOKING_PAYMENT' }, _sum: { instructorPayout: true } }),
      prisma.transaction.aggregate({ where: { status: 'COMPLETED', type: 'BOOKING_PAYMENT' }, _sum: { instructorPayout: true } }),
      prisma.transaction.aggregate({ where: { status: 'REFUNDED', createdAt: dateFilter }, _sum: { amount: true }, _count: { id: true } }),
      prisma.transaction.count({ where: commissionWhere }),
      prisma.transaction.count({ where: { status: 'PENDING', type: 'REFUND' } }),
      getPlatformLedger(),
    ]);

    // --- Top instructors by payout (within date range) ---
    // MongoDB doesn't support groupBy with nested relation filters, so fetch and aggregate in JS
    const eligibleTxns = await prisma.transaction.findMany({
      where: commissionWhere,
      select: {
        instructorId: true,
        instructorPayout: true,
        platformFee: true,
        amount: true,
      },
    });

    const instrAgg = new Map<string, { payout: number; fee: number; gross: number; count: number }>();
    for (const t of eligibleTxns) {
      if (!t.instructorId) continue;
      const e = instrAgg.get(t.instructorId) || { payout: 0, fee: 0, gross: 0, count: 0 };
      e.payout += t.instructorPayout || 0;
      e.fee += t.platformFee || 0;
      e.gross += t.amount || 0;
      e.count += 1;
      instrAgg.set(t.instructorId, e);
    }

    const instructorIds = Array.from(instrAgg.keys());
    const instructors = await prisma.instructor.findMany({
      where: { id: { in: instructorIds } },
      select: { id: true, name: true },
    });
    const instrMap = new Map(instructors.map(i => [i.id, i.name]));

    const topInstructors = Array.from(instrAgg.entries())
      .map(([id, e]) => ({
        id,
        name: instrMap.get(id) || 'Unknown',
        totalEarnings: e.payout,
        platformFee: e.fee,
        grossAmount: e.gross,
        transactionCount: e.count,
      }))
      .sort((a, b) => b.totalEarnings - a.totalEarnings)
      .slice(0, 10);

    // --- Revenue by month (last 6 months, always fixed range for chart) ---
    // R-03: parallelise all 6 month queries with Promise.all instead of sequential awaits.
    // Old approach: 6 × ~50ms = ~300ms serial. New: ~50ms total (one round-trip per query, all concurrent).
    const monthRanges = Array.from({ length: 6 }, (_, idx) => {
      const i = 5 - idx; // i = 5,4,3,2,1,0 → oldest to most recent
      return {
        i,
        mStart: new Date(now.getFullYear(), now.getMonth() - i, 1),
        mEnd: new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59),
      };
    });
    const monthAggs = await Promise.all(
      monthRanges.map(({ mStart, mEnd }) =>
        (prisma as any).transaction.aggregate({
          where: { type: 'BOOKING_PAYMENT', status: 'COMPLETED', createdAt: { gte: mStart, lte: mEnd } },
          _sum: { platformFee: true, amount: true, instructorPayout: true },
          _count: { id: true },
        })
      )
    );
    const revenueByMonth = monthRanges.map(({ mStart }, idx) => {
      const agg = monthAggs[idx];
      return {
        month: mStart.toLocaleDateString('en-AU', { month: 'short', year: 'numeric', timeZone: DEFAULT_TIMEZONE }),
        commission: agg._sum.platformFee || 0,
        gross: agg._sum.amount || 0,
        instructorPayout: agg._sum.instructorPayout || 0,
        transactions: agg._count?.id || 0,
      };
    });

    // --- Recent transactions (filtered range, BOOKING_PAYMENT only) ---
    const recentTransactions = await (prisma as any).transaction.findMany({
      where: { type: 'BOOKING_PAYMENT', createdAt: dateFilter },
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        booking: {
          select: {
            clientName: true, startTime: true, status: true,
            instructor: { select: { id: true, name: true } },
          },
        },
      },
    });

    // --- Refunded transactions (filtered range) ---
    const refundedTransactions = await (prisma as any).transaction.findMany({
      where: { status: 'REFUNDED', createdAt: dateFilter },
      take: 50,
      orderBy: { updatedAt: 'desc' },
      include: {
        booking: {
          select: {
            clientName: true, startTime: true,
            instructor: { select: { id: true, name: true } },
          },
        },
      },
    });

    const thisMonthCommission = commissionThisMonth._sum.platformFee || 0;
    const lastMonthCommission = commissionLastMonth._sum.platformFee || 0;

    return NextResponse.json({
      // Filtered range stats (for date-filtered view)
      rangeCommission: commissionAgg._sum.platformFee || 0,
      rangeGross: commissionAgg._sum.amount || 0,
      rangeInstructorPayout: commissionAgg._sum.instructorPayout || 0,
      rangeLessons: commissionAgg._count?.id || 0,
      rangeRefunds: refundedAgg._sum.amount || 0,
      rangeRefundCount: refundedAgg._count?.id || 0,

      // All-time totals (always shown in header cards)
      totalCommission: commissionAllTime._sum.platformFee || 0,
      totalGross: commissionAllTime._sum.amount || 0,
      totalInstructorPayouts: commissionAllTime._sum.instructorPayout || 0,
      totalCompletedLessons: commissionAllTime._count?.id || 0,

      // Month-over-month
      thisMonthCommission,
      lastMonthCommission,
      thisMonthGross: commissionThisMonth._sum.amount || 0,

      // Payouts
      pendingPayouts: pendingAgg._sum.instructorPayout || 0,
      completedPayouts: completedPayoutsAgg._sum.instructorPayout || 0,

      // Refunds (all time)
      totalRefunds: refundedAgg._sum.amount || 0,
      refundCount: refundedAgg._count?.id || 0,
      pendingRefunds: pendingRefundCount,

      totalTransactions: totalCompletedLessons,
      topInstructors,
      revenueByMonth,
      recentTransactions,
      refundedTransactions,

      // Date range echoed back
      from: from.toISOString(),
      to: to.toISOString(),

      // Platform ledger — real-time balance
      ledger: platformLedger,
    });
  } catch (error) {
    console.error('Revenue fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch revenue data' }, { status: 500 });
  }
}
