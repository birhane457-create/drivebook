/**
 * PAY-01-D: Post-Verification State, Retry, Idempotency, Ledger and Alert Audit
 *
 * These tests verify the operational consequences of an ownership verification
 * failure — everything that happens AFTER the security check blocks the transfer.
 *
 * Six properties are tested:
 *
 * D1. FAILURE STATE — payout record is set to FAILED (not PROCESSING, not PAID).
 *     stripeTransferId remains null. retryCount is incremented.
 *
 * D2. RETRY — a FAILED payout can be retried once the problem is corrected.
 *     The lock guard accepts ELIGIBLE and FAILED, so retry is structurally available.
 *     A repeated mismatch continues to fail; a corrected account passes.
 *
 * D3. IDEMPOTENCY — the Stripe idempotency key is NOT consumed when ownership
 *     verification fails, because stripe.transfers.create is never called.
 *     A subsequent legitimate retry uses the same idempotency key and succeeds
 *     without a duplicate transfer.
 *
 * D4. LEDGER CONSISTENCY — appendLedgerEntry and incrementLedger are called
 *     only on the success path, after the transfer is confirmed. A blocked
 *     transfer produces exactly zero ledger entries.
 *
 * D5. ALERT / AUDIT TRAIL — a destination mismatch fires sendAlert with
 *     PAYOUT_FAILED severity CRITICAL and includes payout/provider identifiers
 *     and the failure reason. No Stripe secret keys are present in the payload.
 *
 * D6. CONCURRENCY — a second concurrent call while PROCESSING returns the
 *     current PROCESSING state immediately, without reaching the ownership
 *     check or the transfer call.
 */

import type Stripe from 'stripe';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../payout-security', () => ({
  verifyPayoutDestinationOwnership: vi.fn(),
}));

const mockTransfersCreate = vi.fn();
const mockAccountsRetrieve = vi.fn();

vi.mock('stripe', () => ({
  default: vi.fn(() => ({
    transfers: { create: mockTransfersCreate },
    accounts:  { retrieve: mockAccountsRetrieve },
  })),
}));

const mockPrisma = {
  payout: {
    updateMany: vi.fn(),
    findUnique: vi.fn(),
    update:     vi.fn(),
  },
  provider: {
    findUnique: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  ledgerEntry: {
    findMany: vi.fn(),
    update:   vi.fn(),
  },
};

vi.mock('@/lib/prisma', () => ({
  default: mockPrisma,
  prisma:  mockPrisma,
}));

const mockAppendLedgerEntry   = vi.fn().mockResolvedValue({});
const mockIncrementLedger     = vi.fn().mockResolvedValue({});
const mockAssertSufficient    = vi.fn().mockResolvedValue(undefined);
const mockAssertNonNegative   = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/services/ledger-service', () => ({
  appendLedgerEntry:       mockAppendLedgerEntry,
  incrementLedger:         mockIncrementLedger,
  assertSufficientBalance: mockAssertSufficient,
  assertNonNegativeBalance: mockAssertNonNegative,
  getPlatformLedger:       vi.fn().mockResolvedValue({ balance: 1_000_000 }),
}));

const mockSendAlert = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/services/alert-service', () => ({ sendAlert: mockSendAlert }));

