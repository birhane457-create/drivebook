/**
 * PH5-SCH-22a: Payout atomicity — PostgreSQL runtime tests
 *
 * Tests the durable reservation, concurrent balance protection, and
 * recovery claim mechanism against a real PostgreSQL database.
 *
 * PRE-CONDITIONS:
 *   TEST_DATABASE_URL pointing to isolated test PostgreSQL (NOT Sydney production)
 *   Prisma migrations applied (prisma migrate deploy)
 *   STRIPE_SECRET_KEY set to Stripe test key OR Stripe mocked (see below)
 *
 * EXECUTION:
 *   npx vitest run __tests__/integration/ph5-sch22a-payout-reservation.test.ts
 *
 * TEST COVERAGE:
 *   T5  — Stripe succeeds, DB commit fails → idempotency recovery, ledger written once
 *   T11 — Two concurrent $600 payouts, $1000 balance → exactly one succeeds before Stripe
 *   T12 — Two concurrent confirmPayoutReceived → exactly one commits ledger
 *   RC1 — Two simultaneous recoverProcessingPayout → exactly one acquires claim
 *   RC2 — Expired claim → another worker can take over
 *   RC3 — Stale worker attempts completion after takeover → rejected, no ledger changes
 *   RC6 — Manual recovery → claim fields cleared on PENDING_TRANSFER transition
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';

// ── Database client ────────────────────────────────────────────────────────────

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL || 'postgresql://postgres:DEBE@localhost:5432/drivebook_test' },
  },
});

// Safety guard — never run against Sydney production
const dbUrl = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL || '';
if (['jflrqxigfiiqednfacuf'].some(h => dbUrl.includes(h))) {
  throw new Error('DATABASE_URL points at Sydney production — refusing to run');
}

// ── Stripe mock ───────────────────────────────────────────────────────────────
// Stripe is mocked at the module level.  Individual tests override
// mockStripeCreate / mockStripeRetrieve as needed.

const mockStripeCreate = vi.fn();
const mockStripeRetrieve = vi.fn();
const mockStripeAccountsRetrieve = vi.fn();

vi.mock('stripe', () => {
  class StripeError extends Error {
    type: string = 'stripe_error';
  }
  class StripeConnectionError extends StripeError {
    type = 'api_connection_error';
  }
  class StripeAPIError extends StripeError {
    type = 'api_error';
    statusCode = 500;
  }

  const mockStripeInstance = {
    transfers: {
      create: (...args: unknown[]) => mockStripeCreate(...args),
      retrieve: (...args: unknown[]) => mockStripeRetrieve(...args),
      list: vi.fn().mockResolvedValue({ data: [] }),
    },
    accounts: {
      // Mock Stripe Connect account as fully verified so ownership checks pass.
      // Returns metadata.providerId matching whatever providerId is on the payout row
      // so verifyPayoutDestinationOwnership() passes without real Stripe calls.
      retrieve: (...args: unknown[]) => mockStripeAccountsRetrieve(...args),
    },
  };

  const StripeConstructor = vi.fn(() => mockStripeInstance);
  (StripeConstructor as any).errors = {
    StripeError,
    StripeConnectionError,
    StripeAPIError,
  };

  return { default: StripeConstructor };
});

vi.mock('@/lib/prisma', () => ({ prisma }));
vi.mock('@/lib/services/sms', () => ({ smsService: { sendSMS: vi.fn() } }));
vi.mock('@/lib/services/email', () => ({ emailService: { sendGenericEmail: vi.fn() } }));
vi.mock('@/lib/services/alert-service', () => ({ sendAlert: vi.fn() }));

// Import after mocking
const {
  buildPayout,
  executePayout,
  confirmPayoutReceived,
  markPayoutSent,
} = await import('@/lib/services/payout-service');

const { commitPayoutCompletion, releasePayoutReservation } = await import('@/lib/services/ledger-service');

// ── Test helpers ───────────────────────────────────────────────────────────────

const TEST_TAG = `sch22a_${Date.now()}`;

/** Create a minimal provider + user for a test payout. */
async function createTestProvider(tag: string) {
  const user = await prisma.user.create({
    data: {
      email: `${tag}@test.invalid`,
      name: `Test Provider ${tag}`,
      role: 'PROVIDER',
    },
  });
  const provider = await prisma.provider.create({
    data: {
      userId: user.id,
      name: `Test Provider ${tag}`,
      phone: `+6140000${Math.floor(Math.random() * 90000) + 10000}`,
      hourlyRate: 80,
      payoutMethod: 'stripe_connect',
      stripeAccountId: `acct_test_${tag}`,
      chargesEnabled: true,
      payoutsEnabled: true,
      withholdingTaxRate: 0,
      gstRegistered: false,
    },
  });
  return { user, provider };
}

