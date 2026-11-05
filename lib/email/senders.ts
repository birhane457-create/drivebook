/**
 * Email sender identities for DriveBook.
 *
 * All aliases route to the single support@ mailbox.
 * SMTP auth (SMTP_USER / SMTP_PASS) is unchanged — only the display
 * name and From address differ per email type.
 *
 * Adding a new sender:
 *   1. Add the alias in your email provider
 *   2. Add a new entry here
 *   3. Reference it via SenderKey in registry.ts
 */
export const SENDERS = {
  /** OTP codes, email verification, password reset, new device alerts */
  verification: {
    name: 'DriveBook Account Verification',
    email: 'verification@drivebook.com.au',
  },
  /** Booking confirmations, cancellations, reminders, slot notifications */
  bookings: {
    name: 'DriveBook Bookings',
    email: 'bookings@drivebook.com.au',
  },
  /** Receipts, wallet, payouts, subscription, trial, commission emails */
  payments: {
    name: 'DriveBook Payments',
    email: 'payments@drivebook.com.au',
  },
  /** Welcome, registration, onboarding nudge, claim-account, set-password */
  team: {
    name: 'DriveBook Team',
    email: 'hello@drivebook.com.au',
  },
  /**
   * Admin notifications, weekly reports, support contact, reviews,
   * internal alerts, and the default fallback sender.
   */
  support: {
    name: 'DriveBook Support',
    email: 'support@drivebook.com.au',
  },
} as const

export type SenderKey = keyof typeof SENDERS

/**
 * Formats a sender key into a nodemailer-compatible From string.
 * @example formatSender('bookings') → 'DriveBook Bookings <bookings@drivebook.com.au>'
 */
export function formatSender(key: SenderKey): string {
  const { name, email } = SENDERS[key]
  return `${name} <${email}>`
}

/**
 * WLA-015 FIX: Returns a booking sender with the provider's business name in the
 * display component when the provider has PREMIUM white-label entitlement.
 *
 * Only PREMIUM tier providers with a non-empty businessName receive the white-label
 * display name. All other providers receive the standard DriveBook Bookings sender.
 *
 * The email address is always bookings@drivebook.com.au — deliverability and DKIM
 * signing are unchanged. Only the display name seen by the recipient changes.
 *
 * Architecture note: White-label entitlement uses getAccountFeatures().whiteLabel,
 * which is PREMIUM tier only. accountType=BUSINESS does not grant whiteLabel.
 * This avoids duplicating the entitlement rule — the central abstraction in
 * lib/utils/account.ts is the single source of truth.
 *
 * @example
 *   // PREMIUM provider with businessName
 *   getProviderBookingsSender({ subscriptionTier: 'PREMIUM', businessName: 'Perth Drive Academy', name: 'John' })
 *   → 'Perth Drive Academy via DriveBook <bookings@drivebook.com.au>'
 *
 *   // PRO/STUDIO/BASIC provider or provider without businessName
 *   getProviderBookingsSender({ subscriptionTier: 'PRO', businessName: null, name: 'John' })
 *   → 'DriveBook Bookings <bookings@drivebook.com.au>'
 */
import { getAccountFeatures } from '@/lib/utils/account'

export function getProviderBookingsSender(provider?: {
  subscriptionTier?: string | null
  businessName?: string | null
} | null): string {
  if (!provider) return formatSender('bookings')
  // WLA-015 FIX: Use the central feature abstraction, not a direct tier check.
  // getAccountFeatures.whiteLabel = isPremium per the architecture rule.
  const { whiteLabel } = getAccountFeatures(provider)
  const businessName = provider.businessName?.trim()
  if (whiteLabel && businessName) {
    return `${businessName} via DriveBook <${SENDERS.bookings.email}>`
  }
  return formatSender('bookings')
}
