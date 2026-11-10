/**
 * r3-checksum-update.cjs
 *
 * Guarded procedure to correct the _prisma_migrations checksum for
 * migration 20261109000001_add_provider_industry_and_discovery.
 *
 * AWAITING EXPLICIT APPROVAL — DO NOT RUN WITHOUT AUTHORIZATION.
 *
 * This is a METADATA CORRECTION only. It does not:
 *  - Change the production schema
 *  - Re-run any migration SQL
 *  - Repair the broader migration history (40 unrecorded migrations remain)
 *  - Affect any other migration records
 *
 * Guards:
 *  G1. Exactly 1 record matches the target migration name
 *  G2. The existing checksum is the known all-zero placeholder
 *  G3. The migration is in a successful state (finished_at NOT NULL)
 *  G4. rolled_back_at is NULL (not rolled back)
 *  G5. applied_steps_count >= 1
 *  G6. The new checksum matches the SHA-256 of the committed migration file
 *  G7. Exactly 1 row was updated
 *  G8. Post-update verification: stored checksum equals expected value
 *
 * If any guard fails, the script exits non-zero without making any change.
 */

'use strict';

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

process.env.DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;

const prisma = new PrismaClient();

const MIG_NAME        = '20261109000001_add_provider_industry_and_discovery';
const ZERO_CHECKSUM   = '00000000000000000000000000000000';
const MIG_FILE        = path.join(
  __dirname, '..', 'prisma', 'migrations', MIG_NAME, 'migration.sql'
);

function abort(reason) {
  console.error(`\nABORT: ${reason}`);
  console.error('No changes made.');
  process.exit(1);
}

async function main() {
  console.log('='.repeat(72));
  console.log('R3 — _prisma_migrations checksum correction (GUARDED)');
  console.log('AWAITING APPROVAL — DO NOT RUN WITHOUT AUTHORIZATION');
  console.log('='.repeat(72));
  console.log('\nThis is a metadata correction only.');
  console.log('It does not change the production schema or any migration SQL.\n');

  // ── Compute expected checksum from committed file ─────────────────────────
  if (!fs.existsSync(MIG_FILE)) abort(`Migration file not found: ${MIG_FILE}`);
  const expectedChecksum = crypto.createHash('sha256').update(fs.readFileSync(MIG_FILE)).digest('hex');
  console.log(`Committed file SHA-256: ${expectedChecksum}`);

  // ── G1: Exactly 1 matching record ─────────────────────────────────────────
  const records = await prisma.$queryRaw`
    SELECT id, checksum, finished_at, rolled_back_at, applied_steps_count
    FROM "_prisma_migrations"
    WHERE migration_name = ${MIG_NAME}
  `;
  if (records.length === 0) abort(`G1 FAIL: no record for '${MIG_NAME}' in _prisma_migrations`);
  if (records.length > 1)  abort(`G1 FAIL: ${records.length} records for '${MIG_NAME}' (expected exactly 1)`);
  const rec = records[0];
  console.log(`G1 PASS: exactly 1 record — id=${rec.id}`);

  // ── G2: Existing checksum is the known placeholder ────────────────────────
  if (rec.checksum !== ZERO_CHECKSUM) {
    abort(`G2 FAIL: existing checksum is '${rec.checksum}' — expected all-zero placeholder '${ZERO_CHECKSUM}'. ` +
          `This guard prevents overwriting a valid checksum. Investigate before proceeding.`);
  }
  console.log(`G2 PASS: existing checksum is the known all-zero placeholder`);

  // ── G3: finished_at is not null ───────────────────────────────────────────
  if (rec.finished_at === null) abort(`G3 FAIL: finished_at is NULL — migration not recorded as successfully applied`);
  console.log(`G3 PASS: finished_at=${rec.finished_at}`);

  // ── G4: rolled_back_at is null ────────────────────────────────────────────
  if (rec.rolled_back_at !== null) abort(`G4 FAIL: rolled_back_at=${rec.rolled_back_at} — migration was rolled back`);
  console.log(`G4 PASS: rolled_back_at is NULL`);

  // ── G5: applied_steps_count >= 1 ─────────────────────────────────────────
  if (rec.applied_steps_count < 1) abort(`G5 FAIL: applied_steps_count=${rec.applied_steps_count} (expected >= 1)`);
  console.log(`G5 PASS: applied_steps_count=${rec.applied_steps_count}`);

  // ── G6: New checksum is non-trivial SHA-256 ───────────────────────────────
  if (!/^[0-9a-f]{64}$/.test(expectedChecksum)) abort(`G6 FAIL: computed checksum '${expectedChecksum}' is not valid SHA-256 hex`);
  if (expectedChecksum === ZERO_CHECKSUM) abort(`G6 FAIL: computed checksum is all-zero — file may be empty or corrupt`);
  console.log(`G6 PASS: new checksum is a valid non-zero SHA-256`);

  console.log('\nAll pre-update guards passed. Executing UPDATE...\n');

  // ── Execute the UPDATE ────────────────────────────────────────────────────
  const result = await prisma.$executeRaw`
    UPDATE "_prisma_migrations"
    SET checksum = ${expectedChecksum}
    WHERE migration_name = ${MIG_NAME}
      AND checksum       = ${ZERO_CHECKSUM}
      AND finished_at    IS NOT NULL
      AND rolled_back_at IS NULL
  `;

  // ── G7: Exactly 1 row updated ─────────────────────────────────────────────
  if (result !== 1) abort(`G7 FAIL: UPDATE affected ${result} row(s) — expected exactly 1. No further changes made.`);
  console.log(`G7 PASS: exactly 1 row updated`);

  // ── G8: Post-update verification ──────────────────────────────────────────
  const verify = await prisma.$queryRaw`
    SELECT checksum, finished_at, rolled_back_at
    FROM "_prisma_migrations"
    WHERE migration_name = ${MIG_NAME}
    LIMIT 1
  `;
  if (verify.length === 0) abort(`G8 FAIL: post-update record not found`);
  if (verify[0].checksum !== expectedChecksum) {
    abort(`G8 FAIL: post-update checksum '${verify[0].checksum}' does not match expected '${expectedChecksum}'`);
  }
  if (verify[0].finished_at === null) abort(`G8 FAIL: finished_at is NULL after update`);
  if (verify[0].rolled_back_at !== null) abort(`G8 FAIL: rolled_back_at is set after update`);
  console.log(`G8 PASS: checksum verified = ${verify[0].checksum}`);

  console.log('\n' + '='.repeat(72));
  console.log('R3 COMPLETE — checksum corrected successfully');
  console.log(`Migration: ${MIG_NAME}`);
  console.log(`New checksum: ${expectedChecksum}`);
  console.log('All 8 guards passed. 1 row updated and verified.');
  console.log('\nNote: 40 other migrations remain unrecorded in _prisma_migrations.');
  console.log('R3 corrects only this single checksum. Broader ledger repair');
  console.log('is a separate decision requiring its own procedure.');
  console.log('='.repeat(72));
}

main()
  .catch(e => { console.error('\nScript error:', e.message); process.exit(2); })
  .finally(() => prisma.$disconnect());
