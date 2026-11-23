/**
 * Payout Service
 *
 * State machine:
 *   Stripe Connect:  ELIGIBLE -> PROCESSING -> PAID
 *   Bank/Manual:     ELIGIBLE -> PROCESSING -> PENDING_TRANSFER -> SENT -> PAID
 *                                           -> FAILED   (retryable)
 *                                           -> ON_HOLD  (dispute / admin hold)
 *
 * PH5-SCH-22a Phase 1 Guarantees:
 * - Durable reservation: funds are locked in PlatformLedger.totalPayoutReserved
 *   BEFORE any Stripe transfer is initiated.  A concurrent executePayout() that
 *   checks the balance after the reservation is set will see the reduced
 *   available balance and fail — it never reaches Stripe.
 * - Single-transaction commit: status transition (PROCESSING→PAID) + all ledger
 *   writes (PlatformLedger counters + LedgerEntry rows) happen in one transaction
 *   via commitPayoutCompletion(). If the transaction fails the reservation remains
 *   active and the retry path is safe (Stripe idempotency key reuses the transfer).
 * - Reservation release: on any error after reservation, releasePayoutReservation()
 *   atomically sets status=FAILED and decrements totalPayoutReserved.
 * - confirmPayoutReceived: also uses commitPayoutCompletion() so status + ledger
 *   are always atomic. No separate status-then-ledger split.
 *
 * Legacy guarantees (unchanged):
 * - Transactions are IMMUTABLE — never mutated after creation.
 * - Idempotency: SHA-256 of sorted transaction IDs → collision-free key
 *   passed to both DB (@unique constraint) and Stripe.
 * - Concurrency lock: ELIGIBLE/FAILED → PROCESSING is atomic via updateMany.
 * - Full audit trail: every state transition logged to AuditLog.
 * - Two-phase: buildPayout() validates + creates record (no Stripe),
 *   executePayout() acquires lock + transfers + finalises.
 */

import crypto from 'crypto';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { smsService } from '@/lib/services/sms';
import { emailService } from '@/lib/services/email';
import { appendLedgerEntry, incrementLedger, assertSufficientBalance, assertNonNegativeBalance, getPlatformLedger, reservePayoutFunds, commitPayoutCompletion, releasePayoutReservation } from '@/lib/services/ledger-service';
import { sendAlert } from '@/lib/services/alert-service';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' });

import { Decimal } from '@prisma/client/runtime/library';
import {
  toDecimal,
  toNumber,
  roundAmount,
  sumAmounts,
  subtractAmounts,
  calculatePercentage,
  divideAmount,
  maxAmount,
  toFixed,
  isEqual,
  isGreaterThan,
} from '@/lib/utils/decimal-helpers';

const PAYOUT_BUFFER_HOURS = 24; // Used for bank/manual payout eligibility check in buildPayout

// Reads dispute buffer from PlatformSettings (defaults to 24h if not configured).
// The cron uses lateCancellationWindowHours � 2 (typically 48h); this same
// DB-backed value is now used here so manual and automated payouts stay consistent.
export async function getPayoutBufferHours(): Promise<number> {
  try {
    const settings = await prisma.platformSettings.findFirst({
      select: { lateCancellationWindowHours: true },
    });
    return Number(settings?.lateCancellationWindowHours ?? 24) * 2; // × 2 for dispute buffer — matches cron
  } catch {
    return 48; // safe fallback (24 × 2)
  }
}

// Types

export interface PayoutResult {
  payoutId: string;
  payoutRef: string;
  status: 'PAID' | 'FAILED' | 'ON_HOLD' | 'PROCESSING' | 'PENDING_TRANSFER' | 'SENT';
  grossAmount: number;
  taxWithheld: number;
  netAmount: number;
  gstAmount: number;
  stripeTransferId: string | null;
  transactionCount: number;
  failureReason?: string;
}

// Internal audit helper

async function logTransition(
  payoutId: string,
  actorId: string,
  action: string,
  metadata: Record<string, unknown>,
  success = true,
  errorMessage?: string,
) {
  await prisma.auditLog.create({
    data: {
      action,
      actorId,
      actorRole: 'ADMIN',
      targetType: 'PAYOUT',
      targetId: payoutId,
      success,
      errorMessage,
      metadata: metadata as any,
    },
  });
}

// Phase 1: Build

/**
 * Validate eligibility and create a Payout record in ELIGIBLE state.
 * No Stripe calls. Safe to call multiple times - returns existing if already built.
 */
