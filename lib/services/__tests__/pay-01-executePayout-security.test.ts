/**
 * Service-Level Security Test: PAY-01 Payout Destination Ownership
 *
 * CRITICAL SECURITY REQUIREMENT:
 * Proves that executePayout() BLOCKS money transfer when ownership verification fails.
 *
 * This test demonstrates:
 * 1. Ownership verification happens BEFORE stripe.transfers.create()
 * 2. Failed verification means stripe.transfers.create is NEVER called
 * 3. Successful verification allows legitimate transfers
 * 4. TOCTOU: the verified account ID is the exact value used in the transfer
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Stripe from 'stripe';

// ─── Module mocks (hoisted before any imports) ────────────────────────────────

vi.mock('../payout-security', () => ({
  verifyPayoutDestinationOwnership: vi.fn(),
}));

// Capture the mock fns at module scope so tests can reference stripe.transfers.create
const mockTransfersCreate = vi.fn();
const mockAccountsRetrieve = vi.fn();

vi.mock('stripe', () => ({
  default: vi.fn(() => ({
    transfers: { create: mockTransfersCreate },
    accounts:  { retrieve: mockAccountsRetrieve },
  })),
}));

// Prisma: all tables the payout execution path touches
const mockPrisma = {
  payout: {
    updateMany: vi.fn(),   // atomic lock
    findUnique: vi.fn(),   // load after lock
    update:     vi.fn(),   // mark PAID / FAILED
  },
  provider: {
    findUnique: vi.fn(),   // instructor name/phone for notifications
  },
  auditLog: {
    create: vi.fn(),       // logTransition
  },
  ledgerEntry: {
    findMany: vi.fn(),     // ADJUSTMENT recovery
    update:   vi.fn(),
  },
};

vi.mock('@/lib/prisma', () => ({
  default:  mockPrisma,
  prisma:   mockPrisma,
}));

// Ledger and alert helpers — correct import paths from payout-service.ts
vi.mock('@/lib/services/ledger-service', () => ({
  appendLedgerEntry:      vi.fn().mockResolvedValue({}),
  incrementLedger:        vi.fn().mockResolvedValue({}),
  assertSufficientBalance: vi.fn().mockResolvedValue(undefined),
  assertNonNegativeBalance: vi.fn().mockResolvedValue(undefined),
  getPlatformLedger:      vi.fn().mockResolvedValue({ balance: 1000000 }),
}));

vi.mock('@/lib/services/alert-service', () => ({
  sendAlert: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/services/sms', () => ({
  smsService: { sendSMS: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('@/lib/services/email', () => ({
  emailService: { send: vi.fn().mockResolvedValue(undefined) },
}));

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('executePayout – PAY-01 Destination Ownership Security', () => {
  const ADMIN_ID = 'admin-test-user';

  let executePayout: typeof import('../payout-service').executePayout;
  let verifyPayoutDestinationOwnership: typeof import('../payout-security').verifyPayoutDestinationOwnership;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Re-import inside each test to pick up fresh mock state
    const secMod = await import('../payout-security');
    verifyPayoutDestinationOwnership = secMod.verifyPayoutDestinationOwnership;

    const svcMod = await import('../payout-service');
    executePayout = svcMod.executePayout;

    // Default happy-path plumbing mocks
    mockPrisma.auditLog.create.mockResolvedValue({});
    mockPrisma.ledgerEntry.findMany.mockResolvedValue([]);
    mockPrisma.provider.findUnique.mockResolvedValue({
      name: 'Test Instructor',
      phone: '0400000000',
      user: { email: 'test@example.com' },
    });
  });

  // ─── CASE 1: account substitution ──────────────────────────────────────────

  it('BLOCKS transfer when ownership verification fails (account substitution)', async () => {
    const payoutId         = 'payout-sub-001';
    const legitProvider    = 'provider-alice';
    const attackerAccount  = 'acct_ATTACKER456';

    const compromisedPayout = makePayout(payoutId, legitProvider, attackerAccount);

    mockPrisma.payout.updateMany.mockResolvedValue({ count: 1 }); // lock acquired
    mockPrisma.payout.findUnique.mockResolvedValue(compromisedPayout);
    mockPrisma.payout.update.mockResolvedValue(compromisedPayout);   // FAILED update

    vi.mocked(verifyPayoutDestinationOwnership).mockResolvedValue({
      valid: false,
      reason: `Ownership mismatch: metadata.providerId='provider-attacker' does not match expected='${legitProvider}'`,
      stripeAccountId:    attackerAccount,
      expectedProviderId: legitProvider,
      actualProviderId:   'provider-attacker',
    });

    const result = await executePayout(payoutId, ADMIN_ID);

    expect(result.status).toBe('FAILED');
    expect(result.failureReason).toMatch(/ownership.*verification.*failed/i);

    // ✅ CRITICAL: money-moving call must never happen
    expect(mockTransfersCreate).not.toHaveBeenCalled();

    // Verify security check was invoked with the right arguments
    expect(verifyPayoutDestinationOwnership).toHaveBeenCalledWith(
      expect.anything(),
      attackerAccount,
      legitProvider,
    );
  });

  // ─── CASE 2: missing metadata ───────────────────────────────────────────────

  it('BLOCKS transfer when metadata.providerId is missing from Stripe account', async () => {
    const payoutId  = 'payout-nometa-002';
    const provider  = 'provider-bob';
    const accountId = 'acct_NOMETA789';

    const payout = makePayout(payoutId, provider, accountId);
    mockPrisma.payout.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.payout.findUnique.mockResolvedValue(payout);
    mockPrisma.payout.update.mockResolvedValue(payout);

    vi.mocked(verifyPayoutDestinationOwnership).mockResolvedValue({
      valid:              false,
      reason:             'Stripe account missing metadata.providerId',
      stripeAccountId:    accountId,
      expectedProviderId: provider,
    });

    const result = await executePayout(payoutId, ADMIN_ID);

    expect(result.status).toBe('FAILED');
    expect(result.failureReason).toMatch(/metadata\.providerId/i);

    // ✅ CRITICAL
    expect(mockTransfersCreate).not.toHaveBeenCalled();
  });

  // ─── CASE 3: Stripe API error during verification ──────────────────────────

  it('BLOCKS transfer when Stripe API errors during ownership verification', async () => {
    const payoutId  = 'payout-apierr-003';
    const provider  = 'provider-charlie';
    const accountId = 'acct_ERROR500';

    const payout = makePayout(payoutId, provider, accountId);
    mockPrisma.payout.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.payout.findUnique.mockResolvedValue(payout);
    mockPrisma.payout.update.mockResolvedValue(payout);

    vi.mocked(verifyPayoutDestinationOwnership).mockResolvedValue({
      valid:              false,
      reason:             'Stripe API error during ownership verification: Service unavailable',
      stripeAccountId:    accountId,
      expectedProviderId: provider,
    });

    const result = await executePayout(payoutId, ADMIN_ID);

    expect(result.status).toBe('FAILED');
    expect(result.failureReason).toMatch(/Stripe API error/i);

    // ✅ CRITICAL
    expect(mockTransfersCreate).not.toHaveBeenCalled();
  });

  // ─── CASE 4: legitimate payout proceeds ────────────────────────────────────

  it('ALLOWS transfer when ownership verification passes', async () => {
    const payoutId  = 'payout-legit-004';
    const provider  = 'provider-alice';
    const accountId = 'acct_LEGIT123';

    const payout = makePayout(payoutId, provider, accountId);
    mockPrisma.payout.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.payout.findUnique.mockResolvedValue(payout);
    mockPrisma.payout.update.mockResolvedValue(payout);

    vi.mocked(verifyPayoutDestinationOwnership).mockResolvedValue({
      valid:              true,
      stripeAccountId:    accountId,
      expectedProviderId: provider,
      actualProviderId:   provider,
    });

    mockTransfersCreate.mockResolvedValue({
      id: 'tr_LEGIT123', amount: 10000, currency: 'aud', destination: accountId,
    } as Stripe.Transfer);

    const result = await executePayout(payoutId, ADMIN_ID);

    // Transfer should have been called
    expect(mockTransfersCreate).toHaveBeenCalledTimes(1);
    expect(mockTransfersCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        currency:    'aud',
        destination: accountId,
      }),
      expect.anything(), // idempotency key wrapper
    );

    // Verify ownership check ran before transfer
    const verifyOrder  = vi.mocked(verifyPayoutDestinationOwnership).mock.invocationCallOrder[0];
    const transferOrder = mockTransfersCreate.mock.invocationCallOrder[0];
    expect(verifyOrder).toBeLessThan(transferOrder);
  });

  // ─── CASE 5: TOCTOU – verified ID === transfer destination ─────────────────

  it('TOCTOU: verified stripeAccountId is the exact destination passed to stripe.transfers.create()', async () => {
    const payoutId          = 'payout-toctou-005';
    const provider          = 'provider-dave';
    const verifiedAccountId = 'acct_VERIFIED789';

    const payout = makePayout(payoutId, provider, verifiedAccountId);
    mockPrisma.payout.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.payout.findUnique.mockResolvedValue(payout);
    mockPrisma.payout.update.mockResolvedValue(payout);

    vi.mocked(verifyPayoutDestinationOwnership).mockResolvedValue({
      valid:              true,
      stripeAccountId:    verifiedAccountId,
      expectedProviderId: provider,
      actualProviderId:   provider,
    });

    mockTransfersCreate.mockResolvedValue({
      id: 'tr_TOCTOU789', destination: verifiedAccountId,
    } as Stripe.Transfer);

    await executePayout(payoutId, ADMIN_ID);

    // The second arg to verifyPayoutDestinationOwnership is the accountId
    const verifyArgs      = vi.mocked(verifyPayoutDestinationOwnership).mock.calls[0];
    const checkedAccount  = verifyArgs[1];

    // The destination in stripe.transfers.create must be the same value
    const transferArgs    = mockTransfersCreate.mock.calls[0];
    const transferDest    = transferArgs[0].destination;

    expect(checkedAccount).toBe(verifiedAccountId);
    expect(transferDest).toBe(verifiedAccountId);
    expect(checkedAccount).toBe(transferDest); // same reference: no re-fetch from DB
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePayout(id: string, providerId: string, stripeAccountId: string) {
  return {
    id,
    providerId,
    stripeAccountId,
    netAmount:    10000,
    grossAmount:  11000,
    taxWithheld:  1000,
    gstAmount:    0,
    payoutMethod: 'stripe_connect',
    payoutRef:    `PAYOUT-${id}`,
    idempotencyKey: `idem-${id}`,
    status:       'PENDING',
    transactions: [
      { transactionId: 'txid1' },
      { transactionId: 'txid2' },
    ],
  };
}
