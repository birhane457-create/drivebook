/**
 * AUDIT SCRIPT — read-only production classification report
 *
 * Phase 1: classification of providers registered in the affected window and
 * analysis of the broader null-industry population.
 *
 * Uses raw SQL for the null-industry query because the industry column does
 * not yet exist in production (migration pending).
 */

import { PrismaClient } from '@prisma/client';

// Use direct URL to bypass pgBouncer
process.env.DATABASE_URL =
  process.env.DIRECT_URL ||
  'postgresql://postgres:REDACTED_DB_PASSWORD@db.ikhqphbbilrocsghjyda.supabase.co:5432/postgres?sslmode=require';

const prisma = new PrismaClient();

// Window boundaries (UTC)
const WINDOW_START = new Date('2026-11-10T05:50:21Z');
const WINDOW_END   = new Date('2026-11-10T10:05:47Z');

async function main() {
  console.log('Read-only production data audit — provider industry classification');
  console.log(`Affected window: ${WINDOW_START.toISOString()} → ${WINDOW_END.toISOString()}`);
  console.log('Using User.createdAt as registration timestamp (Provider has no createdAt).');
  console.log('='.repeat(80));

  // ── 1. Users registered in the window who are providers ───────────────────
  const windowUsers = await prisma.user.findMany({
    where: {
      createdAt: { gte: WINDOW_START, lt: WINDOW_END },
      role: 'provider',
      providerId: { not: null },
    },
    select: {
      id: true,
      email: true,
      createdAt: true,
      providerId: true,
      provider: {
        select: {
          id: true,
          name: true,
          businessModel: true,
          paymentMode: true,
          subscriptionTier: true,
          approvalStatus: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\nProviders registered in window: ${windowUsers.length}`);

  if (windowUsers.length > 0) {
    // Check DrivingProviderProfile for window providers
    const windowProviderIds = windowUsers.map(u => u.provider?.id).filter(Boolean);
    const windowDrivingProfiles = await prisma.drivingProviderProfile.findMany({
      where: { providerId: { in: windowProviderIds } },
      select: { providerId: true },
    });
    const windowDrivingIds = new Set(windowDrivingProfiles.map(d => d.providerId));

    console.log('\n' + '='.repeat(80));
    console.log('WINDOW PROVIDERS — CLASSIFICATION REPORT');
    console.log('='.repeat(80));

    for (const u of windowUsers) {
      const p = u.provider;
      if (!p) continue;
      const hasDrivingProfile = windowDrivingIds.has(p.id);
      const signals = [];
      let classification = 'UNRESOLVED';
      let confidence = 'low';

      if (hasDrivingProfile) {
        signals.push('has DrivingProviderProfile');
        classification = p.businessModel === 'SAAS' ? 'DRIVING (SaaS model)' : 'DRIVING';
        confidence = 'high';
      } else if (p.businessModel === 'MARKETPLACE') {
        signals.push('businessModel=MARKETPLACE');
        classification = 'DRIVING';
        confidence = 'high';
      } else {
        signals.push('businessModel=SAAS, no DrivingProviderProfile');
        classification = 'PROBABLY_NON_DRIVING';
        confidence = 'medium';
      }

      console.log(`\nProvider: ${p.id}`);
      console.log(`  Registered:       ${new Date(u.createdAt).toISOString()}`);
      console.log(`  Email:            ${u.email}`);
      console.log(`  Name:             ${p.name}`);
      console.log(`  businessModel:    ${p.businessModel}`);
      console.log(`  paymentMode:      ${p.paymentMode}`);
      console.log(`  DrivingProfile:   ${hasDrivingProfile}`);
      console.log(`  subscriptionTier: ${p.subscriptionTier}`);
      console.log(`  approvalStatus:   ${p.approvalStatus}`);
      console.log(`  Signals:          ${signals.join('; ')}`);
      console.log(`  CLASSIFICATION:   ${classification} (confidence: ${confidence})`);
    }
  } else {
    console.log('\nResult: No providers were created during the affected window.');
    console.log('The industry classification gap does not affect any existing production accounts.');
  }

  // ── 2. Broader analysis using raw SQL (bypasses missing industry column) ──
  console.log('\n' + '='.repeat(80));
  console.log('BROADER PROVIDER POPULATION — RAW SQL ANALYSIS');
  console.log('Note: industry column not yet in production DB (migration pending)');
  console.log('='.repeat(80));

  // Count providers by businessModel
  const modelCounts = await prisma.$queryRaw`
    SELECT "businessModel", COUNT(*)::int as count
    FROM "Provider"
    GROUP BY "businessModel"
    ORDER BY count DESC
  `;
  console.log('\nProviders by businessModel:');
  for (const row of modelCounts) {
    console.log(`  ${row.businessModel}: ${row.count}`);
  }

  // Count total providers
  const totalProviders = await prisma.provider.count();
  console.log(`\nTotal providers: ${totalProviders}`);

  // Count providers with a DrivingProviderProfile (definitive driving signal)
  const drivingProfileCount = await prisma.drivingProviderProfile.count();
  console.log(`Providers with DrivingProviderProfile: ${drivingProfileCount}`);

  // SAAS providers WITH DrivingProviderProfile (need industry='driving' backfill)
  const saasDrivingProfiles = await prisma.$queryRaw`
    SELECT p.id, p."businessModel", p."paymentMode", p.name, u.email
    FROM "Provider" p
    INNER JOIN "DrivingProviderProfile" dp ON dp."providerId" = p.id
    LEFT JOIN "User" u ON u."providerId" = p.id
    WHERE p."businessModel" = 'SAAS'
  `;
  console.log(`\nSAAS providers WITH DrivingProviderProfile: ${saasDrivingProfiles.length}`);
  if (saasDrivingProfiles.length > 0) {
    console.log('  (These are driving instructors who chose the SaaS model)');
    for (const row of saasDrivingProfiles) {
      console.log(`  ${row.id} | ${row.name} | ${row.email}`);
    }
  }

  // SAAS providers WITHOUT DrivingProviderProfile (may be non-driving)
  const saasNonDrivingCount = await prisma.$queryRaw`
    SELECT COUNT(*)::int as count
    FROM "Provider" p
    LEFT JOIN "DrivingProviderProfile" dp ON dp."providerId" = p.id
    WHERE p."businessModel" = 'SAAS'
      AND dp."providerId" IS NULL
  `;
  const saasNoDrivingTotal = saasNonDrivingCount[0]?.count ?? 0;
  console.log(`\nSAAS providers WITHOUT DrivingProviderProfile: ${saasNoDrivingTotal}`);
  console.log('  (Pre-existing non-driving or ambiguous providers — manual review needed before backfill)');

  // ── 3. Recommended backfill SQL ────────────────────────────────────────────
  console.log('\n' + '='.repeat(80));
  console.log('RECOMMENDED BACKFILL SQL (not executed — apply AFTER migration)');
  console.log('='.repeat(80));

  console.log(`
-- Step 1: Apply migration first
-- prisma migrate deploy  (or apply migration.sql manually)

-- Step 2: Safe backfill — MARKETPLACE providers are always driving instructors
UPDATE "Provider" SET industry = 'driving'
WHERE "businessModel" = 'MARKETPLACE';

-- Step 3: Safe backfill — DrivingProviderProfile is definitive evidence
UPDATE "Provider" SET industry = 'driving'
WHERE "businessModel" = 'SAAS'
  AND id IN (SELECT "providerId" FROM "DrivingProviderProfile")
  AND industry IS NULL;

-- Step 4: MANUAL REVIEW REQUIRED for remaining SAAS without DrivingProfile
-- Do NOT backfill these automatically. Review each record individually.
-- SELECT id, name FROM "Provider"
-- WHERE "businessModel" = 'SAAS'
--   AND id NOT IN (SELECT "providerId" FROM "DrivingProviderProfile")
--   AND industry IS NULL;
  `);

  console.log('='.repeat(80));
  console.log('Audit complete. No data was modified.');
}

main()
  .catch(err => {
    console.error('Audit failed:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