vi.mock('@/lib/services/sms',   () => ({ smsService: { sendSMS: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('@/lib/services/email', () => ({ emailService: { sendGenericEmail: vi.fn().mockResolvedValue(undefined) } }));

// ─── Shared setup ─────────────────────────────────────────────────────────────

const ADMIN      = 'admin-d-test';
const PROVIDER   = 'provider-d';
const LEGIT_ACCT = 'acct_LEGIT_D';
const BAD_ACCT   = 'acct_ATTACKER_D';

function makePayout(overrides: Partial<ReturnType<typeof basePayout>> = {}) {
  return { ...basePayout(), ...overrides };
}

function basePayout() {
  return {
    id:             'payout-d-001',
    providerId:     PROVIDER,
    stripeAccountId: LEGIT_ACCT,
    netAmount:      8000,
    grossAmount:    8800,
    taxWithheld:    800,
    gstAmount:      0,
    payoutMethod:   'stripe_connect',
    payoutRef:      'PAYOUT-D-001',
    idempotencyKey: 'idem-d-001',
    status:         'ELIGIBLE',
    transactions:   [{ transactionId: 'txid-d-1' }, { transactionId: 'txid-d-2' }],
  };
}

describe('PAY-01-D: Post-Verification State Consistency', () => {
  let executePayout: typeof import('../payout-service').executePayout;
  let verifyOwnership: typeof import('../payout-security').verifyPayoutDestinationOwnership;

  beforeEach(async () => {
    vi.clearAllMocks();

    const sec = await import('../payout-security');
    verifyOwnership = sec.verifyPayoutDestinationOwnership;

    const svc = await import('../payout-service');
    executePayout = svc.executePayout;

    // Default plumbing
    mockPrisma.auditLog.create.mockResolvedValue({});
    mockPrisma.ledgerEntry.findMany.mockResolvedValue([]);
    mockPrisma.provider.findUnique.mockResolvedValue({
      name: 'Test Instructor',
      phone: '0400000000',
      user: { email: 'instructor@example.com' },
    });
  });

  // ─── D1: FAILURE STATE ────────────────────────────────────────────────────

  describe('D1 – Failure state', () => {
    it('sets payout status to FAILED on ownership mismatch, not PROCESSING or PAID', async () => {
      const payout = makePayout({ stripeAccountId: BAD_ACCT });
      mockPrisma.payout.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.payout.findUnique.mockResolvedValue(payout);
      mockPrisma.payout.update.mockResolvedValue(payout);

      vi.mocked(verifyOwnership).mockResolvedValue({
        valid: false,
        reason: `metadata.providerId='provider-attacker' !== expected='${PROVIDER}'`,
        stripeAccountId: BAD_ACCT,
        expectedProviderId: PROVIDER,
        actualProviderId: 'provider-attacker',
      });

      const result = await executePayout(payout.id, ADMIN);

      expect(result.status).toBe('FAILED');
      expect(result.stripeTransferId).toBeNull();
      expect(result.failureReason).toMatch(/ownership.*verification.*failed/i);
    });

    it('writes status=FAILED to the database with a failureReason', async () => {
      const payout = makePayout({ stripeAccountId: BAD_ACCT });
      mockPrisma.payout.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.payout.findUnique.mockResolvedValue(payout);
      mockPrisma.payout.update.mockResolvedValue(payout);

      vi.mocked(verifyOwnership).mockResolvedValue({
        valid: false,
        reason: 'Ownership mismatch',
        stripeAccountId: BAD_ACCT,
        expectedProviderId: PROVIDER,
      });

      await executePayout(payout.id, ADMIN);

      const updateCall = mockPrisma.payout.update.mock.calls.find(
        c => c[0]?.data?.status === 'FAILED'
      );
      expect(updateCall).toBeDefined();
      expect(updateCall![0].data.failureReason).toMatch(/ownership.*verification.*failed/i);
    });

    it('increments retryCount on every ownership failure', async () => {
      const payout = makePayout({ stripeAccountId: BAD_ACCT });
      mockPrisma.payout.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.payout.findUnique.mockResolvedValue(payout);
      mockPrisma.payout.update.mockResolvedValue(payout);

      vi.mocked(verifyOwnership).mockResolvedValue({
        valid: false,
        reason: 'Ownership mismatch',
        stripeAccountId: BAD_ACCT,
        expectedProviderId: PROVIDER,
      });

      await executePayout(payout.id, ADMIN);

      const updateCall = mockPrisma.payout.update.mock.calls.find(
        c => c[0]?.data?.status === 'FAILED'
      );
      expect(updateCall![0].data.retryCount).toEqual({ increment: 1 });
    });
  });

  // ─── D2: RETRY ────────────────────────────────────────────────────────────

  describe('D2 – Retry behaviour', () => {
    it('accepts FAILED status in the lock guard, so a failed payout is retryable', async () => {
      // Simulate a payout that was already FAILED (e.g. from a previous ownership failure)
      // The lock updateMany accepts ELIGIBLE or FAILED → returns count: 1
      const payout = makePayout({ status: 'FAILED', stripeAccountId: BAD_ACCT });
      mockPrisma.payout.updateMany.mockResolvedValue({ count: 1 }); // lock succeeds from FAILED
      mockPrisma.payout.findUnique.mockResolvedValue(payout);
      mockPrisma.payout.update.mockResolvedValue(payout);

      // Still mismatched → fails again
      vi.mocked(verifyOwnership).mockResolvedValue({
        valid: false,
        reason: 'Ownership mismatch persists',
        stripeAccountId: BAD_ACCT,
        expectedProviderId: PROVIDER,
      });

      const result = await executePayout(payout.id, ADMIN);
      expect(result.status).toBe('FAILED');

      // retryCount incremented again
      const updateCall = mockPrisma.payout.update.mock.calls.find(
        c => c[0]?.data?.status === 'FAILED'
      );
      expect(updateCall![0].data.retryCount).toEqual({ increment: 1 });
    });

    it('allows a legitimate retry to succeed once the account is corrected', async () => {
      // First call fails with wrong account
      const badPayout = makePayout({ stripeAccountId: BAD_ACCT });
      // Second call uses the corrected account (simulated by different findUnique return)
      const goodPayout = makePayout({ stripeAccountId: LEGIT_ACCT });

      // Both calls acquire the lock
      mockPrisma.payout.updateMany.mockResolvedValue({ count: 1 });

      // First call returns bad payout, second returns good payout
      mockPrisma.payout.findUnique
        .mockResolvedValueOnce(badPayout)
        .mockResolvedValueOnce(goodPayout);

      mockPrisma.payout.update.mockResolvedValue(goodPayout);

      // First verify fails, second passes
      vi.mocked(verifyOwnership)
        .mockResolvedValueOnce({
          valid: false,
          reason: 'Ownership mismatch',
          stripeAccountId: BAD_ACCT,
          expectedProviderId: PROVIDER,
        })
        .mockResolvedValueOnce({
          valid: true,
          stripeAccountId: LEGIT_ACCT,
          expectedProviderId: PROVIDER,
          actualProviderId: PROVIDER,
        });

      mockTransfersCreate.mockResolvedValue({
        id: 'tr_RETRY_OK', destination: LEGIT_ACCT,
      } as Stripe.Transfer);

      // First attempt fails
      const first = await executePayout(badPayout.id, ADMIN);
      expect(first.status).toBe('FAILED');
      expect(mockTransfersCreate).not.toHaveBeenCalled();

      // Second attempt with corrected account succeeds
      const second = await executePayout(goodPayout.id, ADMIN);
      expect(second.status).toBe('PAID');
      expect(mockTransfersCreate).toHaveBeenCalledTimes(1);
      expect(mockTransfersCreate.mock.calls[0][0].destination).toBe(LEGIT_ACCT);
    });
  });

  // ─── D3: IDEMPOTENCY ──────────────────────────────────────────────────────

  describe('D3 – Idempotency', () => {
    it('does not consume the Stripe idempotency key on an ownership failure', async () => {
      const payout = makePayout({ stripeAccountId: BAD_ACCT });
      mockPrisma.payout.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.payout.findUnique.mockResolvedValue(payout);
      mockPrisma.payout.update.mockResolvedValue(payout);

      vi.mocked(verifyOwnership).mockResolvedValue({
        valid: false,
        reason: 'Ownership mismatch',
        stripeAccountId: BAD_ACCT,
        expectedProviderId: PROVIDER,
      });

      await executePayout(payout.id, ADMIN);

      // stripe.transfers.create was never called, so idempotency key was never consumed
      expect(mockTransfersCreate).not.toHaveBeenCalled();
    });

    it('passes the payout idempotency key to the transfer on a successful retry', async () => {
      const payout = makePayout({ stripeAccountId: LEGIT_ACCT, idempotencyKey: 'idem-d-unique' });
      mockPrisma.payout.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.payout.findUnique.mockResolvedValue(payout);
      mockPrisma.payout.update.mockResolvedValue(payout);

      vi.mocked(verifyOwnership).mockResolvedValue({
        valid: true,
        stripeAccountId: LEGIT_ACCT,
        expectedProviderId: PROVIDER,
        actualProviderId: PROVIDER,
      });

      mockTransfersCreate.mockResolvedValue({
        id: 'tr_IDEM_OK', destination: LEGIT_ACCT,
      } as Stripe.Transfer);

      await executePayout(payout.id, ADMIN);

      // The second argument to transfers.create is the idempotency key wrapper
      const [, idempotencyArg] = mockTransfersCreate.mock.calls[0];
      expect(idempotencyArg).toEqual({ idempotencyKey: 'idem-d-unique' });
    });
  });

  // ─── D4: LEDGER CONSISTENCY ───────────────────────────────────────────────

  describe('D4 – Ledger consistency', () => {
    it('produces zero ledger entries when ownership verification fails', async () => {
      const payout = makePayout({ stripeAccountId: BAD_ACCT });
      mockPrisma.payout.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.payout.findUnique.mockResolvedValue(payout);
      mockPrisma.payout.update.mockResolvedValue(payout);

      vi.mocked(verifyOwnership).mockResolvedValue({
        valid: false,
        reason: 'Ownership mismatch',
        stripeAccountId: BAD_ACCT,
        expectedProviderId: PROVIDER,
      });

      await executePayout(payout.id, ADMIN);

      expect(mockAppendLedgerEntry).not.toHaveBeenCalled();
      expect(mockIncrementLedger).not.toHaveBeenCalled();
    });

    it('does produce ledger entries when a legitimate payout succeeds', async () => {
      const payout = makePayout({ stripeAccountId: LEGIT_ACCT });
      mockPrisma.payout.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.payout.findUnique.mockResolvedValue(payout);
      mockPrisma.payout.update.mockResolvedValue(payout);

      vi.mocked(verifyOwnership).mockResolvedValue({
        valid: true,
        stripeAccountId: LEGIT_ACCT,
        expectedProviderId: PROVIDER,
        actualProviderId: PROVIDER,
      });

      mockTransfersCreate.mockResolvedValue({
        id: 'tr_LEDGER_OK', destination: LEGIT_ACCT,
      } as Stripe.Transfer);

      await executePayout(payout.id, ADMIN);

      // At minimum one PAYOUT_PAID entry and one platform ledger update
      expect(mockAppendLedgerEntry).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'PAYOUT_PAID' })
      );
      expect(mockIncrementLedger).toHaveBeenCalledTimes(1);
    });
  });

  // ─── D5: ALERT / AUDIT TRAIL ──────────────────────────────────────────────

  describe('D5 – Alert and audit trail', () => {
    it('fires sendAlert with PAYOUT_FAILED severity CRITICAL on ownership mismatch', async () => {
      const payout = makePayout({ stripeAccountId: BAD_ACCT });
      mockPrisma.payout.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.payout.findUnique.mockResolvedValue(payout);
      mockPrisma.payout.update.mockResolvedValue(payout);

      vi.mocked(verifyOwnership).mockResolvedValue({
        valid: false,
        reason: `metadata.providerId='provider-attacker' !== expected='${PROVIDER}'`,
        stripeAccountId: BAD_ACCT,
        expectedProviderId: PROVIDER,
        actualProviderId: 'provider-attacker',
      });

      await executePayout(payout.id, ADMIN);

      // sendAlert is fired with void (fire-and-forget), wait a tick for it to settle
      await vi.runAllTimersAsync().catch(() => {});

      expect(mockSendAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type:     'PAYOUT_FAILED',
          severity: 'CRITICAL',
          entityId: payout.id,
          metadata: expect.objectContaining({
            payoutRef:     payout.payoutRef,
            providerId:    PROVIDER,
            failureReason: expect.stringMatching(/ownership.*verification.*failed/i),
          }),
        })
      );
    });

    it('includes the payout reference and provider ID in alert metadata', async () => {
      const payout = makePayout({ stripeAccountId: BAD_ACCT, payoutRef: 'PAYOUT-ALERT-TEST' });
      mockPrisma.payout.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.payout.findUnique.mockResolvedValue(payout);
      mockPrisma.payout.update.mockResolvedValue(payout);

      vi.mocked(verifyOwnership).mockResolvedValue({
        valid: false,
        reason: 'Ownership mismatch',
        stripeAccountId: BAD_ACCT,
        expectedProviderId: PROVIDER,
      });

      await executePayout(payout.id, ADMIN);

      const alertCall = mockSendAlert.mock.calls[0]?.[0];
      expect(alertCall?.metadata?.payoutRef).toBe('PAYOUT-ALERT-TEST');
      expect(alertCall?.metadata?.providerId).toBe(PROVIDER);
    });

    it('does not include Stripe secret keys or raw payment credentials in alert metadata', async () => {
      const payout = makePayout({ stripeAccountId: BAD_ACCT });
      mockPrisma.payout.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.payout.findUnique.mockResolvedValue(payout);
      mockPrisma.payout.update.mockResolvedValue(payout);

      vi.mocked(verifyOwnership).mockResolvedValue({
        valid: false,
        reason: 'Ownership mismatch',
        stripeAccountId: BAD_ACCT,
        expectedProviderId: PROVIDER,
      });

      await executePayout(payout.id, ADMIN);

      const alertCall = mockSendAlert.mock.calls[0]?.[0];
      const metadataStr = JSON.stringify(alertCall?.metadata ?? {});

      // Stripe secret keys start with sk_
      expect(metadataStr).not.toMatch(/sk_/);
      // Restricted keys start with rk_
      expect(metadataStr).not.toMatch(/rk_/);
      // No raw card numbers pattern
      expect(metadataStr).not.toMatch(/\b\d{13,19}\b/);
    });

    it('writes an audit log entry for PAYOUT_FAILED with success=false', async () => {
      const payout = makePayout({ stripeAccountId: BAD_ACCT });
      mockPrisma.payout.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.payout.findUnique.mockResolvedValue(payout);
      mockPrisma.payout.update.mockResolvedValue(payout);

      vi.mocked(verifyOwnership).mockResolvedValue({
        valid: false,
        reason: 'Ownership mismatch',
        stripeAccountId: BAD_ACCT,
        expectedProviderId: PROVIDER,
      });

      await executePayout(payout.id, ADMIN);

      const failedAuditEntry = mockPrisma.auditLog.create.mock.calls.find(
        c => c[0]?.data?.action === 'PAYOUT_FAILED'
      );
      expect(failedAuditEntry).toBeDefined();
      expect(failedAuditEntry![0].data.success).toBe(false);
      expect(failedAuditEntry![0].data.errorMessage).toMatch(/ownership.*verification.*failed/i);
    });
  });

  // ─── D6: CONCURRENCY LOCK ─────────────────────────────────────────────────

  describe('D6 – Concurrency lock', () => {
    it('returns current PROCESSING state immediately when lock is already held', async () => {
      // Simulate the payout being PROCESSING (lock held by another call)
      const processingPayout = makePayout({ status: 'PROCESSING' });

      mockPrisma.payout.updateMany.mockResolvedValue({ count: 0 }); // lock not acquired
      mockPrisma.payout.findUnique.mockResolvedValue(processingPayout);

      const result = await executePayout(processingPayout.id, ADMIN);

      // Returns the current state without attempting ownership check or transfer
      expect(result.status).toBe('PROCESSING');
      expect(verifyOwnership).not.toHaveBeenCalled();
      expect(mockTransfersCreate).not.toHaveBeenCalled();
      expect(mockAppendLedgerEntry).not.toHaveBeenCalled();
    });

    it('does not call ownership check or transfer when another execution holds the lock', async () => {
      const payout = makePayout({ status: 'PROCESSING' });

      mockPrisma.payout.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.payout.findUnique.mockResolvedValue(payout);

      await executePayout(payout.id, ADMIN);

      // Neither security-sensitive call was reached
      expect(verifyOwnership).not.toHaveBeenCalled();
      expect(mockTransfersCreate).not.toHaveBeenCalled();
    });

    it('first concurrent caller acquires lock; second caller observes PROCESSING and aborts cleanly', async () => {
      const payout = makePayout({ stripeAccountId: BAD_ACCT });
      const processingSnapshot = { ...payout, status: 'PROCESSING' };

      // First call acquires lock; second does not
      mockPrisma.payout.updateMany
        .mockResolvedValueOnce({ count: 1 })  // first caller gets the lock
        .mockResolvedValueOnce({ count: 0 }); // second caller is rejected

      // findUnique is called by:
      //   first caller  — after lock, to load the full payout
      //   second caller — to read current state when lock.count === 0
      // The first-caller load comes first sequentially; give second the PROCESSING snapshot.
      mockPrisma.payout.findUnique
        .mockResolvedValueOnce(payout)             // first caller: full load after lock
        .mockResolvedValueOnce(processingSnapshot); // second caller: current state read

      mockPrisma.payout.update.mockResolvedValue(payout);

      vi.mocked(verifyOwnership).mockResolvedValue({
        valid: false,
        reason: 'Ownership mismatch',
        stripeAccountId: BAD_ACCT,
        expectedProviderId: PROVIDER,
      });

      // Run sequentially so mock call order is deterministic
      const first  = await executePayout(payout.id, ADMIN);
      const second = await executePayout(payout.id, ADMIN);

      // First caller ran the ownership check and failed
      expect(first.status).toBe('FAILED');
      // Second caller saw the lock held and returned immediately with current state
      expect(second.status).toBe('PROCESSING');

      // Ownership check was called exactly once (by the first caller only)
      expect(verifyOwnership).toHaveBeenCalledTimes(1);
      // Transfer was never called by either
      expect(mockTransfersCreate).not.toHaveBeenCalled();
    });
  });
});
