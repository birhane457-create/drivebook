import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/cancellations?status=PENDING
 * List cancellation requests (admin only).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (user?.role !== 'SUPER_ADMIN' && user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

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