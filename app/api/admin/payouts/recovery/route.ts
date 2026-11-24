/**
 * GET /api/admin/payouts/recovery
 *
 * PH5-SCH-22b: Recovery queue for stuck payouts.
 *
 * Returns two categories:
 *
 *   unresolved — PROCESSING payouts with an active reservation (reservedAt IS NOT NULL).
 *     These are genuinely stuck: either a Stripe transfer occurred and the DB commit
 *     failed, or the Stripe outcome is unknown (timeout).  The reservation is still
 *     holding funds.  An administrator must investigate and either complete or release.
 *
 *   failed — FAILED payouts whose reservation was already released (reservedAt IS NULL).
 *     These are shown for visibility only — no recovery action is needed.
 *
 * Fix #6 — data minimisation: recoveryClaimToken is NOT returned.
 * Only hasActiveClaim (boolean) and recoveryClaimExpiresAt are exposed so the UI
 * can show "recovery in progress" without leaking the internal token value.
 *
 * Permission: finance.payouts.recover
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';

export const dynamic = 'force-dynamic';

// How long a PROCESSING payout must have been stuck before appearing in the queue.
// Very new PROCESSING payouts are likely still executing — not yet stuck.
const PROCESSING_STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const deny = await requirePermission(session, PERM.FINANCE_PAYOUTS_RECOVER);
    if (deny) return deny;

    const staleThreshold = new Date(Date.now() - PROCESSING_STALE_THRESHOLD_MS);

    // ── Unresolved: PROCESSING with active reservation ──────────────────────
    const unresolvedPayouts = await prisma.payout.findMany({
      where: {
        status: 'PROCESSING',
        reservedAt: { not: null },
        updatedAt: { lte: staleThreshold },
      },
      include: {
        transactions: { select: { transactionId: true } },
      },
      orderBy: { reservedAt: 'asc' },
    });

    // ── Failed: reservation already released ─────────────────────────────────
    const failedPayouts = await prisma.payout.findMany({
      where: {
        status: 'FAILED',
        reservedAt: null,
      },
      include: {
        transactions: { select: { transactionId: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    // ── Enrich with provider data (Payout has no Prisma relation to Provider) ─
    const allProviderIds = Array.from(new Set([
      ...unresolvedPayouts.map(p => p.providerId),
      ...failedPayouts.map(p => p.providerId),
    ]));

    const providers = allProviderIds.length
      ? await prisma.provider.findMany({
          where: { id: { in: allProviderIds } },
          select: {
            id: true,
            name: true,
            phone: true,
            stripeAccountId: true,
            payoutMethod: true,
            user: { select: { email: true } },
          },
        })
      : [];

    const providerMap = new Map(providers.map(p => [p.id, p]));

    // ── Recovery audit history for unresolved payouts ────────────────────────
    const unresolvedIds = unresolvedPayouts.map(p => p.id);
    const recoveryAuditEvents = unresolvedIds.length
      ? await prisma.auditLog.findMany({
          where: {
            targetType: 'PAYOUT',
            targetId: { in: unresolvedIds },
            action: {
              in: [
                'PAYOUT_PROCESSING',
                'PAYOUT_RECOVERY_STARTED',
                'PAYOUT_RECOVERY_FAILED',
                'PAYOUT_RECOVERY_EXPIRED',
                'PAYOUT_COMMIT_FAILED',
                'PAYOUT_UNCERTAIN',
                'PAYOUT_ADMIN_RECOVERY_COMPLETED',
                'PAYOUT_ADMIN_RESERVATION_RELEASED',
                'PAYOUT_ADMIN_RECOVERY_FAILED',
              ],
            },
          },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            targetId: true,
            action: true,
            success: true,
            errorMessage: true,
            metadata: true,
            createdAt: true,
            actorId: true,
          },
        })
      : [];

    const auditByPayout: Record<string, typeof recoveryAuditEvents> = {};
    for (const event of recoveryAuditEvents) {
      if (!auditByPayout[event.targetId]) auditByPayout[event.targetId] = [];
      auditByPayout[event.targetId].push(event);
    }

    const now = Date.now();

    const serializeUnresolved = unresolvedPayouts.map(p => {
      const provider = providerMap.get(p.providerId);
      const hasActiveClaim =
        p.recoveryClaimToken !== null &&
        p.recoveryClaimExpiresAt !== null &&
        p.recoveryClaimExpiresAt > new Date();

      return {
        id: p.id,
        payoutRef: p.payoutRef,
        status: p.status,
        requiresRecovery: true,
        // Amounts
        grossAmount: Number(p.grossAmount),
        taxWithheld: Number(p.taxWithheld),
        netAmount: Number(p.netAmount),
        // Reservation
        reservedAt: p.reservedAt?.toISOString() ?? null,
        reservedAmount: p.reservedAmount ? Number(p.reservedAmount) : null,
        reservationId: p.reservationId,
        reservationAgeMinutes: p.reservedAt
          ? Math.round((now - p.reservedAt.getTime()) / 60_000)
          : null,
        // Stripe — needed for admin dashboard lookup
        stripeTransferId: p.stripeTransferId,
        stripeAccountId: provider?.stripeAccountId ?? null,
        idempotencyKey: p.idempotencyKey,
        payoutMethod: p.payoutMethod,
        // Failure context
        failureReason: p.failureReason,
        retryCount: p.retryCount,
        // Fix #6: recoveryClaimToken NOT returned — only the derived indicator
        hasActiveClaim,
        recoveryClaimExpiresAt: p.recoveryClaimExpiresAt?.toISOString() ?? null,
        // Instructor
        providerId: p.providerId,
        instructorName: provider?.name ?? 'Unknown',
        instructorPhone: provider?.phone ?? null,
        instructorEmail: provider?.user?.email ?? null,
        // Timing
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        transactionCount: p.transactions.length,
        // Recovery history
        recoveryHistory: (auditByPayout[p.id] ?? []).map(e => ({
          id: e.id,
          action: e.action,
          success: e.success,
          errorMessage: e.errorMessage,
          metadata: e.metadata,
          createdAt: e.createdAt.toISOString(),
          actorId: e.actorId,
        })),
      };
    });

    const serializeFailed = failedPayouts.map(p => {
      const provider = providerMap.get(p.providerId);
      return {
        id: p.id,
        payoutRef: p.payoutRef,
        status: p.status,
        requiresRecovery: false,
        grossAmount: Number(p.grossAmount),
        taxWithheld: Number(p.taxWithheld),
        netAmount: Number(p.netAmount),
        stripeTransferId: p.stripeTransferId,
        failureReason: p.failureReason,
        retryCount: p.retryCount,
        providerId: p.providerId,
        instructorName: provider?.name ?? 'Unknown',
        instructorPhone: provider?.phone ?? null,
        payoutMethod: p.payoutMethod,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        transactionCount: p.transactions.length,
      };
    });

    return NextResponse.json({
      unresolved: serializeUnresolved,
      failed: serializeFailed,
      counts: {
        unresolved: serializeUnresolved.length,
        failed: serializeFailed.length,
      },
    });
  } catch (err) {
    console.error('[RECOVERY QUEUE]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
