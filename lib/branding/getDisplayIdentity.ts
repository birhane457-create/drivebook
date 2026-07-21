/**
 * lib/branding/getDisplayIdentity.ts
 *
 * Central export point for display identity utilities.
 * Core logic lives in lib/utils/account.ts — re-exported here for
 * import convenience and to keep the branding/ namespace clean.
 *
 * Architecture:
 *   BASIC / PRO / STUDIO  = person-led  → businessName ?? name
 *   BUSINESS              = organisation-led → businessName (required)
 *
 * Two concepts kept permanently separate:
 *   Display identity  — student-facing (booking page, SMS, email, AI)
 *   Legal identity    — internal only (payouts, ABN, tax, admin)
 *
 * Usage:
 *   import { getDisplayName, getProviderLabel } from '@/lib/branding/getDisplayIdentity'
 */

export {
  getDisplayName,
  getAccountFeatures,
  getPaymentMode,
  assertPlatformPaymentMode,
  type AccountType,
  type PaymentMode,
  type AccountFeatures,
} from '@/lib/utils/account'

// ── Additional identity helpers not in account.ts ─────────────────────────────

interface AccountLike {
  name: string
  businessName?: string | null
  subscriptionTier?: string | null
  accountType?: string | null
}

import { getDisplayName } from '@/lib/utils/account'

/**
 * Returns a UI label + value pair for student-facing "provider" displays.
 *
 * Examples:
 *   BUSINESS  → { label: "Driving School", value: "Perth Drive Academy" }
 *   PRO       → { label: "Instructor",     value: "Dave Smith" }
 *
 * Future multi-instructor: pass `assignedInstructorName` to get the
 * secondary "Your instructor: Sarah" line without changing the school name.
 */
export function getProviderLabel(
  account: AccountLike,
  assignedInstructorName?: string
): { label: string; value: string; secondaryLabel?: string; secondaryValue?: string } {
  const isBusiness =
    account.subscriptionTier === 'BUSINESS' ||
    account.accountType === 'BUSINESS'

  const base = {
    label: isBusiness ? 'Driving School' : 'Instructor',
    value: getDisplayName(account),
  }

  if (isBusiness && assignedInstructorName) {
    return { ...base, secondaryLabel: 'Your instructor', secondaryValue: assignedInstructorName }
  }

  return base
}

/**
 * Validation helper — used in the branding API.
 * BUSINESS accounts must have a school name set.
 */
export function validateBusinessName(
  account: Pick<AccountLike, 'subscriptionTier' | 'accountType' | 'businessName'>
): { valid: boolean; error?: string } {
  const isBusiness =
    account.subscriptionTier === 'BUSINESS' ||
    account.accountType === 'BUSINESS'

  if (isBusiness && !account.businessName?.trim()) {
    return {
      valid: false,
      error: 'School name is required for Business accounts.',
    }
  }

  return { valid: true }
}

/** Alias — for SMS/email sender name resolution */
export { getDisplayName as getSenderName } from '@/lib/utils/account'

/** Type alias for call sites that import from this module */
export type DisplayIdentitySource = AccountLike
