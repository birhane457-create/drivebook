/**
 * PH5-SCH-35: SaaS Checkout Idempotency — Database Race Simulation
 *
 * SCOPE:
 * This test manually reproduces the transaction sequence that handleCheckoutComplete()
 * performs. It does NOT call handleCheckoutComplete() directly. It is a database-level
 * race simulation, not a test of the production service.
 *
 * The correct next step is to make handleCheckoutComplete() testable through
 * dependency injection or controlled module mocks (vi.mock for Stripe and notifications),
 * then call the actual exported function twice concurrently.
 *
 * WHAT THIS TEST DOES:
 * - Simulates the pre-transaction status check and the atomic Quote/Booking/AuditLog
 *   transaction that handleCheckoutComplete() performs
 * - Uses a barrier to ensure both concurrent simulations pass the status check before
 *   either enters its transaction
 * - Records whether duplicate AuditLog entries or duplicate notification calls occur
 * - Requires PostgreSQL to run; PostgreSQL not available in the current environment
 *
 * WHAT THIS TEST DOES NOT DO:
 * - Call handleCheckoutComplete()
 * - Exercise the production recordWebhookEvent() sequence
 * - Mock Stripe through the service (Stripe is never called)
 * - Establish whether the production service has an atomic guard not visible in source
 *
 * ARCHITECTURE:
 *   Direct Prisma calls → isolated PostgreSQL (localhost:5433/drivebook_test)
 *   Notification mock: manual call counter (service not invoked)
 *
 * PRE-CONDITIONS:
 *   - PostgreSQL running on localhost:5433 with database drivebook_test
 *   - DATABASE_URL=postgresql://postgres:testpass@localhost:5433/drivebook_test
 *   - Prisma migrations applied with prisma migrate deploy (not db push)
 *
 * EXECUTION:
 *   DATABASE_URL=postgresql://postgres:testpass@localhost:5433/drivebook_test \
 *   npx vitest run __tests__/integration/ph5-sch35-saas-checkout-concurrency.test.ts
 *
 * C1 ACCEPTANCE CRITERIA (sequential — should be safe):
 *   - Second call detects PAID status and returns early
 *   - AuditLog contains exactly one entry
 *   - Notification counter incremented exactly once
 *
 * C2 DIAGNOSTIC CRITERIA (concurrent — the actual race):
 *   - AuditLog entry count establishes whether both transactions committed
 *   - Notification counter establishes whether both notification paths ran
 *   - AuditLog > 1 or notifications > 1 confirms the race in the simulated sequence
 *
 * SCOPE:
 *   This is a service-layer test, not an HTTP route test.
 *   It does not verify the webhook handler's WebhookEvent recording.
 *   See PH5-SCH-35 in PHASE-5-SCHEMA-INTEGRITY-AUDIT.md for the full finding.
 *
 * PRISMA VERSION: 5.22.0 (from package-lock.json at 22a076d6)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

// ── Printed versions ──────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-var-requires
const prismaClientVersion = require('@prisma/client/package.json').version as string;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const prismaVersion = require('prisma/package.json').version as string;

const prisma = new PrismaClient();
const TEST_PREFIX = `ph5sch35_${Date.now()}`;

// ── Test state ────────────────────────────────────────────────────────────────
let testProviderId: string;
let testCustomerId: string;
let testBusinessId: string;
let testUserId: string;

// ── Notification mock ─────────────────────────────────────────────────────────
// Records how many times notifications are sent
const notificationCalls: Array<{ quoteId: string }> = [];

// ── Override module imports used inside handleCheckoutComplete ─────────────────
// NOTE: handleCheckoutComplete() is NOT called by this test.
// This test manually reproduces the database transaction sequence.
// A proper service-level test would use vi.mock() to mock Stripe and
// notifications, then call the exported handleCheckoutComplete() directly.

describe('PH5-SCH-35: SaaS checkout database race simulation (NOT a service-level test)', () => {
  beforeAll(async () => {
    console.log(`PH5-SCH-35 test: prisma@${prismaVersion} @prisma/client@${prismaClientVersion}`);

    // Create minimal test data
    testUserId = (await prisma.user.create({
      data: {
        email: `${TEST_PREFIX}@test.com`,
        name: 'Test User',
        role: 'CLIENT',
      },
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
        email: `${TEST_PREFIX}_customer@test.com`,
        phone: '0400000001',
        preferredProviderId: testProviderId,
        userId: testUserId,
      },
    })).id;

    testBusinessId = `biz_${testProviderId}`;
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.auditLog.deleteMany({ where: { targetId: { startsWith: TEST_PREFIX } } }).catch(() => {});
    await prisma.quote.deleteMany({ where: { providerId: testProviderId } }).catch(() => {});
    await prisma.booking.deleteMany({ where: { providerId: testProviderId } }).catch(() => {});
    await prisma.customer.deleteMany({ where: { preferredProviderId: testProviderId } }).catch(() => {});
    await prisma.provider.deleteMany({ where: { id: testProviderId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: testUserId } }).catch(() => {});
    await prisma.$disconnect();
  });

  beforeEach(() => {
    notificationCalls.length = 0;
  });

  // ── C1: Sequential calls — second should be idempotent ─────────────────────
  it('C1: sequential calls — second returns early, no duplicate side effects', async () => {
    // Create booking + quote in PENDING state
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
        description: 'Test quote',
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'ACCEPTED',
        lineItems: [],
      },
    });

    const sessionId = cs_\_C1;
    // No Stripe session object needed — the service is not called

    // Instrument the function by calling it directly against the test DB
    // We need to inject a controlled Stripe mock and notification mock.
    // Since handleCheckoutComplete is not exported for injection, we test
    // the database state directly after simulating the transaction sequence.

    // Simulate the handleCheckoutComplete transaction (the part that must be idempotent):
    const runTransaction = async () => {
      const currentQuote = await prisma.quote.findUnique({ where: { id: quote.id } });
      if (!currentQuote) throw new Error('Quote not found');

      // Pre-transaction status check (this is where the race occurs)
      if ((currentQuote as any).status === 'PAID') {
        return { idempotent: true, quoteStatus: 'PAID' };
      }

      await prisma.$transaction(async (tx) => {
        await (tx as any).quote.update({ where: { id: quote.id }, data: { status: 'PAID' } });
        await tx.booking.update({ where: { id: booking.id }, data: { status: 'CONFIRMED' } });
        await tx.auditLog.create({
          data: {
            action: 'QUOTE_PAYMENT_COMPLETED',
            actorId: testCustomerId,
            actorRole: 'CLIENT',
            targetType: 'Quote',
            targetId: quote.id,
            metadata: { amountPaid: 100, sessionId },
          },
        });
      });

      notificationCalls.push({ quoteId: quote.id });
      return { idempotent: false, quoteStatus: 'PAID' };
    };

    // First call
    const result1 = await runTransaction();
    expect(result1.idempotent).toBe(false);

    // Second call — should detect PAID and return early
    const result2 = await runTransaction();
    expect(result2.idempotent).toBe(true);

    // Verify exactly one audit log entry
    const auditLogs = await prisma.auditLog.findMany({
      where: { targetId: quote.id, action: 'QUOTE_PAYMENT_COMPLETED' },
    });
    expect(auditLogs.length).toBe(1);

    // Verify notifications sent exactly once
    expect(notificationCalls.length).toBe(1);
  });

  // ── C2: Concurrent calls — the actual PH5-SCH-35 race ─────────────────────
  it('C2: concurrent calls — determine whether both apply side effects (DIAGNOSTIC)', async () => {
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
        description: 'Test quote C2',
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'ACCEPTED',
        lineItems: [],
      },
    });

    const sessionId = `cs_${TEST_PREFIX}_C2`;

    // Barrier: both calls pass the status check before either enters the transaction
    const barrier = { count: 0, resolve: null as ((v: void) => void) | null };
    const barrierPromise = new Promise<void>((res) => { barrier.resolve = res; });

    const runConcurrentCall = async () => {
      const currentQuote = await prisma.quote.findUnique({ where: { id: quote.id } });
      if (!currentQuote) throw new Error('Quote not found');

      // Both calls must pass the check before either enters the transaction
      barrier.count++;
      if (barrier.count >= 2 && barrier.resolve) barrier.resolve();
      await barrierPromise;

      if ((currentQuote as any).status === 'PAID') {
        return { result: 'early_return' };
      }

      try {
        await prisma.$transaction(async (tx) => {
          await (tx as any).quote.update({ where: { id: quote.id }, data: { status: 'PAID' } });
          await tx.booking.update({ where: { id: booking.id }, data: { status: 'CONFIRMED' } });
          await tx.auditLog.create({
            data: {
              action: 'QUOTE_PAYMENT_COMPLETED',
              actorId: testCustomerId,
              actorRole: 'CLIENT',
              targetType: 'Quote',
              targetId: quote.id,
              metadata: { amountPaid: 100, sessionId },
            },
          });
        });
        notificationCalls.push({ quoteId: quote.id });
        return { result: 'committed' };
      } catch (err: any) {
        return { result: 'error', code: err.code, name: err.name, message: err.message };
      }
    };

    const [r1, r2] = await Promise.all([runConcurrentCall(), runConcurrentCall()]);

    const auditLogs = await prisma.auditLog.findMany({
      where: { targetId: quote.id, action: 'QUOTE_PAYMENT_COMPLETED' },
    });

    console.log('C2 Results:', { r1, r2 });
    console.log('C2 AuditLog entries:', auditLogs.length);
    console.log('C2 Notification calls:', notificationCalls.length);

    // The key question: were duplicate side effects applied?
    if (auditLogs.length > 1) {
      console.error('❌ PH5-SCH-35 CONFIRMED: AuditLog has', auditLogs.length, 'entries — duplicate side effects applied');
    } else {
      console.log('✅ AuditLog has exactly 1 entry — either the race did not trigger or PostgreSQL serialisation prevented it');
    }

    if (notificationCalls.length > 1) {
      console.error('❌ PH5-SCH-35 CONFIRMED: Notifications sent', notificationCalls.length, 'times');
    } else {
      console.log('✅ Notifications sent exactly', notificationCalls.length, 'time(s)');
    }

    // Diagnostic assertions: fail on unexpected states, classify the race outcome
    expect(auditLogs.length).toBeGreaterThanOrEqual(1);
    expect(auditLogs.length).toBeLessThanOrEqual(2);
    expect(notificationCalls.length).toBeLessThanOrEqual(2);

    // If exactly one of each: check the losing call's result
    if (auditLogs.length === 1) {
      const loser = r1.result === 'committed' ? r2 : r1;
      // Acceptable: early_return (barrier didn't hold), error with P2002/P2034
      if (loser.result === 'error') {
        const acceptedCodes = ['P2002', 'P2034'];
        console.log('C2 Losing error code:', (loser as any).code);
        expect(acceptedCodes).toContain((loser as any).code);
      }
    }
  });
});
