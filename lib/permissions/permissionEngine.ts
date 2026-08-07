/**
 * permissionEngine.ts
 *
 * Pure capability rules — no React, no DB, no side effects.
 * Takes instructor state as input, returns boolean capability flags.
 *
 * Rules today:
 *   - Booking actions require APPROVED + active subscription
 *   - Read/explore actions are always allowed
 *
 * Extending later:
 *   - Add document expiry check to InstructorState → add to canCreateBooking rule
 *   - Add subscription tier checks → new capability flags (canUseAiReceptionist, etc.)
 *   - Add multi-instructor role → new InstructorState.role field
 *
 * The public API (InstructorState, Capabilities, getCapabilities) never changes
 * — callers don't need updates when rules evolve.
 */

// ── Input ─────────────────────────────────────────────────────────────────────

export interface InstructorState {
  /** Admin-controlled approval gate */
  approvalStatus: 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'REJECTED' | null;
  /** Stripe subscription state */
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED' | null;
  /** Whether the trial period has expired (pre-computed by caller) */
  trialExpired: boolean;
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
   * Instructors must be able to complete setup regardless of approval state.
   */
  canEditSetup: boolean;
}

// ── Engine ────────────────────────────────────────────────────────────────────

/**
 * Derive capability flags from instructor state.
 * Call this from usePermissions() — not directly from components.
 */
export function getCapabilities(state: InstructorState): Capabilities {
  const isApproved = state.approvalStatus === 'APPROVED';

  // Subscription is usable when ACTIVE, or on a non-expired TRIAL
  const hasActiveSubscription =
    state.subscriptionStatus === 'ACTIVE' ||
    (state.subscriptionStatus === 'TRIAL' && !state.trialExpired);

  // Booking actions require both approval and an active subscription
  const canAct = isApproved && hasActiveSubscription;

  return {
    canCreateBooking:        canAct,
    canCreateOfflineBooking: canAct,
    canSendClientReminder:   canAct,
    canCheckInOut:           canAct,
    canPublishProfile:       isApproved,   // subscription not required to be listed
    canReceivePayments:      canAct,
    canEditSetup:            true,          // always — setup must be completable
  };
}
