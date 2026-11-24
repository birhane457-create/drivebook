/**
 * POST /api/admin/payouts/[payoutId]/recover
 *
 * PH5-SCH-22b: Evidence-gated manual recovery of stuck payouts.
 *
 * Actions:
 *
 *   complete — The administrator has verified in Stripe that a transfer was
 *     created.  They supply the Stripe transfer ID and a reason.  This endpoint
 *     acquires the Phase 1 recovery claim (SELECT FOR UPDATE + TTL lease), then
 *     calls commitPayoutCompletion() with that claim token so the atomic guard
 *     in the service layer enforces ownership.
 *
 *     The administrator MUST supply the Stripe transfer ID they observed.
 *     This is the evidence that money moved.  The endpoint validates the format
 *     (Stripe transfer IDs start with 'tr_') but does NOT call Stripe — that
 *     API call is Phase 2 automated reconciliation.  The administrator is
 *     attesting to what they saw in the Stripe dashboard.
 *
 *   release — The administrator has verified in Stripe that no transfer was
 *     created.  They supply a reason explaining the evidence (e.g. "Queried
 *     Stripe — no transfer found for idempotency key idem_xxxx").
 *     This endpoint calls releasePayoutReservation(), which atomically marks
 *     FAILED and decrements totalPayoutReserved.
 *
 * Both actions:
 *   - Require finance.payouts.recover permission
 *   - Require the payout to be PROCESSING with an active reservation
 *   - Acquire the Phase 1 recovery-claim lease before acting
 *   - Write an AuditLog entry with admin, action, reason, evidence and timestamp
 *   - Reject concurrent recovery attempts (claim already held)
 *
 * NOT permitted:
 *   - Completing a payout without supplying a Stripe transfer ID
 *   - Releasing a reservation without supplying a reason
 *   - Acting on a payout in any status other than PROCESSING with reservedAt set
 *   - Free-form status override (this is not a "mark as paid" button)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';
import { commitPayoutCompletion, releasePayoutReservation } from '@/lib/services/ledger-service';

export const dynamic = 'force-dynamic';

// Stripe transfer IDs are 'tr_' followed by alphanumeric characters
const STRIPE_TRANSFER_ID_PATTERN = /^tr_[a-zA-Z0-9]+$/;

const recoverSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('complete'),
    // Stripe transfer ID observed in the Stripe dashboard — mandatory evidence
    stripeTransferId: z
      .string()
      .regex(STRIPE_TRANSFER_ID_PATTERN, 'Must be a valid Stripe transfer ID (tr_...)'),
    // Why the admin is completing — required for audit trail
    reason: z.string().min(10, 'Reason must be at least 10 characters'),
  }),
  z.object({
    action: z.literal('release'),
    // Evidence that no transfer occurred — required for audit trail
    reason: z.string().min(10, 'Reason must be at least 10 characters'),
  }),
]);

// Recovery claim TTL — matches the TTL in payout-service.ts
const RECOVERY_CLAIM_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function POST(
  req: NextRequest,
  { params }: { params: { payoutId: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    const deny = await requirePermission(session, PERM.FINANCE_PAYOUTS_RECOVER);
    if (deny) return deny;

    const adminUserId = session!.user!.id;
    const { payoutId } = params;

    const body = await req.json();
    const parsed = recoverSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    // ── Read payout — validate it is in a recoverable state ─────────────────
    const payout = await prisma.payout.findUnique({
      where: { id: payoutId },
      select: {
        id: true,
        status: true,
        reservedAt: true,
        reservedAmount: true,
        reservationId: true,
        recoveryClaimToken: true,
        recoveryClaimExpiresAt: true,
        netAmount: true,
        grossAmount: true,
        taxWithheld: true,
        payoutRef: true,
        providerId: true,
        stripeTransferId: true,
        idempotencyKey: true,
        payoutMethod: true,
        bankReference: true,
      },
    });

    if (!payout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    }

    if (payout.status !== 'PROCESSING') {
      return NextResponse.json(
        {
          error: `Payout is ${payout.status}, not PROCESSING — only stuck PROCESSING payouts with active reservations can be recovered`,
          currentStatus: payout.status,
        },
        { status: 409 },
      );
    }

    if (!payout.reservedAt) {
      return NextResponse.json(
        {
          error: 'Payout has no active reservation — it may have already been released',
          reservedAt: null,
        },
        { status: 409 },
      );
    }

    // ── Acquire the Phase 1 recovery claim ───────────────────────────────────
    // Uses SELECT FOR UPDATE + conditional write, identical to the automatic
    // recovery path in recoverProcessingPayout().  Prevents concurrent admin
    // actions or concurrent automatic recovery from both acting simultaneously.
    const claimToken = `ADMIN_RCLAIM_${Date.now()}_${adminUserId.slice(-8)}`;
    const claimExpiresAt = new Date(Date.now() + RECOVERY_CLAIM_TTL_MS);
    let claimAcquired = false;

    await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{
        id: string;
        recoveryClaimToken: string | null;
        recoveryClaimExpiresAt: Date | null;
      }>>`
        SELECT id, "recoveryClaimToken", "recoveryClaimExpiresAt"
        FROM "Payout"
        WHERE id = ${payoutId}
          AND status = 'PROCESSING'
          AND "reservedAt" IS NOT NULL
        FOR UPDATE
      `;

      if (rows.length === 0) return;

      const row = rows[0];
      const now = new Date();
      const hasActiveClaim =
        row.recoveryClaimToken !== null &&
        row.recoveryClaimExpiresAt !== null &&
        row.recoveryClaimExpiresAt > now;

      if (hasActiveClaim) return; // Another worker holds the claim

      await tx.payout.update({
        where: { id: payoutId },
        data: {
          recoveryClaimToken: claimToken,
          recoveryClaimExpiresAt: claimExpiresAt,
        },
      });

      claimAcquired = true;
    });

    if (!claimAcquired) {
      // Check whether a concurrent automatic recovery has the claim
      const current = await prisma.payout.findUnique({
        where: { id: payoutId },
        select: { recoveryClaimToken: true, recoveryClaimExpiresAt: true, status: true },
      });

      if (current?.status === 'PAID') {
        return NextResponse.json(
          { error: 'Payout was already completed by an automatic recovery process' },
          { status: 409 },
        );
      }

      return NextResponse.json(
        {
          error: 'Another recovery operation is currently in progress for this payout — try again in a few minutes',
          claimExpiresAt: current?.recoveryClaimExpiresAt?.toISOString() ?? null,
        },
        { status: 409 },
      );
    }

    // ── Execute the action ───────────────────────────────────────────────────

    const { action } = parsed.data;

    try {
      if (action === 'complete') {
        const { stripeTransferId, reason } = parsed.data;

        // Complete the payout atomically using the Phase 1 service.
        // The claimToken is passed so commitPayoutCompletion's conditional
        // updateMany enforces that our claim is still current when it commits.
        await commitPayoutCompletion({
          payoutId,
          stripeTransferId,
          payout: {
            netAmount: Number(payout.netAmount),
            grossAmount: Number(payout.grossAmount),
            taxWithheld: Number(payout.taxWithheld),
            payoutRef: payout.payoutRef,
            providerId: payout.providerId,
          },
          txCount: 0, // txCount is informational only in the ledger description
          adminUserId,
          path: 'stripe',
          recoveryClaimToken: claimToken,
        });

        // Write the recovery completion audit event
        await prisma.auditLog.create({
          data: {
            action: 'PAYOUT_ADMIN_RECOVERY_COMPLETED',
            actorId: adminUserId,
            actorRole: 'ADMIN',
            targetType: 'PAYOUT',
            targetId: payoutId,
            success: true,
            metadata: {
              payoutRef: payout.payoutRef,
              stripeTransferId,
              reason,
              netAmount: Number(payout.netAmount),
              providerId: payout.providerId,
              reservationId: payout.reservationId,
            },
          },
        });

        return NextResponse.json({
          success: true,
          action: 'complete',
          payoutId,
          payoutRef: payout.payoutRef,
          stripeTransferId,
          message: 'Payout completed and ledger updated atomically',
        });
      }

      if (action === 'release') {
        const { reason } = parsed.data;

        // Release the reservation using the Phase 1 service.
        // This atomically marks FAILED and decrements totalPayoutReserved.
        await releasePayoutReservation(
          payoutId,
          Number(payout.netAmount),
          `Admin manual release: ${reason}`,
        );

        // Write the release audit event
        await prisma.auditLog.create({
          data: {
            action: 'PAYOUT_ADMIN_RESERVATION_RELEASED',
            actorId: adminUserId,
            actorRole: 'ADMIN',
            targetType: 'PAYOUT',
            targetId: payoutId,
            success: true,
            metadata: {
              payoutRef: payout.payoutRef,
              reason,
              netAmount: Number(payout.netAmount),
              providerId: payout.providerId,
              reservationId: payout.reservationId,
              idempotencyKey: payout.idempotencyKey,
            },
          },
        });

        return NextResponse.json({
          success: true,
          action: 'release',
          payoutId,
          payoutRef: payout.payoutRef,
          message: 'Reservation released — funds returned to available balance',
        });
      }
    } catch (serviceErr) {
      // If the action fails, clear our claim so another attempt can proceed
      await prisma.payout.updateMany({
        where: { id: payoutId, recoveryClaimToken: claimToken },
        data: { recoveryClaimToken: null, recoveryClaimExpiresAt: null },
      });

      const msg = serviceErr instanceof Error ? serviceErr.message : String(serviceErr);

      await prisma.auditLog.create({
        data: {
          action: 'PAYOUT_ADMIN_RECOVERY_FAILED',
          actorId: adminUserId,
          actorRole: 'ADMIN',
          targetType: 'PAYOUT',
          targetId: payoutId,
          success: false,
          errorMessage: msg,
          metadata: {
            payoutRef: payout.payoutRef,
            attemptedAction: action,
            reason: (parsed.data as any).reason,
          },
        },
      });

      return NextResponse.json({ error: msg }, { status: 500 });
    }

    // Should be unreachable
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[PAYOUT RECOVER]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
