/**
 * Cron: Apply scheduled commission rate changes
 * Schedule: Daily at 00:05 UTC (10:05 AWST)
 * 
 * 1. Find all PENDING PlatformRateChange records where effectiveDate <= now
 * 2. Apply each change to PlatformSettings
 * 3. Send in-app notification + email to all affected instructors
 * 4. Mark change as APPLIED
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services/email';
import { pingCronHealth, failCronHealth } from '@/lib/services/cron-health';
import { DEFAULT_TIMEZONE } from '@/lib/utils/timezone';

export const dynamic = 'force-dynamic';

const FIELD_LABELS: Record<string, { label: string; tier: string }> = {
  basicCommissionRate: { label: 'Basic tier commission rate', tier: 'BASIC' },
  proCommissionRate:   { label: 'Pro tier commission rate',   tier: 'PRO' },
  businessCommissionRate: { label: 'Business tier commission rate', tier: 'BUSINESS' },
};

export async function GET(req: NextRequest) {
  // Verify cron secret — explicitly reject if env var is not configured
  const authHeader = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  let applied = 0;
  let errors = 0;

  try {
    // Find all pending changes that are due (raw SQL — Prisma client may not be regenerated)
    const pendingChanges = await prisma.$queryRaw<any[]>`
      SELECT * FROM "PlatformRateChange"
      WHERE "status" = 'PENDING'
        AND "effectiveDate" <= NOW()
      ORDER BY "effectiveDate" ASC
    `;

    if (pendingChanges.length === 0) {
      await pingCronHealth('apply-rate-changes');
      return NextResponse.json({ applied: 0, message: 'No rate changes due' });
    }

    for (const change of pendingChanges) {
      try {
        // Apply the rate change to PlatformSettings
        await prisma.platformSettings.upsert({
          where: { key: 'default' },
          update: { [change.field]: change.newRate },
          create: {
            key: 'default',
            [change.field]: change.newRate,
            updatedBy: 'SYSTEM',
          } as any,
        });

        // Mark as applied (raw SQL)
        await prisma.$executeRaw`
          UPDATE "PlatformRateChange"
          SET "status" = 'APPLIED', "appliedAt" = NOW(), "updatedAt" = NOW()
          WHERE "id" = ${change.id}
        `;

        // Notify affected instructors
        const fieldInfo = FIELD_LABELS[change.field];
        if (fieldInfo) {
          await notifyInstructors(change, fieldInfo, now);
        }

        // Audit log
        await prisma.auditLog.create({
          data: {
            action: 'RATE_CHANGE_APPLIED',
            actorId: 'SYSTEM',
            actorRole: 'SYSTEM',
            targetType: 'PLATFORM_SETTINGS',
            targetId: change.id,
            success: true,
            metadata: {
              field: change.field,
              previousRate: change.currentRate,
              newRate: change.newRate,
              effectiveDate: change.effectiveDate,
            } as any,
          },
        });

        applied++;
        console.log(`✅ Rate change applied: ${change.field} ${change.currentRate}% → ${change.newRate}%`);
      } catch (err) {
        errors++;
        console.error(`❌ Failed to apply rate change ${change.id}:`, err);
      }
    }

    await pingCronHealth('apply-rate-changes');
    return NextResponse.json({
      applied,
      errors,
      message: `${applied} rate change(s) applied${errors > 0 ? `, ${errors} failed` : ''}`,
    });
  } catch (error) {
    console.error('apply-rate-changes cron error:', error);
    await failCronHealth('apply-rate-changes', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function notifyInstructors(
  change: any,
  fieldInfo: { label: string; tier: string },
  now: Date
) {
  // Find all instructors on the affected tier
  const tierFilter = fieldInfo.tier === 'BASIC'
    ? { subscriptionTier: 'BASIC' }
    : fieldInfo.tier === 'PRO'
    ? { subscriptionTier: { in: ['PRO', 'STUDIO'] } }
    : { subscriptionTier: 'BUSINESS' };

  const instructors = await prisma.instructor.findMany({
    where: {
      approvalStatus: 'APPROVED',
      isActive: true,
      ...tierFilter,
    },
    select: {
      id: true,
      name: true,
      userId: true,
      subscriptionTier: true,
      user: { select: { id: true, email: true } },
    },
  });

  const effectiveDateStr = new Date(change.effectiveDate).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: DEFAULT_TIMEZONE,
  });

  const direction = change.newRate > change.currentRate ? 'increased' : 'decreased';
  const directionColor = change.newRate > change.currentRate ? '#dc2626' : '#16a34a';

  for (const instructor of instructors) {
    try {
      // In-app notification
      if (instructor.userId) {
        await prisma.notification.create({
          data: {
            userId: instructor.userId,
            type: 'RATE_CHANGE',
            title: `Commission rate update — effective ${effectiveDateStr}`,
            message: `Your ${fieldInfo.label} has ${direction} from ${change.currentRate}% to ${change.newRate}%. ${change.reason}`,
            link: '/dashboard/subscription',
          } as any,
        });
      }

      // Email notification
      if (instructor.user?.email) {
        await emailService.sendGenericEmail({
          from: 'DriveBook Payments <payments@drivebook.com.au>',
          to: instructor.user.email,
          subject: `Important: Commission rate change effective ${effectiveDateStr}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background: #f3f4f6; }
                .wrap { max-width: 600px; margin: 24px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
                .header { background: linear-gradient(135deg, #1d4ed8, #2563eb); color: white; padding: 28px 32px; }
                .body { padding: 28px 32px; }
                .rate-box { background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0; }
                .footer { border-top: 1px solid #e5e7eb; padding: 20px 32px; font-size: 12px; color: #9ca3af; text-align: center; }
              </style>
            </head>
            <body>
              <div class="wrap">
                <div class="header">
                  <h1 style="margin:0;font-size:20px;">📋 Commission Rate Update</h1>
                  <p style="margin:4px 0 0;opacity:0.85;font-size:14px;">Effective ${effectiveDateStr}</p>
                </div>
                <div class="body">
                  <p>Hi ${instructor.name},</p>
                  <p>We're writing to let you know about an upcoming change to your commission rate on DriveBook.</p>
                  
                  <div class="rate-box">
                    <p style="margin:0 0 12px;font-size:14px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Rate Change</p>
                    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
                      <div style="text-align:center;">
                        <p style="margin:0;font-size:13px;color:#6b7280;">Current rate</p>
                        <p style="margin:4px 0 0;font-size:28px;font-weight:700;color:#1f2937;">${change.currentRate}%</p>
                      </div>
                      <div style="font-size:24px;color:#6b7280;">→</div>
                      <div style="text-align:center;">
                        <p style="margin:0;font-size:13px;color:#6b7280;">New rate</p>
                        <p style="margin:4px 0 0;font-size:28px;font-weight:700;color:${directionColor};">${change.newRate}%</p>
                      </div>
                    </div>
                    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">Effective: <strong>${effectiveDateStr}</strong></p>
                  </div>

                  <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:16px 0;">
                    <p style="margin:0;font-size:14px;font-weight:600;color:#1d4ed8;">Why this change?</p>
                    <p style="margin:8px 0 0;font-size:14px;color:#1e40af;">${change.reason}</p>
                  </div>

                  <p style="font-size:14px;color:#6b7280;">
                    This rate applies to all new bookings from ${effectiveDateStr}. 
                    Existing confirmed bookings are not affected — they retain the rate at the time of booking.
                  </p>

                  <p style="font-size:14px;color:#6b7280;">
                    You can view your current commission rate at any time on your 
                    <a href="${process.env.NEXTAUTH_URL}/dashboard/subscription" style="color:#2563eb;">Subscription page</a>.
                  </p>

                  <p>If you have any questions, please contact us at 
                    <a href="mailto:${process.env.ADMIN_EMAIL || 'support@drivebook.com.au'}" style="color:#2563eb;">
                      ${process.env.ADMIN_EMAIL || 'support@drivebook.com.au'}
                    </a>.
                  </p>
                </div>
                <div class="footer">DriveBook · drivebook.com.au</div>
              </div>
            </body>
            </html>
          `,
        }).catch(e => console.error(`Email failed for ${instructor.user?.email}:`, e));
      }
    } catch (err) {
      console.error(`Failed to notify instructor ${instructor.id}:`, err);
    }
  }

  // Mark as notified (raw SQL)
  await prisma.$executeRaw`
    UPDATE "PlatformRateChange"
    SET "notifiedAt" = NOW(), "updatedAt" = NOW()
    WHERE "id" = ${change.id}
  `;
}
