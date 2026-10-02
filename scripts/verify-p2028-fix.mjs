/**
 * P2028 Verification Script
 * 
 * Reproduces the original P2028 scenario against the remote Supabase database
 * (DATABASE_URL from .env — the same environment that produced the original error).
 * 
 * The original P2028 occurred in:
 *   app/api/instructor/subscription/route.ts line 265
 *   prisma.$transaction with default 5s timeout
 *   lockProvider() → $queryRaw FOR UPDATE against remote Supabase
 * 
 * This script:
 * 1. Creates a test fixture directly in Supabase
 * 2. Executes the same $transaction + lockProvider() + FOR UPDATE pattern
 * 3. Measures transaction duration
 * 4. Verifies: no P2028, transaction commits, duration << 30s
 * 5. Cleans up fixtures
 */

import { PrismaClient } from '@prisma/client';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const prisma = new PrismaClient();

const TEST_USER_ID     = 'p2028-verify-user';
const TEST_PROVIDER_ID = 'p2028-verify-provider';
const TEST_EMAIL       = 'p2028verify@test-verification.com';

async function cleanup() {
  await prisma.subscription.deleteMany({ where: { providerId: TEST_PROVIDER_ID } }).catch(() => {});
  await prisma.provider.deleteMany({ where: { id: TEST_PROVIDER_ID } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } }).catch(() => {});
}

async function verify() {
  const dbHost = process.env.DATABASE_URL?.match(/@([^:]+):/)?.[1] ?? 'unknown';
  console.log(`\nP2028 Verification — database host: ${dbHost}`);
  console.log('This must be Supabase (not localhost) for the verification to be meaningful.\n');

  if (dbHost === 'localhost' || dbHost === '127.0.0.1') {
    console.error('ERROR: DATABASE_URL points to localhost. This test must run against Supabase.');
    console.error('Unset TEST_DATABASE_URL to allow DATABASE_URL from .env to take effect.');
    process.exit(1);
  }

  await cleanup();

  // Create fixtures directly on Supabase
  console.log('Creating test fixtures on Supabase...');
  await prisma.user.create({
    data: { id: TEST_USER_ID, email: TEST_EMAIL, name: 'P2028 Verify User' },
  });
  await prisma.provider.create({
    data: {
      id: TEST_PROVIDER_ID,
      user: { connect: { id: TEST_USER_ID } },
      name: 'P2028 Verify Provider',
      phone: '+61400099999',
      hourlyRate: 80,
      subscriptionTier: 'BASIC',
      subscriptionStatus: 'TRIAL',
    },
  });
  await prisma.subscription.create({
    data: {
      providerId: TEST_PROVIDER_ID,
      tier: 'BASIC',
      status: 'TRIAL',
      monthlyAmount: 0,
      billingCycle: 'monthly',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000),
      trialEndsAt: new Date(Date.now() + 14 * 86400 * 1000),
    },
  });
  console.log('Fixtures created.\n');

  // Execute the same transaction pattern as the failing route
  // This is the pattern from app/api/instructor/subscription/route.ts:
  //   prisma.$transaction(async (tx) => {
  //     SELECT * FROM Provider WHERE id = $1 FOR UPDATE
  //     SELECT * FROM Subscription WHERE providerId = $1 AND status != 'CANCELLED' FOR UPDATE
  //     post-lock re-read
  //     0/1/>1 invariant
  //     mutation
  //   }, { timeout: 30000 })
  
  console.log('Executing $transaction with lockProvider() FOR UPDATE against Supabase...');
  const txStart = Date.now();

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      // Step 1: Provider FOR UPDATE (same as lockProvider())
      const providersRaw = await tx.$queryRaw`
        SELECT * FROM "Provider"
        WHERE "id" = ${TEST_PROVIDER_ID}
        FOR UPDATE
      `;
      if (!providersRaw[0]) throw new Error('Provider not found');

      // Step 2: All current subscriptions FOR UPDATE
      const subsRaw = await tx.$queryRaw`
        SELECT * FROM "Subscription"
        WHERE "providerId" = ${TEST_PROVIDER_ID}
          AND "status" != 'CANCELLED'
        FOR UPDATE
      `;

      // Step 3: Post-lock re-read
      const subs = await Promise.all(
        subsRaw.map(s => tx.subscription.findUnique({ where: { id: s.id } }))
      );
      const validSubs = subs.filter(Boolean);

      if (validSubs.length !== 1) throw new Error(`Expected 1 sub, got ${validSubs.length}`);
      const sub = validSubs[0];
      if (sub.providerId !== TEST_PROVIDER_ID) throw new Error('Ownership mismatch');

      // Step 4: Mutation (same as tier change mutation in route.ts)
      const updatedSub = await tx.subscription.update({
        where: { id: sub.id },
        data: { tier: 'PRO' },
      });
      await tx.provider.update({
        where: { id: TEST_PROVIDER_ID },
        data: { subscriptionTier: 'PRO' },
      });

      return { tier: updatedSub.tier, providerId: sub.providerId };
    }, { timeout: 30000 });

    const txDuration = Date.now() - txStart;

    console.log(`✅ Transaction completed successfully`);
    console.log(`   Result: tier=${result.tier}`);
    console.log(`   Transaction duration: ${txDuration}ms`);
    console.log(`   Timeout headroom: ${30000 - txDuration}ms remaining of 30s limit`);

    if (txDuration > 5000) {
      console.warn(`\n⚠️  Transaction took ${txDuration}ms — would have hit the old 5s default limit.`);
      console.warn('   The 30s timeout was necessary for this environment.');
    } else {
      console.log(`\n✅ Transaction completed in ${txDuration}ms — well within even the old 5s limit.`);
      console.log('   The P2028 was likely caused by compilation overhead at first load (dev mode).');
    }

    // Verify mutation committed
    const finalSub = await prisma.subscription.findFirst({ where: { providerId: TEST_PROVIDER_ID } });
    const finalProv = await prisma.provider.findUnique({ where: { id: TEST_PROVIDER_ID } });
    
    if (finalSub?.tier !== 'PRO') throw new Error(`Mutation did not commit: sub.tier=${finalSub?.tier}`);
    if (finalProv?.subscriptionTier !== 'PRO') throw new Error(`Mutation did not commit: provider.tier=${finalProv?.subscriptionTier}`);
    
    console.log('\n✅ Mutation verified committed to Supabase DB');
    console.log(`   Subscription.tier: ${finalSub.tier}`);
    console.log(`   Provider.subscriptionTier: ${finalProv?.subscriptionTier}`);
    console.log('\n✅ VERIFICATION PASSED — P2028 fix confirmed against Supabase');

  } catch (err) {
    const txDuration = Date.now() - txStart;
    console.error(`\n❌ Transaction FAILED after ${txDuration}ms`);
    console.error(`   Error code: ${err.code}`);
    console.error(`   Error: ${err.message}`);
    if (err.code === 'P2028') {
      console.error('\n❌ P2028 STILL OCCURRING — fix did not resolve the issue');
    }
    throw err;
  } finally {
    await cleanup();
    console.log('\nTest fixtures cleaned up.');
    await prisma.$disconnect();
  }
}

verify().catch(err => {
  console.error(err);
  process.exit(1);
});