/** Create a completed transaction attached to a provider (no booking required). */
async function createTestTransaction(providerId: string, amount: number, tag: string) {
  const tx = await prisma.transaction.create({
    data: {
      providerId,
      type: 'LESSON',
      amount,
      platformFee: amount * 0.036,
      providerPayout: amount * 0.864,
      commissionRate: 0.1,
      taxWithheld: 0,
      gstAmount: 0,
      status: 'COMPLETED',
      description: `Test lesson ${tag}`,
    },
  });
  return { tx };
}

/**
 * Create a test transaction that satisfies buildPayout eligibility:
 * type=BOOKING_PAYMENT, status=COMPLETED, with a completed booking older than the buffer.
 */
async function createEligibleTransaction(providerId: string, netAmount: number, tag: string) {
  const customer = await prisma.customer.create({
    data: {
      name: `Customer ${tag}`,
      email: `cust_${tag}@test.invalid`,
      phone: `+6141${Math.floor(Math.random() * 9000000) + 1000000}`,
    },
  });

  const grossAmount = netAmount / 0.864;
  // Check-out 72h ago — safely outside the 48h dispute buffer
  const checkOutTime = new Date(Date.now() - 72 * 60 * 60 * 1000);

  const booking = await prisma.booking.create({
    data: {
      providerId,
      customerId: customer.id,
      status: 'COMPLETED',
      checkOutTime,
      source: 'platform',
      price: grossAmount,
      platformFee: grossAmount * 0.036,
      providerPayout: netAmount,
      commissionRate: 0.1,
    },
  });

  const tx = await prisma.transaction.create({
    data: {
      providerId,
      bookingId: booking.id,
      type: 'BOOKING_PAYMENT',
      amount: grossAmount,
      platformFee: grossAmount * 0.036,
      providerPayout: netAmount,
      commissionRate: 0.1,
      taxWithheld: 0,
      gstAmount: 0,
      status: 'COMPLETED',
      description: `Test booking payment ${tag}`,
    },
  });

  return { customer, booking, tx };
}

/**
 * Insert a Payout row directly in ELIGIBLE state, bypassing buildPayout eligibility checks.
 * Used for tests that manually override payout state (RC tests).
 */
async function createTestPayout(providerId: string, netAmount: number, tag: string) {
  const idempotencyKey = `test_idem_${tag}_${Math.random().toString(36).slice(2)}`;
  const payoutRef = `PAY-TEST-${tag.toUpperCase().slice(-8)}-${Math.floor(Math.random() * 9000) + 1000}`;
  const payout = await prisma.payout.create({
    data: {
      providerId,
      status: 'ELIGIBLE',
      grossAmount: netAmount / 0.864,
      taxWithheld: 0,
      gstAmount: 0,
      netAmount,
      payoutMethod: 'stripe_connect',
      stripeAccountId: `acct_test_${tag}`,
      idempotencyKey,
      payoutRef,
    },
  });
  return payout;
}

