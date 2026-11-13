/**
 * check-db-state.cjs
 *
 * READ-ONLY production database state check to inform the migration decision.
 *
 * Reports:
 * 1. Whether the Phase 2 Provider columns exist (organisationType etc.)
 * 2. Row counts for key tables
 * 3. Whether test/fake records are present (rt-.test, sp-.test, bw-.test emails)
 * 4. The last 10 _prisma_migrations entries
 * 5. Whether any Provider row has a non-null organisationType or commercialAgreementType
 *
 * Run:
 *   node --env-file=.env.local scripts/check-db-state.cjs
 */

'use strict';
const { PrismaClient } = require('@prisma/client');
process.env.DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient();

function sep() { console.log('─'.repeat(72)); }

async function main() {
  console.log('='.repeat(72));
  console.log('Production DB State Check (READ-ONLY)');
  console.log('='.repeat(72));

  // 1. Check whether Phase 2 columns exist
  sep();
  console.log('1. Phase 2 Provider columns');
  sep();
  try {
    const cols = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'Provider'
        AND column_name IN (
          'organisationType', 'commercialAgreementType', 'commercialAgreementStatus',
          'commercialAgreementVersion', 'commercialAgreementAcceptedAt',
          'privacyPolicyVersion', 'privacyPolicyAcceptedAt'
        )
      ORDER BY column_name
    `;
    const found = Array.isArray(cols) ? cols : [];
    const expected = ['organisationType','commercialAgreementType','commercialAgreementStatus',
                      'commercialAgreementVersion','commercialAgreementAcceptedAt',
                      'privacyPolicyVersion','privacyPolicyAcceptedAt'];
    const foundNames = found.map((r) => r.column_name);
    for (const col of expected) {
      const row = found.find((r) => r.column_name === col);
      if (row) {
        console.log(`  ✅ ${col} — type=${row.data_type}, nullable=${row.is_nullable}, default=${row.column_default ?? 'none'}`);
      } else {
        console.log(`  ❌ MISSING: ${col}`);
      }
    }
    console.log(`\n  ${foundNames.length}/${expected.length} Phase 2 columns present`);
  } catch (e) {
    console.log(`  ERROR checking columns: ${e.message}`);
  }

  // 2. Row counts
  sep();
  console.log('2. Row counts (key tables)');
  sep();
  const tables = [
    ['User', async () => prisma.user.count()],
    ['Provider', async () => prisma.provider.count()],
    ['Subscription', async () => prisma.$queryRaw`SELECT COUNT(*) as c FROM "Subscription"`.then(r => Number(r[0].c))],
    ['Booking', async () => prisma.booking.count()],
    ['WalletTransaction', async () => prisma.$queryRaw`SELECT COUNT(*) as c FROM "WalletTransaction"`.then(r => Number(r[0].c))],
    ['Transaction', async () => prisma.$queryRaw`SELECT COUNT(*) as c FROM "Transaction"`.then(r => Number(r[0].c))],
    ['AuditLog', async () => prisma.$queryRaw`SELECT COUNT(*) as c FROM "AuditLog"`.then(r => Number(r[0].c))],
  ];
  for (const [name, fn] of tables) {
    try {
      const count = await fn();
      console.log(`  ${name}: ${count} rows`);
    } catch (e) {
      console.log(`  ${name}: ERROR — ${e.message.split('\n')[0]}`);
    }
  }

  // 3. Test/fake records
  sep();
  console.log('3. Test/fake records (rt-*.test, sp-*.test, bw-*.test emails)');
  sep();
  try {
    const testUsers = await prisma.user.findMany({
      where: {
        email: {
          contains: '.test',
        },
      },
      select: { email: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    if (testUsers.length === 0) {
      console.log('  ✅ No .test email records found');
    } else {
      console.log(`  ⚠ ${testUsers.length} .test email records found (showing up to 20):`);
      for (const u of testUsers) {
        console.log(`    ${u.email} — created ${u.createdAt.toISOString()}`);
      }
    }
  } catch (e) {
    console.log(`  ERROR: ${e.message.split('\n')[0]}`);
  }

  // 4. Migration history (last 10)
  sep();
  console.log('4. _prisma_migrations (last 10 by started_at)');
  sep();
  try {
    const migrations = await prisma.$queryRaw`
      SELECT migration_name, finished_at, rolled_back_at, applied_steps_count
      FROM _prisma_migrations
      ORDER BY started_at DESC
      LIMIT 10
    `;
    const rows = Array.isArray(migrations) ? migrations : [];
    for (const r of rows) {
      const status = r.rolled_back_at ? '🔴 ROLLED BACK' : r.finished_at ? '✅ applied' : '⚠ NOT FINISHED';
      console.log(`  ${status} — ${r.migration_name} (steps=${r.applied_steps_count})`);
    }
    if (rows.length === 0) console.log('  (no migration history)');
  } catch (e) {
    console.log(`  ERROR: ${e.message.split('\n')[0]}`);
  }

  // 5. Sample Provider rows with Phase 2 field values
  sep();
  console.log('5. Provider rows — Phase 2 field sample (first 5)');
  sep();
  try {
    const providers = await prisma.$queryRaw`
      SELECT
        id, name,
        "organisationType",
        "commercialAgreementType",
        "commercialAgreementStatus",
        "privacyPolicyVersion",
        "createdAt"
      FROM "Provider"
      ORDER BY "createdAt" DESC
      LIMIT 5
    `;
    if (!providers || providers.length === 0) {
      console.log('  No Provider rows found');
    } else {
      for (const p of providers) {
        console.log(`  Provider: ${p.name ?? 'unnamed'} (${p.id})`);
        console.log(`    organisationType=${p.organisationType ?? 'NULL'}`);
        console.log(`    commercialAgreementType=${p.commercialAgreementType ?? 'NULL'}`);
        console.log(`    commercialAgreementStatus=${p.commercialAgreementStatus ?? 'NULL'}`);
        console.log(`    privacyPolicyVersion=${p.privacyPolicyVersion ?? 'NULL'}`);
      }
    }
  } catch (e) {
    // Columns may not exist yet — that is itself useful information
    if (e.message.includes('column') || e.message.includes('organisationType')) {
      console.log('  ❌ Phase 2 columns do not exist in this database — migration has NOT been applied');
    } else {
      console.log(`  ERROR: ${e.message.split('\n')[0]}`);
    }
  }

  sep();
  console.log('DB state check complete (read-only). No data was modified.');
  console.log('='.repeat(72));
}

main()
  .catch(e => { console.error('Script error:', e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
