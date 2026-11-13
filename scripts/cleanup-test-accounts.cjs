/**
 * cleanup-test-accounts.cjs
 *
 * Removes test accounts left by runtime verification scripts.
 * Targets email patterns: .test domains used in runtime tests.
 *
 * Run:
 *   node --env-file=.env.local scripts/cleanup-test-accounts.cjs
 */

'use strict';
const { PrismaClient } = require('@prisma/client');
process.env.DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(72));
  console.log('Test account cleanup');
  console.log('='.repeat(72));

  // Find all .test email users
  const testUsers = await prisma.user.findMany({
    where: { email: { contains: '.test' } },
    select: { id: true, email: true, providerId: true },
  });

  console.log(`Found ${testUsers.length} .test email user(s)`);

  let deleted = 0;
  let failed = 0;

  for (const user of testUsers) {
    try {
      // Delete Provider first (FK)
      if (user.providerId) {
        await prisma.provider.delete({ where: { id: user.providerId } });
      }
      await prisma.user.delete({ where: { id: user.id } });
      console.log(`  ✅ Deleted: ${user.email}`);
      deleted++;
    } catch (e) {
      console.error(`  ❌ Failed to delete ${user.email}: ${e.message.split('\n')[0]}`);
      failed++;
    }
  }

  console.log(`\nResult: ${deleted} deleted, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch(e => { console.error('Script error:', e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