export async function buildPayout(
  providerId: string,
  adminUserId: string,
  transactionIds?: string[],
): Promise<{ payoutId: string; idempotencyKey: string; alreadyPaid: boolean }> {
  // Read dispute buffer from PlatformSettings (same value cron uses: lateCancellationWindowHours � 2)
  const bufferHours = await getPayoutBufferHours();
  const bufferCutoff = new Date(Date.now() - bufferHours * 60 * 60 * 1000);

  // Exclude transactions already covered by an active/paid payout
  const coveredIds = await prisma.payoutTransaction.findMany({
    where: { payout: { status: { in: ['PROCESSING', 'PAID', 'ON_HOLD', 'PENDING_TRANSFER', 'SENT'] } } },
    select: { transactionId: true },
  });
  const excludeIds = coveredIds.map((p: { transactionId: string }) => p.transactionId);

  const where: Record<string, unknown> = {
    providerId,
    status: { in: ['SETTLED', 'COMPLETED'] },
    type: 'BOOKING_PAYMENT',
    booking: {
      status: 'COMPLETED',
      checkOutTime: { not: null, lte: bufferCutoff },
      deletedAt: null,
      source: { not: 'offline' }, // offline/cash bookings are instructor-handled — no platform payout
    },
  };
  if (transactionIds?.length) where.id = { in: transactionIds };
  if (excludeIds.length) {
    where.id = { ...(where.id as object ?? {}), notIn: excludeIds };
  }

  const transactions = await prisma.transaction.findMany({ where });
  if (!transactions.length) throw new Error('No eligible transactions for payout');

  // P1-2 FIX: Prisma cannot filter on JSON metadata keys in aggregate().
  // Using findMany + JS filter to correctly exclude already-recovered adjustments
  // that were previously being double-deducted in subsequent payout runs.
  const allAdjustments = await prisma.ledgerEntry.findMany({
    where: { type: 'ADJUSTMENT', providerId },
  });
  const unrecoveredAdjustments = allAdjustments.filter(
    (e: { metadata: unknown }) => !(e.metadata as Record<string, unknown>)?.recovered
  );
  // Use Decimal for precise adjustment calculation
  const adjustmentsDec = unrecoveredAdjustments.map((e: { amount: number | Decimal }) => 
    toDecimal(e.amount)
  );
  const adjustmentSumDec = sumAmounts(adjustmentsDec);
  const adjustmentDeductionDec = maxAmount(toDecimal(0), adjustmentSumDec.isNegative() ? adjustmentSumDec.abs() : toDecimal(0));
  const adjustmentDeduction = toNumber(roundAmount(adjustmentDeductionDec, 2));
  if (adjustmentDeduction > 0) {
    console.log(
      `[PAYOUT] Instructor ${providerId} has ${toFixed(toDecimal(adjustmentDeduction), 2)} in unrecovered ` +
      `post-payout adjustments � deducting from gross payout`
    );
  }

  // Ledger initialization warning
  try {
    const ledger = await getPlatformLedger();
    if (ledger.totalCollected === 0) {
      console.warn(
        `[LEDGER WARNING] buildPayout called for instructor ${providerId} but ` +
        `PlatformLedger.totalCollected = 0. This likely means the Stripe webhook ` +
        `is not calling recordPaymentCollected(). Payouts may fail balance checks.`,
      );
    }
  } catch (e) {
    console.warn('[LEDGER WARNING] Could not read platform ledger during buildPayout:', e);
  }

  // SHA-256 of sorted IDs - collision-free, deterministic
  const txHash = transactions.map((t) => t.id).sort().join(',');
  const idempotencyKey = crypto.createHash('sha256').update(txHash).digest('hex');

  // Return existing if already built
  const existing = await prisma.payout.findUnique({ where: { idempotencyKey } });
  if (existing) {
    return { payoutId: existing.id, idempotencyKey, alreadyPaid: existing.status === 'PAID' };
  }

  const instructor = await prisma.provider.findUnique({
    where: { id: providerId },
    select: {
      payoutMethod: true,
      stripeAccountId: true,
      withholdingTaxRate: true,
      gstRegistered: true,
      payoutHold: true,
      payoutHoldReason: true,
      chargesEnabled: true,
      payoutsEnabled: true,
    },
  });
  if (!instructor) throw new Error('Instructor not found');

  // -- Eligibility gate ------------------------------------------------------
  // All four checks must pass before a payout record is created.

  // 1. Dispute freeze
  if (instructor.payoutHold) {
    throw new Error(
      `Payout blocked: instructor has an active dispute hold (${instructor.payoutHoldReason ?? 'see admin'}). ` +
      `Resolve the dispute before processing.`
    );
  }

  // 2. Stripe Connect � must have a connected account
  if (instructor.payoutMethod === 'stripe_connect') {
    if (!instructor.stripeAccountId) {
      throw new Error(
        `Payout blocked: instructor has not completed Stripe Connect onboarding. ` +
        `No stripeAccountId on file.`
      );
    }
    // 3. Charges enabled � Stripe has verified the account
    if (!instructor.chargesEnabled) {
      throw new Error(
        `Payout blocked: instructor's Stripe Connect account is not fully verified ` +
        `(chargesEnabled = false). Onboarding may be incomplete.`
      );
    }
    // 4. Payouts enabled � bank account linked and Stripe has approved payouts
    if (!instructor.payoutsEnabled) {
      throw new Error(
        `Payout blocked: instructor's Stripe Connect account cannot receive payouts yet ` +
        `(payoutsEnabled = false). They may need to add a bank account in their Stripe dashboard.`
      );
    }
  }

  // Use Decimal for penny-perfect gross amount aggregation
  const grossAmountDec = sumAmounts(
    transactions.map((t: { providerPayout: number | Decimal }) => t.providerPayout)
  );
  const grossAmount = toNumber(roundAmount(grossAmountDec, 2));
  // FIX #8: Subtract pending adjustment deductions from gross before tax calculation
  const grossAfterAdjustmentDec = maxAmount(
    toDecimal(0),
    subtractAmounts(toDecimal(grossAmount), toDecimal(adjustmentDeduction))
  );
  const taxWithheldDec = calculatePercentage(
    grossAfterAdjustmentDec,
    instructor.withholdingTaxRate ?? 0
  );
  const netAmountDec = subtractAmounts(grossAfterAdjustmentDec, taxWithheldDec);
  const gstAmountDec = instructor.gstRegistered 
    ? divideAmount(grossAfterAdjustmentDec, 11)
    : toDecimal(0);
  
  // Convert to numbers for database/API
  const grossAfterAdjustment = toNumber(roundAmount(grossAfterAdjustmentDec, 2));
  const taxWithheld = toNumber(roundAmount(taxWithheldDec, 2));
  const netAmount = toNumber(roundAmount(netAmountDec, 2));
  const gstAmount = toNumber(roundAmount(gstAmountDec, 2));
  const payoutRef = `PAYOUT-${providerId.slice(-6).toUpperCase()}-${Date.now()}`;

  // Atomic create - @unique on idempotencyKey prevents concurrent duplicates
  try {
    const payout = await prisma.payout.create({
      data: {
        providerId,
        status: 'ELIGIBLE',
        grossAmount,
        taxWithheld,
        gstAmount,
        netAmount,
        payoutMethod: instructor.payoutMethod,
        stripeAccountId: instructor.stripeAccountId ?? undefined,
        idempotencyKey,
        payoutRef,
        approvedBy: adminUserId,
        approvedAt: new Date(),
        transactions: {
          create: transactions.map((t) => ({ transactionId: t.id })),
        },
      },
    });

    await logTransition(payout.id, adminUserId, 'PAYOUT_CREATED', {
      payoutRef,
      grossAmount,
      taxWithheld,
      netAmount,
      transactionCount: transactions.length,
      providerId,
      adjustmentDeduction: adjustmentDeduction > 0 ? adjustmentDeduction : undefined,
    });

    return { payoutId: payout.id, idempotencyKey, alreadyPaid: false };
  } catch (err: unknown) {
    // Unique constraint race - another request won, return theirs
    if ((err as { code?: string }).code === 'P2002') {
      const race = await prisma.payout.findUnique({ where: { idempotencyKey } });
      if (race) return { payoutId: race.id, idempotencyKey, alreadyPaid: race.status === 'PAID' };
    }
    throw err;
  }
}

