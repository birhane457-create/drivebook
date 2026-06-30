import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services/email';
import { pingCronHealth, failCronHealth } from '@/lib/services/cron-health';
import { SUBSCRIPTION_PLANS, SubscriptionTier } from '@/lib/config/subscriptions';

export const dynamic = 'force-dynamic';

/**
 * Trial Expiry Alerts Cron Job
 *
 * Purpose: Send trial expiry notifications to instructors
 * Schedule: Daily at 2am UTC (after check-trial-expiry at 1am UTC)
 *
 * Emails sent (all pricing pulled from SUBSCRIPTION_PLANS config â€” never hardcoded):
 *   - 7 days before trial ends  â†’ one-time warning (TRIAL_WARNING_EMAIL_SENT)
 *   - 3 days before trial ends  â†’ one-time reminder (TRIAL_3DAY_WARNING_EMAIL_SENT)
 *   - Within 24h after expiry   â†’ one-time expiry notice (TRIAL_EXPIRED_EMAIL_SENT)
 *
 * Deduplication: AuditLog entries prevent duplicate sends per subscription.
 */

/** Build the plan comparison table rows from config â€” no hardcoded prices */
function buildPlanTableRows(): string {
  const tiers: SubscriptionTier[] = ['BASIC', 'PRO', 'STUDIO', 'BUSINESS'];
  return tiers
    .map((tier, i) => {
      const plan = SUBSCRIPTION_PLANS[tier];
      const bg = i % 2 === 0 ? '#f3f4f6' : '#ffffff';
      const upgradeLabel = tier === 'BASIC' ? 'Select' : 'Upgrade';
      return `
        <tr style="background:${bg};">
          <td style="padding:12px;"><strong>${plan.name}</strong></td>
          <td style="padding:12px;">$${plan.monthlyPrice}/month or $${plan.annualPrice}/year</td>
          <td style="padding:12px;">${plan.commissionRate}% commission</td>
          <td style="padding:12px;">
            <a href="https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'drivebook.com.au'}/dashboard/subscription?tier=${tier}">${upgradeLabel}</a>
          </td>
        </tr>`;
    })
    .join('');
}

/** Build the plan feature list for the warning email */
function buildPlanList(): string {
  const tiers: SubscriptionTier[] = ['PRO', 'STUDIO', 'BUSINESS'];
  return tiers
    .map((tier) => {
      const plan = SUBSCRIPTION_PLANS[tier];
      return `<li><strong>${plan.name} ($${plan.monthlyPrice}/month)</strong> â€” ${plan.commissionRate}% commission</li>`;
    })
    .join('');
}

