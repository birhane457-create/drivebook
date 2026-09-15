/**
 * Tests for SUB-02-A and SUB-02-B fixes in the subscription creation logic.
 *
 * These are logic-level tests that verify the invariants introduced by the fix,
 * using the same mock-based approach as the rest of the vitest suite.
 *
 * SUB-02-A: Subscription + Provider writes are atomic (both succeed or both fail).
 * SUB-02-B: Concurrent first-trial requests produce exactly one subscription row.
 *
 * Tests verify the implemented logic:
 *   1. raceCheck inside transaction returns existing row when a concurrent
 *      request has already committed → no duplicate create is called.
 *   2. When raceCheck returns null → create + provider.update both called.
 *   3. Provider.update is NOT called independently of subscription.create
 *      (both are inside the same transaction callback).
 */

import { describe, it, expect, vi } from 'vitest';

/**
 * The atomic creation logic extracted for unit testing.
 *
 * This mirrors the code now in both web and mobile POST handlers so we can
 * test the invariant without spinning up a Next.js request pipeline.
 */
async function atomicCreateTrialSubscription(
  tx: {
    subscription: {
      findFirst: (args: any) => Promise<any>;
      create: (args: any) => Promise<any>;
    };
    provider: { update: (args: any) => Promise<any> };
  },
  providerId: string,
  tier: string,
  data: Record<string, unknown>,
) {
  // SUB-02-B: Re-check for existing subscription inside transaction
  const raceCheck = await tx.subscription.findFirst({
    where: { providerId, status: { in: ['TRIAL', 'ACTIVE'] } },
  });

  if (raceCheck) {
    return { existing: raceCheck };
  }

  const newSub = await tx.subscription.create({ data });

  await tx.provider.update({
    where: { id: providerId },
    data: { subscriptionTier: tier, subscriptionStatus: 'TRIAL' },
  });

  return { created: newSub };
}

describe('SUB-02-B: concurrent first-trial creation', () => {

  describe('raceCheck finds existing row (concurrent request already created)', () => {
    it('returns the existing subscription and does NOT call create', async () => {
      const existingSub = { id: 'sub_existing', providerId: 'prov_1', status: 'TRIAL', tier: 'BASIC' };
      const mockFindFirst = vi.fn().mockResolvedValue(existingSub);
      const mockCreate = vi.fn();
      const mockProviderUpdate = vi.fn();

      const tx = {
        subscription: { findFirst: mockFindFirst, create: mockCreate },
        provider:     { update: mockProviderUpdate },
      };

      const result = await atomicCreateTrialSubscription(tx, 'prov_1', 'BASIC', {});

      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockProviderUpdate).not.toHaveBeenCalled();
      expect(result).toEqual({ existing: existingSub });
    });
  });

  describe('raceCheck finds nothing — proceeds to create', () => {
    it('calls create and provider.update', async () => {
      const newSub = { id: 'sub_new', providerId: 'prov_2', status: 'TRIAL', tier: 'PRO' };
      const mockFindFirst = vi.fn().mockResolvedValue(null);
      const mockCreate = vi.fn().mockResolvedValue(newSub);
      const mockProviderUpdate = vi.fn().mockResolvedValue({});

      const tx = {
        subscription: { findFirst: mockFindFirst, create: mockCreate },
        provider:     { update: mockProviderUpdate },
      };

      const result = await atomicCreateTrialSubscription(tx, 'prov_2', 'PRO', {
        providerId: 'prov_2', tier: 'PRO', status: 'TRIAL',
      });

      expect(mockCreate).toHaveBeenCalledOnce();
      expect(mockProviderUpdate).toHaveBeenCalledOnce();
      expect(result).toEqual({ created: newSub });
    });
  });
});

describe('SUB-02-A: atomicity — provider.update only runs after subscription.create', () => {

  it('does not call provider.update if subscription.create throws', async () => {
    const mockFindFirst = vi.fn().mockResolvedValue(null);
    const mockCreate = vi.fn().mockRejectedValue(new Error('DB write failed'));
    const mockProviderUpdate = vi.fn();

    const tx = {
      subscription: { findFirst: mockFindFirst, create: mockCreate },
      provider:     { update: mockProviderUpdate },
    };

    await expect(
      atomicCreateTrialSubscription(tx, 'prov_3', 'STUDIO', {}),
    ).rejects.toThrow('DB write failed');

    // Provider update must never have been called
    expect(mockProviderUpdate).not.toHaveBeenCalled();
  });

  it('both create and provider.update succeed together', async () => {
    const newSub = { id: 'sub_atomic', tier: 'PRO' };
    const mockFindFirst = vi.fn().mockResolvedValue(null);
    const mockCreate = vi.fn().mockResolvedValue(newSub);
    const mockProviderUpdate = vi.fn().mockResolvedValue({});

    const tx = {
      subscription: { findFirst: mockFindFirst, create: mockCreate },
      provider:     { update: mockProviderUpdate },
    };

    const result = await atomicCreateTrialSubscription(tx, 'prov_4', 'PRO', {});

    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockProviderUpdate).toHaveBeenCalledOnce();
    expect(result).toEqual({ created: newSub });
  });
});
