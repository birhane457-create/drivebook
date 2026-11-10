/**
 * migration-reconciliation.cjs  (v2 — Phase 1 final reconciliation)
 *
 * READ-ONLY. Makes no production changes. Exits non-zero if any discrepancy
 * is found between the committed migration SQL and the production DB state.
 *
 * Checks:
 *  1. Committed migration file SHA-256 (must match _prisma_migrations.checksum)
 *  2. Provider.industry column (data_type, nullable, default)
 *  3. ProviderDiscovery table: all 7 columns (data_type, nullable, default)
 *  4. Unexpected or missing ProviderDiscovery columns
 *  5. All expected indexes present and correct
 *  6. FK constraint (ON DELETE CASCADE ON UPDATE CASCADE)
 *  7. _prisma_migrations record state (finished, not rolled back, correct checksum)
 *  8. Full production migration ledger vs migration directories on disk
 *  9. null-finished_at migration investigation
 *
 * Expected definitions are derived from the R1-corrected migration SQL.
 */

'use strict';

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

process.env.DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;

const prisma  = new PrismaClient();
const ROOT    = path.join(__dirname, '..');
const MIG_DIR = path.join(ROOT, 'prisma', 'migrations');
const MIG_NAME = '20261109000001_add_provider_industry_and_discovery';
const MIG_FILE = path.join(MIG_DIR, MIG_NAME, 'migration.sql');

// ── Helpers ───────────────────────────────────────────────────────────────────

