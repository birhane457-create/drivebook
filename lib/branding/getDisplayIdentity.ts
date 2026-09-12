/**
 * lib/branding/getDisplayIdentity.ts
 *
 * Display identity utilities — re-exports from lib/utils/account.ts plus
 * business-config-aware label helpers.
 *
 * Architecture:
 *   BASIC / PRO / STUDIO  = person-led  → businessName ?? name
 *   BUSINESS              = organisation-led → businessName (required)
 *
 * Two concepts kept permanently separate:
 *   Display identity  — customer-facing (booking page, SMS, email, AI)
 *   Legal identity    — internal only (payouts, ABN, tax, admin)
 *
 * Phase 4 change:
 *   getProviderLabel() no longer hardcodes "Driving School" / "Instructor".
 *   Labels now come from BusinessConfig.terminology, making this function
 *   generic across all business types.
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

// ── Types ─────────────────────────────────────────────────────────────────────

interface AccountLike {
  name: string
  businessName?: string | null
  subscriptionTier?: string | null
  accountType?: string | null
}

export type DisplayIdentitySource = AccountLike

import { getDisplayName } from '@/lib/utils/account'

// ── Provider label ────────────────────────────────────────────────────────────

/**
 * Returns a UI label + value pair for customer-facing "provider" displays.
 *
 * Labels come from BusinessConfig.terminology so they are correct for any
 * business type — driving school, tax agent, beauty studio, etc.
 *
 * Sync version: accepts terminology directly (use when you already have config).
 * Async version: getProviderLabelAsync() loads config automatically.
 *
 * Examples with driving terminology:
 *   BUSINESS  → { label: "Driving School", value: "Perth Drive Academy" }
 *   PRO       → { label: "Instructor",     value: "Dave Smith" }
 *
 * Examples with tax terminology:
 *   BUSINESS  → { label: "Practice",       value: "Smith Tax & Accounting" }
 *   PRO       → { label: "Tax Agent",      value: "Jane Smith" }
 */
export function getProviderLabel(
  account: AccountLike,
  terminology: { provider: string; providerGroup: string },
  assignedProviderName?: string
): { label: string; value: string; secondaryLabel?: string; secondaryValue?: string } {
  const isBusiness =
    account.subscriptionTier === 'PREMIUM' ||
    account.subscriptionTier === 'PREMIUM' ||
    account.accountType === 'BUSINESS'

  const base = {
    label: isBusiness ? terminology.providerGroup : terminology.provider,
    value: getDisplayName(account),
  }

  if (isBusiness && assignedProviderName) {
    return {
      ...base,
      secondaryLabel: `Your ${terminology.provider.toLowerCase()}`,
      secondaryValue: assignedProviderName,
    }
  }

  return base
}

/**
 * Async version of getProviderLabel — loads BusinessConfig automatically.
 * Use this in server components and API routes where you don't already
 * have the terminology object.
 */
export async function getProviderLabelAsync(
  account: AccountLike,
  options: { providerId?: string; assignedProviderName?: string } = {}
): Promise<{ label: string; value: string; secondaryLabel?: string; secondaryValue?: string }> {
  const { getTerminology } = await import('@/lib/core/business-config')
  const terminology = await getTerminology({ providerId: options.providerId })
  return getProviderLabel(account, terminology, options.assignedProviderName)
}

// ── Business name validation ──────────────────────────────────────────────────

/**
 * Validation helper — used in the branding API.
 * BUSINESS accounts must have a group/school name set.
 * Error message uses terminology from BusinessConfig.
 */
export async function validateBusinessName(
  account: Pick<AccountLike, 'subscriptionTier' | 'accountType' | 'businessName'>,
  options: { providerId?: string } = {}
): Promise<{ valid: boolean; error?: string }> {
  const isBusiness =
    account.subscriptionTier === 'PREMIUM' ||
    account.subscriptionTier === 'PREMIUM' ||
    account.accountType === 'BUSINESS'

  if (!isBusiness) return { valid: true }
  if (account.businessName?.trim()) return { valid: true }

  const { getTerminology } = await import('@/lib/core/business-config')
  const terminology = await getTerminology({ providerId: options.providerId })

  return {
    valid: false,
    error: `${terminology.providerGroup} name is required for Business accounts.`,
  }
}

/** Alias — for SMS/email sender name resolution */
export { getDisplayName as getSenderName } from '@/lib/utils/account'
