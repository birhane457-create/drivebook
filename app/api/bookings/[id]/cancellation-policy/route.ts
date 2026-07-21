import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * GET /api/bookings/:id/cancellation-policy
 *
 * Returns cancellation eligibility and exact refund amount for a booking.
 * Called by the AI voice receptionist BEFORE cancelling — ensures the AI
 * always quotes the correct refund amount and never cancels an ineligible booking.
 *
 * Auth: either an authenticated session (instructor/admin) OR
 *       the x-api-key header (voice service internal call).
 *
 * Response fields used by the AI:
 *   - canCancel: boolean — false means stop, don't proceed
 *   - isPendingPayment: boolean — true means skip OTP, single confirmation
 *   - refundAmount: number — exact dollar amount to quote verbally
 *   - refundPercentage: 0 | 50 | 100
 *   - hoursUntilLesson: number — negative means lesson has passed
 *   - reason: string — human-readable explanation for the refund tier
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bookingId = params.id

    // Auth: voice service key or authenticated session
    // Accepts either:
    //   x-api-key: VOICE_SERVICE_API_KEY  (Railway → Vercel internal key)
    //   x-vapi-secret: VAPI_WEBHOOK_SECRET (direct Vapi tool call, forwarded by proxy)
    const apiKey = req.headers.get('x-api-key')
    const vapiSecret = req.headers.get('x-vapi-secret')
    const isVoiceService =
      (apiKey && apiKey === process.env.VOICE_SERVICE_API_KEY) ||
      (vapiSecret && vapiSecret === process.env.VAPI_WEBHOOK_SECRET)

    if (!isVoiceService) {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        startTime: true,
        isPaid: true,
        paidAt: true,
        price: true,
        packageTotalPaid: true,
        isNonRefundable: true,
        cancelledAt: true,
        deletedAt: true,
        instructor: {
          select: { name: true },
        },
      },
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Already cancelled or deleted
    if (booking.cancelledAt || booking.deletedAt || booking.status === 'CANCELLED') {
      return NextResponse.json({
        canCancel: false,
        isPendingPayment: false,
        refundPercentage: 0,
        refundAmount: 0,
        hoursUntilLesson: null,
        reason: 'This booking has already been cancelled.',
      })
    }

    const isPendingPayment = booking.status === 'PENDING_PAYMENT'
    const isPending = booking.status === 'PENDING' // short-notice, awaiting approval
    const isConfirmed = booking.status === 'CONFIRMED'

    // Only these statuses can be cancelled
    const canCancel = isPendingPayment || isPending || isConfirmed

    if (!canCancel) {
      return NextResponse.json({
        canCancel: false,
        isPendingPayment: false,
        refundPercentage: 0,
        refundAmount: 0,
        hoursUntilLesson: null,
        reason: `Booking with status "${booking.status}" cannot be cancelled.`,
      })
    }

    // Unpaid booking — no refund calculation needed
    if (isPendingPayment) {
      return NextResponse.json({
        canCancel: true,
        isPendingPayment: true,
        refundPercentage: 0,
        refundAmount: 0,
        hoursUntilLesson: booking.startTime
          ? Math.round(
              ((booking.startTime.getTime() - Date.now()) / (1000 * 60 * 60)) * 10
            ) / 10
          : null,
        reason: 'Booking has not been paid — slot will be released immediately, no refund required.',
      })
    }

    // Calculate refund based on notice period
    const now = Date.now()
    const lessonStart = booking.startTime ? booking.startTime.getTime() : null
    const hoursUntilLesson = lessonStart
      ? Math.round(((lessonStart - now) / (1000 * 60 * 60)) * 10) / 10
      : null

    // Non-refundable booking (set by instructor policy or short-notice window)
    if (booking.isNonRefundable) {
      return NextResponse.json({
        canCancel: true,
        isPendingPayment: false,
        refundPercentage: 0,
        refundAmount: 0,
        hoursUntilLesson,
        reason: 'This booking is non-refundable.',
      })
    }

    // Lesson has already passed
    if (hoursUntilLesson !== null && hoursUntilLesson < 0) {
      return NextResponse.json({
        canCancel: false,
        isPendingPayment: false,
        refundPercentage: 0,
        refundAmount: 0,
        hoursUntilLesson,
        reason: 'The lesson has already taken place.',
      })
    }

    // Get platform refund policy thresholds
    const settings = await prisma.platformSettings.findFirst({
      select: { lateCancellationWindowHours: true },
    })
    const lateWindow = settings?.lateCancellationWindowHours ?? 24
    const fullRefundWindow = lateWindow * 2

    // Standard tiered refund policy:
    //   fullRefundWindow+ hours notice  → 100%
    //   lateWindow–fullRefundWindow     → 50%
    //   < lateWindow                    → 0%
    let refundPercentage = 0
    let reason = `Less than ${lateWindow} hours notice — no refund.`

    if (hoursUntilLesson === null || hoursUntilLesson >= fullRefundWindow) {
      refundPercentage = 100
      reason = `${fullRefundWindow}+ hours notice — full refund.`
    } else if (hoursUntilLesson >= lateWindow) {
      refundPercentage = 50
      reason = `${lateWindow}–${fullRefundWindow} hours notice — 50% refund.`
    }

    // Use packageTotalPaid if this is a package booking, otherwise use price
    const basis = booking.packageTotalPaid ?? booking.price ?? 0
    const refundAmount = Math.round(basis * (refundPercentage / 100) * 100) / 100

    return NextResponse.json({
      canCancel: true,
      isPendingPayment: false,
      refundPercentage,
      refundAmount,
      hoursUntilLesson,
      reason,
    })
  } catch (error) {
    console.error('Cancellation policy fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