// ─── Shared Stripe transfer parameter builder ────────────────────────────────
//
// Used by both executePayout() and recoverProcessingPayout().
// The parameters MUST be identical for Stripe idempotency to work correctly:
// re-using an idempotency key with any differing parameter causes Stripe to
// return a 400 IdempotencyError rather than the original transfer.
//
// Do not add conditional or recovery-specific fields here.

function buildStripeTransferParams(
  payout: {
    id: string;
    payoutRef: string;
    netAmount: Decimal;
    taxWithheld: Decimal;
    stripeAccountId: string;
    providerId: string;
  },
  txCount: number,
  adminUserId: string,
): Parameters<typeof stripe.transfers.create>[0] {
  return {
    amount: Math.round(toNumber(toDecimal(payout.netAmount)) * 100),
    currency: 'aud',
    destination: payout.stripeAccountId,
    description: `DriveBook ${payout.payoutRef} - ${txCount} lesson(s)`,
    metadata: {
      payoutRef: payout.payoutRef,
      payoutId: payout.id,
      providerId: payout.providerId,
      transactionCount: String(txCount),
      taxWithheld: toFixed(toDecimal(payout.taxWithheld), 2),
      adminId: adminUserId,
    },
  };
}

// ─── Recovery path for PROCESSING payouts with an active reservation ──────────
//
// Called by executePayout() when the target payout is already PROCESSING and
// has reservedAt set.  This covers two scenarios:
//
//   A. commitPayoutCompletion() failed AFTER Stripe returned a transfer ID.
//      payout.stripeTransferId is already set on the row.
//      Retrieve the transfer directly — this is fully authoritative.
//
//   B. Network timeout or Stripe 5xx before we received any response.
//      payout.stripeTransferId is null.
//      Re-call stripe.transfers.create() with the SAME idempotency key and
//      IDENTICAL parameters (via buildStripeTransferParams).
//      Stripe returns the original transfer if one exists, or creates a new one
//      if the original never reached Stripe.  Money moves at most once.
//      This is only safe within Stripe's 24-hour idempotency retention window.
//      If reservedAt is older than STRIPE_IDEMPOTENCY_SAFE_WINDOW_MS, the
//      outcome is indeterminate — preserve the reservation and require manual
//      investigation.
//
// This function NEVER releases a reservation based on a negative search result.
// If the Stripe outcome cannot be established, the reservation is preserved and
// the error propagates — requiring manual investigation rather than risking
// a double-payment.

// Stripe retains idempotency keys for 24 hours.  We use a 23-hour safe window
// to give 1 hour of operational margin before automatic recovery is unsafe.
const STRIPE_IDEMPOTENCY_SAFE_WINDOW_MS = 23 * 60 * 60 * 1000;

