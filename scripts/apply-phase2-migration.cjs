/**
 * apply-phase2-migration.cjs  — DEV-ONLY convenience script
 *
 * This script exists for developers who need to apply the Phase 2 schema
 * columns to a local or test database without using Prisma migrate.
 *
 * AUTHORITATIVE MIGRATION:
 *   prisma/migrations/20261110000001_add_organisation_type_and_agreement_fields/migration.sql
 *
 * This script MUST stay in sync with that file.  Any discrepancy between
 * the SQL here and migration.sql is a defect — the Prisma migration is always
 * the source of truth.
 *
 * NOT for production use.  Production migration is applied via Prisma migrate
 * deploy under DBA review.
 *
 * Run (local/test only):
 *   node --env-file=.env.local scripts/apply-phase2-migration.cjs
 */
'use strict';
const { PrismaClient } = require('@prisma/client');
process.env.DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
const p = new PrismaClient();
async function main() {
  await p.$executeRawUnsafe(`
    ALTER TABLE "Provider"
      ADD COLUMN IF NOT EXISTS "organisationType"             TEXT,
      ADD COLUMN IF NOT EXISTS "commercialAgreementType"      TEXT,
      ADD COLUMN IF NOT EXISTS "commercialAgreementStatus"    TEXT NOT NULL DEFAULT 'PENDING',
      ADD COLUMN IF NOT EXISTS "commercialAgreementVersion"   TEXT,
      ADD COLUMN IF NOT EXISTS "commercialAgreementAcceptedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "privacyPolicyVersion"         TEXT,
      ADD COLUMN IF NOT EXISTS "privacyPolicyAcceptedAt"      TIMESTAMP(3)
  `);
  // organisationType is nullable TEXT with no DEFAULT.
  // Existing rows get NULL — this is intentional.
  // New registrations always receive an explicit value from the registration API.
  // See migration.sql for the full rationale.
  console.log('Phase 2 migration applied (dev convenience script).');
}
main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => p.$disconnect());
