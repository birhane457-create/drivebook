import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { googleCalendarService } from '@/lib/services/googleCalendar'
import { emailService } from '@/lib/services/email'
import { validateTransition, getTransitionErrorMessage } from '@/lib/services/bookingStateMachine'
import { logBookingAction, AuditAction, ActorRole } from '@/lib/services/auditLogger'
import { bookingActionRateLimit, checkRateLimitStrict, getRateLimitIdentifier } from '@/lib/ratelimit'
import { notifyBookingCancelled, notifyClientBookingCancelled } from '@/lib/services/notifications'
import { getNotifChannels } from '@/lib/config/platform-settings'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Rate limiting
    const rateLimitId = getRateLimitIdentifier(
      user.id,
      req.headers.get('x-forwarded-for'),
      'booking-action'
    )
    const rateLimitResult = await checkRateLimitStrict(bookingActionRateLimit, rateLimitId)
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: rateLimitResult.error }, { status: 429, headers: rateLimitResult.headers })
    }

    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        client: true,
        instructor: { include: { user: true } }
      }
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Authorization
    const isInstructor = user.role === 'INSTRUCTOR' && booking.instructorId === session.user.instructorId
    const isClient = user.role === 'CLIENT' && booking.client?.userId === user.id
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'

    if (!isInstructor && !isClient && !isAdmin) {
      await logBookingAction({
        bookingId: params.id,
        action: AuditAction.UNAUTHORIZED_ATTEMPT,
        actorId: user.id,
        actorRole: user.role as ActorRole,
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
        success: false,
        errorMessage: 'Attempted to cancel booking they do not own',
        metadata: { bookingInstructorId: booking.instructorId, bookingClientId: booking.clientId }
      })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // State machine validation
    const validation = validateTransition(booking.status, 'CANCELLED')
    if (!validation.valid) {
      return NextResponse.json({ error: getTransitionErrorMessage(booking.status, 'CANCELLED') }, { status: 400 })
    }

    // Refund calculation — use the EARLIER of originalStartTime and currentStartTime.
    // This prevents the exploit: book far future → reschedule close → cancel for full refund.
    // Policy always applies to whichever start time is sooner.
    const now = new Date()
    const originalTime = new Date((booking as any).originalStartTime || booking.startTime || now)
    const currentTime = new Date(booking.startTime || now)
    const policyTime = originalTime < currentTime ? originalTime : currentTime
    const hoursUntilBooking = (policyTime.getTime() - now.getTime()) / (1000 * 60 * 60)
    const isPastBooking = hoursUntilBooking < 0
    const isNonRefundable = (booking as any).isNonRefundable === true

    let refundAmount = 0
    let refundPercentage = 0

    if (!isNonRefundable && !isPastBooking) {
      if (hoursUntilBooking >= 48) {
        refundPercentage = 100
        refundAmount = booking.price
      } else if (hoursUntilBooking >= 24) {
        refundPercentage = 50
        refundAmount = booking.price * 0.5
      }
    }

    // Process wallet refund if applicable
    if (refundAmount > 0) {
      const walletUserId = booking.client?.userId
      if (walletUserId) {
        const wallet = await prisma.clientWallet.findUnique({ where: { userId: walletUserId } })
        if (wallet) {
          await prisma.$transaction([
            prisma.clientWallet.update({
              where: { id: wallet.id },
              data: { balance: { increment: refundAmount } }
            }),
            prisma.walletTransaction.create({
              data: {
                walletId: wallet.id,
                amount: refundAmount,
                type: 'CREDIT',
                description: `Booking cancelled — ${refundPercentage}% refund`,
                status: 'COMPLETED'
              }
            })
          ])
        }
      }
    }

    // Atomic booking + transaction update
    const updated = await prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id: params.id },
        data: {
          status: 'CANCELLED',
          notes: `${booking.notes || ''}\n\nCancelled on ${now.toISOString()}. Refund: ${refundPercentage}% ($${refundAmount.toFixed(2)})`
        }
      })
      await (tx as any).transaction.updateMany({
        where: { bookingId: params.id },
        data: { status: 'CANCELLED' }
      })
      return updatedBooking
    })

    // Audit log
    await logBookingAction({
      bookingId: params.id,
      action: AuditAction.BOOKING_CANCELLED,
      actorId: user.id,
      actorRole: user.role as ActorRole,
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
      metadata: {
        refundPercentage,
        refundAmount,
        hoursNotice: Math.floor(hoursUntilBooking),
        cancelledBy: isInstructor ? 'instructor' : isClient ? 'client' : 'admin',
        isPastBooking,
        isNonRefundable
      }
    })

    // Google Calendar cleanup
    const googleEventId = (booking as any).googleCalendarEventId
    if (googleEventId && booking.instructor.syncGoogleCalendar) {
      try {
        await googleCalendarService.deleteCalendarEvent(booking.instructorId, googleEventId)
      } catch (e) {
        console.error('Failed to delete from Google Calendar:', e)
      }
    }

    const cancelChannels = getNotifChannels('BOOKING_CANCELLED');

    // In-app notifications
    try {
      if (cancelChannels.inApp && booking.instructor?.userId) {
        await notifyBookingCancelled(
          booking.instructor.userId,
          booking.client?.name || booking.clientName || 'Client',
          params.id
        )
      }
    } catch (e) { console.error('Instructor notification failed:', e) }

    try {
      if (cancelChannels.inApp && booking.client?.userId && (isInstructor || isAdmin)) {
        await notifyClientBookingCancelled(booking.client.userId, booking.instructor.name, params.id)
      }
    } catch (e) { console.error('Client notification failed:', e) }

    // ── Email to client ──────────────────────────────────────────────────────
    const bookingDateStr = booking.startTime
      ? new Date(booking.startTime).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : 'N/A'

    const refundHtml = (() => {
      if (refundAmount > 0) {
        return `<p>A refund of <strong>$${refundAmount.toFixed(2)} (${refundPercentage}%)</strong> has been credited to your DriveBook wallet.</p>`
      }
      if (isPastBooking) {
        return `<p>No refund applies — this lesson had already passed at the time of cancellation.</p>`
      }
      if (isNonRefundable) {
        return `<p>No refund applies — this booking was marked non-refundable (rescheduled inside the 24-hour window).</p>`
      }
      return `<p>No refund applies — cancellation was made with less than 24 hours notice.</p>`
    })()

    if (cancelChannels.email && booking.client?.email) {
      try {
        await emailService.sendGenericEmail({
          to: booking.client.email,
          subject: `Booking Cancelled — ${bookingDateStr}`,
          html: `
            <h2>Your booking has been cancelled</h2>
            <p>Hi ${booking.client.name},</p>
            <p>Your booking with <strong>${booking.instructor.name}</strong> on ${bookingDateStr} has been cancelled.</p>
            ${refundHtml}
            <p style="color:#6b7280;font-size:12px">Booking reference: ${params.id}</p>
          `
        })
      } catch (e) { console.error('Failed to send cancellation email to client:', e) }
    }

    // ── Email to instructor ──────────────────────────────────────────────────
    if (cancelChannels.email && booking.instructor?.user?.email) {
      try {
        await emailService.sendGenericEmail({
          to: booking.instructor.user.email,
          subject: `Booking Cancelled — ${booking.client?.name || booking.clientName || 'Client'}`,
          html: `
            <h2>Booking Cancelled</h2>
            <p>Hi ${booking.instructor.name},</p>
            <p>A booking with <strong>${booking.client?.name || booking.clientName || 'Client'}</strong> on ${bookingDateStr} has been cancelled.</p>
            <p>Refund to client: ${refundPercentage}% ($${refundAmount.toFixed(2)})</p>
            <p>This slot is now available for new bookings.</p>
          `
        })
      } catch (e) { console.error('Failed to send cancellation email to instructor:', e) }
    }

    return NextResponse.json({
      success: true,
      booking: updated,
      refund: {
        percentage: refundPercentage,
        amount: refundAmount,
        hoursNotice: Math.floor(hoursUntilBooking),
        isPastBooking
      }
    })
  } catch (error) {
    console.error('Cancel booking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