async function recoverProcessingPayout(
  payoutId: string,
  adminUserId: string,
): Promise<PayoutResult> {
  // ── Recovery claim (SELECT FOR UPDATE with TTL lease) ──────────────────────
  //
  // Provides exclusive recovery ownership. Uses two dedicated fields that are
  // separate from the financial reservation identity (reservationId):
  //   recoveryClaimToken     — identifies the owning worker
  //   recoveryClaimExpiresAt — TTL; allows takeover after a worker crash
  //
  // Acquisition is conditional (all evaluated inside a single FOR UPDATE tx):
  //   - No active claim (recoveryClaimToken IS NULL): acquire
  //   - Expired claim (recoveryClaimExpiresAt < now()): take over
  //   - Active unexpired claim: reject — return current payout state
  //
  // The FOR UPDATE lock serialises the acquisition transactions.
  // After the first caller commits, the second sees the token + future expiry
  // and finds the WHERE condition matches 0 rows.
  //
  // reservationId is not touched here — it retains the stable financial
  // reservation identity throughout the recovery lifecycle.

  const RECOVERY_CLAIM_TTL_MS = 10 * 60 * 1000; // 10 minutes
  const claimToken = crypto.randomUUID();
  const claimExpiresAt = new Date(Date.now() + RECOVERY_CLAIM_TTL_MS);
  let claimSucceeded = false;

  await prisma.$transaction(async (tx) => {
    // Lock the row exclusively for the duration of this transaction.
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

    if (rows.length === 0) {
      // Not PROCESSING, no reservation, or already gone.
      return;
    }

    const row = rows[0];
    const now = new Date();
    const hasActiveClaim =
      row.recoveryClaimToken !== null &&
      row.recoveryClaimExpiresAt !== null &&
      row.recoveryClaimExpiresAt > now;

    if (hasActiveClaim) {
      // Another worker owns recovery and its lease has not expired.
      return;
    }

    // No claim or expired claim — acquire ownership.
    await tx.payout.update({
      where: { id: payoutId },
      data: {
        recoveryClaimToken: claimToken,
        recoveryClaimExpiresAt: claimExpiresAt,
      },
    });

    claimSucceeded = true;
  });

  if (!claimSucceeded) {
    // Another recovery attempt is in progress or the payout already moved.
    const current = await prisma.payout.findUnique({ where: { id: payoutId } });
    if (!current) throw new Error(`Recovery: payout ${payoutId} not found`);
    return {
      payoutId: current.id,
      payoutRef: current.payoutRef,
      status: current.status as PayoutResult['status'],
      grossAmount: toNumber(current.grossAmount),
      taxWithheld: toNumber(current.taxWithheld),
      netAmount: toNumber(current.netAmount),
      gstAmount: toNumber(current.gstAmount),
      stripeTransferId: current.stripeTransferId,
      transactionCount: 0,
    };
  }

  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
    include: { transactions: { select: { transactionId: true } } },
  });
  if (!payout) throw new Error(`Recovery: payout ${payoutId} not found after claim`);

  const txCount = payout.transactions.length;
  const isStripe = payout.payoutMethod === 'stripe_connect' && payout.stripeAccountId;

  await logTransition(payoutId, adminUserId, 'PAYOUT_RECOVERY_STARTED', {
    payoutRef: payout.payoutRef,
    reservedAt: payout.reservedAt?.toISOString(),
    existingStripeTransferId: payout.stripeTransferId,
    scenario: payout.stripeTransferId ? 'A_DB_COMMIT_FAILED' : 'B_TIMEOUT_UNKNOWN',
    claimToken,
  });

  if (!isStripe) {
    // Manual/bank payout stuck in PROCESSING — reservation is intact.
    // Move it back to PENDING_TRANSFER so the admin flow can continue.
    // Clear the recovery claim in the same update — no dangling claim after transition.
    const moved = await prisma.payout.updateMany({
      where: { id: payoutId, status: 'PROCESSING', recoveryClaimToken: claimToken },
      data: {
        status: 'PENDING_TRANSFER',
        failureReason: null,
        recoveryClaimToken: null,
        recoveryClaimExpiresAt: null,
      },
    });
    if (moved.count === 0) {
      throw new Error(`Recovery: could not transition manual payout ${payoutId} to PENDING_TRANSFER — claim no longer owned`);
    }
    return {
      payoutId: payout.id,
      payoutRef: payout.payoutRef,
      status: 'PENDING_TRANSFER',
      grossAmount: toNumber(payout.grossAmount),
      taxWithheld: toNumber(payout.taxWithheld),
      netAmount: toNumber(payout.netAmount),
      gstAmount: toNumber(payout.gstAmount),
      stripeTransferId: null,
      transactionCount: txCount,
    };
  }

  // ── Stripe recovery ──────────────────────────────────────────────────────────

  let resolvedTransfer: Stripe.Transfer;

  try {
    if (payout.stripeTransferId) {
      // Scenario A: stripeTransferId already written to the database.
      // The DB commit failed after Stripe responded.  Retrieve directly.
      resolvedTransfer = await stripe.transfers.retrieve(payout.stripeTransferId);

    } else {
      // Scenario B: No stripeTransferId — timeout before we got a response.
      //
      // Safety check: Stripe retains idempotency keys for 24 hours.
      // We enforce a 23-hour window (1-hour margin).  Outside the window the
      // idempotency key may have expired; replaying the same key could then
      // create a new transfer even if the original succeeded.  In that case
      // the reservation does NOT prevent double-payment — it only prevents
      // other payouts from consuming the same funds.
      // We therefore refuse automatic recovery outside the window and require
      // manual reconciliation.
      const reservedAtMs = payout.reservedAt!.getTime();
      const ageMs = Date.now() - reservedAtMs;

      if (ageMs > STRIPE_IDEMPOTENCY_SAFE_WINDOW_MS) {
        const ageHours = (ageMs / 3_600_000).toFixed(1);
        const msg =
          `Recovery: payout ${payout.payoutRef} has been PROCESSING for ${ageHours}h ` +
          `(> 23h idempotency safety window). ` +
          `Cannot safely replay idempotency key — manual reconciliation required. ` +
          `Idempotency key: ${payout.idempotencyKey}`;

        await logTransition(payoutId, adminUserId, 'PAYOUT_RECOVERY_EXPIRED', {
          payoutRef: payout.payoutRef,
          ageHours,
          idempotencyKey: payout.idempotencyKey,
          note: 'Reservation preserved — manual reconciliation required',
        }, false, msg);

        void sendAlert({
          type: 'PAYOUT_COMMIT_FAILED',
          severity: 'CRITICAL',
          message: `Payout recovery window expired — manual reconciliation required: ${payout.payoutRef}`,
          entityId: payoutId,
          metadata: {
            payoutRef: payout.payoutRef,
            providerId: payout.providerId,
            netAmount: payout.netAmount,
            ageHours,
            idempotencyKey: payout.idempotencyKey,
            action: 'Query Stripe for this idempotency key and either commit or release manually.',
          },
        });

        throw new Error(msg);
      }

      // Within the safe window: re-call with IDENTICAL parameters.
      // buildStripeTransferParams() produces the same body as the original call.
      resolvedTransfer = await stripe.transfers.create(
        buildStripeTransferParams(
          { ...payout, stripeAccountId: payout.stripeAccountId! },
          txCount,
          adminUserId,
        ),
        { idempotencyKey: payout.idempotencyKey },
      );
    }
  } catch (stripeErr) {
    // Could not establish the transfer outcome.
    // Preserve the financial reservation — do NOT release, do NOT mark FAILED.
    // Clear the recovery claim so another worker can retry after investigation.
    const reason = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);

    // Clear claim fields (financial reservation remains intact).
    await prisma.payout.updateMany({
      where: { id: payoutId, recoveryClaimToken: claimToken },
      data: { recoveryClaimToken: null, recoveryClaimExpiresAt: null },
    });

    await logTransition(payoutId, adminUserId, 'PAYOUT_RECOVERY_FAILED', {
      payoutRef: payout.payoutRef,
      note: 'Stripe call failed during recovery — reservation preserved, manual investigation required',
    }, false, reason);

    void sendAlert({
      type: 'PAYOUT_COMMIT_FAILED',
      severity: 'CRITICAL',
      message: `Payout recovery failed — manual investigation required: ${payout.payoutRef}`,
      entityId: payoutId,
      metadata: {
        payoutRef: payout.payoutRef,
        providerId: payout.providerId,
        netAmount: payout.netAmount,
        failureReason: reason,
        idempotencyKey: payout.idempotencyKey,
        action: 'Reservation preserved. Query Stripe manually for idempotency key: ' + payout.idempotencyKey,
      },
    });

    throw new Error(
      `Recovery: could not establish Stripe transfer outcome for ${payout.payoutRef}. ` +
      `Reservation preserved. Original error: ${reason}`
    );
  }

  // Transfer confirmed — complete the DB writes in a single transaction.
  // claimToken is passed so commitPayoutCompletion can clear the recovery
  // claim atomically with the status transition — no window where the claim
  // outlives the PAID status.
  await commitPayoutCompletion({
    payoutId,
    stripeTransferId: resolvedTransfer.id,
    payout: {
      netAmount: toNumber(payout.netAmount),
      grossAmount: toNumber(payout.grossAmount),
      taxWithheld: toNumber(payout.taxWithheld),
      payoutRef: payout.payoutRef,
      providerId: payout.providerId,
    },
    txCount,
    adminUserId,
    path: 'stripe',
    recoveryClaimToken: claimToken,
  });

  await logTransition(payoutId, adminUserId, 'PAYOUT_PAID', {
    payoutRef: payout.payoutRef,
    stripeTransferId: resolvedTransfer.id,
    note: payout.stripeTransferId ? 'Recovered (Scenario A: direct retrieve)' : 'Recovered (Scenario B: idempotency key)',
    transactionCount: txCount,
  });

  return {
    payoutId: payout.id,
    payoutRef: payout.payoutRef,
    status: 'PAID',
    grossAmount: toNumber(payout.grossAmount),
    taxWithheld: toNumber(payout.taxWithheld),
    netAmount: toNumber(payout.netAmount),
    gstAmount: toNumber(payout.gstAmount),
    stripeTransferId: resolvedTransfer.id,
    transactionCount: txCount,
  };
}