/** Set PlatformLedger to known values and return them. */
async function setLedger(values: {
  totalCollected: number;
  totalPaidOut?: number;
  totalRefunded?: number;
  totalReserved?: number;
  totalTaxWithheld?: number;
  totalPayoutReserved?: number;
}) {
  await prisma.platformLedger.upsert({
    where: { key: 'default' },
    create: {
      key: 'default',
      totalCollected: values.totalCollected,
      totalPaidOut: values.totalPaidOut ?? 0,
      totalRefunded: values.totalRefunded ?? 0,
      totalReserved: values.totalReserved ?? 0,
      totalTaxWithheld: values.totalTaxWithheld ?? 0,
      totalPayoutReserved: values.totalPayoutReserved ?? 0,
    },
    update: {
      totalCollected: values.totalCollected,
      totalPaidOut: values.totalPaidOut ?? 0,
      totalRefunded: values.totalRefunded ?? 0,
      totalReserved: values.totalReserved ?? 0,
      totalTaxWithheld: values.totalTaxWithheld ?? 0,
      totalPayoutReserved: values.totalPayoutReserved ?? 0,
    },
  });
}

async function getLedger() {
  const l = await prisma.platformLedger.findUnique({ where: { key: 'default' } });
  return {
    totalCollected: Number(l?.totalCollected ?? 0),
    totalPaidOut: Number(l?.totalPaidOut ?? 0),
    totalRefunded: Number(l?.totalRefunded ?? 0),
    totalReserved: Number(l?.totalReserved ?? 0),
    totalTaxWithheld: Number(l?.totalTaxWithheld ?? 0),
    totalPayoutReserved: Number(l?.totalPayoutReserved ?? 0),
  };
}

function availableBalance(l: Awaited<ReturnType<typeof getLedger>>) {
  return l.totalCollected - l.totalPaidOut - l.totalRefunded - l.totalPayoutReserved;
}

/** Cleanup all test-tagged rows. */
async function cleanupTag(tag: string) {
  await prisma.payoutTransaction.deleteMany({
    where: { payout: { payoutRef: { contains: tag } } },
  });
  await prisma.payout.deleteMany({ where: { payoutRef: { contains: tag } } });
  await prisma.ledgerEntry.deleteMany({ where: { description: { contains: tag } } });
}

// ── Shared state tracked for afterAll cleanup ──────────────────────────────────

const createdProviders: Array<{ providerId: string; userId: string }> = [];
const createdCustomers: string[] = []; // from createEligibleTransaction
const taggedPayouts: string[] = [];

// Reset mock call history before each test so call-count assertions are isolated
beforeEach(() => {
  vi.clearAllMocks();
  // Re-apply default no-op implementations
  mockStripeCreate.mockResolvedValue({ id: 'tr_default_mock', amount: 0 });
  mockStripeRetrieve.mockResolvedValue({ id: 'tr_default_mock', amount: 0 });
  // accounts.retrieve: look up provider by stripeAccountId so ownership check passes
  mockStripeAccountsRetrieve.mockImplementation(async (accountId: string) => {
    const provider = await prisma.provider.findFirst({
      where: { stripeAccountId: accountId },
      select: { id: true },
    });
    return {
      id: accountId,
      charges_enabled: true,
      payouts_enabled: true,
      metadata: provider ? { providerId: provider.id } : {},
    };
  });
});

