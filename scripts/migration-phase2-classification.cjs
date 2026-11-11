/**
 * migration-phase2-classification.cjs
 *
 * READ-ONLY pre-migration classification script for the Phase 2 migration
 * (20261110000001_add_organisation_type_and_agreement_fields).
 *
 * Establishes what organisationType value each existing provider should receive
 * before the migration is applied. The migration DEFAULT='SOLE_TRADER' applies
 * to all existing rows — this script identifies which rows need correction.
 *
 * DOES NOT modify any data.
 * Run from repo root:
 *   node --env-file=.env.local scripts/migration-phase2-classification.cjs
 */

'use strict';
const { PrismaClient } = require('@prisma/client');
process.env.DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(72));
  console.log('Phase 2 Migration — organisationType pre-classification (READ-ONLY)');
  console.log('='.repeat(72));

  // All providers
  const providers = await prisma.$queryRaw`
    SELECT p.id, p.name, p."businessModel", p."paymentMode",
           u.email, u."createdAt",
           CASE WHEN dp."providerId" IS NOT NULL THEN true ELSE false END AS "hasDrivingProfile"
    FROM "Provider" p
    LEFT JOIN "User" u ON u."providerId" = p.id
    LEFT JOIN "DrivingProviderProfile" dp ON dp."providerId" = p.id
    ORDER BY u."createdAt" ASC NULLS LAST
  `;

  // Classification rules:
  //   MARKETPLACE + any            → INDIVIDUAL_INSTRUCTOR  (all marketplace = driving instructors)
  //   SAAS + DrivingProfile        → INDIVIDUAL_INSTRUCTOR  (driving SaaS)
  //   SAAS + no DrivingProfile     → SOLE_TRADER            (non-driving — cannot determine more without manual review)
  //
  // The migration DEFAULT='SOLE_TRADER' is WRONG for the first two groups.
  // After migration, those rows must be corrected to INDIVIDUAL_INSTRUCTOR.

  const groups = { INDIVIDUAL_INSTRUCTOR: [], SOLE_TRADER: [], REVIEW: [] };

  for (const p of providers) {
    if (p.businessModel === 'MARKETPLACE' || p.hasDrivingProfile) {
      groups.INDIVIDUAL_INSTRUCTOR.push(p);
    } else {
      groups.SOLE_TRADER.push(p);
    }
  }

  console.log(`\nTotal providers: ${providers.length}`);
  console.log(`  → INDIVIDUAL_INSTRUCTOR (requires correction after migration): ${groups.INDIVIDUAL_INSTRUCTOR.length}`);
  console.log(`  → SOLE_TRADER (migration DEFAULT is correct): ${groups.SOLE_TRADER.length}`);

  if (groups.INDIVIDUAL_INSTRUCTOR.length > 0) {
    console.log('\nProviders that need correction to INDIVIDUAL_INSTRUCTOR:');
    for (const p of groups.INDIVIDUAL_INSTRUCTOR) {
      console.log(`  ${p.id} | ${p.name} | ${p.businessModel} | DrivingProfile: ${p.hasDrivingProfile} | ${p.email ?? 'no email'}`);
    }
  }

  if (groups.SOLE_TRADER.length > 0) {
    console.log('\nProviders classified as SOLE_TRADER (migration DEFAULT is correct):');
    for (const p of groups.SOLE_TRADER) {
      console.log(`  ${p.id} | ${p.name} | ${p.businessModel} | ${p.email ?? 'no email'}`);
    }
  }

  // ── Proposed correction SQL ───────────────────────────────────────────────
  console.log('\n' + '='.repeat(72));
  console.log('PROPOSED CORRECTION SQL (not executed — DBA review and approval required)');
  console.log('Apply AFTER the migration. Verify row count before executing.');
  console.log('='.repeat(72));

  if (groups.INDIVIDUAL_INSTRUCTOR.length > 0) {
    const ids = groups.INDIVIDUAL_INSTRUCTOR.map(p => `'${p.id}'`).join(', ');
    console.log(`\n-- Step 1: Correct driving instructors misclassified as SOLE_TRADER by migration DEFAULT`);
    console.log(`-- Expected: ${groups.INDIVIDUAL_INSTRUCTOR.length} row(s) updated`);
    console.log(`UPDATE "Provider"`);
    console.log(`SET "organisationType" = 'INDIVIDUAL_INSTRUCTOR'`);
    console.log(`WHERE id IN (${ids});`);
    console.log(`-- Verify: SELECT id, name, "organisationType" FROM "Provider" WHERE id IN (${ids});`);
  } else {
    console.log('\nNo correction SQL required — no providers need INDIVIDUAL_INSTRUCTOR.');
  }

  // ── Rollback assessment ───────────────────────────────────────────────────
  console.log('\n' + '='.repeat(72));
  console.log('ROLLBACK / CONTINGENCY ASSESSMENT');
  console.log('='.repeat(72));
  console.log(`
Migration adds 7 nullable/defaulted columns — no existing data is modified.
Rollback: DROP the 7 columns if needed. No data loss beyond the new columns themselves.

  ALTER TABLE "Provider"
    DROP COLUMN IF EXISTS "organisationType",
    DROP COLUMN IF EXISTS "commercialAgreementType",
    DROP COLUMN IF EXISTS "commercialAgreementStatus",
    DROP COLUMN IF EXISTS "commercialAgreementVersion",
    DROP COLUMN IF EXISTS "commercialAgreementAcceptedAt",
    DROP COLUMN IF EXISTS "privacyPolicyVersion",
    DROP COLUMN IF EXISTS "privacyPolicyAcceptedAt";

Contingency notes:
  1. The migration DEFAULT='SOLE_TRADER' is safe — it does not corrupt any
     existing functional data. Incorrect organisationType does not affect
     bookings, payments, or permissions (the field is informational only
     at this stage).
  2. The correction UPDATE must be verified against the classification query
     output above before execution.
  3. No provider is classified as BUSINESS by this migration.
  4. accountType remains unchanged — INDIVIDUAL for all existing providers.
  `);

  console.log('Read-only classification complete. No data was modified.');
}

main()
  .catch(e => { console.error('Failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
