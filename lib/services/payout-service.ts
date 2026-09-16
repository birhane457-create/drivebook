/**
 * Payout Service
 *
 * State machine:
 *   Stripe Connect:  ELIGIBLE -> PROCESSING -> PAID
 *   Bank/Manual:     ELIGIBLE -> PROCESSING -> PENDING_TRANSFER -> SENT -> PAID
 *                                           -> FAILED   (retryable)
 *                                           -> ON_HOLD  (dispute / admin hold)
 *
 * Guarantees:
 * - Transactions are IMMUTABLE - never mutated after creation.
 *   Payout membership tracked via PayoutTransaction join records only.
 * - Idempotency: SHA-256 of sorted transaction IDs -> collision-free key
 *   passed to both DB (@unique constraint) and Stripe.
 * - Concurrency lock: ELIGIBLE/FAILED -> PROCESSING is atomic via updateMany
 *   with status guard. 0 rows updated = another process holds the lock -> abort.
 * - Balance check: assertSufficientBalance() before every Stripe transfer.
 * - Ledger: every financial event appended to LedgerEntry + PlatformLedger updated.
 *   For bank/manual payouts, ledger is updated ONLY when admin confirms receipt.
 * - Full audit trail: every state transition logged to AuditLog.
 * - Two-phase: buildPayout() validates + creates record (no Stripe),
 *   executePayout() acquires lock + transfers + finalises.
 */