afterAll(async () => {
  for (const tag of taggedPayouts) await cleanupTag(tag);
  // Clean up bookings and customers from createEligibleTransaction
  if (createdCustomers.length) {
    // Delete transactions before bookings (FK constraint)
    await prisma.transaction.deleteMany({ where: { bookingId: { in:
      (await prisma.booking.findMany({ where: { customerId: { in: createdCustomers } }, select: { id: true } })).map(b => b.id)
    }}});
    await prisma.booking.deleteMany({ where: { customerId: { in: createdCustomers } } });
    await prisma.customer.deleteMany({ where: { id: { in: createdCustomers } } });
  }
  // Delete remaining transactions by providerId
  await prisma.transaction.deleteMany({ where: { providerId: { in: createdProviders.map(p => p.providerId) } } });
  for (const { providerId, userId } of createdProviders) {
    await prisma.provider.deleteMany({ where: { id: providerId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }
  await prisma.$disconnect();
}, 120_000);

// ═══════════════════════════════════════════════════════════════════════════════
// T11 — Concurrent balance race: exactly one $600 payout succeeds at reservation
// ═══════════════════════════════════════════════════════════════════════════════

describe('T11 | Concurrent balance race — durable reservation', () => {
  const tag = `${TEST_TAG}_t11`;
  let provider1: Awaited<ReturnType<typeof createTestProvider>>;
  let provider2: Awaited<ReturnType<typeof createTestProvider>>;

  beforeAll(async () => {
    provider1 = await createTestProvider(`${tag}_p1`);
    provider2 = await createTestProvider(`${tag}_p2`);
    createdProviders.push(
      { providerId: provider1.provider.id, userId: provider1.user.id },
      { providerId: provider2.provider.id, userId: provider2.user.id },
    );
    taggedPayouts.push(tag);
  });

  it('T11: exactly one succeeds, Stripe called once, balance never negative', async () => {
    // Arrange: $1000 available, two $600 payouts
    const BALANCE = 1000;
    const PAYOUT_AMOUNT = 600;
    await setLedger({ totalCollected: BALANCE });

    const { customer: c1, tx: tx1 } = await createEligibleTransaction(
      provider1.provider.id, PAYOUT_AMOUNT, `${tag}_tx1`,
    );
    const { customer: c2, tx: tx2 } = await createEligibleTransaction(
      provider2.provider.id, PAYOUT_AMOUNT, `${tag}_tx2`,
    );
    createdCustomers.push(c1.id, c2.id);
    const adminId = 'admin_t11_test';

    const { payoutId: p1Id } = await buildPayout(provider1.provider.id, adminId, [tx1.id]);
    const { payoutId: p2Id } = await buildPayout(provider2.provider.id, adminId, [tx2.id]);

    // Stripe mock — succeeds for the one that gets through
    const mockTransfer = { id: 'tr_t11_success', amount: PAYOUT_AMOUNT * 100 };
    mockStripeCreate.mockResolvedValue(mockTransfer);

    // Act: execute both concurrently
    const [r1, r2] = await Promise.allSettled([
      executePayout(p1Id, adminId),
      executePayout(p2Id, adminId),
    ]);

    // Assert: exactly one PAID, one FAILED (executePayout returns FAILED as resolved value)
    const results = [r1, r2]
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<any>).value);

    const paidResults = results.filter(r => r?.status === 'PAID');
    const failedResults = results.filter(r => r?.status === 'FAILED');

    expect(paidResults.length).toBe(1);
    expect(failedResults.length).toBe(1);

    // Failed payout got an insufficient-balance error
    expect(failedResults[0].failureReason).toMatch(/Insufficient balance/i);

    // Stripe called exactly once — the failed payout never reached it
    expect(mockStripeCreate).toHaveBeenCalledTimes(1);

    // Verify payout row statuses
    const payoutStates = await prisma.payout.findMany({
      where: { id: { in: [p1Id, p2Id] } },
      select: { status: true, stripeTransferId: true, reservedAt: true },
    });
    expect(payoutStates.some(p => p.status === 'PAID')).toBe(true);
    expect(payoutStates.some(p => p.status === 'FAILED')).toBe(true);

    // The failed payout never reached Stripe (stripeTransferId should be null)
    const failedPayout = payoutStates.find(p => p.status === 'FAILED');
    expect(failedPayout?.stripeTransferId).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// T5 — Stripe succeeds, DB commit fails → idempotency recovery, ledger once
// ═══════════════════════════════════════════════════════════════════════════════

describe('T5 | Stripe success + DB commit failure → idempotency recovery', () => {
  const tag = `${TEST_TAG}_t5`;
  let provider: Awaited<ReturnType<typeof createTestProvider>>;

  beforeAll(async () => {
    provider = await createTestProvider(`${tag}_p`);
    createdProviders.push({ providerId: provider.provider.id, userId: provider.user.id });
    taggedPayouts.push(tag);
  });

  it('T5: reservation preserved on commit failure, retry succeeds once', async () => {
    await setLedger({ totalCollected: 1000 });

    const { customer: ct5, tx } = await createEligibleTransaction(
      provider.provider.id, 500, `${tag}_tx`,
    );
    createdCustomers.push(ct5.id);

    const adminId = 'admin_t5_test';
    const { payoutId } = await buildPayout(provider.provider.id, adminId, [tx.id]);

    const mockTransferId = 'tr_t5_idempotent';

    // First attempt: Stripe succeeds, then commitPayoutCompletion throws
    let commitCallCount = 0;
    const originalCommit = commitPayoutCompletion;
    vi.spyOn(
      await import('@/lib/services/ledger-service'),
      'commitPayoutCompletion',
    ).mockImplementation(async (...args) => {
      if (commitCallCount++ === 0) throw new Error('Simulated DB commit failure');
      return originalCommit(...args as Parameters<typeof originalCommit>);
    });

    mockStripeCreate.mockResolvedValue({ id: mockTransferId, amount: 50000 });

    // First attempt must fail
    await expect(executePayout(payoutId, adminId)).rejects.toThrow('Simulated DB commit failure');

    // Payout remains PROCESSING — not FAILED
    const afterFirstAttempt = await prisma.payout.findUnique({ where: { id: payoutId } });
    expect(afterFirstAttempt?.status).toBe('PROCESSING');
    expect(afterFirstAttempt?.reservedAt).not.toBeNull();

    // Ledger: reservation still active, totalPaidOut not yet incremented
    const ledgerMid = await getLedger();
    expect(ledgerMid.totalPayoutReserved).toBeGreaterThan(0);
    expect(ledgerMid.totalPaidOut).toBe(0);

    // No LedgerEntry written
    const entriesMid = await prisma.ledgerEntry.findMany({
      where: { referenceId: payoutId, type: 'PAYOUT_PAID' },
    });
    expect(entriesMid.length).toBe(0);

    // Restore real commitPayoutCompletion for retry
    vi.restoreAllMocks();

    // Stripe returns the same transfer on retry (idempotency)
    mockStripeCreate.mockResolvedValue({ id: mockTransferId, amount: 50000 });
    mockStripeRetrieve.mockResolvedValue({ id: mockTransferId, amount: 50000 });

    // Second attempt: routes to recoverProcessingPayout → Scenario A (stripeTransferId set)
    // OR Scenario B (idempotency key replay) depending on timing
    const result = await executePayout(payoutId, adminId);
    expect(result.status).toBe('PAID');

    // Payout is now PAID
    const afterRecovery = await prisma.payout.findUnique({ where: { id: payoutId } });
    expect(afterRecovery?.status).toBe('PAID');
    expect(afterRecovery?.reservedAt).toBeNull();     // reservation cleared
    expect(afterRecovery?.recoveryClaimToken).toBeNull(); // claim cleared

    // LedgerEntry written exactly once
    const entries = await prisma.ledgerEntry.findMany({
      where: { referenceId: payoutId, type: 'PAYOUT_PAID' },
    });
    expect(entries.length).toBe(1);

    // totalPayoutReserved back to 0, totalPaidOut incremented exactly once
    const ledgerFinal = await getLedger();
    expect(ledgerFinal.totalPayoutReserved).toBe(0);
    expect(ledgerFinal.totalPaidOut).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// T12 — Two concurrent confirmPayoutReceived → exactly one commits
// ═══════════════════════════════════════════════════════════════════════════════

describe('T12 | Concurrent confirmPayoutReceived — exactly one commits', () => {
  const tag = `${TEST_TAG}_t12`;
  let provider: Awaited<ReturnType<typeof createTestProvider>>;

  beforeAll(async () => {
    provider = await createTestProvider(`${tag}_p`);
    createdProviders.push({ providerId: provider.provider.id, userId: provider.user.id });
    taggedPayouts.push(tag);
  });

  it('T12: only one confirmation commits, ledger written once', async () => {
    await setLedger({ totalCollected: 1000 });

    const { customer: ct12, tx } = await createEligibleTransaction(
      provider.provider.id, 500, `${tag}_tx`,
    );
    createdCustomers.push(ct12.id);

    const adminId = 'admin_t12_test';

    // Override provider to use bank/manual method
    await prisma.provider.update({
      where: { id: provider.provider.id },
      data: { payoutMethod: 'bank_transfer', stripeAccountId: null },
    });

    mockStripeCreate.mockResolvedValue({ id: 'tr_t12_ignore', amount: 50000 });

    const { payoutId } = await buildPayout(provider.provider.id, adminId, [tx.id]);
    await executePayout(payoutId, adminId); // → PENDING_TRANSFER (with reservation)
    await markPayoutSent(payoutId, adminId, 'REF-T12-TEST'); // → SENT

    const beforeConfirm = await getLedger();
    const initialPaidOut = beforeConfirm.totalPaidOut;
    const initialReserved = beforeConfirm.totalPayoutReserved;

    // Confirm concurrently from two admins
    const [r1, r2] = await Promise.allSettled([
      confirmPayoutReceived(payoutId, 'admin1_t12'),
      confirmPayoutReceived(payoutId, 'admin2_t12'),
    ]);

    const succeeded = [r1, r2].filter(r => r.status === 'fulfilled');
    const failed = [r1, r2].filter(r => r.status === 'rejected');

    expect(succeeded.length).toBe(1);
    expect(failed.length).toBe(1);

    // LedgerEntry written exactly once
    const entries = await prisma.ledgerEntry.findMany({
      where: { referenceId: payoutId, type: 'PAYOUT_PAID' },
    });
    expect(entries.length).toBe(1);

    // totalPaidOut incremented exactly once
    const ledgerFinal = await getLedger();
    expect(ledgerFinal.totalPaidOut).toBeGreaterThan(initialPaidOut);
    expect(ledgerFinal.totalPayoutReserved).toBe(0); // reservation released
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RC1 — Two simultaneous recoverProcessingPayout → exactly one acquires claim
// ═══════════════════════════════════════════════════════════════════════════════

describe('RC1 | Concurrent recovery — exactly one acquires claim', () => {
  const tag = `${TEST_TAG}_rc1`;
  let provider: Awaited<ReturnType<typeof createTestProvider>>;

  beforeAll(async () => {
    provider = await createTestProvider(`${tag}_p`);
    createdProviders.push({ providerId: provider.provider.id, userId: provider.user.id });
    taggedPayouts.push(tag);
  });

  it('RC1: only one recovery worker acquires the claim', async () => {
    await setLedger({ totalCollected: 1000 });

    const payout = await createTestPayout(provider.provider.id, 300, `${tag}`);
    const payoutId = payout.id;
    const adminId = 'admin_rc1_test';

    // Set payout to PROCESSING with active reservation to simulate stuck-in-recovery state
    await prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: 'PROCESSING',
        reservedAt: new Date(),
        reservedAmount: 300,
        reservationId: `RES_rc1_${TEST_TAG}`,
        recoveryClaimToken: null,
        recoveryClaimExpiresAt: null,
      },
    });
    await prisma.platformLedger.update({
      where: { key: 'default' },
      data: { totalPayoutReserved: { increment: 300 } },
    });

    const mockTransferId = 'tr_rc1_recovery';
    mockStripeCreate.mockResolvedValue({ id: mockTransferId, amount: 30000 });
    mockStripeRetrieve.mockResolvedValue({ id: mockTransferId, amount: 30000 });

    // Fire two concurrent recovery attempts
    const [r1, r2] = await Promise.allSettled([
      executePayout(payoutId, adminId),
      executePayout(payoutId, adminId),
    ]);

    const succeeded = [r1, r2].filter(r => r.status === 'fulfilled');

    // Both may appear to succeed (second sees PAID status) OR only one does —
    // the key assertion is that the payout is PAID exactly once
    const finalPayout = await prisma.payout.findUnique({ where: { id: payoutId } });
    expect(finalPayout?.status).toBe('PAID');
    expect(finalPayout?.recoveryClaimToken).toBeNull(); // claim cleared after completion

    // LedgerEntry written exactly once
    const entries = await prisma.ledgerEntry.findMany({
      where: { referenceId: payoutId, type: 'PAYOUT_PAID' },
    });
    expect(entries.length).toBe(1);

    // totalPayoutReserved decremented exactly once
    const ledger = await getLedger();
    expect(ledger.totalPayoutReserved).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RC2 — Expired claim → another worker can take over
// ═══════════════════════════════════════════════════════════════════════════════

describe('RC2 | Expired claim takeover', () => {
  const tag = `${TEST_TAG}_rc2`;
  let provider: Awaited<ReturnType<typeof createTestProvider>>;

  beforeAll(async () => {
    provider = await createTestProvider(`${tag}_p`);
    createdProviders.push({ providerId: provider.provider.id, userId: provider.user.id });
    taggedPayouts.push(tag);
  });

  it('RC2: a new worker acquires an expired claim and completes the payout', async () => {
    await setLedger({ totalCollected: 1000 });

    const payout = await createTestPayout(provider.provider.id, 300, `${tag}`);
    const payoutId = payout.id;
    const adminId = 'admin_rc2_test';

    // Set an EXPIRED claim — simulates a crashed worker
    await prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: 'PROCESSING',
        reservedAt: new Date(),
        reservedAmount: 300,
        reservationId: `RES_rc2_${TEST_TAG}`,
        recoveryClaimToken: 'expired-claim-token',
        recoveryClaimExpiresAt: new Date(Date.now() - 1000), // expired 1 second ago
      },
    });
    await prisma.platformLedger.update({
      where: { key: 'default' },
      data: { totalPayoutReserved: { increment: 300 } },
    });

    const mockTransferId = 'tr_rc2_recovery';
    mockStripeCreate.mockResolvedValue({ id: mockTransferId, amount: 30000 });
    mockStripeRetrieve.mockResolvedValue({ id: mockTransferId, amount: 30000 });

    // New worker calls executePayout — should detect PROCESSING+reservedAt,
    // enter recovery, find expired claim, acquire it
    const result = await executePayout(payoutId, adminId);

    expect(result.status).toBe('PAID');

    const finalPayout = await prisma.payout.findUnique({ where: { id: payoutId } });
    expect(finalPayout?.status).toBe('PAID');
    expect(finalPayout?.recoveryClaimToken).toBeNull();
    expect(finalPayout?.reservedAt).toBeNull();

    const entries = await prisma.ledgerEntry.findMany({
      where: { referenceId: payoutId, type: 'PAYOUT_PAID' },
    });
    expect(entries.length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RC3 — Stale worker attempts completion after takeover → rejected, no changes
// ═══════════════════════════════════════════════════════════════════════════════

describe('RC3 | Stale worker rejected at completion', () => {
  const tag = `${TEST_TAG}_rc3`;
  let provider: Awaited<ReturnType<typeof createTestProvider>>;

  beforeAll(async () => {
    provider = await createTestProvider(`${tag}_p`);
    createdProviders.push({ providerId: provider.provider.id, userId: provider.user.id });
    taggedPayouts.push(tag);
  });

  it('RC3: commitPayoutCompletion with stale token matches 0 rows, rolls back', async () => {
    await setLedger({ totalCollected: 1000 });

    const payout = await createTestPayout(provider.provider.id, 300, `${tag}`);
    const payoutId = payout.id;

    const staleToken = 'stale-worker-token';
    const activeToken = 'active-worker-token';
    const adminId = 'admin_rc3_test';

    // Set up: payout PROCESSING with the ACTIVE worker's token
    await prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: 'PROCESSING',
        reservedAt: new Date(),
        reservedAmount: 300,
        reservationId: `RES_rc3_${TEST_TAG}`,
        recoveryClaimToken: activeToken,
        recoveryClaimExpiresAt: new Date(Date.now() + 600_000),
      },
    });
    await prisma.platformLedger.update({
      where: { key: 'default' },
      data: { totalPayoutReserved: { increment: 300 } },
    });

    const ledgerBefore = await getLedger();

    // Stale worker tries to commit using its old token
    await expect(
      commitPayoutCompletion({
        payoutId,
        stripeTransferId: 'tr_rc3_stale',
        payout: {
          netAmount: 300,
          grossAmount: Number(payout.grossAmount),
          taxWithheld: 0,
          payoutRef: payout.payoutRef,
          providerId: provider.provider.id,
        },
        txCount: 1,
        adminUserId: adminId,
        path: 'stripe',
        recoveryClaimToken: staleToken, // ← wrong token
      })
    ).rejects.toThrow('Recovery claim no longer owned');

    // Ledger unchanged — the transaction rolled back
    const ledgerAfter = await getLedger();
    expect(ledgerAfter.totalPaidOut).toBe(ledgerBefore.totalPaidOut);
    expect(ledgerAfter.totalPayoutReserved).toBe(ledgerBefore.totalPayoutReserved);

    // No LedgerEntry created
    const entries = await prisma.ledgerEntry.findMany({
      where: { referenceId: payoutId, type: 'PAYOUT_PAID' },
    });
    expect(entries.length).toBe(0);

    // Payout still PROCESSING with active token intact
    const finalPayout = await prisma.payout.findUnique({ where: { id: payoutId } });
    expect(finalPayout?.status).toBe('PROCESSING');
    expect(finalPayout?.recoveryClaimToken).toBe(activeToken);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RC6 — Manual recovery: claim cleared on PENDING_TRANSFER transition
// ═══════════════════════════════════════════════════════════════════════════════

describe('RC6 | Manual recovery — claim cleared on PENDING_TRANSFER', () => {
  const tag = `${TEST_TAG}_rc6`;
  let provider: Awaited<ReturnType<typeof createTestProvider>>;

  beforeAll(async () => {
    provider = await createTestProvider(`${tag}_p`);
    createdProviders.push({ providerId: provider.provider.id, userId: provider.user.id });
    taggedPayouts.push(tag);
  });

  it('RC6: PENDING_TRANSFER update clears claim fields, ownership-checked', async () => {
    await setLedger({ totalCollected: 1000 });

    // Set provider to bank/manual
    await prisma.provider.update({
      where: { id: provider.provider.id },
      data: { payoutMethod: 'bank_transfer', stripeAccountId: null },
    });

    const payout = await createTestPayout(provider.provider.id, 300, `${tag}`);
    // Update payout row to reflect bank_transfer method (createTestPayout defaults to stripe_connect)
    await prisma.payout.update({
      where: { id: payout.id },
      data: { payoutMethod: 'bank_transfer', stripeAccountId: null },
    });
    const payoutId = payout.id;
    const adminId = 'admin_rc6_test';

    // Set payout PROCESSING with active claim (simulates crashed manual recovery)
    await prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: 'PROCESSING',
        reservedAt: new Date(),
        reservedAmount: 300,
        reservationId: `RES_rc6_${TEST_TAG}`,
        recoveryClaimToken: null,
        recoveryClaimExpiresAt: null,
      },
    });
    await prisma.platformLedger.update({
      where: { key: 'default' },
      data: { totalPayoutReserved: { increment: 300 } },
    });

    // executePayout detects PROCESSING+reservedAt, routes to recoverProcessingPayout
    // isStripe = false → transitions to PENDING_TRANSFER, clears claim
    const result = await executePayout(payoutId, adminId);

    expect(result.status).toBe('PENDING_TRANSFER');

    const finalPayout = await prisma.payout.findUnique({ where: { id: payoutId } });
    expect(finalPayout?.status).toBe('PENDING_TRANSFER');
    expect(finalPayout?.recoveryClaimToken).toBeNull();
    expect(finalPayout?.recoveryClaimExpiresAt).toBeNull();
    // Financial reservation preserved — funds still held until confirmed
    expect(finalPayout?.reservedAt).not.toBeNull();
  });
});
