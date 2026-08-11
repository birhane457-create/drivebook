import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/admin/staff/[staffId]/status
 * Activate or deactivate an admin account.
 * SUPER_ADMIN only.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { staffId: string } }
) {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden — SUPER_ADMIN only' }, { status: 403 })
  }

  const { isActive } = await req.json()
  if (typeof isActive !== 'boolean') {
    return NextResponse.json({ error: 'isActive boolean required' }, { status: 400 })
  }

  const sm = await prisma.staffMember.findUnique({
    where: { id: params.staffId },
    select: { id: true, user: { select: { id: true, role: true, email: true } } },
  })

  if (!sm) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
  if (sm.user.role === 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Cannot deactivate SUPER_ADMIN' }, { status: 400 })
  }

  const updated = await prisma.staffMember.update({
    where: { id: params.staffId },
    data: { isActive },
    select: { id: true, isActive: true },
  })

  await prisma.auditLog.create({
    data: {
      action: isActive ? 'ADMIN_USER_ACTIVATED' : 'ADMIN_USER_DEACTIVATED',
      actorId: session.user.id!,
      actorRole: 'SUPER_ADMIN',
      targetType: 'STAFF_MEMBER',
      targetId: params.staffId,
      success: true,
      metadata: { targetEmail: sm.user.email } as any,
    },
  })

  return NextResponse.json({ success: true, staffMember: updated })
}
