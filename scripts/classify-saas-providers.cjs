/**
 * classify-saas-providers.cjs
 * Read-only. Lists all SAAS providers without a DrivingProviderProfile
 * for manual review before any industry backfill.
 */
const { PrismaClient } = require('@prisma/client');
process.env.DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient();

async function main() {
  console.log('SAAS providers without DrivingProviderProfile — manual review list');
  console.log('='.repeat(72));

  const rows = await prisma.$queryRaw`
    SELECT
      p.id,
      p.name,
      p."businessModel",
      p."paymentMode",
      p."approvalStatus",
      p."subscriptionTier",
      p."isActive",
      u.email,
      u."createdAt" AS user_created_at
    FROM "Provider" p
    LEFT JOIN "DrivingProviderProfile" dp ON dp."providerId" = p.id
    LEFT JOIN "User" u ON u."providerId" = p.id
    WHERE p."businessModel" = 'SAAS'
      AND dp."providerId" IS NULL
    ORDER BY u."createdAt" ASC NULLS LAST
  `;

  console.log(`\nCount: ${rows.length}\n`);
  for (const r of rows) {
    console.log(`ID:          ${r.id}`);
    console.log(`Name:        ${r.name}`);
    console.log(`Email:       ${r.email}`);
    console.log(`Registered:  ${r.user_created_at ? new Date(r.user_created_at).toISOString() : 'unknown'}`);
    console.log(`Business:    ${r.businessModel} / ${r.paymentMode}`);
    console.log(`Tier:        ${r.subscriptionTier}  Status: ${r.approvalStatus}  Active: ${r.isActive}`);
    console.log('-'.repeat(72));
  }

  // Also list all MARKETPLACE providers for completeness
  const marketplace = await prisma.$queryRaw`
    SELECT p.id, p.name, u.email, u."createdAt" AS user_created_at
    FROM "Provider" p
    LEFT JOIN "User" u ON u."providerId" = p.id
    WHERE p."businessModel" = 'MARKETPLACE'
    ORDER BY u."createdAt" ASC NULLS LAST
  `;

  console.log(`\nMARKETPLACE providers (confirmed driving — ${marketplace.length} records):`);
  for (const r of marketplace) {
    console.log(`  ${r.id} | ${r.name} | ${r.email} | ${r.user_created_at ? new Date(r.user_created_at).toISOString() : 'unknown'}`);
  }

  console.log('\nRead-only. No data was modified.');
}

main()
  .catch(e => { console.error('Failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
