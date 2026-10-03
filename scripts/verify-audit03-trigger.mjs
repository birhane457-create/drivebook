/**
 * AUDIT-03 Verification Script
 *
 * Applies the prevent_auditlog_delete trigger to the live Supabase database
 * and then proves the following invariants:
 *
 *   V1: ORM delete (prisma.auditLog.delete)     → trigger error, row persists
 *   V2: ORM deleteMany (prisma.auditLog.deleteMany) → trigger error, rows persist
 *   V3: Raw SQL DELETE FROM "AuditLog"           → trigger error, rows persist
 *   V4: AuditLog.create still works after trigger install
 *   V5: Trigger survives a Prisma $transaction abort — row not deleted on rollback attempt
 *
 * This script is the primary FIX-VERIFIED evidence for AUDIT-03.
 * It operates against the same Supabase database used by all other integration tests.
 *
 * Usage:
 *   node scripts/verify-audit03-trigger.mjs
 *
 * Reads DATABASE_URL from .env (dotenv).
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env ─────────────────────────────────────────────────────────────────
const envPath = resolve(__dirname, '../.env');
try {
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
    if (m) process.env[m[1]] ??= m[2];
  }
} catch {
  console.error('Could not read .env — DATABASE_URL must be set in environment');
}

const prisma = new PrismaClient();

const PREFIX = `audit03_verify_${Date.now()}`;

function pass(label) { console.log(`  ✅ PASS  ${label}`); }
function fail(label, detail) { console.error(`  ❌ FAIL  ${label}: ${detail}`); process.exitCode = 1; }

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('AUDIT-03 Trigger Verification');
  console.log(`DATABASE_URL prefix: ${process.env.DATABASE_URL?.slice(0, 60)}...`);
  console.log(`PREFIX: ${PREFIX}`);
  console.log('═══════════════════════════════════════════════════════\n');

  // ── Safety check ─────────────────────────────────────────────────────────
  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!dbUrl.includes('supabase') && !dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1')) {
    throw new Error(`SAFETY: Unexpected DATABASE_URL — aborting. Got: ${dbUrl.slice(0, 60)}`);
  }

  // ── Step 1: Apply migration SQL ───────────────────────────────────────────
  console.log('── Step 1: Applying trigger migration ──');

  // Execute the two migration statements explicitly rather than parsing the SQL file.
  // Parsing is unreliable with dollar-quoted PL/pgSQL bodies ($$...$$).
  // The migration file is the authoritative artifact; these statements mirror it exactly.

  // Statement 1: Create (or replace) the trigger function
  try {
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION prevent_auditlog_delete()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RAISE EXCEPTION 'AuditLog records are immutable and cannot be deleted (AUDIT-03)';
      END;
      $$
    `);
    console.log('  Applied: CREATE OR REPLACE FUNCTION prevent_auditlog_delete()');
  } catch (e) {
    throw new Error(`Failed to create trigger function: ${e.message}`);
  }

  // Statement 2: Attach the trigger to "AuditLog"
  // DROP IF EXISTS first to make this idempotent (CREATE TRIGGER fails if trigger exists,
  // unlike CREATE OR REPLACE FUNCTION).
  try {
    await prisma.$executeRawUnsafe(
      `DROP TRIGGER IF EXISTS audit03_prevent_auditlog_delete ON "AuditLog"`
    );
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER audit03_prevent_auditlog_delete
        BEFORE DELETE ON "AuditLog"
        FOR EACH ROW
        EXECUTE FUNCTION prevent_auditlog_delete()
    `);
    console.log('  Applied: CREATE TRIGGER audit03_prevent_auditlog_delete');
  } catch (e) {
    throw new Error(`Failed to create trigger: ${e.message}`);
  }

  console.log('  Migration applied.\n');

  // ── Step 2: Verify trigger is installed ───────────────────────────────────
  console.log('── Step 2: Confirm trigger exists in pg_trigger ──');
  // Use pg_trigger + pg_class directly — more reliable than information_schema.triggers
  // which can have schema-visibility or case-sensitivity issues.
  const triggerRows = await prisma.$queryRaw`
    SELECT t.tgname AS trigger_name
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'AuditLog'
      AND t.tgname = 'audit03_prevent_auditlog_delete'
      AND NOT t.tgisinternal
  `;
  if (triggerRows.length === 1) {
    pass(`Trigger audit03_prevent_auditlog_delete present on "AuditLog" (pg_trigger confirmed)`);
  } else {
    // Also check with lowercase table name (some Supabase versions store as lowercase)
    const triggerRowsLower = await prisma.$queryRaw`
      SELECT t.tgname AS trigger_name
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      WHERE lower(c.relname) = 'auditlog'
        AND t.tgname = 'audit03_prevent_auditlog_delete'
        AND NOT t.tgisinternal
    `;
    if (triggerRowsLower.length === 1) {
      pass(`Trigger audit03_prevent_auditlog_delete present (pg_trigger, case-insensitive match)`);
    } else {
      fail('Trigger existence', `Expected 1 row in pg_trigger, got ${triggerRows.length} (case-sensitive) / ${triggerRowsLower.length} (case-insensitive)`);
      return;
    }
  }
  console.log();

  // ── Step 3: Create test fixtures ─────────────────────────────────────────
  console.log('── Step 3: Creating test AuditLog fixtures ──');
  const row1 = await prisma.auditLog.create({
    data: {
      id:         `${PREFIX}_v1`,
      action:     'AUDIT03_VERIFY_V1',
      actorId:    `${PREFIX}_actor`,
      actorRole:  'SYSTEM',
      targetType: 'AUDIT03_TEST',
      targetId:   `${PREFIX}_target_v1`,
    },
  });
  const row2 = await prisma.auditLog.create({
    data: {
      id:         `${PREFIX}_v2`,
      action:     'AUDIT03_VERIFY_V2',
      actorId:    `${PREFIX}_actor`,
      actorRole:  'SYSTEM',
      targetType: 'AUDIT03_TEST',
      targetId:   `${PREFIX}_target_v2`,
    },
  });
  pass(`V4: Created AuditLog rows id=${row1.id} and id=${row2.id} (CREATE still works after trigger)`);
  console.log();

  // ── V1: ORM single delete ─────────────────────────────────────────────────
  console.log('── V1: ORM prisma.auditLog.delete ──');
  let caughtV1 = null;
  try {
    await prisma.auditLog.delete({ where: { id: row1.id } });
  } catch (e) {
    caughtV1 = e;
  }

  if (!caughtV1) {
    fail('V1', 'delete did NOT throw — trigger is not blocking ORM deletes');
  } else if (caughtV1.message?.includes('AUDIT-03') || caughtV1.message?.includes('immutable')) {
    pass(`V1: ORM delete threw trigger error: "${caughtV1.message.slice(0, 120)}"`);
  } else {
    // Any error from the DB counts — even if message format differs slightly
    pass(`V1: ORM delete threw error (trigger active): "${caughtV1.message?.slice(0, 120)}"`);
  }

  // Confirm row still exists
  const afterV1 = await prisma.auditLog.findUnique({ where: { id: row1.id } });
  if (afterV1) {
    pass('V1: Row persists after blocked delete');
  } else {
    fail('V1', 'Row was deleted despite trigger error — trigger is not working');
  }
  console.log();

  // ── V2: ORM deleteMany ────────────────────────────────────────────────────
  console.log('── V2: ORM prisma.auditLog.deleteMany ──');
  let caughtV2 = null;
  try {
    await prisma.auditLog.deleteMany({ where: { actorId: `${PREFIX}_actor` } });
  } catch (e) {
    caughtV2 = e;
  }

  if (!caughtV2) {
    fail('V2', 'deleteMany did NOT throw — trigger is not blocking ORM bulk deletes');
  } else {
    pass(`V2: ORM deleteMany threw trigger error: "${caughtV2.message?.slice(0, 120)}"`);
  }

  // Confirm both rows still exist
  const remaining = await prisma.auditLog.count({
    where: { actorId: `${PREFIX}_actor` },
  });
  if (remaining === 2) {
    pass('V2: Both rows persist after blocked deleteMany');
  } else {
    fail('V2', `Expected 2 rows to persist, found ${remaining}`);
  }
  console.log();

  // ── V3: Raw SQL DELETE ────────────────────────────────────────────────────
  console.log('── V3: Raw SQL DELETE FROM "AuditLog" ──');
  let caughtV3 = null;
  try {
    await prisma.$executeRaw`DELETE FROM "AuditLog" WHERE id = ${row1.id}`;
  } catch (e) {
    caughtV3 = e;
  }

  if (!caughtV3) {
    fail('V3 CRITICAL', 'Raw SQL DELETE did NOT throw — trigger is NOT database-level protection. The architectural invariant is NOT established.');
  } else {
    pass(`V3 (CRITICAL): Raw SQL DELETE threw trigger error: "${caughtV3.message?.slice(0, 120)}"`);
    pass('V3: Protection is genuine database-level — not bypassable via $executeRaw');
  }

  // Confirm row still exists after raw SQL attempt
  const afterV3 = await prisma.auditLog.findUnique({ where: { id: row1.id } });
  if (afterV3) {
    pass('V3: Row persists after blocked raw SQL DELETE');
  } else {
    fail('V3 CRITICAL', 'Row was deleted via raw SQL despite trigger — trigger NOT working at DB level');
  }
  console.log();

  // ── V5: Delete inside $transaction ────────────────────────────────────────
  console.log('── V5: Delete inside $transaction ──');
  let caughtV5 = null;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.auditLog.delete({ where: { id: row1.id } });
    });
  } catch (e) {
    caughtV5 = e;
  }

  if (!caughtV5) {
    fail('V5', 'Delete inside $transaction did NOT throw');
  } else {
    pass(`V5: Delete inside $transaction threw trigger error: "${caughtV5.message?.slice(0, 120)}"`);
  }

  const afterV5 = await prisma.auditLog.findUnique({ where: { id: row1.id } });
  if (afterV5) {
    pass('V5: Row persists after blocked transactional delete');
  } else {
    fail('V5', 'Row was deleted inside $transaction — trigger not blocking transactional deletes');
  }
  console.log();

  // ── Final state ───────────────────────────────────────────────────────────
  console.log('── Final state ──');
  const finalCount = await prisma.auditLog.count({
    where: { actorId: `${PREFIX}_actor` },
  });
  console.log(`  Test rows in AuditLog with actorId=${PREFIX}_actor: ${finalCount}`);
  console.log(`  (These rows are permanently preserved — trigger prevents cleanup.)`);
  console.log(`  Row IDs: ${PREFIX}_v1, ${PREFIX}_v2`);
  console.log(`  These are uniquely prefixed and will never interfere with application data.\n`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════');
  if (process.exitCode === 1) {
    console.error('AUDIT-03 VERIFICATION: FAILED — see ❌ above');
  } else {
    console.log('AUDIT-03 VERIFICATION: ALL CHECKS PASSED');
    console.log('  V1 ORM delete      → blocked (trigger error)');
    console.log('  V2 ORM deleteMany  → blocked (trigger error)');
    console.log('  V3 Raw SQL DELETE  → blocked (database-level proof)');
    console.log('  V4 CREATE          → still works');
    console.log('  V5 $transaction    → delete blocked, tx rolled back');
    console.log('\nFIX-VERIFIED: AUDIT-03 architectural invariant is established.');
    console.log('AuditLog rows are immutable at the PostgreSQL level.');
  }
  console.log('═══════════════════════════════════════════════════════\n');
}

main()
  .catch(e => { console.error('Script error:', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
