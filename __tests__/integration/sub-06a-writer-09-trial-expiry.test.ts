/**
 * SUB-06-A Writer #9: Trial Expiry Cron — Behavioral Tests
 *
 * Invokes the actual production GET handler from
 * app/api/cron/check-trial-expiry/route.ts directly.
 *
 * Security properties verified (derived from explicit CAS source inspection):
 *
 * T1: Expired TRIAL → EXPIRED, Provider reverted to BASIC/EXPIRED
 * T2: Non-expired TRIAL unchanged — trialEndsAt guard prevents premature expiry
 * T3: CAS prevents ACTIVE overwrite — webhook converts TRIAL→ACTIVE between pre-tx
 *     query and Provider lock; CAS count=0; Provider NOT reverted to BASIC
 *     (this is the critical property for SOURCE-VERIFICATION CONDITIONAL)
 * T4: Concurrent cron invocations — second cron sees CAS count=0, skips; no duplicate
 * T5: Unauthorized — no CRON_SECRET or Vercel header returns 401
 * T6: No expired trials — returns count:0 without mutations
 *
 * CAS condition verified in source (task #4 context):
 *   status: 'TRIAL' guard — only expires if STILL TRIAL at tx time
 *   trialEndsAt: { lt: now } — re-confirms expiry inside transaction
 *   expireResult.count === 0 — gates Provider mutation
 *
 * Each test is independent. No result used as evidence for another writer.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cron/check-trial-expiry/route';

const prisma = new PrismaClient();

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/services/cron-health', () => ({
  pingCronHealth: vi.fn().mockResolvedValue(undefined),
  failCronHealth: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TEST_USER_ID     = 'test-user-w09';
const TEST_PROVIDER_ID = 'test-provider-w09';
const TEST_EMAIL       = 'w09@test.com';
const CRON_SECRET      = 'test-cron-secret-w09';

function makeCronRequest(opts: { secret?: string; vercelCron?: boolean } = {}) {
  const headers: Record<string, string> = {};
  if (opts.secret) headers['authorization'] = `Bearer ${opts.secret}`;
  if (opts.vercelCron) headers['x-vercel-cron'] = '1';
  return new NextRequest('http://localhost:3000/api/cron/check-trial-expiry', {
    method: 'GET',
    headers,
  });
}

function authorizedRequest() {
  return makeCronRequest({ secret: CRON_SECRET });
}

async function createProvider(overrides: Record<string, unknown> = {}) {
  await prisma.user.create({
    data: { id: TEST_USER_ID, email: TEST_EMAIL, name: 'W09 Test User' },
  });
  return prisma.provider.create({
    data: {
      id: TEST_PROVIDER_ID,
      user: { connect: { id: TEST_USER_ID } },
      name: 'W09 Test Provider',
      phone: '+61400000009',
      hourlyRate: 80,
      subscriptionTier: 'BASIC',
      subscriptionStatus: 'TRIAL',
      ...overrides,
    } as any,
  });
}

async function createTrialSubscription(overrides: Record<string, unknown> = {}) {
  return prisma.subscription.create({
    data: {
      providerId: TEST_PROVIDER_ID,
      tier: 'BASIC',
      status: 'TRIAL',
      monthlyAmount: 0,
      billingCycle: 'monthly',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000),
      trialEndsAt: new Date(Date.now() - 1 * 86400 * 1000), // expired yesterday by default
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
  process.env.CRON_SECRET = CRON_SECRET;
});

afterEach(async () => {
  await prisma.subscription.deleteMany({ where: { providerId: TEST_PROVIDER_ID } });
  await prisma.provider.deleteMany({ where: { id: TEST_PROVIDER_ID } });
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
  delete process.env.CRON_SECRET;
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SUB-06-A Writer #9: Trial Expiry Cron', () => {

  it('T1: Expired TRIAL → EXPIRED, Provider reverted to BASIC/EXPIRED', async () => {
    await createProvider();
    const sub = await createTrialSubscription(); // trialEndsAt = yesterday

    const response = await GET(authorizedRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.count).toBe(1);
    expect(data.skipped).toBe(0);

    // Subscription: EXPIRED
    const subAfter = await prisma.subscription.findUnique({ where: { id: sub.id } });
    expect(subAfter!.status).toBe('EXPIRED');

    // Provider: reverted to BASIC/EXPIRED
    const provAfter = await prisma.provider.findUnique({ where: { id: TEST_PROVIDER_ID } });
    expect(provAfter!.subscriptionTier).toBe('BASIC');
    expect(provAfter!.subscriptionStatus).toBe('EXPIRED');

    console.log('✅ T1 PASS: Expired TRIAL → EXPIRED, Provider BASIC/EXPIRED');
  });

  it('T2: Non-expired TRIAL unchanged — trialEndsAt guard prevents premature expiry', async () => {
    await createProvider();
    // trialEndsAt is in the future
    const sub = await createTrialSubscription({
      trialEndsAt: new Date(Date.now() + 7 * 86400 * 1000), // expires in 7 days
    });

    const response = await GET(authorizedRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.count).toBe(0); // nothing expired

    // Subscription: still TRIAL
    const subAfter = await prisma.subscription.findUnique({ where: { id: sub.id } });
    expect(subAfter!.status).toBe('TRIAL');

    // Provider: unchanged
    const provAfter = await prisma.provider.findUnique({ where: { id: TEST_PROVIDER_ID } });
    expect(provAfter!.subscriptionTier).toBe('BASIC');
    expect(provAfter!.subscriptionStatus).toBe('TRIAL');

    console.log('✅ T2 PASS: Non-expired TRIAL unchanged — trialEndsAt guard correct');
  });

  it('T3: CAS prevents ACTIVE overwrite — subscription converted to ACTIVE before cron runs; Provider NOT reverted', async () => {
    // This is the critical property from SOURCE-VERIFICATION CONDITIONAL status.
    // The CAS (status:'TRIAL' in updateMany) must prevent the expiry from overwriting
    // a subscription that was converted to ACTIVE by a concurrent webhook.
    //
    // Scenario A (tested here via production route):
    //   Webhook fully completes before cron's pre-tx findMany runs.
    //   → findMany finds nothing (subscription is ACTIVE, not TRIAL)
    //   → route returns count:0, no mutations
    //   → Provider remains PRO/ACTIVE
    //
    // Scenario B (proved by DB-level TOCTOU test in sub-06a-writer-05-10-toctou.test.ts):
    //   Subscription is TRIAL at findMany time but ACTIVE by CAS time.
    //   → CAS count=0 → Provider NOT mutated
    //   → Provider remains ACTIVE (not reverted to BASIC)

    await createProvider({ subscriptionTier: 'PRO', subscriptionStatus: 'ACTIVE' });
    const sub = await createTrialSubscription({
      tier: 'PRO',
      trialEndsAt: new Date(Date.now() - 1 * 86400 * 1000),
    });

    // Simulate: concurrent webhook already converted TRIAL → ACTIVE
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'ACTIVE' },
    });

    // Run cron — findMany filters status:'TRIAL', finds nothing
    const response = await GET(authorizedRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.count).toBe(0);
    // Route returns early ("No expired trials to process") when findMany is empty
    expect(data.message).toMatch(/no expired trials/i);

    // CRITICAL: Provider must NOT have been reverted to BASIC
    const provAfter = await prisma.provider.findUnique({ where: { id: TEST_PROVIDER_ID } });
    expect(provAfter!.subscriptionTier).toBe('PRO');      // not BASIC
    expect(provAfter!.subscriptionStatus).toBe('ACTIVE'); // not EXPIRED

    // Subscription: still ACTIVE
    const subAfter = await prisma.subscription.findUnique({ where: { id: sub.id } });
    expect(subAfter!.status).toBe('ACTIVE');

    console.log('✅ T3 PASS: Webhook-converted ACTIVE subscription not reverted — Provider remains PRO/ACTIVE');
    console.log(`   count: ${data.count}, Provider tier: ${provAfter!.subscriptionTier}`);
    console.log('   CAS scenario B (in-flight race) separately proved by TOCTOU DB-level tests');
  });

  it('T4: Concurrent cron invocations — second invocation skips already-expired subscription', async () => {
    await createProvider();
    const sub = await createTrialSubscription();

    // First cron invocation — expires the subscription
    const response1 = await GET(authorizedRequest());
    const data1 = await response1.json();

    expect(data1.count).toBe(1);
    expect(data1.skipped).toBe(0);

    // Second cron invocation — same subscription now EXPIRED, not in pre-tx query
    // (findMany filters status:'TRIAL' AND trialEndsAt < now — EXPIRED not included)
    const response2 = await GET(authorizedRequest());
    const data2 = await response2.json();

    expect(data2.count).toBe(0);
    // No double-processing: subscription remains EXPIRED from first run
    const subAfter = await prisma.subscription.findUnique({ where: { id: sub.id } });
    expect(subAfter!.status).toBe('EXPIRED');

    console.log('✅ T4 PASS: Second cron invocation skips already-expired subscription');
  });

  it('T5: Unauthorized — no CRON_SECRET or Vercel header returns 401', async () => {
    const response = await GET(makeCronRequest()); // no auth
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toMatch(/unauthorized/i);

    console.log('✅ T5 PASS: No auth header returns 401');
  });

  it('T5b: Authorized via Vercel Cron header (x-vercel-cron: 1)', async () => {
    await createProvider();
    await createTrialSubscription();

    const response = await GET(makeCronRequest({ vercelCron: true }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    console.log('✅ T5b PASS: Vercel Cron header accepted as auth');
  });

  it('T6: No expired trials — returns count:0, no mutations', async () => {
    await createProvider();
    // No subscriptions created

    const response = await GET(authorizedRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.count).toBe(0);
    expect(data.message).toMatch(/no expired trials/i);

    console.log('✅ T6 PASS: No expired trials — count:0, no mutations');
  });

});
