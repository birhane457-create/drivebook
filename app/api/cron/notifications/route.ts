/**
 * Cron Job: Notifications Dispatcher
 *
 * Endpoint: /api/cron/notifications
 * Schedule: Every 15 minutes (vercel.json)
 * Auth:     Vercel Crons authenticate via x-vercel-cron header automatically.
 *           Bearer auth check removed — Vercel does not send Authorization headers on crons.
 *
 * Runs two jobs each tick:
 *   1. generateBookingReminders  — in-app reminders for lessons tomorrow and in 1 hour
 *   2. generatePackageExpiryAlerts — in-app alerts at 7d / 1d / today / yesterday (marks expired)
 *
 * Each job is independently try/caught — one failure does not abort the other.
 * CronHealth is pinged on success, failed on unhandled error.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateBookingReminders } from '@/lib/jobs/bookingReminders';
import { generatePackageExpiryAlerts } from '@/lib/jobs/packageExpiryAlerts';
import { pingCronHealth, failCronHealth } from '@/lib/services/cron-health';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  // Auth: accept either CRON_SECRET Bearer token (external schedulers)
  // or the Vercel-injected x-vercel-cron header (Vercel Crons)
  const authHeader = req.headers.get('authorization');
  const isVercelCron = req.headers.get('x-vercel-cron') === '1';
  const hasCronSecret = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!isVercelCron && !hasCronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: {
    bookingReminders: { success: boolean } | null;
    packageExpiryAlerts: { success: boolean } | null;
    errors: { job: string; error: string }[];
    completedAt: string;
    duration: string;
  } = {
    bookingReminders: null,
    packageExpiryAlerts: null,
    errors: [],
    completedAt: new Date().toISOString(),
    duration: '',
  };

  try {
    // Run booking reminders job
    try {
      results.bookingReminders = await generateBookingReminders();
    } catch (error) {
      results.errors.push({
        job: 'bookingReminders',
        error: error instanceof Error ? error.message : String(error),
      });
      console.error('[NotificationsCron] bookingReminders failed:', error);
    }

    // Run package expiry alerts job
    try {
      results.packageExpiryAlerts = await generatePackageExpiryAlerts();
    } catch (error) {
      results.errors.push({
        job: 'packageExpiryAlerts',
        error: error instanceof Error ? error.message : String(error),
      });
      console.error('[NotificationsCron] packageExpiryAlerts failed:', error);
    }

    results.completedAt = new Date().toISOString();
    results.duration = `${Date.now() - startTime}ms`;

    await pingCronHealth('notifications');

    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    console.error('[NotificationsCron] Unhandled error:', error);
    await failCronHealth('notifications', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: `${Date.now() - startTime}ms`,
      },
      { status: 500 }
    );
  }
}

// Allow POST for manual triggers / testing
export async function POST(req: NextRequest) {
  return GET(req);
}
