/**
 * apply-ph5-sch22a-migration.mjs
 *
 * Applies the two Phase 1 migration SQL statements to the target database
 * via the Prisma pooler connection (no direct port needed).
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." node scripts/apply-ph5-sch22a-migration.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Safety guard — never run against Sydney production without explicit flag
const url = process.env.DATABASE_URL || '';
const allowProduction = process.argv.includes('--allow-production');

if (url.includes('jflrqxigfiiqednfacuf') && !allowProduction) {
  console.error('ERROR: DATABASE_URL points at Sydney production — pass --allow-production to confirm');
  process.exit(1);
}

if (url.includes('jflrqxigfiiqednfacuf') && allowProduction) {
  console.warn('⚠️  WARNING: Running against SYDNEY PRODUCTION database');
  console.warn('   Project: jflrqxigfiiqednfacuf');
}

async function columnExists(table, column) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND column_name = $2
    LIMIT 1
  `, table, column);
  return rows.length > 0;
}

async function indexExists(indexName) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = $1
    LIMIT 1
  `, indexName);
  return rows.length > 0;
}

async function main() {
  console.log('Applying PH5-SCH-22a Phase 1 migrations...');
  console.log(`Target: ${url.replace(/:([^:@]+)@/, ':***@')}`);

  // ── Migration 1: Payout reservation fields ──────────────────────────────────
  console.log('\n[1/2] Payout reservation fields...');

  if (!await columnExists('Payout', 'reservedAt')) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Payout" ADD COLUMN "reservedAt" TIMESTAMP(3)`);
    console.log('  + Payout.reservedAt');
  } else { console.log('  ✓ Payout.reservedAt already exists'); }

  if (!await columnExists('Payout', 'reservedAmount')) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Payout" ADD COLUMN "reservedAmount" DECIMAL(12,2)`);
    console.log('  + Payout.reservedAmount');
  } else { console.log('  ✓ Payout.reservedAmount already exists'); }

  if (!await columnExists('Payout', 'reservationId')) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Payout" ADD COLUMN "reservationId" TEXT`);
    console.log('  + Payout.reservationId');
  } else { console.log('  ✓ Payout.reservationId already exists'); }

  if (!await indexExists('Payout_reservationId_key')) {
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX "Payout_reservationId_key" ON "Payout"("reservationId")`);
    console.log('  + UNIQUE INDEX Payout_reservationId_key');
  } else { console.log('  ✓ Index Payout_reservationId_key already exists'); }

  if (!await columnExists('PlatformLedger', 'totalPayoutReserved')) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "PlatformLedger" ADD COLUMN "totalPayoutReserved" DECIMAL(12,2) NOT NULL DEFAULT 0`);
    console.log('  + PlatformLedger.totalPayoutReserved');
  } else { console.log('  ✓ PlatformLedger.totalPayoutReserved already exists'); }

  // ── Migration 2: Recovery claim fields ──────────────────────────────────────
  console.log('\n[2/2] Recovery claim fields...');

  if (!await columnExists('Payout', 'recoveryClaimToken')) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Payout" ADD COLUMN "recoveryClaimToken" TEXT`);
    console.log('  + Payout.recoveryClaimToken');
  } else { console.log('  ✓ Payout.recoveryClaimToken already exists'); }

  if (!await columnExists('Payout', 'recoveryClaimExpiresAt')) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Payout" ADD COLUMN "recoveryClaimExpiresAt" TIMESTAMP(3)`);
    console.log('  + Payout.recoveryClaimExpiresAt');
  } else { console.log('  ✓ Payout.recoveryClaimExpiresAt already exists'); }

  console.log('\nAll migrations applied successfully.');

  // Verify by reading column list
  const cols = await prisma.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Payout'
      AND column_name IN ('reservedAt','reservedAmount','reservationId','recoveryClaimToken','recoveryClaimExpiresAt')
    ORDER BY column_name
  `);
  console.log('Verified Payout columns:', cols.map(r => r.column_name).join(', '));

  const ledgerCols = await prisma.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PlatformLedger'
      AND column_name = 'totalPayoutReserved'
  `);
  console.log('Verified PlatformLedger columns:', ledgerCols.map(r => r.column_name).join(', '));
}

main()
  .catch(e => { console.error('Migration failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
