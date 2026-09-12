/**
 * RBAC Permission definitions — Platform Admin
 *
 * These permissions are the APPROVED specification.
 * Do NOT add, remove, rename, or consolidate without updating the spec first.
 *
 * Format: domain.resource.action
 *
 * Naming conventions (Phase 4 rename):
 *   providers   — generic term for the people delivering services (was: instructors)
 *   customers   — generic term for the people receiving services (was: clients)
 *   extensions  — vertical-specific admin areas (was: test_centres — driving only)
 */

// ── Users ─────────────────────────────────────────────────────────────────────
export const PERM = {
  // Providers (generic — was: Instructors)
  USERS_PROVIDERS_VIEW:                'users.providers.view',
  USERS_PROVIDERS_APPROVE:             'users.providers.approve',
  USERS_PROVIDERS_REJECT:              'users.providers.reject',
  USERS_PROVIDERS_SUSPEND:             'users.providers.suspend',
  USERS_PROVIDERS_SEND_EMAIL:          'users.providers.send_email',
  USERS_PROVIDERS_MANAGE_SUBSCRIPTION: 'users.providers.manage_subscription',
  USERS_PROVIDERS_VERIFY_DOCUMENTS:    'users.providers.verify_documents',
  USERS_PROVIDERS_VERIFY_ABN:          'users.providers.verify_abn',

  // Customers (generic — was: Clients)
  USERS_CUSTOMERS_VIEW:                'users.customers.view',
  USERS_CUSTOMERS_EDIT:                'users.customers.edit',
  USERS_CUSTOMERS_WALLET_CREDIT:       'users.customers.wallet_credit',
  USERS_CUSTOMERS_WALLET_DEDUCT:       'users.customers.wallet_deduct',
  USERS_CUSTOMERS_RESET_PASSWORD:      'users.customers.reset_password',

  // Subscriptions
  USERS_SUBSCRIPTIONS_VIEW:            'users.subscriptions.view',
  USERS_SUBSCRIPTIONS_OVERRIDE:        'users.subscriptions.override',

  // ── Finance ────────────────────────────────────────────────────────────────
  FINANCE_REVENUE_VIEW:                'finance.revenue.view',

  FINANCE_PAYOUTS_VIEW:                'finance.payouts.view',
  FINANCE_PAYOUTS_PROCESS:             'finance.payouts.process',
  FINANCE_PAYOUTS_HOLD:                'finance.payouts.hold',
  FINANCE_PAYOUTS_RESOLVE:             'finance.payouts.resolve',

  FINANCE_CREDITS_VIEW:                'finance.credits.view',
  FINANCE_CREDITS_MANAGE:              'finance.credits.manage',

  FINANCE_DISPUTES_VIEW:               'finance.disputes.view',
  FINANCE_DISPUTES_MANAGE:             'finance.disputes.manage',

  FINANCE_PRICING_VIEW:                'finance.pricing.view',
  FINANCE_PRICING_MANAGE:              'finance.pricing.manage',

  // ── Operations ────────────────────────────────────────────────────────────
  OPERATIONS_BOOKINGS_VIEW:            'operations.bookings.view',
  OPERATIONS_BOOKINGS_CANCEL:          'operations.bookings.cancel',
  OPERATIONS_BOOKINGS_DELETE:          'operations.bookings.delete',

  OPERATIONS_DOCUMENTS_VIEW:           'operations.documents.view',
  OPERATIONS_DOCUMENTS_VERIFY:         'operations.documents.verify',

  // Extension admin areas — provided by domain extensions, not Core.
  // Driving extension contributes: operations.extensions.view / .manage
  // (used for Test Centres admin page)
  OPERATIONS_EXTENSIONS_VIEW:          'operations.extensions.view',
  OPERATIONS_EXTENSIONS_MANAGE:        'operations.extensions.manage',

  OPERATIONS_POLICY_VIEW:              'operations.policy.view',
  OPERATIONS_POLICY_MANAGE:            'operations.policy.manage',

  OPERATIONS_AUDIT_LOG_VIEW:           'operations.audit_log.view',

  OPERATIONS_CRON_VIEW:                'operations.cron.view',

  OPERATIONS_VOICE_LINES_VIEW:         'operations.voice_lines.view',
  OPERATIONS_VOICE_LINES_MANAGE:       'operations.voice_lines.manage',

  // ── Engagement ───────────────────────────────────────────────────────────
  ENGAGEMENT_REVIEWS_VIEW:             'engagement.reviews.view',
  ENGAGEMENT_REVIEWS_MODERATE:         'engagement.reviews.moderate',

  ENGAGEMENT_SUPPORT_VIEW:             'engagement.support.view',
  ENGAGEMENT_SUPPORT_CONTACT:          'engagement.support.contact',
  ENGAGEMENT_SUPPORT_RESET_PASSWORD:   'engagement.support.reset_password',

  // ── Platform ─────────────────────────────────────────────────────────────
  PLATFORM_SETTINGS_VIEW:              'platform.settings.view',
  PLATFORM_SETTINGS_MANAGE:            'platform.settings.manage',
  PLATFORM_COPILOT_VIEW:               'platform.copilot.view',
} as const

export type Permission = typeof PERM[keyof typeof PERM]

/** All valid permission strings — used for validation */
export const ALL_PERMISSIONS: readonly Permission[] = Object.values(PERM)

// ── Backward-compatibility aliases ───────────────────────────────────────────
// These aliases keep existing code compiling while call sites are migrated.
// @deprecated — use USERS_PROVIDERS_* and USERS_CUSTOMERS_* instead.

/** @deprecated Use PERM.USERS_PROVIDERS_VIEW */
export const LEGACY_PERM_ALIASES = {
  USERS_PROVIDERS_VIEW:                PERM.USERS_PROVIDERS_VIEW,
  USERS_PROVIDERS_APPROVE:             PERM.USERS_PROVIDERS_APPROVE,
  USERS_PROVIDERS_REJECT:              PERM.USERS_PROVIDERS_REJECT,
  USERS_PROVIDERS_SUSPEND:             PERM.USERS_PROVIDERS_SUSPEND,
  USERS_PROVIDERS_SEND_EMAIL:          PERM.USERS_PROVIDERS_SEND_EMAIL,
  USERS_PROVIDERS_MANAGE_SUBSCRIPTION: PERM.USERS_PROVIDERS_MANAGE_SUBSCRIPTION,
  USERS_PROVIDERS_VERIFY_DOCUMENTS:    PERM.USERS_PROVIDERS_VERIFY_DOCUMENTS,
  USERS_PROVIDERS_VERIFY_ABN:          PERM.USERS_PROVIDERS_VERIFY_ABN,
  USERS_CUSTOMERS_VIEW:                    PERM.USERS_CUSTOMERS_VIEW,
  USERS_CUSTOMERS_EDIT:                    PERM.USERS_CUSTOMERS_EDIT,
  USERS_CLIENTS_WALLET_CREDIT:           PERM.USERS_CUSTOMERS_WALLET_CREDIT,
  USERS_CUSTOMERS_WALLET_DEDUCT:           PERM.USERS_CUSTOMERS_WALLET_DEDUCT,
  USERS_CUSTOMERS_RESET_PASSWORD:          PERM.USERS_CUSTOMERS_RESET_PASSWORD,
  OPERATIONS_DOCUMENTS_VIEW:          PERM.OPERATIONS_EXTENSIONS_VIEW,
  OPERATIONS_EXTENSIONS_MANAGE:        PERM.OPERATIONS_EXTENSIONS_MANAGE,
} as const
