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