// Phase 2: Execute

/**
 * Execute a payout in ELIGIBLE or FAILED state.
 *
 * Stripe Connect: acquires lock -> reserve funds -> Stripe transfer -> PAID -> ledger
 * Bank/Manual:    acquires lock -> reserve funds -> PENDING_TRANSFER (no ledger yet)
 *                 Ledger is updated only when admin calls confirmPayoutReceived().
 *
 * Recovery (PROCESSING with active reservation):
 * If a prior attempt reached Stripe but the DB commit failed (or the network timed out),
 * the payout remains PROCESSING with reservedAt set.  executePayout() detects this and
 * routes to recoverProcessingPayout(), which either retrieves the existing transfer by ID
 * (Scenario A) or re-calls stripe.transfers.create() with the same idempotency key
 * (Scenario B — returns existing transfer or creates one, money moves at most once).
 * Recovery never releases a reservation based on a negative Stripe search result.
 */
export async function executePayout(
  payoutId: string,
  adminUserId: string,
): Promise<PayoutResult> {
  // ── Recovery check: PROCESSING payout with active reservation ───────────────
  // This handles two scenarios:
  //   A. commitPayoutCompletion() failed after Stripe succeeded.
  //   B. Network timeout — Stripe outcome unknown but reservation was stamped.
  // In both cases we route to recoverProcessingPayout() which verifies via Stripe
  // before completing or releasing.
  const existing = await prisma.payout.findUnique({
    where: { id: payoutId },
    select: { status: true, reservedAt: true, payoutMethod: true, stripeAccountId: true, idempotencyKey: true },
  });

  if (existing?.status === 'PROCESSING' && existing.reservedAt !== null) {
    return recoverProcessingPayout(payoutId, adminUserId);
  }

  // ── Normal path: acquire lock (ELIGIBLE or FAILED → PROCESSING) ─────────────
  // Atomic lock: only moves forward if status is ELIGIBLE or FAILED
  const locked = await prisma.payout.updateMany({
    where: { id: payoutId, status: { in: ['ELIGIBLE', 'FAILED'] } },
    data: { status: 'PROCESSING' },
  });

  if (locked.count === 0) {
    const current = await prisma.payout.findUnique({ where: { id: payoutId } });
    if (!current) throw new Error('Payout not found');
    return {
      payoutId: current.id,
      payoutRef: current.payoutRef,
      status: current.status as PayoutResult['status'],
      grossAmount: toNumber(current.grossAmount),
      taxWithheld: toNumber(current.taxWithheld),
      netAmount: toNumber(current.netAmount),
      gstAmount: toNumber(current.gstAmount),
      stripeTransferId: current.stripeTransferId,
      transactionCount: 0,
      failureReason: current.failureReason ?? undefined,
    };
  }

  await logTransition(payoutId, adminUserId, 'PAYOUT_PROCESSING', { lockedAt: new Date().toISOString() });

  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
    include: { transactions: { select: { transactionId: true } } },
  });
  if (!payout) throw new Error('Payout not found after lock');

  const instructor = await prisma.provider.findUnique({
    where: { id: payout.providerId },
    select: { name: true, phone: true, user: { select: { email: true } } },
  });

  const txCount = payout.transactions.length;
  const isStripe = payout.payoutMethod === 'stripe_connect' && payout.stripeAccountId;

  // Tracks whether stripe.transfers.create has returned successfully.
  // If true when an error is thrown, the catch block must NOT release the
  // reservation — the transfer already occurred and the payout must remain
  // PROCESSING so a retry can recover it.
  let stripeTransferCreated = false;

  try {
    // Phase 1: Reserve funds BEFORE any Stripe call.
    // reservePayoutFunds acquires SELECT FOR UPDATE on PlatformLedger, checks
    // available balance (excluding other in-flight reservations), then atomically
    // stamps the Payout row and increments totalPayoutReserved.
    await reservePayoutFunds(payoutId, toNumber(payout.netAmount));

    if (isStripe) {
      // PAY-01 SECURITY: Verify destination ownership before money movement
      // Prevents account substitution attacks by checking Stripe-side metadata
      const { verifyPayoutDestinationOwnership } = await import('./payout-security');
      const ownershipCheck = await verifyPayoutDestinationOwnership(
        stripe,
        payout.stripeAccountId!,
        payout.providerId
      );

      if (!ownershipCheck.valid) {
        throw new Error(
          `Payout destination ownership verification failed: ${ownershipCheck.reason}. ` +
          `Payout ${payoutId} blocked for security. Expected provider ${payout.providerId}, ` +
          `account ${payout.stripeAccountId}.`
        );
      }

      // TOCTOU Protection: Use the verified account ID (same value we just checked)
      const verifiedAccountId = payout.stripeAccountId!;

      // Stripe Connect: funds already reserved in DB — safe to transfer now.
      //
      // IMPORTANT: Once stripe.transfers.create returns without throwing, the money
      // has moved (or Stripe already has it from a prior idempotent attempt).
      // Any database failure AFTER this point must NOT release the reservation —
      // the payout must remain PROCESSING so the next retry can call Stripe with
      // the same idempotency key, get back the existing transfer, and complete the
      // DB writes.  stripeTransferCreated (hoisted to outer scope) tracks whether
      // we have crossed this point.

      const transfer = await stripe.transfers.create(
        buildStripeTransferParams(
          { ...payout, stripeAccountId: verifiedAccountId },
          txCount,
          adminUserId,
        ),
        { idempotencyKey: payout.idempotencyKey },
      );
      // ← Money has moved (or was already moved on a prior attempt).
      stripeTransferCreated = true;

      // Single transaction: status PROCESSING→PAID + ledger counters + LedgerEntry rows.
      // If this fails, stripeTransferCreated=true so the catch block will NOT release
      // the reservation or mark FAILED — the payout stays PROCESSING and is retryable.
      await commitPayoutCompletion({
        payoutId,
        stripeTransferId: transfer.id,
        payout: {
          netAmount: toNumber(payout.netAmount),
          grossAmount: toNumber(payout.grossAmount),
          taxWithheld: toNumber(payout.taxWithheld),
          payoutRef: payout.payoutRef,
          providerId: payout.providerId,
        },
        txCount,
        adminUserId,
        path: 'stripe',
      });

      await logTransition(payoutId, adminUserId, 'PAYOUT_PAID', {
        payoutRef: payout.payoutRef,
        grossAmount: payout.grossAmount,
        taxWithheld: payout.taxWithheld,
        netAmount: payout.netAmount,
        stripeTransferId: transfer.id,
        transactionCount: txCount,
      });

      // FIX #8: Mark unrecovered ADJUSTMENT entries for this instructor as recovered
      // so they are not double-deducted in future payouts.
      // Then send instructor notification email about deductions.
      try {
        const unrecovered = await prisma.ledgerEntry.findMany({
          where: { type: 'ADJUSTMENT', providerId: payout.providerId },
        });
        const adjustmentDetails: Array<{ bookingId: string; amount: number }> = [];

        for (const adj of unrecovered) {
          const meta = (adj.metadata as any) ?? {};
          if (!meta.recovered) {
            await prisma.ledgerEntry.update({
              where: { id: adj.id },
              data: { metadata: { ...meta, recovered: true, recoveredByPayoutId: payoutId } },
            });
            // Track for email notification
            if ((meta as any).referenceId && (meta as any).referenceId.startsWith('clx') || (meta as any).referenceId.startsWith('cm')) {
              adjustmentDetails.push({
                bookingId: (meta as any).referenceId,
                amount: toNumber(roundAmount(toDecimal(adj.amount).abs(), 2)),
              });
            }
          }
        }

        // Send instructor deduction email if there were adjustments
        if (adjustmentDetails.length > 0 && instructor?.user?.email) {
          try {
            const totalDeductedDec = sumAmounts(adjustmentDetails.map((d: any) => d.amount));
            const totalDeducted = toNumber(roundAmount(totalDeductedDec, 2));
            const html = `<h2>Wallet Adjustment Applied</h2>
              <p>Hi ${instructor.name},</p>
              <p>Your DriveBook payout has been adjusted to recover the following refund deductions:</p>
              <ul>
                ${adjustmentDetails.map(d => `<li>Booking ${d.bookingId}: -$${d.amount.toFixed(2)}</li>`).join('')}
              </ul>
              <p><strong>Total deducted from payout:</strong> ${toFixed(toDecimal(totalDeducted), 2)}</p>
              <p>These adjustments are made in accordance with our cancellation policy. If you believe this is in error, please contact support.</p>`;
            
            await emailService.sendGenericEmail({
              from: 'DriveBook Payments <payments@drivebook.com.au>',
              to: instructor.user.email,
              subject: `Payout Adjustment · ${toFixed(toDecimal(totalDeducted), 2)} deducted (${payout.payoutRef})`,
              html,
            }).catch((e: any) => console.error('Adjustment deduction email failed (non-critical):', e));
          } catch (e) {
            console.error('[PAYOUT] Failed to send adjustment email (non-critical):', e);
          }
        }
      } catch (adjErr) {
        console.error('[PAYOUT] Failed to mark adjustments recovered (non-critical):', adjErr);
      }

      if (instructor?.phone) {
        try {
          const taxNote = Number(payout.taxWithheld) > 0 ? ` (tax withheld: $${Number(payout.taxWithheld).toFixed(2)})` : '';
          await smsService.sendSMS({
            to: instructor.phone,
            message: `DriveBook: Payout of ${toFixed(toDecimal(payout.netAmount), 2)} processed for ${txCount} lesson(s)${taxNote}. Ref: ${payout.payoutRef}`,
          });
        } catch (e) {
          console.error('SMS failed (non-critical):', e);
        }
      }

      return {
        payoutId,
        payoutRef: payout.payoutRef,
        status: 'PAID',
        grossAmount: toNumber(payout.grossAmount),
        taxWithheld: toNumber(payout.taxWithheld),
        netAmount: toNumber(payout.netAmount),
        gstAmount: toNumber(payout.gstAmount),
        stripeTransferId: transfer.id,
        transactionCount: txCount,
      };
    } else {
      // Bank transfer / manual: no money moves yet.
      // Status -> PENDING_TRANSFER. Reservation remains active.
      // Ledger is updated only when admin confirms receipt via confirmPayoutReceived().
      await prisma.payout.update({
        where: { id: payoutId },
        data: { status: 'PENDING_TRANSFER', failureReason: null },
      });

      await logTransition(payoutId, adminUserId, 'PAYOUT_PENDING_TRANSFER', {
        payoutRef: payout.payoutRef,
        grossAmount: payout.grossAmount,
        taxWithheld: payout.taxWithheld,
        netAmount: payout.netAmount,
        payoutMethod: payout.payoutMethod,
        transactionCount: txCount,
      });

      return {
        payoutId,
        payoutRef: payout.payoutRef,
        status: 'PENDING_TRANSFER',
        grossAmount: toNumber(payout.grossAmount),
        taxWithheld: toNumber(payout.taxWithheld),
        netAmount: toNumber(payout.netAmount),
        gstAmount: toNumber(payout.gstAmount),
        stripeTransferId: null,
        transactionCount: txCount,
      };
    }
  } catch (err) {
    const failureReason = err instanceof Error ? err.message : String(err);

    if (stripeTransferCreated) {
      // The Stripe transfer succeeded but the DB commit failed.
      // The reservation MUST remain active — the payout stays PROCESSING.
      // The next call to executePayout() will detect PROCESSING+reservedAt and
      // route to recoverProcessingPayout(), which verifies via Stripe and completes.
      await logTransition(payoutId, adminUserId, 'PAYOUT_COMMIT_FAILED', {
        payoutRef: payout.payoutRef,
        grossAmount: payout.grossAmount,
        netAmount: payout.netAmount,
        note: 'Stripe transfer succeeded; DB commit failed — reservation preserved, recovery required',
      }, false, failureReason);

      void sendAlert({
        type: 'PAYOUT_COMMIT_FAILED',
        severity: 'CRITICAL',
        message: `Stripe transfer succeeded but DB commit failed: ${payout.payoutRef}`,
        entityId: payoutId,
        metadata: {
          payoutRef: payout.payoutRef,
          providerId: payout.providerId,
          netAmount: payout.netAmount,
          failureReason,
          action: 'Payout remains PROCESSING with reservation. Re-call executePayout() to recover.',
        },
      });

      throw err;
    }

    // Classify Stripe errors to distinguish definitive rejection from uncertain outcome.
    // A network timeout or 5xx response means Stripe may have created the transfer
    // even though we did not receive confirmation.  Treat as uncertain — preserve the
    // reservation and do NOT mark FAILED.
    const isStripeError = err instanceof Stripe.errors.StripeError;
    const isUncertain = isStripeError && (
      err instanceof Stripe.errors.StripeConnectionError ||  // TCP/TLS failure, timeout
      err instanceof Stripe.errors.StripeAPIError ||         // Stripe 5xx
      (err as any).statusCode >= 500                        // any 5xx from Stripe
    );

    if (isUncertain) {
      // Transfer outcome unknown — reservation stays active.
      // Next executePayout() call routes to recoverProcessingPayout().
      await logTransition(payoutId, adminUserId, 'PAYOUT_UNCERTAIN', {
        payoutRef: payout.payoutRef,
        note: 'Stripe outcome uncertain (timeout or 5xx) — reservation preserved, manual recovery required',
      }, false, failureReason);

      void sendAlert({
        type: 'PAYOUT_COMMIT_FAILED',
        severity: 'CRITICAL',
        message: `Stripe transfer outcome uncertain: ${payout.payoutRef}`,
        entityId: payoutId,
        metadata: {
          payoutRef: payout.payoutRef,
          providerId: payout.providerId,
          netAmount: payout.netAmount,
          failureReason,
          action: 'Payout remains PROCESSING with reservation. Re-call executePayout() to recover via Stripe idempotency key.',
        },
      });

      throw err;
    }

    // Stripe definitively rejected the transfer (4xx, ownership check failed, etc.)
    // — or the error occurred before Stripe was called at all.
    // Safe to release the reservation and mark FAILED.
    await releasePayoutReservation(payoutId, toNumber(payout.netAmount), failureReason);

    await logTransition(payoutId, adminUserId, 'PAYOUT_FAILED', {
      payoutRef: payout.payoutRef,
      grossAmount: payout.grossAmount,
      netAmount: payout.netAmount,
    }, false, failureReason);

    void sendAlert({
      type: 'PAYOUT_FAILED',
      severity: 'CRITICAL',
      message: `Payout failed: ${payout.payoutRef}`,
      entityId: payoutId,
      metadata: {
        payoutRef: payout.payoutRef,
        providerId: payout.providerId,
        netAmount: payout.netAmount,
        failureReason,
      },
    });

    return {
      payoutId,
      payoutRef: payout.payoutRef,
      status: 'FAILED',
      grossAmount: Number(payout.grossAmount),
      taxWithheld: Number(payout.taxWithheld),
      netAmount: Number(payout.netAmount),
      gstAmount: Number(payout.gstAmount),
      stripeTransferId: null,
      transactionCount: txCount,
      failureReason,
    };
  }
}

