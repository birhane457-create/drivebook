/**
 * Cron Job: Slot Reservation Cleanup
 * 
 * Endpoint: /api/cron/slot-cleanup
 * Trigger: Every 5-10 minutes via external cron service (e.g., Vercel Crons, EasyCron, node-cron)
 * Auth: Requires CRON_SECRET header for security
 * 
 * Removes expired slot reservations to prevent table bloat.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cleanupExpiredSlotReservations } from '@/lib/jobs/slotReservationCleanup';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Security: Verify CRON_SECRET header
    const cronSecret = req.headers.get('authorization')?.replace('Bearer ', '');
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret || cronSecret !== expectedSecret) {
      console.warn('[SlotCleanupCron] Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Run cleanup
    const result = await cleanupExpiredSlotReservations();

    // Record in CronHealth for monitoring
    const { prisma } = await import('@/lib/prisma');
    await prisma.cronHealth.upsert({
      where: { jobName: 'cleanup-slot-reservations' },
      create: {
        jobName: 'cleanup-slot-reservations',
        lastRunAt: new Date(),
        lastStatus: 'OK',
        runCount: 1
      },
      update: {
        lastRunAt: new Date(),
        lastStatus: 'OK',
        runCount: { increment: 1 }
      }
    });

    return NextResponse.json({
      message: 'Slot cleanup completed',
      ...result
    });
  } catch (error) {
    console.error('[SlotCleanupCron] Error:', error);

    // Record failure in CronHealth
    const { prisma } = await import('@/lib/prisma');
    await prisma.cronHealth.upsert({
      where: { jobName: 'cleanup-slot-reservations' },
      create: {
        jobName: 'cleanup-slot-reservations',
        lastRunAt: new Date(),
        lastStatus: 'FAILED',
        lastError: error instanceof Error ? error.message : String(error),
        runCount: 1
      },
      update: {
        lastRunAt: new Date(),
        lastStatus: 'FAILED',
        lastError: error instanceof Error ? error.message : String(error)
      }
    });

    return NextResponse.json(
      { error: 'Cleanup failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
