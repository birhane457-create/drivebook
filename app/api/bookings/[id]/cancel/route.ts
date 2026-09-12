import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emailService } from '@/lib/services/email'
import { sendCancellationReceipt } from '@/lib/services/receipt-email'
import { getNotifChannels } from '@/lib/config/platform-settings'
import { createRefundTask } from '@/lib/services/taskManager'
import { enqueueNotification } from '@/lib/services/notificationRetry'
import { getDisplayName } from '@/lib/utils/account'
import { DEFAULT_TIMEZONE, resolveTimezone, timezoneFromState } from '@/lib/utils/timezone'
import { cancelBooking } from '@/lib/services/booking-service'

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

    const user = await prisma.user.findUnique({ where: { email: session!.user!.email } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const { reason } = body as { reason?: string }

    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: { customer: true,
        provider: { include: { user: true } },
      },
    }) as any

    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

    const bookingTimezone = booking.provider
      ? booking.provider.timezone
        ? resolveTimezone(booking.provider.timezone)
        : timezoneFromState(booking.provider.state)
      : DEFAULT_TIMEZONE

    // Authorization
    const isInstructor = user.role === 'provider' && booking.providerId === session!.user!.providerId
    const isClient = user.role === 'CLIENT' && booking.customer?.userId === user.id
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'

    if (!isInstructor && !isClient && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (booking.status === 'CANCELLED' || booking.status === 'COMPLETED') {
      return NextResponse.json({ error: `Cannot cancel a ${booking.status} booking` }, { status: 400 })
    }

    const now = new Date()
    const actorRole = isAdmin ? 'ADMIN' : isInstructor ? 'provider' : 'CLIENT'

    // Delegate all business logic (refund calc, wallet, ledger, audit) to BookingService
    let cancelResult: Awaited<ReturnType<typeof cancelBooking>>
    try {
      cancelResult = await cancelBooking(params.id, user.id, actorRole as any, reason)
    } catch (err: any) {
      if (err?.code === 'ALREADY_CANCELLED') {
        return NextResponse.json({ error: 'Booking has already been cancelled' }, { status: 400 })
      }
      throw err
    }

    const { refundAmount, refundPercentage, hoursNotice: hoursUntilBooking } = cancelResult
    const updated = cancelResult.booking
    const isPastBooking = hoursUntilBooking < 0
    const isNonRefundable = (booking as any).isNonRefundable === true

    // Create admin approval task for refunds > 24h (post-payout scenario)    // Create admin approval task for refunds > 24h (post-payout scenario)
    if (refundPercentage > 0 && hoursUntilBooking > 24 && booking.customer) {
      try {
        await createRefundTask({
          bookingId: params.id,
          customerId: booking.customer.id,
          amount: refundAmount,
          reason: reason || 'Client-initiated cancellation',
          contactName: booking.customer.name,
          contactEmail: booking.customer.email,
        });
      } catch (e) {
        console.error('Failed to create refund approval task:', e);
      }
    }


    // Email notifications (non-critical)
    const cancelChannels = getNotifChannels('BOOKING_CANCELLED')
    const bookingDateStr = booking.startTime
      ? new Date(booking.startTime).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: bookingTimezone })
      : 'N/A'

    if (cancelChannels.email && booking.customer?.email) {
      const refundNote = refundAmount > 0
        ? `A refund of $${refundAmount.toFixed(2)} (${refundPercentage}%) has been credited to your DriveBook wallet.`
        : isPastBooking ? 'No refund applies — this lesson had already passed.'
        : isNonRefundable ? 'No refund applies — this booking was non-refundable.'
        : 'No refund applies — less than 24 hours notice.'

      emailService.sendGenericEmail({
        from: 'DriveBook Bookings <bookings@drivebook.com.au>',
        to: booking.customer.email,
        subject: `Booking Cancelled — ${bookingDateStr}`,
        html: `<h2>Your booking has been cancelled</h2><p>Hi ${booking.customer.name},</p><p>Your booking with <strong>${getDisplayName(booking.provider)}</strong> on ${bookingDateStr} has been cancelled.</p><p>${refundNote}</p>`,
      }).catch(async (e) => {
        console.error('Cancel email to client failed:', e)
        await enqueueNotification({
          channel: 'EMAIL',
          recipient: booking.customer!.email,
          subject: `Booking Cancelled — ${bookingDateStr}`,
          body: `<h2>Your booking has been cancelled</h2><p>Hi ${booking.customer!.name},</p><p>Your booking with <strong>${getDisplayName(booking.provider)}</strong> on ${bookingDateStr} has been cancelled.</p><p>${refundNote}</p>`,
          idempotencyKey: `cancel-client-email-${params.id}`,
          bookingId: params.id,
          userId: booking.customer!.userId ?? undefined,
        })
      })

      // Send structured cancellation receipt to student
      try {
        const noRefundReason = isPastBooking ? 'lesson had already passed'
          : isNonRefundable ? 'booking was non-refundable'
          : 'less than 24 hours notice'
        const walletAfter = Number(booking.customer.userId
          ? (await prisma.clientWallet.findUnique({ where: { userId: booking.customer.userId } }))?.balance ?? 0
          : 0)
        await sendCancellationReceipt({
          customerName: booking.customer.name,
          customerEmail: booking.customer.email,
          receiptId: params.id,
          cancelledAt: now,
          instructorName: getDisplayName(booking.provider),
          lessonDate: new Date(booking.startTime!),
          lessonPrice: Number(booking.price),
          refundAmount,
          refundPercent: refundPercentage,
          walletBalanceAfter: walletAfter,
          cancelledBy: isInstructor ? 'provider' : isClient ? 'customer' : 'admin',
          noRefundReason: refundAmount === 0 ? noRefundReason : undefined,
        })
      } catch (e) {
        console.error('Cancellation receipt email failed:', e)
        await enqueueNotification({
          channel: 'EMAIL',
          recipient: booking.customer.email,
          subject: `Cancellation Receipt — ${bookingDateStr}`,
          body: `<p>Hi ${booking.customer.name}, your booking on ${bookingDateStr} was cancelled. Refund: $${refundAmount.toFixed(2)}. Log in to view details.</p>`,
          idempotencyKey: `cancel-receipt-email-${params.id}`,
          bookingId: params.id,
          userId: booking.customer.userId ?? undefined,
        })
      }
    }

    if (cancelChannels.email && booking.provider?.user?.email) {
      emailService.sendGenericEmail({
        from: 'DriveBook Bookings <bookings@drivebook.com.au>',
        to: booking.provider.user.email,
        subject: `Booking Cancelled — ${booking.customer?.name || booking.customerName || 'Client'}`,
        html: `<h2>Booking Cancelled</h2><p>Hi ${booking.provider.name},</p><p>A booking with <strong>${booking.customer?.name || booking.customerName || 'Client'}</strong> on ${bookingDateStr} has been cancelled.</p>`,
      }).catch(async (e) => {
        console.error('Cancel email to instructor failed:', e)
        await enqueueNotification({
          channel: 'EMAIL',
          recipient: booking.provider.user!.email,
          subject: `Booking Cancelled — ${booking.customer?.name || booking.customerName || 'Client'}`,
          body: `<h2>Booking Cancelled</h2><p>Hi ${booking.provider.name},</p><p>A booking with <strong>${booking.customer?.name || booking.customerName || 'Client'}</strong> on ${bookingDateStr} has been cancelled.</p>`,
          idempotencyKey: `cancel-instructor-email-${params.id}`,
          bookingId: params.id,
        })
      })
    }

    // Waiting list — notify first person waiting for a slot with this instructor (non-fatal)
    void import('@/lib/services/waiting-list-notify').then(({ notifyWaitingList }) =>
      notifyWaitingList({
        providerId: booking.providerId,
        slotDate: booking.startTime?.toISOString() ?? null,
        slotTime: booking.startTime
          ? booking.startTime.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: bookingTimezone })
          : null,
      })
    )

    return NextResponse.json({
      success: true,
      booking: updated,
      refund: { percentage: refundPercentage, amount: refundAmount, hoursNotice: Math.floor(hoursUntilBooking) },
    })
  } catch (error) {
    console.error('Cancel booking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
