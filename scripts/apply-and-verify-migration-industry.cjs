/**
 * apply-and-verify-migration-industry.cjs
 *
 * Step 1: Apply the industry + ProviderDiscovery migration to production.
 * Step 2: Verify the schema changes are present and correct.
 * Step 3: Confirm the migration is recorded in _prisma_migrations.
 *
 * Uses raw SQL via Prisma's $executeRawUnsafe to apply the migration,
 * then queries information_schema to verify columns, tables, indexes
 * and constraints. Matches the approach used in previous migrations
 * (apply-v11-migration.mjs, etc.).
 *
 * READS from: prisma/migrations/20261109000001_add_provider_industry_and_discovery/migration.sql
 * WRITES to:  production DB (Provider.industry column + ProviderDiscovery table)
 *
 * Run from repo root:
 *   node --env-file=.env.local scripts/apply-and-verify-migration-industry.cjs
 */

const fs   = require('fs');
const path = require('path');

// Override DATABASE_URL to direct connection (bypass PgBouncer for DDL)
// PgBouncer in transaction mode doesn't support all DDL.
process.env.DATABASE_URL =
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL;

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(72));
  console.log('Migration: 20261109000001_add_provider_industry_and_discovery');
  console.log('='.repeat(72));

  // ── Check if already applied ───────────────────────────────────────────────
  const alreadyApplied = await prisma.$queryRaw`
    SELECT migration_name, finished_at
    FROM "_prisma_migrations"
    WHERE migration_name = '20261109000001_add_provider_industry_and_discovery'
    LIMIT 1
  `.catch(() => []);

  if (alreadyApplied.length > 0) {
    console.log('\nMigration already recorded in _prisma_migrations:');
    console.log('  finished_at:', alreadyApplied[0].finished_at);
    console.log('Skipping execution. Running verification only.');
  } else {
    // ── Check if column already exists (manual application or partial run) ───
    const columnExists = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'Provider'
        AND column_name  = 'industry'
    `.catch(() => []);

    const tableExists = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name   = 'ProviderDiscovery'
    `.catch(() => []);

    if (columnExists.length > 0 && tableExists.length > 0) {
      console.log('\nColumn and table already exist in DB (not in _prisma_migrations).');
      console.log('Proceeding to record the migration and run verification.');
    } else {
      // ── Apply the migration SQL ──────────────────────────────────────────────
      console.log('\nApplying migration SQL...');

      // Statement 1: Add industry column
      if (columnExists.length === 0) {
        await prisma.$executeRawUnsafe(`ALTER TABLE "Provider" ADD COLUMN "industry" TEXT`);
        console.log('  ✓ ALTER TABLE "Provider" ADD COLUMN "industry" TEXT');
      } else {
        console.log('  ~ "industry" column already exists, skipping ADD COLUMN');
      }

      // Statement 2: Create ProviderDiscovery table
      if (tableExists.length === 0) {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE "ProviderDiscovery" (
            "id"            TEXT NOT NULL,
            "providerId"    TEXT NOT NULL,
            "selectedGoals" JSONB,
            "otherNeeds"    TEXT,
            "skipped"       BOOLEAN NOT NULL DEFAULT false,
            "submittedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "ProviderDiscovery_pkey" PRIMARY KEY ("id")
          )
        `);
        console.log('  ✓ CREATE TABLE "ProviderDiscovery"');
      } else {
        console.log('  ~ "ProviderDiscovery" table already exists, skipping CREATE TABLE');
      }

      // Statement 3: Unique index on providerId
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "ProviderDiscovery_providerId_key"
        ON "ProviderDiscovery"("providerId")
      `);
      console.log('  ✓ CREATE UNIQUE INDEX "ProviderDiscovery_providerId_key"');

      // Statement 4: Foreign key
      const fkExists = await prisma.$queryRaw`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name      = 'ProviderDiscovery'
          AND constraint_name = 'ProviderDiscovery_providerId_fkey'
          AND constraint_type = 'FOREIGN KEY'
      `.catch(() => []);

      if (fkExists.length === 0) {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "ProviderDiscovery"
          ADD CONSTRAINT "ProviderDiscovery_providerId_fkey"
          FOREIGN KEY ("providerId") REFERENCES "Provider"("id")
          ON DELETE CASCADE ON UPDATE CASCADE
        `);
        console.log('  ✓ ADD CONSTRAINT "ProviderDiscovery_providerId_fkey"');
      } else {
        console.log('  ~ FK constraint already exists, skipping');
      }

      // Statement 5: Regular index (redundant but matches migration SQL)
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "ProviderDiscovery_providerId_idx"
        ON "ProviderDiscovery"("providerId")
      `);
      console.log('  ✓ CREATE INDEX "ProviderDiscovery_providerId_idx"');

      console.log('\nMigration SQL applied.');
    }

    // ── Record in _prisma_migrations ─────────────────────────────────────────
    console.log('\nRecording migration in _prisma_migrations...');
    await prisma.$executeRawUnsafe(`
      INSERT INTO "_prisma_migrations"
        (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      VALUES
        (gen_random_uuid()::text,
         '00000000000000000000000000000000',
         NOW(), '20261109000001_add_provider_industry_and_discovery',
         NULL, NULL, NOW(), 1)
      ON CONFLICT (migration_name) DO NOTHING
    `);
    console.log('  ✓ _prisma_migrations record inserted (or already present)');
  }

  // ── Verification ──────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(72));
  console.log('VERIFICATION');
  console.log('='.repeat(72));

  // V1: Provider.industry column exists
  const industryCol = await prisma.$queryRaw`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'Provider'
      AND column_name  = 'industry'
  `;
  if (industryCol.length > 0) {
    const col = industryCol[0];
    console.log(`\nV1 ✅ Provider.industry exists`);
    console.log(`   data_type=${col.data_type}  is_nullable=${col.is_nullable}`);
  } else {
    console.log('\nV1 ❌ Provider.industry MISSING');
  }

  // V2: ProviderDiscovery table exists with expected columns
  const pdCols = await prisma.$queryRaw`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'ProviderDiscovery'
    ORDER BY ordinal_position
  `;
  if (pdCols.length > 0) {
    console.log(`\nV2 ✅ ProviderDiscovery table exists (${pdCols.length} columns):`);
    for (const col of pdCols) {
      console.log(`   ${col.column_name}  ${col.data_type}  nullable=${col.is_nullable}`);
    }
  } else {
    console.log('\nV2 ❌ ProviderDiscovery table MISSING or has no columns');
  }

  // V3: Unique index on providerId
  const uniqueIdx = await prisma.$queryRaw`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'ProviderDiscovery'
      AND indexname  = 'ProviderDiscovery_providerId_key'
  `;
  console.log(uniqueIdx.length > 0
    ? `\nV3 ✅ UNIQUE INDEX "ProviderDiscovery_providerId_key" exists`
    : `\nV3 ❌ UNIQUE INDEX "ProviderDiscovery_providerId_key" MISSING`);

  // V4: Foreign key constraint
  const fkCheck = await prisma.$queryRaw`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name      = 'ProviderDiscovery'
      AND constraint_name = 'ProviderDiscovery_providerId_fkey'
      AND constraint_type = 'FOREIGN KEY'
  `;
  console.log(fkCheck.length > 0
    ? `\nV4 ✅ FK constraint "ProviderDiscovery_providerId_fkey" exists`
    : `\nV4 ❌ FK constraint "ProviderDiscovery_providerId_fkey" MISSING`);

  // V5: Migration recorded in _prisma_migrations
  const migRecord = await prisma.$queryRaw`
    SELECT migration_name, finished_at, applied_steps_count
    FROM "_prisma_migrations"
    WHERE migration_name = '20261109000001_add_provider_industry_and_discovery'
  `;
  if (migRecord.length > 0) {
    console.log(`\nV5 ✅ Migration recorded in _prisma_migrations`);
    console.log(`   finished_at=${migRecord[0].finished_at}`);
    console.log(`   applied_steps_count=${migRecord[0].applied_steps_count}`);
  } else {
    console.log(`\nV5 ❌ Migration NOT recorded in _prisma_migrations`);
  }

  // V6: Prisma can query the new column
  try {
    const testQuery = await prisma.$queryRaw`
      SELECT COUNT(*)::int as total,
             COUNT(CASE WHEN industry IS NULL THEN 1 END)::int as null_industry,
             COUNT(CASE WHEN industry IS NOT NULL THEN 1 END)::int as has_industry
      FROM "Provider"
    `;
    const r = testQuery[0];
    console.log(`\nV6 ✅ Prisma can query Provider.industry`);
    console.log(`   total providers=${r.total}  null industry=${r.null_industry}  has industry=${r.has_industry}`);
  } catch (e) {
    console.log(`\nV6 ❌ Prisma query on Provider.industry failed: ${e.message}`);
  }

  console.log('\n' + '='.repeat(72));
  console.log('Migration and verification complete.');
  console.log('Copy this output into docs/audit/PHASE1-PROVIDER-INDUSTRY-AUDIT-REPORT.md');
  console.log('as the Migration Execution Evidence section.');
  console.log('='.repeat(72));
}

main()
  .catch(err => {
    console.error('\nScript failed:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
