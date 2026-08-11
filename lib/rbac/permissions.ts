/**
 * RBAC Permission definitions — DriveBook Admin
 *
 * These 47 permissions are the APPROVED specification from RBAC-SPEC.md.
 * Do NOT add, remove, rename, or consolidate without updating the spec first.
 *
 * Format: domain.resource.action
 */

// ── Users ─────────────────────────────────────────────────────────────────────
export const PERM = {
  // Instructors
  USERS_INSTRUCTORS_VIEW:                'users.instructors.view',
  USERS_INSTRUCTORS_APPROVE:             'users.instructors.approve',
  USERS_INSTRUCTORS_REJECT:              'users.instructors.reject',
  USERS_INSTRUCTORS_SUSPEND:             'users.instructors.suspend',
  USERS_INSTRUCTORS_SEND_EMAIL:          'users.instructors.send_email',
  USERS_INSTRUCTORS_MANAGE_SUBSCRIPTION: 'users.instructors.manage_subscription',
  USERS_INSTRUCTORS_VERIFY_DOCUMENTS:    'users.instructors.verify_documents',
  USERS_INSTRUCTORS_VERIFY_ABN:          'users.instructors.verify_abn',

  // Clients
  USERS_CLIENTS_VIEW:                    'users.clients.view',
  USERS_CLIENTS_EDIT:                    'users.clients.edit',
  USERS_CLIENTS_WALLET_CREDIT:           'users.clients.wallet_credit',
  USERS_CLIENTS_WALLET_DEDUCT:           'users.clients.wallet_deduct',
  USERS_CLIENTS_RESET_PASSWORD:          'users.clients.reset_password',

  // Subscriptions
  USERS_SUBSCRIPTIONS_VIEW:              'users.subscriptions.view',
  USERS_SUBSCRIPTIONS_OVERRIDE:          'users.subscriptions.override',

  // ── Finance ────────────────────────────────────────────────────────────────
  FINANCE_REVENUE_VIEW:                  'finance.revenue.view',

  FINANCE_PAYOUTS_VIEW:                  'finance.payouts.view',
  FINANCE_PAYOUTS_PROCESS:               'finance.payouts.process',
  FINANCE_PAYOUTS_HOLD:                  'finance.payouts.hold',
  FINANCE_PAYOUTS_RESOLVE:               'finance.payouts.resolve',

  FINANCE_CREDITS_VIEW:                  'finance.credits.view',
  FINANCE_CREDITS_MANAGE:                'finance.credits.manage',

  FINANCE_DISPUTES_VIEW:                 'finance.disputes.view',
  FINANCE_DISPUTES_MANAGE:               'finance.disputes.manage',

  FINANCE_PRICING_VIEW:                  'finance.pricing.view',
  FINANCE_PRICING_MANAGE:                'finance.pricing.manage',

  // ── Operations ────────────────────────────────────────────────────────────
  OPERATIONS_BOOKINGS_VIEW:              'operations.bookings.view',
  OPERATIONS_BOOKINGS_CANCEL:            'operations.bookings.cancel',
  OPERATIONS_BOOKINGS_DELETE:            'operations.bookings.delete',

  OPERATIONS_DOCUMENTS_VIEW:             'operations.documents.view',
  OPERATIONS_DOCUMENTS_VERIFY:           'operations.documents.verify',

  OPERATIONS_TEST_CENTRES_VIEW:          'operations.test_centres.view',
  OPERATIONS_TEST_CENTRES_MANAGE:        'operations.test_centres.manage',

  OPERATIONS_POLICY_VIEW:                'operations.policy.view',
  OPERATIONS_POLICY_MANAGE:              'operations.policy.manage',

  OPERATIONS_AUDIT_LOG_VIEW:             'operations.audit_log.view',

  OPERATIONS_CRON_VIEW:                  'operations.cron.view',

  OPERATIONS_VOICE_LINES_VIEW:           'operations.voice_lines.view',
  OPERATIONS_VOICE_LINES_MANAGE:         'operations.voice_lines.manage',

  // ── Engagement ───────────────────────────────────────────────────────────
  ENGAGEMENT_REVIEWS_VIEW:               'engagement.reviews.view',
  ENGAGEMENT_REVIEWS_MODERATE:           'engagement.reviews.moderate',

  ENGAGEMENT_SUPPORT_VIEW:               'engagement.support.view',
  ENGAGEMENT_SUPPORT_CONTACT:            'engagement.support.contact',
  ENGAGEMENT_SUPPORT_RESET_PASSWORD:     'engagement.support.reset_password',

  // ── Platform ─────────────────────────────────────────────────────────────
  PLATFORM_SETTINGS_VIEW:                'platform.settings.view',
  PLATFORM_SETTINGS_MANAGE:             'platform.settings.manage',
  PLATFORM_COPILOT_VIEW:                 'platform.copilot.view',
} as const

export type Permission = typeof PERM[keyof typeof PERM]

/** All 47 valid permission strings — used for validation */
export const ALL_PERMISSIONS: readonly Permission[] = Object.values(PERM)
