import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get booking
    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        startTime: true,
        price: true,
      }
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Check if booking can be cancelled
    const validStatuses = ['PENDING_PAYMENT', 'CONFIRMED', 'RESCHEDULED']
    if (!validStatuses.includes(booking.status)) {
      return NextResponse.json({
        bookingId: params.id,
        policy: {
          allowed: false,
          refundPercentage: 0,
          refundAmount: 0,
          reason: `Cannot cancel booking with status: ${booking.status}`
        },
        message: 'This booking cannot be cancelled'
      })
    }

    // Calculate refund based on cancellation policy
    const now = new Date()
    const bookingTimeForPolicy = (booking as any).originalBookingTime || booking.startTime
    const policyTime = new Date(bookingTimeForPolicy)
    const hoursUntilBooking = (policyTime.getTime() - now.getTime()) / (1000 * 60 * 60)

    let refundPercentage = 0
    let refundAmount = 0
    let message = ''

    if (hoursUntilBooking >= 48) {
      refundPercentage = 100
      refundAmount = booking.price
      message = 'Full refund available (48+ hours notice)'
    } else if (hoursUntilBooking >= 24) {
      refundPercentage = 50
      refundAmount = booking.price * 0.5
      message = '50% refund available (24-48 hours notice)'
    } else if (hoursUntilBooking > 0) {
      refundPercentage = 0
      refundAmount = 0
      message = 'No refund available (less than 24 hours notice)'
    } else {
      return NextResponse.json({
        bookingId: params.id,
        policy: {
          allowed: false,
          refundPercentage: 0,
          refundAmount: 0,
          reason: 'Booking time has passed'
        },
        message: 'Cannot cancel a booking that has already occurred'
      })
    }

    const cancellationFee = booking.price - refundAmount

    return NextResponse.json({
      bookingId: params.id,
      hoursBeforeLesson: Math.floor(hoursUntilBooking * 10) / 10, // Round to 1 decimal
      policy: {
        allowed: true,
        refundPercentage,
        cancellationFee,
        refundAmount,
        feeAmount: cancellationFee
      },
      message
    })
  } catch (error) {
    console.error('Get cancellation policy error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
