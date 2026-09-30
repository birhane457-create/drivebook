/**
 * SUB-06-A Writer #12: Admin Stripe Linking — Concurrent Admin + Webhook Test
 *
 * This file supplements sub-06a-writer-12-link-stripe.test.ts.
 *
 * The existing suite (7/7) covered normal link, specific row, invalid Stripe ID,
 * missing param, CANCELLED-row policy, non-existent row, and permission denial.
 *
 * The stated concurrency requirement was explicitly absent:
 *   "concurrent admin link + webhook — not tested"
 *
 * This file fills that gap. The concurrency property being verified:
 *
 *   When admin link_stripe_sub and a concurrent webhook both attempt to
 *   attach a Stripe ID to the same Provider's subscription row,
 *   the Provider FOR UPDATE lock serializes them. The final state must be
 *   internally consistent — Provider and Subscription must have the same
 *   stripeSubscriptionId, and only one of the two IDs should have won.
 *
 * Two scenarios:
 *   T_CONC_1: Two concurrent admin link calls for the same Provider.
 *             Both use the production POST handler.
 *             Final: Provider and Subscription have the same Stripe ID.
 *
 *   T_CONC_2: Admin link + webhook-like concurrent transaction.
 *             Admin uses POST handler; webhook simulated via direct DB transaction
 *             (same lockProvider + write pattern as the webhook handler).
 *             Final: consistent Stripe ID across Provider and Subscription.
 *
 * CANCELLED-row qualification is preserved throughout:
 *   These tests use current (non-CANCELLED) subscriptions.
 *   The CANCELLED-row policy question is not altered by concurrency tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/admin/instructors/[id]/subscription/route';
import { getServerSession } from 'next-auth';
import { lockProvider } from '@/lib/services/subscription-lifecycle';

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

const STRIPE_ID_A = 'sub_w12_concurrent_A';
const STRIPE_ID_B = 'sub_w12_concurrent_B';
const STRIPE_CUSTOMER = 'cus_w12_concurrent';

// Stripe mock returns different IDs for each call
let stripeCallCount = 0;
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    subscriptions: {
      retrieve: vi.fn().mockImplementation(async (id: string) => ({
        id,
        customer: STRIPE_CUSTOMER,
        status: 'active',
      })),
    },
  })),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TEST_USER_ID     = 'test-user-w12-conc';
const TEST_PROVIDER_ID = 'test-provider-w12-conc';
const TEST_EMAIL       = 'w12-conc@test.com';

function mockAdminSession() {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: 'admin-w12-conc', email: 'admin-w12-conc@test.com', role: 'ADMIN' },
  } as any);
}

function makeLinkRequest(providerId: string, stripeSubId: string) {
  return new NextRequest(
    `http://localhost:3000/api/admin/instructors/${providerId}/subscription`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'link_stripe_sub',
        stripeSubscriptionId: stripeSubId,
      }),
    }
  );
}

const routeParams = { params: { id: TEST_PROVIDER_ID } };

async function createProvider() {
  await prisma.user.create({
    data: { id: TEST_USER_ID, email: TEST_EMAIL, name: 'W12 Conc Test User' },
  });
  return prisma.provider.create({
    data: {
      id: TEST_PROVIDER_ID,
      user: { connect: { id: TEST_USER_ID } },
      name: 'W12 Conc Test Provider',
      phone: '+61400001212',
      hourlyRate: 80,
      subscriptionTier: 'BASIC',
      subscriptionStatus: 'TRIAL',
    } as any,
  });
}

async function createSubscription() {
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
    },
  });
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeEach(async () => {
  stripeCallCount = 0;
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

describe('SUB-06-A Writer #12: Admin Stripe Linking — Concurrency Tests', () => {

  it('T_CONC_1: Two concurrent admin link calls — serialized by Provider FOR UPDATE, consistent final state', async () => {
    // Both calls attempt to link different Stripe IDs to the same Provider/Subscription.
    // With Provider FOR UPDATE, they serialize. One wins; the other overwrites or
    // succeeds independently. CRITICAL: final state must be internally consistent —
    // Provider.stripeSubscriptionId === Subscription.stripeSubscriptionId.

    await createProvider();
    const sub = await createSubscription();

    const [r1, r2] = await Promise.allSettled([
      POST(makeLinkRequest(TEST_PROVIDER_ID, STRIPE_ID_A), routeParams),
      POST(makeLinkRequest(TEST_PROVIDER_ID, STRIPE_ID_B), routeParams),
    ]);

    // Both should complete (may both succeed as sequential operations, or one may
    // see the other's committed state — either way no error expected)
    expect(r1.status).toBe('fulfilled');
    expect(r2.status).toBe('fulfilled');

    const s1 = (r1 as PromiseFulfilledResult<any>).value.status;
    const s2 = (r2 as PromiseFulfilledResult<any>).value.status;
    expect(s1).toBe(200);
    expect(s2).toBe(200);

    // CRITICAL: Provider and Subscription must have the same Stripe ID (no torn state)
    const finalProvider = await prisma.provider.findUnique({
      where: { id: TEST_PROVIDER_ID },
    });
    const finalSub = await prisma.subscription.findUnique({
      where: { id: sub.id },
    });

    // Both must have a Stripe ID (one of the two that was written)
    expect((finalProvider as any).stripeSubscriptionId).not.toBeNull();
    expect((finalSub as any).stripeSubscriptionId).not.toBeNull();

    // Provider and Subscription must agree on the same ID
    expect((finalProvider as any).stripeSubscriptionId).toBe(
      (finalSub as any).stripeSubscriptionId
    );

    const winningId = (finalProvider as any).stripeSubscriptionId;
    expect([STRIPE_ID_A, STRIPE_ID_B]).toContain(winningId);

    console.log('✅ T_CONC_1 PASS: Concurrent admin links serialized — consistent Stripe ID');
    console.log(`   Winning ID: ${winningId}`);
    console.log(`   Provider.stripeSubscriptionId === Subscription.stripeSubscriptionId`);
  });

  it('T_CONC_2: Admin link + webhook-like concurrent tx — Provider lock serializes, consistent final state', async () => {
    // Admin link_stripe_sub (via production POST handler) races with a webhook-like
    // DB transaction (uses lockProvider + direct write, mirroring webhook handler pattern).
    // Both try to attach different Stripe IDs. Final state must be consistent.

    await createProvider();
    const sub = await createSubscription();

    // Admin link: attaches STRIPE_ID_A via production route
    const adminLink = POST(makeLinkRequest(TEST_PROVIDER_ID, STRIPE_ID_A), routeParams);

    // Webhook-like transaction: attaches STRIPE_ID_B directly with lockProvider
    const webhookLike = prisma.$transaction(async (tx) => {
      const lockedProvider = await lockProvider(tx, TEST_PROVIDER_ID);

      // Lock the subscription too (matches webhook handler pattern)
      const lockedSubs = await tx.$queryRaw<any[]>`
        SELECT * FROM "Subscription"
        WHERE "providerId" = ${lockedProvider.id}
          AND "status" != 'CANCELLED'
        FOR UPDATE
      `;

      if (lockedSubs.length === 0) return null;
      const lockedSub = await tx.subscription.findUnique({ where: { id: lockedSubs[0].id } });
      if (!lockedSub) return null;

      await tx.provider.update({
        where: { id: TEST_PROVIDER_ID },
        data: { stripeSubscriptionId: STRIPE_ID_B, stripeCustomerId: STRIPE_CUSTOMER } as any,
      });
      await tx.subscription.update({
        where: { id: lockedSub.id },
        data: { stripeSubscriptionId: STRIPE_ID_B, stripeCustomerId: STRIPE_CUSTOMER },
      });
      return STRIPE_ID_B;
    }, { timeout: 10000 });

    const [adminResult, webhookResult] = await Promise.allSettled([adminLink, webhookLike]);

    // Both must complete without unhandled errors
    expect(adminResult.status).toBe('fulfilled');
    expect(webhookResult.status).toBe('fulfilled');

    const adminStatus = (adminResult as PromiseFulfilledResult<any>).value.status;
    expect(adminStatus).toBe(200);

    // CRITICAL: Provider and Subscription must have the same Stripe ID
    const finalProvider = await prisma.provider.findUnique({
      where: { id: TEST_PROVIDER_ID },
    });
    const finalSub = await prisma.subscription.findUnique({
      where: { id: sub.id },
    });

    expect((finalProvider as any).stripeSubscriptionId).not.toBeNull();
    expect((finalSub as any).stripeSubscriptionId).not.toBeNull();
    expect((finalProvider as any).stripeSubscriptionId).toBe(
      (finalSub as any).stripeSubscriptionId
    );

    const winningId = (finalProvider as any).stripeSubscriptionId;
    expect([STRIPE_ID_A, STRIPE_ID_B]).toContain(winningId);

    console.log('✅ T_CONC_2 PASS: Admin link + webhook-like tx serialized — consistent Stripe ID');
    console.log(`   Winning ID: ${winningId}`);
    console.log(`   Provider and Subscription stripeSubscriptionId match`);
  });

});
