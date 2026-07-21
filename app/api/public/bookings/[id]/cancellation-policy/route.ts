import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/public/bookings/[id]/cancellation-policy
 *
 * Returns the refund eligibility for a booking without requiring authentication.
 * The AI MUST call this before presenting a cancellation to the caller — never
 * calculate or infer refund amounts client-side.
 *
 * Used by: AI voice agent, client self-service portal
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        price: true,
        startTime: true,
        isPaid: true,
        isNonRefundable: true,
        originalStartTime: true,
      },
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Terminal states — cancellation not applicable
    const terminalStates = ['CANCELLED', 'COMPLETED', 'EXPIRED', 'NO_SHOW']
    if (terminalStates.includes(booking.status)) {
      return NextResponse.json({
        bookingId: params.id,
        eligible: false,
        canCancel: false,
        refundPercentage: 0,
        refundAmount: 0,
        walletCredit: 0,
        reason: `Booking is already ${booking.status.toLowerCase()} — no action possible`,
        status: booking.status,
      })
    }

    // PENDING_PAYMENT — no payment captured yet, free cancel
    if (booking.status === 'PENDING_PAYMENT' || !booking.isPaid) {
      return NextResponse.json({
        bookingId: params.id,
        eligible: true,
        canCancel: true,
        isPendingPayment: true,
        refundPercentage: 0,
        refundAmount: 0,
        walletCredit: 0,
        reason: 'No payment captured — booking can be released immediately',
        status: booking.status,
      })
    }

    // Paid booking — calculate refund tier
    const now = new Date()
    const originalTime = new Date(
      (booking as any).originalStartTime || booking.startTime || now
    )
    const currentTime = new Date(booking.startTime || now)

    // Always anchor to the EARLIER of original vs current time
    // Prevents the exploit: book far future → reschedule close → cancel for full refund
    const policyTime = originalTime < currentTime ? originalTime : currentTime
    const hoursUntilLesson = (policyTime.getTime() - now.getTime()) / (1000 * 60 * 60)
    const isPastBooking = hoursUntilLesson < 0
    const isNonRefundable = (booking as any).isNonRefundable === true

    let refundPercentage = 0
    let refundAmount = 0
    let reason = ''

    // Read cancellation window from PlatformSettings — never hardcode
    const pricingSettings = await prisma.platformSettings.findFirst({
      select: { lateCancellationWindowHours: true },
    }).catch(() => null)
    const lateWindow = pricingSettings?.lateCancellationWindowHours ?? 24
    const fullRefundWindow = lateWindow * 2

    if (isPastBooking) {
      reason = 'Lesson has already passed — no refund applies'
    } else if (isNonRefundable) {
      reason = `Booking is marked non-refundable (instructor rescheduled within ${lateWindow}h window)`
    } else if (hoursUntilLesson >= fullRefundWindow) {
      refundPercentage = 100
      refundAmount = booking.price
      reason = `More than ${fullRefundWindow} hours notice — full refund applies`
    } else if (hoursUntilLesson >= lateWindow) {
      refundPercentage = 50
      refundAmount = parseFloat((booking.price * 0.5).toFixed(2))
      reason = `Between ${lateWindow} and ${fullRefundWindow} hours notice — 50% refund applies`
    } else {
      reason = `Less than ${lateWindow} hours notice — no refund applies`
    }

    return NextResponse.json({
      bookingId: params.id,
      eligible: true,
      canCancel: true,
      isPendingPayment: false,
      refundPercentage,
      refundAmount,
      walletCredit: refundAmount,
      hoursUntilLesson: parseFloat(hoursUntilLesson.toFixed(1)),
      reason,
      status: booking.status,
      lessonPrice: booking.price,
    })
  } catch (error) {
    console.error('Cancellation policy error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
