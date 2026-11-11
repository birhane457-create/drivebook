/**
 * migration-phase2-classification.cjs  (v2)
 *
 * READ-ONLY pre-migration classification script for the Phase 2 migration
 * (20261110000001_add_organisation_type_and_agreement_fields).
 *
 * Uses all available evidence:
 *   - businessModel (MARKETPLACE | SAAS)
 *   - industry field (set at registration since commit 8a78f122, may be null for older rows)
 *   - DrivingProviderProfile presence (definitive driving indicator regardless of industry)
 *   - User.createdAt as registration timestamp proxy
 *
 * Classification:
 *   INDIVIDUAL_INSTRUCTOR  — high confidence: MARKETPLACE OR DrivingProfile present
 *   SOLE_TRADER            — probable: SAAS + no DrivingProfile + industry is non-driving or null
 *                           and no other conflicting evidence
 *   REVIEW                 — uncertain: SAAS + null industry + no DrivingProfile
 *                           cannot classify from DB evidence alone
 *
 * DOES NOT modify any data.
 * Run: node --env-file=.env.local scripts/migration-phase2-classification.cjs
 */

'use strict';
const { PrismaClient } = require('@prisma/client');
process.env.DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient();

// Non-driving industry values set by the registration API
const NON_DRIVING_INDUSTRIES = ['plumber', 'electrician', 'beauty', 'tax', 'other'];
const DRIVING_INDUSTRIES      = ['driving'];

