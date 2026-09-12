import { prisma } from '@/lib/prisma';
/**
 * Cleanup expired slot reservations
 * 
 * SlotReservation records are created when a public booking starts (10-min hold).
 * If payment isn't completed within 10 minutes, the reservation expires.
 * This cron deletes expired reservations to prevent:
 * - Database bloat
 * - "Ghost reservations" blocking real bookings
 * 
 * Runs: Daily at 3am (via daily cron route)
 * 
 * Related Issues: BOOKING_FLOW_AUDIT #2, #21
 */
export async function cleanupExpiredSlotReservations() {
  const now = new Date();
  try {
    const result = await prisma.slotReservation.deleteMany({
      where: { expiresAt: { lt: now } }
    });
    const message = `[Cron] Deleted ${result.count} expired slot reservations at ${now.toISOString()}`;
    console.log(message);
    return {
      success: true,
      deleted: result.count,
      timestamp: now.toISOString(),
      message,
    };
  } catch (error) {
    console.error('[Cron] Slot reservation cleanup failed:', error);
    return {
      success: false,
      deleted: 0,
      timestamp: now.toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
