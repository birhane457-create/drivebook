/**
 * RBAC Central Permission Check — DriveBook Admin
 *
 * This is the SINGLE authoritative server-side permission enforcement function.
 * All admin API routes must use this instead of inline role checks.
 *
 * Rules (from RBAC-SPEC.md — do NOT change without spec update):
 *
 * 1. No session → { allowed: false, reason: 'unauthenticated' }
 * 2. User.role not in ['ADMIN','SUPER_ADMIN'] → { allowed: false, reason: 'not_admin' }
 * 3. User.role === 'SUPER_ADMIN' → { allowed: true } — wildcard, no further check
 * 4. StaffMember record not found → { allowed: false, reason: 'no_staff_record' }
 * 5. permission not in StaffMember.permissions → { allowed: false, reason: 'missing_permission' }
 * 6. permission in StaffMember.permissions → { allowed: true }
 *
 * CRITICAL: canApproveRefunds, canOverridePolicy, canAccessFinancials are
 * NOT read here. They are legacy UI fields only.
 *
 * maxRefundAmount IS returned so callers can enforce it as a business limit.
 */

import { Session } from 'next-auth'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Permission } from './permissions'

// ── Result types ──────────────────────────────────────────────────────────────

export interface PermissionGranted {
  allowed: true
  isSuperAdmin: boolean
  staffMember: {
    id: string
    permissions: string[]
    maxRefundAmount: number
  } | null  // null only when isSuperAdmin = true
}

export interface PermissionDenied {
  allowed: false
  reason: 'unauthenticated' | 'not_admin' | 'no_staff_record' | 'missing_permission'
  /** Ready-to-return NextResponse — use as: if (!result.allowed) return result.response */
  response: NextResponse
}

export type PermissionCheckResult = PermissionGranted | PermissionDenied

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Check whether the session user has the required permission.
 *
 * @param session    NextAuth session (null if not authenticated)
 * @param permission One of the 47 approved Permission values
 *
 * @example
 * const check = await checkPermission(session, PERM.FINANCE_PAYOUTS_PROCESS)
 * if (!check.allowed) return check.response
 * // ... proceed with action
 *
 * @example — with credit limit enforcement
 * const check = await checkPermission(session, PERM.FINANCE_CREDITS_MANAGE)
 * if (!check.allowed) return check.response
 * if (!check.isSuperAdmin && check.staffMember) {
 *   const limit = check.staffMember.maxRefundAmount
 *   if (amount > limit) return NextResponse.json({ error: `Max credit is $${limit}` }, { status: 403 })
 * }
 */
export async function checkPermission(
  session: Session | null,
  permission: Permission
): Promise<PermissionCheckResult> {
  // 1. Must be authenticated
  if (!session?.user?.id) {
    return denied('unauthenticated', 401)
  }

  // 2. Must be ADMIN or SUPER_ADMIN — re-read from DB to avoid stale JWT
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  })

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return denied('not_admin', 403)
  }

  // 3. SUPER_ADMIN — wildcard, no further check needed
  if (user.role === 'SUPER_ADMIN') {
    return { allowed: true, isSuperAdmin: true, staffMember: null }
  }

  // 4. ADMIN — must have a StaffMember record with explicit permissions
  const staffMember = await prisma.staffMember.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      permissions: true,
      maxRefundAmount: true,
      // Legacy fields intentionally NOT used for authorization
      // canApproveRefunds, canOverridePolicy, canAccessFinancials are NOT read here
    },
  })

  if (!staffMember) {
    return denied('no_staff_record', 403)
  }

  // 5. Check permission in array — empty array = no access
  if (!staffMember.permissions.includes(permission)) {
    return denied('missing_permission', 403)
  }

  // 6. Permission granted
  return {
    allowed: true,
    isSuperAdmin: false,
    staffMember: {
      id: staffMember.id,
      permissions: staffMember.permissions,
      maxRefundAmount: staffMember.maxRefundAmount,
    },
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────

function denied(
  reason: PermissionDenied['reason'],
  status: 401 | 403
): PermissionDenied {
  return {
    allowed: false,
    reason,
    response: NextResponse.json(
      { error: reason === 'unauthenticated' ? 'Unauthorized' : 'Forbidden', reason },
      { status }
    ),
  }
}

// ── Multiple-permission check ─────────────────────────────────────────────────

/**
 * Require ALL of the listed permissions (AND logic).
 * Returns first denial encountered, or granted if all pass.
 */
export async function checkPermissions(
  session: Session | null,
  permissions: Permission[]
): Promise<PermissionCheckResult> {
  for (const perm of permissions) {
    const result = await checkPermission(session, perm)
    if (!result.allowed) return result
  }
  // All passed — return the last result (which is granted)
  return checkPermission(session, permissions[permissions.length - 1])
}

/**
 * Require ANY of the listed permissions (OR logic).
 * Returns granted if at least one passes.
 */
export async function checkAnyPermission(
  session: Session | null,
  permissions: Permission[]
): Promise<PermissionCheckResult> {
  let lastDenial: PermissionDenied | null = null
  for (const perm of permissions) {
    const result = await checkPermission(session, perm)
    if (result.allowed) return result
    lastDenial = result
  }
  return lastDenial!
}
