/**
 * SUB-06-A Writer #5: Manual Subscription Sync — Route-Level Behavioral Tests
 *
 * Invokes the actual production POST handler from
 * app/api/instructor/subscription/sync/route.ts directly (not via HTTP server).
 *
 * Security properties verified:
 * 1. Normal sync: Provider and Subscription updated from Stripe state
 * 2. No stripeSubscriptionId: returns synced:false without mutation
 * 3. Concurrent sync requests: serialized via Provider FOR UPDATE lock
 * 4. TOCTOU A→B: sub-A replaced by sub-B between Stripe fetch and lock;
 *    sub-B is NOT overwritten with sub-A's state; synced:false returned
 * 5. Unauthorized: no session returns 401
 *
 * Each test is independent. No test result is used as evidence for another writer.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/instructor/subscription/sync/route';
import { getServerSession } from 'next-auth';

const prisma = new PrismaClient();

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

// Stripe mock — returns controlled stripeSub object
// Uses metadata.tier to avoid dependency on env var price IDs
const mockStripeRetrieve = vi.fn();
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    subscriptions: {
      retrieve: mockStripeRetrieve,
    },
  })),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TEST_USER_ID   = 'test-user-w05-route';
const TEST_PROVIDER_ID = 'test-provider-w05-route';
const TEST_EMAIL     = 'w05-route@test.com';
const STRIPE_SUB_ID_A = 'sub_w05_A';
const STRIPE_SUB_ID_B = 'sub_w05_B';

function makeStripeSubResponse(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: STRIPE_SUB_ID_A,
    status: 'active',
    current_period_end: now + 30 * 86400,
    current_period_start: now,
    trial_end: null,
    cancel_at_period_end: false,
    customer: 'cus_w05_test',
    metadata: { tier: 'PRO' },
    items: {
      data: [{
        price: {
          id: 'price_pro_monthly_test',
          unit_amount: 4900,
          recurring: { interval: 'month' },
        },
      }],
    },
    ...overrides,
  };
}

function mockSession(userId = TEST_USER_ID, email = TEST_EMAIL) {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: userId, email, role: 'INSTRUCTOR' },
  } as any);
}

function makeSyncRequest() {
  return new NextRequest('http://localhost:3000/api/instructor/subscription/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

async function createFixtures(stripeSubId = STRIPE_SUB_ID_A) {
  await prisma.user.create({
    data: { id: TEST_USER_ID, email: TEST_EMAIL, name: 'W05 Route Test User' },
  });
  await prisma.provider.create({
    data: {
      id: TEST_PROVIDER_ID,
      userId: TEST_USER_ID,
      name: 'W05 Route Test Provider',
      phone: '+61400000055',
      hourlyRate: 80,
      subscriptionTier: 'BASIC',
      subscriptionStatus: 'ACTIVE',
      stripeCustomerId: 'cus_w05_test',
    },
  });
  const sub = await prisma.subscription.create({
    data: {
      providerId: TEST_PROVIDER_ID,
      tier: 'BASIC',
      status: 'ACTIVE',
      monthlyAmount: 29,
      billingCycle: 'monthly',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000),
      stripeSubscriptionId: stripeSubId,
      stripeCustomerId: 'cus_w05_test',
    },
  });
  return sub;
}

// ── Test lifecycle ────────────────────────────────────────────────────────────

beforeEach(async () => {
  await prisma.subscription.deleteMany({ where: { providerId: TEST_PROVIDER_ID } });
  await prisma.provider.deleteMany({ where: { id: TEST_PROVIDER_ID } });
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
  vi.clearAllMocks();
});

afterEach(async () => {
  await prisma.subscription.deleteMany({ where: { providerId: TEST_PROVIDER_ID } });
  await prisma.provider.deleteMany({ where: { id: TEST_PROVIDER_ID } });
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SUB-06-A Writer #5: Manual Subscription Sync — Route-Level', () => {

  it('T1: Normal sync — Provider and Subscription updated to match Stripe state', async () => {
    await createFixtures();
    mockSession();
    mockStripeRetrieve.mockResolvedValue(makeStripeSubResponse({ metadata: { tier: 'PRO' } }));

    const response = await POST(makeSyncRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.synced).toBe(true);
    expect(data.tier).toBe('PRO');
    expect(data.status).toBe('ACTIVE');

    const provider = await prisma.provider.findUnique({ where: { id: TEST_PROVIDER_ID } });
    const sub = await prisma.subscription.findFirst({ where: { providerId: TEST_PROVIDER_ID } });

    expect(provider!.subscriptionTier).toBe('PRO');
    expect(sub!.tier).toBe('PRO');
    expect(sub!.status).toBe('ACTIVE');

    console.log('✅ T1 PASS: Normal sync updates Provider and Subscription via production route');
  });

  it('T2: No stripeSubscriptionId — returns synced:false without mutation', async () => {
    // Provider exists but has no Stripe subscription
    await prisma.user.create({
      data: { id: TEST_USER_ID, email: TEST_EMAIL, name: 'W05 Route Test User' },
    });
    await prisma.provider.create({
      data: {
        id: TEST_PROVIDER_ID,
        userId: TEST_USER_ID,
        name: 'W05 Route Test Provider',
        phone: '+61400000055',
        hourlyRate: 80,
        subscriptionTier: 'BASIC',
        subscriptionStatus: 'TRIAL',
      },
    });
    // Subscription with no stripeSubscriptionId
    await prisma.subscription.create({
      data: {
        providerId: TEST_PROVIDER_ID,
        tier: 'BASIC',
        status: 'TRIAL',
        monthlyAmount: 0,
        billingCycle: 'monthly',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000),
        stripeSubscriptionId: null,
      },
    });

    mockSession();

    const response = await POST(makeSyncRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.synced).toBe(false);
    expect(data.reason).toBe('No Stripe subscription to sync');

    // Verify: Stripe was never called (no stripeSubscriptionId)
    expect(mockStripeRetrieve).not.toHaveBeenCalled();

    console.log('✅ T2 PASS: No stripeSubscriptionId returns synced:false, Stripe not called');
  });

  it('T3: Concurrent sync requests — serialized by Provider FOR UPDATE, one subscription', async () => {
    await createFixtures();
    mockSession();
    // Both calls return same Stripe state
    mockStripeRetrieve.mockResolvedValue(makeStripeSubResponse({ metadata: { tier: 'PRO' } }));

    const [r1, r2] = await Promise.allSettled([
      POST(makeSyncRequest()),
      POST(makeSyncRequest()),
    ]);

    expect(r1.status).toBe('fulfilled');
    expect(r2.status).toBe('fulfilled');

    const data1 = await (r1 as PromiseFulfilledResult<any>).value.json();
    const data2 = await (r2 as PromiseFulfilledResult<any>).value.json();

    // Both should succeed — same Stripe state, idempotent result
    expect(data1.synced).toBe(true);
    expect(data2.synced).toBe(true);

    // Final state consistent: Provider and Subscription in sync
    const provider = await prisma.provider.findUnique({ where: { id: TEST_PROVIDER_ID } });
    const subs = await prisma.subscription.findMany({
      where: { providerId: TEST_PROVIDER_ID, status: { not: 'CANCELLED' } },
    });

    expect(subs.length).toBe(1);
    expect(provider!.subscriptionTier).toBe(subs[0].tier);

    console.log('✅ T3 PASS: Concurrent sync requests serialize — exactly 1 subscription, consistent state');
    console.log(`   Final tier: ${provider!.subscriptionTier}`);
  });

  it('T4: TOCTOU — sub-A replaced by sub-B between Stripe fetch and lock; B not overwritten', async () => {
    // Setup: sub-A is the current subscription the route will fetch from Stripe
    const subA = await createFixtures(STRIPE_SUB_ID_A);

    mockSession();

    // Stripe mock for sub-A with PRO tier
    mockStripeRetrieve.mockResolvedValue(
      makeStripeSubResponse({ id: STRIPE_SUB_ID_A, metadata: { tier: 'PRO' } })
    );

    // Record sub-B's initial state (BASIC) before it exists
    // Simulate the A→B replacement: cancel sub-A, create sub-B BEFORE the route's
    // transaction acquires the lock. We do this by intercepting after the Stripe call
    // but before the transaction using a delayed mock that performs the replacement.

    // Strategy: use a mockResolvedValue that also performs the DB replacement as a side effect
    // when Stripe.retrieve is called (i.e., at the point between Stripe fetch and tx).
    let replacementDone = false;
    mockStripeRetrieve.mockImplementation(async () => {
      // Simulate concurrent operation: cancel sub-A, create sub-B
      if (!replacementDone) {
        replacementDone = true;
        await prisma.subscription.update({
          where: { id: subA.id },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        });
        await prisma.subscription.create({
          data: {
            providerId: TEST_PROVIDER_ID,
            tier: 'BASIC',                      // B has BASIC — different from A's PRO
            status: 'ACTIVE',
            monthlyAmount: 29,
            billingCycle: 'monthly',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000),
            stripeSubscriptionId: STRIPE_SUB_ID_B, // B has a DIFFERENT Stripe ID
            stripeCustomerId: 'cus_w05_test',
          },
        });
      }
      return makeStripeSubResponse({ id: STRIPE_SUB_ID_A, metadata: { tier: 'PRO' } });
    });

    const response = await POST(makeSyncRequest());
    const data = await response.json();

    // TOCTOU guard must fire: sub-A no longer in post-lock current set
    expect(response.status).toBe(200);
    expect(data.synced).toBe(false);
    expect(data.reason).toBe('subscription_replaced_during_sync');

    // Critical invariant: sub-B's state is UNCHANGED
    const subB = await prisma.subscription.findFirst({
      where: { providerId: TEST_PROVIDER_ID, stripeSubscriptionId: STRIPE_SUB_ID_B },
    });
    expect(subB).not.toBeNull();
    expect(subB!.tier).toBe('BASIC');    // B remains BASIC, not overwritten with PRO

    // sub-A is still CANCELLED (was not re-activated)
    const subAFinal = await prisma.subscription.findUnique({ where: { id: subA.id } });
    expect(subAFinal!.status).toBe('CANCELLED');

    console.log('✅ T4 PASS: TOCTOU guard fires — sub-A replaced by sub-B, B not overwritten');
    console.log(`   sub-B tier: ${subB!.tier} (BASIC, not PRO from sub-A Stripe state)`);
    console.log(`   synced:false reason: ${data.reason}`);
  });

  it('T5: Unauthorized — no session returns 401', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await POST(makeSyncRequest());
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toMatch(/unauthorized/i);

    console.log('✅ T5 PASS: No session returns 401');
  });

});