// Admin: mark bank/manual payout as sent (PENDING_TRANSFER -> SENT)

export async function markPayoutSent(
  payoutId: string,
  adminUserId: string,
  bankReference: string,
) {
  const updated = await prisma.payout.updateMany({
    where: { id: payoutId, status: 'PENDING_TRANSFER' },
    data: {
      status: 'SENT',
      bankReference,
      sentAt: new Date(),
      sentBy: adminUserId,
    },
  });

  if (updated.count === 0) {
    const current = await prisma.payout.findUnique({ where: { id: payoutId } });
    throw new Error(`Cannot mark sent: payout is ${current?.status ?? 'not found'}`);
  }

  await logTransition(payoutId, adminUserId, 'PAYOUT_SENT', { bankReference });
}

// Admin: confirm receipt (SENT -> PAID) + update ledger

export async function confirmPayoutReceived(
  payoutId: string,
  adminUserId: string,
) {
  // Read for validation — not yet authoritative (the transaction below is).
  const payout = await prisma.payout.findUnique({ where: { id: payoutId } });
  if (!payout) throw new Error('Payout not found');
  if (payout.status !== 'SENT') throw new Error(`Cannot confirm: payout is ${payout.status}`);
  if (!payout.reservedAt || !payout.reservedAmount) {
    throw new Error(
      `Payout ${payoutId} has no active reservation — data integrity error. ` +
      `reservedAt=${payout.reservedAt}, reservedAmount=${payout.reservedAmount}`,
    );
  }

  // Single transaction: SENT→PAID status + PlatformLedger counters + LedgerEntry rows.
  // If any write fails the whole transaction rolls back and the payout remains SENT
  // with its reservation intact, so a retry is safe.
  await commitPayoutCompletion({
    payoutId,
    stripeTransferId: null,
    payout: {
      netAmount: Number(payout.netAmount),
      grossAmount: Number(payout.grossAmount),
      taxWithheld: Number(payout.taxWithheld),
      payoutRef: payout.payoutRef,
      providerId: payout.providerId,
      bankReference: payout.bankReference,
    },
    txCount: 0, // txCount unused in bank-transfer description
    adminUserId,
    path: 'manual',
  });

  await logTransition(payoutId, adminUserId, 'PAYOUT_CONFIRMED', {
    payoutRef: payout.payoutRef,
    grossAmount: payout.grossAmount,
    taxWithheld: payout.taxWithheld,
    netAmount: payout.netAmount,
    bankReference: payout.bankReference,
  });
}

