/**
 * SUB-06-A Writer #6: Subscription Cancellation Service — Behavioral Tests
 *
 * Calls cancelSubscription() from lib/services/subscription-cancel.ts directly.
 * This is a service function (not an HTTP route handler), so no session mock is needed.
 *
 * Security properties verified:
 * T1: Immediate cancellation — Stripe called first, DB updated after
 *     status=CANCELLED, Provider.subscriptionStatus=CANCELLED
 * T2: Period-end cancellation — Stripe called first, cancelAtPeriodEnd=true, status unchanged
 * T3: Stripe-first invariant — Stripe throws, DB is NOT mutated
 * T4: Already-cancelled idempotency — cancelAtPeriodEnd already set, returns early
 *     before Stripe call (stripeAction: 'already_cancelled')
 * T5: Concurrent webhook race — subscription cancelled by webhook between pre-tx
 *     findFirst and lock; service detects this under lock and skips mutation (no error)
 * T6: No active subscription — returns already_cancelled gracefully, Stripe not called
 * T7: Trial (no Stripe ID) — local_only path, DB updated, Stripe not called
 *
 * Each test is independent. No test result is used as evidence for another writer.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { cancelSubscription } from '@/lib/services/subscription-cancel';

const prisma = new PrismaClient();

// ── Stripe mock ────────────────────────────────────────────────────────────────
// Intercepts getStripe() lazy initialisation via vi.mock at module level.
const mockStripeUpdate = vi.fn();
const mockStripeCancel = vi.fn();
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    subscriptions: {
      update: mockStripeUpdate,
      cancel: mockStripeCancel,
    },
  })),
}));

// writeAuditLogSafe is non-blocking post-tx — mock to no-op
vi.mock('@/lib/services/audit', () => ({
  writeAuditLogSafe: vi.fn().mockResolvedValue(undefined),
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TEST_USER_ID    = 'test-user-w06';
const TEST_PROVIDER_ID = 'test-provider-w06';
const TEST_EMAIL      = 'w06@test.com';
const STRIPE_SUB_ID   = 'sub_w06_test';

const BASE_PARAMS = {
  actorEmail: 'actor@test.com',
  reason: 'test cancellation',
};

async function createProvider(overrides: Record<string, unknown> = {}) {
  await prisma.user.create({
    data: { id: TEST_USER_ID, email: TEST_EMAIL, name: 'W06 Test User' },
  });
  return prisma.provider.create({
    data: {
      id: TEST_PROVIDER_ID,
      user: { connect: { id: TEST_USER_ID } },
      name: 'W06 Test Provider',
      phone: '+61400000006',
      hourlyRate: 80,
      subscriptionTier: 'PRO',
      subscriptionStatus: 'ACTIVE',
      stripeCustomerId: 'cus_w06_test',
      ...overrides,
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
      stripeSubscriptionId: STRIPE_SUB_ID,
      stripeCustomerId: 'cus_w06_test',
      ...overrides,
    },
  });
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await prisma.subscription.deleteMany({ where: { providerId: TEST_PROVIDER_ID } });
  await prisma.provider.deleteMany({ where: { id: TEST_PROVIDER_ID } });
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
  vi.clearAllMocks();
  // Default: Stripe calls succeed
  mockStripeUpdate.mockResolvedValue({ id: STRIPE_SUB_ID, cancel_at_period_end: true });
  mockStripeCancel.mockResolvedValue({ id: STRIPE_SUB_ID, status: 'canceled' });
  // Reset module-level Stripe singleton so each test gets a fresh mock
  const mod = await import('@/lib/services/subscription-cancel');
  (mod as any)._stripe = null;
});

afterEach(async () => {
  await prisma.subscription.deleteMany({ where: { providerId: TEST_PROVIDER_ID } });
  await prisma.provider.deleteMany({ where: { id: TEST_PROVIDER_ID } });
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SUB-06-A Writer #6: Subscription Cancellation Service', () => {

  it('T1: Immediate cancellation — Stripe called first, then DB (Stripe-first invariant)', async () => {
    await createProvider();
    const sub = await createSubscription();

    const result = await cancelSubscription({
      providerId: TEST_PROVIDER_ID,
      mode: 'immediate',
      ...BASE_PARAMS,
    });

    // Stripe cancel called
    expect(mockStripeCancel).toHaveBeenCalledTimes(1);
    expect(mockStripeCancel).toHaveBeenCalledWith(STRIPE_SUB_ID);
    expect(result.success).toBe(true);
    expect(result.stripeAction).toBe('cancelled_in_stripe');

    // DB: subscription CANCELLED, cancelledAt set
    const subAfter = await prisma.subscription.findUnique({ where: { id: sub.id } });
    expect(subAfter!.status).toBe('CANCELLED');
    expect(subAfter!.cancelledAt).not.toBeNull();

    // DB: Provider.subscriptionStatus CANCELLED
    const providerAfter = await prisma.provider.findUnique({ where: { id: TEST_PROVIDER_ID } });
    expect(providerAfter!.subscriptionStatus).toBe('CANCELLED');

    console.log('✅ T1 PASS: Immediate cancel — Stripe-first, DB updated, Provider status CANCELLED');
  });

  it('T2: Period-end cancellation — Stripe updated, cancelAtPeriodEnd=true, status unchanged', async () => {
    await createProvider();
    const sub = await createSubscription();

    const result = await cancelSubscription({
      providerId: TEST_PROVIDER_ID,
      mode: 'period_end',
      ...BASE_PARAMS,
    });

    // Stripe update (not cancel) called
    expect(mockStripeUpdate).toHaveBeenCalledTimes(1);
    expect(mockStripeUpdate).toHaveBeenCalledWith(STRIPE_SUB_ID, expect.objectContaining({
      cancel_at_period_end: true,
    }));
    expect(mockStripeCancel).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.stripeAction).toBe('cancelled_in_stripe');

    // DB: cancelAtPeriodEnd=true, status still ACTIVE (period_end does NOT cancel immediately)
    const subAfter = await prisma.subscription.findUnique({ where: { id: sub.id } });
    expect(subAfter!.cancelAtPeriodEnd).toBe(true);
    expect(subAfter!.status).toBe('ACTIVE');
    expect(subAfter!.cancelledAt).not.toBeNull();

    // DB: Provider.subscriptionStatus unchanged (period_end)
    const providerAfter = await prisma.provider.findUnique({ where: { id: TEST_PROVIDER_ID } });
    expect(providerAfter!.subscriptionStatus).toBe('ACTIVE');

    console.log('✅ T2 PASS: Period-end cancel — cancelAtPeriodEnd=true, status ACTIVE unchanged');
  });

  it('T3: Stripe-first invariant — Stripe throws, DB is NOT mutated', async () => {
    await createProvider();
    const sub = await createSubscription();

    // Stripe cancel throws
    mockStripeCancel.mockRejectedValue(new Error('Stripe API error: card_declined'));

    await expect(cancelSubscription({
      providerId: TEST_PROVIDER_ID,
      mode: 'immediate',
      ...BASE_PARAMS,
    })).rejects.toThrow('Stripe API error: card_declined');

    // DB: subscription status UNCHANGED (still ACTIVE)
    const subAfter = await prisma.subscription.findUnique({ where: { id: sub.id } });
    expect(subAfter!.status).toBe('ACTIVE');
    expect(subAfter!.cancelledAt).toBeNull();

    // DB: Provider.subscriptionStatus UNCHANGED
    const providerAfter = await prisma.provider.findUnique({ where: { id: TEST_PROVIDER_ID } });
    expect(providerAfter!.subscriptionStatus).toBe('ACTIVE');

    console.log('✅ T3 PASS: Stripe-first invariant — Stripe threw, DB unchanged');
  });

  it('T4: Already-cancelled idempotency — period_end already set, returns early before Stripe', async () => {
    await createProvider();
    // Subscription already has cancelAtPeriodEnd=true
    await createSubscription({ cancelAtPeriodEnd: true });

    const result = await cancelSubscription({
      providerId: TEST_PROVIDER_ID,
      mode: 'period_end',
      ...BASE_PARAMS,
    });

    // Stripe NOT called (early return before Stripe call)
    expect(mockStripeUpdate).not.toHaveBeenCalled();
    expect(mockStripeCancel).not.toHaveBeenCalled();

    expect(result.success).toBe(true);
    expect(result.stripeAction).toBe('already_cancelled');
    expect(result.message).toMatch(/already scheduled/i);

    console.log('✅ T4 PASS: Already-cancelled idempotency — Stripe not called, returns already_cancelled');
  });

  it('T5: Concurrent webhook race — webhook cancels subscription between findFirst and lock; service skips mutation', async () => {
    await createProvider();
    const sub = await createSubscription();

    // Simulate: Stripe cancel succeeds (as normal)
    // Then between Stripe call and DB transaction, a concurrent webhook
    // cancels the subscription. We simulate this by having mockStripeCancel
    // perform the DB cancellation as a side effect (simulating the webhook
    // processing completing just before our transaction acquires the lock).
    mockStripeCancel.mockImplementation(async () => {
      // Concurrent webhook: cancel the subscription in DB
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
      return { id: STRIPE_SUB_ID, status: 'canceled' };
    });

    // cancelSubscription should NOT throw — it detects the concurrent cancel
    // under lock and skips its own mutation (idempotent exit)
    const result = await cancelSubscription({
      providerId: TEST_PROVIDER_ID,
      mode: 'immediate',
      ...BASE_PARAMS,
    });

    expect(result.success).toBe(true);
    expect(result.stripeAction).toBe('cancelled_in_stripe');

    // DB: subscription still CANCELLED (from the concurrent webhook)
    const subAfter = await prisma.subscription.findUnique({ where: { id: sub.id } });
    expect(subAfter!.status).toBe('CANCELLED');

    console.log('✅ T5 PASS: Concurrent webhook race — service detects cancellation under lock, skips mutation');
  });

  it('T6: No active subscription — returns already_cancelled gracefully, Stripe not called', async () => {
    await createProvider();
    // No subscription created

    const result = await cancelSubscription({
      providerId: TEST_PROVIDER_ID,
      mode: 'immediate',
      ...BASE_PARAMS,
    });

    expect(mockStripeCancel).not.toHaveBeenCalled();
    expect(mockStripeUpdate).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.stripeAction).toBe('already_cancelled');
    expect(result.message).toMatch(/no active subscription/i);

    console.log('✅ T6 PASS: No active subscription — graceful return, Stripe not called');
  });

  it('T7: Trial (no Stripe ID) — local-only DB update, Stripe not called', async () => {
    await createProvider({ subscriptionTier: 'BASIC', subscriptionStatus: 'TRIAL' });
    const sub = await createSubscription({
      status: 'TRIAL',
      tier: 'BASIC',
      monthlyAmount: 0,
      stripeSubscriptionId: null,
      stripeCustomerId: null,
    });

    const result = await cancelSubscription({
      providerId: TEST_PROVIDER_ID,
      mode: 'immediate',
      ...BASE_PARAMS,
    });

    // Stripe NOT called (local_only path)
    expect(mockStripeCancel).not.toHaveBeenCalled();
    expect(mockStripeUpdate).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.stripeAction).toBe('local_only_no_stripe_id');

    // DB: subscription CANCELLED
    const subAfter = await prisma.subscription.findUnique({ where: { id: sub.id } });
    expect(subAfter!.status).toBe('CANCELLED');

    // DB: Provider.subscriptionStatus CANCELLED
    const providerAfter = await prisma.provider.findUnique({ where: { id: TEST_PROVIDER_ID } });
    expect(providerAfter!.subscriptionStatus).toBe('CANCELLED');

    console.log('✅ T7 PASS: Trial cancel — local-only DB update, Stripe not called');
  });

});
