/**
 * SUB-06-A Writer #9: Trial Expiry Cron — CAS Scenario B (Direct DB Test)
 *
 * This file supplements sub-06a-writer-09-trial-expiry.test.ts.
 *
 * The existing T3 test proved the post-webhook-completion scenario:
 * subscription already ACTIVE when cron's findMany runs → findMany finds nothing.
 *
 * CAS Scenario B (this file): subscription is TRIAL when cron's pre-transaction
 * findMany() runs, but a concurrent webhook transaction acquires the Provider lock,
 * converts TRIAL→ACTIVE, and commits — all before the cron's own transaction
 * acquires the lock. The cron's CAS (WHERE status='TRIAL') then returns count=0
 * and the Provider must NOT be reverted to BASIC.
 *
 * Production-faithful sequence (T_CAS_B):
 *   1. cron findMany() runs outside any transaction → observes sub as TRIAL ✓
 *   2. Webhook tx: lockProvider() → Subscription FOR UPDATE → TRIAL→ACTIVE → COMMIT
 *   3. cron tx: lockProvider() → CAS WHERE status='TRIAL' → count=0 → skip Provider
 *
 * Steps 2 and 3 both use lockProvider() (actual SELECT...FOR UPDATE).
 * Step 2 completes before step 3 starts — guaranteed by Promise ordering.
 * This is the exact production race in its most dangerous form: findMany saw
 * TRIAL, webhook committed ACTIVE, cron's CAS must not overwrite it.
 *
 * T_CAS_NORMAL is the control case: no concurrent webhook, CAS returns count=1.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { lockProvider } from '@/lib/services/subscription-lifecycle';

const prisma = new PrismaClient();

const TEST_USER_ID     = 'test-user-w09-cas';
const TEST_PROVIDER_ID = 'test-provider-w09-cas';
const TEST_EMAIL       = 'w09-cas@test.com';

async function createProvider(tier = 'PRO', status = 'TRIAL') {
  await prisma.user.create({
    data: { id: TEST_USER_ID, email: TEST_EMAIL, name: 'W09 CAS Test User' },
  });
  return prisma.provider.create({
    data: {
      id: TEST_PROVIDER_ID,
      user: { connect: { id: TEST_USER_ID } },
      name: 'W09 CAS Test Provider',
      phone: '+61400000909',
      hourlyRate: 80,
      subscriptionTier: tier,
      subscriptionStatus: status,
    } as any,
  });
}

async function createTrialSubscription(overrides: Record<string, unknown> = {}) {
  return prisma.subscription.create({
    data: {
      providerId: TEST_PROVIDER_ID,
      tier: 'PRO',
      status: 'TRIAL',
      monthlyAmount: 0,
      billingCycle: 'monthly',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000),
      trialEndsAt: new Date(Date.now() - 1 * 86400 * 1000), // expired yesterday
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

describe('SUB-06-A Writer #9: CAS Scenario B — In-flight TRIAL→ACTIVE Race', () => {

  it('T_CAS_B: Production-faithful sequence — cron findMany sees TRIAL; webhook tx commits ACTIVE (with Provider lock); cron CAS returns 0; Provider NOT reverted', async () => {
    // This test reproduces the exact production race:
    //
    // Step 1: cron findMany() outside any transaction — observes sub as TRIAL
    // Step 2: Webhook transaction acquires Provider FOR UPDATE, converts TRIAL→ACTIVE, commits
    // Step 3: cron transaction acquires Provider FOR UPDATE, CAS WHERE status=TRIAL → count=0
    //
    // Both step 2 and step 3 use lockProvider() (SELECT...FOR UPDATE).
    // Step 2 completes (commits) before step 3 starts.
    // This is the worst-case production timing: findMany sees TRIAL, but by the time
    // the cron transaction runs its CAS, the webhook has already committed ACTIVE.

    await createProvider('PRO', 'TRIAL');
    const sub = await createTrialSubscription();
    const now = new Date();

    // ── Step 1: cron pre-transaction findMany (outside any tx) ──────────────────
    // This is what the production cron does before entering the per-trial transaction.
    const expiredTrials = await prisma.subscription.findMany({
      where: { status: 'TRIAL', trialEndsAt: { lt: now } },
      include: { provider: { select: { id: true, name: true, userId: true } } },
    });

    // findMany must have found our subscription as TRIAL
    expect(expiredTrials.length).toBe(1);
    expect(expiredTrials[0].id).toBe(sub.id);
    expect(expiredTrials[0].status).toBe('TRIAL');

    // ── Step 2: Webhook transaction — Provider FOR UPDATE → TRIAL→ACTIVE → COMMIT ──
    // This uses lockProvider() exactly as the production webhook handler does.
    // It completes and commits before step 3 starts.
    await prisma.$transaction(async (tx) => {
      // Webhook acquires Provider lock first (SUB-06-A Provider-first)
      await lockProvider(tx, TEST_PROVIDER_ID);

      // Lock the subscription too (webhook pattern)
      await tx.$queryRaw<any[]>`
        SELECT * FROM "Subscription"
        WHERE "id" = ${sub.id}
        FOR UPDATE
      `;

      // Webhook converts TRIAL→ACTIVE (paid conversion)
      await tx.subscription.update({
        where: { id: sub.id },
        data: { status: 'ACTIVE' },
      });

      await tx.provider.update({
        where: { id: TEST_PROVIDER_ID },
        data: {
          subscriptionTier: 'PRO' as any,
          subscriptionStatus: 'ACTIVE' as any,
        },
      });
    }, { timeout: 10000 });

    // Verify webhook committed: sub is now ACTIVE
    const afterWebhook = await prisma.subscription.findUnique({ where: { id: sub.id } });
    expect(afterWebhook!.status).toBe('ACTIVE');

    // ── Step 3: cron transaction — Provider FOR UPDATE → CAS → conditional mutation ──
    // The cron uses the trial from expiredTrials[] (which still has status='TRIAL' in the
    // snapshot). Inside the transaction, the CAS must find count=0 (sub is now ACTIVE).
    let cronCasCount = -1;
    const trial = expiredTrials[0];

    const cronResult = await prisma.$transaction(async (tx) => {
      // Cron acquires Provider lock — same lockProvider() as production cron
      const lockedProvider = await lockProvider(tx, trial.providerId);

      if (!lockedProvider) return null;

      // CAS: only expires if STILL TRIAL AND trialEndsAt < now
      const expireResult = await tx.subscription.updateMany({
        where: {
          id: trial.id,
          status: 'TRIAL',          // Guard: only if still TRIAL
          trialEndsAt: { lt: now },
        },
        data: { status: 'EXPIRED' },
      });

      cronCasCount = expireResult.count;

      if (expireResult.count === 0) {
        // CAS correctly detected concurrent conversion — skip Provider mutation
        return null;
      }

      // Should never reach here in this scenario
      await tx.provider.update({
        where: { id: trial.providerId },
        data: { subscriptionTier: 'BASIC', subscriptionStatus: 'EXPIRED' },
      });
      return 'expired';
    }, { timeout: 10000 });

    // ── Assertions ──────────────────────────────────────────────────────────────

    // CAS must have returned count=0 (sub was ACTIVE when CAS fired)
    expect(cronCasCount).toBe(0);

    // cron transaction must have returned null (skipped Provider mutation)
    expect(cronResult).toBeNull();

    // CRITICAL: Provider must NOT have been reverted to BASIC/EXPIRED
    const finalProvider = await prisma.provider.findUnique({
      where: { id: TEST_PROVIDER_ID },
    });
    expect(finalProvider!.subscriptionTier).toBe('PRO');
    expect(finalProvider!.subscriptionStatus).toBe('ACTIVE');

    // Subscription must remain ACTIVE (webhook's write preserved)
    const finalSub = await prisma.subscription.findUnique({ where: { id: sub.id } });
    expect(finalSub!.status).toBe('ACTIVE');

    console.log('✅ T_CAS_B PASS: Production-faithful sequence');
    console.log('   Step 1: findMany saw TRIAL ✓');
    console.log('   Step 2: Webhook tx (with Provider lock) committed TRIAL→ACTIVE ✓');
    console.log(`   Step 3: Cron CAS count=${cronCasCount} (0 = sub was ACTIVE, CAS correctly failed) ✓`);
    console.log(`   Provider: ${finalProvider!.subscriptionTier}/${finalProvider!.subscriptionStatus} (PRO/ACTIVE, not BASIC/EXPIRED) ✓`);
  });

  it('T_CAS_NORMAL: Normal expiry path — no concurrent webhook, CAS count=1, Provider reverted', async () => {
    // Control case: when no concurrent webhook intervenes,
    // CAS succeeds and Provider is correctly reverted.
    await createProvider('PRO', 'TRIAL');
    const sub = await createTrialSubscription();
    const now = new Date();

    let cronCasCount = -1;

    const result = await prisma.$transaction(async (tx) => {
      const lockedProvider = await lockProvider(tx, TEST_PROVIDER_ID);

      const expireResult = await tx.subscription.updateMany({
        where: {
          id: sub.id,
          status: 'TRIAL',
          trialEndsAt: { lt: now },
        },
        data: { status: 'EXPIRED' },
      });

      cronCasCount = expireResult.count;

      if (expireResult.count === 0) {
        return null;
      }

      await tx.provider.update({
        where: { id: TEST_PROVIDER_ID },
        data: { subscriptionTier: 'BASIC', subscriptionStatus: 'EXPIRED' },
      });
      return 'expired';
    }, { timeout: 10000 });

    expect(cronCasCount).toBe(1);
    expect(result).toBe('expired');

    const finalProvider = await prisma.provider.findUnique({
      where: { id: TEST_PROVIDER_ID },
    });
    expect(finalProvider!.subscriptionTier).toBe('BASIC');
    expect(finalProvider!.subscriptionStatus).toBe('EXPIRED');

    const finalSub = await prisma.subscription.findUnique({ where: { id: sub.id } });
    expect(finalSub!.status).toBe('EXPIRED');

    console.log('✅ T_CAS_NORMAL PASS: Normal expiry — CAS count=1, Provider BASIC/EXPIRED');
  });

});