// Convenience: build + execute in one call

export async function executeInstructorPayout(
  providerId: string,
  adminUserId: string,
  transactionIds?: string[],
): Promise<PayoutResult> {
  const { payoutId, alreadyPaid } = await buildPayout(providerId, adminUserId, transactionIds);

  if (alreadyPaid) {
    const p = await prisma.payout.findUnique({
      where: { id: payoutId },
      include: { transactions: { select: { transactionId: true } } },
    });
    if (!p) throw new Error('Payout not found');
    return {
      payoutId: p.id,
      payoutRef: p.payoutRef,
      status: 'PAID',
      grossAmount: Number(p.grossAmount),
      taxWithheld: Number(p.taxWithheld),
      netAmount: Number(p.netAmount),
      gstAmount: Number(p.gstAmount),
      stripeTransferId: p.stripeTransferId,
      transactionCount: p.transactions.length,
    };
  }

  return executePayout(payoutId, adminUserId);
}

// Admin hold / release

export async function holdPayout(payoutId: string, adminUserId: string, reason: string) {
  const updated = await prisma.payout.updateMany({
    where: { id: payoutId, status: { in: ['ELIGIBLE', 'FAILED'] } },
    data: { status: 'ON_HOLD', holdReason: reason },
  });
  if (updated.count > 0) {
    await logTransition(payoutId, adminUserId, 'PAYOUT_HELD', { reason });
  }
}

