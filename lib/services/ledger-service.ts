/**
 * Ledger Service
 *
 * Two responsibilities:
 * 1. PlatformLedger — singleton running totals for real-time balance visibility
 *    and payout overpayment prevention.
 * 2. LedgerEntry — append-only log of every financial event (the "ledger of truth").
 *    Entries are never updated after creation.
 *
 * availableBalance = totalCollected − totalPaidOut − totalRefunded
 * Rule enforced before every payout: netAmount ≤ availableBalance
 */

import { prisma } from '@/lib/prisma';
import { sendAlert } from '@/lib/services/alert-service';
import type { Prisma } from '@prisma/client';

// ─── Ledger entry types ───────────────────────────────────────────────────────

export type LedgerEntryType =
  | 'PAYMENT_COLLECTED'  // student pays for a booking
  | 'PAYOUT_PAID'        // instructor receives net payout
  | 'TAX_WITHHELD'       // ATO withholding recorded
  | 'REFUND_ISSUED'      // refund back to student
  | 'ADJUSTMENT'         // manual correction / post-payout deduction
  | 'DISPUTE_OPENED'     // chargeback filed — amount at risk
  | 'DISPUTE_WON'        // dispute resolved in platform's favour — reverses DISPUTE_OPENED
  | 'DISPUTE_LOST'       // chargeback confirmed — platform absorbs loss + Stripe fee
  | 'REFUND_SYNCED';     // refund originated in Stripe Dashboard (not via app refund route)

// ─── Append a ledger entry (never mutates existing entries) ───────────────────

export async function appendLedgerEntry(
  entry: {
    type: LedgerEntryType;
    amount: number;          // positive = money in, negative = money out
    referenceId: string;
    referenceType: 'BOOKING' | 'PAYOUT' | 'TRANSACTION' | 'ADJUSTMENT';
    providerId?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  },
  txClient?: Prisma.TransactionClient
) {
  const client = txClient ?? prisma;
  return client.ledgerEntry.create({ data: { ...entry, currency: 'AUD', metadata: entry.metadata as any } });
}

// ─── Update the singleton PlatformLedger ─────────────────────────────────────

export async function incrementLedger(
  delta: {
    totalCollected?: number;
    totalReserved?: number;
    totalPaidOut?: number;
    totalRefunded?: number;
    totalTaxWithheld?: number;
  },
  txClient?: Prisma.TransactionClient
) {
  const client = txClient ?? prisma;
  // Upsert the singleton, then increment each field atomically
  await client.platformLedger.upsert({
    where: { key: 'default' },
    create: {
      key: 'default',
      totalCollected: delta.totalCollected ?? 0,
      totalReserved: delta.totalReserved ?? 0,
      totalPaidOut: delta.totalPaidOut ?? 0,
      totalRefunded: delta.totalRefunded ?? 0,
      totalTaxWithheld: delta.totalTaxWithheld ?? 0,
    },
    update: {
      ...(delta.totalCollected !== undefined && { totalCollected: { increment: delta.totalCollected } }),
      ...(delta.totalReserved !== undefined && { totalReserved: { increment: delta.totalReserved } }),
      ...(delta.totalPaidOut !== undefined && { totalPaidOut: { increment: delta.totalPaidOut } }),
      ...(delta.totalRefunded !== undefined && { totalRefunded: { increment: delta.totalRefunded } }),
      ...(delta.totalTaxWithheld !== undefined && { totalTaxWithheld: { increment: delta.totalTaxWithheld } }),
    },
  });
}

// ─── Read current ledger state ────────────────────────────────────────────────

export async function getPlatformLedger() {
  const ledger = await prisma.platformLedger.findUnique({ where: { key: 'default' } });
  const totals = ledger ?? {
    totalCollected: 0,
    totalReserved: 0,
    totalPaidOut: 0,
    totalRefunded: 0,
    totalTaxWithheld: 0,
    totalPayoutReserved: 0,
  };
  return {
    ...totals,
    // Computed — not stored.
    // availableBalance subtracts in-flight payout reservations so concurrent
    // executePayout() calls cannot double-spend the same funds.
    availableBalance: parseFloat(
      (
        Number(totals.totalCollected) -
        Number(totals.totalPaidOut) -
        Number(totals.totalRefunded) -
        Number((totals as any).totalPayoutReserved ?? 0)
      ).toFixed(2),
    ),
  };
}

// ─── Check payout is safe (uses availableBalance which excludes reservations) ─

export async function assertSufficientBalance(netAmount: number) {
  const { availableBalance } = await getPlatformLedger();
  if (netAmount > availableBalance) {
    throw new Error(
      `Insufficient platform balance: need $${netAmount.toFixed(2)}, available $${availableBalance.toFixed(2)}`,
    );
  }
}

// ─── Guard against negative balance (post-refund / post-adjustment) ───────────