function prismaChecksum(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function normalizeDefault(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().toLowerCase();
  // Postgres represents DEFAULT false as literal 'false'
  if (s === 'false') return 'false';
  // CURRENT_TIMESTAMP may appear as 'CURRENT_TIMESTAMP' or 'now()'
  if (s.includes('current_timestamp') || s === 'now()') return 'CURRENT_TIMESTAMP';
  return raw;
}

let discrepancies = 0;
let warnings = 0;

function ok(label)         { console.log(`  ✅ ${label}`); }
function fail(label)       { console.log(`  ❌ DISCREPANCY: ${label}`); discrepancies++; }
function warn(label)       { console.log(`  ⚠️  WARNING: ${label}`); warnings++; }
function info(label)       { console.log(`     ${label}`); }

// ── Expected definitions (R1-corrected migration SQL) ─────────────────────────

const EXPECTED_PROVIDER_INDUSTRY = {
  data_type:  'text',
  is_nullable: 'YES',
  column_default: null,
};

const EXPECTED_PD_COLUMNS = [
  { name: 'id',            data_type: 'text',                           is_nullable: 'NO',  column_default: null },
  { name: 'providerId',    data_type: 'text',                           is_nullable: 'NO',  column_default: null },
  { name: 'selectedGoals', data_type: 'jsonb',                          is_nullable: 'YES', column_default: null },
  { name: 'otherNeeds',    data_type: 'text',                           is_nullable: 'YES', column_default: null },
  { name: 'skipped',       data_type: 'boolean',                        is_nullable: 'NO',  column_default: 'false' },
  { name: 'submittedAt',   data_type: 'timestamp without time zone',    is_nullable: 'NO',  column_default: 'CURRENT_TIMESTAMP' },
  { name: 'updatedAt',     data_type: 'timestamp without time zone',    is_nullable: 'NO',  column_default: 'CURRENT_TIMESTAMP' }, // R1: DEFAULT added
];

const EXPECTED_INDEXES = [
  { name: 'ProviderDiscovery_pkey',         unique: true,  on: 'id' },
  { name: 'ProviderDiscovery_providerId_key', unique: true, on: 'providerId' },
  { name: 'ProviderDiscovery_providerId_idx', unique: false, on: 'providerId' },
];

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(72));
  console.log('Phase 1 — Migration Reconciliation v2 (READ-ONLY)');
  console.log(`Migration: ${MIG_NAME}`);
  console.log(`Script run at: ${new Date().toISOString()}`);
  console.log('='.repeat(72));

  // ── SECTION 1: Committed file checksum ───────────────────────────────────
  console.log('\n── SECTION 1: COMMITTED MIGRATION FILE ──────────────────────────');
  const fileContent  = fs.readFileSync(MIG_FILE, 'utf8');
  const fileSize     = fs.statSync(MIG_FILE).size;
  const expectedHash = prismaChecksum(MIG_FILE);
  info(`File: prisma/migrations/${MIG_NAME}/migration.sql`);
  info(`Size: ${fileSize} bytes`);
  info(`SHA-256: ${expectedHash}`);
  console.log('\nSQL (full):');
  console.log(fileContent);

  // ── SECTION 2: _prisma_migrations record for this migration ──────────────
  console.log('\n── SECTION 2: _PRISMA_MIGRATIONS RECORD ─────────────────────────');
  const migRecords = await prisma.$queryRaw`
    SELECT id, checksum, finished_at, migration_name, logs, rolled_back_at,
           started_at, applied_steps_count
    FROM "_prisma_migrations"
    WHERE migration_name = ${MIG_NAME}
  `;

  if (migRecords.length === 0) {
    fail('No record in _prisma_migrations');
  } else if (migRecords.length > 1) {
    warn(`${migRecords.length} records in _prisma_migrations for this migration (expected 1)`);
  } else {
    const r = migRecords[0];
    info(`id:                  ${r.id}`);
    info(`migration_name:      ${r.migration_name}`);
    info(`checksum (stored):   ${r.checksum}`);
    info(`checksum (expected): ${expectedHash}`);
    info(`started_at:          ${r.started_at}`);
    info(`finished_at:         ${r.finished_at}`);
    info(`applied_steps_count: ${r.applied_steps_count}`);
    info(`rolled_back_at:      ${r.rolled_back_at ?? 'null'}`);
    info(`logs:                ${r.logs ?? 'null'}`);

    if (r.checksum === expectedHash) {
      ok('Checksum matches committed file');
    } else {
      fail(`Checksum mismatch — stored: ${r.checksum}  expected: ${expectedHash}`);
    }
    if (r.finished_at !== null) {
      ok('finished_at is set (migration recorded as applied)');
    } else {
      fail('finished_at is NULL — migration not recorded as successfully applied');
    }
    if (r.rolled_back_at === null) {
      ok('rolled_back_at is NULL (not rolled back)');
    } else {
      fail(`rolled_back_at is set: ${r.rolled_back_at}`);
    }
    if (r.applied_steps_count >= 1) {
      ok(`applied_steps_count = ${r.applied_steps_count}`);
    } else {
      fail(`applied_steps_count = ${r.applied_steps_count} (expected >= 1)`);
    }
  }

  // ── SECTION 3: Provider.industry ─────────────────────────────────────────
  console.log('\n── SECTION 3: Provider.industry ─────────────────────────────────');
  const industryCols = await prisma.$queryRaw`
    SELECT column_name, data_type, is_nullable, column_default, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Provider' AND column_name = 'industry'
  `;
  if (industryCols.length === 0) {
    fail('Provider.industry column is MISSING from production');
  } else {
    const c = industryCols[0];
    info(`data_type=${c.data_type}  is_nullable=${c.is_nullable}  column_default=${c.column_default ?? 'none'}`);

    c.data_type === EXPECTED_PROVIDER_INDUSTRY.data_type
      ? ok(`data_type = '${c.data_type}' (expected '${EXPECTED_PROVIDER_INDUSTRY.data_type}')`)
      : fail(`data_type MISMATCH: production='${c.data_type}' expected='${EXPECTED_PROVIDER_INDUSTRY.data_type}'`);

    c.is_nullable === EXPECTED_PROVIDER_INDUSTRY.is_nullable
      ? ok(`is_nullable = '${c.is_nullable}' (expected '${EXPECTED_PROVIDER_INDUSTRY.is_nullable}')`)
      : fail(`is_nullable MISMATCH: production='${c.is_nullable}' expected='${EXPECTED_PROVIDER_INDUSTRY.is_nullable}'`);

    const prodDef  = normalizeDefault(c.column_default);
    const expDef   = normalizeDefault(EXPECTED_PROVIDER_INDUSTRY.column_default);
    prodDef === expDef
      ? ok(`column_default = ${prodDef ?? 'none'} (expected ${expDef ?? 'none'})`)
      : fail(`column_default MISMATCH: production='${prodDef}' expected='${expDef}'`);
  }

  // ── SECTION 4: ProviderDiscovery columns ─────────────────────────────────
  console.log('\n── SECTION 4: ProviderDiscovery columns ─────────────────────────');
  const pdCols = await prisma.$queryRaw`
    SELECT ordinal_position, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ProviderDiscovery'
    ORDER BY ordinal_position
  `;

  if (pdCols.length === 0) {
    fail('ProviderDiscovery table is MISSING from production');
  } else {
    info(`Found ${pdCols.length} column(s) in production`);
    const expectedNames = EXPECTED_PD_COLUMNS.map(e => e.name);
    const prodNames     = pdCols.map(c => c.column_name);

    // Check for missing columns
    for (const expName of expectedNames) {
      if (!prodNames.includes(expName)) fail(`Column '${expName}' is MISSING from production`);
    }
    // Check for unexpected columns
    for (const prodName of prodNames) {
      if (!expectedNames.includes(prodName)) warn(`Unexpected column '${prodName}' in production (not in committed SQL)`);
    }

    // Check each expected column
    for (const exp of EXPECTED_PD_COLUMNS) {
      const col = pdCols.find(c => c.column_name === exp.name);
      if (!col) continue; // already reported as missing above

      const prodDef = normalizeDefault(col.column_default);
      const expDef  = normalizeDefault(exp.column_default);

      const typeOk     = col.data_type   === exp.data_type;
      const nullOk     = col.is_nullable === exp.is_nullable;
      const defaultOk  = prodDef === expDef;

      if (typeOk && nullOk && defaultOk) {
        ok(`${exp.name}: type=${col.data_type} nullable=${col.is_nullable} default=${prodDef ?? 'none'}`);
      } else {
        if (!typeOk)    fail(`${exp.name}: data_type MISMATCH — production='${col.data_type}' expected='${exp.data_type}'`);
        if (!nullOk)    fail(`${exp.name}: is_nullable MISMATCH — production='${col.is_nullable}' expected='${exp.is_nullable}'`);
        if (!defaultOk) fail(`${exp.name}: column_default MISMATCH — production='${prodDef}' expected='${expDef ?? 'none'}'`);
        if (typeOk && nullOk) info(`  (${exp.name}: type and nullability are correct)`);
      }
    }
  }

  // ── SECTION 5: ProviderDiscovery indexes ─────────────────────────────────
  console.log('\n── SECTION 5: ProviderDiscovery indexes ─────────────────────────');
  const indexes = await prisma.$queryRaw`
    SELECT indexname, indexdef,
           ix.indisunique AS is_unique
    FROM pg_indexes pi2
    JOIN pg_class c ON c.relname = pi2.indexname
    JOIN pg_index ix ON ix.indexrelid = c.oid
    WHERE pi2.schemaname = 'public' AND pi2.tablename = 'ProviderDiscovery'
    ORDER BY pi2.indexname
  `;
  info(`Found ${indexes.length} index(es) in production`);
  for (const idx of indexes) {
    info(`  ${idx.indexname}: ${idx.indexdef}`);
  }

  for (const expIdx of EXPECTED_INDEXES) {
    const found = indexes.find(i => i.indexname === expIdx.name);
    if (!found) {
      fail(`Index '${expIdx.name}' is MISSING`);
      continue;
    }
    const colMentioned = found.indexdef.toLowerCase().includes(expIdx.on.toLowerCase());
    colMentioned
      ? ok(`Index '${expIdx.name}' exists and references column '${expIdx.on}'`)
      : fail(`Index '${expIdx.name}' exists but does not reference expected column '${expIdx.on}' — def: ${found.indexdef}`);
    if (expIdx.unique && !found.is_unique) fail(`Index '${expIdx.name}' should be UNIQUE but is not`);
    if (!expIdx.unique && found.is_unique) warn(`Index '${expIdx.name}' is UNIQUE but was expected as non-unique`);
    if (expIdx.unique && found.is_unique) ok(`Index '${expIdx.name}' is UNIQUE (expected)`);
  }

  // Check for unexpected indexes (excluding pkey which is auto-created)
  const expectedIdxNames = EXPECTED_INDEXES.map(e => e.name);
  for (const idx of indexes) {
    if (!expectedIdxNames.includes(idx.indexname)) {
      warn(`Unexpected index '${idx.indexname}' (not in committed SQL) — def: ${idx.indexdef}`);
    }
  }

  // ── SECTION 6: ProviderDiscovery FK and cascade rules ────────────────────
  console.log('\n── SECTION 6: ProviderDiscovery FK constraint ───────────────────');
  const fks = await prisma.$queryRaw`
    SELECT
      tc.constraint_name,
      tc.constraint_type,
      kcu.column_name,
      ccu.table_name  AS foreign_table,
      ccu.column_name AS foreign_column,
      rc.update_rule,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema    = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name   = 'ProviderDiscovery'
      AND tc.constraint_type = 'FOREIGN KEY'
  `;

  const fk = fks.find(f => f.constraint_name === 'ProviderDiscovery_providerId_fkey');
  if (!fk) {
    fail('FK constraint "ProviderDiscovery_providerId_fkey" is MISSING');
  } else {
    info(`constraint: ${fk.constraint_name}`);
    info(`column: ${fk.column_name}  →  ${fk.foreign_table}.${fk.foreign_column}`);
    info(`ON UPDATE ${fk.update_rule}  ON DELETE ${fk.delete_rule}`);

    fk.column_name     === 'providerId'  ? ok('FK column is providerId')             : fail(`FK column MISMATCH: '${fk.column_name}'`);
    fk.foreign_table   === 'Provider'    ? ok('FK references Provider table')        : fail(`FK foreign table MISMATCH: '${fk.foreign_table}'`);
    fk.foreign_column  === 'id'          ? ok('FK references Provider.id')           : fail(`FK foreign column MISMATCH: '${fk.foreign_column}'`);
    fk.update_rule     === 'CASCADE'     ? ok('ON UPDATE CASCADE (matches committed)') : fail(`ON UPDATE MISMATCH: production='${fk.update_rule}' expected='CASCADE'`);
    fk.delete_rule     === 'CASCADE'     ? ok('ON DELETE CASCADE (matches committed)') : fail(`ON DELETE MISMATCH: production='${fk.delete_rule}' expected='CASCADE'`);
  }

  // ── SECTION 7: Full migration ledger ─────────────────────────────────────
  console.log('\n── SECTION 7: COMPLETE _PRISMA_MIGRATIONS LEDGER ────────────────');
  const allMigs = await prisma.$queryRaw`
    SELECT migration_name, id, checksum, started_at, finished_at,
           rolled_back_at, applied_steps_count, logs
    FROM "_prisma_migrations"
    ORDER BY started_at ASC NULLS LAST
  `;
  info(`Total records in _prisma_migrations: ${allMigs.length}`);
  console.log('');

  for (const m of allMigs) {
    const state =
      m.rolled_back_at !== null                                     ? 'ROLLED_BACK' :
      m.finished_at    !== null && m.applied_steps_count >= 1       ? 'APPLIED' :
      m.finished_at    !== null && m.applied_steps_count === 0      ? 'APPLIED_NO_STEPS' :
      m.finished_at    === null && m.logs !== null                  ? 'FAILED' :
      m.finished_at    === null                                     ? 'INCOMPLETE/PENDING' :
      'UNKNOWN';

    const checksumFlag = m.checksum === '00000000000000000000000000000000'
      ? ' ⚠️  ALL-ZERO'
      : m.migration_name === MIG_NAME && m.checksum === expectedHash
        ? ' ✅ matches committed file'
        : '';

    console.log(`${m.migration_name}`);
    info(`id=${m.id}`);
    info(`state=${state}  steps=${m.applied_steps_count}`);
    info(`started_at=${m.started_at ?? 'null'}  finished_at=${m.finished_at ?? 'null'}`);
    info(`rolled_back_at=${m.rolled_back_at ?? 'null'}`);
    info(`checksum=${m.checksum}${checksumFlag}`);
    if (m.logs) info(`logs=${m.logs}`);
    console.log('');
  }

  // ── SECTION 8: Null-finished_at investigation ─────────────────────────────
  console.log('\n── SECTION 8: NULL finished_at INVESTIGATION ────────────────────');
  const nullFinished = allMigs.filter(m => m.finished_at === null);
  if (nullFinished.length === 0) {
    ok('No records with null finished_at');
  } else {
    for (const m of nullFinished) {
      warn(`Migration '${m.migration_name}' has null finished_at`);
      info(`  rolled_back_at: ${m.rolled_back_at ?? 'null'}`);
      info(`  applied_steps_count: ${m.applied_steps_count}`);
      info(`  logs: ${m.logs ?? 'null'}`);

      if (m.rolled_back_at !== null) {
        info(`  Assessment: explicitly rolled back — not necessarily a problem`);
      } else if (m.applied_steps_count === 0 && m.logs === null) {
        warn(`  Assessment: steps=0, no logs, not rolled back — state is AMBIGUOUS`);
      } else if (m.logs !== null) {
        warn(`  Assessment: has logs — likely failed during application`);
      } else {
        warn(`  Assessment: null finished_at with no roll-back record — requires investigation`);
      }
    }
  }

  // ── SECTION 9: Migration directories on disk vs ledger ───────────────────
  console.log('\n── SECTION 9: MIGRATION DIRS ON DISK VS LEDGER ─────────────────');
  const migDirs = fs.readdirSync(MIG_DIR)
    .filter(d => {
      const full = path.join(MIG_DIR, d);
      return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, 'migration.sql'));
    })
    .sort();

  const recordedNames = new Set(allMigs.map(m => m.migration_name));
  info(`Migration directories on disk: ${migDirs.length}`);
  info(`Records in _prisma_migrations: ${allMigs.length}`);
  console.log('');

  let recorded = 0, notRecorded = 0;
  for (const dir of migDirs) {
    if (recordedNames.has(dir)) {
      const rec = allMigs.find(m => m.migration_name === dir);
      const state = rec.finished_at ? 'RECORDED+APPLIED' : 'RECORDED+NULL_FINISHED';
      info(`  [${state}] ${dir}`);
      recorded++;
    } else {
      info(`  [NOT_RECORDED]   ${dir}`);
      notRecorded++;
    }
  }
  console.log('');
  info(`Summary: ${recorded} recorded, ${notRecorded} not recorded in _prisma_migrations`);
  if (notRecorded > 0) {
    warn(`${notRecorded} migration(s) applied outside prisma migrate deploy. ` +
         `prisma migrate status will report these as pending.`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(72));
  console.log('SUMMARY');
  console.log('='.repeat(72));
  if (discrepancies === 0 && warnings === 0) {
    console.log('\nResult: ALL CHECKS PASS. No discrepancies or warnings.');
  } else {
    if (discrepancies > 0) console.log(`\n❌ ${discrepancies} discrepancy/discrepancies found (see above)`);
    if (warnings > 0)      console.log(`\n⚠️  ${warnings} warning(s) found (see above)`);
  }
  console.log('\nNo production changes were made.');
  console.log('='.repeat(72));

  if (discrepancies > 0) process.exit(1);
}

main()
  .catch(e => { console.error('\nScript error:', e.message); process.exit(2); })
  .finally(() => prisma.$disconnect());