export async function releasePayout(payoutId: string, adminUserId: string) {
  const updated = await prisma.payout.updateMany({
    where: { id: payoutId, status: 'ON_HOLD' },
    data: { status: 'ELIGIBLE', holdReason: null },
  });
  if (updated.count > 0) {
    await logTransition(payoutId, adminUserId, 'PAYOUT_RELEASED', {});
  }
}

// Record payment collected (called from webhook/payment capture)

export async function recordPaymentCollected(
  bookingId: string,
  amount: number,
  providerPayout: number,
) {
  // PH5-SCH-22 FIX: Wrap LedgerEntry + PlatformLedger writes in transaction
  // to prevent partial failures that corrupt totalCollected.
  await prisma.$transaction(async (tx) => {
    await appendLedgerEntry({
      type: 'PAYMENT_COLLECTED',
      amount,
      referenceId: bookingId,
      referenceType: 'BOOKING',
      description: `Booking ${bookingId} payment captured`,
    }, tx);
    
    await incrementLedger({
      totalCollected: amount,
      totalReserved: providerPayout,
    }, tx);
  });
}

// Record refund issued (called from refund route)

export async function recordRefundIssued(
  bookingId: string,
  refundAmount: number,
  providerId: string,
  postPayout: boolean,
) {
  // PH5-SCH-22 RELATED: Wrap refund ledger writes in transaction
  // Same atomicity requirement as recordPaymentCollected
  await prisma.$transaction(async (tx) => {
    await appendLedgerEntry({
      type: 'REFUND_ISSUED',
      amount: -refundAmount,
      referenceId: bookingId,
      referenceType: 'BOOKING',
      providerId,
      description: `Refund for booking ${bookingId}${postPayout ? ' (post-payout adjustment)' : ''}`,
      metadata: { postPayout },
    }, tx);
    
    await incrementLedger({ totalRefunded: refundAmount }, tx);
    
    if (postPayout) {
      await appendLedgerEntry({
        type: 'ADJUSTMENT',
        amount: -refundAmount,
        referenceId: bookingId,
        referenceType: 'ADJUSTMENT',
        providerId,
        description: `Post-payout deduction for booking ${bookingId} - to be recovered from next payout`,
        metadata: { postPayout: true },
      }, tx);
    }
  });

  await assertNonNegativeBalance();
}
