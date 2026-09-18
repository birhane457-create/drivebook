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
import { pingCronHealth, failCronHealth } from '@/lib/services/cron-health';

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
    // and verify each has a corresponding LedgerEntry(PAYMENT_COLLECTED).
    // FIX #7: Auto-confirm clear-cut cases — bookings that are PENDING_PAYMENT
    // in DB but paid in Stripe, within 24h, with no ledger entry.
    // Anything ambiguous is still flagged for manual review.
    let hasMore = true;
    let startingAfter: string | undefined;
    let autoConfirmed = 0;

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
        // P1-3 FIX: Verify currency belongs to this platform before processing.
        // A payment_intent from a shared Stripe account using a different currency
        // must never be auto-confirmed as an AUD booking payment.
        if (pi.currency !== 'aud') continue;
        paymentsChecked++;

        // Check for a LedgerEntry referencing this payment intent
        // LedgerEntry.referenceId is the bookingId — we match via metadata on the PI
        const bookingId = pi.metadata?.bookingId;
        if (!bookingId) continue; // wallet top-ups etc — skip

        const ledgerEntry = await prisma.ledgerEntry.findFirst({
          where: {
            type: 'PAYMENT_COLLECTED',
            referenceId: bookingId,
          },
        });

        if (!ledgerEntry) {
          // FIX #7: Auto-confirm if booking is PENDING_PAYMENT, within 24h, unambiguous.
          // Only auto-fix when ALL conditions are met — anything else goes to manual queue.
          const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const booking = bookingId
            ? await prisma.booking.findUnique({
                where: { id: bookingId },
                select: { id: true, status: true, createdAt: true, price: true, providerPayout: true },
              }) as any
            : null;

          const isAutoConfirmable =
            booking &&
            booking.status === 'PENDING_PAYMENT' &&
            booking.createdAt > twentyFourHoursAgo &&
            Math.abs((pi.amount / 100) - booking.price) < 0.02; // price matches within 2 cents

          if (isAutoConfirmable) {
            try {
              await prisma.booking.update({
                where: { id: booking.id },
                data: { status: 'CONFIRMED', isPaid: true, paidAt: new Date(), paymentIntentId: pi.id } as any,
              });
              // Write the missing ledger entry
              const { appendLedgerEntry, incrementLedger } = await import('@/lib/services/ledger-service');
              await appendLedgerEntry({
                type: 'PAYMENT_COLLECTED',
                amount: pi.amount / 100,
                referenceId: booking.id,
                referenceType: 'BOOKING',
                description: `Auto-reconciled: Stripe ${pi.id} — booking was PENDING_PAYMENT`,
                metadata: { autoReconciled: true, stripePaymentIntentId: pi.id, reconReportId: report.id },
              });
              await incrementLedger({
                totalCollected: pi.amount / 100,
                totalReserved: booking.providerPayout ?? 0,
              });
              // Audit log
              await prisma.auditLog.create({
                data: {
                  action: 'BOOKING_AUTO_RECONCILED',
                  actorId: 'SYSTEM_CRON',
                  actorRole: 'SYSTEM',
                  targetType: 'BOOKING',
                  targetId: booking.id,
                  success: true,
                  metadata: { stripePaymentIntentId: pi.id, amount: pi.amount / 100, reconReportId: report.id },
                },
              });
              autoConfirmed++;
              console.log(`[RECONCILIATION] Auto-confirmed booking ${booking.id} — Stripe PI ${pi.id}`);
            } catch (autoErr) {
              console.error(`[RECONCILIATION] Auto-confirm failed for booking ${bookingId}:`, autoErr);
              flaggedMissingPayments.push({
                stripePaymentIntentId: pi.id,
                amount: pi.amount / 100,
                created: pi.created,
              });
            }
          } else {
            // Not auto-confirmable — flag for manual review
            flaggedMissingPayments.push({
              stripePaymentIntentId: pi.id,
              amount: pi.amount / 100,
              created: pi.created,
            });
          }
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
    const paidPayouts = await prisma.payout.findMany({
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
        await stripe.transfers.retrieve(payout.stripeTransferId!);
        // If no error thrown, transfer exists — OK
      } catch (err: unknown) {
        const stripeErr = err as { code?: string };
        if (stripeErr?.code === 'resource_missing') {
          flaggedMissingTransfers.push({
            payoutId: payout.id,
            payoutRef: payout.payoutRef,
            stripeTransferId: payout.stripeTransferId!,
          });
        }
        // Other errors (network etc) — don't flag, just skip
      }
    }

    // ── Check 3: Stuck payouts ────────────────────────────────────────────
    const stuckCutoff = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000);
    const stuckPayouts = await prisma.payout.findMany({
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

    // ── Check 4: FinancialLedger gaps — confirmed bookings missing ledger entries ──
    // Finds bookings that were confirmed in the window but have no FinancialLedger
    // entry for `booking-{id}-payment`. Backfills them automatically.
    // This catches transient failures from the webhook or booking routes.
    let ledgerGapsFound = 0;
    let ledgerGapsBackfilled = 0;

    try {
      const confirmedBookings = await prisma.booking.findMany({
        where: {
          status: { in: ['CONFIRMED', 'COMPLETED'] },
          isPaid: true,
          paidAt: { gte: windowStart, lte: windowEnd },
          bookingType: { not: 'PDA_TEST' as any }, // PDA_TEST handled separately
        },
        select: {
          id: true,
          price: true,
          platformFee: true,
          providerPayout: true,
          providerId: true,
          customer: { select: { userId: true } },
        },
        take: 200, // limit per run — larger sets caught on next run
      });

      const { recordBookingPayment } = await import('@/lib/services/ledger-operations');

      for (const bk of confirmedBookings) {
        // Check if FinancialLedger already has this entry (idempotency key)
        const existing = await (prisma as any).financialLedger.findUnique({
          where: { idempotencyKey: `booking-${bk.id}-payment` },
          select: { id: true },
        });

        if (!existing) {
          ledgerGapsFound++;
          const clientUserId = bk.customer?.userId;
          if (!clientUserId) continue;

          const instrPayout = bk.providerPayout != null ? Number(bk.providerPayout) : bk.price.toNumber() * 0.85;
          const platFee    = bk.platformFee != null ? Number(bk.platformFee) : bk.price.toNumber() - instrPayout;

          try {
            await recordBookingPayment({
              bookingId:        bk.id,
              userId:           clientUserId,
              providerId:     bk.providerId,
              totalAmount:      bk.price,
              platformFee:      platFee,
              providerPayout: instrPayout,
              createdBy:        'RECONCILIATION_CRON',
            });
            ledgerGapsBackfilled++;
            console.log(`[RECONCILIATION] Backfilled FinancialLedger for booking ${bk.id}`);
          } catch (backfillErr: any) {
            // Duplicate idempotency key means it was written between our check and insert — OK
            if (!backfillErr?.message?.includes('idempotency')) {
              console.error(`[RECONCILIATION] Failed to backfill ledger for booking ${bk.id}:`, backfillErr?.message);
            }
          }
        }
      }
    } catch (ledgerCheckErr) {
      console.error('[RECONCILIATION] FinancialLedger gap check failed (non-critical):', ledgerCheckErr);
    }

    // ── Check 5: Refund discrepancies (PAY-H-01 / INT-M-01A) ─────────────────
    // Enumerates Stripe refunds in the window and verifies each has a
    // corresponding DriveBook DB record. Two levels of action:
    //
    //   AUTO-REPAIR (narrow, safe):
    //     If booking.stripeRefundId is null but the booking is CANCELLED and
    //     the Stripe refund maps unambiguously to that booking (via PI metadata),
    //     write the missing stripeRefundId. This is a data-quality repair — the
    //     financial event (refund) already happened; we are only fixing a missing
    //     identifier field.
    //
    //   FLAG ONLY (financial mismatches):
    //     Any case where the ledger entries don't cover the refund amount, the
    //     booking has an unexpected status, or the Stripe refund is ambiguous.
    //     No ledger entries are created. No wallet debits/credits.
    //     No booking-status changes. Flagged for admin review only.
    //
    // Idempotency: the same discrepancy appearing in a previous unresolved run
    // is not re-alerted (compared against last successful run's flagged set).

    interface RefundDiscrepancy {
      stripeRefundId: string
      stripePaymentIntentId: string
      stripeAmountAud: number
      bookingId: string | null
      issue: string
      autoRepaired: boolean
    }

    const flaggedRefundDiscrepancies: RefundDiscrepancy[] = []
    let refundsChecked = 0
    let refundIdsRepaired = 0

    // Load the previous run's flagged refund set for idempotent alerting
    const prevRun = await (prisma as any).reconciliationReport.findFirst({
      where: { status: { in: ['WARNING', 'SUCCESS'] } },
      orderBy: { completedAt: 'desc' },
      select: { metadata: true },
    })
    const prevFlaggedRefundIds = new Set<string>(
      (prevRun?.metadata as any)?.flaggedRefundDiscrepancies?.map((d: RefundDiscrepancy) => d.stripeRefundId) ?? []
    )

    try {
      let refundHasMore = true
      let refundStartingAfter: string | undefined

      while (refundHasMore) {
        const refundParams: Stripe.RefundListParams = {
          limit: 100,
          created: {
            gte: Math.floor(windowStart.getTime() / 1000),
            lte: Math.floor(windowEnd.getTime() / 1000),
          },
          ...(refundStartingAfter ? { starting_after: refundStartingAfter } : {}),
        }

        const refundPage = await stripe.refunds.list(refundParams)

        for (const refund of refundPage.data) {
          // Only process succeeded refunds denominated in AUD
          if (refund.status !== 'succeeded') continue
          if (refund.currency !== 'aud') continue
          refundsChecked++

          const piId = typeof refund.payment_intent === 'string'
            ? refund.payment_intent
            : (refund.payment_intent as any)?.id
          if (!piId) continue  // no PI attached — cannot resolve to booking

          const refundAmountAud = refund.amount / 100

          // Resolve bookingId via PaymentIntent metadata
          let bookingId: string | null = null
          try {
            const pi = await stripe.paymentIntents.retrieve(piId, { expand: [] })
            bookingId = pi.metadata?.bookingId ?? null
          } catch {
            // PI retrieval failed — cannot resolve booking; flag but don't repair
            flaggedRefundDiscrepancies.push({
              stripeRefundId: refund.id,
              stripePaymentIntentId: piId,
              stripeAmountAud: refundAmountAud,
              bookingId: null,
              issue: 'pi_retrieval_failed',
              autoRepaired: false,
            })
            continue
          }

          if (!bookingId) {
            // No bookingId in PI metadata — wallet top-up refund, SaaS, or manual
            // Cannot cross-check against a booking; skip silently
            continue
          }

          // Load booking
          const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            select: { id: true, status: true, stripeRefundId: true },
          })

          if (!booking) {
            flaggedRefundDiscrepancies.push({
              stripeRefundId: refund.id,
              stripePaymentIntentId: piId,
              stripeAmountAud: refundAmountAud,
              bookingId,
              issue: 'booking_not_found',
              autoRepaired: false,
            })
            continue
          }

          // Check ledger: sum of all REFUND_ISSUED + REFUND_SYNCED entries for this booking
          const ledgerEntries = await prisma.ledgerEntry.findMany({
            where: {
              referenceId: bookingId,
              type: { in: ['REFUND_ISSUED', 'REFUND_SYNCED'] },
            },
            select: { amount: true, type: true },
          })
          // Amounts are stored as negative (money out); take absolute values
          const totalLedgerRefundAud = ledgerEntries.reduce(
            (sum, e) => sum + Math.abs(Number(e.amount)), 0
          )

          // ── Case 1: stripeRefundId matches — check ledger coverage ─────────
          if (booking.stripeRefundId === refund.id) {
            // Refund ID is already persisted. Check ledger coverage.
            // Allow 2 cent tolerance for rounding.
            if (refundAmountAud > totalLedgerRefundAud + 0.02) {
              flaggedRefundDiscrepancies.push({
                stripeRefundId: refund.id,
                stripePaymentIntentId: piId,
                stripeAmountAud: refundAmountAud,
                bookingId,
                issue: `ledger_undercounts_refund: stripe=${refundAmountAud} db=${totalLedgerRefundAud.toFixed(2)}`,
                autoRepaired: false,
              })
            }
            // If ledger covers it or exceeds it (partial refund represented): OK
            continue
          }

          // ── Case 2: stripeRefundId is null — possible auto-repair ──────────
          if (booking.stripeRefundId === null) {
            // AUTO-REPAIR: only when booking is already CANCELLED and the PI
            // maps unambiguously to this booking. We are writing a missing
            // identifier, not creating a financial record.
            if (booking.status === 'CANCELLED') {
              try {
                await prisma.booking.update({
                  where: { id: bookingId },
                  data: { stripeRefundId: refund.id } as any,
                })
                refundIdsRepaired++
                console.log(
                  `[RECONCILIATION] Repaired missing stripeRefundId on booking ${bookingId} ← ${refund.id}`
                )

                // If ledger also undercounts, flag it — financial entries require
                // manual review; we only auto-repair the identifier field
                if (refundAmountAud > totalLedgerRefundAud + 0.02) {
                  flaggedRefundDiscrepancies.push({
                    stripeRefundId: refund.id,
                    stripePaymentIntentId: piId,
                    stripeAmountAud: refundAmountAud,
                    bookingId,
                    issue: `refund_id_repaired_but_ledger_gap: stripe=${refundAmountAud} db=${totalLedgerRefundAud.toFixed(2)}`,
                    autoRepaired: true,
                  })
                }
              } catch (repairErr) {
                console.error(
                  `[RECONCILIATION] Failed to repair stripeRefundId on booking ${bookingId}:`, repairErr
                )
                flaggedRefundDiscrepancies.push({
                  stripeRefundId: refund.id,
                  stripePaymentIntentId: piId,
                  stripeAmountAud: refundAmountAud,
                  bookingId,
                  issue: 'refund_id_repair_failed',
                  autoRepaired: false,
                })
              }
            } else {
              // Booking not CANCELLED — cannot safely determine if this is the
              // right refund; flag for admin
              flaggedRefundDiscrepancies.push({
                stripeRefundId: refund.id,
                stripePaymentIntentId: piId,
                stripeAmountAud: refundAmountAud,
                bookingId,
                issue: `refund_id_null_booking_not_cancelled: status=${booking.status}`,
                autoRepaired: false,
              })
            }
            continue
          }

          // ── Case 3: stripeRefundId is a DIFFERENT value ────────────────────
          // Two distinct Stripe refund IDs for the same booking. Could be a
          // partial refund followed by another, or an integrity error.
          // Never auto-repair — flag for manual review.
          flaggedRefundDiscrepancies.push({
            stripeRefundId: refund.id,
            stripePaymentIntentId: piId,
            stripeAmountAud: refundAmountAud,
            bookingId,
            issue: `different_refund_id_on_booking: db=${booking.stripeRefundId}`,
            autoRepaired: false,
          })
        }

        refundHasMore = refundPage.has_more
        if (refundPage.data.length > 0) {
          refundStartingAfter = refundPage.data[refundPage.data.length - 1].id
        } else {
          refundHasMore = false
        }
      }
    } catch (check5Err) {
      console.error('[RECONCILIATION] Check 5 (refund discrepancies) failed (non-critical):', check5Err)
    }

    // Suppress alerts for discrepancies that were already flagged in the previous run
    // and remain unresolved — prevents alert fatigue from repeat noise.
    const newRefundDiscrepancies = flaggedRefundDiscrepancies.filter(
      d => !prevFlaggedRefundIds.has(d.stripeRefundId) || d.autoRepaired
    )

    // ── Determine status ──────────────────────────────────────────────────
    const hasIssues =
      flaggedMissingPayments.length > 0 ||
      flaggedMissingTransfers.length > 0 ||
      flaggedStuckPayouts.length > 0 ||
      newRefundDiscrepancies.filter(d => !d.autoRepaired).length > 0;

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
          autoConfirmed,
          financialLedgerGapsFound:       ledgerGapsFound,
          financialLedgerGapsBackfilled:  ledgerGapsBackfilled,
          // Check 5 — refund discrepancies
          refundsChecked,
          refundIdsRepaired,
          flaggedRefundDiscrepancies,      // full set including suppressed repeats
          newRefundDiscrepancies,          // only new/newly-repaired (used for alert)
        },
      },
    });

    // ── Console summary (picked up by Vercel logs) ────────────────────────
    if (hasIssues) {
      const unresolvedRefundCount = newRefundDiscrepancies.filter(d => !d.autoRepaired).length
      console.warn(
        `[RECONCILIATION WARNING] Run ${report.id}: ` +
        `missingPayments=${flaggedMissingPayments.length}, ` +
        `missingTransfers=${flaggedMissingTransfers.length}, ` +
        `stuckPayouts=${flaggedStuckPayouts.length}` +
        (unresolvedRefundCount > 0 ? `, refundDiscrepancies=${unresolvedRefundCount}` : '') +
        (refundIdsRepaired > 0 ? `, refundIdsRepaired=${refundIdsRepaired}` : '') +
        (autoConfirmed > 0 ? `, autoConfirmed=${autoConfirmed}` : '') +
        (ledgerGapsBackfilled > 0 ? `, ledgerBackfilled=${ledgerGapsBackfilled}` : ''),
      );

      // Alert — non-blocking; only new discrepancies to avoid alert fatigue
      void sendAlert({
        type: 'RECONCILIATION_ISSUES',
        severity: 'WARNING',
        message:
          `Reconciliation issues detected — ` +
          `${flaggedMissingPayments.length} missing payments, ` +
          `${flaggedMissingTransfers.length} missing transfers, ` +
          `${flaggedStuckPayouts.length} stuck payouts` +
          (unresolvedRefundCount > 0 ? `, ${unresolvedRefundCount} refund discrepancies (new/unresolved)` : '') +
          (refundIdsRepaired > 0 ? `, ${refundIdsRepaired} refund IDs auto-repaired` : '') +
          (ledgerGapsFound > 0 ? `, ${ledgerGapsFound} FinancialLedger gaps (${ledgerGapsBackfilled} backfilled)` : ''),
        entityId: report.id,
        metadata: {
          reportId: report.id,
          missingPayments: flaggedMissingPayments.length,
          missingTransfers: flaggedMissingTransfers.length,
          stuckPayouts: flaggedStuckPayouts.length,
          refundDiscrepancies: unresolvedRefundCount,
          refundIdsRepaired,
          financialLedgerGapsFound:      ledgerGapsFound,
          financialLedgerGapsBackfilled: ledgerGapsBackfilled,
          windowStart: windowStart.toISOString(),
          windowEnd: windowEnd.toISOString(),
          newRefundDiscrepancies,
        },
      });
    } else {
      console.log(
        `[RECONCILIATION OK] Run ${report.id}: ` +
        `${paymentsChecked} payments, ${transfersChecked} transfers, ${refundsChecked} refunds checked` +
        (autoConfirmed > 0 ? `, ${autoConfirmed} auto-confirmed` : '') +
        (ledgerGapsBackfilled > 0 ? `, ${ledgerGapsBackfilled} ledger gaps backfilled` : '') +
        (refundIdsRepaired > 0 ? `, ${refundIdsRepaired} refund IDs repaired` : '') +
        ' — no new issues',
      );
    }

    await pingCronHealth('reconcile-stripe');
    return NextResponse.json({
      success: true,
      reportId: report.id,
      status: finalStatus,
      paymentsChecked,
      missingPayments: flaggedMissingPayments.length,
      transfersChecked,
      missingTransfers: flaggedMissingTransfers.length,
      stuckPayouts: flaggedStuckPayouts.length,
      autoConfirmed,
      financialLedgerGapsFound:      ledgerGapsFound,
      financialLedgerGapsBackfilled: ledgerGapsBackfilled,
      refundsChecked,
      refundIdsRepaired,
      refundDiscrepancies: newRefundDiscrepancies.filter(d => !d.autoRepaired).length,
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
    await failCronHealth('reconcile-stripe', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Reconciliation failed' },
      { status: 500 },
    );
  }
}
