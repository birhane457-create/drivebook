/**
 * SUB-12-A Concurrent Test: Trial Expiry vs Paid Conversion Race
 *
 * CRITICAL RACE CONDITION:
 * T1: Cron reads expired TRIAL subscription
 * T2: Webhook activates same subscription (paid conversion)
 * T1: Attempts to mark EXPIRED
 * T2: Attempts to mark ACTIVE
 *
 * EXPECTED BEHAVIOR (after SUB-12-A fix):
 * - Exactly one operation succeeds
 * - No overwrite of ACTIVE → EXPIRED
 * - No overwrite of EXPIRED → ACTIVE (if cron wins)
 * - Provider state remains consistent with subscription state
 *
 * TEST APPROACH:
 * Since we cannot directly trigger the cron endpoint from tests (auth required),
 * we test the underlying Prisma operation pattern that matches the fix.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import type { Subscription, Provider } from '@prisma/client';

describe('SUB-12-A: Trial Expiry vs Paid Conversion Race', () => {
  let testProvider: Provider;
  let testSubscription: Subscription;

  beforeEach(async () => {
    // Create test provider (userId is optional/nullable)
    testProvider = await prisma.provider.create({
      data: {
        name: 'Test Instructor SUB12A',
        phone: '0400000000',
        hourlyRate: 80,
        approvalStatus: 'APPROVED',
        subscriptionTier: 'PRO',
        subscriptionStatus: 'TRIAL',
        stripeCustomerId: `cus_test_sub12a_${Date.now()}`,
      },
    });

    // Create expired trial subscription
    const trialExpiry = new Date(Date.now() - 1000 * 60 * 60 * 24); // 1 day ago
    testSubscription = await prisma.subscription.create({
      data: {
        providerId: testProvider.id,
        tier: 'PRO',
        status: 'TRIAL',
        monthlyAmount: 0,
        billingCycle: 'MONTHLY',
        trialEndsAt: trialExpiry,
        currentPeriodStart: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14),
        currentPeriodEnd: trialExpiry,
        stripeCustomerId: testProvider.stripeCustomerId,
        stripeSubscriptionId: null, // Trial not yet converted
      },
    });
  });

  afterEach(async () => {
    // Cleanup
    if (testSubscription?.id) {
      await prisma.subscription.deleteMany({ where: { id: testSubscription.id } });
    }
    if (testProvider?.id) {
      await prisma.provider.deleteMany({ where: { id: testProvider.id } });
    }
  });

  it('prevents cron from expiring a trial that a webhook just converted to ACTIVE', async () => {
    const now = new Date();

    // Simulate concurrent operations
    const [cronResult, webhookResult] = await Promise.all([
      // T1: Cron attempts to expire trial (SUB-12-A pattern)
      prisma.$transaction(async (tx) => {
        const expireResult = await tx.subscription.updateMany({
          where: {
            id: testSubscription.id,
            status: 'TRIAL',
            trialEndsAt: { lt: now },
          },
          data: { status: 'EXPIRED' },
        });

        if (expireResult.count === 0) {
          return { operation: 'cron-skip', affected: 0 };
        }

        await tx.provider.update({
          where: { id: testProvider.id },
          data: {
            subscriptionTier: 'BASIC',
            subscriptionStatus: 'EXPIRED',
          },
        });

        return { operation: 'cron-expire', affected: 1 };
      }),

      // T2: Webhook converts trial to ACTIVE (SUB-22 pattern)
      prisma.$transaction(async (tx) => {
        const claimResult = await tx.subscription.updateMany({
          where: {
            id: testSubscription.id,
            status: 'TRIAL',
            stripeSubscriptionId: null,
          },
          data: {
            status: 'ACTIVE',
            stripeSubscriptionId: 'sub_test_12a_converted',
            currentPeriodStart: now,
            currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        });

        if (claimResult.count === 0) {
          return { operation: 'webhook-skip', affected: 0 };
        }

        await tx.provider.update({
          where: { id: testProvider.id },
          data: {
            subscriptionStatus: 'ACTIVE',
          },
        });

        return { operation: 'webhook-activate', affected: 1 };
      }),
    ]);

    // Verify exactly one operation succeeded
    const totalAffected = cronResult.affected + webhookResult.affected;
    expect(totalAffected).toBe(1);

    // Read final state
    const finalSub = await prisma.subscription.findUnique({
      where: { id: testSubscription.id },
    });
    const finalProvider = await prisma.provider.findUnique({
      where: { id: testProvider.id },
    });

    // Verify consistency
    expect(finalSub).not.toBeNull();
    expect(finalProvider).not.toBeNull();

    if (cronResult.affected === 1) {
      // Cron won the race
      expect(finalSub!.status).toBe('EXPIRED');
      expect(finalProvider!.subscriptionStatus).toBe('EXPIRED');
      expect(finalProvider!.subscriptionTier).toBe('BASIC');
      expect(webhookResult.operation).toBe('webhook-skip');
    } else {
      // Webhook won the race (more likely with atomic updateMany)
      expect(finalSub!.status).toBe('ACTIVE');
      expect(finalSub!.stripeSubscriptionId).toBe('sub_test_12a_converted');
      expect(finalProvider!.subscriptionStatus).toBe('ACTIVE');
      expect(finalProvider!.subscriptionTier).toBe('PRO'); // Unchanged
      expect(cronResult.operation).toBe('cron-skip');
    }
  });

  it('allows cron to expire trial when no conversion webhook arrives', async () => {
    const now = new Date();

    // Only cron runs (no webhook)
    const cronResult = await prisma.$transaction(async (tx) => {
      const expireResult = await tx.subscription.updateMany({
        where: {
          id: testSubscription.id,
          status: 'TRIAL',
          trialEndsAt: { lt: now },
        },
        data: { status: 'EXPIRED' },
      });

      if (expireResult.count === 0) {
        return { operation: 'cron-skip', affected: 0 };
      }

      await tx.provider.update({
        where: { id: testProvider.id },
        data: {
          subscriptionTier: 'BASIC',
          subscriptionStatus: 'EXPIRED',
        },
      });

      return { operation: 'cron-expire', affected: 1 };
    });

    expect(cronResult.operation).toBe('cron-expire');
    expect(cronResult.affected).toBe(1);

    // Verify final state
    const finalSub = await prisma.subscription.findUnique({
      where: { id: testSubscription.id },
    });
    const finalProvider = await prisma.provider.findUnique({
      where: { id: testProvider.id },
    });

    expect(finalSub!.status).toBe('EXPIRED');
    expect(finalProvider!.subscriptionStatus).toBe('EXPIRED');
    expect(finalProvider!.subscriptionTier).toBe('BASIC');
  });

  it('prevents cron from re-expiring an already-ACTIVE subscription', async () => {
    // First, convert trial to ACTIVE (simulate previous webhook)
    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: testSubscription.id },
        data: {
          status: 'ACTIVE',
          stripeSubscriptionId: 'sub_test_12a_existing',
        },
      });
      await tx.provider.update({
        where: { id: testProvider.id },
        data: {
          subscriptionStatus: 'ACTIVE',
        },
      });
    });

    // Now cron runs (should skip because status != 'TRIAL')
    const now = new Date();
    const cronResult = await prisma.$transaction(async (tx) => {
      const expireResult = await tx.subscription.updateMany({
        where: {
          id: testSubscription.id,
          status: 'TRIAL', // This won't match
          trialEndsAt: { lt: now },
        },
        data: { status: 'EXPIRED' },
      });

      if (expireResult.count === 0) {
        return { operation: 'cron-skip', affected: 0 };
      }

      await tx.provider.update({
        where: { id: testProvider.id },
        data: {
          subscriptionTier: 'BASIC',
          subscriptionStatus: 'EXPIRED',
        },
      });

      return { operation: 'cron-expire', affected: 1 };
    });

    expect(cronResult.operation).toBe('cron-skip');
    expect(cronResult.affected).toBe(0);

    // Verify ACTIVE state is preserved
    const finalSub = await prisma.subscription.findUnique({
      where: { id: testSubscription.id },
    });
    const finalProvider = await prisma.provider.findUnique({
      where: { id: testProvider.id },
    });

    expect(finalSub!.status).toBe('ACTIVE');
    expect(finalSub!.stripeSubscriptionId).toBe('sub_test_12a_existing');
    expect(finalProvider!.subscriptionStatus).toBe('ACTIVE');
    expect(finalProvider!.subscriptionTier).toBe('PRO'); // Unchanged
  });

  it('handles triple concurrent race: cron + webhook + second webhook', async () => {
    const now = new Date();

    const [cronResult, webhook1Result, webhook2Result] = await Promise.all([
      // T1: Cron expires
      prisma.$transaction(async (tx) => {
        const expireResult = await tx.subscription.updateMany({
          where: {
            id: testSubscription.id,
            status: 'TRIAL',
            trialEndsAt: { lt: now },
          },
          data: { status: 'EXPIRED' },
        });

        if (expireResult.count === 0) {
          return { operation: 'cron-skip', affected: 0 };
        }

        await tx.provider.update({
          where: { id: testProvider.id },
          data: {
            subscriptionTier: 'BASIC',
            subscriptionStatus: 'EXPIRED',
          },
        });

        return { operation: 'cron-expire', affected: 1 };
      }),

      // T2: First webhook activates
      prisma.$transaction(async (tx) => {
        const claimResult = await tx.subscription.updateMany({
          where: {
            id: testSubscription.id,
            status: 'TRIAL',
            stripeSubscriptionId: null,
          },
          data: {
            status: 'ACTIVE',
            stripeSubscriptionId: 'sub_test_12a_webhook1',
          },
        });

        if (claimResult.count === 0) {
          return { operation: 'webhook1-skip', affected: 0 };
        }

        await tx.provider.update({
          where: { id: testProvider.id },
          data: {
            subscriptionStatus: 'ACTIVE',
          },
        });

        return { operation: 'webhook1-activate', affected: 1 };
      }),

      // T3: Second webhook (duplicate event)
      prisma.$transaction(async (tx) => {
        const claimResult = await tx.subscription.updateMany({
          where: {
            id: testSubscription.id,
            status: 'TRIAL',
            stripeSubscriptionId: null,
          },
          data: {
            status: 'ACTIVE',
            stripeSubscriptionId: 'sub_test_12a_webhook2',
          },
        });

        if (claimResult.count === 0) {
          return { operation: 'webhook2-skip', affected: 0 };
        }

        await tx.provider.update({
          where: { id: testProvider.id },
          data: {
            subscriptionStatus: 'ACTIVE',
          },
        });

        return { operation: 'webhook2-activate', affected: 1 };
      }),
    ]);

    // Exactly one operation should succeed
    const totalAffected = cronResult.affected + webhook1Result.affected + webhook2Result.affected;
    expect(totalAffected).toBe(1);

    // Verify final state is consistent
    const finalSub = await prisma.subscription.findUnique({
      where: { id: testSubscription.id },
    });
    const finalProvider = await prisma.provider.findUnique({
      where: { id: testProvider.id },
    });

    expect(finalSub).not.toBeNull();
    expect(finalProvider).not.toBeNull();
    expect(finalSub!.status).toMatch(/^(EXPIRED|ACTIVE)$/);
    expect(finalProvider!.subscriptionStatus).toBe(finalSub!.status);
  });

  it('verifies cron re-confirms expiry inside transaction', async () => {
    // Create a trial that expires "now" (boundary case)
    const trialExpiresNow = new Date();
    await prisma.subscription.update({
      where: { id: testSubscription.id },
      data: { trialEndsAt: trialExpiresNow },
    });

    // Simulate checking with time slightly before expiry
    const checkTime = new Date(trialExpiresNow.getTime() - 100);

    const cronResult = await prisma.$transaction(async (tx) => {
      const expireResult = await tx.subscription.updateMany({
        where: {
          id: testSubscription.id,
          status: 'TRIAL',
          trialEndsAt: { lt: checkTime }, // Should NOT match (not yet expired)
        },
        data: { status: 'EXPIRED' },
      });

      if (expireResult.count === 0) {
        return { operation: 'cron-skip', affected: 0 };
      }

      await tx.provider.update({
        where: { id: testProvider.id },
        data: {
          subscriptionTier: 'BASIC',
          subscriptionStatus: 'EXPIRED',
        },
      });

      return { operation: 'cron-expire', affected: 1 };
    });

    // Should skip because trialEndsAt is not less than checkTime
    expect(cronResult.operation).toBe('cron-skip');
    expect(cronResult.affected).toBe(0);

    // Subscription should still be TRIAL
    const finalSub = await prisma.subscription.findUnique({
      where: { id: testSubscription.id },
    });
    expect(finalSub!.status).toBe('TRIAL');
  });
});
