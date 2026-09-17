/**
 * SUB-22 production-route concurrency verification.
 *
 * IMPORTANT: This suite is intentionally database-backed. It calls the real
 * POST /api/stripe/webhook handler and signs requests with Stripe's test
 * signature helper. It must only be run with an isolated staging/test DB.
 *
 * Required environment:
 *   SUB22_TEST_DATABASE_URL=<isolated PostgreSQL URL>
 *   STRIPE_WEBHOOK_SECRET=<test webhook secret>
 *
 * The route reads DATABASE_URL when its Prisma singleton is imported, so the
 * test sets DATABASE_URL from SUB22_TEST_DATABASE_URL before importing route.
 * No production database should be used.
 */

import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';

const TEST_DB_URL = process.env.SUB22_TEST_DATABASE_URL;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

let prisma: PrismaClient;
let POST: typeof import('../route').POST;

function requireTestEnvironment() {
  if (!TEST_DB_URL) {
    throw new Error(
      'SUB-22 tests require SUB22_TEST_DATABASE_URL pointing to an isolated staging/test PostgreSQL database. Refusing to run without it.'
    );
  }

  if (!WEBHOOK_SECRET) {
    throw new Error(
      'SUB-22 tests require STRIPE_WEBHOOK_SECRET. Refusing to run without a webhook signing secret.'
    );
  }

  // The production route imports its Prisma singleton dynamically below.
  // Set the datasource before that import so the real route uses the isolated DB.
  process.env.DATABASE_URL = TEST_DB_URL;
}

function createMockSubscriptionEvent(
  type: 'customer.subscription.created' | 'customer.subscription.updated',
  subscriptionId: string,
  providerId: string,
  customerId: string,
  eventId: string,
): Stripe.Event {
  const now = Math.floor(Date.now() / 1000);

  return {
    id: eventId,
    object: 'event',
    api_version: '2024-11-20.acacia',
    created: now,
    type,
    data: {
      object: {
        id: subscriptionId,
        object: 'subscription',
        customer: customerId,
        status: 'active',
        items: {
          object: 'list',
          data: [
            {
              id: `si_${subscriptionId}`,
              object: 'subscription_item',
              price: {
                id: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || 'price_pro_monthly',
                object: 'price',
                unit_amount: 9900,
                recurring: {
                  interval: 'month',
                  interval_count: 1,
                },
              },
            },
          ],
        },
        metadata: {
          providerId,
          tier: 'PRO',
          billingCycle: 'monthly',
        },
        current_period_start: now,
        current_period_end: now + 30 * 24 * 60 * 60,
        trial_end: null,
        cancel_at_period_end: false,
      } as Stripe.Subscription,
    },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
  } as Stripe.Event;
}

