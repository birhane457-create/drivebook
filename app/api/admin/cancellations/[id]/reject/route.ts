import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { rejectCancellation } from '@/lib/services/booking-service'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/admin/cancellations/[id]/reject
 * Reject a pending cancellation (admin only).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    if (user?.role !== 'SUPERADMIN' && user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const bookingId = params.id
    const body = await request.json()
    const { reason } = body

    if (!reason || reason.trim() === '') {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      )
    }

    // Reject cancellation
    const result = await rejectCancellation(bookingId, session.user.id, reason)

    return NextResponse.json({
      success: true,
      booking: result.booking,
      message: 'Cancellation request rejected.',
    })
  } catch (error: any) {
    console.error('[API] Reject cancellation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to reject cancellation' },
      { status: 500 }
    )
  }
}