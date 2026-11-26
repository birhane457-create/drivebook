/**
 * Create a test instructor with a stuck PROCESSING payout for recovery testing.
 *
 * This inserts directly into the production database:
 *   1. A test User (email: test-recovery@drivebook.com.au)
 *   2. A test Provider (Stripe Connect account, charges/payouts enabled)
 *   3. A Payout in PROCESSING state with an active reservation
 *   4. Updates PlatformLedger to reflect the reservation
 *
 * No emails, no Stripe calls, no API routes — pure database inserts.
 * Clean up with scripts/cleanup-test-recovery-payout.mjs when done.
 *
 * Usage:
 *   DATABASE_URL="postgresql://sydney..." node scripts/create-test-recovery-payout.mjs --allow-production
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const url = process.env.DATABASE_URL || '';
const allowProduction = process.argv.includes('--allow-production');

if (url.includes('jflrqxigfiiqednfacuf') && !allowProduction) {
  console.error('ERROR: DATABASE_URL points at Sydney production — pass --allow-production');
  process.exit(1);
}

const TEST_EMAIL = 'test-recovery@drivebook.com.au';
const TEST_STRIPE_ACCOUNT = 'acct_test_recovery_demo';
const TEST_PAYOUT_NET = 500; // $500.00

async function main() {
  console.log('Target:', url.replace(/:([^:@]+)@/, ':***@'));
  console.log('\nCreating test instructor with stuck PROCESSING payout...');

  // ── 1. Create test User ──────────────────────────────────────────────────
  let user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });

  if (user) {
    console.log(`User already exists: ${TEST_EMAIL} (id: ${user.id})`);
  } else {
    user = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        name: 'Test Recovery Instructor',
        role: 'PROVIDER',
        termsAcceptedAt: new Date(),
        termsVersion: '1.0',
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`Created user: ${TEST_EMAIL} (id: ${user.id})`);
  }

  // ── 2. Create test Provider ──────────────────────────────────────────────
  let provider = await prisma.provider.findFirst({
    where: { userId: user.id },
  });

  if (provider) {
    console.log(`Provider already exists (id: ${provider.id})`);
  } else {
    provider = await prisma.provider.create({
      data: {
        user: { connect: { id: user.id } },
        name: 'Test Recovery Instructor',
        phone: '+61400000000',
        hourlyRate: 80,
        payoutMethod: 'stripe_connect',
        stripeAccountId: TEST_STRIPE_ACCOUNT,
        chargesEnabled: true,
        payoutsEnabled: true,
        withholdingTaxRate: 0,
      },
    });
    console.log(`Created provider (id: ${provider.id})`);
  }

  // ── 3. Create stuck PROCESSING payout with reservation ──────────────────
  // Check if one already exists
  const existingPayout = await prisma.payout.findFirst({
    where: { providerId: provider.id, status: 'PROCESSING' },
  });

  let payout;
  if (existingPayout) {
    console.log(`PROCESSING payout already exists (id: ${existingPayout.id})`);
    payout = existingPayout;
  } else {
    const payoutRef = `PAY-TEST-RECOVERY-${Date.now()}`;
    const idempotencyKey = `test_recovery_idem_${Date.now()}`;
    const reservationId = `RES_TEST_${Date.now()}`;
    const reservedAt = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago — past the stale threshold

    payout = await prisma.payout.create({
      data: {
        providerId: provider.id,
        status: 'PROCESSING',
        grossAmount: TEST_PAYOUT_NET,
        taxWithheld: 0,
        gstAmount: 0,
        netAmount: TEST_PAYOUT_NET,
        payoutMethod: 'stripe_connect',
        stripeAccountId: TEST_STRIPE_ACCOUNT,
        stripeTransferId: null, // no transfer ID — simulates timeout scenario
        idempotencyKey,
        payoutRef,
        reservedAt,
        reservedAmount: TEST_PAYOUT_NET,
        reservationId,
        recoveryClaimToken: null,
        recoveryClaimExpiresAt: null,
      },
    });
    console.log(`Created PROCESSING payout: ${payoutRef} (id: ${payout.id})`);
    console.log(`  Net amount: $${TEST_PAYOUT_NET}.00`);
    console.log(`  Reservation ID: ${reservationId}`);
    console.log(`  Idempotency key: ${idempotencyKey}`);
    console.log(`  Stripe account: ${TEST_STRIPE_ACCOUNT}`);
    console.log(`  Reserved at: ${reservedAt.toISOString()}`);
  }

  // ── 4. Update PlatformLedger to reflect the reservation ──────────────────
  await prisma.platformLedger.upsert({
    where: { key: 'default' },
    create: {
      key: 'default',
      totalCollected: 10000,
      totalPaidOut: 0,
      totalRefunded: 0,
      totalReserved: 0,
      totalTaxWithheld: 0,
      totalPayoutReserved: TEST_PAYOUT_NET,
    },
    update: {
      totalPayoutReserved: { increment: TEST_PAYOUT_NET },
    },
  });
  console.log(`PlatformLedger.totalPayoutReserved incremented by $${TEST_PAYOUT_NET}.00`);

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n=== TEST PAYOUT CREATED ===');
  console.log(`Instructor: Test Recovery Instructor (${TEST_EMAIL})`);
  console.log(`Payout Ref: ${payout.payoutRef}`);
  console.log(`Payout ID: ${payout.id}`);
  console.log(`Status: PROCESSING (stuck — reserved 10 min ago)`);
  console.log(`Net Amount: $${TEST_PAYOUT_NET}.00 AUD`);
  console.log(`Stripe Account: ${TEST_STRIPE_ACCOUNT}`);
  console.log(`Idempotency Key: ${payout.idempotencyKey}`);
  console.log('\nGo to Admin > Payouts > Recovery tab to see this payout.');
  console.log('Test Complete with a fake tr_... ID and Release to verify the flow.');
  console.log('\nClean up when done:');
  console.log('  DATABASE_URL="..." node scripts/cleanup-test-recovery-payout.mjs --allow-production');
}

main()
  .catch(e => { console.error('Failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
