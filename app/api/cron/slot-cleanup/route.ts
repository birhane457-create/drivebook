/**
 * Cron Job: Slot Reservation Cleanup
 *
 * Endpoint: /api/cron/slot-cleanup
 * Schedule: Every 10 minutes (vercel.json)
 * Auth:     Vercel Crons authenticate via x-vercel-cron header automatically.
 *           CRON_SECRET Bearer check intentionally removed — it blocked Vercel from
 *           calling this endpoint (Vercel does not send Authorization headers on crons).
 *
 * Removes expired SlotReservation rows to prevent table bloat.
 * SlotReservations expire after 10 minutes (set at creation via expiresAt).
 *
 * Safe to run multiple times — only deletes rows where expiresAt < now (idempotent).
 */

import { NextRequest, NextResponse } from 'next/server';
import { cleanupExpiredSlotReservations } from '@/lib/jobs/slotReservationCleanup';
import { pingCronHealth, failCronHealth } from '@/lib/services/cron-health';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Auth: Vercel Crons send x-vercel-cron header; external schedulers use CRON_SECRET Bearer.
    // The original CRON_SECRET-only check was removed because Vercel does not send Authorization
    // headers on cron invocations — but x-vercel-cron is a separate header that IS sent.
    const isVercelCron = req.headers.get('x-vercel-cron') === '1';
    const authHeader = req.headers.get('authorization');
    const hasCronSecret = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
    if (!isVercelCron && !hasCronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await cleanupExpiredSlotReservations();

    await pingCronHealth('slot-cleanup');

    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
      timestamp: result.timestamp,
    });
  } catch (error) {
    console.error('[SlotCleanupCron] Error:', error);
    await failCronHealth('slot-cleanup', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
