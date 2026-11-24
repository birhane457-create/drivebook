/**
 * Apply PH5-SCH-22b migration: partial unique index on Payout.stripeTransferId
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." node scripts/apply-ph5-sch22b-transfer-id-index.mjs [--allow-production]
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const url = process.env.DATABASE_URL || '';
const allowProduction = process.argv.includes('--allow-production');

if (url.includes('jflrqxigfiiqednfacuf') && !allowProduction) {
  console.error('ERROR: DATABASE_URL points at Sydney production — pass --allow-production to confirm');
  process.exit(1);
}
if (url.includes('jflrqxigfiiqednfacuf') && allowProduction) {
  console.warn('WARNING: Running against SYDNEY PRODUCTION database');
}

async function main() {
  console.log('Target:', url.replace(/:([^:@]+)@/, ':***@'));

  // Check for existing index
  const existing = await prisma.$queryRawUnsafe(`
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'Payout'
      AND indexname = 'Payout_stripeTransferId_unique'
    LIMIT 1
  `);

  if (existing.length > 0) {
    console.log('Index Payout_stripeTransferId_unique already exists — skipping.');
    return;
  }

  // Verify no duplicates before creating
  const dups = await prisma.$queryRawUnsafe(`
    SELECT "stripeTransferId", COUNT(*)::text AS cnt
    FROM "Payout"
    WHERE "stripeTransferId" IS NOT NULL
    GROUP BY "stripeTransferId"
    HAVING COUNT(*) > 1
  `);

  if (dups.length > 0) {
    console.error('DUPLICATES FOUND — cannot add unique index without resolving:');
    console.error(JSON.stringify(dups, null, 2));
    process.exit(1);
  }

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX "Payout_stripeTransferId_unique"
    ON "Payout" ("stripeTransferId")
    WHERE "stripeTransferId" IS NOT NULL
  `);
  console.log('Created: Payout_stripeTransferId_unique (partial unique index)');

  // Verify
  const check = await prisma.$queryRawUnsafe(`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'Payout'
      AND indexname = 'Payout_stripeTransferId_unique'
  `);
  console.log('Verified:', check[0]?.indexdef);
}

main()
  .catch(e => { console.error('Migration failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
