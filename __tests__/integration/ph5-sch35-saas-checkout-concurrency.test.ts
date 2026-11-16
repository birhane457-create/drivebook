/**
 * PH5-SCH-35: SaaS Checkout Idempotency — Production-Service Concurrency Test
 *
 * PURPOSE:
 * Call the actual exported handleCheckoutComplete() twice concurrently for the
 * same Stripe session and establish whether both invocations apply side effects.
 *
 * PH5-SCH-35 states that the pre-transaction status check (quote.status === 'PAID')
 * is performed before the transaction, so two concurrent deliveries can both pass
 * the check before either commits and both apply side effects.
 *
 * WHAT THIS TEST DOES:
 * - Calls the real exported handleCheckoutComplete() from lib/services/saas-payment.ts
 * - Mocks the Stripe SDK so no real network calls are made
 * - Mocks the notification helper so side effects are captured, not sent
 * - Uses a barrier so both calls observe the quote as unpaid before either commits
 * - Records AuditLog entries and notification calls to determine race outcome
 *
 * WHAT THIS TEST DOES NOT DO:
 * - Call the HTTP webhook route or recordWebhookEvent()
 * - Establish whether the webhook handler's outer idempotency guard prevents the race
 *
 * ARCHITECTURE:
 *   vi.mock('stripe') → controlled session response, no network
 *   vi.mock('@/lib/services/notifications') → capture notification calls
 *   handleCheckoutComplete() → real implementation from lib/services/saas-payment.ts
 *   Prisma → isolated PostgreSQL (localhost:5433/drivebook_test)
 *
 * PRE-CONDITIONS:
 *   - PostgreSQL running on localhost:5433 with database drivebook_test
 *   - DATABASE_URL=postgresql://postgres:testpass@localhost:5433/drivebook_test
 *   - Prisma migrations applied with prisma migrate deploy (not db push)
 *   - No real Stripe credentials required (Stripe is fully mocked)
 *
 * EXECUTION:
 *   DATABASE_URL=postgresql://postgres:testpass@localhost:5433/drivebook_test \
 *   npx vitest run __tests__/integration/ph5-sch35-saas-checkout-concurrency.test.ts
 *
 * C1 — SEQUENTIAL (correctness baseline):
 *   Pass criteria: second call returns early, AuditLog has 1 entry, 1 notification
 *
 * C2 — CONCURRENT (the actual PH5-SCH-35 race, DIAGNOSTIC):
 *   - AuditLog > 1 entries: race confirmed, both transactions committed
 *   - AuditLog = 1 entry: PostgreSQL or Prisma prevented the race
 *   - Failing exit code is NOT the goal; correct classification of the outcome is
 *
 * PRISMA VERSION: 5.22.0 (from package-lock.json at 22a076d6)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';

// ── Resolved versions ─────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-var-requires
const prismaClientVersion: string = require('@prisma/client/package.json').version;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const prismaVersion: string = require('prisma/package.json').version;

// ── Notification capture ──────────────────────────────────────────────────────
const notificationCalls: Array<{ quoteId: string; type: string }> = [];

// ── Mock: Stripe ──────────────────────────────────────────────────────────────
// Controlled session response; no network calls.
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      checkout: {
        sessions: {
          retrieve: vi.fn().mockResolvedValue({
            id: 'cs_test',
            payment_status: 'paid',
            metadata: {},        // quoteId/bookingId/businessId injected per-test
            payment_intent: {
              id: 'pi_test',
              amount: 10000,
              application_fee_amount: 1000,
            },
            customer: 'cus_test',
          }),
        },
      },
    })),
  };
});

// ── Mock: notifications ───────────────────────────────────────────────────────
vi.mock('@/lib/services/notifications', () => ({
  notifyCustomerBookingConfirmed: vi.fn().mockImplementation(async (booking: any) => {
    notificationCalls.push({ quoteId: booking?.quoteId ?? 'unknown', type: 'customer' });
  }),
  notifyBookingConfirmed: vi.fn().mockImplementation(async (booking: any) => {
    notificationCalls.push({ quoteId: booking?.quoteId ?? 'unknown', type: 'provider' });
  }),
}));

// ── Prisma client for setup and verification ──────────────────────────────────
const prisma = new PrismaClient();
const TEST_PREFIX = `ph5sch35_${Date.now()}`;

let testProviderId: string;
let testCustomerId: string;
let testBusinessId: string;
let testUserId: string;

// ── Import the production function under test ─────────────────────────────────
// Imported here so vi.mock() intercepts its Stripe import at module resolution time.
import type { handleCheckoutComplete as HandleCheckoutComplete } from '@/lib/services/saas-payment';
let handleCheckoutComplete: typeof HandleCheckoutComplete;

describe('PH5-SCH-35: SaaS checkout production service concurrency', () => {
  beforeAll(async () => {
    console.log(`PH5-SCH-35: prisma@${prismaVersion} @prisma/client@${prismaClientVersion}`);

    // Dynamically import after vi.mock() has been registered
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
    vi.clearAllMocks();
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

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

  function configureStripeMock(sessionId: string, quoteId: string, bookingId: string) {
    const Stripe = require('stripe').default;
    Stripe.mockImplementation(() => ({
      checkout: {
        sessions: {
          retrieve: vi.fn().mockResolvedValue({
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
          }),
        },
      },
    }));
  }

  // ── C1: Sequential calls — second should return early ─────────────────────
  it('C1: sequential calls — second returns early, no duplicate side effects', async () => {
    const { booking, quote } = await createTestBookingAndQuote('C1');
    const sessionId = `cs_${TEST_PREFIX}_C1`;
    configureStripeMock(sessionId, quote.id, booking.id);

    // First call — should apply side effects
    const result1 = await handleCheckoutComplete(sessionId);
    expect(result1.quoteId).toBe(quote.id);
    expect(result1.bookingId).toBe(booking.id);

    // Verify quote is PAID
    const paidQuote = await (prisma as any).quote.findUnique({ where: { id: quote.id } });
    expect(paidQuote.status).toBe('PAID');

    // Second call — quote is now PAID, should return early
    const result2 = await handleCheckoutComplete(sessionId);
    expect(result2.quoteId).toBe(quote.id);

    // Verify exactly one AuditLog entry
    const auditLogs = await prisma.auditLog.findMany({
      where: { targetId: quote.id, action: 'QUOTE_PAYMENT_COMPLETED' },
    });
    expect(auditLogs.length).toBe(1);

    // Verify booking is CONFIRMED exactly once
    const confirmedBooking = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(confirmedBooking?.status).toBe('CONFIRMED');

    console.log('C1: sequential calls — AuditLog entries:', auditLogs.length, '— PASS');
  });

  // ── C2: Concurrent calls — the actual PH5-SCH-35 race (DIAGNOSTIC) ────────
  it('C2: concurrent calls with barrier — diagnose duplicate side effects', async () => {
    const { booking, quote } = await createTestBookingAndQuote('C2');
    const sessionId = `cs_${TEST_PREFIX}_C2`;

    // Configure Stripe mock to pause at retrieve so both calls read unpaid quote
    // before either enters the transaction.
    // Barrier: both calls must call stripe.retrieve before either resolves it.
    const barrier = { count: 0, resolve: null as ((v: void) => void) | null };
    const barrierPromise = new Promise<void>((res) => { barrier.resolve = res; });

    const Stripe = require('stripe').default;
    Stripe.mockImplementation(() => ({
      checkout: {
        sessions: {
          retrieve: vi.fn().mockImplementation(async () => {
            // Signal that we have reached the retrieve call
            barrier.count++;
            if (barrier.count >= 2 && barrier.resolve) barrier.resolve();
            // Wait for both calls to reach this point before returning
            await barrierPromise;
            return {
              id: sessionId,
              payment_status: 'paid',
              metadata: {
                type: 'saas_booking',
                quoteId: quote.id,
                bookingId: booking.id,
                businessId: testBusinessId,
              },
              payment_intent: {
                id: `pi_${TEST_PREFIX}_C2`,
                amount: 10000,
                application_fee_amount: 1000,
              },
              customer: 'cus_test',
            };
          }),
        },
      },
    }));

    // Both calls observe the quote as unpaid at session retrieve time (before the
    // status check in the production function), then proceed concurrently.
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

    if (notificationCalls.length > 1) {
      console.error('❌ PH5-SCH-35 CONFIRMED: notifications sent', notificationCalls.length, 'times');
    }

    // Diagnostic bounds: fail on unexpected states, not on the race outcome itself
    expect(auditLogs.length).toBeGreaterThanOrEqual(1);
    expect(auditLogs.length).toBeLessThanOrEqual(2);

    // If one transaction committed and the other failed, classify the failure
    const failed = r1.status === 'rejected' ? r1 : (r2.status === 'rejected' ? r2 : null);
    if (failed && failed.status === 'rejected') {
      const err = failed.reason as any;
      console.log('C2 Losing call error:', err?.code, err?.name, err?.message);
      // Acceptable error codes indicating a database-level guard prevented the duplicate
      const acceptedCodes = ['P2002', 'P2034'];
      if (err?.code && !acceptedCodes.includes(err.code)) {
        console.error('C2 Unrecognised error code:', err.code, '— not evidence of a database guard');
      }
    }
  });
});
