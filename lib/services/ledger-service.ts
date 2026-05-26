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

// ─── Ledger entry types ───────────────────────────────────────────────────────

export type LedgerEntryType =
  | 'PAYMENT_COLLECTED'  // student pays for a booking
  | 'PAYOUT_PAID'        // instructor receives net payout
  | 'TAX_WITHHELD'       // ATO withholding recorded
  | 'REFUND_ISSUED'      // refund back to student
  | 'ADJUSTMENT';        // manual correction / post-payout deduction

// ─── Append a ledger entry (never mutates existing entries) ───────────────────

export async function appendLedgerEntry(entry: {
  type: LedgerEntryType;
  amount: number;          // positive = money in, negative = money out
  referenceId: string;
  referenceType: 'BOOKING' | 'PAYOUT' | 'TRANSACTION' | 'ADJUSTMENT';
  instructorId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.ledgerEntry.create({ data: { ...entry, currency: 'AUD', metadata: entry.metadata as any } });
}

// ─── Update the singleton PlatformLedger ─────────────────────────────────────

export async function incrementLedger(delta: {
  totalCollected?: number;
  totalReserved?: number;
  totalPaidOut?: number;
  totalRefunded?: number;
  totalTaxWithheld?: number;
}) {
  // Upsert the singleton, then increment each field atomically
  await prisma.platformLedger.upsert({
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
  };
  return {
    ...totals,
    // Computed — not stored
    availableBalance: parseFloat(
      (totals.totalCollected - totals.totalPaidOut - totals.totalRefunded).toFixed(2),
    ),
  };
}

// ─── Check payout is safe ─────────────────────────────────────────────────────

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
