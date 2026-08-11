import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { ALL_PERMISSIONS } from '@/lib/rbac/permissions'

export const dynamic = 'force-dynamic'

const permSchema = z.object({
  permissions: z.array(z.string()).refine(
    (perms) => perms.every((p) => (ALL_PERMISSIONS as readonly string[]).includes(p)),
    { message: 'One or more invalid permission strings' }
  ),
  maxRefundAmount: z.number().min(0).max(10000).optional(),
})

/**
 * PATCH /api/admin/staff/[staffId]/permissions
 * Update the permissions array for an admin StaffMember.
 * SUPER_ADMIN only — no ADMIN can modify another admin's permissions.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { staffId: string } }
) {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden — SUPER_ADMIN only' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { permissions, maxRefundAmount } = permSchema.parse(body)

    // Verify StaffMember exists
    const sm = await prisma.staffMember.findUnique({
      where: { id: params.staffId },
      select: { id: true, userId: true, permissions: true, user: { select: { role: true, email: true } } },
    })
    if (!sm) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
    }

    // Cannot edit SUPER_ADMIN permissions (they don't use the array, but prevent confusion)
    if (sm.user.role === 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Cannot modify SUPER_ADMIN permissions' }, { status: 400 })
    }

    const updateData: any = { permissions }
    if (maxRefundAmount !== undefined) updateData.maxRefundAmount = maxRefundAmount

    const updated = await prisma.staffMember.update({
      where: { id: params.staffId },
      data: updateData,
      select: { id: true, permissions: true, maxRefundAmount: true },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'ADMIN_PERMISSIONS_UPDATED',
        actorId: session.user.id!,
        actorRole: 'SUPER_ADMIN',
        targetType: 'STAFF_MEMBER',
        targetId: params.staffId,
        success: true,
        metadata: {
          targetEmail: sm.user.email,
          permissionCount: permissions.length,
          addedCount: permissions.filter((p) => !sm.permissions.includes(p)).length,
          removedCount: sm.permissions.filter((p) => !permissions.includes(p)).length,
        } as any,
      },
    })

    return NextResponse.json({ success: true, staffMember: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('[staff/permissions PATCH]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
