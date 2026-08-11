/**
 * RBAC Role Presets — DriveBook Admin
 *
 * These arrays are CODE CONSTANTS only — they are NOT stored in the database.
 * They are used exclusively by:
 *   1. The migration script (scripts/migrate-rbac.ts) to populate
 *      StaffMember.permissions for existing ADMIN users.
 *   2. The admin user management UI when assigning a role to a new admin.
 *
 * StaffMember.permissions is ALWAYS the authoritative source at runtime.
 * Changing these presets does NOT change any existing admin's permissions.
 * You must re-run the migration script or update permissions manually.
 *
 * Permission strings are verified against ALL_PERMISSIONS at import time.
 * See RBAC-SPEC.md for the full role → permission matrix.
 */

import { Permission, ALL_PERMISSIONS } from './permissions'

// ── Preset arrays (from approved spec matrix) ─────────────────────────────────

export const ADMIN_PERMISSIONS: Permission[] = [
  'users.instructors.view',
  'users.instructors.approve',
  'users.instructors.reject',
  'users.instructors.suspend',
  'users.instructors.send_email',
  'users.instructors.manage_subscription',
  'users.instructors.verify_documents',
  'users.instructors.verify_abn',
  'users.clients.view',
  'users.clients.edit',
  'users.clients.wallet_credit',
  'users.clients.reset_password',
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
  'operations.test_centres.view',
  'operations.test_centres.manage',
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
  'users.instructors.view',
  'users.instructors.manage_subscription',
  'users.instructors.verify_abn',
  'users.clients.wallet_credit',
  'users.clients.wallet_deduct',
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
  'users.instructors.view',
  'users.instructors.approve',
  'users.instructors.reject',
  'users.instructors.suspend',
  'users.instructors.send_email',
  'users.instructors.verify_documents',
  'users.instructors.verify_abn',
  'users.clients.view',
  'operations.bookings.view',
  'operations.bookings.cancel',
  'operations.bookings.delete',
  'operations.documents.view',
  'operations.documents.verify',
  'operations.test_centres.view',
  'operations.test_centres.manage',
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
  'users.instructors.view',
  'users.instructors.send_email',
  'users.clients.view',
  'users.clients.edit',
  'users.clients.reset_password',
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
// Ensures no typos in the preset arrays above. If a permission string is
// invalid, this will throw at module load time in development.

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