async function main() {
  console.log('='.repeat(72));
  console.log('Phase 2 Migration — organisationType pre-classification v2 (READ-ONLY)');
  console.log('='.repeat(72));

  const providers = await prisma.$queryRaw`
    SELECT
      p.id,
      p.name,
      p."businessModel",
      p."paymentMode",
      p.industry,
      u.email,
      u."createdAt",
      CASE WHEN dp."providerId" IS NOT NULL THEN true ELSE false END AS "hasDrivingProfile"
    FROM "Provider" p
    LEFT JOIN "User" u ON u."providerId" = p.id
    LEFT JOIN "DrivingProviderProfile" dp ON dp."providerId" = p.id
    ORDER BY u."createdAt" ASC NULLS LAST
  `;

  const groups = {
    INDIVIDUAL_INSTRUCTOR: [],
    SOLE_TRADER:           [],
    REVIEW:                [],
  };

  for (const p of providers) {
    const reasons = [];
    let classification = null;
    let confidence = '';

    // ── Definitive driving signals ──────────────────────────────────────────
    if (p.businessModel === 'MARKETPLACE') {
      reasons.push('businessModel=MARKETPLACE (driving marketplace)');
      classification = 'INDIVIDUAL_INSTRUCTOR';
      confidence = 'high';
    }
    if (p.hasDrivingProfile) {
      reasons.push('DrivingProviderProfile present');
      if (!classification || classification === 'INDIVIDUAL_INSTRUCTOR') {
        classification = 'INDIVIDUAL_INSTRUCTOR';
        confidence = 'high';
      }
    }

    // ── Industry field (set for registrations after 8a78f122) ───────────────
    if (p.industry && DRIVING_INDUSTRIES.includes(p.industry)) {
      reasons.push(`industry='${p.industry}'`);
      if (!classification) {
        classification = 'INDIVIDUAL_INSTRUCTOR';
        confidence = 'high';
      }
    }
    if (p.industry && NON_DRIVING_INDUSTRIES.includes(p.industry)) {
      reasons.push(`industry='${p.industry}' (non-driving)`);
      if (!classification) {
        classification = 'SOLE_TRADER';
        confidence = 'medium';  // industry set but no other business-structure evidence
      }
    }

    // ── SAAS with no driving evidence ──────────────────────────────────────
    if (!classification) {
      if (p.businessModel === 'SAAS' && !p.hasDrivingProfile && !p.industry) {
        reasons.push('SAAS + no DrivingProfile + null industry (insufficient evidence)');
        classification = 'REVIEW';
        confidence = 'low — requires manual review';
      } else if (p.businessModel === 'SAAS' && !p.hasDrivingProfile) {
        reasons.push('SAAS + no DrivingProfile + non-driving industry');
        classification = 'SOLE_TRADER';
        confidence = 'medium';
      } else {
        reasons.push('no classification evidence found');
        classification = 'REVIEW';
        confidence = 'unknown';
      }
    }

    p._classification = classification;
    p._confidence     = confidence;
    p._reasons        = reasons;

    // Route to the correct group explicitly so the grouping is auditable
    if (classification === 'INDIVIDUAL_INSTRUCTOR') {
      groups.INDIVIDUAL_INSTRUCTOR.push(p);
    } else if (classification === 'SOLE_TRADER') {
      groups.SOLE_TRADER.push(p);
    } else {
      groups.REVIEW.push(p);  // REVIEW: requires manual investigation
    }
  }

  console.log(`\nTotal providers: ${providers.length}`);
  console.log(`  → INDIVIDUAL_INSTRUCTOR (high confidence): ${groups.INDIVIDUAL_INSTRUCTOR.length}`);
  console.log(`  → SOLE_TRADER (medium confidence):          ${groups.SOLE_TRADER.length}`);
  console.log(`  → REVIEW (insufficient evidence):           ${groups.REVIEW.length}`);

  // ── Detail output ──────────────────────────────────────────────────────────
  for (const [group, members] of Object.entries(groups)) {
    if (members.length === 0) continue;
    console.log(`\n${'─'.repeat(72)}`);
    console.log(`GROUP: ${group} (${members.length} provider(s))`);
    console.log(`${'─'.repeat(72)}`);
    for (const p of members) {
      console.log(`  ID:         ${p.id}`);
      console.log(`  Name:       ${p.name}`);
      console.log(`  Email:      ${p.email ?? 'none'}`);
      console.log(`  businessModel: ${p.businessModel}  industry: ${p.industry ?? 'NULL'}  DrivingProfile: ${p.hasDrivingProfile}`);
      console.log(`  Confidence: ${p._confidence}`);
      console.log(`  Evidence:   ${p._reasons.join('; ')}`);
      console.log('');
    }
  }

  // ── Proposed correction SQL (for INDIVIDUAL_INSTRUCTOR group only) ─────────
  console.log('='.repeat(72));
  console.log('PROPOSED CORRECTION SQL (not executed — DBA review and approval required)');
  console.log('Apply AFTER the migration. Do NOT execute the REVIEW group without manual review.');
  console.log('='.repeat(72));

  if (groups.INDIVIDUAL_INSTRUCTOR.length > 0) {
    const ids = groups.INDIVIDUAL_INSTRUCTOR.map(p => `'${p.id}'`).join(',\n    ');
    console.log(`\n-- Step 1: Correct driving instructors (high confidence)`);
    console.log(`-- Expected: ${groups.INDIVIDUAL_INSTRUCTOR.length} row(s)`);
    console.log(`UPDATE "Provider"`);
    console.log(`SET "organisationType" = 'INDIVIDUAL_INSTRUCTOR'`);
    console.log(`WHERE id IN (`);
    console.log(`    ${ids}`);
    console.log(`);`);
    console.log(`-- Verify: SELECT id, name, "organisationType" FROM "Provider"`);
    console.log(`--         WHERE "organisationType" = 'INDIVIDUAL_INSTRUCTOR';`);
  }

  if (groups.REVIEW.length > 0) {
    console.log(`\n-- Step 2: MANUAL REVIEW REQUIRED for ${groups.REVIEW.length} provider(s)`);
    console.log(`-- These cannot be classified from DB evidence alone.`);
    console.log(`-- Review each account before assigning organisationType.`);
    console.log(`-- DO NOT bulk-update these rows without individual investigation.`);
    for (const p of groups.REVIEW) {
      console.log(`--   ${p.id} | ${p.name} | ${p.email ?? 'no email'}`);
    }
  }

  // ── Rollback assessment (corrected) ───────────────────────────────────────
  console.log('\n' + '='.repeat(72));
  console.log('ROLLBACK / CONTINGENCY ASSESSMENT (CORRECTED)');
  console.log('='.repeat(72));
  console.log(`
BEFORE MIGRATION (all 7 columns absent):
  Rollback is non-destructive — the columns do not exist, so there is nothing to drop.

IMMEDIATELY AFTER MIGRATION (columns added, all values are DEFAULT/NULL):
  Rollback: DROP the 7 columns. No real data exists in them yet — only defaults.
  Risk: LOW.

AFTER PROVIDERS HAVE REGISTERED WITH THE NEW CODE (agreement and consent data populated):
  Dropping the columns destroys real legal consent records:
    - commercialAgreementStatus / Version / AcceptedAt: legal agreement acceptance evidence
    - privacyPolicyVersion / AcceptedAt: privacy consent timestamps
    - organisationType: account classification

  This is NOT a safe rollback once real registration data exists.

SAFE CONTINGENCY PLAN (if rollback is required after data exists):
  Step 1 — Back up the consent data before dropping:
    CREATE TABLE "_Provider_AgreementBackup_<date>" AS
    SELECT id, "organisationType", "commercialAgreementType", "commercialAgreementStatus",
           "commercialAgreementVersion", "commercialAgreementAcceptedAt",
           "privacyPolicyVersion", "privacyPolicyAcceptedAt"
    FROM "Provider"
    WHERE "privacyPolicyAcceptedAt" IS NOT NULL
       OR "commercialAgreementAcceptedAt" IS NOT NULL;

  Step 2 — Only then drop the columns from Provider:
    ALTER TABLE "Provider"
      DROP COLUMN IF EXISTS "organisationType",
      DROP COLUMN IF EXISTS "commercialAgreementType",
      DROP COLUMN IF EXISTS "commercialAgreementStatus",
      DROP COLUMN IF EXISTS "commercialAgreementVersion",
      DROP COLUMN IF EXISTS "commercialAgreementAcceptedAt",
      DROP COLUMN IF EXISTS "privacyPolicyVersion",
      DROP COLUMN IF EXISTS "privacyPolicyAcceptedAt";

  Step 3 — Preserve the backup table until the incident is resolved and
    consent records have been re-recorded through an alternative mechanism.

  Any rollback that destroys consent timestamps requires a legal review.
  `);

  console.log('Read-only classification complete. No data was modified.');
}

main()
  .catch(e => { console.error('Failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