export async function assertNonNegativeBalance() {
  const { availableBalance, totalCollected } = await getPlatformLedger();
  if (availableBalance < 0) {
    const msg = `Platform balance is negative (${availableBalance.toFixed(2)}). Payouts locked — admin review required.`;
    console.error(
      `[LEDGER ALERT] Platform balance is negative: ${availableBalance.toFixed(2)}. ` +
      `totalCollected=${totalCollected.toFixed(2)}. Payouts are locked until resolved.`,
    );
    // Fire alert — non-blocking (sendAlert never throws)
    void sendAlert({
      type: 'NEGATIVE_BALANCE',
      severity: 'CRITICAL',
      message: `Platform balance is negative: $${availableBalance.toFixed(2)}`,
      metadata: { availableBalance, totalCollected },
    });
    throw new Error(msg);
  }
}

// ─── Durable payout reservation (PH5-SCH-22a Phase 1) ────────────────────────
//
// reservePayoutFunds() MUST be called before every Stripe transfer.
// It acquires a SELECT FOR UPDATE lock on PlatformLedger, verifies the
// available balance (minus existing reservations from concurrent payouts),
// then atomically:
//   1. Stamps reservedAt / reservedAmount / reservationId on the Payout row.
//   2. Increments PlatformLedger.totalPayoutReserved.
//
// This ensures a concurrent executePayout() that reads the ledger between
// our balance check and our Stripe call will see the reserved amount and
// will fail its own balance check — not proceed to Stripe.

export async function reservePayoutFunds(
  payoutId: string,
  netAmount: number,
  txClient?: Prisma.TransactionClient,
): Promise<string> {
  let reservationId!: string;

  const run = async (tx: Prisma.TransactionClient) => {
    // Lock the PlatformLedger row for the duration of this transaction.
    const rows = await tx.$queryRaw<Array<{
      totalCollected: string;
      totalPaidOut: string;
      totalRefunded: string;
      totalPayoutReserved: string;
    }>>`
      SELECT "totalCollected", "totalPaidOut", "totalRefunded", "totalPayoutReserved"
      FROM "PlatformLedger"
      WHERE key = 'default'
      FOR UPDATE
    `;

    if (rows.length === 0) {
      throw new Error('PlatformLedger not initialised — cannot reserve funds');
    }

    const ledger = rows[0];
    const available =
      Number(ledger.totalCollected) -
      Number(ledger.totalPaidOut) -
      Number(ledger.totalRefunded) -
      Number(ledger.totalPayoutReserved);

    if (netAmount > available) {
      throw new Error(
        `Insufficient balance: need $${netAmount.toFixed(2)}, ` +
        `available $${available.toFixed(2)} ` +
        `($${Number(ledger.totalPayoutReserved).toFixed(2)} reserved for in-flight payouts)`,
      );
    }

    reservationId = `RES_${Date.now()}_${payoutId.slice(-8)}`;

    // Guard: only stamp if no reservation exists yet (prevents double-reservation on retry)
    const stamped = await tx.payout.updateMany({
      where: { id: payoutId, status: 'PROCESSING', reservedAt: null },
      data: {
        reservedAt: new Date(),
        reservedAmount: netAmount,
        reservationId,
      },
    });

    if (stamped.count === 0) {
      // Already reserved from a prior attempt — treat as idempotent, read existing id
      const existing = await tx.payout.findUnique({
        where: { id: payoutId },
        select: { reservationId: true },
      });
      reservationId = existing?.reservationId ?? reservationId;
      // Don't increment totalPayoutReserved again — reservation already active
      return;
    }

    // Atomically increment the reservation bucket
    await tx.platformLedger.update({
      where: { key: 'default' },
      data: { totalPayoutReserved: { increment: netAmount } },
    });
  };

  if (txClient) {
    await run(txClient);
  } else {
    await prisma.$transaction(run);
  }

  return reservationId;
}

// ─── Convert reservation → confirmed PAID (PH5-SCH-22a Phase 1) ──────────────
//
// All writes — status, PlatformLedger counters, LedgerEntry rows — happen in
// ONE transaction.  If any write fails the whole transaction rolls back and
// the payout remains in PROCESSING with its reservation intact, so a retry
// can call Stripe with the same idempotency key and reach here again safely.

