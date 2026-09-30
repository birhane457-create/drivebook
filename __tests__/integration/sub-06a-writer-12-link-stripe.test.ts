/**
 * SUB-06-A Writer #12: Admin Stripe Subscription Linking — Behavioral Tests
 *
 * Invokes the actual production POST handler from
 * app/api/admin/instructors/[id]/subscription/route.ts (action: 'link_stripe_sub').
 *
 * SOURCE QUALIFICATION PRESERVED:
 * When subscriptionRowId is supplied and the specified row is not in the current
 * (non-CANCELLED) set, the code falls through to a second $queryRaw that also
 * checks CANCELLED rows and permits linking them. This is a policy decision that
 * must be explicitly tested rather than assumed safe. T5 covers this path.
 *
 * Security properties verified:
 * T1: Normal link (no subscriptionRowId) — most recent current sub without Stripe ID linked
 * T2: Link by specific subscriptionRowId — named current subscription receives Stripe ID
 * T3: Invalid Stripe ID — Stripe retrieve throws, returns 400, no DB mutation
 * T4: Missing stripeSubscriptionId body param — returns 400
 * T5: QUALIFICATION — CANCELLED row linkable when subscriptionRowId specified
 *     (documents the policy explicitly; tests the actual behavior rather than assuming)
 * T6: Non-existent subscriptionRowId — returns 500 (row not found)
 * T7: Non-admin access denied (403)
 *
 * Each test is independent. No result used as evidence for another writer.
 * The SOURCE-VERIFIED qualification on #12 is not silently upgraded by these tests passing.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/admin/instructors/[id]/subscription/route';
import { getServerSession } from 'next-auth';

const prisma = new PrismaClient();

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/auth/requireRole', () => ({
  requirePermission: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/services/audit', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
  writeAuditLogSafe: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/services/auditLogger', () => ({
  logSubscriptionAction: vi.fn().mockResolvedValue(undefined),
  AuditAction: { SUBSCRIPTION_CANCELLED: 'SUBSCRIPTION_CANCELLED' },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// Stripe mock — controls retrieve behavior per test
const mockStripeRetrieve = vi.fn();
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    subscriptions: { retrieve: mockStripeRetrieve },
  })),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TEST_USER_ID     = 'test-user-w12';
const TEST_PROVIDER_ID = 'test-provider-w12';
const TEST_EMAIL       = 'w12@test.com';
const NEW_STRIPE_SUB   = 'sub_w12_new';
const STRIPE_CUSTOMER  = 'cus_w12_test';

function mockAdminSession() {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: 'admin-w12', email: 'admin-w12@test.com', role: 'ADMIN' },
  } as any);
}

function mockStripeSuccess(subId = NEW_STRIPE_SUB) {
  mockStripeRetrieve.mockResolvedValue({ id: subId, customer: STRIPE_CUSTOMER, status: 'active' });
}

function makeLinkRequest(providerId: string, body: Record<string, unknown>) {
  return new NextRequest(
    `http://localhost:3000/api/admin/instructors/${providerId}/subscription`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'link_stripe_sub', ...body }),
    }
  );
}

const routeParams = { params: { id: TEST_PROVIDER_ID } };

async function createProvider(overrides: Record<string, unknown> = {}) {
  await prisma.user.create({
    data: { id: TEST_USER_ID, email: TEST_EMAIL, name: 'W12 Test User' },
  });
  return prisma.provider.create({
    data: {
      id: TEST_PROVIDER_ID,
      user: { connect: { id: TEST_USER_ID } },
      name: 'W12 Test Provider',
      phone: '+61400000012',
      hourlyRate: 80,
      subscriptionTier: 'BASIC',
      subscriptionStatus: 'TRIAL',
      ...overrides,
    } as any,
  });
}

async function createSubscription(overrides: Record<string, unknown> = {}) {
  return prisma.subscription.create({
    data: {
      providerId: TEST_PROVIDER_ID,
      tier: 'BASIC',
      status: 'TRIAL',
      monthlyAmount: 0,
      billingCycle: 'monthly',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000),
      stripeSubscriptionId: null,
      stripeCustomerId: null,
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
  mockAdminSession();
  const { requirePermission } = await import('@/lib/auth/requireRole');
  vi.mocked(requirePermission).mockResolvedValue(null);
});

afterEach(async () => {
  await prisma.subscription.deleteMany({ where: { providerId: TEST_PROVIDER_ID } });
  await prisma.provider.deleteMany({ where: { id: TEST_PROVIDER_ID } });
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SUB-06-A Writer #12: Admin Stripe Subscription Linking', () => {

  it('T1: Normal link (no subscriptionRowId) — most recent current sub without Stripe ID linked', async () => {
    await createProvider();
    const sub = await createSubscription(); // no stripeSubscriptionId
    mockStripeSuccess();

    const response = await POST(
      makeLinkRequest(TEST_PROVIDER_ID, { stripeSubscriptionId: NEW_STRIPE_SUB }),
      routeParams
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Subscription receives the Stripe ID
    const subAfter = await prisma.subscription.findUnique({ where: { id: sub.id } });
    expect((subAfter as any).stripeSubscriptionId).toBe(NEW_STRIPE_SUB);
    expect((subAfter as any).stripeCustomerId).toBe(STRIPE_CUSTOMER);

    // Provider also receives the Stripe ID
    const provAfter = await prisma.provider.findUnique({ where: { id: TEST_PROVIDER_ID } });
    expect((provAfter as any).stripeSubscriptionId).toBe(NEW_STRIPE_SUB);

    console.log('✅ T1 PASS: Normal link — most recent current sub receives Stripe ID');
  });

  it('T2: Link by specific subscriptionRowId — named current subscription receives Stripe ID', async () => {
    await createProvider();
    const sub = await createSubscription();
    mockStripeSuccess();

    const response = await POST(
      makeLinkRequest(TEST_PROVIDER_ID, {
        stripeSubscriptionId: NEW_STRIPE_SUB,
        subscriptionRowId: sub.id,
      }),
      routeParams
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    const subAfter = await prisma.subscription.findUnique({ where: { id: sub.id } });
    expect((subAfter as any).stripeSubscriptionId).toBe(NEW_STRIPE_SUB);

    console.log('✅ T2 PASS: Link by subscriptionRowId — named sub receives Stripe ID');
  });

  it('T3: Invalid Stripe ID — Stripe retrieve throws, returns 400, no DB mutation', async () => {
    await createProvider();
    const sub = await createSubscription();
    mockStripeRetrieve.mockRejectedValue(new Error('No such subscription: sub_invalid'));

    const response = await POST(
      makeLinkRequest(TEST_PROVIDER_ID, { stripeSubscriptionId: 'sub_invalid_w12' }),
      routeParams
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/not found/i);

    // DB: subscription unchanged
    const subAfter = await prisma.subscription.findUnique({ where: { id: sub.id } });
    expect((subAfter as any).stripeSubscriptionId).toBeNull();

    console.log('✅ T3 PASS: Invalid Stripe ID → 400, DB unchanged');
  });

  it('T4: Missing stripeSubscriptionId body param — returns 400', async () => {
    await createProvider();

    const response = await POST(
      makeLinkRequest(TEST_PROVIDER_ID, {}), // no stripeSubscriptionId
      routeParams
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/stripeSubscriptionId required/i);

    console.log('✅ T4 PASS: Missing stripeSubscriptionId returns 400');
  });

  it('T5: QUALIFICATION — CANCELLED row linkable when subscriptionRowId explicitly specified', async () => {
    // IMPORTANT: This test documents the POLICY QUESTION from the source qualification.
    // The route's link_stripe_sub action permits linking a Stripe ID to a CANCELLED
    // subscription row when subscriptionRowId is explicitly provided (lines ~527-545).
    //
    // This test verifies the ACTUAL BEHAVIOR rather than assuming it is safe.
    // It does NOT assert the behavior is correct policy — it records what the code does.
    //
    // Policy finding: an admin can explicitly link a Stripe ID to a CANCELLED subscription.
    // Whether this should be permitted is a product/security decision outside the scope
    // of SUB-06-A locking verification, but the behavior is now explicitly evidenced.

    await createProvider({ subscriptionStatus: 'CANCELLED' });
    const cancelledSub = await createSubscription({ status: 'CANCELLED' });
    mockStripeSuccess();

    const response = await POST(
      makeLinkRequest(TEST_PROVIDER_ID, {
        stripeSubscriptionId: NEW_STRIPE_SUB,
        subscriptionRowId: cancelledSub.id,
      }),
      routeParams
    );
    const data = await response.json();

    // The route PERMITS this — documents the actual behavior
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // The CANCELLED row receives the Stripe ID
    const subAfter = await prisma.subscription.findUnique({ where: { id: cancelledSub.id } });
    expect((subAfter as any).stripeSubscriptionId).toBe(NEW_STRIPE_SUB);

    console.log('✅ T5 PASS (QUALIFICATION): CANCELLED row linkable via explicit subscriptionRowId');
    console.log('   Policy: route permits linking CANCELLED rows — documented, not asserted as correct');
    console.log('   This path requires explicit product/security review outside SUB-06-A scope');
  });

  it('T6: Non-existent subscriptionRowId — returns 500 (row not found)', async () => {
    await createProvider();
    await createSubscription();
    mockStripeSuccess();

    const response = await POST(
      makeLinkRequest(TEST_PROVIDER_ID, {
        stripeSubscriptionId: NEW_STRIPE_SUB,
        subscriptionRowId: 'sub-does-not-exist-w12',
      }),
      routeParams
    );

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toMatch(/not found/i);

    console.log('✅ T6 PASS: Non-existent subscriptionRowId returns 500');
  });

  it('T7: Non-admin access denied (403)', async () => {
    const { requirePermission } = await import('@/lib/auth/requireRole');
    vi.mocked(requirePermission).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) as any
    );

    const response = await POST(
      makeLinkRequest(TEST_PROVIDER_ID, { stripeSubscriptionId: NEW_STRIPE_SUB }),
      routeParams
    );

    expect(response.status).toBe(403);
    console.log('✅ T7 PASS: Non-admin access denied (403)');
  });

});
