/**
 * lib/auth/requireRole.ts
 *
 * Centralized role verification — re-reads the user row from DB so we never
 * trust a stale JWT value. Use this on any route where the action has financial,
 * administrative, or security significance.
 *
 * WHY: JWT contains role at time of login. If a user's role is changed in DB
 * (demoted, suspended), their existing JWT still carries the old role until it
 * expires. By re-reading from DB on sensitive operations we close that window.
 *
 * USAGE:
 *   const authResult = await requireRole(session, ['ADMIN', 'SUPER_ADMIN'])
 *   if (authResult.error) return authResult.error   // NextResponse already built
 *   // authResult.user is the fresh DB user row
 *
 * For instructor-scoped routes (verify they're still approved + active):
 *   const authResult = await requireInstructor(session)
 *   if (authResult.error) return authResult.error
 */

import { NextResponse } from 'next/server'
import { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'

// ── Types ─────────────────────────────────────────────────────────────────────

type RoleCheckSuccess = {
  error: null
  user: {
    id: string
    role: string
    email: string
    instructorId: string | null
  }
}

type RoleCheckFailure = {
  error: NextResponse
  user: null
}

type RoleCheckResult = RoleCheckSuccess | RoleCheckFailure

// ── Helpers ───────────────────────────────────────────────────────────────────

function unauthorized(message = 'Unauthorized'): RoleCheckFailure {
  return {
    error: NextResponse.json({ error: message }, { status: 401 }),
    user: null,
  }
}

function forbidden(message = 'Forbidden'): RoleCheckFailure {
  return {
    error: NextResponse.json({ error: message }, { status: 403 }),
    user: null,
  }
}

// ── requireRole ───────────────────────────────────────────────────────────────

/**
 * Verify the session user has one of the required roles, confirmed from DB.
 *
 * @param session   - NextAuth session (may be null if no session)
 * @param roles     - Allowed roles, e.g. ['ADMIN', 'SUPER_ADMIN']
 * @returns RoleCheckResult — check `.error` first, then use `.user`
 */
export async function requireRole(
  session: Session | null,
  roles: string[]
): Promise<RoleCheckResult> {
  if (!session?.user?.id) {
    return unauthorized()
  }

  // Re-read from DB — do not trust JWT role alone
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, email: true, instructorId: true },
  })

  if (!user) {
    return unauthorized('User not found')
  }

  if (!roles.includes(user.role)) {
    return forbidden(`Requires role: ${roles.join(' or ')}`)
  }

  return { error: null, user }
}

// ── requireAdmin ──────────────────────────────────────────────────────────────

/**
 * Shorthand: require ADMIN or SUPER_ADMIN, re-verified from DB.
 */
export async function requireAdmin(session: Session | null): Promise<RoleCheckResult> {
  return requireRole(session, ['ADMIN', 'SUPER_ADMIN'])
}

// ── requireSuperAdmin ─────────────────────────────────────────────────────────

/**
 * Shorthand: require SUPER_ADMIN only (e.g. payouts, platform settings).
 */
export async function requireSuperAdmin(session: Session | null): Promise<RoleCheckResult> {
  return requireRole(session, ['SUPER_ADMIN'])
}

// ── requireInstructor ─────────────────────────────────────────────────────────

/**
 * Verify the session user is an approved, active instructor — confirmed from DB.
 * Returns the instructor record alongside the user.
 */
export async function requireInstructor(session: Session | null): Promise<
  | { error: NextResponse; user: null; instructor: null }
  | { error: null; user: { id: string; role: string; email: string; instructorId: string }; instructor: { id: string; approvalStatus: string; isActive: boolean | null } }
> {
  const noSession = { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null, instructor: null } as const

  if (!session?.user?.id) return noSession

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      role: true,
      email: true,
      instructorId: true,
      instructor: {
        select: { id: true, approvalStatus: true, isActive: true },
      },
    },
  })

  if (!user) return noSession

  if (user.role !== 'INSTRUCTOR') {
    return {
      error: NextResponse.json({ error: 'Instructor access required' }, { status: 403 }),
      user: null,
      instructor: null,
    }
  }

  if (!user.instructor || user.instructor.approvalStatus !== 'APPROVED') {
    return {
      error: NextResponse.json(
        { error: 'Your account is pending approval', requiresApproval: true },
        { status: 403 }
      ),
      user: null,
      instructor: null,
    }
  }

  if (!user.instructorId) {
    return noSession
  }

  return {
    error: null,
    user: { ...user, instructorId: user.instructorId },
    instructor: user.instructor,
  }
}

// ── requirePermission ─────────────────────────────────────────────────────────

/**
 * Thin wrapper around checkPermission for use in API routes.
 * Returns a NextResponse error if the check fails, null if it passes.
 *
 * Convenience pattern:
 *   const deny = await requirePermission(session, PERM.FINANCE_PAYOUTS_PROCESS)
 *   if (deny) return deny
 *
 * For routes that also need the staffMember (e.g. to read maxRefundAmount):
 *   Use checkPermission() directly from lib/rbac/checkPermission.
 */
import type { Permission } from '@/lib/rbac/permissions'
import { checkPermission } from '@/lib/rbac/checkPermission'

export async function requirePermission(
  session: Session | null,
  permission: Permission
): Promise<NextResponse | null> {
  const result = await checkPermission(session, permission)
  if (!result.allowed) return result.response
  return null
}
