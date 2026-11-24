/**
 * Clean up duplicate test-only Stripe transfer IDs in the Japan test database.
 * These were created by repeated test runs using hardcoded transfer IDs.
 * Sets stripeTransferId to NULL on test payouts so the unique index can be applied.
 *
 * Usage: DATABASE_URL="postgresql://..." node scripts/cleanup-test-transfer-ids.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const url = process.env.DATABASE_URL || '';
if (url.includes('jflrqxigfiiqednfacuf')) {
  console.error('ERROR: DATABASE_URL points at Sydney production — aborting');
  process.exit(1);
}

async function main() {
  console.log('Cleaning up duplicate test transfer IDs...');

  // Find all duplicate non-null transfer IDs
  const dups = await prisma.$queryRawUnsafe(`
    SELECT "stripeTransferId"
    FROM "Payout"
    WHERE "stripeTransferId" IS NOT NULL
    GROUP BY "stripeTransferId"
    HAVING COUNT(*) > 1
  `);

  if (dups.length === 0) {
    console.log('No duplicates found — nothing to clean.');
    return;
  }

  for (const { stripeTransferId } of dups) {
    console.log(`  Clearing ${stripeTransferId}...`);
    await prisma.payout.updateMany({
      where: { stripeTransferId },
      data: { stripeTransferId: null },
    });
  }

  console.log('Done. Duplicates cleared.');
}

main()
  .catch(e => { console.error(e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
