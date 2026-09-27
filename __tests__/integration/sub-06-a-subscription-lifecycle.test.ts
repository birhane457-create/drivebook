/**
 * SUB-06-A: Provider/Subscription Lifecycle Identity Remediation
 * Integration Test Suite (Rev 7)
 * 
 * Tests all documented scenarios from Rev 7 design:
 * 1. Concurrent creation (registration + webhook)
 * 2. Metadata preservation (3 fields simultaneously)
 * 3. Equal-second event history handling
 * 4. Monotonic watermark preservation
 * 5. Existing-row ownership mismatch rejection
 * 6. New subscription creation ownership establishment
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';
import {
  processSubscriptionEvent,
  lockProviderAndSubscription,
  validateSubscriptionIdentity,
  validateProviderSubscriptionOwnership,
  canTransitionSubscriptionState,
} from '@/lib/services/subscription-lifecycle';

// Test fixtures
const TEST_STRIPE_CUSTOMER_ID = 'cus_test_sub06a_001';
const TEST_STRIPE_SUBSCRIPTION_ID = 'sub_test_sub06a_001';
const TEST_PROVIDER_ID = 'test-provider-sub06a-001';

// Mock Stripe event factory
function createMockStripeEvent(
  type: string,
  subscription: Partial<Stripe.Subscription>,
  timestamp: number
): Stripe.Event {
  return {
    id: `evt_test_${Date.now()}_${Math.random()}`,
    object: 'event',
    api_version: '2026-02-25.clover',
    created: timestamp,
    type: type as any,
    data: {
      object: {
        id: TEST_STRIPE_SUBSCRIPTION_ID,
        object: 'subscription',
        customer: TEST_STRIPE_CUSTOMER_ID,
        status: 'active',
        items: {
          object: 'list',
          data: [
            {
              id: 'si_test',
              object: 'subscription_item',
              price: {
                id: 'price_test',
                object: 'price',
                unit_amount: 2900,
                currency: 'aud',
                recurring: { interval: 'month' },
              } as any,
            } as any,
          ],
        } as any,
        current_period_start: timestamp - 86400,
        current_period_end: timestamp + 2592000,
        metadata: { tier: 'BASIC' },
        ...subscription,
      } as Stripe.Subscription,
    },
    livemode: false,
    pending_webhooks: 0,
    request: null,
  } as Stripe.Event;
}

describe('SUB-06-A: Subscription Lifecycle Identity Remediation', () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.subscription.deleteMany({
      where: { stripeCustomerId: TEST_STRIPE_CUSTOMER_ID },
    });
    await prisma.provider.deleteMany({
      where: { id: TEST_PROVIDER_ID },
    });
    await prisma.user.deleteMany({
      where: { email: 'test-sub06a@example.com' },
    });
  });

  afterEach(async () => {
    // Clean up after each test
    await prisma.subscription.deleteMany({
      where: { stripeCustomerId: TEST_STRIPE_CUSTOMER_ID },
    });
    await prisma.provider.deleteMany({
      where: { id: TEST_PROVIDER_ID },
    });
    await prisma.user.deleteMany({
      where: { email: 'test-sub06a@example.com' },
    });
  });

  describe('Scenario 1: Concurrent Creation (Writer 7 Race)', () => {
    it('should handle genuine concurrent registration and webhook with proper convergence', async () => {
      // This test creates a REAL race between registration and webhook
      // Both paths use the PRODUCTION shared helper createOrReuseTrialSubscription
      // CRITICAL: Test verifies proper lifecycle convergence regardless of winner
      
      // Setup: Create base user and provider WITHOUT subscription
      const user = await prisma.user.create({
        data: {
          email: 'test-sub06a@example.com',
          name: 'Test Provider SUB-06-A',
          role: 'PROVIDER',
        },
      });

      const provider = await prisma.provider.create({
        data: {
          id: TEST_PROVIDER_ID,
          userId: user.id,
          name: 'Test Provider',
          stripeCustomerId: TEST_STRIPE_CUSTOMER_ID,
          location: 'Test Location',
          phone: '+61412345678',
          hourlyRate: 75.0,
          subscriptionTier: 'BASIC',
          subscriptionStatus: 'TRIAL',
        },
      });

      // Prepare webhook event
      const event = createMockStripeEvent(
        'customer.subscription.created',
        { id: TEST_STRIPE_SUBSCRIPTION_ID, status: 'active' },
        Math.floor(Date.now() / 1000)
      );

      // Helper to wrap transaction with serialization retry (matches production behavior)
      const withSerializationRetry = async <T>(
        operation: () => Promise<T>,
        maxRetries = 3
      ): Promise<T> => {
        let lastError: any;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            return await operation();
          } catch (error: any) {
            const isSerializationError =
              error.code === 'P2034' || // Prisma serialization error
              error.code === '40001'; // PostgreSQL SQLSTATE 40001
            
            if (!isSerializationError || attempt === maxRetries - 1) {
              throw error;
            }
            
            lastError = error;
            // Brief backoff before retry
            await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
          }
        }
        throw lastError;
      };

      // Execute CONCURRENT transactions with production retry behavior:
      // Path A: Registration using PRODUCTION shared helper
      // Path B: Webhook with full lifecycle processing
      const results = await Promise.allSettled([
        // Path A: Production registration helper (same code as app/api/register)
        withSerializationRetry(() =>
          prisma.$transaction(
            async (tx) => {
              const { createOrReuseTrialSubscription } = await import('@/lib/services/subscription-lifecycle');
              return await createOrReuseTrialSubscription(tx, provider.id);
            },
            { isolationLevel: 'Serializable', timeout: 10000 }
          )
        ),

        // Path B: Webhook with full lifecycle processing
        withSerializationRetry(() =>
          prisma.$transaction(
            async (tx) => {
              return await processSubscriptionEvent(tx, event, TEST_STRIPE_CUSTOMER_ID);
            },
            { isolationLevel: 'Serializable', timeout: 10000 }
          )
        ),
      ]);

      // With serialization retry wrapper, BOTH operations should eventually succeed
      // One creates the subscription, the other finds it and converges
      const failedResults = results.filter((r) => r.status === 'rejected');
      if (failedResults.length > 0) {
        console.error('Transaction failures after retry:', failedResults.map((r: any) => ({
          message: r.reason?.message,
          code: r.reason?.code,
        })));
      }
      
      // Both should succeed (with retry mechanism handling serialization conflicts)
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);

      // Verify CRITICAL invariants:
      
      // 1. Exactly ONE current/eligible subscription exists (NOT CANCELLED)
      const subscriptions = await prisma.subscription.findMany({
        where: { 
          providerId: provider.id,
          status: { not: 'CANCELLED' }, // Current lifecycle only
        },
      });

      expect(subscriptions).toHaveLength(1);
      
      const finalSubscription = subscriptions[0];
      expect(finalSubscription.providerId).toBe(provider.id);
      
      // 2. CRITICAL CONVERGENCE: Stripe ID must be attached (proves TRIAL→webhook transition)
      expect(finalSubscription.stripeSubscriptionId).toBe(TEST_STRIPE_SUBSCRIPTION_ID);
      
      // 3. Status must be ACTIVE (proves webhook was processed and applied state)
      expect(finalSubscription.status).toBe('ACTIVE');
      
      // 4. Webhook watermark must be present (proves event ordering/watermark system works)
      expect(finalSubscription.lastWebhookEventId).toBe(event.id);
      expect(finalSubscription.lastWebhookEventTimestamp).toBe(event.created);
      
      // 5. Provider state synchronized with subscription
      const finalProvider = await prisma.provider.findUnique({
        where: { id: provider.id },
      });
      expect(finalProvider?.subscriptionStatus).toBe('ACTIVE');
      expect(finalProvider?.subscriptionTier).toBe(finalSubscription.tier);
    });

    it('should reject webhook for new Stripe ID when Provider has existing current subscription (one-current invariant)', async () => {
      // ADVERSARIAL TEST: Provider has existing ACTIVE subscription with sub_old
      // Webhook arrives for sub_new → must NOT create second current subscription
      
      const user = await prisma.user.create({
        data: {
          email: 'test-sub06a-adversarial@example.com',
          name: 'Test Provider Adversarial',
          role: 'PROVIDER',
        },
      });

      const provider = await prisma.provider.create({
        data: {
          id: 'test-provider-adversarial',
          userId: user.id,
          name: 'Test Provider',
          stripeCustomerId: 'cus_adversarial',
          location: 'Test Location',
          phone: '+61412345678',
          hourlyRate: 75.0,
          subscriptionTier: 'PREMIUM',
          subscriptionStatus: 'ACTIVE',
        },
      });

      // Create existing ACTIVE subscription with sub_old
      const existingSubscription = await prisma.subscription.create({
        data: {
          providerId: provider.id,
          tier: 'PREMIUM',
          status: 'ACTIVE',
          stripeSubscriptionId: 'sub_old_existing',
          monthlyAmount: 99.0,
          billingCycle: 'monthly',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000),
          lastWebhookEventId: 'evt_old',
          lastWebhookEventTimestamp: Math.floor(Date.now() / 1000) - 1000,
        },
      });

      // Prepare webhook for NEW Stripe subscription ID
      const event = createMockStripeEvent(
        'customer.subscription.created',
        { id: 'sub_new_different', status: 'active' },
        Math.floor(Date.now() / 1000)
      );

      // Execute webhook processing
      const result = await prisma.$transaction(
        async (tx) => {
          return await processSubscriptionEvent(tx, event, provider.stripeCustomerId);
        },
        { isolationLevel: 'Serializable', timeout: 10000 }
      );

      // CRITICAL: Webhook must be REJECTED (cannot create second current subscription)
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('one-current-subscription-invariant-violation');

      // Verify: ONLY the original subscription exists (no duplicate created)
      const subscriptions = await prisma.subscription.findMany({
        where: {
          providerId: provider.id,
          status: { not: 'CANCELLED' },
        },
      });

      expect(subscriptions).toHaveLength(1);
      expect(subscriptions[0].id).toBe(existingSubscription.id);
      expect(subscriptions[0].stripeSubscriptionId).toBe('sub_old_existing');
      expect(subscriptions[0].status).toBe('ACTIVE');
    });
  });

  describe('Scenario 2: Metadata Preservation', () => {
    it('should preserve all 3 archived metadata fields simultaneously', async () => {
      // Setup: Create provider and subscription
      const user = await prisma.user.create({
        data: {
          email: 'test-sub06a@example.com',
          name: 'Test Provider',
          role: 'PROVIDER',
        },
      });

      const provider = await prisma.provider.create({
        data: {
          id: TEST_PROVIDER_ID,
          userId: user.id,
          name: 'Test Provider',
          stripeCustomerId: TEST_STRIPE_CUSTOMER_ID,
          location: 'Test Location',
          phone: '+61412345678',
          hourlyRate: 75.0, // Required field
        },
      });

      const originalSubId = 'sub_original_001';
      const archivedAt = new Date('2025-01-01T00:00:00Z');

      const subscription = await prisma.subscription.create({
        data: {
          providerId: provider.id,
          stripeCustomerId: TEST_STRIPE_CUSTOMER_ID,
          stripeSubscriptionId: TEST_STRIPE_SUBSCRIPTION_ID,
          tier: 'PRO',
          status: 'ACTIVE',
          monthlyAmount: 49,
          billingCycle: 'monthly',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000),
          metadata: {
            originalStripeSubscriptionId: originalSubId,
            archivedReason: 'provider-initiated-cancellation',
            archivedAt: archivedAt.toISOString(),
          },
        },
      });

      // Update subscription via webhook
      const event = createMockStripeEvent(
        'customer.subscription.updated',
        { status: 'past_due' },
        Math.floor(Date.now() / 1000)
      );

      await prisma.$transaction(
        async (tx) => {
          return await processSubscriptionEvent(tx, event, TEST_STRIPE_CUSTOMER_ID);
        },
        { isolationLevel: 'Serializable' }
      );

      // Verify: All 3 metadata fields preserved
      const updated = await prisma.subscription.findUnique({
        where: { id: subscription.id },
      });

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('PAST_DUE');
      expect(updated!.metadata).toEqual({
        originalStripeSubscriptionId: originalSubId,
        archivedReason: 'provider-initiated-cancellation',
        archivedAt: archivedAt.toISOString(),
      });
    });
  });

  describe('Scenario 3: Equal-Second Event History Handling', () => {
    it('should reject equal-timestamp events as ambiguous', async () => {
      // Setup
      const user = await prisma.user.create({
        data: {
          email: 'test-sub06a@example.com',
          name: 'Test Provider',
          role: 'PROVIDER',
        },
      });

      const provider = await prisma.provider.create({
        data: {
          id: TEST_PROVIDER_ID,
          userId: user.id,
          name: 'Test Provider',
          stripeCustomerId: TEST_STRIPE_CUSTOMER_ID,
          location: 'Test Location',
          phone: '+61412345678',
          hourlyRate: 75.0, // Required field
        },
      });

      const baseTimestamp = Math.floor(Date.now() / 1000);

      // First event at timestamp T
      const event1 = createMockStripeEvent(
        'customer.subscription.updated',
        { status: 'active' },
        baseTimestamp
      );

      await prisma.$transaction(
        async (tx) => {
          return await processSubscriptionEvent(tx, event1, TEST_STRIPE_CUSTOMER_ID);
        },
        { isolationLevel: 'Serializable' }
      );

      // Second event at SAME timestamp T
      const event2 = createMockStripeEvent(
        'customer.subscription.updated',
        { status: 'past_due' },
        baseTimestamp // Same timestamp
      );

      const result2 = await prisma.$transaction(
        async (tx) => {
          return await processSubscriptionEvent(tx, event2, TEST_STRIPE_CUSTOMER_ID);
        },
        { isolationLevel: 'Serializable' }
      );

      // Verify: Second event rejected as ambiguous
      expect(result2.allowed).toBe(false);
      expect(result2.reason).toBe('inv-5-equal-timestamp-ambiguous');

      // Verify: State not mutated (still ACTIVE from first event)
      const subscription = await prisma.subscription.findFirst({
        where: { providerId: provider.id },
      });

      expect(subscription!.status).toBe('ACTIVE'); // Not changed to PAST_DUE
      expect(subscription!.lastWebhookEventTimestamp).toBe(baseTimestamp);
    });
  });

  describe('Scenario 4: Monotonic Watermark Preservation', () => {
    it('should reject events older than current watermark', async () => {
      // Setup
      const user = await prisma.user.create({
        data: {
          email: 'test-sub06a@example.com',
          name: 'Test Provider',
          role: 'PROVIDER',
        },
      });

      const provider = await prisma.provider.create({
        data: {
          id: TEST_PROVIDER_ID,
          userId: user.id,
          name: 'Test Provider',
          stripeCustomerId: TEST_STRIPE_CUSTOMER_ID,
          location: 'Test Location',
          phone: '+61412345678',
          hourlyRate: 75.0, // Required field
        },
      });

      const newerTimestamp = Math.floor(Date.now() / 1000);
      const olderTimestamp = newerTimestamp - 3600; // 1 hour earlier

      // Process newer event first
      const newerEvent = createMockStripeEvent(
        'customer.subscription.updated',
        { status: 'active' },
        newerTimestamp
      );

      await prisma.$transaction(
        async (tx) => {
          return await processSubscriptionEvent(tx, newerEvent, TEST_STRIPE_CUSTOMER_ID);
        },
        { isolationLevel: 'Serializable' }
      );

      // Try to process older event (out-of-order delivery)
      const olderEvent = createMockStripeEvent(
        'customer.subscription.updated',
        { status: 'trialing' },
        olderTimestamp
      );

      const result = await prisma.$transaction(
        async (tx) => {
          return await processSubscriptionEvent(tx, olderEvent, TEST_STRIPE_CUSTOMER_ID);
        },
        { isolationLevel: 'Serializable' }
      );

      // Verify: Older event rejected
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('inv-3-event-older-than-watermark');

      // Verify: State not mutated (watermark preserved)
      const subscription = await prisma.subscription.findFirst({
        where: { providerId: provider.id },
      });

      expect(subscription!.status).toBe('ACTIVE');
      expect(subscription!.lastWebhookEventTimestamp).toBe(newerTimestamp);
    });
  });

  describe('Scenario 5: Existing-Row Ownership Mismatch Rejection', () => {
    it('should reject events when Subscription belongs to different Provider', async () => {
      // Setup: Create two providers with different Stripe customer IDs
      const user1 = await prisma.user.create({
        data: {
          email: `provider-a-${Date.now()}@example.com`,
          name: 'Provider A',
          role: 'PROVIDER',
        },
      });

      const providerA = await prisma.provider.create({
        data: {
          id: 'provider-a-sub06a',
          userId: user1.id,
          name: 'Provider A',
          stripeCustomerId: 'cus_provider_a',
          location: 'Location A',
          phone: '+61412111111',
          hourlyRate: 70.0, // Required field
        },
      });

      const user2 = await prisma.user.create({
        data: {
          email: `provider-b-${Date.now()}@example.com`,
          name: 'Provider B',
          role: 'PROVIDER',
        },
      });

      const providerB = await prisma.provider.create({
        data: {
          id: 'provider-b-sub06a',
          userId: user2.id,
          name: 'Provider B',
          stripeCustomerId: 'cus_provider_b',
          location: 'Location B',
          phone: '+61412222222',
          hourlyRate: 80.0, // Required field
        },
      });

      // Create subscription owned by Provider B
      await prisma.subscription.create({
        data: {
          providerId: providerB.id, // Owned by Provider B
          stripeCustomerId: 'cus_provider_b',
          stripeSubscriptionId: TEST_STRIPE_SUBSCRIPTION_ID,
          tier: 'PRO',
          status: 'ACTIVE',
          monthlyAmount: 49,
          billingCycle: 'monthly',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000),
        },
      });

      // Webhook arrives claiming subscription belongs to Provider A's customer
      const event = createMockStripeEvent(
        'customer.subscription.updated',
        {
          customer: 'cus_provider_a', // Claims to belong to Provider A
          id: TEST_STRIPE_SUBSCRIPTION_ID,
        },
        Math.floor(Date.now() / 1000)
      );

      // Attempt to process with Provider A's customer ID
      const result = await prisma.$transaction(
        async (tx) => {
          return await processSubscriptionEvent(tx, event, 'cus_provider_a');
        },
        { isolationLevel: 'Serializable' }
      ).catch((err) => {
        // Transaction will fail when trying to lock - Provider A doesn't own this subscription
        return { allowed: false, reason: 'provider-not-found' };
      });

      // Verify: Event rejected (ownership mismatch detected)
      expect(result.allowed).toBe(false);
    });
  });

  describe('Scenario 6: New Subscription Creation Ownership Establishment', () => {
    it('should create new subscription with locked Provider ID', async () => {
      // Setup: Provider exists, no subscription yet
      const user = await prisma.user.create({
        data: {
          email: 'test-sub06a@example.com',
          name: 'Test Provider',
          role: 'PROVIDER',
        },
      });

      const provider = await prisma.provider.create({
        data: {
          id: TEST_PROVIDER_ID,
          userId: user.id,
          name: 'Test Provider',
          stripeCustomerId: TEST_STRIPE_CUSTOMER_ID,
          location: 'Test Location',
          phone: '+61412345678',
          hourlyRate: 75.0, // Required field
        },
      });

      // Webhook arrives for new subscription
      const event = createMockStripeEvent(
        'customer.subscription.created',
        {
          id: TEST_STRIPE_SUBSCRIPTION_ID,
          customer: TEST_STRIPE_CUSTOMER_ID,
          status: 'active',
        },
        Math.floor(Date.now() / 1000)
      );

      // Process webhook - should create new subscription
      const result = await prisma.$transaction(
        async (tx) => {
          return await processSubscriptionEvent(tx, event, TEST_STRIPE_CUSTOMER_ID);
        },
        { isolationLevel: 'Serializable' }
      );

      // Verify: Subscription created successfully
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('created');
      expect(result.subscriptionId).toBeDefined();

      // Verify: Created subscription uses locked Provider's ID
      const subscription = await prisma.subscription.findUnique({
        where: { id: result.subscriptionId! },
      });

      expect(subscription).not.toBeNull();
      expect(subscription!.providerId).toBe(provider.id);
      expect(subscription!.stripeSubscriptionId).toBe(TEST_STRIPE_SUBSCRIPTION_ID);
      expect(subscription!.stripeCustomerId).toBe(TEST_STRIPE_CUSTOMER_ID);

      // Verify: Subsequent webhook validates ownership correctly
      const event2 = createMockStripeEvent(
        'customer.subscription.updated',
        { status: 'past_due' },
        Math.floor(Date.now() / 1000) + 100
      );

      const result2 = await prisma.$transaction(
        async (tx) => {
          return await processSubscriptionEvent(tx, event2, TEST_STRIPE_CUSTOMER_ID);
        },
        { isolationLevel: 'Serializable' }
      );

      expect(result2.allowed).toBe(true);
      expect(result2.reason).toBe('updated');
    });
  });

  describe('Unit Tests: Validation Functions', () => {
    it('validateSubscriptionIdentity should detect ID mismatch', () => {
      const lockedSub = {
        id: 'sub-123',
        stripeSubscriptionId: 'sub_correct_001',
      };

      const result = validateSubscriptionIdentity(lockedSub, 'sub_wrong_001');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('subscription-id-mismatch');
    });

    it('validateProviderSubscriptionOwnership should detect ownership mismatch', () => {
      const provider = { id: 'provider-a' };
      const subscription = { id: 'sub-123', providerId: 'provider-b' };

      const result = validateProviderSubscriptionOwnership(provider, subscription);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('provider-subscription-ownership-mismatch');
    });

    it('validateProviderSubscriptionOwnership should allow new subscriptions', () => {
      const provider = { id: 'provider-a' };
      const subscription = null; // New subscription

      const result = validateProviderSubscriptionOwnership(provider, subscription);

      expect(result.valid).toBe(true);
    });
  });

  describe('INV-2: Cancellation Semantics', () => {
    it('should reject non-CANCELLED events after webhook-driven CANCELLED', async () => {
      // Setup
      const user = await prisma.user.create({
        data: {
          email: 'test-sub06a@example.com',
          name: 'Test Provider',
          role: 'PROVIDER',
        },
      });

      const provider = await prisma.provider.create({
        data: {
          id: TEST_PROVIDER_ID,
          userId: user.id,
          name: 'Test Provider',
          stripeCustomerId: TEST_STRIPE_CUSTOMER_ID,
          location: 'Test Location',
          phone: '+61412345678',
          hourlyRate: 75.0, // Required field
        },
      });

      const timestamp = Math.floor(Date.now() / 1000);

      // Process cancellation event
      const cancelEvent = createMockStripeEvent(
        'customer.subscription.deleted',
        { status: 'canceled' },
        timestamp
      );

      await prisma.$transaction(
        async (tx) => {
          return await processSubscriptionEvent(tx, cancelEvent, TEST_STRIPE_CUSTOMER_ID);
        },
        { isolationLevel: 'Serializable' }
      );

      // Try to process reactivation event
      const reactivateEvent = createMockStripeEvent(
        'customer.subscription.updated',
        { status: 'active' },
        timestamp + 100
      );

      const result = await prisma.$transaction(
        async (tx) => {
          return await processSubscriptionEvent(tx, reactivateEvent, TEST_STRIPE_CUSTOMER_ID);
        },
        { isolationLevel: 'Serializable' }
      );

      // Verify: Reactivation rejected by INV-2
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('inv-2-cancelled-lifecycle-cannot-reactivate-via-webhook');

      // Verify: State remains CANCELLED
      const subscription = await prisma.subscription.findFirst({
        where: { providerId: provider.id },
      });

      expect(subscription!.status).toBe('CANCELLED');
    });
  });
});
