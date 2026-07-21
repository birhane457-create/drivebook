/**
 * Account utilities — display identity, feature flags, and payment mode.
 *
 * RULES:
 *   - Never use instructor.name directly for customer-facing content.
 *     Always use getDisplayName(instructor).
 *   - Never check plan === 'BUSINESS' directly in product code.
 *     Always use getAccountFeatures(instructor).featureName.
 *   - Never create a Stripe charge without checking getPaymentMode(instructor).
 *
 * Phase 2 work lives behind these abstractions.
 * Today: all defaults. Tomorrow: flip flags per account.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type AccountType = 'INDIVIDUAL' | 'BUSINESS'
export type PaymentMode = 'PLATFORM' | 'DIRECT'

export interface AccountFeatures {
  /** Full white-label — no DriveBook branding on any customer-facing surface */
  whiteLabel: boolean
  /** Direct Stripe charges — money goes straight to school's account, not DriveBook */
  directPayments: boolean
  /** Multiple instructors under one account */
  multiInstructor: boolean
  /** Dedicated AI receptionist phone number */
  aiReceptionist: boolean
  /** Custom subdomain slug (name.drivebook.com.au) */
  customSlug: boolean
  /** Custom domain (yourdomain.com.au) */
  customDomain: boolean
  /** Display/business name override on customer-facing surfaces */
  displayName: boolean
}

// Minimal shape required — any object with these fields works
interface AccountLike {
  name: string
  businessName?: string | null
  subscriptionTier?: string | null
  accountType?: string | null
}

// ── Display identity ──────────────────────────────────────────────────────────

/**
 * Returns the name to show on all customer-facing surfaces:
 * booking pages, AI receptionist, SMS, emails, receipts.
 *
 * Priority: businessName (if set) → instructor.name
 *
 * This is the ONLY function that should resolve a display name.
 * Do NOT use instructor.name directly in customer-facing code.
 */
export function getDisplayName(account: AccountLike): string {
  return account.businessName?.trim() || account.name
}

// ── Feature flags ─────────────────────────────────────────────────────────────

/**
 * Returns the feature set for an account based on tier and account type.
 *
 * Today: derived entirely from subscriptionTier + accountType.
 * Future: can be overridden per-account via a DB flags column if needed.
 *
 * Use this instead of checking plan strings directly in product code.
 */
export function getAccountFeatures(account: {
  subscriptionTier?: string | null
  accountType?: string | null
}): AccountFeatures {
  const tier = account.subscriptionTier ?? 'BASIC'
  const isBusiness = account.accountType === 'BUSINESS'
  const isPro = tier === 'PRO' || tier === 'STUDIO' || tier === 'BUSINESS'
  const isStudioPlus = tier === 'STUDIO' || tier === 'BUSINESS'

  return {
    // White label: full removal of DriveBook branding — BUSINESS only, not yet active
    whiteLabel: isBusiness,           // phase 2: activate when direct payments ready

    // Direct payments: student money goes to school Stripe, not DriveBook — not yet implemented
    directPayments: false,            // phase 2: flip to isBusiness when implemented

    // Multi-instructor: PRO and above
    multiInstructor: isPro,

    // AI receptionist dedicated number: PRO and above
    aiReceptionist: isPro,

    // Custom slug (name.drivebook.com.au): PRO and above
    customSlug: isPro,

    // Custom domain (yourdomain.com.au): Studio and above
    customDomain: isStudioPlus,

    // Display/business name override: all tiers
    displayName: true,
  }
}

// ── Payment mode ──────────────────────────────────────────────────────────────

/**
 * Returns the payment routing mode for an account.
 *
 * PLATFORM: all payments flow through DriveBook Stripe (current, all accounts).
 * DIRECT:   payments go to school's own Stripe account (phase 2, BUSINESS only).
 *
 * Call this before creating any Stripe charge. If DIRECT, raise NotImplemented
 * until phase 2 is live.
 */
export function getPaymentMode(account: {
  paymentMode?: string | null
}): PaymentMode {
  return (account.paymentMode as PaymentMode) ?? 'PLATFORM'
}

/**
 * Guard for payment creation routes.
 * Throws a descriptive error if DIRECT mode is requested but not yet implemented.
 * Remove this guard in phase 2 when Direct Charges are implemented.
 */
export function assertPlatformPaymentMode(account: {
  paymentMode?: string | null
  name?: string
  id?: string
}): void {
  if (getPaymentMode(account) === 'DIRECT') {
    throw new Error(
      `Direct payment mode is not yet implemented. ` +
      `Account ${account.id ?? 'unknown'} (${account.name ?? ''}) ` +
      `has paymentMode=DIRECT but the Direct Charges flow is phase 2. ` +
      `Reset paymentMode to PLATFORM or implement Direct Charges.`
    )
  }
}
