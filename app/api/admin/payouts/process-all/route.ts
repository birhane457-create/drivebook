import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { executeInstructorPayout } from '@/lib/services/payout-service';

import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const deny = await requirePermission(session, PERM.FINANCE_PAYOUTS_PROCESS);
    if (deny) return deny;

    // 48-hour dispute buffer — lessons must be at least 2 days old before becoming payout-eligible
    const bufferCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // Find all instructors with eligible transactions
    const eligible = await prisma.transaction.findMany({
      where: {
        status: 'SETTLED',
        type: 'BOOKING_PAYMENT',
        booking: {
          status: { in: ['CONFIRMED', 'COMPLETED'] },
          endTime: { lte: bufferCutoff },
          deletedAt: null,
          source: { not: 'offline' }, // offline/cash bookings are instructor-handled — no platform payout
        },
      },
      select: { providerId: true },
      distinct: ['providerId'],
    });

    if (!eligible.length) {
      return NextResponse.json({ success: true, count: 0, results: [], message: 'No eligible payouts' });
    }

    // ABN + payoutHold gate: load state for all eligible instructors in one query
    const providerIds = eligible.map((e) => e.providerId);
    const instructors = await prisma.provider.findMany({
      where: { id: { in: providerIds } },
      select: { id: true, abn: true, abnVerified: true, abnStatus: true, payoutHold: true, payoutHoldReason: true },
    });
    const instructorMap = new Map(instructors.map((i: any) => [i.id, i]));

    const results = await Promise.allSettled(
      eligible.map(async (e) => {
        const inst = instructorMap.get(e.providerId);
        // Block if instructor has an active dispute hold
        if (inst?.payoutHold) {
          return {
            providerId: e.providerId,
            status: 'SKIPPED',
            reason: `payout_hold_open_dispute (${inst.payoutHoldReason ?? 'see admin'})`,
          };
        }
        // Block if ABN is on file but not yet verified
        if (inst?.abn && !inst.abnVerified) {
          return {
            providerId: e.providerId,
            status: 'SKIPPED',
            reason: `abn_not_verified (status: ${inst.abnStatus ?? 'PENDING'})`,
          };
        }
        return executeInstructorPayout(e.providerId, session!.user!.id);
      }),
    );

    const paid    = results.filter((r: any) => r.status === 'fulfilled' && (r.value as any).status === 'PAID').length;
    const pending = results.filter((r: any) => r.status === 'fulfilled' && (r.value as any).status === 'PENDING_TRANSFER').length;
    const failed  = results.filter((r: any) => r.status === 'rejected' || (r.status === 'fulfilled' && (r.value as any).status === 'FAILED')).length;
    const skipped = results.filter((r: any) => r.status === 'fulfilled' && (r.value as any).status === 'SKIPPED').length;

    const summary = results.map((r: any) =>
      r.status === 'fulfilled'
        ? {
            status: (r.value as any).status,
            payoutRef: (r.value as any).payoutRef,
            net: (r.value as any).netAmount,
            reason: (r.value as any).failureReason ?? (r.value as any).reason,
          }
        : { status: 'FAILED', reason: (r as any).reason?.message ?? 'Unknown error' },
    );

    return NextResponse.json({
      success: true,
      count: eligible.length,
      paid,
      pending,
      failed,
      skipped,
      results: summary,
      message: `${paid} paid (Stripe), ${pending} pending transfer (bank), ${failed} failed, ${skipped} skipped`,
    });
  } catch (error) {
    console.error('Process-all error:', error);
    return NextResponse.json({ error: 'Failed to process all payouts' }, { status: 500 });
  }
}
