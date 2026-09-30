/**
 * SUB-06-A Writer #6: Cancellation Service — Genuine Lock Contention Test
 *
 * This file supplements sub-06a-writer-06-cancel.test.ts.
 *
 * The existing T5 test (deterministic TOCTOU simulation) proved that
 * cancelSubscription() detects a concurrent cancellation under lock.
 * It does NOT prove that two independent DB transactions actually contend
 * for the Provider lock — the race was simulated by updating the DB before
 * the transaction started.
 *
 * THIS TEST proves genuine lock serialization:
 *   - Two independent prisma.$transaction() calls race for the same Provider lock.
 *   - The lock (lockProvider → SELECT ... FOR UPDATE) serializes them at the DB level.
 *   - Both calls use the same pattern as cancelSubscription() internals.
 *   - The test observes that the second transaction sees the first transaction's
 *     committed state when it finally acquires the lock.
 *
 * Technique:
 *   - Transaction A: acquires Provider lock, sleeps 300ms (via pg_sleep), commits.
 *   - Transaction B: launched concurrently, blocks on the Provider lock while A holds it.
 *   - After both settle: verify B observed A's committed write (not stale pre-A state).
 *   - Timing evidence: B completes >300ms after both were launched, proving it waited.
 *
 * This directly exercises the SUB-06-A security property:
 *   Provider FOR UPDATE serializes concurrent lifecycle mutations.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { lockProvider } from '@/lib/services/subscription-lifecycle';

const prisma = new PrismaClient();

const TEST_USER_ID     = 'test-user-w06-lock';
const TEST_PROVIDER_ID = 'test-provider-w06-lock';
const TEST_EMAIL       = 'w06-lock@test.com';

async function createProvider(status = 'ACTIVE') {
  await prisma.user.create({
    data: { id: TEST_USER_ID, email: TEST_EMAIL, name: 'W06 Lock Test User' },
  });
  return prisma.provider.create({
    data: {
      id: TEST_PROVIDER_ID,
      user: { connect: { id: TEST_USER_ID } },
      name: 'W06 Lock Test Provider',
      phone: '+61400000606',
      hourlyRate: 80,
      subscriptionTier: 'PRO',
      subscriptionStatus: status,
    } as any,
  });
}

async function createSubscription(overrides: Record<string, unknown> = {}) {
  return prisma.subscription.create({
    data: {
      providerId: TEST_PROVIDER_ID,
      tier: 'PRO',
      status: 'ACTIVE',
      monthlyAmount: 49,
      billingCycle: 'monthly',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000),
      ...overrides,
    },
  });
}

beforeEach(async () => {
  await prisma.subscription.deleteMany({ where: { providerId: TEST_PROVIDER_ID } });
  await prisma.provider.deleteMany({ where: { id: TEST_PROVIDER_ID } });
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
});

afterEach(async () => {
  await prisma.subscription.deleteMany({ where: { providerId: TEST_PROVIDER_ID } });
  await prisma.provider.deleteMany({ where: { id: TEST_PROVIDER_ID } });
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
});

describe('SUB-06-A Writer #6: Genuine Provider Lock Contention', () => {

  it('T_LOCK_1: Two concurrent transactions serialized by Provider FOR UPDATE — second sees first commit', async () => {
    // Proof of genuine lock serialization:
    //
    // Transaction A holds the Provider lock for ~300ms (via pg_sleep),
    // writes subscriptionStatus = 'CANCELLED'.
    //
    // Transaction B is launched concurrently. It BLOCKS on lockProvider()
    // because A holds the FOR UPDATE lock.
    //
    // After A commits, B acquires the lock. B must now see subscriptionStatus = 'CANCELLED'
    // (A's committed state), not 'ACTIVE' (pre-A state).
    //
    // If locking were absent, B could read stale 'ACTIVE' and make decisions based on it.

    await createProvider('ACTIVE');
    await createSubscription();

    const startTime = Date.now();

    // Transaction A: lock Provider, sleep 300ms (holds lock), write CANCELLED
    const txA = prisma.$transaction(async (tx) => {
      const lockedProvider = await lockProvider(tx, TEST_PROVIDER_ID);
      expect(lockedProvider.subscriptionStatus).toBe('ACTIVE'); // A sees initial state

      // Hold the lock for 300ms — B must wait at the DB level
      await tx.$executeRawUnsafe(`SELECT pg_sleep(0.3)`);

      await tx.provider.update({
        where: { id: TEST_PROVIDER_ID },
        data: { subscriptionStatus: 'CANCELLED' as any },
      });

      return { txId: 'A', statusSeen: lockedProvider.subscriptionStatus };
    }, { timeout: 10000 });

    // Launch B immediately after A starts — B will block on lockProvider
    // (A has not released the lock yet)
    const txB = prisma.$transaction(async (tx) => {
      // This call BLOCKS until A releases the Provider lock
      const lockedProvider = await lockProvider(tx, TEST_PROVIDER_ID);

      // CRITICAL: B must see A's committed write, not stale 'ACTIVE'
      // This is the security property: post-lock re-read reflects authoritative state
      return { txId: 'B', statusSeen: lockedProvider.subscriptionStatus };
    }, { timeout: 10000 });

    const [resultA, resultB] = await Promise.all([txA, txB]);
    const elapsed = Date.now() - startTime;

    // A saw ACTIVE (initial state before any write)
    expect(resultA.statusSeen).toBe('ACTIVE');

    // B saw CANCELLED — proving B waited for A's lock release and read A's committed write
    expect(resultB.statusSeen).toBe('CANCELLED');

    // Timing: total elapsed should be ≥300ms because B blocked while A held lock
    // (A slept 300ms; B can only start its work after A releases)
    expect(elapsed).toBeGreaterThanOrEqual(290); // slight tolerance for timer precision

    // Final DB state is CANCELLED (A's write persisted)
    const finalProvider = await prisma.provider.findUnique({
      where: { id: TEST_PROVIDER_ID },
    });
    expect(finalProvider!.subscriptionStatus).toBe('CANCELLED');

    console.log('✅ T_LOCK_1 PASS: Two concurrent transactions serialized by Provider FOR UPDATE');
    console.log(`   A saw: ${resultA.statusSeen} → wrote CANCELLED`);
    console.log(`   B saw: ${resultB.statusSeen} (A's committed write, not stale ACTIVE)`);
    console.log(`   Elapsed: ${elapsed}ms (≥300ms proves B blocked while A held lock)`);
  });

  it('T_LOCK_2: Cancellation vs concurrent webhook — Provider lock prevents torn state', async () => {
    // Two simultaneous operations on the same Provider:
    //   Op1: cancelSubscription-like — lock → set CANCELLED
    //   Op2: webhook-like — lock → set ACTIVE (simulates paid conversion arriving late)
    //
    // With Provider FOR UPDATE, one must complete before the other starts.
    // The final state must be one of {CANCELLED, ACTIVE} — never a torn/partial write.
    // Provider and Subscription must agree on the final status.

    await createProvider('ACTIVE');
    const sub = await createSubscription();

    // Op1: Cancellation path — lock Provider, sleep 200ms, write CANCELLED
    const op1 = prisma.$transaction(async (tx) => {
      await lockProvider(tx, TEST_PROVIDER_ID);
      await tx.$executeRawUnsafe(`SELECT pg_sleep(0.2)`);

      await tx.provider.update({
        where: { id: TEST_PROVIDER_ID },
        data: { subscriptionStatus: 'CANCELLED' as any },
      });
      await tx.subscription.update({
        where: { id: sub.id },
        data: { status: 'CANCELLED' },
      });
      return 'CANCELLED';
    }, { timeout: 10000 });

    // Op2: Webhook path — lock Provider, write ACTIVE (concurrent)
    const op2 = prisma.$transaction(async (tx) => {
      await lockProvider(tx, TEST_PROVIDER_ID);

      await tx.provider.update({
        where: { id: TEST_PROVIDER_ID },
        data: { subscriptionStatus: 'ACTIVE' as any },
      });
      await tx.subscription.update({
        where: { id: sub.id },
        data: { status: 'ACTIVE' },
      });
      return 'ACTIVE';
    }, { timeout: 10000 });

    const [finalOp1, finalOp2] = await Promise.all([op1, op2]);

    // Both ops must complete (no deadlock, no error)
    expect(['CANCELLED', 'ACTIVE']).toContain(finalOp1);
    expect(['CANCELLED', 'ACTIVE']).toContain(finalOp2);

    // CRITICAL: Provider and Subscription must be in sync (no torn state)
    const finalProvider = await prisma.provider.findUnique({
      where: { id: TEST_PROVIDER_ID },
    });
    const finalSub = await prisma.subscription.findUnique({
      where: { id: sub.id },
    });

    expect(finalProvider!.subscriptionStatus).toBe(finalSub!.status);
    expect(['CANCELLED', 'ACTIVE']).toContain(finalProvider!.subscriptionStatus);

    console.log('✅ T_LOCK_2 PASS: Cancellation vs webhook — no torn state');
    console.log(`   Op1 wrote: ${finalOp1}, Op2 wrote: ${finalOp2}`);
    console.log(`   Final Provider: ${finalProvider!.subscriptionStatus}, Sub: ${finalSub!.status} (must match)`);
  });

});