async function createTestProvider(index: number) {
  const suffix = `${index}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const userId = `test-user-sub22-${suffix}`;
  const providerId = `test-provider-sub22-${suffix}`;

  const user = await prisma.user.create({
    data: {
      id: userId,
      email: `sub22-test-${suffix}@example.com`,
      name: `SUB-22 Test Provider ${index}`,
      role: 'INSTRUCTOR',
    },
  });

  const provider = await prisma.provider.create({
    data: {
      id: providerId,
      userId,
      name: `SUB-22 Test Provider ${index}`,
      phone: '+61400000000',
      hourlyRate: 80,
      subscriptionTier: 'BASIC',
      subscriptionStatus: 'TRIAL',
      stripeCustomerId: `cus_test_${suffix}`,
    },
  });

  return { user, provider };
}

async function createTrialSubscription(providerId: string, stripeCustomerId: string) {
  const start = new Date();
  const end = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);

  return prisma.subscription.create({
    data: {
      providerId,
      tier: 'PRO',
      status: 'TRIAL',
      billingCycle: 'monthly',
      monthlyAmount: 99,
      stripeCustomerId,
      stripeSubscriptionId: null,
      currentPeriodStart: start,
      currentPeriodEnd: end,
      trialEndsAt: end,
    },
  });
}

async function postStripeEvent(event: Stripe.Event) {
  const body = JSON.stringify(event);
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: WEBHOOK_SECRET!,
  });

  const request = new NextRequest('http://localhost/api/stripe/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': signature,
    },
    body,
  });

  const response = await POST(request);
  let json: unknown = null;

  try {
    json = await response.json();
  } catch {
    // Keep the raw HTTP status as the primary evidence if the body is not JSON.
  }

  return { status: response.status, json };
}

function idempotencyKey(event: Stripe.Event) {
  return `${event.type}_${event.id}_${event.created}`;
}

async function currentSubscriptions(providerId: string) {
  return prisma.subscription.findMany({
    where: { providerId },
    orderBy: { createdAt: 'asc' },
  });
}

async function cleanupTestData() {
  const providerIds = await prisma.provider.findMany({
    where: { id: { startsWith: 'test-provider-sub22-' } },
    select: { id: true },
  });
  const ids = providerIds.map((p) => p.id);

  if (ids.length) {
    await prisma.subscription.deleteMany({ where: { providerId: { in: ids } } });
    await prisma.provider.deleteMany({ where: { id: { in: ids } } });
  }

  await prisma.user.deleteMany({
    where: { id: { startsWith: 'test-user-sub22-' } },
  });

  await prisma.webhookEvent.deleteMany({
    where: { idempotencyKey: { startsWith: 'customer.subscription.' } },
  });
}

describe('SUB-22: real Stripe webhook POST concurrency', () => {
  beforeAll(async () => {
    requireTestEnvironment();

    prisma = new PrismaClient({
      datasources: { db: { url: TEST_DB_URL! } },
    });

    // Dynamic import is deliberate: route.ts imports the application's Prisma
    // singleton, which must see the isolated DATABASE_URL above.
    ({ POST } = await import('../route'));

    await prisma.$connect();
  });

  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it('handles concurrent created + updated events for the same Stripe ID without duplicate subscriptions', async () => {
    const { provider } = await createTestProvider(1);
    await createTrialSubscription(provider.id, provider.stripeCustomerId!);

    const subscriptionId = `sub_test_same_${Date.now()}`;
    const created = createMockSubscriptionEvent(
      'customer.subscription.created',
      subscriptionId,
      provider.id,
      provider.stripeCustomerId!,
      `evt_created_${Date.now()}_${Math.random()}`,
    );
    const updated = createMockSubscriptionEvent(
      'customer.subscription.updated',
      subscriptionId,
      provider.id,
      provider.stripeCustomerId!,
      `evt_updated_${Date.now()}_${Math.random()}`,
    );

    const results = await Promise.all([
      postStripeEvent(created),
      postStripeEvent(updated),
    ]);

    const subscriptions = await currentSubscriptions(provider.id);
    const events = await prisma.webhookEvent.findMany({
      where: {
        idempotencyKey: {
          in: [idempotencyKey(created), idempotencyKey(updated)],
        },
      },
    });

    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0].stripeSubscriptionId).toBe(subscriptionId);
    expect(events).toHaveLength(2);
  }, 30000);

  it('is idempotent when the exact same signed Stripe event is delivered twice', async () => {
    const { provider } = await createTestProvider(2);
    await createTrialSubscription(provider.id, provider.stripeCustomerId!);

    const event = createMockSubscriptionEvent(
      'customer.subscription.created',
      `sub_test_replay_${Date.now()}`,
      provider.id,
      provider.stripeCustomerId!,
      `evt_replay_${Date.now()}_${Math.random()}`,
    );

    const first = await postStripeEvent(event);
    const second = await postStripeEvent(event);

    const subscriptions = await currentSubscriptions(provider.id);
    const events = await prisma.webhookEvent.findMany({
      where: { idempotencyKey: idempotencyKey(event) },
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((second.json as { duplicate?: boolean })?.duplicate).toBe(true);
    expect(subscriptions).toHaveLength(1);
    expect(events).toHaveLength(1);
  }, 30000);

  it('does not permit two different Stripe IDs to become current subscriptions for one provider', async () => {
    const { provider } = await createTestProvider(3);
    await createTrialSubscription(provider.id, provider.stripeCustomerId!);

    const sub1 = `sub_test_conflict_1_${Date.now()}`;
    const sub2 = `sub_test_conflict_2_${Date.now()}`;
    const event1 = createMockSubscriptionEvent(
      'customer.subscription.created',
      sub1,
      provider.id,
      provider.stripeCustomerId!,
      `evt_conflict_1_${Date.now()}_${Math.random()}`,
    );
    const event2 = createMockSubscriptionEvent(
      'customer.subscription.created',
      sub2,
      provider.id,
      provider.stripeCustomerId!,
      `evt_conflict_2_${Date.now()}_${Math.random()}`,
    );

    const results = await Promise.all([
      postStripeEvent(event1),
      postStripeEvent(event2),
    ]);

    const subscriptions = await currentSubscriptions(provider.id);
    const current = subscriptions.filter((s) =>
      ['TRIAL', 'ACTIVE', 'PAST_DUE'].includes(s.status),
    );
    const stripeIds = new Set(
      subscriptions.map((s) => s.stripeSubscriptionId).filter(Boolean),
    );

    expect(current).toHaveLength(1);
    expect(stripeIds.size).toBe(1);
    expect([sub1, sub2]).toContain(subscriptions[0].stripeSubscriptionId);
    // The losing different-ID request must not be silently accepted as success.
    expect(results.some((r) => r.status === 500)).toBe(true);
  }, 30000);

  it('keeps one subscription under triple concurrent distinct webhook events for the same Stripe ID', async () => {
    const { provider } = await createTestProvider(4);
    await createTrialSubscription(provider.id, provider.stripeCustomerId!);

    const subscriptionId = `sub_test_triple_${Date.now()}`;
    const events = [
      createMockSubscriptionEvent(
        'customer.subscription.created',
        subscriptionId,
        provider.id,
        provider.stripeCustomerId!,
        `evt_triple_1_${Date.now()}_${Math.random()}`,
      ),
      createMockSubscriptionEvent(
        'customer.subscription.updated',
        subscriptionId,
        provider.id,
        provider.stripeCustomerId!,
        `evt_triple_2_${Date.now()}_${Math.random()}`,
      ),
      createMockSubscriptionEvent(
        'customer.subscription.updated',
        subscriptionId,
        provider.id,
        provider.stripeCustomerId!,
        `evt_triple_3_${Date.now()}_${Math.random()}`,
      ),
    ];

    const results = await Promise.all(events.map(postStripeEvent));
    const subscriptions = await currentSubscriptions(provider.id);

    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0].stripeSubscriptionId).toBe(subscriptionId);
  }, 30000);

  it('rejects an invalid Stripe signature before touching webhook state', async () => {
    const { provider } = await createTestProvider(5);
    await createTrialSubscription(provider.id, provider.stripeCustomerId!);

    const event = createMockSubscriptionEvent(
      'customer.subscription.created',
      `sub_test_bad_sig_${Date.now()}`,
      provider.id,
      provider.stripeCustomerId!,
      `evt_bad_sig_${Date.now()}_${Math.random()}`,
    );
    const body = JSON.stringify(event);
    const request = new NextRequest('http://localhost/api/stripe/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 't=1,v1=invalid',
      },
      body,
    });

    const response = await POST(request);
    const subscriptions = await currentSubscriptions(provider.id);
    const eventRows = await prisma.webhookEvent.findMany({
      where: { idempotencyKey: idempotencyKey(event) },
    });

    expect(response.status).toBe(400);
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0].stripeSubscriptionId).toBeNull();
    expect(eventRows).toHaveLength(0);
  }, 30000);
});
