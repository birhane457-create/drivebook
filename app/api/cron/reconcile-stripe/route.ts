/**
 * Cron: Daily Stripe Reconciliation
 *
 * Detection-only — never auto-fixes. Flags issues for admin review.
 *
 * Three checks per run:
 *   1. Missing payments  — Stripe payment_intent.succeeded with no LedgerEntry(PAYMENT_COLLECTED)
 *   2. Missing transfers — PAID payout with stripeTransferId not found in Stripe
 *   3. Stuck payouts     — status = PROCESSING for > 10 minutes
 *
 * Results stored in ReconciliationReport. Warnings logged to console.
 * Alerting (email/Slack) wired in #4.
 *
 * Trigger: daily at 03:00 AWST (19:00 UTC) — configure in vercel.json
 * Auth: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { sendAlert } from '@/lib/services/alert-service';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' });

// Payouts stuck in PROCESSING longer than this are flagged
const STUCK_THRESHOLD_MINUTES = 10;

export async function GET(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Concurrency lock — prevent overlapping runs ───────────────────────────
  const running = await (prisma as any).reconciliationReport.findFirst({
    where: { status: 'RUNNING' },
  });
  if (running) {
    return NextResponse.json({ skipped: true, reason: 'Another reconciliation run is in progress' });
  }

  // ── Determine window — last 25 hours (overlap to catch edge cases) ────────
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - 25 * 60 * 60 * 1000);

  // ── Create report record (RUNNING) ────────────────────────────────────────
  const report = await (prisma as any).reconciliationReport.create({
    data: {
      status: 'RUNNING',
      windowStart,
      windowEnd,
    },
  });

  const flaggedMissingPayments: { stripePaymentIntentId: string; amount: number; created: number }[] = [];
  const flaggedMissingTransfers: { payoutId: string; payoutRef: string; stripeTransferId: string }[] = [];
  const flaggedStuckPayouts: { payoutId: string; payoutRef: string; stuckSinceMinutes: number }[] = [];

  let paymentsChecked = 0;
  let transfersChecked = 0;

  try {
    // ── Check 1: Missing payments ─────────────────────────────────────────
    // Pull Stripe payment_intents that succeeded in the window
    // and verify each has a corresponding LedgerEntry(PAYMENT_COLLECTED)
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const params: Stripe.PaymentIntentListParams = {
        limit: 100,
        created: {
          gte: Math.floor(windowStart.getTime() / 1000),
          lte: Math.floor(windowEnd.getTime() / 1000),
        },
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      };

      const page = await stripe.paymentIntents.list(params);

      for (const pi of page.data) {
        if (pi.status !== 'succeeded') continue;
        paymentsChecked++;

        // Check for a LedgerEntry referencing this payment intent
        // LedgerEntry.referenceId is the bookingId — we match via metadata on the PI
        const bookingId = pi.metadata?.bookingId;
        if (!bookingId) continue; // wallet top-ups etc — skip

        const ledgerEntry = await (prisma as any).ledgerEntry.findFirst({
          where: {
            type: 'PAYMENT_COLLECTED',
            referenceId: bookingId,
          },
        });

        if (!ledgerEntry) {
          flaggedMissingPayments.push({
            stripePaymentIntentId: pi.id,
            amount: pi.amount / 100,
            created: pi.created,
          });
        }
      }

      hasMore = page.has_more;
      if (page.data.length > 0) {
        startingAfter = page.data[page.data.length - 1].id;
      } else {
        hasMore = false;
      }
    }

    // ── Check 2: Missing transfers ────────────────────────────────────────
    // For every PAID payout with a stripeTransferId, verify the transfer exists in Stripe
    const paidPayouts = await (prisma as any).payout.findMany({
      where: {
        status: 'PAID',
        stripeTransferId: { not: null },
        paidAt: { gte: windowStart, lte: windowEnd },
      },
      select: { id: true, payoutRef: true, stripeTransferId: true },
    });

    for (const payout of paidPayouts) {
      transfersChecked++;
      try {
        await stripe.transfers.retrieve(payout.stripeTransferId);
        // If no error thrown, transfer exists — OK
      } catch (err: unknown) {
        const stripeErr = err as { code?: string };
        if (stripeErr?.code === 'resource_missing') {
          flaggedMissingTransfers.push({
            payoutId: payout.id,
            payoutRef: payout.payoutRef,
            stripeTransferId: payout.stripeTransferId,
          });
        }
        // Other errors (network etc) — don't flag, just skip
      }
    }

    // ── Check 3: Stuck payouts ────────────────────────────────────────────
    const stuckCutoff = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000);
    const stuckPayouts = await (prisma as any).payout.findMany({
      where: {
        status: 'PROCESSING',
        updatedAt: { lte: stuckCutoff },
      },
      select: { id: true, payoutRef: true, updatedAt: true },
    });

    for (const p of stuckPayouts) {
      const stuckSinceMinutes = Math.round((Date.now() - new Date(p.updatedAt).getTime()) / 60000);
      flaggedStuckPayouts.push({
        payoutId: p.id,
        payoutRef: p.payoutRef,
        stuckSinceMinutes,
      });
    }

    // ── Determine status ──────────────────────────────────────────────────
    const hasIssues =
      flaggedMissingPayments.length > 0 ||
      flaggedMissingTransfers.length > 0 ||
      flaggedStuckPayouts.length > 0;

    const finalStatus = hasIssues ? 'WARNING' : 'SUCCESS';

    // ── Update report ─────────────────────────────────────────────────────
    await (prisma as any).reconciliationReport.update({
      where: { id: report.id },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        paymentsChecked,
        missingPayments: flaggedMissingPayments.length,
        transfersChecked,
        missingTransfers: flaggedMissingTransfers.length,
        stuckPayouts: flaggedStuckPayouts.length,
        metadata: {
          flaggedMissingPayments,
          flaggedMissingTransfers,
          flaggedStuckPayouts,
        },
      },
    });

    // ── Console summary (picked up by Vercel logs) ────────────────────────
    if (hasIssues) {
      console.warn(
        `[RECONCILIATION WARNING] Run ${report.id}: ` +
        `missingPayments=${flaggedMissingPayments.length}, ` +
        `missingTransfers=${flaggedMissingTransfers.length}, ` +
        `stuckPayouts=${flaggedStuckPayouts.length}`,
      );

      // Alert — non-blocking
      void sendAlert({
        type: 'RECONCILIATION_ISSUES',
        severity: 'WARNING',
        message: `Reconciliation issues detected — ${flaggedMissingPayments.length} missing payments, ${flaggedMissingTransfers.length} missing transfers, ${flaggedStuckPayouts.length} stuck payouts`,
        entityId: report.id,
        metadata: {
          reportId: report.id,
          missingPayments: flaggedMissingPayments.length,
          missingTransfers: flaggedMissingTransfers.length,
          stuckPayouts: flaggedStuckPayouts.length,
          windowStart: windowStart.toISOString(),
          windowEnd: windowEnd.toISOString(),
        },
      });
    } else {
      console.log(
        `[RECONCILIATION OK] Run ${report.id}: ` +
        `${paymentsChecked} payments checked, ${transfersChecked} transfers checked — no issues`,
      );
    }

    return NextResponse.json({
      success: true,
      reportId: report.id,
      status: finalStatus,
      paymentsChecked,
      missingPayments: flaggedMissingPayments.length,
      transfersChecked,
      missingTransfers: flaggedMissingTransfers.length,
      stuckPayouts: flaggedStuckPayouts.length,
    });
  } catch (error) {
    // Mark report FAILED so the lock is released
    await (prisma as any).reconciliationReport.update({
      where: { id: report.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        metadata: { error: error instanceof Error ? error.message : String(error) },
      },
    });

    console.error('[RECONCILIATION FAILED]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Reconciliation failed' },
      { status: 500 },
    );
  }
}
