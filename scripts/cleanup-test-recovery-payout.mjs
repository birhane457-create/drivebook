/**
 * Clean up all test recovery payout data from production.
 *
 * Removes:
 *   - All Payout rows for the test instructor
 *   - PayoutTransaction join rows
 *   - LedgerEntry rows for those payouts
 *   - AuditLog rows for those payouts
 *   - The test Provider and User
 *   - Reverses the PlatformLedger totalPaidOut and totalPayoutReserved
 *     increments that were created during the test
 *
 * Usage:
 *   DATABASE_URL="postgresql://sydney..." node scripts/cleanup-test-recovery-payout.mjs --allow-production
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const url = process.env.DATABASE_URL || '';
const allowProduction = process.argv.includes('--allow-production');

if (url.includes('jflrqxigfiiqednfacuf') && !allowProduction) {
  console.error('ERROR: DATABASE_URL points at Sydney production — pass --allow-production');
  process.exit(1);
}
if (url.includes('jflrqxigfiiqednfacuf') && allowProduction) {
  console.warn('WARNING: Running against SYDNEY PRODUCTION database');
}

const TEST_EMAIL = 'test-recovery@drivebook.com.au';

async function main() {
  console.log('Target:', url.replace(/:([^:@]+)@/, ':***@'));

  const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
  if (!user) {
    console.log('No test user found — nothing to clean up.');
    return;
  }

  const provider = await prisma.provider.findFirst({ where: { userId: user.id } });
  if (!provider) {
    console.log('No test provider found — removing user only.');
    if (allowProduction) await prisma.user.delete({ where: { id: user.id } });
    return;
  }

  const payouts = await prisma.payout.findMany({
    where: { providerId: provider.id },
    select: { id: true, payoutRef: true, status: true, netAmount: true, stripeTransferId: true },
  });

  console.log(`\nFound ${payouts.length} test payout(s):`);
  for (const p of payouts) {
    console.log(`  ${p.payoutRef} | status=${p.status} | net=$${p.netAmount} | transfer=${p.stripeTransferId ?? 'none'}`);
  }

  if (!allowProduction) {
    console.log('\n(Dry run — pass --allow-production to delete)');
    return;
  }

  const payoutIds = payouts.map(p => p.id);

  // Calculate how much was added to totalPaidOut (from PAID payouts)
  const paidPayouts = payouts.filter(p => p.status === 'PAID');
  const totalPaidToReverse = paidPayouts.reduce((s, p) => s + Number(p.netAmount), 0);

  if (payoutIds.length) {
    // Remove audit log entries
    const auditDeleted = await prisma.auditLog.deleteMany({
      where: { targetType: 'PAYOUT', targetId: { in: payoutIds } },
    });
    console.log(`Deleted ${auditDeleted.count} audit log entries`);

    // Remove ledger entries
    const ledgerDeleted = await prisma.ledgerEntry.deleteMany({
      where: { referenceId: { in: payoutIds } },
    });
    console.log(`Deleted ${ledgerDeleted.count} ledger entries`);

    // Remove payout transactions
    const ptDeleted = await prisma.payoutTransaction.deleteMany({
      where: { payoutId: { in: payoutIds } },
    });
    console.log(`Deleted ${ptDeleted.count} payout transactions`);

    // Remove payouts
    const payoutsDeleted = await prisma.payout.deleteMany({
      where: { id: { in: payoutIds } },
    });
    console.log(`Deleted ${payoutsDeleted.count} payouts`);
  }

  // Reverse PlatformLedger changes
  if (totalPaidToReverse > 0) {
    await prisma.platformLedger.update({
      where: { key: 'default' },
      data: { totalPaidOut: { decrement: totalPaidToReverse } },
    });
    console.log(`Reversed totalPaidOut by $${totalPaidToReverse.toFixed(2)}`);
  }

  // Remove test provider and user
  await prisma.provider.delete({ where: { id: provider.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log(`Deleted test provider and user (${TEST_EMAIL})`);

  console.log('\nCleanup complete.');
}

main()
  .catch(e => { console.error('Failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