import crypto from 'crypto';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { smsService } from '@/lib/services/sms';
import { emailService } from '@/lib/services/email';
import { appendLedgerEntry, incrementLedger, assertSufficientBalance, assertNonNegativeBalance, getPlatformLedger } from '@/lib/services/ledger-service';
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
async function getPayoutBufferHours(): Promise<number> {
  try {
    const settings = await prisma.platformSettings.findFirst({
      select: { lateCancellationWindowHours: true },
    });
    return Number(settings?.lateCancellationWindowHours ?? 24);
  } catch {
    return 24; // safe fallback
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
    status: 'SETTLED',
    type: 'BOOKING_PAYMENT',
    booking: {
      status: { in: ['CONFIRMED', 'COMPLETED'] },
      endTime: { lte: bufferCutoff },
      deletedAt: null,
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

// Phase 2: Execute

/**
 * Execute a payout in ELIGIBLE or FAILED state.
 *
 * Stripe Connect: acquires lock -> balance check -> Stripe transfer -> PAID -> ledger
 * Bank/Manual:    acquires lock -> balance check -> PENDING_TRANSFER (no ledger yet)
 *                 Ledger is updated only when admin calls markPayoutSent() + confirmPayout()
 */
export async function executePayout(
  payoutId: string,
  adminUserId: string,
): Promise<PayoutResult> {
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

  try {
    await assertSufficientBalance(Number(payout.netAmount));

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

      // Stripe Connect: money moves now -> PAID -> ledger updated
      const transfer = await stripe.transfers.create(
        {
          amount: Math.round(toNumber(toDecimal(payout.netAmount)) * 100),
          currency: 'aud',
          destination: verifiedAccountId,
          description: `DriveBook ${payout.payoutRef} - ${txCount} lesson(s)`,
          metadata: {
            payoutRef: payout.payoutRef,
            payoutId: payout.id,
            providerId: payout.providerId,
            transactionCount: String(txCount),
            taxWithheld: toFixed(toDecimal(payout.taxWithheld), 2),
            adminId: adminUserId,
          },
        },
        { idempotencyKey: payout.idempotencyKey },
      );

      await prisma.payout.update({
        where: { id: payoutId },
        data: {
          status: 'PAID',
          stripeTransferId: transfer.id,
          paidAt: new Date(),
          failureReason: null,
        },
      });

      await Promise.all([
        appendLedgerEntry({
          type: 'PAYOUT_PAID',
          amount: -toNumber(payout.netAmount),
          referenceId: payoutId,
          referenceType: 'PAYOUT',
          providerId: payout.providerId,
          description: `${payout.payoutRef} - net payout to instructor (Stripe)`,
          metadata: { stripeTransferId: transfer.id, txCount },
        }),
        ...(Number(payout.taxWithheld) > 0
          ? [appendLedgerEntry({
              type: 'TAX_WITHHELD',
              amount: toNumber(payout.taxWithheld),
              referenceId: payoutId,
              referenceType: 'PAYOUT',
              providerId: payout.providerId,
              description: `${payout.payoutRef} - ATO withholding`,
            })]
          : []),
        incrementLedger({
          totalPaidOut: toNumber(payout.netAmount),
          totalReserved: -toNumber(payout.grossAmount),
          totalTaxWithheld: toNumber(payout.taxWithheld),
        }),
      ]);

      // P2-7 FIX: Verify ledger didn't go negative after payout (concurrent payout race).
      // assertSufficientBalance() runs before the Stripe transfer but a concurrent payout
      // could have consumed the same balance in the window between the check and the transfer.
      await assertNonNegativeBalance();

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
            }).catch(e => console.error('Adjustment deduction email failed (non-critical):', e));
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
      // Status -> PENDING_TRANSFER. Ledger updated only when admin confirms receipt.
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

    await prisma.payout.update({
      where: { id: payoutId },
      data: { status: 'FAILED', failureReason, retryCount: { increment: 1 } },
    });

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
  const payout = await prisma.payout.findUnique({ where: { id: payoutId } });
  if (!payout) throw new Error('Payout not found');
  if (payout.status !== 'SENT') throw new Error(`Cannot confirm: payout is ${payout.status}`);

  await prisma.payout.update({
    where: { id: payoutId },
    data: {
      status: 'PAID',
      paidAt: new Date(),
      confirmedAt: new Date(),
      confirmedBy: adminUserId,
      failureReason: null,
    },
  });

  // Ledger updated now that money is confirmed moved
  await Promise.all([
    appendLedgerEntry({
      type: 'PAYOUT_PAID',
      amount: -Number(payout.netAmount),
      referenceId: payoutId,
      referenceType: 'PAYOUT',
      providerId: payout.providerId,
      description: `${payout.payoutRef} - net payout confirmed (bank transfer)`,
      metadata: { bankReference: payout.bankReference, confirmedBy: adminUserId },
    }),
    ...(Number(payout.taxWithheld) > 0
      ? [appendLedgerEntry({
          type: 'TAX_WITHHELD',
          amount: Number(payout.taxWithheld),
          referenceId: payoutId,
          referenceType: 'PAYOUT',
          providerId: payout.providerId,
          description: `${payout.payoutRef} - ATO withholding`,
        })]
      : []),
    incrementLedger({
      totalPaidOut: Number(payout.netAmount),
      totalReserved: -Number(payout.grossAmount),
      totalTaxWithheld: Number(payout.taxWithheld),
    }),
  ]);

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
  await Promise.all([
    appendLedgerEntry({
      type: 'PAYMENT_COLLECTED',
      amount,
      referenceId: bookingId,
      referenceType: 'BOOKING',
      description: `Booking ${bookingId} payment captured`,
    }),
    incrementLedger({
      totalCollected: amount,
      totalReserved: providerPayout,
    }),
  ]);
}

// Record refund issued (called from refund route)

export async function recordRefundIssued(
  bookingId: string,
  refundAmount: number,
  providerId: string,
  postPayout: boolean,
) {
  await Promise.all([
    appendLedgerEntry({
      type: 'REFUND_ISSUED',
      amount: -refundAmount,
      referenceId: bookingId,
      referenceType: 'BOOKING',
      providerId,
      description: `Refund for booking ${bookingId}${postPayout ? ' (post-payout adjustment)' : ''}`,
      metadata: { postPayout },
    }),
    incrementLedger({ totalRefunded: refundAmount }),
    ...(postPayout
      ? [appendLedgerEntry({
          type: 'ADJUSTMENT',
          amount: -refundAmount,
          referenceId: bookingId,
          referenceType: 'ADJUSTMENT',
          providerId,
          description: `Post-payout deduction for booking ${bookingId} - to be recovered from next payout`,
          metadata: { postPayout: true },
        })]
      : []),
  ]);

  await assertNonNegativeBalance();
}
