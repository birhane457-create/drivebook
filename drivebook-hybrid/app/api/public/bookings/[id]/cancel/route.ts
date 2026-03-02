import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'


export const dynamic = 'force-dynamic';
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { reason } = body

    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        client: true,
        instructor: {
          include: { user: true }
        }
      }
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Calculate refund
    const now = new Date()
    const bookingTime = new Date(booking.startTime)
    const hoursUntilBooking = (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60)

    let refundPercentage = 0
    let refundAmount = 0

    if (hoursUntilBooking >= 48) {
      refundPercentage = 100
      refundAmount = booking.price
    } else if (hoursUntilBooking >= 24) {
      refundPercentage = 50
      refundAmount = booking.price * 0.5
    }

    // Update booking
    const updated = await prisma.booking.update({
      where: { id: params.id },
      data: {
        status: 'CANCELLED',
        notes: `${booking.notes || ''}\n\nCancelled: ${reason || 'No reason provided'}. Refund: ${refundPercentage}%`
      }
    })

    return NextResponse.json({
      success: true,
      booking: updated,
      refund: {
        percentage: refundPercentage,
        amount: refundAmount
      }
    })
  } catch (error) {
    console.error('Cancel booking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
