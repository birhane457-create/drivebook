/**
 * Tests for lib/services/subscription-cancel.ts
 *
 * Invariants under test:
 *   SUB-09-A / SUB-10-A — Stripe-first cancellation
 *     1. Happy path period_end: Stripe update called, DB updated after
 *     2. Happy path immediate: Stripe cancel called, DB + provider updated
 *     3. Stripe failure: throws, DB is NOT updated (no split-brain)
 *     4. No stripeSubscriptionId: DB-only, no Stripe call
 *     5. Already cancelled (idempotent): returns without error
 *     6. No active subscription: returns gracefully
 */

// ── Mock Prisma ─────────────────────────────────────────────────────────────
// vi.mock() is hoisted to the top of the file by Vitest.
// Variables used inside the factory must be created with vi.hoisted() so they
// are available before the mock factory runs.
const {
  mockSubscriptionFindFirst,
  mockSubscriptionUpdate,
  mockProviderUpdate,
  mockTransaction,
  mockLogSubscriptionAction,
} = vi.hoisted(() => ({
  mockSubscriptionFindFirst: vi.fn(),
  mockSubscriptionUpdate:    vi.fn(),
  mockProviderUpdate:        vi.fn(),
  mockTransaction:           vi.fn(),
  mockLogSubscriptionAction: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findFirst: mockSubscriptionFindFirst,
    },
    provider: {
      update: mockProviderUpdate,
    },
    $transaction: mockTransaction,
  },
}));

vi.mock('@/lib/services/auditLogger', () => ({
  logSubscriptionAction: mockLogSubscriptionAction,
  AuditAction: { SUBSCRIPTION_CANCELLED: 'SUBSCRIPTION_CANCELLED' },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// ── Mock Stripe ──────────────────────────────────────────────────────────────
const { mockStripeSubscriptionsUpdate, mockStripeSubscriptionsCancel } = vi.hoisted(() => ({
  mockStripeSubscriptionsUpdate: vi.fn(),
  mockStripeSubscriptionsCancel: vi.fn(),
}));

vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      subscriptions: {
        update: mockStripeSubscriptionsUpdate,
        cancel: mockStripeSubscriptionsCancel,
      },
    })),
  };
});

// Set env var so getStripe() doesn't throw
process.env.STRIPE_SECRET_KEY = 'sk_test_mock';

import { cancelSubscription } from '../subscription-cancel';

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_local_001',
    providerId: 'prov_001',
    status: 'ACTIVE',
    stripeSubscriptionId: 'sub_stripe_001',
    currentPeriodEnd: new Date('2026-09-01'),
    cancelAtPeriodEnd: false,
    ...overrides,
  };
}

