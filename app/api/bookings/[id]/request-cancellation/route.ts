import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requestPackageCancellation } from '@/lib/services/booking-service'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/bookings/[id]/request-cancellation
 * Customer-initiated cancellation request.
 * Creates PENDING status for admin review.
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

    const bookingId = params.id
    const body = await request.json()
    const { reason } = body

    // Verify user owns this booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { customerId: true, customer: { select: { userId: true } } },
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const isOwner = booking.customer?.userId === session.user.id

    if (!isOwner) {
      return NextResponse.json(
        { error: 'Not authorized to cancel this booking' },
        { status: 403 }
      )
    }

    // Request cancellation
    const result = await requestPackageCancellation(
      bookingId,
      booking.customerId!,
      reason
    )

    return NextResponse.json({
      success: true,
      booking: result.booking,
      calculatedRefund: result.calculatedRefund,
      status: result.status,
      message: 'Cancellation request submitted. Admin will review within 24 hours.',
    })
  } catch (error: any) {
    console.error('[API] Request cancellation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to request cancellation' },
      { status: error.code === 'UNAUTHORIZED' ? 403 : 500 }
    )
  }
}