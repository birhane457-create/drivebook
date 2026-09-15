import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { pingCronHealth, failCronHealth } from '@/lib/services/cron-health';

export const dynamic = 'force-dynamic';

/**
 * Trial Expiry Check Cron Job
 *
 * Purpose: Mark TRIAL subscriptions as EXPIRED when trialEndsAt date passes
 * Schedule: Daily (via external cron or internal interval)
 * Behavior:
 *   - Find all subscriptions: status='TRIAL' AND trialEndsAt < now
 *   - Update subscription: status='EXPIRED'
 *   - Update instructor: subscriptionTier='BASIC' (revert to free tier)
 *   - Create audit log
 *   - Return count of subscriptions expired
 */

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  // ── Auth: CRON_SECRET Bearer token (external) or Vercel Cron header ──────
  const authHeader = req.headers.get('authorization');
  const isVercelCron = req.headers.get('x-vercel-cron') === '1';
  const hasCronSecret = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!isVercelCron && !hasCronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();

    // Find all expired trials
    const expiredTrials = await prisma.subscription.findMany({
      where: {
        status: 'TRIAL',
        trialEndsAt: { lt: now },
      },
      include: {
        provider: {
          select: { id: true, name: true, userId: true },
        },
      },
    });

    if (expiredTrials.length === 0) {
      await pingCronHealth('check-trial-expiry');
      return NextResponse.json({
        success: true,
        count: 0,
        message: 'No expired trials to process',
        duration: `${Date.now() - startTime}ms`,
      });
    }

    // Mark each trial as expired and revert instructor to BASIC tier
    const updated: any[] = [];
    const skipped: string[] = [];
    const auditLogs: any[] = [];

    for (const trial of expiredTrials) {
      try {
        // SUB-12-A FIX: Use updateMany with a status condition INSIDE the transaction.
        // This makes the expiry conditional/atomic: if a concurrent webhook already
        // converted this trial to ACTIVE (paid conversion), the updateMany matches
        // 0 rows and we skip the provider update entirely — no overwrite occurs.
        const result = await prisma.$transaction(async (tx) => {
          const expireResult = await tx.subscription.updateMany({
            where: {
              id: trial.id,
              status: 'TRIAL',          // Atomic guard: only expire if still TRIAL
              trialEndsAt: { lt: now }, // Re-confirm expiry inside transaction
            },
            data: { status: 'EXPIRED' },
          });

          if (expireResult.count === 0) {
            // Row was already converted to ACTIVE/PAST_DUE by a concurrent webhook,
            // or another cron invocation already expired it. Do not touch provider.
            return null;
          }

          // Subscription was still TRIAL — safe to revert provider to BASIC.
          const updatedInstructor = await tx.provider.update({
            where: { id: trial.providerId },
            data: {
              subscriptionTier: 'BASIC',
              subscriptionStatus: 'EXPIRED',
            },
          });

          return { updatedSub: { id: trial.id, status: 'EXPIRED' }, updatedInstructor };
        });

        if (result === null) {
          // Skipped — subscription was already converted or previously expired.
          skipped.push(trial.id);
          continue;
        }

        updated.push(result);

        // Create audit log
        try {
          await prisma.auditLog.create({
            data: {
              action: 'SUBSCRIPTION_TRIAL_EXPIRED',
              actorId: 'SYSTEM',
              actorRole: 'SYSTEM',
              targetType: 'SUBSCRIPTION',
              targetId: trial.id,
              success: true,
              metadata: {
                providerId: trial.providerId,
                instructorName: trial.provider.name,
                subscriptionId: trial.id,
                previousTier: trial.tier,
                newTier: 'BASIC',
                trialEndsAt: trial.trialEndsAt,
                expiredAt: now,
              } as any,
            },
          });
        } catch (auditErr) {
          console.error(`Failed to create audit log for subscription ${trial.id}:`, auditErr);
        }
      } catch (updateErr) {
        console.error(`Failed to expire trial ${trial.id}:`, updateErr);
      }
    }

    await pingCronHealth('check-trial-expiry');

    return NextResponse.json({
      success: true,
      count: updated.length,
      skipped: skipped.length,
      message: `Expired ${updated.length} trial subscription(s)${skipped.length > 0 ? `, skipped ${skipped.length} already-converted` : ''}`,
      details: updated.map((u) => ({
        subscriptionId: u.updatedSub.id,
        providerId: u.updatedInstructor.id,
        instructorName: u.updatedInstructor.name,
      })),
      skippedIds: skipped,
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error('Trial expiry check failed:', error);
    await failCronHealth('check-trial-expiry', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${Date.now() - startTime}ms`,
      },
      { status: 500 }
    );
  }
}
