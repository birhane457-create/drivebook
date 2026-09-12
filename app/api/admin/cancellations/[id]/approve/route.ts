import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { approveCancellation } from '@/lib/services/booking-service'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/admin/cancellations/[id]/approve
 * Approve a pending cancellation (admin only).
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
    const { overrideAmount, adminNote } = body

    // Approve cancellation (issues Stripe refund + wallet debit)
    const result = await approveCancellation(
      bookingId,
      session.user.id,
      overrideAmount,
      adminNote
    )

    return NextResponse.json({
      success: true,
      booking: result.booking,
      refundAmount: result.refundAmount,
      stripeRefundId: result.stripeRefundId,
      message: `Cancellation approved. Refunded $${result.refundAmount.toFixed(2)} to customer.`,
    })
  } catch (error: any) {
    console.error('[API] Approve cancellation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to approve cancellation' },
      { status: 500 }
    )
  }
}