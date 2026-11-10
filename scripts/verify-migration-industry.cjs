/**
 * verify-migration-industry.cjs
 *
 * Records the migration in _prisma_migrations and verifies all schema
 * changes are present. Run after apply-and-verify-migration-industry.cjs
 * exits cleanly on the SQL application steps.
 */

const { PrismaClient } = require('@prisma/client');

process.env.DATABASE_URL =
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL;

const prisma = new PrismaClient();

async function main() {
  const MIG_NAME = '20261109000001_add_provider_industry_and_discovery';

  // ── Record in _prisma_migrations (idempotent) ─────────────────────────────
  const existing = await prisma.$queryRaw`
    SELECT id FROM "_prisma_migrations"
    WHERE migration_name = ${MIG_NAME}
    LIMIT 1
  `;

  if (existing.length === 0) {
    await prisma.$executeRaw`
      INSERT INTO "_prisma_migrations"
        (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      VALUES
        (gen_random_uuid()::text,
         '00000000000000000000000000000000',
         NOW(), ${MIG_NAME}, NULL, NULL, NOW(), 1)
    `;
    console.log(`✓ Recorded in _prisma_migrations: ${MIG_NAME}`);
  } else {
    console.log(`~ Already recorded in _prisma_migrations (id=${existing[0].id})`);
  }

  // ── Verification ──────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(72));
  console.log('VERIFICATION — 2026-11-10');
  console.log('='.repeat(72));

  // V1: Provider.industry
  const industryCol = await prisma.$queryRaw`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Provider' AND column_name = 'industry'
  `;
  console.log(industryCol.length > 0
    ? `\nV1 ✅ Provider.industry  type=${industryCol[0].data_type}  nullable=${industryCol[0].is_nullable}`
    : `\nV1 ❌ Provider.industry MISSING`);

  // V2: ProviderDiscovery columns
  const pdCols = await prisma.$queryRaw`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ProviderDiscovery'
    ORDER BY ordinal_position
  `;
  if (pdCols.length > 0) {
    console.log(`\nV2 ✅ ProviderDiscovery table (${pdCols.length} columns):`);
    for (const c of pdCols) {
      console.log(`   ${c.column_name}  ${c.data_type}  nullable=${c.is_nullable}`);
    }
  } else {
    console.log(`\nV2 ❌ ProviderDiscovery MISSING`);
  }

  // V3: Unique index
  const uidx = await prisma.$queryRaw`
    SELECT indexname FROM pg_indexes
    WHERE schemaname='public' AND tablename='ProviderDiscovery'
      AND indexname='ProviderDiscovery_providerId_key'
  `;
  console.log(uidx.length > 0
    ? `\nV3 ✅ UNIQUE INDEX ProviderDiscovery_providerId_key`
    : `\nV3 ❌ UNIQUE INDEX ProviderDiscovery_providerId_key MISSING`);

  // V4: FK constraint
  const fk = await prisma.$queryRaw`
    SELECT constraint_name FROM information_schema.table_constraints
    WHERE table_name='ProviderDiscovery'
      AND constraint_name='ProviderDiscovery_providerId_fkey'
      AND constraint_type='FOREIGN KEY'
  `;
  console.log(fk.length > 0
    ? `\nV4 ✅ FK ProviderDiscovery_providerId_fkey`
    : `\nV4 ❌ FK ProviderDiscovery_providerId_fkey MISSING`);

  // V5: _prisma_migrations record
  const migRec = await prisma.$queryRaw`
    SELECT migration_name, finished_at, applied_steps_count
    FROM "_prisma_migrations"
    WHERE migration_name = ${MIG_NAME}
  `;
  if (migRec.length > 0) {
    console.log(`\nV5 ✅ _prisma_migrations record`);
    console.log(`   finished_at=${migRec[0].finished_at}`);
    console.log(`   applied_steps_count=${migRec[0].applied_steps_count}`);
  } else {
    console.log(`\nV5 ❌ _prisma_migrations record MISSING`);
  }

  // V6: Prisma live query on industry column + null-industry counts
  const counts = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int                                              AS total_providers,
      COUNT(CASE WHEN industry IS NULL     THEN 1 END)::int     AS null_industry,
      COUNT(CASE WHEN industry IS NOT NULL THEN 1 END)::int     AS has_industry,
      COUNT(CASE WHEN "businessModel"='MARKETPLACE' THEN 1 END)::int AS marketplace,
      COUNT(CASE WHEN "businessModel"='SAAS'        THEN 1 END)::int AS saas
    FROM "Provider"
  `;
  const r = counts[0];
  console.log(`\nV6 ✅ Provider.industry live query:`);
  console.log(`   total_providers=${r.total_providers}`);
  console.log(`   null_industry=${r.null_industry}`);
  console.log(`   has_industry=${r.has_industry}`);
  console.log(`   marketplace=${r.marketplace}  saas=${r.saas}`);

  // V7: SAAS providers with DrivingProviderProfile (the key classification signal)
  const saasDriving = await prisma.$queryRaw`
    SELECT COUNT(*)::int as count
    FROM "Provider" p
    INNER JOIN "DrivingProviderProfile" dp ON dp."providerId" = p.id
    WHERE p."businessModel" = 'SAAS'
  `;
  console.log(`\nV7   SAAS + DrivingProviderProfile: ${saasDriving[0].count} (safe to backfill industry='driving')`);

  // V8: SAAS providers WITHOUT DrivingProviderProfile
  const saasNoDriving = await prisma.$queryRaw`
    SELECT COUNT(*)::int as count
    FROM "Provider" p
    LEFT JOIN "DrivingProviderProfile" dp ON dp."providerId" = p.id
    WHERE p."businessModel" = 'SAAS'
      AND dp."providerId" IS NULL
  `;
  console.log(`   SAAS + no DrivingProfile: ${saasNoDriving[0].count} (manual review required before backfill)`);

  // V9: MARKETPLACE providers (all null industry — safe to backfill)
  const marketplace = await prisma.$queryRaw`
    SELECT COUNT(*)::int as count FROM "Provider" WHERE "businessModel" = 'MARKETPLACE'
  `;
  console.log(`   MARKETPLACE (all safe to backfill industry='driving'): ${marketplace[0].count}`);

  console.log('\n' + '='.repeat(72));
  console.log('All verification steps complete.');
  console.log('Record this output in PHASE1-PROVIDER-INDUSTRY-AUDIT-REPORT.md.');
  console.log('='.repeat(72));
}

main()
  .catch(e => { console.error('Failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
