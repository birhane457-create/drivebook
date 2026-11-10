/**
 * migration-reconciliation.cjs
 *
 * READ-ONLY investigation.
 *
 * 1. Calculates the SHA-256 checksum of the committed migration SQL file
 *    (the format Prisma uses).
 * 2. Queries information_schema for the exact production schema definitions
 *    of Provider.industry and all ProviderDiscovery columns (including defaults).
 * 3. Retrieves the _prisma_migrations record and its stored checksum.
 * 4. Compares committed SQL vs production vs migration record.
 *
 * Makes NO changes to production data or schema.
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

process.env.DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;

const prisma = new PrismaClient();

const MIG_NAME = '20261109000001_add_provider_industry_and_discovery';
const MIG_FILE = path.join(
  __dirname, '..', 'prisma', 'migrations',
  MIG_NAME, 'migration.sql'
);

// Prisma checksum: SHA-256 of the raw file bytes, hex-encoded
function prismaChecksum(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function main() {
  console.log('='.repeat(72));
  console.log('Phase 1 — Migration Reconciliation (READ-ONLY)');
  console.log(`Migration: ${MIG_NAME}`);
  console.log('='.repeat(72));

  // ── 1. Committed migration file checksum ───────────────────────────────────
  const fileContent = fs.readFileSync(MIG_FILE, 'utf8');
  const expectedChecksum = prismaChecksum(MIG_FILE);

  console.log('\n── 1. COMMITTED MIGRATION FILE ──────────────────────────────────');
  console.log(`File: ${MIG_FILE}`);
  console.log(`Size: ${fs.statSync(MIG_FILE).size} bytes`);
  console.log(`SHA-256: ${expectedChecksum}`);
  console.log('\nSQL content:');
  console.log(fileContent);

  // ── 2. Production _prisma_migrations record ────────────────────────────────
  console.log('\n── 2. _PRISMA_MIGRATIONS RECORD ─────────────────────────────────');
  const migRecords = await prisma.$queryRaw`
    SELECT id, checksum, finished_at, migration_name, logs, rolled_back_at,
           started_at, applied_steps_count
    FROM "_prisma_migrations"
    WHERE migration_name = ${MIG_NAME}
  `;

  if (migRecords.length === 0) {
    console.log('No record found in _prisma_migrations.');
  } else {
    for (const r of migRecords) {
      console.log(`id:                  ${r.id}`);
      console.log(`migration_name:      ${r.migration_name}`);
      console.log(`checksum (stored):   ${r.checksum}`);
      console.log(`checksum (expected): ${expectedChecksum}`);
      console.log(`checksums match:     ${r.checksum === expectedChecksum ? 'YES ✅' : 'NO ❌'}`);
      console.log(`started_at:          ${r.started_at}`);
      console.log(`finished_at:         ${r.finished_at}`);
      console.log(`applied_steps_count: ${r.applied_steps_count}`);
      console.log(`logs:                ${r.logs}`);
      console.log(`rolled_back_at:      ${r.rolled_back_at}`);
    }
  }

  // ── 3. Provider.industry — exact production column definition ─────────────
  console.log('\n── 3. PRODUCTION: Provider.industry ─────────────────────────────');
  const industryDef = await prisma.$queryRaw`
    SELECT
      column_name,
      data_type,
      character_maximum_length,
      is_nullable,
      column_default,
      udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'Provider'
      AND column_name  = 'industry'
  `;
  if (industryDef.length === 0) {
    console.log('Provider.industry: MISSING');
  } else {
    const c = industryDef[0];
    console.log(`column_name:  ${c.column_name}`);
    console.log(`data_type:    ${c.data_type}  (udt_name: ${c.udt_name})`);
    console.log(`is_nullable:  ${c.is_nullable}`);
    console.log(`column_default: ${c.column_default ?? 'none'}`);
    console.log(`max_length:   ${c.character_maximum_length ?? 'n/a'}`);
    // Compare with migration SQL
    console.log('\nCommitted SQL: ALTER TABLE "Provider" ADD COLUMN "industry" TEXT;');
    console.log(`Match: data_type=${c.data_type === 'text' ? 'YES' : 'MISMATCH'}  nullable=${c.is_nullable === 'YES' ? 'YES' : 'MISMATCH'}  default=${c.column_default === null ? 'none (matches — no default in SQL)' : 'UNEXPECTED: ' + c.column_default}`);
  }

  // ── 4. ProviderDiscovery — all columns with defaults ─────────────────────
  console.log('\n── 4. PRODUCTION: ProviderDiscovery columns ─────────────────────');
  const pdCols = await prisma.$queryRaw`
    SELECT
      ordinal_position,
      column_name,
      data_type,
      is_nullable,
      column_default,
      character_maximum_length,
      udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'ProviderDiscovery'
    ORDER BY ordinal_position
  `;

  if (pdCols.length === 0) {
    console.log('ProviderDiscovery: MISSING');
  } else {
    console.log(`Found ${pdCols.length} columns:\n`);

    // Expected definitions from committed migration SQL
    const expected = {
      id:            { data_type: 'text',      nullable: 'NO',  default: null },
      providerId:    { data_type: 'text',      nullable: 'NO',  default: null },
      selectedGoals: { data_type: 'jsonb',     nullable: 'YES', default: null },
      otherNeeds:    { data_type: 'text',      nullable: 'YES', default: null },
      skipped:       { data_type: 'boolean',   nullable: 'NO',  default: 'false' },
      submittedAt:   { data_type: 'timestamp without time zone', nullable: 'NO', default: 'CURRENT_TIMESTAMP' },
      updatedAt:     { data_type: 'timestamp without time zone', nullable: 'NO', default: null }, // NO default in committed SQL
    };

    for (const c of pdCols) {
      const exp = expected[c.column_name];
      const dataTypeMatch   = exp ? c.data_type === exp.data_type : '(unexpected column)';
      const nullableMatch   = exp ? c.is_nullable === exp.nullable : '(unexpected column)';
      // Default comparison: normalize CURRENT_TIMESTAMP variants
      const prodDefault     = c.column_default;
      const committedDefault = exp ? exp.default : '(unknown)';
      const defaultMatch    = !exp ? '(unexpected column)'
        : prodDefault === null && committedDefault === null ? 'match'
        : prodDefault === null && committedDefault !== null ? `DISCREPANCY: committed has "${committedDefault}", production has none`
        : prodDefault !== null && committedDefault === null ? `DISCREPANCY: production has "${prodDefault}", committed has none`
        : (prodDefault?.includes('CURRENT_TIMESTAMP') || prodDefault?.includes('now()')) &&
          committedDefault === 'CURRENT_TIMESTAMP' ? 'match (CURRENT_TIMESTAMP variant)'
        : prodDefault === committedDefault ? 'match'
        : `DISCREPANCY: committed="${committedDefault}" production="${prodDefault}"`;

      console.log(`Column: ${c.column_name}`);
      console.log(`  data_type:    ${c.data_type}  ${typeof dataTypeMatch === 'string' ? (dataTypeMatch === true || dataTypeMatch === c.data_type ? '' : '⚠️ ' + dataTypeMatch) : ''}`);
      console.log(`  is_nullable:  ${c.is_nullable}`);
      console.log(`  column_default: ${prodDefault ?? 'none'}`);
      console.log(`  committed default: ${committedDefault ?? 'none'}`);
      console.log(`  default match: ${defaultMatch}`);
      console.log('');
    }
  }

  // ── 5. ProviderDiscovery indexes ──────────────────────────────────────────
  console.log('\n── 5. PRODUCTION: ProviderDiscovery indexes ─────────────────────');
  const indexes = await prisma.$queryRaw`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'ProviderDiscovery'
    ORDER BY indexname
  `;
  for (const idx of indexes) {
    console.log(`${idx.indexname}:`);
    console.log(`  ${idx.indexdef}`);
  }

  // ── 6. ProviderDiscovery constraints ──────────────────────────────────────
  console.log('\n── 6. PRODUCTION: ProviderDiscovery constraints ─────────────────');
  const constraints = await prisma.$queryRaw`
    SELECT
      tc.constraint_name,
      tc.constraint_type,
      kcu.column_name,
      ccu.table_name  AS foreign_table,
      ccu.column_name AS foreign_column,
      rc.update_rule,
      rc.delete_rule
    FROM information_schema.table_constraints AS tc
    LEFT JOIN information_schema.key_column_usage AS kcu
           ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema    = kcu.table_schema
    LEFT JOIN information_schema.constraint_column_usage AS ccu
           ON tc.constraint_name = ccu.constraint_name
    LEFT JOIN information_schema.referential_constraints AS rc
           ON tc.constraint_name = rc.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name   = 'ProviderDiscovery'
    ORDER BY tc.constraint_type, tc.constraint_name
  `;
  for (const c of constraints) {
    console.log(`${c.constraint_name} (${c.constraint_type})`);
    if (c.foreign_table) {
      console.log(`  → ${c.foreign_table}.${c.foreign_column}  ON UPDATE ${c.update_rule}  ON DELETE ${c.delete_rule}`);
    }
  }

  // ── 7. All recent _prisma_migrations records (last 10) ────────────────────
  console.log('\n── 7. RECENT _PRISMA_MIGRATIONS (last 10 by finished_at) ─────────');
  const recentMigs = await prisma.$queryRaw`
    SELECT migration_name, checksum, finished_at, applied_steps_count, rolled_back_at
    FROM "_prisma_migrations"
    ORDER BY finished_at DESC NULLS LAST
    LIMIT 10
  `;
  for (const m of recentMigs) {
    const checksumNote = m.checksum === '00000000000000000000000000000000'
      ? '⚠️ ALL-ZERO (manually inserted)'
      : (m.migration_name === MIG_NAME && m.checksum === expectedChecksum ? '✅ matches committed file' : '');
    console.log(`${m.migration_name}`);
    console.log(`  finished_at=${m.finished_at}  steps=${m.applied_steps_count}  rolled_back=${m.rolled_back_at}`);
    console.log(`  checksum=${m.checksum}  ${checksumNote}`);
  }

  console.log('\n' + '='.repeat(72));
  console.log('Reconciliation investigation complete. No production changes made.');
  console.log('='.repeat(72));
}

main()
  .catch(e => { console.error('Failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
