/**
 * Check whether Payout.stripeTransferId has duplicate non-null values.
 * Run against production before adding partial unique index.
 *
 * Usage: DATABASE_URL="postgresql://..." node scripts/check-transfer-id-duplicates.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const url = process.env.DATABASE_URL || '';
  console.log('Target:', url.replace(/:([^:@]+)@/, ':***@'));

  const totalRows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS cnt FROM "Payout" WHERE "stripeTransferId" IS NOT NULL`
  );
  console.log('Non-null stripeTransferId rows:', totalRows[0].cnt);

  const duplicates = await prisma.$queryRawUnsafe(`
    SELECT "stripeTransferId", COUNT(*) AS cnt
    FROM "Payout"
    WHERE "stripeTransferId" IS NOT NULL
    GROUP BY "stripeTransferId"
    HAVING COUNT(*) > 1
  `);

  if (duplicates.length === 0) {
    console.log('No duplicates found — safe to add partial unique index.');
  } else {
    console.error('DUPLICATES FOUND — do NOT add unique constraint without resolving:');
    console.error(JSON.stringify(duplicates, null, 2));
    process.exit(1);
  }
}

main()
  .catch(e => { console.error(e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
