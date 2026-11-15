import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/requireRole'
import { PERM } from '@/lib/rbac/permissions'

/**
 * GET /api/admin/cancellations?status=PENDING
 * List cancellation requests (admin only).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const deny = await requirePermission(session, PERM.OPERATIONS_BOOKINGS_CANCEL)
    if (deny) return deny

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'PENDING'

    const bookings = await prisma.booking.findMany({
      where: {
        cancellationStatus: status,
      },
      include: {
        customer: {
          include: {
            user: {
              select: { name: true, email: true },
            },
          },
        },
        provider: {
          include: {
            user: {
              select: { name: true, email: true },
            },
          },
        },
      },
      orderBy: {
        cancellationRequestedAt: 'asc',
      },
    })

    return NextResponse.json({ bookings, count: bookings.length })
  } catch (error: any) {
    console.error('[API] List cancellations error:', error)
    return NextResponse.json(
      { error: 'Failed to list cancellations' },
      { status: 500 }
    )
  }
}