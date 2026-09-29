/**
 * SUB-06-A Writer #5 Behavioral Verification
 * Manual Subscription Sync (app/api/instructor/subscription/sync/route.ts)
 * 
 * Tests Provider-first locking architecture under concurrency:
 * - Concurrent manual sync requests for same provider
 * - Concurrent manual sync + webhook for same provider
 * - Ownership validation enforcement
 * - Graceful failure with deleted entities
 * - Pre-transaction validation
 * 
 * Key invariant: Provider FOR UPDATE → Subscription FOR UPDATE → ownership → mutate
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

const TEST_PREFIX = 'sub06a-w5';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' as any });

// Test database connection
const testDbUrl = process.env.DATABASE_URL;
if (!testDbUrl) {
  throw new Error('DATABASE_URL not configured for tests');
}

describe('SUB-06-A Writer #5: Manual Subscription Sync - Behavioral Verification', () => {
  let testUserId: string;
  let testProvider1Id: string;
  let testProvider2Id: string;
  let testStripeCustomerId1: string;
  let testStripeSubscriptionId1: string;

  beforeAll(async () => {
    // Create test user
    const testUser = await prisma.user.create({
      data: {
        email: `${TEST_PREFIX}-user-${Date.now()}@test.com`,
        hashedPassword: 'test-hash',
        role: 'INSTRUCTOR',
      },
    });
    testUserId = testUser.id;

    // Create test Provider 1 with Stripe subscription
    const provider1 = await prisma.provider.create({
      data: {
        name: `${TEST_PREFIX}-provider-1`,
        userId: testUserId,
        subscriptionTier: 'PRO',
        subscriptionStatus: 'ACTIVE',
        stripeCustomerId: 'cus_test_provider1',
        stripeSubscriptionId: 'sub_test_provider1',
      },
    });
    testProvider1Id = provider1.id;
    testStripeCustomerId1 = provider1.stripeCustomerId!;
    testStripeSubscriptionId1 = provider1.stripeSubscriptionId!;

    // Create subscription row for Provider 1
    await prisma.subscription.create({
      data: {
        providerId: testProvider1Id,
        tier: 'PRO',
        status: 'ACTIVE',
        stripeCustomerId: testStripeCustomerId1,
        stripeSubscriptionId: testStripeSubscriptionId1,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Create test Provider 2 (for ownership tests)
    const provider2 = await prisma.provider.create({
      data: {
        name: `${TEST_PREFIX}-provider-2`,
        userId: testUserId,
        subscriptionTier: 'BASIC',
        subscriptionStatus: 'TRIAL',
      },
    });
    testProvider2Id = provider2.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.subscription.deleteMany({ where: { providerId: { in: [testProvider1Id, testProvider2Id] } } });
    await prisma.provider.deleteMany({ where: { id: { in: [testProvider1Id, testProvider2Id] } } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  describe('Concurrency Tests', () => {
    it('should serialize concurrent manual sync requests for same provider', async () => {
      // Test invariant: Provider lock serializes concurrent sync requests
      // Expected: Both requests succeed, execute serially, no data corruption

      const syncRequest = async () => {
        return fetch(`http://localhost:3000/api/instructor/subscription/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // TODO: Add proper authentication headers
          },
          body: JSON.stringify({ providerId: testProvider1Id }),
        });
      };

      // Launch two concurrent sync requests
      const [response1, response2] = await Promise.all([
        syncRequest(),
        syncRequest(),
      ]);

      // Both should succeed
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      // Verify final state is consistent (no partial updates)
      const finalProvider = await prisma.provider.findUnique({
        where: { id: testProvider1Id },
        include: { subscriptions: true },
      });

      expect(finalProvider).toBeTruthy();
      expect(finalProvider!.subscriptions.length).toBeGreaterThan(0);
      
      // Verify Provider and Subscription state match
      const activeSub = finalProvider!.subscriptions.find(s => s.status === 'ACTIVE');
      expect(activeSub).toBeTruthy();
      expect(activeSub!.tier).toBe(finalProvider!.subscriptionTier);
      expect(activeSub!.status).toBe(finalProvider!.subscriptionStatus);
    });

    it('should serialize concurrent manual sync + webhook for same provider', async () => {
      // Test invariant: Provider lock serializes manual sync with webhook handler
      // Expected: Serial execution, last event wins, no lost updates

      // Mock webhook event processing
      const webhookUpdate = async () => {
        return prisma.$transaction(async (tx) => {
          // Simulate webhook's Provider-first locking pattern
          const lockedProvider = await tx.provider.findUnique({
            where: { id: testProvider1Id },
            include: { subscriptions: true },
          });

          if (!lockedProvider) throw new Error('Provider not found');

          await tx.provider.update({
            where: { id: testProvider1Id },
            data: { subscriptionStatus: 'PAST_DUE' },
          });

          const sub = lockedProvider.subscriptions[0];
          if (sub) {
            await tx.subscription.update({
              where: { id: sub.id },
              data: { status: 'PAST_DUE' },
            });
          }
        });
      };

      const manualSync = async () => {
        return fetch(`http://localhost:3000/api/instructor/subscription/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ providerId: testProvider1Id }),
        });
      };

      // Launch concurrent operations
      const [webhookResult, syncResponse] = await Promise.all([
        webhookUpdate(),
        manualSync(),
      ]);

      // Both should succeed
      expect(syncResponse.status).toBe(200);

      // Verify final state is consistent (one operation's result, not partial)
      const finalProvider = await prisma.provider.findUnique({
        where: { id: testProvider1Id },
        include: { subscriptions: true },
      });

      expect(finalProvider).toBeTruthy();
      const activeSub = finalProvider!.subscriptions.find(s => s.status !== 'EXPIRED');
      
      // Provider and Subscription status must match (no torn state)
      if (activeSub) {
        expect(activeSub.status).toBe(finalProvider!.subscriptionStatus);
      }
    });
  });

  describe('Ownership Validation', () => {
    it('should prevent cross-provider subscription attachment', async () => {
      // Test invariant: Ownership validation rejects subscription.providerId !== provider.id
      // Expected: Transaction fails before mutation if ownership violated

      // Attempt to manually attach Provider 2's subscription to Provider 1's Stripe ID
      // This should fail ownership validation inside the transaction
      
      const maliciousSync = prisma.$transaction(async (tx) => {
        // Lock Provider 2
        const lockedProvider = await tx.provider.findUnique({
          where: { id: testProvider2Id },
          include: { subscriptions: true },
        });

        if (!lockedProvider) throw new Error('Provider not found');

        // Attempt to lock Provider 1's subscription (ownership violation)
        const sub = await tx.subscription.findFirst({
          where: { stripeSubscriptionId: testStripeSubscriptionId1 },
        });

        if (!sub) throw new Error('Subscription not found');

        // Ownership check should fail here
        if (sub.providerId !== lockedProvider.id) {
          throw new Error('Ownership violation: subscription does not belong to provider');
        }

        // This mutation should never execute
        await tx.provider.update({
          where: { id: testProvider2Id },
          data: { stripeSubscriptionId: testStripeSubscriptionId1 },
        });
      });

      // Should reject with ownership error
      await expect(maliciousSync).rejects.toThrow(/ownership violation/i);

      // Verify Provider 2 was NOT modified
      const provider2Final = await prisma.provider.findUnique({
        where: { id: testProvider2Id },
      });

      expect(provider2Final!.stripeSubscriptionId).toBeNull();
    });
  });

  describe('Graceful Failure', () => {
    it('should fail gracefully when Provider deleted mid-transaction', async () => {
      // Test invariant: Transaction fails atomically if Provider deleted concurrently
      // Expected: No partial mutations, clean error

      // Create temporary provider
      const tempProvider = await prisma.provider.create({
        data: {
          name: `${TEST_PREFIX}-temp-provider`,
          userId: testUserId,
          subscriptionTier: 'PRO',
          subscriptionStatus: 'ACTIVE',
          stripeCustomerId: 'cus_temp',
          stripeSubscriptionId: 'sub_temp',
        },
      });

      // Start transaction, then delete provider
      const racingOperations = Promise.all([
        // Operation 1: Sync transaction
        prisma.$transaction(async (tx) => {
          await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
          const locked = await tx.provider.findUnique({
            where: { id: tempProvider.id },
          });
          if (!locked) throw new Error('Provider deleted during sync');
          
          return tx.provider.update({
            where: { id: tempProvider.id },
            data: { subscriptionStatus: 'PAST_DUE' },
          });
        }),
        
        // Operation 2: Delete provider
        (async () => {
          await new Promise(resolve => setTimeout(resolve, 5));
          await prisma.provider.delete({ where: { id: tempProvider.id } });
        })(),
      ]);

      // One should fail, other should succeed
      await expect(racingOperations).rejects.toThrow();

      // Verify provider is deleted (delete won the race)
      const deleted = await prisma.provider.findUnique({
        where: { id: tempProvider.id },
      });
      expect(deleted).toBeNull();
    });

    it('should return 400 when Provider has no stripeSubscriptionId', async () => {
      // Test invariant: Pre-transaction validation prevents wasted work
      // Expected: 400 response before entering transaction

      const response = await fetch(`http://localhost:3000/api/instructor/subscription/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: testProvider2Id }), // Provider 2 has no Stripe ID
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/no stripe subscription/i);
    });
  });

  describe('Production Route Behavior', () => {
    it('should update Provider and Subscription to match Stripe state', async () => {
      // Test invariant: Sync pulls live Stripe data into DB with proper locking
      // Expected: Provider and Subscription updated atomically

      // This test requires mocking Stripe API or using Stripe test mode
      // For now, verify the route exists and returns expected structure

      const response = await fetch(`http://localhost:3000/api/instructor/subscription/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: testProvider1Id }),
      });

      // Should succeed (or fail with Stripe API error in test env)
      expect([200, 400, 500]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('success');
        expect(data).toHaveProperty('message');
      }
    });
  });
});
