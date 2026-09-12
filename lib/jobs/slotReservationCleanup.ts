/**
 * Slot Reservation Cleanup Job
 * 
 * Removes expired slot reservations from the database.
 * This job prevents the SlotReservation table from growing indefinitely.
 * 
 * Should be run every 5-10 minutes via a cron job or background task scheduler.
 * 
 * IDEMPOTENT: Safe to run multiple times — only deletes records older than expiresAt
 */

import { prisma } from '@/lib/prisma';

export async function cleanupExpiredSlotReservations() {
  try {
    const now = new Date();

    // Delete all expired reservations
    const result = await prisma.slotReservation.deleteMany({
      where: {
        expiresAt: { lt: now }
      }
    });

    if (result.count > 0) {
      console.log(`[SlotReservationCleanup] Deleted ${result.count} expired slot reservations`);
    }

    return {
      success: true,
      deletedCount: result.count,
      timestamp: now.toISOString()
    };
  } catch (error) {
    console.error('[SlotReservationCleanup] Error:', error);
    throw error;
  }
}

/**
 * Example: Call this from a cron job endpoint
 * 
 * // app/api/cron/slot-cleanup/route.ts
 * import { cleanupExpiredSlotReservations } from '@/lib/jobs/slotReservationCleanup';
 * 
 * export async function GET(req: Request) {
 *   // Verify request is from your cron service (check auth header)
 *   const result = await cleanupExpiredSlotReservations();
 *   return Response.json(result);
 * }
 */