const BASE_URL = `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'drivebook.com.au'}`;
const SUBSCRIPTION_URL = `${BASE_URL}/dashboard/subscription`;
const HELP_URL = `${BASE_URL}/help`;

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  // â”€â”€ Auth: CRON_SECRET Bearer token (external) or Vercel Cron header â”€â”€â”€â”€â”€â”€
  const authHeader = req.headers.get('authorization');
  const isVercelCron = req.headers.get('x-vercel-cron') === '1';
  const hasCronSecret = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!isVercelCron && !hasCronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    let warningsSent = 0;
    let remindersSent = 0;
    let expiryNotifications = 0;

    // â”€â”€ 1. 7-DAY WARNING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const upcomingExpiries = await prisma.subscription.findMany({
      where: {
        status: 'TRIAL',
        trialEndsAt: { gte: now, lte: sevenDaysFromNow },
      },
      include: {
        instructor: {
          select: { id: true, name: true, user: { select: { email: true } } },
        },
      },
    });

    for (const sub of upcomingExpiries) {
      if (!sub.instructor.user?.email || !sub.trialEndsAt) continue;

      // Dedupe: send once per subscription
      const existing = await prisma.auditLog.findFirst({
        where: { action: 'TRIAL_WARNING_EMAIL_SENT', targetType: 'SUBSCRIPTION', targetId: sub.id },
      });
      if (existing) continue;

      const daysLeft = Math.ceil(
        (new Date(sub.trialEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      const tierName = (sub.tier as SubscriptionTier) in SUBSCRIPTION_PLANS
        ? SUBSCRIPTION_PLANS[sub.tier as SubscriptionTier].name
        : sub.tier || 'your plan';
      const expiryDateStr = new Date(sub.trialEndsAt).toLocaleDateString('en-AU', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Perth',
      });

      try {
        await emailService.sendGenericEmail({
          to: sub.instructor.user.email,
          subject: `Your ${tierName} trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
          html: `
            <h2>Your trial is ending soon</h2>
            <p>Hi ${sub.instructor.name},</p>
            <p>Your <strong>${tierName}</strong> plan trial ends in <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>
            on ${expiryDateStr}.</p>
            <p>To keep accepting bookings and access all your features, choose a paid plan:</p>
            <ul>${buildPlanList()}</ul>
            <p>
              <a href="${SUBSCRIPTION_URL}" style="background-color:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">
                View Plans &amp; Upgrade
              </a>
            </p>
            <p>You can add your payment method now â€” you won't be charged until your trial ends.</p>
            <p>Questions? Visit our <a href="${HELP_URL}">help center</a> or reply to this email.</p>
          `,
        });

        await prisma.auditLog.create({
          data: {
            action: 'TRIAL_WARNING_EMAIL_SENT',
            actorId: 'SYSTEM',
            actorRole: 'SYSTEM',
            targetType: 'SUBSCRIPTION',
            targetId: sub.id,
            success: true,
            metadata: { trialEndsAt: sub.trialEndsAt, daysLeft, sentAt: now.toISOString() } as any,
          },
        });

        warningsSent++;
      } catch (err) {
        console.error(`Failed to send 7-day trial warning to ${sub.instructor.name}:`, err);
      }
    }

    // â”€â”€ 2. 3-DAY REMINDER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const threeDayExpiries = await prisma.subscription.findMany({
      where: {
        status: 'TRIAL',
        trialEndsAt: { gte: now, lte: threeDaysFromNow },
      },
      include: {
        instructor: {
          select: { id: true, name: true, user: { select: { email: true } } },
        },
      },
    });

    for (const sub of threeDayExpiries) {
      if (!sub.instructor.user?.email || !sub.trialEndsAt) continue;

      // Dedupe: send once per subscription
      const existing = await prisma.auditLog.findFirst({
        where: { action: 'TRIAL_3DAY_WARNING_EMAIL_SENT', targetType: 'SUBSCRIPTION', targetId: sub.id },
      });
      if (existing) continue;

      const daysLeft = Math.ceil(
        (new Date(sub.trialEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      const tierName = (sub.tier as SubscriptionTier) in SUBSCRIPTION_PLANS
        ? SUBSCRIPTION_PLANS[sub.tier as SubscriptionTier].name
        : sub.tier || 'your plan';
      const expiryDateStr = new Date(sub.trialEndsAt).toLocaleDateString('en-AU', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Perth',
      });

      try {
        await emailService.sendGenericEmail({
          to: sub.instructor.user.email,
          subject: `â° ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left on your DriveBook trial`,
          html: `
            <h2>Last chance â€” trial ending ${daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`}</h2>
            <p>Hi ${sub.instructor.name},</p>
            <p>Your <strong>${tierName}</strong> trial ends on <strong>${expiryDateStr}</strong>.</p>
            <p>After that, your account will switch to <strong>read-only mode</strong> â€” you won't be able to create new bookings or add students until you subscribe.</p>
            <p>It takes less than 2 minutes to add a payment method. You won't be charged until your trial ends.</p>
            <p>
              <a href="${SUBSCRIPTION_URL}" style="background-color:#dc2626;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">
                Add Payment Method Now
              </a>
            </p>
            <p>Need help choosing a plan? Visit our <a href="${HELP_URL}">help center</a> or reply to this email.</p>
          `,
        });

        await prisma.auditLog.create({
          data: {
            action: 'TRIAL_3DAY_WARNING_EMAIL_SENT',
            actorId: 'SYSTEM',
            actorRole: 'SYSTEM',
            targetType: 'SUBSCRIPTION',
            targetId: sub.id,
            success: true,
            metadata: { trialEndsAt: sub.trialEndsAt, daysLeft, sentAt: now.toISOString() } as any,
          },
        });

        remindersSent++;
      } catch (err) {
        console.error(`Failed to send 3-day trial reminder to ${sub.instructor.name}:`, err);
      }
    }

    // â”€â”€ 3. EXPIRY NOTIFICATION (within 24h after expiry) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const recentlyExpired = await prisma.subscription.findMany({
      where: {
        status: 'EXPIRED',
        trialEndsAt: {
          gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          lte: now,
        },
      },
      include: {
        instructor: {
          select: { id: true, name: true, subscriptionTier: true, user: { select: { email: true } } },
        },
      },
    });

    for (const sub of recentlyExpired) {
      if (!sub.instructor.user?.email || !sub.trialEndsAt) continue;

      // Dedupe: send once per subscription
      const existing = await prisma.auditLog.findFirst({
        where: { action: 'TRIAL_EXPIRED_EMAIL_SENT', targetType: 'SUBSCRIPTION', targetId: sub.id },
      });
      if (existing) continue;

      const expiryDateStr = new Date(sub.trialEndsAt).toLocaleDateString('en-AU', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Perth',
      });

      try {
        await emailService.sendGenericEmail({
          to: sub.instructor.user.email,
          subject: `Your DriveBook trial ended â€” action required to restore access`,
          html: `
            <h2>Your trial has ended</h2>
            <p>Hi ${sub.instructor.name},</p>
            <p>Your free trial ended on <strong>${expiryDateStr}</strong>.</p>
            <p>Your account is now in <strong>read-only mode</strong>. You can still view all your historical data, but:</p>
            <ul>
              <li>âŒ Cannot create new bookings</li>
              <li>âŒ Cannot add students</li>
              <li>âŒ Cannot change settings</li>
            </ul>
            <p><strong>Choose a plan to restore full access:</strong></p>
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="background:#e5e7eb;">
                  <th style="padding:10px;text-align:left;">Plan</th>
                  <th style="padding:10px;text-align:left;">Pricing</th>
                  <th style="padding:10px;text-align:left;">Commission</th>
                  <th style="padding:10px;text-align:left;"></th>
                </tr>
              </thead>
              <tbody>${buildPlanTableRows()}</tbody>
            </table>
            <p style="margin-top:20px;">
              <a href="${SUBSCRIPTION_URL}" style="background-color:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">
                Go to Subscription Settings
              </a>
            </p>
            <p>Need help? Visit our <a href="${HELP_URL}">help center</a> or reply to this email.</p>
          `,
        });

        await prisma.auditLog.create({
          data: {
            action: 'TRIAL_EXPIRED_EMAIL_SENT',
            actorId: 'SYSTEM',
            actorRole: 'SYSTEM',
            targetType: 'SUBSCRIPTION',
            targetId: sub.id,
            success: true,
            metadata: { trialEndsAt: sub.trialEndsAt, sentAt: now.toISOString() } as any,
          },
        });

        expiryNotifications++;
      } catch (err) {
        console.error(`Failed to send expiry notification to ${sub.instructor.name}:`, err);
      }
    }

    await pingCronHealth('send-trial-expiry-alerts');

    return NextResponse.json({
      success: true,
      warningsSent,
      remindersSent,
      expiryNotificationsSent: expiryNotifications,
      message: `Sent ${warningsSent} 7-day warnings, ${remindersSent} 3-day reminders, ${expiryNotifications} expiry notifications`,
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error('Trial expiry alerts failed:', error);
    await failCronHealth('send-trial-expiry-alerts', error);

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
