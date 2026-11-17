/**
 * PH5-SCH-35: SaaS Checkout Idempotency — Production-Service Concurrency Test
 *
 * PURPOSE:
 * Call the actual exported handleCheckoutComplete() twice concurrently for the
 * same Stripe session and establish whether both invocations apply side effects.
 *
 * WHAT THIS TEST DOES:
 * - Calls the real exported handleCheckoutComplete() from lib/services/saas-payment.ts
 * - Mocks the Stripe SDK using vi.mock('stripe') hoisted before module load
 *   so the module-level `const stripe = new Stripe(...)` receives the mock
 * - Mocks the notification helper to capture calls
 * - Uses a barrier-synchronized concurrent call in C2
 *
 * WHAT THIS TEST DOES NOT DO:
 * - Call the HTTP webhook route or recordWebhookEvent()
 *
 * ARCHITECTURE:
 *   vi.mock('stripe') hoisted → intercepted by saas-payment.ts module-level init
 *   vi.mock('@/lib/services/notifications') → capture notification calls
 *   handleCheckoutComplete() → real implementation
 *   Prisma → Supabase test database (TEST_DATABASE_URL in vitest.config)
 *
 * EXECUTION:
 *   npx vitest run __tests__/integration/ph5-sch35-saas-checkout-concurrency.test.ts
 *   (TEST_DATABASE_URL is picked up from vitest.config.ts)
 *
 * C1 — SEQUENTIAL: second call should return early; AuditLog has 1 entry
 * C2 — CONCURRENT (DIAGNOSTIC): barrier-synchronized; records whether both commit
 *
 * PRISMA VERSION: 5.22.0 (from package-lock.json)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';

// ── Printed versions ──────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-var-requires
const prismaClientVersion: string = require('@prisma/client/package.json').version;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const prismaVersion: string = require('prisma/package.json').version;

// ── Notification capture ──────────────────────────────────────────────────────
const notificationCalls: Array<{ type: string }> = [];

// ── Mock: Stripe ──────────────────────────────────────────────────────────────
// vi.mock is hoisted before all imports. When saas-payment.ts runs
// `const stripe = new Stripe(key, opts)` at module level, it calls
// retrieveMock below instead of the real Stripe constructor.
// retrieveMock.mockImplementation() is set per-test to control the response.
const { retrieveMock } = vi.hoisted(() => ({
  retrieveMock: vi.fn(),
}));

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        retrieve: retrieveMock,
      },
    },
  })),
}));

// ── Mock: notifications ───────────────────────────────────────────────────────
vi.mock('@/lib/services/notifications', () => ({
  notifyCustomerBookingConfirmed: vi.fn().mockImplementation(async () => {
    notificationCalls.push({ type: 'customer' });
  }),
  notifyBookingConfirmed: vi.fn().mockImplementation(async () => {
    notificationCalls.push({ type: 'provider' });
  }),
}));

// ── Prisma client ─────────────────────────────────────────────────────────────
const prisma = new PrismaClient();
const TEST_PREFIX = `ph5sch35_${Date.now()}`;

let testProviderId: string;
let testCustomerId: string;
let testBusinessId: string;
let testUserId: string;

// ── Import after mocks are hoisted ────────────────────────────────────────────
import type { handleCheckoutComplete as HCC } from '@/lib/services/saas-payment';
let handleCheckoutComplete: typeof HCC;

describe('PH5-SCH-35: SaaS checkout production service concurrency', () => {
  beforeAll(async () => {
    console.log(`PH5-SCH-35: prisma@${prismaVersion} @prisma/client@${prismaClientVersion}`);

    // Dynamic import AFTER vi.mock() is registered — ensures the mock is applied
    const mod = await import('@/lib/services/saas-payment');
    handleCheckoutComplete = mod.handleCheckoutComplete;

    testUserId = (await prisma.user.create({
      data: { email: `${TEST_PREFIX}@test.com`, name: 'Test User', role: 'CLIENT' },
    })).id;

    testProviderId = (await prisma.provider.create({
      data: {
        name: `${TEST_PREFIX}_Provider`,
        phone: '0400000000',
        hourlyRate: 100,
        businessModel: 'SAAS',
        paymentMode: 'PLATFORM',
        approvalStatus: 'APPROVED',
        isActive: true,
      },
    })).id;

    testCustomerId = (await prisma.customer.create({
      data: {
        name: `${TEST_PREFIX}_Customer`,
        email: `${TEST_PREFIX}@test.com`,
        phone: '0400000001',
        preferredProviderId: testProviderId,
        userId: testUserId,
      },
    })).id;

    testBusinessId = `biz_${testProviderId}`;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { actorId: testCustomerId } }).catch(() => {});
    await prisma.quote.deleteMany({ where: { providerId: testProviderId } }).catch(() => {});
    await prisma.booking.deleteMany({ where: { providerId: testProviderId } }).catch(() => {});
    await prisma.customer.deleteMany({ where: { preferredProviderId: testProviderId } }).catch(() => {});
    await prisma.provider.deleteMany({ where: { id: testProviderId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: testUserId } }).catch(() => {});
    await prisma.$disconnect();
  });

  beforeEach(() => {
    notificationCalls.length = 0;
    retrieveMock.mockReset();
  });

  async function createTestBookingAndQuote(label: string) {
    const booking = await prisma.booking.create({
      data: {
        providerId: testProviderId,
        customerId: testCustomerId,
        customerName: `${TEST_PREFIX}_Customer`,
        customerPhone: '0400000001',
        status: 'PENDING_PAYMENT',
        price: 100,
        platformFee: 10,
        providerPayout: 90,
        commissionRate: 0.10,
        duration: 60,
      },
    });

    const quote = await (prisma as any).quote.create({
      data: {
        bookingId: booking.id,
        providerId: testProviderId,
        customerId: testCustomerId,
        amount: 100,
        description: `Test quote ${label}`,
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'ACCEPTED',
        lineItems: [],
        stripeSessionId: `cs_${TEST_PREFIX}_${label}`,
      },
    });

    return { booking, quote };
  }

  function makeSessionResponse(sessionId: string, quoteId: string, bookingId: string) {
    return {
      id: sessionId,
      payment_status: 'paid',
      metadata: {
        type: 'saas_booking',
        quoteId,
        bookingId,
        businessId: testBusinessId,
      },
      payment_intent: {
        id: `pi_${TEST_PREFIX}_${quoteId.slice(-6)}`,
        amount: 10000,
        application_fee_amount: 1000,
      },
      customer: 'cus_test',
    };
  }

  // ── C1: Sequential calls ──────────────────────────────────────────────────
  it('C1: sequential calls — second returns early, no duplicate side effects', async () => {
    const { booking, quote } = await createTestBookingAndQuote('C1');
    const sessionId = `cs_${TEST_PREFIX}_C1`;
    retrieveMock.mockResolvedValue(makeSessionResponse(sessionId, quote.id, booking.id));

    const result1 = await handleCheckoutComplete(sessionId);
    expect(result1.quoteId).toBe(quote.id);

    const paidQuote = await (prisma as any).quote.findUnique({ where: { id: quote.id } });
    expect(paidQuote.status).toBe('PAID');

    // Second call — returns early because quote is already PAID
    const result2 = await handleCheckoutComplete(sessionId);
    expect(result2.quoteId).toBe(quote.id);

    const auditLogs = await prisma.auditLog.findMany({
      where: { targetId: quote.id, action: 'QUOTE_PAYMENT_COMPLETED' },
    });
    expect(auditLogs.length).toBe(1);

    const confirmedBooking = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(confirmedBooking?.status).toBe('CONFIRMED');

    console.log('C1: AuditLog entries:', auditLogs.length, '— PASS');
  });

  // ── C2: Concurrent calls — the actual PH5-SCH-35 race (DIAGNOSTIC) ────────
  it('C2: concurrent calls with barrier — diagnose duplicate side effects', async () => {
    const { booking, quote } = await createTestBookingAndQuote('C2');
    const sessionId = `cs_${TEST_PREFIX}_C2`;

    // Barrier: delay the retrieve response until both calls have started,
    // so both observe the quote as unpaid before either enters the transaction.
    const barrier = { count: 0, resolve: null as ((v: void) => void) | null };
    const barrierPromise = new Promise<void>((res) => { barrier.resolve = res; });
    const session = makeSessionResponse(sessionId, quote.id, booking.id);

    retrieveMock.mockImplementation(async () => {
      barrier.count++;
      if (barrier.count >= 2 && barrier.resolve) barrier.resolve();
      await barrierPromise;
      return session;
    });

    const [r1, r2] = await Promise.allSettled([
      handleCheckoutComplete(sessionId),
      handleCheckoutComplete(sessionId),
    ]);

    const auditLogs = await prisma.auditLog.findMany({
      where: { targetId: quote.id, action: 'QUOTE_PAYMENT_COMPLETED' },
    });

    console.log('C2 Results:', { r1: r1.status, r2: r2.status });
    console.log('C2 AuditLog entries:', auditLogs.length);
    console.log('C2 Notification calls:', notificationCalls.length);

    if (auditLogs.length > 1) {
      console.error('❌ PH5-SCH-35 CONFIRMED: AuditLog has', auditLogs.length, 'entries — duplicate side effects in production service');
    } else if (auditLogs.length === 1) {
      console.log('✅ AuditLog has 1 entry — PostgreSQL or Prisma prevented the race');
    }

    expect(auditLogs.length).toBeGreaterThanOrEqual(1);
    expect(auditLogs.length).toBeLessThanOrEqual(2);

    const failed = r1.status === 'rejected' ? r1 : (r2.status === 'rejected' ? r2 : null);
    if (failed && failed.status === 'rejected') {
      const err = failed.reason as any;
      console.log('C2 Losing call error:', err?.code, err?.name, err?.message?.slice(0, 100));
    }
  });
});
