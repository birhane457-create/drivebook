import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/me/permissions
 *
 * Returns the current admin user's permission array.
 * Used by AdminNav and useAdminPermissions() hook to filter navigation.
 *
 * SUPER_ADMIN receives ['*'] — the wildcard signal.
 * ADMIN with no StaffMember receives [] — no access.
 * ADMIN with StaffMember receives their actual permissions[].
 *
 * This endpoint is for UX only — the actual enforcement is server-side.
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Re-read from DB — never trust JWT role alone
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
        email: true,
        staffMember: {
          select: {
            id: true,
            name: true,
            department: true,
            permissions: true,
            maxRefundAmount: true,
          },
        },
      },
    })

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // SUPER_ADMIN — wildcard
    if (user.role === 'SUPER_ADMIN') {
      return NextResponse.json({
        isSuperAdmin: true,
        permissions: ['*'],
        staffMember: null,
      })
    }

    // ADMIN — return actual permissions (may be empty)
    return NextResponse.json({
      isSuperAdmin: false,
      permissions: user.staffMember?.permissions ?? [],
      staffMember: user.staffMember
        ? {
            id: user.staffMember.id,
            name: user.staffMember.name,
            department: user.staffMember.department,
            maxRefundAmount: user.staffMember.maxRefundAmount,
          }
        : null,
    })
  } catch (error) {
    console.error('[me/permissions] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