export async function commitPayoutCompletion(
  opts: {
    payoutId: string;
    stripeTransferId: string | null;
    payout: {
      netAmount: number;
      grossAmount: number;
      taxWithheld: number;
      payoutRef: string;
      providerId: string;
      bankReference?: string | null;
    };
    txCount: number;
    adminUserId: string;
    path: 'stripe' | 'manual';
  },
  txClient?: Prisma.TransactionClient,
): Promise<void> {
  const { payoutId, stripeTransferId, payout, txCount, adminUserId, path } = opts;

  const run = async (tx: Prisma.TransactionClient) => {
    // Lock PlatformLedger
    await tx.$queryRaw`
      SELECT 1 FROM "PlatformLedger" WHERE key = 'default' FOR UPDATE
    `;

    // Conditional status update — guard prevents duplicate completion
    const updated = await tx.payout.updateMany({
      where: {
        id: payoutId,
        status: { in: ['PROCESSING', 'SENT'] },
        reservedAt: { not: null },
      },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        // Clear reservation fields — funds are now settled in totalPaidOut.
        reservedAt: null,
        reservedAmount: null,
        reservationId: null,
        ...(stripeTransferId ? { stripeTransferId } : {}),
        ...(path === 'manual' ? { confirmedAt: new Date(), confirmedBy: adminUserId } : {}),
        failureReason: null,
      },
    });

    if (updated.count === 0) {
      throw new Error('Payout already completed or reservation missing — cannot commit');
    }

    // Convert reservation → settled payout in the aggregates.
    // totalPayoutReserved decrements; totalPaidOut and totalTaxWithheld increment.
    await tx.platformLedger.update({
      where: { key: 'default' },
      data: {
        totalPayoutReserved: { decrement: payout.netAmount },
        totalPaidOut:        { increment: payout.netAmount },
        totalReserved:       { decrement: payout.grossAmount },
        totalTaxWithheld:    { increment: payout.taxWithheld },
      },
    });

    // Append immutable ledger entries
    await appendLedgerEntry(
      {
        type: 'PAYOUT_PAID',
        amount: -payout.netAmount,
        referenceId: payoutId,
        referenceType: 'PAYOUT',
        providerId: payout.providerId,
        description:
          path === 'stripe'
            ? `${payout.payoutRef} - net payout to instructor (Stripe)`
            : `${payout.payoutRef} - net payout confirmed (bank transfer)`,
        metadata: {
          ...(stripeTransferId ? { stripeTransferId } : {}),
          ...(path === 'manual' ? { bankReference: payout.bankReference, confirmedBy: adminUserId } : {}),
          txCount,
        },
      },
      tx,
    );

    if (payout.taxWithheld > 0) {
      await appendLedgerEntry(
        {
          type: 'TAX_WITHHELD',
          amount: payout.taxWithheld,
          referenceId: payoutId,
          referenceType: 'PAYOUT',
          providerId: payout.providerId,
          description: `${payout.payoutRef} - ATO withholding`,
        },
        tx,
      );
    }
  };

  if (txClient) {
    await run(txClient);
  } else {
    await prisma.$transaction(run);
  }
}

// ─── Release reservation on definitive failure (PH5-SCH-22a Phase 1) ─────────
//
// Sets status=FAILED, clears all three reservation fields, and decrements
// totalPayoutReserved by the PERSISTED reservedAmount (not the caller's argument,
// which may differ on a retry after a partial update).
//
// Clearing reservedAt/reservedAmount/reservationId is essential: a subsequent
// retry on the now-FAILED payout must be able to create a fresh reservation.
// If those fields are left populated, reservePayoutFunds() will see reservedAt≠null,
// skip the balance check, skip incrementing totalPayoutReserved, and let the
// payout proceed without its funds counted as reserved.
//
// No-ops if the payout is not currently in PROCESSING with an active reservation
// (idempotent — safe to call twice).
//
// The caller-supplied netAmount is used only as a fallback if reservedAmount is
// somehow null (should never happen once a reservation is stamped).

export async function releasePayoutReservation(
  payoutId: string,
  netAmountFallback: number,
  failureReason: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Lock PlatformLedger before reading the payout to prevent a concurrent
    // reservePayoutFunds() from claiming the about-to-be-released funds.
    await tx.$queryRaw`
      SELECT 1 FROM "PlatformLedger" WHERE key = 'default' FOR UPDATE
    `;

    // Read the persisted reservedAmount while holding the lock.
    const existing = await tx.payout.findUnique({
      where: { id: payoutId },
      select: { status: true, reservedAt: true, reservedAmount: true },
    });

    if (!existing || existing.status !== 'PROCESSING' || !existing.reservedAt) {
      // Already terminal or no reservation — nothing to release.
      return;
    }

    const amountToRelease = existing.reservedAmount
      ? Number(existing.reservedAmount)
      : netAmountFallback;

    // Clear reservation fields so a future retry can create a new reservation.
    await tx.payout.update({
      where: { id: payoutId },
      data: {
        status: 'FAILED',
        failureReason,
        retryCount: { increment: 1 },
        reservedAt: null,
        reservedAmount: null,
        reservationId: null,
      },
    });

    await tx.platformLedger.update({
      where: { key: 'default' },
      data: { totalPayoutReserved: { decrement: amountToRelease } },
    });
  });
}

