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
        instructor: {
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
    const auditLogs: any[] = [];

    for (const trial of expiredTrials) {
      try {
        // Atomically update subscription and instructor in transaction
        const result = await prisma.$transaction(async (tx) => {
          // Update subscription status
          const updatedSub = await tx.subscription.update({
            where: { id: trial.id },
            data: { status: 'EXPIRED' },
          });

          // Revert instructor to BASIC tier
          const updatedInstructor = await tx.instructor.update({
            where: { id: trial.instructorId },
            data: {
              subscriptionTier: 'BASIC',
              subscriptionStatus: 'EXPIRED',
            },
          });

          return { updatedSub, updatedInstructor };
        });

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
                instructorId: trial.instructorId,
                instructorName: trial.instructor.name,
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
      message: `Expired ${updated.length} trial subscription(s)`,
      details: updated.map((u) => ({
        subscriptionId: u.updatedSub.id,
        instructorId: u.updatedInstructor.id,
        instructorName: u.updatedInstructor.name,
      })),
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
