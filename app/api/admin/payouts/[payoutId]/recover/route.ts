/**
 * POST /api/admin/payouts/[payoutId]/recover
 *
 * PH5-SCH-22b: Evidence-gated manual recovery of stuck PROCESSING payouts.
 *
 * Actions:
 *
 *   complete — The administrator has verified in the Stripe dashboard that a
 *     transfer exists for this payout.  They must supply:
 *       - stripeTransferId: the tr_... ID they observed
 *       - destinationAccount: the Stripe Connect account ID on the transfer
 *       - transferAmount: the amount in AUD they observed
 *       - currency: must be 'aud'
 *       - reason: narrative description of the evidence
 *     This is NOT automated Stripe verification (Phase 2).  The administrator
 *     is attesting to what they observed.  The format of the transfer ID and
 *     the presence of all evidence fields are validated; the transfer is not
 *     queried from Stripe.  This evidence is preserved verbatim in the audit log.
 *
 *   release — The administrator has verified in the Stripe dashboard that NO
 *     transfer was created for this payout.  They must supply:
 *       - stripeAccount: which Stripe account was checked
 *       - checkedAt: when they checked (ISO timestamp)
 *       - method: how they checked (e.g. 'stripe_dashboard', 'stripe_api')
 *       - result: what they found (e.g. 'No transfer found for idempotency key idem_...')
 *       - reason: summary narrative
 *     The release is rejected when the outcome remains uncertain (result must
 *     explicitly state no transfer was found, not merely that it wasn't visible).
 *
 * Both actions:
 *   - Require finance.payouts.recover permission
 *   - Require the payout to be PROCESSING with an active reservation
 *   - Acquire the Phase 1 recovery-claim lease (SELECT FOR UPDATE + 10-min TTL)
 *   - Fix #5: use crypto.randomUUID() for the claim token
 *   - Fix #4: write the audit event INSIDE the same Prisma transaction as the action
 *     (commitPayoutCompletion and releasePayoutReservation have txClient support)
 *   - Fix #1: pass claimToken to releasePayoutReservation so ownership is enforced
 *     in the transaction — a stale administrator cannot release another worker's reservation
 */

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';
import { commitPayoutCompletion, releasePayoutReservation } from '@/lib/services/ledger-service';

export const dynamic = 'force-dynamic';

const STRIPE_TRANSFER_ID_PATTERN = /^tr_[a-zA-Z0-9_]+$/;
const STRIPE_ACCOUNT_ID_PATTERN  = /^acct_[a-zA-Z0-9_]+$/;
const RECOVERY_CLAIM_TTL_MS = 10 * 60 * 1000; // 10 minutes — matches Phase 1

// Fix #3: completion requires documented evidence matching this payout
const completeEvidenceSchema = z.object({
  stripeTransferId: z
    .string()
    .regex(STRIPE_TRANSFER_ID_PATTERN, 'Must be a valid Stripe transfer ID (tr_...)'),
  destinationAccount: z
    .string()
    .regex(STRIPE_ACCOUNT_ID_PATTERN, 'Must be a valid Stripe Connect account ID (acct_...)'),
  transferAmount: z.number().positive('Amount must be positive'),
  currency: z.literal('aud', { errorMap: () => ({ message: 'Currency must be aud' }) }),
  reason: z.string().min(20, 'Reason must describe the evidence in at least 20 characters'),
});

// Fix #2: release requires structured investigation evidence.
// IMPORTANT: This schema validates that the administrator recorded how they
// investigated.  It does NOT verify that the investigation was correct or that
// the application independently queried Stripe.  The result field requires explicit
// language stating no transfer was found — but it cannot prevent an administrator
// from providing inaccurate evidence.  The structured fields (stripeAccount,
// checkedAt, method) are preserved verbatim in the audit record so that any
// subsequent review can identify what was checked and when.
// Never release a reservation solely on the absence of a transfer from a limited
// search — the evidence must affirmatively state no transfer exists.
const releaseEvidenceSchema = z.object({
  stripeAccount: z
    .string()
    .regex(STRIPE_ACCOUNT_ID_PATTERN, 'Must be a valid Stripe Connect account ID (acct_...)'),
  checkedAt: z.string().datetime({ message: 'checkedAt must be an ISO 8601 timestamp' }),
  method: z.enum(['stripe_dashboard', 'stripe_api', 'stripe_support'], {
    errorMap: () => ({ message: 'method must be stripe_dashboard, stripe_api, or stripe_support' }),
  }),
  result: z
    .string()
    .min(20, 'result must describe what was found in at least 20 characters')
    .refine(
      s => /no transfer|not found|never created|does not exist|no record/i.test(s),
      'result must explicitly state that no transfer was found — releases are not permitted when the transfer outcome remains uncertain',
    ),
  reason: z.string().min(20, 'Reason must be at least 20 characters'),
});

const recoverSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('complete'), evidence: completeEvidenceSchema }),
  z.object({ action: z.literal('release'), evidence: releaseEvidenceSchema }),
]);

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

    // ── Validate payout state ────────────────────────────────────────────────
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
        stripeAccountId: true,
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
        { error: `Payout is ${payout.status} — only PROCESSING payouts with active reservations can be recovered`, currentStatus: payout.status },
        { status: 409 },
      );
    }

    if (!payout.reservedAt) {
      return NextResponse.json(
        { error: 'Payout has no active reservation — it may have already been released', reservedAt: null },
        { status: 409 },
      );
    }

    // ── Acquire the Phase 1 recovery claim ───────────────────────────────────
    // Fix #5: use crypto.randomUUID() — no timestamp or user-derived components
    const claimToken = crypto.randomUUID();
    const claimExpiresAt = new Date(Date.now() + RECOVERY_CLAIM_TTL_MS);
    let claimAcquired = false;

    await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
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
      const hasActiveClaim =
        row.recoveryClaimToken !== null &&
        row.recoveryClaimExpiresAt !== null &&
        row.recoveryClaimExpiresAt > new Date();

      if (hasActiveClaim) return;

      await tx.payout.update({
        where: { id: payoutId },
        data: { recoveryClaimToken: claimToken, recoveryClaimExpiresAt: claimExpiresAt },
      });
      claimAcquired = true;
    });

    if (!claimAcquired) {
      const current = await prisma.payout.findUnique({
        where: { id: payoutId },
        select: { status: true, recoveryClaimExpiresAt: true },
      });
      if (current?.status === 'PAID') {
        return NextResponse.json({ error: 'Payout was already completed by another recovery process' }, { status: 409 });
      }
      return NextResponse.json(
        {
          error: 'Another recovery operation is in progress for this payout — try again after the claim expires',
          claimExpiresAt: current?.recoveryClaimExpiresAt?.toISOString() ?? null,
        },
        { status: 409 },
      );
    }

    // ── Fix 1: Validate completion evidence against stored payout values ────
    // These checks run BEFORE any financial record changes.
    // They are cross-validation of the administrator's attestation against
    // what the system recorded — not automated Stripe verification.

    const { action, evidence } = parsed.data;

    if (action === 'complete') {
      const ev = evidence as z.infer<typeof completeEvidenceSchema>;

      // 1a. Destination account must match the payout's registered Stripe account
      if (!payout.stripeAccountId) {
        await prisma.payout.updateMany({
          where: { id: payoutId, recoveryClaimToken: claimToken },
          data: { recoveryClaimToken: null, recoveryClaimExpiresAt: null },
        });
        return NextResponse.json(
          { error: 'Payout has no stripeAccountId — cannot verify destination account' },
          { status: 409 },
        );
      }
      if (ev.destinationAccount !== payout.stripeAccountId) {
        await prisma.payout.updateMany({
          where: { id: payoutId, recoveryClaimToken: claimToken },
          data: { recoveryClaimToken: null, recoveryClaimExpiresAt: null },
        });
        return NextResponse.json(
          {
            error: 'Destination account mismatch: the submitted account does not match the payout\'s registered Stripe Connect account',
            submitted: ev.destinationAccount,
            expected: payout.stripeAccountId,
          },
          { status: 422 },
        );
      }

      // 1b. Transfer amount must match payout net amount (integer-cent precision)
      const payoutAmountCents = Math.round(Number(payout.netAmount) * 100);
      const evidenceAmountCents = Math.round(ev.transferAmount * 100);
      if (evidenceAmountCents !== payoutAmountCents) {
        await prisma.payout.updateMany({
          where: { id: payoutId, recoveryClaimToken: claimToken },
          data: { recoveryClaimToken: null, recoveryClaimExpiresAt: null },
        });
        return NextResponse.json(
          {
            error: 'Amount mismatch: the submitted transfer amount does not match the payout net amount',
            submittedAud: ev.transferAmount,
            submittedCents: evidenceAmountCents,
            expectedAud: Number(payout.netAmount),
            expectedCents: payoutAmountCents,
          },
          { status: 422 },
        );
      }

      // 1c. Currency must be AUD (enforced by schema z.literal('aud')).

      // 1d. If this payout already has a stripeTransferId recorded, the submission must match it.
      if (payout.stripeTransferId !== null && ev.stripeTransferId !== payout.stripeTransferId) {
        await prisma.payout.updateMany({
          where: { id: payoutId, recoveryClaimToken: claimToken },
          data: { recoveryClaimToken: null, recoveryClaimExpiresAt: null },
        });
        return NextResponse.json(
          {
            error: 'Transfer ID mismatch: a different transfer ID is already recorded on this payout',
            submitted: ev.stripeTransferId,
            recorded: payout.stripeTransferId,
          },
          { status: 422 },
        );
      }

      // 1e. The submitted transfer ID must not be associated with any OTHER payout.
      // This check runs unconditionally — including when the submitted ID matches
      // the payout's own stripeTransferId — to protect against race conditions
      // where two payouts attempt to claim the same transfer ID concurrently.
      const duplicate = await prisma.payout.findFirst({
        where: { stripeTransferId: ev.stripeTransferId, id: { not: payoutId } },
        select: { id: true, payoutRef: true },
      });
      if (duplicate) {
        await prisma.payout.updateMany({
          where: { id: payoutId, recoveryClaimToken: claimToken },
          data: { recoveryClaimToken: null, recoveryClaimExpiresAt: null },
        });
        return NextResponse.json(
          {
            error: 'Duplicate transfer ID: this Stripe transfer ID is already associated with another payout',
            conflictingPayoutRef: duplicate.payoutRef,
            conflictingPayoutId: duplicate.id,
          },
          { status: 409 },
        );
      }
    }

    // ── Execute action with atomic audit ─────────────────────────────────────
    // Fix #4: the audit event is written INSIDE the same transaction as the action.
    // If the audit write fails, the transaction rolls back — no contradictory records.

    try {
      if (action === 'complete') {
        const ev = evidence as z.infer<typeof completeEvidenceSchema>;

        await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
          // Lock PlatformLedger
          await tx.$queryRaw`SELECT 1 FROM "PlatformLedger" WHERE key = 'default' FOR UPDATE`;

          // Conditional status update — enforces claim ownership
          const updated = await tx.payout.updateMany({
            where: {
              id: payoutId,
              status: 'PROCESSING',
              reservedAt: { not: null },
              recoveryClaimToken: claimToken,  // Fix #1 (complete path)
            },
            data: {
              status: 'PAID',
              paidAt: new Date(),
              stripeTransferId: ev.stripeTransferId,
              failureReason: null,
              reservedAt: null,
              reservedAmount: null,
              reservationId: null,
              recoveryClaimToken: null,
              recoveryClaimExpiresAt: null,
            },
          });

          if (updated.count === 0) {
            throw new Error('Completion rejected: claim no longer owned or payout not in expected state');
          }

          // Convert reservation → settled in PlatformLedger
          await tx.platformLedger.update({
            where: { key: 'default' },
            data: {
              totalPayoutReserved: { decrement: Number(payout.netAmount) },
              totalPaidOut: { increment: Number(payout.netAmount) },
              totalReserved: { decrement: Number(payout.grossAmount) },
              totalTaxWithheld: { increment: Number(payout.taxWithheld) },
            },
          });

          // Write LedgerEntry
          await tx.ledgerEntry.create({
            data: {
              type: 'PAYOUT_PAID',
              amount: -Number(payout.netAmount),
              currency: 'AUD',
              referenceId: payoutId,
              referenceType: 'PAYOUT',
              providerId: payout.providerId,
              description: `${payout.payoutRef} - admin manual recovery completion`,
              metadata: {
                stripeTransferId: ev.stripeTransferId,
                adminRecovery: true,
                evidence: ev,
              } as any,
            },
          });

          if (Number(payout.taxWithheld) > 0) {
            await tx.ledgerEntry.create({
              data: {
                type: 'TAX_WITHHELD',
                amount: Number(payout.taxWithheld),
                currency: 'AUD',
                referenceId: payoutId,
                referenceType: 'PAYOUT',
                providerId: payout.providerId,
                description: `${payout.payoutRef} - ATO withholding (admin recovery)`,
              },
            });
          }

          // Fix #4: audit event inside the same transaction
          await tx.auditLog.create({
            data: {
              action: 'PAYOUT_ADMIN_RECOVERY_COMPLETED',
              actorId: adminUserId,
              actorRole: 'ADMIN',
              targetType: 'PAYOUT',
              targetId: payoutId,
              success: true,
              metadata: {
                payoutRef: payout.payoutRef,
                netAmount: Number(payout.netAmount),
                providerId: payout.providerId,
                reservationId: payout.reservationId,
                evidence: ev,  // full structured evidence preserved
              } as any,
            },
          });
        });

        return NextResponse.json({
          success: true,
          action: 'complete',
          payoutId,
          payoutRef: payout.payoutRef,
          stripeTransferId: evidence.stripeTransferId,
          message: 'Payout completed and ledger updated atomically',
        });
      }

      if (action === 'release') {
        const ev = evidence as z.infer<typeof releaseEvidenceSchema>;

        await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
          // Lock PlatformLedger
          await tx.$queryRaw`SELECT 1 FROM "PlatformLedger" WHERE key = 'default' FOR UPDATE`;

          // Read reservation amount under lock
          const existing = await tx.payout.findUnique({
            where: { id: payoutId },
            select: { status: true, reservedAt: true, reservedAmount: true, recoveryClaimToken: true },
          });

          if (!existing || existing.status !== 'PROCESSING') {
            throw new Error('Payout is no longer in PROCESSING state');
          }
          if (existing.reservedAt === null) {
            throw new Error('Payout has no active reservation');
          }
          // Fix #1: enforce ownership in the transaction
          if (existing.recoveryClaimToken !== claimToken) {
            throw new Error(
              'Release rejected: recovery claim no longer owned by this worker — ' +
              'the claim may have expired and been reacquired.',
            );
          }

          const amountToRelease = existing.reservedAmount
            ? Number(existing.reservedAmount)
            : Number(payout.netAmount);

          // Update payout to FAILED and clear all reservation/claim fields
          await tx.payout.update({
            where: { id: payoutId },
            data: {
              status: 'FAILED',
              failureReason: `Admin manual release: ${ev.reason}`,
              retryCount: { increment: 1 },
              reservedAt: null,
              reservedAmount: null,
              reservationId: null,
              recoveryClaimToken: null,
              recoveryClaimExpiresAt: null,
            },
          });

          // Return reserved amount to available balance
          await tx.platformLedger.update({
            where: { key: 'default' },
            data: { totalPayoutReserved: { decrement: amountToRelease } },
          });

          // Fix #4: audit event inside the same transaction
          await tx.auditLog.create({
            data: {
              action: 'PAYOUT_ADMIN_RESERVATION_RELEASED',
              actorId: adminUserId,
              actorRole: 'ADMIN',
              targetType: 'PAYOUT',
              targetId: payoutId,
              success: true,
              metadata: {
                payoutRef: payout.payoutRef,
                netAmount: Number(payout.netAmount),
                amountReleased: amountToRelease,
                providerId: payout.providerId,
                reservationId: payout.reservationId,
                idempotencyKey: payout.idempotencyKey,
                evidence: ev,  // full structured evidence preserved
              } as any,
            },
          });
        });

        return NextResponse.json({
          success: true,
          action: 'release',
          payoutId,
          payoutRef: payout.payoutRef,
          message: 'Reservation released — funds returned to available balance. This action was completed based on the administrator\'s attestation. The application did not independently verify the Stripe transfer outcome.',
        });
      }
    } catch (serviceErr) {
      // Clear our claim so another attempt can proceed
      await prisma.payout.updateMany({
        where: { id: payoutId, recoveryClaimToken: claimToken },
        data: { recoveryClaimToken: null, recoveryClaimExpiresAt: null },
      });

      const msg = serviceErr instanceof Error ? serviceErr.message : String(serviceErr);

      // Write failure audit — this is outside the rolled-back transaction, so it always records
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
          } as any,
        },
      });

      return NextResponse.json({ error: msg }, { status: 500 });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[PAYOUT RECOVER]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
