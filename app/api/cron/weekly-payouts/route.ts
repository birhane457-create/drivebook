/**
 * Cron: Automatic Weekly Payout Run
 *
 * Runs every Tuesday at 2:00 AM AWST (6:00 PM Monday UTC).
 * Processes all eligible instructors who have completed Stripe Connect onboarding.
 * Instructors without a connected account are skipped — they receive a reminder email.
 *
 * Eligibility rules (enforced by buildPayout + this cron):
 *   ✅ payoutMethod = 'stripe_connect'
 *   ✅ stripeAccountId is set
 *   ✅ chargesEnabled = true  (Stripe has verified the account)
 *   ✅ payoutsEnabled = true  (bank account linked, Stripe approved)
 *   ✅ payoutHold = false     (no open dispute freeze)
 *   ✅ lesson ended > 48 hours ago (dispute buffer)
 *   ✅ ABN verified (or no ABN — 47% withholding applies)
 *
 * Bank transfer fallback instructors are NOT processed here — admin handles those
 * manually via the payouts admin page after confirming bank details.
 *
 * Batching:
 *   PAYOUT_BATCH_SIZE env var (default 20) limits instructors processed per invocation.
 *   This prevents Vercel function timeouts on large datasets. Instructors beyond
 *   the batch cap are left for the next weekly run — they are not lost, just deferred
 *   by one week. Increase PAYOUT_BATCH_SIZE as instructor numbers grow.
 *
 * Auth: Bearer CRON_SECRET
 * Schedule: "0 18 * * 1" (Monday 6pm UTC = Tuesday 2am AWST)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { executeInstructorPayout } from '@/lib/services/payout-service';
import { emailService } from '@/lib/services/email';
import { sendAlert } from '@/lib/services/alert-service';
import { pingCronHealth, failCronHealth } from '@/lib/services/cron-health';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const runStarted = new Date();

  // Dispute buffer: read from PlatformSettings (lateCancellationWindowHours * 2).
  // Default: 48 hours — lessons must have ended at least this long ago before
  // the instructor payout is eligible, giving time for dispute windows to close.
  const settings = await prisma.platformSettings.findFirst({
    select: { lateCancellationWindowHours: true },
  }).catch(() => null);
  const DISPUTE_BUFFER_HOURS = (settings?.lateCancellationWindowHours ?? 24) * 2;

  const bufferCutoff = new Date(Date.now() - DISPUTE_BUFFER_HOURS * 60 * 60 * 1000);

  // Batch size — default 20, configurable via env var.
  // Keeps each Vercel function invocation well under the 60s timeout.
  const BATCH_SIZE = Math.max(1, parseInt(process.env.PAYOUT_BATCH_SIZE || '20', 10));

  console.log(`[WEEKLY PAYOUTS] Run started at ${runStarted.toISOString()} — buffer cutoff: ${bufferCutoff.toISOString()} — batchSize: ${BATCH_SIZE}`);

  try {
    // ── Find all instructors with eligible transactions ────────────────────
    const eligibleTxs = await prisma.transaction.findMany({
      where: {
        status: 'SETTLED',
        type: 'BOOKING_PAYMENT',
        booking: {
          status: { in: ['CONFIRMED', 'COMPLETED'] },
          endTime: { lte: bufferCutoff },
          deletedAt: null,
        },
      },
      select: { instructorId: true },
      distinct: ['instructorId'],
    });

    if (!eligibleTxs.length) {
      console.log('[WEEKLY PAYOUTS] No eligible transactions — nothing to do');
      await pingCronHealth('weekly-payouts');
      return NextResponse.json({ success: true, processed: 0, skipped: 0, failed: 0, message: 'No eligible transactions' });
    }

    const instructorIds = eligibleTxs.map((t) => t.instructorId);

    // Apply batch cap — process at most BATCH_SIZE instructors per run.
    // Instructors beyond the cap are deferred to the next weekly invocation.
    const totalEligible = instructorIds.length;
    const batchedInstructorIds = instructorIds.slice(0, BATCH_SIZE);
    const deferredCount = totalEligible - batchedInstructorIds.length;

    if (deferredCount > 0) {
      console.log(`[WEEKLY PAYOUTS] Batch cap applied — processing ${batchedInstructorIds.length} of ${totalEligible} eligible instructors. ${deferredCount} deferred to next run.`);
    }

    // Load instructor state for batched set in one query
    const instructors = await prisma.instructor.findMany({
      where: { id: { in: batchedInstructorIds } },
      select: {
        id: true,
        name: true,
        payoutMethod: true,
        stripeAccountId: true,
        chargesEnabled: true,
        payoutsEnabled: true,
        payoutHold: true,
        abn: true,
        abnVerified: true,
        abnStatus: true,
        user: { select: { email: true } },
      },
    } as any);

    const instructorMap = new Map(instructors.map((i: any) => [i.id, i]));

    const results: {
      instructorId: string;
      status: 'PAID' | 'PENDING_TRANSFER' | 'FAILED' | 'SKIPPED';
      reason?: string;
      payoutRef?: string;
      netAmount?: number;
    }[] = [];

    const notOnboardedInstructors: any[] = [];

    for (const { instructorId } of eligibleTxs.filter(t => batchedInstructorIds.includes(t.instructorId))) {
      const inst = instructorMap.get(instructorId) as any;

      // ── Skip checks ───────────────────────────────────────────────────────

      // Dispute hold
      if (inst?.payoutHold) {
        results.push({ instructorId, status: 'SKIPPED', reason: 'payout_hold_open_dispute' });
        continue;
      }

      // ABN on file but not verified — block payout (47% withholding rule)
      if (inst?.abn && !inst.abnVerified) {
        results.push({ instructorId, status: 'SKIPPED', reason: `abn_not_verified (status: ${inst.abnStatus ?? 'PENDING'})` });
        continue;
      }

      // Bank transfer / manual — skip from automatic run, admin handles these
      if (inst?.payoutMethod !== 'stripe_connect') {
        results.push({ instructorId, status: 'SKIPPED', reason: `manual_payout_method (${inst?.payoutMethod ?? 'unknown'})` });
        continue;
      }

      // Stripe Connect not set up
      if (!inst?.stripeAccountId) {
        results.push({ instructorId, status: 'SKIPPED', reason: 'stripe_connect_not_started' });
        notOnboardedInstructors.push(inst);
        continue;
      }

      // Connect onboarding incomplete
      if (!inst?.chargesEnabled || !inst?.payoutsEnabled) {
        results.push({
          instructorId,
          status: 'SKIPPED',
          reason: `connect_onboarding_incomplete (chargesEnabled=${inst?.chargesEnabled}, payoutsEnabled=${inst?.payoutsEnabled})`,
        });
        notOnboardedInstructors.push(inst);
        continue;
      }

      // ── Attempt payout ────────────────────────────────────────────────────
      try {
        // Use 'SYSTEM_CRON' as the actorId — all payout audit logs will show automated origin
        const result = await executeInstructorPayout(instructorId, 'SYSTEM_CRON');
        results.push({
          instructorId,
          status: result.status as any,
          payoutRef: result.payoutRef,
          netAmount: result.netAmount,
          reason: result.failureReason,
        });
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        results.push({ instructorId, status: 'FAILED', reason });
        console.error(`[WEEKLY PAYOUTS] Failed for instructor ${instructorId}:`, reason);
      }
    }

    // ── Summary ───────────────────────────────────────────────────────────
    const paid    = results.filter((r) => r.status === 'PAID').length;
    const pending = results.filter((r) => r.status === 'PENDING_TRANSFER').length;
    const failed  = results.filter((r) => r.status === 'FAILED').length;
    const skipped = results.filter((r) => r.status === 'SKIPPED').length;

    const totalPaid = results
      .filter((r) => r.status === 'PAID')
      .reduce((s, r) => s + (r.netAmount ?? 0), 0);

    console.log(
      `[WEEKLY PAYOUTS] Complete — paid: ${paid} ($${totalPaid.toFixed(2)}), ` +
      `pending: ${pending}, failed: ${failed}, skipped: ${skipped}, ` +
      `deferred: ${deferredCount} (batch cap: ${BATCH_SIZE})`
    );

    // Alert on failures
    if (failed > 0) {
      const failedList = results
        .filter((r) => r.status === 'FAILED')
        .map((r) => `${r.instructorId}: ${r.reason}`)
        .join('\n');

      void sendAlert({
        type: 'PAYOUT_FAILED',
        severity: 'CRITICAL',
        message: `Weekly payout run: ${failed} payout(s) failed\n${failedList}`,
        entityId: 'weekly-payout-cron',
        metadata: { failed, paid, skipped, deferred: deferredCount, batchSize: BATCH_SIZE, runStarted: runStarted.toISOString() },
      });
    }

    // Alert if batch cap was hit — admin should consider increasing PAYOUT_BATCH_SIZE
    if (deferredCount > 0) {
      void sendAlert({
        type: 'RECONCILIATION_ISSUES',
        severity: 'WARNING',
        message: `Weekly payout batch cap reached — ${deferredCount} instructor(s) deferred to next run. Increase PAYOUT_BATCH_SIZE (currently ${BATCH_SIZE}) if this recurs.`,
        entityId: 'weekly-payout-cron',
        metadata: { totalEligible, batchSize: BATCH_SIZE, deferredCount, runStarted: runStarted.toISOString() },
      });
    }

    // ── Remind incomplete-onboarding instructors ──────────────────────────
    // Only once per week (this cron runs weekly) — no spam risk
    for (const inst of notOnboardedInstructors) {
      if (!inst?.user?.email) continue;
      try {
        await emailService.sendGenericEmail({
          to: inst.user.email,
          subject: 'Action required: Connect your bank account to receive your DriveBook earnings',
          html: `
            <!DOCTYPE html>
            <html>
            <body style="font-family:Arial,sans-serif;color:#1f2937;max-width:560px;margin:0 auto;padding:20px;">
              <div style="background:linear-gradient(135deg,#1d4ed8,#2563eb);color:white;padding:24px;border-radius:12px 12px 0 0;">
                <h1 style="margin:0;font-size:20px;">💳 Your earnings are ready</h1>
              </div>
              <div style="background:#f9fafb;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none;">
                <p>Hi ${inst.name},</p>
                <p>
                  You have earnings ready to be paid out, but your Stripe payout account isn't fully set up yet.
                  Once you complete the setup, your earnings will be paid automatically every Tuesday.
                </p>
                <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:20px 0;">
                  <p style="margin:0 0 8px;font-weight:600;color:#1f2937;">What you need to do:</p>
                  <ol style="margin:0;padding-left:20px;color:#374151;font-size:14px;">
                    <li style="margin-bottom:8px;">Go to <strong>Dashboard → Settings → Payout Settings</strong></li>
                    <li style="margin-bottom:8px;">Click <strong>Connect with Stripe</strong></li>
                    <li>Follow the steps to link your Australian bank account</li>
                  </ol>
                </div>
                <div style="text-align:center;margin:24px 0;">
                  <a href="${process.env.NEXTAUTH_URL}/dashboard/settings/payout"
                     style="background:#2563eb;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
                    Set up payout account →
                  </a>
                </div>
                <p style="font-size:13px;color:#6b7280;">
                  Stripe handles your bank details directly — DriveBook never stores your account number or BSB.
                  The setup takes about 5 minutes.
                </p>
                <p style="font-size:13px;color:#6b7280;">
                  Questions? Contact us at
                  <a href="mailto:${process.env.ADMIN_EMAIL || 'support@drivebook.com.au'}" style="color:#2563eb;">
                    ${process.env.ADMIN_EMAIL || 'support@drivebook.com.au'}
                  </a>
                </p>
              </div>
            </body>
            </html>
          `,
        });
      } catch (emailErr) {
        console.error(`[WEEKLY PAYOUTS] Onboarding reminder email failed for ${inst.id}:`, emailErr);
      }
    }

    await pingCronHealth('weekly-payouts');

    return NextResponse.json({
      success: true,
      runStarted: runStarted.toISOString(),
      batchSize: BATCH_SIZE,
      totalEligible,
      processed: batchedInstructorIds.length,
      deferred: deferredCount,
      paid,
      totalPaidAmount: totalPaid,
      pending,
      failed,
      skipped,
      notOnboarded: notOnboardedInstructors.length,
      results,
    });
  } catch (error) {
    console.error('[WEEKLY PAYOUTS] Cron error:', error);
    await failCronHealth('weekly-payouts', error);
    void sendAlert({
      type: 'PAYOUT_FAILED',
      severity: 'CRITICAL',
      message: `Weekly payout cron crashed: ${error instanceof Error ? error.message : String(error)}`,
      entityId: 'weekly-payout-cron',
    });
    return NextResponse.json({ error: 'Weekly payout run failed' }, { status: 500 });
  }
}
