/**
 * Cron Job: Slot Reservation Cleanup
 *
 * Endpoint: /api/cron/slot-cleanup
 * Schedule: Every 10 minutes (vercel.json)
 * Auth:     Bearer CRON_SECRET only.
 *           CRON_SECRET must be set in Vercel environment variables.
 *           The x-vercel-cron header is not used for authentication —
 *           any HTTP caller can send it. Vercel cron invocations send the
 *           Authorization: Bearer <CRON_SECRET> header when CRON_SECRET
 *           is configured in the project settings.
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
    // Auth: CRON_SECRET Bearer token only.
    // The x-vercel-cron header is NOT used for authentication — it can be sent by any
    // HTTP caller and does not establish that the request came from Vercel infrastructure.
    // Vercel's own guidance requires validating the Authorization: Bearer <CRON_SECRET>
    // header. Configure CRON_SECRET in Vercel environment variables and vercel.json cron
    // config picks it up automatically for all cron invocations.
    const authHeader = req.headers.get('authorization');
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
