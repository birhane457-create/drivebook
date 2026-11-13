'use strict';
const { PrismaClient } = require('@prisma/client');
process.env.DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient();
async function main() {
  const providers = await prisma.provider.findMany({
    select: {
      id: true,
      name: true,
      organisationType: true,
      businessModel: true,
      approvalStatus: true,
      industry: true,
      user: { select: { email: true, role: true } },
    },
  });

  console.log('Provider records in production DB:');
  console.log('='.repeat(72));
  for (const p of providers) {
    console.log(`  ${p.name} | email=${p.user?.email ?? 'none'} | orgType=${p.organisationType ?? 'NULL'} | model=${p.businessModel ?? 'NULL'} | industry=${p.industry ?? 'NULL'} | status=${p.approvalStatus ?? 'NULL'}`);
  }
  console.log('='.repeat(72));
  console.log(`Total: ${providers.length} providers`);

  // Check if any are real (non-test) by email pattern
  const testPatterns = ['.test', '@test.', 'gmail.com', 'example.com', 'drivebook.com', 'debesay'];
  const realProviders = providers.filter(p => {
    const email = p.user?.email ?? '';
    return !testPatterns.some(pat => email.includes(pat));
  });
  console.log(`\nNon-test providers (no test email pattern): ${realProviders.length}`);
  if (realProviders.length > 0) {
    for (const p of realProviders) {
      console.log(`  ⚠ POSSIBLE REAL: ${p.name} | email=${p.user?.email}`);
    }
  } else {
    console.log('  ✅ All providers have test email patterns or no user linked');
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
