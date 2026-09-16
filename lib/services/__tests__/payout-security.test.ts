/**
 * Unit Tests: Payout Destination Ownership Verification (PAY-01)
 * 
 * Tests the verifyPayoutDestinationOwnership() helper in isolation.
 * Service-level integration test in pay-01-executePayout-security.test.ts
 */

import { describe, it, expect, vi } from 'vitest';
import { verifyPayoutDestinationOwnership } from '../payout-security';
import type Stripe from 'stripe';

describe('verifyPayoutDestinationOwnership', () => {
  const mockStripe = {
    accounts: {
      retrieve: vi.fn(),
    },
  } as unknown as Stripe;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes verification when metadata.providerId matches expected value', async () => {
    const stripeAccountId = 'acct_LEGIT123';
    const expectedProviderId = 'provider-alice';

    vi.mocked(mockStripe.accounts.retrieve).mockResolvedValue({
      id: stripeAccountId,
      metadata: { providerId: expectedProviderId },
    } as Stripe.Account);

    const result = await verifyPayoutDestinationOwnership(
      mockStripe,
      stripeAccountId,
      expectedProviderId
    );

    expect(result.valid).toBe(true);
    expect(result.stripeAccountId).toBe(stripeAccountId);
    expect(result.expectedProviderId).toBe(expectedProviderId);
    expect(result.actualProviderId).toBe(expectedProviderId);
    expect(result.reason).toBeUndefined();
  });

  it('fails verification when metadata.providerId does not match (account substitution)', async () => {
    const stripeAccountId = 'acct_ATTACKER456';
    const expectedProviderId = 'provider-alice';
    const actualProviderId = 'provider-attacker';

    vi.mocked(mockStripe.accounts.retrieve).mockResolvedValue({
      id: stripeAccountId,
      metadata: { providerId: actualProviderId },
    } as Stripe.Account);

    const result = await verifyPayoutDestinationOwnership(
      mockStripe,
      stripeAccountId,
      expectedProviderId
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Ownership mismatch');
    expect(result.reason).toContain(actualProviderId);
    expect(result.reason).toContain(expectedProviderId);
    expect(result.stripeAccountId).toBe(stripeAccountId);
    expect(result.expectedProviderId).toBe(expectedProviderId);
    expect(result.actualProviderId).toBe(actualProviderId);
  });

  it('fails closed when metadata.providerId is missing', async () => {
    const stripeAccountId = 'acct_NOMETA789';
    const expectedProviderId = 'provider-alice';

    vi.mocked(mockStripe.accounts.retrieve).mockResolvedValue({
      id: stripeAccountId,
      metadata: {}, // No providerId
    } as Stripe.Account);

    const result = await verifyPayoutDestinationOwnership(
      mockStripe,
      stripeAccountId,
      expectedProviderId
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('missing metadata.providerId');
    expect(result.stripeAccountId).toBe(stripeAccountId);
    expect(result.expectedProviderId).toBe(expectedProviderId);
    expect(result.actualProviderId).toBeUndefined();
  });

  it('fails closed when metadata object is missing entirely', async () => {
    const stripeAccountId = 'acct_NOMETA999';
    const expectedProviderId = 'provider-alice';

    vi.mocked(mockStripe.accounts.retrieve).mockResolvedValue({
      id: stripeAccountId,
      // No metadata field at all
    } as Stripe.Account);

    const result = await verifyPayoutDestinationOwnership(
      mockStripe,
      stripeAccountId,
      expectedProviderId
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('missing metadata.providerId');
  });

  it('fails closed when Stripe account does not exist', async () => {
    const stripeAccountId = 'acct_NOTFOUND404';
    const expectedProviderId = 'provider-alice';

    vi.mocked(mockStripe.accounts.retrieve).mockResolvedValue(
      null as unknown as Stripe.Account
    );

    const result = await verifyPayoutDestinationOwnership(
      mockStripe,
      stripeAccountId,
      expectedProviderId
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not found or invalid');
    expect(result.stripeAccountId).toBe(stripeAccountId);
    expect(result.expectedProviderId).toBe(expectedProviderId);
  });

  it('fails closed on Stripe API errors', async () => {
    const stripeAccountId = 'acct_ERROR500';
    const expectedProviderId = 'provider-alice';

    vi.mocked(mockStripe.accounts.retrieve).mockRejectedValue(
      new Error('Stripe API unavailable')
    );

    const result = await verifyPayoutDestinationOwnership(
      mockStripe,
      stripeAccountId,
      expectedProviderId
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Stripe API error');
    expect(result.reason).toContain('unavailable');
    expect(result.stripeAccountId).toBe(stripeAccountId);
    expect(result.expectedProviderId).toBe(expectedProviderId);
  });

  it('requires exact string match (no type coercion)', async () => {
    const stripeAccountId = 'acct_TYPECHECK';
    const expectedProviderId = 'provider-123';

    // Simulate metadata with numeric providerId (wrong type)
    vi.mocked(mockStripe.accounts.retrieve).mockResolvedValue({
      id: stripeAccountId,
      metadata: { providerId: '123' }, // Different from 'provider-123'
    } as Stripe.Account);

    const result = await verifyPayoutDestinationOwnership(
      mockStripe,
      stripeAccountId,
      expectedProviderId
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Ownership mismatch');
    expect(result.actualProviderId).toBe('123');
    expect(result.expectedProviderId).toBe('provider-123');
  });
});
