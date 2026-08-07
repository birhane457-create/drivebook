/**
 * Email Event Registry
 *
 * Each entry maps a platform event to its email configuration.
 * Routes declare WHAT is happening — the registry owns HOW it's sent.
 *
 * Fields:
 *   id       — stable dot-notation identifier used in audit logs, analytics,
 *              retry queues, and future notification preferences
 *   sender   — which alias sends this email (see senders.ts)
 *   replyTo  — optional reply-to alias (used when replies should go to support)
 *   template — future: points to lib/email/templates/<name>.tsx
 *   category — used for analytics tagging and future per-category preferences
 *
 * Future: when SMS/push/voice are added, this becomes NOTIFICATION_EVENTS
 * with a channels map per event. The id field is already channel-agnostic.
 */

import type { SenderKey } from './senders'

interface EventConfig {
  id: string
  sender: SenderKey
  replyTo?: SenderKey
  template?: string
  category: 'security' | 'booking' | 'payment' | 'onboarding' | 'admin'
}

export const EMAIL_EVENTS = {
  // ── Security ─────────────────────────────────────────────────────────────
  OTP:                     { id: 'security.otp',                    sender: 'verification', category: 'security'   },
  EMAIL_VERIFICATION:      { id: 'security.email-verification',     sender: 'verification', category: 'security'   },
  PASSWORD_RESET:          { id: 'security.password-reset',         sender: 'verification', category: 'security'   },
  NEW_DEVICE_ALERT:        { id: 'security.new-device',             sender: 'verification', category: 'security'   },

  // ── Bookings ──────────────────────────────────────────────────────────────
  BOOKING_CONFIRMED:       { id: 'booking.confirmed',               sender: 'bookings',     category: 'booking'    },
  BOOKING_CANCELLED:       { id: 'booking.cancelled',               sender: 'bookings',     category: 'booking',   replyTo: 'support' },
  LESSON_REMINDER:         { id: 'booking.reminder',                sender: 'bookings',     category: 'booking'    },
  WAITING_LIST_SLOT:       { id: 'booking.waiting-list-slot',       sender: 'bookings',     category: 'booking'    },
  TOP_UP_PROMPT:           { id: 'booking.top-up-prompt',           sender: 'bookings',     category: 'booking',   replyTo: 'support' },
  BATCH_SUMMARY:           { id: 'booking.batch-summary',           sender: 'bookings',     category: 'booking'    },

  // ── Payments ──────────────────────────────────────────────────────────────
  RECEIPT:                 { id: 'payment.receipt',                 sender: 'payments',     category: 'payment'    },
  WALLET_CREDIT:           { id: 'payment.wallet-credit',           sender: 'payments',     category: 'payment'    },
  WALLET_DEBIT:            { id: 'payment.wallet-debit',            sender: 'payments',     category: 'payment'    },
  PAYOUT_ADJUSTMENT:       { id: 'payment.payout-adjustment',       sender: 'payments',     category: 'payment',   replyTo: 'support' },
  SUBSCRIPTION_ACTIVATED:  { id: 'payment.subscription-activated',  sender: 'payments',     category: 'payment'    },
  TRIAL_WARNING:           { id: 'payment.trial-warning',           sender: 'payments',     category: 'payment',   replyTo: 'support' },
  TRIAL_EXPIRED:           { id: 'payment.trial-expired',           sender: 'payments',     category: 'payment',   replyTo: 'support' },
  COMMISSION_CHANGE:       { id: 'payment.commission-change',       sender: 'payments',     category: 'payment',   replyTo: 'support' },
  PAYMENT_FAILED:          { id: 'payment.payment-failed',          sender: 'payments',     category: 'payment',   replyTo: 'support' },

  // ── Onboarding ────────────────────────────────────────────────────────────
  WELCOME:                 { id: 'onboarding.welcome',              sender: 'team',         category: 'onboarding' },
  INSTRUCTOR_REGISTRATION: { id: 'onboarding.instructor-register',  sender: 'team',         category: 'onboarding' },
  SETUP_NUDGE:             { id: 'onboarding.setup-nudge',          sender: 'team',         category: 'onboarding' },
  CLAIM_ACCOUNT:           { id: 'onboarding.claim-account',        sender: 'team',         category: 'onboarding' },
  SET_PASSWORD:            { id: 'onboarding.set-password',         sender: 'team',         category: 'onboarding' },

  // ── Admin / support ───────────────────────────────────────────────────────
  INSTRUCTOR_APPROVED:     { id: 'admin.instructor-approved',       sender: 'support',      category: 'admin'      },
  INSTRUCTOR_REJECTED:     { id: 'admin.instructor-rejected',       sender: 'support',      category: 'admin'      },
  INSTRUCTOR_SUSPENDED:    { id: 'admin.instructor-suspended',      sender: 'support',      category: 'admin'      },
  ADMIN_NOTIFICATION:      { id: 'admin.notification',              sender: 'support',      category: 'admin'      },
  WEEKLY_REPORT:           { id: 'admin.weekly-report',             sender: 'support',      category: 'admin'      },
  DOCUMENT_EXPIRY:         { id: 'admin.document-expiry',           sender: 'support',      category: 'admin'      },
  REVIEW_NOTIFICATION:     { id: 'admin.review-notification',       sender: 'support',      category: 'admin'      },
} as const satisfies Record<string, EventConfig>

export type EmailEvent = keyof typeof EMAIL_EVENTS