/** Make $transaction execute the callback synchronously */
function setupTransactionPassthrough() {
  mockTransaction.mockImplementation(async (fn: Function) => fn({
    subscription: { update: mockSubscriptionUpdate },
    provider:     { update: mockProviderUpdate },
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  setupTransactionPassthrough();
  mockLogSubscriptionAction.mockResolvedValue(undefined);
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('cancelSubscription — SUB-09-A / SUB-10-A', () => {

  describe('1. Happy path — period_end', () => {
    it('calls Stripe update before touching the DB', async () => {
      const sub = makeSubscription();
      mockSubscriptionFindFirst.mockResolvedValue(sub);
      mockStripeSubscriptionsUpdate.mockResolvedValue({});
      mockSubscriptionUpdate.mockResolvedValue({ ...sub, cancelAtPeriodEnd: true });

      const result = await cancelSubscription({
        providerId: 'prov_001',
        mode: 'period_end',
        actorEmail: 'instructor@test.com',
      });

      // Stripe must be called
      expect(mockStripeSubscriptionsUpdate).toHaveBeenCalledOnce();
      expect(mockStripeSubscriptionsUpdate).toHaveBeenCalledWith(
        'sub_stripe_001',
        expect.objectContaining({ cancel_at_period_end: true }),
      );

      // DB must be updated after Stripe
      expect(mockSubscriptionUpdate).toHaveBeenCalledOnce();
      expect(mockSubscriptionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ cancelAtPeriodEnd: true }),
        }),
      );

      // Provider NOT updated for period_end (access continues until period end)
      expect(mockProviderUpdate).not.toHaveBeenCalled();

      expect(result.stripeAction).toBe('cancelled_in_stripe');
    });
  });

  describe('2. Happy path — immediate', () => {
    it('calls Stripe cancel and updates both subscription and provider', async () => {
      const sub = makeSubscription();
      mockSubscriptionFindFirst.mockResolvedValue(sub);
      mockStripeSubscriptionsCancel.mockResolvedValue({});
      mockSubscriptionUpdate.mockResolvedValue({ ...sub, status: 'CANCELLED' });
      mockProviderUpdate.mockResolvedValue({});

      const result = await cancelSubscription({
        providerId: 'prov_001',
        mode: 'immediate',
        actorEmail: 'admin@test.com',
      });

      expect(mockStripeSubscriptionsCancel).toHaveBeenCalledWith('sub_stripe_001');
      expect(mockSubscriptionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CANCELLED', cancelledAt: expect.any(Date) }),
        }),
      );
      expect(mockProviderUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ subscriptionStatus: 'CANCELLED' }),
        }),
      );
      expect(result.stripeAction).toBe('cancelled_in_stripe');
    });
  });

  describe('3. Stripe failure — DB must NOT be updated (no split-brain)', () => {
    it('throws and leaves DB untouched when Stripe update fails', async () => {
      const sub = makeSubscription();
      mockSubscriptionFindFirst.mockResolvedValue(sub);

      const stripeErr = Object.assign(new Error('Stripe network error'), {
        type: 'StripeConnectionError',
      });
      mockStripeSubscriptionsUpdate.mockRejectedValue(stripeErr);

      await expect(
        cancelSubscription({ providerId: 'prov_001', mode: 'period_end', actorEmail: 'x@x.com' }),
      ).rejects.toThrow('Stripe network error');

      // DB must NOT have been touched
      expect(mockSubscriptionUpdate).not.toHaveBeenCalled();
      expect(mockProviderUpdate).not.toHaveBeenCalled();
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('throws and leaves DB untouched when Stripe immediate cancel fails', async () => {
      const sub = makeSubscription();
      mockSubscriptionFindFirst.mockResolvedValue(sub);
      mockStripeSubscriptionsCancel.mockRejectedValue(new Error('Card declined'));

      await expect(
        cancelSubscription({ providerId: 'prov_001', mode: 'immediate', actorEmail: 'x@x.com' }),
      ).rejects.toThrow('Card declined');

      expect(mockSubscriptionUpdate).not.toHaveBeenCalled();
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  describe('4. No stripeSubscriptionId — DB-only, no Stripe call', () => {
    it('skips Stripe entirely for a trial-only subscription', async () => {
      const sub = makeSubscription({ stripeSubscriptionId: null, status: 'TRIAL' });
      mockSubscriptionFindFirst.mockResolvedValue(sub);
      mockSubscriptionUpdate.mockResolvedValue({ ...sub, cancelAtPeriodEnd: true });

      const result = await cancelSubscription({
        providerId: 'prov_001',
        mode: 'period_end',
        actorEmail: 'instructor@test.com',
      });

      expect(mockStripeSubscriptionsUpdate).not.toHaveBeenCalled();
      expect(mockStripeSubscriptionsCancel).not.toHaveBeenCalled();
      expect(mockSubscriptionUpdate).toHaveBeenCalledOnce();
      expect(result.stripeAction).toBe('local_only_no_stripe_id');
    });
  });

  describe('5. Idempotent — already scheduled to cancel', () => {
    it('returns success without calling Stripe or DB again', async () => {
      const sub = makeSubscription({ cancelAtPeriodEnd: true });
      mockSubscriptionFindFirst.mockResolvedValue(sub);

      const result = await cancelSubscription({
        providerId: 'prov_001',
        mode: 'period_end',
        actorEmail: 'instructor@test.com',
      });

      expect(mockStripeSubscriptionsUpdate).not.toHaveBeenCalled();
      expect(mockSubscriptionUpdate).not.toHaveBeenCalled();
      expect(result.stripeAction).toBe('already_cancelled');
    });
  });

  describe('6. No active subscription', () => {
    it('returns gracefully when nothing to cancel', async () => {
      mockSubscriptionFindFirst.mockResolvedValue(null);

      const result = await cancelSubscription({
        providerId: 'prov_001',
        mode: 'period_end',
        actorEmail: 'instructor@test.com',
      });

      expect(mockStripeSubscriptionsUpdate).not.toHaveBeenCalled();
      expect(result.stripeAction).toBe('already_cancelled');
      expect(result.success).toBe(true);
    });
  });

  describe('Audit log failure is non-critical', () => {
    it('succeeds even when audit log throws', async () => {
      const sub = makeSubscription({ stripeSubscriptionId: null, status: 'TRIAL' });
      mockSubscriptionFindFirst.mockResolvedValue(sub);
      mockSubscriptionUpdate.mockResolvedValue({});
      mockLogSubscriptionAction.mockRejectedValue(new Error('Audit DB down'));

      // Should not throw
      const result = await cancelSubscription({
        providerId: 'prov_001',
        mode: 'period_end',
        actorEmail: 'instructor@test.com',
      });

      expect(result.success).toBe(true);
    });
  });
});
