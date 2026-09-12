/**
 * RBAC Role Presets — Platform Admin
 *
 * These arrays are CODE CONSTANTS only — NOT stored in the database.
 * Used by:
 *   1. The migration script (scripts/migrate-rbac.ts) to populate
 *      StaffMember.permissions for existing ADMIN users.
 *   2. The admin user management UI when assigning a role to a new admin.
 *
 * StaffMember.permissions is ALWAYS the authoritative source at runtime.
 * Changing these presets does NOT change any existing admin's permissions.
 *
 * Permission strings are verified against ALL_PERMISSIONS at import time.
 * See RBAC-SPEC.md for the full role → permission matrix.
 *
 * Phase 4 rename:
 *   users.providers.* → users.providers.*
 *   users.customers.*     → users.customers.*
 *   operations.test_centres.* → operations.extensions.*
 */

import { Permission, ALL_PERMISSIONS } from './permissions'

// ── Preset arrays ─────────────────────────────────────────────────────────────

export const ADMIN_PERMISSIONS: Permission[] = [
  'users.providers.view',
  'users.providers.approve',
  'users.providers.reject',
  'users.providers.suspend',
  'users.providers.send_email',
  'users.providers.manage_subscription',
  'users.providers.verify_documents',
  'users.providers.verify_abn',
  'users.customers.view',
  'users.customers.edit',
  'users.customers.wallet_credit',
  'users.customers.reset_password',
  'users.subscriptions.view',
  'finance.revenue.view',
  'finance.payouts.view',
  'finance.credits.view',
  'finance.credits.manage',
  'finance.disputes.view',
  'finance.pricing.view',
  'operations.bookings.view',
  'operations.bookings.cancel',
  'operations.documents.view',
  'operations.documents.verify',
  'operations.extensions.view',
  'operations.extensions.manage',
  'operations.policy.view',
  'operations.audit_log.view',
  'operations.cron.view',
  'operations.voice_lines.view',
  'operations.voice_lines.manage',
  'engagement.reviews.view',
  'engagement.reviews.moderate',
  'engagement.support.view',
  'engagement.support.contact',
  'engagement.support.reset_password',
  'platform.settings.view',
  'platform.copilot.view',
]

export const FINANCE_PERMISSIONS: Permission[] = [
  'users.providers.view',
  'users.providers.manage_subscription',
  'users.providers.verify_abn',
  'users.customers.wallet_credit',
  'users.customers.wallet_deduct',
  'users.subscriptions.view',
  'users.subscriptions.override',
  'finance.revenue.view',
  'finance.payouts.view',
  'finance.payouts.process',
  'finance.payouts.hold',
  'finance.payouts.resolve',
  'finance.credits.view',
  'finance.credits.manage',
  'finance.disputes.view',
  'finance.disputes.manage',
  'finance.pricing.view',
  'operations.audit_log.view',
  'platform.copilot.view',
]

export const OPERATIONS_PERMISSIONS: Permission[] = [
  'users.providers.view',
  'users.providers.approve',
  'users.providers.reject',
  'users.providers.suspend',
  'users.providers.send_email',
  'users.providers.verify_documents',
  'users.providers.verify_abn',
  'users.customers.view',
  'operations.bookings.view',
  'operations.bookings.cancel',
  'operations.bookings.delete',
  'operations.documents.view',
  'operations.documents.verify',
  'operations.extensions.view',
  'operations.extensions.manage',
  'operations.policy.view',
  'operations.policy.manage',
  'operations.audit_log.view',
  'operations.cron.view',
  'operations.voice_lines.view',
  'operations.voice_lines.manage',
  'engagement.reviews.view',
  'engagement.reviews.moderate',
  'platform.copilot.view',
]

export const SUPPORT_PERMISSIONS: Permission[] = [
  'users.providers.view',
  'users.providers.send_email',
  'users.customers.view',
  'users.customers.edit',
  'users.customers.reset_password',
  'finance.credits.view',
  'operations.bookings.view',
  'engagement.reviews.view',
  'engagement.support.view',
  'engagement.support.contact',
  'engagement.support.reset_password',
]

export const ROLE_PRESETS: Record<string, Permission[]> = {
  ADMIN:      ADMIN_PERMISSIONS,
  FINANCE:    FINANCE_PERMISSIONS,
  OPERATIONS: OPERATIONS_PERMISSIONS,
  SUPPORT:    SUPPORT_PERMISSIONS,
  // SUPER_ADMIN has no preset — wildcard bypass, never reads permissions array
}

// ── Compile-time validation ───────────────────────────────────────────────────
// Ensures no typos. Throws at module load time in development if invalid.

const allPermSet = new Set<string>(ALL_PERMISSIONS)

for (const [role, perms] of Object.entries(ROLE_PRESETS)) {
  for (const p of perms) {
    if (!allPermSet.has(p)) {
      throw new Error(
        `[RBAC] Invalid permission "${p}" in ${role} preset. ` +
        `Update lib/rbac/permissions.ts or fix the typo.`
      )
    }
  }
}
