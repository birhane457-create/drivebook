/**
 * GET /api/instructor/payouts
 *
 * Returns payout history and upcoming payout estimate for the authenticated instructor.
 * Used by PayoutScheduleCard on the dashboard.
 *
 * Response:
 * {
 *   payouts: Payout[]            — recent completed payouts (most recent first, last 10)
 *   pendingPayouts: Payout[]     — ELIGIBLE / PROCESSING / PENDING_TRANSFER / SENT
 *   nextPayoutDate: string|null  — estimated next Tuesday 2am AWST in ISO format
 *   totalPending: number         — sum of netAmount across pending payouts
 *   payoutMethod: string         — stripe_connect | bank_transfer | manual
 *   isConnected: boolean         — Stripe Connect setup complete
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function nextTuesdayAWST(): Date {
  // Cron runs Monday 6pm UTC = Tuesday 2am AWST
  // Find the next Monday 18:00 UTC from now
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7 || 7;
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() + daysUntilMonday);
  next.setUTCHours(18, 0, 0, 0);
  // If next Monday 18:00 UTC is in the past (we're past it today), add 7 days
  if (next <= now) next.setUTCDate(next.getUTCDate() + 7);
  return next;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve instructorId
    let instructorId = session.user.instructorId;
    if (!instructorId) {
      const found = await prisma.instructor.findFirst({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (!found) return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
      instructorId = found.id;
    }

    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
      select: {
        payoutMethod: true,
        stripeAccountId: true,
        chargesEnabled: true,
        payoutsEnabled: true,
      },
    });

    // Recent completed payouts (last 10)
    const recentPayouts = await prisma.payout.findMany({
      where: {
        instructorId,
        status: 'PAID',
      },
      orderBy: { paidAt: 'desc' },
      take: 10,
      select: {
        id: true,
        payoutRef: true,
        status: true,
        grossAmount: true,
        taxWithheld: true,
        netAmount: true,
        payoutMethod: true,
        paidAt: true,
        stripeTransferId: true,
        bankReference: true,
        createdAt: true,
        transactions: { select: { transactionId: true } },
      },
    });

    // Pending / in-progress payouts
    const pendingPayouts = await prisma.payout.findMany({
      where: {
        instructorId,
        status: { in: ['ELIGIBLE', 'PROCESSING', 'PENDING_TRANSFER', 'SENT', 'ON_HOLD'] },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        payoutRef: true,
        status: true,
        grossAmount: true,
        taxWithheld: true,
        netAmount: true,
        payoutMethod: true,
        holdReason: true,
        createdAt: true,
        transactions: { select: { transactionId: true } },
      },
    });

    const totalPending = pendingPayouts.reduce((s, p) => s + p.netAmount, 0);

    const isConnected = !!(
      instructor?.payoutMethod === 'stripe_connect' &&
      instructor.stripeAccountId &&
      instructor.chargesEnabled &&
      instructor.payoutsEnabled
    );

    return NextResponse.json({
      payouts: recentPayouts.map(p => ({
        id: p.id,
        payoutRef: p.payoutRef,
        status: p.status,
        grossAmount: p.grossAmount,
        taxWithheld: p.taxWithheld,
        netAmount: p.netAmount,
        payoutMethod: p.payoutMethod,
        paidAt: p.paidAt?.toISOString() ?? null,
        stripeTransferId: p.stripeTransferId,
        bankReference: p.bankReference,
        transactionCount: p.transactions.length,
        createdAt: p.createdAt.toISOString(),
      })),
      pendingPayouts: pendingPayouts.map(p => ({
        id: p.id,
        payoutRef: p.payoutRef,
        status: p.status,
        grossAmount: p.grossAmount,
        taxWithheld: p.taxWithheld,
        netAmount: p.netAmount,
        payoutMethod: p.payoutMethod,
        holdReason: p.holdReason,
        transactionCount: p.transactions.length,
        createdAt: p.createdAt.toISOString(),
      })),
      nextPayoutDate: nextTuesdayAWST().toISOString(),
      totalPending,
      payoutMethod: instructor?.payoutMethod ?? 'stripe_connect',
      isConnected,
    });
  } catch (error) {
    console.error('Instructor payouts GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch payout history' }, { status: 500 });
  }
}
