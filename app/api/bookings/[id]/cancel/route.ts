import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emailService } from '@/lib/services/email'
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

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const { reason } = body as { reason?: string }

    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        client: true,
        instructor: { include: { user: true } },
      },
    })

    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

    // Authorization
    const isInstructor = user.role === 'INSTRUCTOR' && booking.instructorId === session.user.instructorId
    const isClient = user.role === 'CLIENT' && booking.client?.userId === user.id
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'

    if (!isInstructor && !isClient && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (booking.status === 'CANCELLED' || booking.status === 'COMPLETED') {
      return NextResponse.json({ error: `Cannot cancel a ${booking.status} booking` }, { status: 400 })
    }

    // Refund calculation — use the EARLIER of originalStartTime and currentStartTime
    // Prevents exploit: book far future → reschedule close → cancel for full refund
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
        refundAmount = parseFloat((booking.price * 0.5).toFixed(2))
      }
    }

    // Single atomic transaction — wallet credit + booking update + transaction update
    const updated = await prisma.$transaction(async (tx) => {
      // Wallet refund if applicable
      if (refundAmount > 0 && booking.client?.userId) {
        const wallet = await tx.clientWallet.findUnique({ where: { userId: booking.client.userId } })
        if (wallet) {
          await tx.clientWallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: refundAmount } },
          })
          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              amount: refundAmount,
              type: 'CREDIT',
              description: `Booking cancelled — ${refundPercentage}% refund`,
              status: 'CONFIRMED',
            },
          })
        }
      }

      // Update booking status
      const updatedBooking = await tx.booking.update({
        where: { id: params.id },
        data: {
          status: 'CANCELLED',
          notes: `${booking.notes || ''}\n\nCancelled ${now.toISOString()}. Refund: ${refundPercentage}% ($${refundAmount.toFixed(2)})`.trim(),
        },
      })

      // Update transaction status
      await (tx as any).transaction.updateMany({
        where: { bookingId: params.id },
        data: { status: 'CANCELLED' },
      })

      return updatedBooking
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'BOOKING_CANCELLED',
        actorId: user.id,
        actorRole: user.role,
        targetType: 'BOOKING',
        targetId: params.id,
        success: true,
        metadata: {
          refundPercentage,
          refundAmount,
          hoursNotice: Math.floor(hoursUntilBooking),
          cancelledBy: isInstructor ? 'instructor' : isClient ? 'client' : 'admin',
          isPastBooking,
          isNonRefundable,
          reason: reason || null,
        } as any,
      },
    })

    // Email notifications (non-critical)
    const cancelChannels = getNotifChannels('BOOKING_CANCELLED')
    const bookingDateStr = booking.startTime
      ? new Date(booking.startTime).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : 'N/A'

    if (cancelChannels.email && booking.client?.email) {
      const refundNote = refundAmount > 0
        ? `A refund of $${refundAmount.toFixed(2)} (${refundPercentage}%) has been credited to your DriveBook wallet.`
        : isPastBooking ? 'No refund applies — this lesson had already passed.'
        : isNonRefundable ? 'No refund applies — this booking was non-refundable.'
        : 'No refund applies — less than 24 hours notice.'

      emailService.sendGenericEmail({
        to: booking.client.email,
        subject: `Booking Cancelled — ${bookingDateStr}`,
        html: `<h2>Your booking has been cancelled</h2><p>Hi ${booking.client.name},</p><p>Your booking with <strong>${booking.instructor.name}</strong> on ${bookingDateStr} has been cancelled.</p><p>${refundNote}</p>`,
      }).catch(e => console.error('Cancel email to client failed:', e))
    }

    if (cancelChannels.email && booking.instructor?.user?.email) {
      emailService.sendGenericEmail({
        to: booking.instructor.user.email,
        subject: `Booking Cancelled — ${booking.client?.name || booking.clientName || 'Client'}`,
        html: `<h2>Booking Cancelled</h2><p>Hi ${booking.instructor.name},</p><p>A booking with <strong>${booking.client?.name || booking.clientName || 'Client'}</strong> on ${bookingDateStr} has been cancelled.</p>`,
      }).catch(e => console.error('Cancel email to instructor failed:', e))
    }

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
