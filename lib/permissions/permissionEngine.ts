/**
 * permissionEngine.ts
 *
 * Pure capability rules — no React, no DB, no side effects.
 * Takes provider state as input, returns boolean capability flags.
 *
 * Rules:
 *   - Booking actions require APPROVED + active subscription
 *   - Read/explore actions are always allowed
 *   - Tier-based features gate on subscriptionTier
 *   - Multi-provider role is future (BUSINESS tier, not yet implemented)
 *
 * The public API (ProviderState, Capabilities, getCapabilities) never changes
 * — callers don't need updates when rules evolve.
 */

// ── Input ─────────────────────────────────────────────────────────────────────

export interface ProviderState {
  /** Admin-controlled approval gate */
  approvalStatus: 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'REJECTED' | null;
  /** Stripe subscription state */
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED' | null;
  /** Whether the trial period has expired (pre-computed by caller) */
  trialExpired: boolean;
  /** Subscription tier — optional, defaults to BASIC if not supplied */
  subscriptionTier?: string | null;
}

// ── Output ────────────────────────────────────────────────────────────────────

export interface Capabilities {
  /** Create a platform booking (wallet-charged) */
  canCreateBooking: boolean;
  /** Log an offline / cash booking */
  canCreateOfflineBooking: boolean;
  /** Send SMS reminder to a client */
  canSendClientReminder: boolean;
  /** Check in or check out of a booking */
  canCheckInOut: boolean;
  /** Publish profile to the student marketplace */
  canPublishProfile: boolean;
  /** Receive live booking payments */
  canReceivePayments: boolean;
  /**
   * Edit profile, settings, documents, availability — always true.
   * Providers must be able to complete setup regardless of approval state.
   */
  canEditSetup: boolean;

  // ── Tier-gated features ───────────────────────────────────────────────────
  /** PRO+: AI receptionist dedicated phone line */
  canUseAiReceptionist: boolean;
  /** PRO+: custom slug (name.drivebook.com.au) */
  canUseCustomSlug: boolean;
  /** STUDIO+: bring-your-own custom domain */
  canUseCustomDomain: boolean;
  /** PREMIUM: full white-label — business name on all public surfaces */
  canUseWhiteLabel: boolean;
  /**
   * PREMIUM + phase 2: direct Stripe Connect payments (0% commission).
   * Currently always false — blocked by assertPlatformPaymentMode().
   * Flip to true when DIRECT mode is implemented.
   */
  canUseDirectPayments: boolean;
}

// ── Engine ────────────────────────────────────────────────────────────────────

/**
 * Derive capability flags from provider state.
 * Call this from usePermissions() — not directly from components.
 */
export function getCapabilities(state: ProviderState): Capabilities {
  const isApproved = state.approvalStatus === 'APPROVED';

  // Subscription is usable when ACTIVE, or on a non-expired TRIAL
  const hasActiveSubscription =
    state.subscriptionStatus === 'ACTIVE' ||
    (state.subscriptionStatus === 'TRIAL' && !state.trialExpired);

  // Booking actions require both approval and an active subscription
  const canAct = isApproved && hasActiveSubscription;

  // Tier hierarchy
  // IMPORTANT: subscriptionTier (BASIC/PRO/STUDIO/PREMIUM) is different from accountType (INDIVIDUAL/BUSINESS)
  // BUSINESS is kept as a legacy alias for PREMIUM — any old DB records with tier='BUSINESS' behave identically to PREMIUM
  const tier = (state.subscriptionTier ?? 'BASIC').toUpperCase();
  const isPro     = ['PRO', 'STUDIO', 'PREMIUM', 'BUSINESS'].includes(tier); // BUSINESS = legacy PREMIUM
  const isStudio  = ['STUDIO', 'PREMIUM', 'BUSINESS'].includes(tier);        // BUSINESS = legacy PREMIUM
  const isPremium = ['PREMIUM', 'BUSINESS'].includes(tier);                  // BUSINESS = legacy PREMIUM

  return {
    // Subscription-gated actions
    canCreateBooking:        canAct,
    canCreateOfflineBooking: canAct,
    canSendClientReminder:   canAct,
    canCheckInOut:           canAct,
    canPublishProfile:       isApproved,   // subscription not required to be listed
    canReceivePayments:      canAct,
    canEditSetup:            true,          // always — setup must be completable

    // Tier-gated features
    canUseAiReceptionist:  isPro,
    canUseCustomSlug:      isPro,
    canUseCustomDomain:    isStudio,
    canUseWhiteLabel:      isPremium,
    canUseDirectPayments:  false,           // phase 2 — not yet implemented
  };
}
