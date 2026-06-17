import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services/email';
import { pingCronHealth, failCronHealth } from '@/lib/services/cron-health';

export const dynamic = 'force-dynamic';

/**
 * Trial Expiry Alerts Cron Job
 *
 * Purpose: Send trial expiry notifications to instructors
 * Schedule: Daily (via external cron or internal interval)
 * Emails:
 *   - 7 days before trial ends: "Your trial ends in 7 days. Upgrade to continue."
 *   - Just expired: "Your trial ended. Features now restricted. Upgrade to continue."
 * Tracking: Uses AuditLog entries to avoid duplicate emails (no extra DB fields).
 */

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    let warningsent = 0;
    let expiryNotifications = 0;

    // === 1. UPCOMING EXPIRY WARNINGS (7 days before) ===

    const upcomingExpiries = await prisma.subscription.findMany({
      where: {
        status: 'TRIAL',
        trialEndsAt: {
          gte: now,
          lte: sevenDaysFromNow,
        },
      },
      include: {
        instructor: {
          select: { id: true, name: true, user: { select: { email: true } } },
        },
      },
    });

    for (const sub of upcomingExpiries) {
      if (!sub.instructor.user?.email) continue;
      if (!sub.trialEndsAt) continue;

      try {
        // Dedupe: only send warning once per subscription
        const existing = await prisma.auditLog.findFirst({
          where: {
            action: 'TRIAL_WARNING_EMAIL_SENT',
            targetType: 'SUBSCRIPTION',
            targetId: sub.id,
          },
          orderBy: { createdAt: 'desc' },
        });
        if (existing) continue;

        const daysLeft = Math.ceil(
          (new Date(sub.trialEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        const tierName = sub.tier || 'your plan';

        await emailService.sendGenericEmail({
          to: sub.instructor.user.email,
          subject: `Your ${tierName} trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
          html: `
            <h2>Your trial is ending soon</h2>
            <p>Hi ${sub.instructor.name},</p>
            <p>Your <strong>${tierName}</strong> plan trial ends in <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong> 
            on ${new Date(sub.trialEndsAt).toLocaleDateString('en-AU', { 
              weekday: 'long', 
              day: 'numeric', 
              month: 'long', 
              year: 'numeric' 
            })}.</p>
            <p>To continue using all features and accept bookings, upgrade your subscription:</p>
            <ul>
              <li><strong>PRO ($79/month)</strong> — Advanced analytics, branded pages, priority support</li>
              <li><strong>STUDIO ($129/month)</strong> — Custom domain, white-label experience</li>
              <li><strong>BUSINESS ($199/month)</strong> — Team accounts, API access, dedicated support</li>
            </ul>
            <p><a href="https://drivebook.com.au/dashboard/subscription" style="background-color:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">
              View Plans & Upgrade
            </a></p>
            <p>Questions? Reply to this email or visit our <a href="https://drivebook.com.au/help">help center</a>.</p>
          `,
        });

        // Mark as sent (AuditLog-based tracking)
        await prisma.auditLog.create({
          data: {
            action: 'TRIAL_WARNING_EMAIL_SENT',
            actorId: 'SYSTEM',
            actorRole: 'SYSTEM',
            targetType: 'SUBSCRIPTION',
            targetId: sub.id,
            success: true,
            metadata: { trialEndsAt: sub.trialEndsAt, sentAt: now.toISOString() } as any,
          },
        });

        warningsent++;
      } catch (err) {
        console.error(`Failed to send trial warning to ${sub.instructor.name}:`, err);
      }
    }

    // === 2. JUST EXPIRED NOTIFICATIONS ===

    // "Just expired": subscriptions already marked EXPIRED by the expiry cron,
    // and whose trialEndsAt passed recently.
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
      if (!sub.instructor.user?.email) continue;
      if (!sub.trialEndsAt) continue;

      try {
        // Dedupe: only send expiry notice once per subscription
        const existing = await prisma.auditLog.findFirst({
          where: {
            action: 'TRIAL_EXPIRED_EMAIL_SENT',
            targetType: 'SUBSCRIPTION',
            targetId: sub.id,
          },
          orderBy: { createdAt: 'desc' },
        });
        if (existing) continue;

        const tierName = sub.instructor.subscriptionTier || 'BASIC';

        await emailService.sendGenericEmail({
          to: sub.instructor.user.email,
          subject: `Your trial ended — Action required to restore access`,
          html: `
            <h2>Your trial has ended</h2>
            <p>Hi ${sub.instructor.name},</p>
            <p>Your free trial ended on ${new Date(sub.trialEndsAt).toLocaleDateString('en-AU', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}.</p>
            <p>Your account is now in <strong>READ-ONLY mode</strong>. You can view your historical data, but:</p>
            <ul>
              <li>❌ Cannot create new bookings</li>
              <li>❌ Cannot add students</li>
              <li>❌ Cannot change settings</li>
              <li>❌ Cannot use premium features (custom domain, branded pages, etc.)</li>
            </ul>
            <p><strong>To restore full access, upgrade your subscription:</strong></p>
            <table style="width:100%;border-collapse:collapse;">
              <tr style="background:#f3f4f6;">
                <td style="padding:12px;"><strong>BASIC</strong></td>
                <td style="padding:12px;">$0/month (limited)</td>
                <td style="padding:12px;"><a href="https://drivebook.com.au/dashboard/subscription?tier=BASIC">Select</a></td>
              </tr>
              <tr style="background:#ffffff;">
                <td style="padding:12px;"><strong>PRO</strong></td>
                <td style="padding:12px;">$79/month</td>
                <td style="padding:12px;"><a href="https://drivebook.com.au/dashboard/subscription?tier=PRO">Upgrade</a></td>
              </tr>
              <tr style="background:#f3f4f6;">
                <td style="padding:12px;"><strong>STUDIO</strong></td>
                <td style="padding:12px;">$129/month</td>
                <td style="padding:12px;"><a href="https://drivebook.com.au/dashboard/subscription?tier=STUDIO">Upgrade</a></td>
              </tr>
              <tr style="background:#ffffff;">
                <td style="padding:12px;"><strong>BUSINESS</strong></td>
                <td style="padding:12px;">$199/month</td>
                <td style="padding:12px;"><a href="https://drivebook.com.au/dashboard/subscription?tier=BUSINESS">Upgrade</a></td>
              </tr>
            </table>
            <p style="margin-top:20px;"><a href="https://drivebook.com.au/dashboard/subscription" style="background-color:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">
              Go to Subscription Settings
            </a></p>
            <p>Need help? Visit our <a href="https://drivebook.com.au/help">help center</a> or reply to this email.</p>
          `,
        });

        // Mark as sent (AuditLog-based tracking)
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
      warningsSent: warningsent,
      expiryNotificationsSent: expiryNotifications,
      message: `Sent ${warningsent} trial warnings and ${expiryNotifications} expiry notifications`,
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
