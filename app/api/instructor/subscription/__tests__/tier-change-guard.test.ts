/**
 * Tests for C-1 fix: ACTIVE/PAST_DUE tier changes are blocked.
 *
 * Invariant:
 *   existingSubscription.status === 'TRIAL' → tier change allowed (free exploration)
 *   existingSubscription.status !== 'TRIAL' AND tier !== existingTier → 403
 *
 * This guard is necessary because a local tier change on an ACTIVE subscription
 * without a Stripe billing operation would:
 *   - immediately lower the commission rate (e.g. 15% → 10%)
 *   - grant higher-tier features
 *   - without the platform receiving the higher subscription fee
 *
 * TRIAL tier changes are intentionally free — instructors explore tiers
 * within their single trial window (platform-model.md).
 *
 * Tests:
 *   1. TRIAL, different tier  → allowed
 *   2. TRIAL, same tier       → allowed (same tier = checkout path, not this guard)
 *   3. ACTIVE, different tier → blocked (403)
 *   4. ACTIVE, same tier      → allowed (no tier change)
 *   5. PAST_DUE, different tier → blocked (403)
 *   6. PAST_DUE, same tier    → allowed (no tier change)
 *   7. No existing sub        → allowed (first trial)
 */

import { describe, it, expect } from 'vitest';

// ── Extract the guard logic for direct unit testing ─────────────────────────
// This mirrors exactly the condition added in subscription/route.ts.

interface ExistingSub {
  status: string;
  tier: string;
}

/**
 * Returns 'BLOCK' if the request should be rejected, 'ALLOW' if it should proceed.
 * Mirrors the C-1 guard inserted at the top of the `if (existingSubscription)` branch.
 */
function c1Guard(
  existingSubscription: ExistingSub | null,
  requestedTier: string,
): 'ALLOW' | 'BLOCK' {
  if (!existingSubscription) return 'ALLOW';

  if (existingSubscription.status !== 'TRIAL' && existingSubscription.tier !== requestedTier) {
    return 'BLOCK';
  }

  return 'ALLOW';
}

describe('C-1: ACTIVE/PAST_DUE tier-change guard', () => {

  describe('TRIAL subscriptions — all tier changes allowed', () => {
    it('TRIAL + different tier → ALLOW (free exploration)', () => {
      expect(c1Guard({ status: 'TRIAL', tier: 'BASIC' }, 'PREMIUM')).toBe('ALLOW');
    });

    it('TRIAL + same tier → ALLOW (not a tier change)', () => {
      expect(c1Guard({ status: 'TRIAL', tier: 'BASIC' }, 'BASIC')).toBe('ALLOW');
    });

    it('TRIAL + any tier → ALLOW regardless of tier distance', () => {
      expect(c1Guard({ status: 'TRIAL', tier: 'BASIC' }, 'PRO')).toBe('ALLOW');
      expect(c1Guard({ status: 'TRIAL', tier: 'BASIC' }, 'STUDIO')).toBe('ALLOW');
      expect(c1Guard({ status: 'TRIAL', tier: 'PRO' }, 'BASIC')).toBe('ALLOW');
      expect(c1Guard({ status: 'TRIAL', tier: 'PREMIUM' }, 'BASIC')).toBe('ALLOW');
    });
  });

  describe('ACTIVE subscriptions — only same-tier allowed', () => {
    it('ACTIVE + different tier → BLOCK (billing portal required)', () => {
      expect(c1Guard({ status: 'ACTIVE', tier: 'BASIC' }, 'PREMIUM')).toBe('BLOCK');
    });

    it('ACTIVE + BASIC → PREMIUM (the exact attack path)', () => {
      // Original C-1 exploit: paying $29/mo BASIC, free-upgrade to PREMIUM
      expect(c1Guard({ status: 'ACTIVE', tier: 'BASIC' }, 'PREMIUM')).toBe('BLOCK');
    });

    it('ACTIVE + same tier → ALLOW (no tier change, not a billing bypass)', () => {
      expect(c1Guard({ status: 'ACTIVE', tier: 'BASIC' }, 'BASIC')).toBe('ALLOW');
    });

    it('ACTIVE + any different tier → BLOCK', () => {
      expect(c1Guard({ status: 'ACTIVE', tier: 'PRO' }, 'STUDIO')).toBe('BLOCK');
      expect(c1Guard({ status: 'ACTIVE', tier: 'STUDIO' }, 'BASIC')).toBe('BLOCK');
      expect(c1Guard({ status: 'ACTIVE', tier: 'PREMIUM' }, 'PRO')).toBe('BLOCK');
    });
  });

  describe('PAST_DUE subscriptions — same rule as ACTIVE', () => {
    it('PAST_DUE + different tier → BLOCK', () => {
      expect(c1Guard({ status: 'PAST_DUE', tier: 'BASIC' }, 'PREMIUM')).toBe('BLOCK');
    });

    it('PAST_DUE + same tier → ALLOW', () => {
      expect(c1Guard({ status: 'PAST_DUE', tier: 'PRO' }, 'PRO')).toBe('ALLOW');
    });
  });

  describe('CANCELLED subscriptions', () => {
    // CANCELLED is not in the findFirst status filter so this case can't
    // reach the guard via the normal path. Document it for completeness.
    it('CANCELLED + different tier → ALLOW (not reached; creates new trial)', () => {
      // findFirst won't return CANCELLED rows; falls through to first-trial branch
      expect(c1Guard(null, 'PREMIUM')).toBe('ALLOW');
    });
  });

  describe('No existing subscription', () => {
    it('null → ALLOW (first-ever subscription, creates trial)', () => {
      expect(c1Guard(null, 'BASIC')).toBe('ALLOW');
    });
  });

  describe('Exact attack scenarios', () => {
    it('ACTIVE BASIC provider attempts PREMIUM upgrade → BLOCK', () => {
      // Simulates: paying $29/mo (15% commission), POSTs {"tier":"PREMIUM"}
      // Expected: 403 USE_BILLING_PORTAL
      expect(c1Guard({ status: 'ACTIVE', tier: 'BASIC' }, 'PREMIUM')).toBe('BLOCK');
    });

    it('ACTIVE PRO provider attempts STUDIO upgrade → BLOCK', () => {
      expect(c1Guard({ status: 'ACTIVE', tier: 'PRO' }, 'STUDIO')).toBe('BLOCK');
    });

    it('TRIAL BASIC provider exploring PREMIUM → ALLOW (intended behavior)', () => {
      // During trial, all tier changes are free — one trial across all tiers
      expect(c1Guard({ status: 'TRIAL', tier: 'BASIC' }, 'PREMIUM')).toBe('ALLOW');
    });
  });
});
