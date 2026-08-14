import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { ROLE_PRESETS } from '@/lib/rbac/role-presets'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/staff
 * List all ADMIN and SUPER_ADMIN users with their StaffMember record.
 * SUPER_ADMIN only.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  // Staff management is SUPER_ADMIN only — no regular ADMIN can see or edit other admins
  if (session?.user?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden — SUPER_ADMIN only' }, { status: 403 })
  }

  const users = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      staffMember: {
        select: {
          id: true,
          name: true,
          department: true,
          isActive: true,
          permissions: true,
          maxRefundAmount: true,
          canApproveRefunds: true,
          canOverridePolicy: true,
          canAccessFinancials: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ users })
}

/**
 * POST /api/admin/staff
 * Create a new ADMIN user with a role preset.
 * SUPER_ADMIN only.
 */
const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8),
  department: z.enum(['ADMIN', 'FINANCE', 'OPERATIONS', 'SUPPORT']),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden — SUPER_ADMIN only' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = createSchema.parse(body)

    const existing = await prisma.user.findUnique({ where: { email: data.email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 })
    }

    const hashed = await bcrypt.hash(data.password, 10)
    const permissions = ROLE_PRESETS[data.department] ?? ROLE_PRESETS['ADMIN']

    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        password: hashed,
        role: 'ADMIN',
        emailVerified: true, // admin accounts are pre-verified
        staffMember: {
          create: {
            name: data.name,
            email: data.email,
            department: data.department,
            permissions: [...permissions] as string[],
            isActive: true,
          },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        staffMember: { select: { id: true, department: true, permissions: true } },
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'ADMIN_USER_CREATED',
        actorId: session.user.id!,
        actorRole: 'SUPER_ADMIN',
        targetType: 'USER',
        targetId: user.id,
        success: true,
        metadata: { email: data.email, department: data.department, permissionCount: permissions.length } as any,
      },
    })

    return NextResponse.json({ success: true, user }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('[admin/staff POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
