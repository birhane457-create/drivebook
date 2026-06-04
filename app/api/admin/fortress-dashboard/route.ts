import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getPlatformLedger } from '@/lib/services/ledger-service';

export const dynamic = 'force-dynamic';

/**
 * FORTRESS DASHBOARD API
 *
 * Operational metrics for the platform owner.
 * Rewritten to use models that actually exist in schema.prisma.
 * Previous version referenced prisma.task, prisma.staffMember, prisma.refundAmount
 * (none of which exist) causing a runtime crash on every call.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
      select: { role: true },
    });
    if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // ── Financial health ─────────────────────────────────────────────────────
    const weeklyBookings = await prisma.booking.findMany({
      where: {
        createdAt: { gte: weekStart },
        status: { in: ['CONFIRMED', 'COMPLETED'] },
        deletedAt: null,
      },
      select: { price: true, platformFee: true, status: true },
    });

    const totalRevenue = weeklyBookings.reduce((s, b) => s + b.price, 0);
    const totalPlatformFees = weeklyBookings.reduce((s, b) => s + b.platformFee, 0);
    const completedCount = weeklyBookings.filter(b => b.status === 'COMPLETED').length;
    const avgBookingValue = completedCount > 0 ? totalRevenue / completedCount : 0;

    // Refunds from ledger entries this week
    const refundEntries = await (prisma as any).ledgerEntry.aggregate({
      where: {
        type: { in: ['REFUND_ISSUED', 'REFUND_SYNCED'] },
        createdAt: { gte: weekStart },
      },
      _sum: { amount: true },
    });
    const totalRefunds = Math.abs(refundEntries._sum?.amount ?? 0);
    const refundRate = totalRevenue > 0 ? (totalRefunds / totalRevenue) * 100 : 0;

    // Open disputes
    const openDisputes = await (prisma as any).stripeDispute.count({
      where: {
        status: { notIn: ['won', 'lost', 'charge_refunded', 'warning_closed'] },
      },
    });
    const lostDisputes = await (prisma as any).stripeDispute.aggregate({
      where: { status: 'lost', createdAt: { gte: weekStart } },
      _sum: { amount: true },
      _count: true,
    });

    // ── Platform ledger ───────────────────────────────────────────────────────
    const ledger = await getPlatformLedger();

    // ── Payouts this month ────────────────────────────────────────────────────
    const payoutsThisMonth = await prisma.payout.aggregate({
      where: { status: 'PAID', paidAt: { gte: monthStart } },
      _sum: { netAmount: true, grossAmount: true },
      _count: true,
    });

    const failedPayouts = await prisma.payout.count({
      where: { status: 'FAILED' },
    });

    const frozenPayouts = await (prisma as any).instructor.count({
      where: { payoutHold: true },
    });

    // ── Instructor health ─────────────────────────────────────────────────────
    const totalInstructors = await prisma.instructor.count({ where: { isActive: true } });
    const pendingApproval = await prisma.instructor.count({ where: { approvalStatus: 'PENDING' } });
    const activeSubscriptions = await prisma.instructor.count({
      where: { subscriptionStatus: { in: ['ACTIVE', 'TRIAL'] } },
    });
    const expiringDocuments = await prisma.instructor.count({
      where: {
        OR: [
          { licenseExpiry: { lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), gte: now } },
          { insuranceExpiry: { lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), gte: now } },
        ],
      },
    });

    // ── Bookings overview ─────────────────────────────────────────────────────
    const bookingStats = await prisma.booking.groupBy({
      by: ['status'],
      where: { createdAt: { gte: weekStart }, deletedAt: null },
      _count: true,
    });
    const bookingByStatus = Object.fromEntries(
      bookingStats.map(b => [b.status, b._count])
    );

    // ── Recent incidents from audit log ───────────────────────────────────────
    const incidents = await prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            'DISPUTE_OPENED', 'DISPUTE_CLOSED', 'TRANSFER_FAILED',
            'REFUND_SYNCED', 'BOOKING_AUTO_NO_SHOW', 'PAYOUT_FAILED',
          ],
        },
        createdAt: { gte: weekStart },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { action: true, createdAt: true, targetId: true, metadata: true, success: true },
    });

    // ── Assemble ──────────────────────────────────────────────────────────────
    return NextResponse.json({
      timestamp: now.toISOString(),
      period: { start: weekStart.toISOString(), end: now.toISOString(), label: 'Last 7 days' },

      financial: {
        revenue: {
          total: Math.round(totalRevenue * 100) / 100,
          platformFees: Math.round(totalPlatformFees * 100) / 100,
          bookingsCompleted: completedCount,
          avgBookingValue: Math.round(avgBookingValue * 100) / 100,
        },
        refunds: {
          total: Math.round(totalRefunds * 100) / 100,
          rate: Math.round(refundRate * 10) / 10,
          status: refundRate < 5 ? 'HEALTHY' : refundRate < 10 ? 'WARNING' : 'CRITICAL',
        },
        disputes: {
          open: openDisputes,
          lostThisWeek: lostDisputes._count,
          lostAmountThisWeek: Math.round((lostDisputes._sum?.amount ?? 0) * 100) / 100,
        },
      },

      ledger: {
        availableBalance: ledger.availableBalance,
        totalCollected: ledger.totalCollected,
        totalPaidOut: ledger.totalPaidOut,
        totalRefunded: ledger.totalRefunded,
        totalReserved: ledger.totalReserved,
        status: ledger.availableBalance >= 0 ? 'HEALTHY' : 'CRITICAL',
      },

      payouts: {
        paidThisMonth: payoutsThisMonth._count,
        amountPaidThisMonth: Math.round((payoutsThisMonth._sum?.netAmount ?? 0) * 100) / 100,
        failedPayouts,
        frozenInstructors: frozenPayouts,
      },

      instructors: {
        total: totalInstructors,
        pendingApproval,
        activeSubscriptions,
        expiringDocuments,
      },

      bookings: {
        thisWeek: weeklyBookings.length,
        byStatus: bookingByStatus,
      },

      incidents: incidents.map(i => ({
        type: i.action,
        timestamp: i.createdAt,
        targetId: i.targetId,
        success: i.success,
        metadata: i.metadata,
      })),

      overallStatus: {
        financial: refundRate < 5 && openDisputes === 0 ? 'HEALTHY' : 'WARNING',
        ledger: ledger.availableBalance >= 0 ? 'HEALTHY' : 'CRITICAL',
        payouts: failedPayouts === 0 && frozenPayouts === 0 ? 'HEALTHY' : 'WARNING',
        instructors: pendingApproval === 0 && expiringDocuments === 0 ? 'HEALTHY' : 'WARNING',
      },
    });
  } catch (error) {
    console.error('Fortress dashboard error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
