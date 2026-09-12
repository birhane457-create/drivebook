/**
 * Manual Payout Aging Alert Cron
 * AUDIT FIX #9: Flag PENDING_TRANSFER payouts >7 days old
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendAlert } from '@/lib/services/alert-service';

export async function checkManualPayoutAging() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Payout has no provider relation — fetch payouts then look up provider names separately
  const stalePayouts = await prisma.payout.findMany({
    where: {
      status: 'PENDING_TRANSFER',
      createdAt: { lt: sevenDaysAgo },
    },
  });

  if (stalePayouts.length > 0) {
    logger.warn(`⚠️ Found ${stalePayouts.length} manual payouts >7 days old`);

    // Batch-fetch provider names to avoid N+1
    const providerIds = [...new Set(stalePayouts.map((p) => p.providerId))];
    const providers = await prisma.provider.findMany({
      where: { id: { in: providerIds } },
      select: { id: true, name: true },
    });
    const providerMap = new Map(providers.map((p) => [p.id, p.name]));

    for (const payout of stalePayouts) {
      const providerName = providerMap.get(payout.providerId) ?? payout.providerId;
      await sendAlert({
        type: 'RECONCILIATION_ISSUES',
        severity: 'WARNING',
        message: `Manual payout ${payout.id} for ${providerName} pending >7 days`,
        entityId: payout.id,
        metadata: {
          payoutId: payout.id,
          providerId: payout.providerId,
          amount: payout.netAmount,
          daysOld: Math.floor((Date.now() - payout.createdAt.getTime()) / (24 * 60 * 60 * 1000)),
        },
      });
    }
  }

  return { checked: new Date(), staleCount: stalePayouts.length };
}
