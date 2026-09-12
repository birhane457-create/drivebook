/**
 * Orphan Transaction Detection Cron
 * AUDIT FIX #4: Detect transactions without corresponding bookings/wallets
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendAlert } from '@/lib/services/alert-service';

export async function detectOrphanTransactions() {
  // Check for transactions without valid booking references
  const orphanedTransactions = await prisma.transaction.findMany({
    where: {
      bookingId: { not: null },
    },
    include: {
      booking: true,
    },
  });

  const orphans = orphanedTransactions.filter(t => !t.booking);

  if (orphans.length > 0) {
    logger.warn(`⚠️ Found ${orphans.length} orphaned transactions`);
    
    for (const txn of orphans) {
      await sendAlert({
        type: 'RECONCILIATION_ISSUES',
        severity: 'WARNING',
        message: `Orphan transaction ${txn.id}: references missing booking ${txn.bookingId}`,
        entityId: txn.id,
        metadata: {
          transactionId: txn.id,
          bookingId: txn.bookingId,
          amount: txn.amount,
          createdAt: txn.createdAt,
        },
      });
    }
  }

  return { checked: new Date(), orphanCount: orphans.length };
}
