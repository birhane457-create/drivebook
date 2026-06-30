import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emailService } from '@/lib/services/email'
import { sendCancellationReceipt } from '@/lib/services/receipt-email'
import { getNotifChannels } from '@/lib/config/platform-settings'
import { createRefundTask } from '@/lib/services/taskManager'
import { recordFullRefund, recordPartialRefund } from '@/lib/services/ledger-operations'
import { enqueueNotification, drainRetryQueueAsync } from '@/lib/services/notificationRetry'

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
    // FIX #1: Use updateMany with atomic status guard to prevent double-cancel under concurrency.
    // FIX #2: Never write to ClientWallet.balance directly — always insert a WalletTransaction
    //         so getWalletBalance() (ledger-derived) remains the single source of truth.
    let updated: any
    try {
      updated = await prisma.$transaction(async (tx) => {
        // Atomically claim this cancellation — only succeeds if status is still cancellable
        const guard = await tx.booking.updateMany({
          where: {
            id: params.id,
            status: { notIn: ['CANCELLED', 'COMPLETED', 'EXPIRED', 'NO_SHOW'] },
          },
          data: {
            status: 'CANCELLED',
            notes: `${booking.notes || ''}\n\nCancelled ${now.toISOString()}. Refund: ${refundPercentage}% ($${refundAmount.toFixed(2)})`.trim(),
          },
        })

        // If count === 0, another request already cancelled it — roll back cleanly
        if (guard.count === 0) {
          throw Object.assign(new Error('ALREADY_CANCELLED'), { code: 'ALREADY_CANCELLED' })
        }

        // Wallet refund — insert a transaction record only (no stored balance write)
        if (refundAmount > 0 && booking.client?.userId) {
          const wallet = await tx.clientWallet.findUnique({ where: { userId: booking.client.userId } })
          if (wallet) {
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

        // Update transaction status
        await (tx as any).transaction.updateMany({
          where: { bookingId: params.id },
          data: { status: 'CANCELLED' },
        })

        return await tx.booking.findUnique({ where: { id: params.id } })
      })
    } catch (err: any) {
      if (err?.code === 'ALREADY_CANCELLED') {
        return NextResponse.json({ error: 'Booking has already been cancelled' }, { status: 400 })
      }
      throw err
    }

    // Create admin approval task for refunds > 24h (post-payout scenario)
    if (refundPercentage > 0 && hoursUntilBooking > 24 && booking.client) {
      try {
        await createRefundTask({
          bookingId: params.id,
          clientId: booking.client.id,
          amount: refundAmount,
          reason: reason || 'Client-initiated cancellation',
          contactName: booking.client.name,
          contactEmail: booking.client.email,
        });
      } catch (e) {
        console.error('Failed to create refund approval task:', e);
      }
    }

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
          taskCreated: refundPercentage > 0 && hoursUntilBooking > 24,
        } as any,
      },
    })

    // FinancialLedger — record refund with deterministic idempotency keys (non-critical)
    // Uses params.id (bookingId) as the stable anchor for idempotency keys.
    // Safe to retry — duplicate idempotencyKey is silently ignored.
    if (refundAmount > 0 && booking.client?.userId) {
      try {
        const refundId = `cancel-${params.id}` // stable, derived from bookingId
        const args = {
          refundId,
          bookingId: params.id,
          userId: booking.client.userId,
          instructorId: booking.instructorId,
          totalAmount: refundAmount,
          platformFee: booking.platformFee ?? 0,
          instructorPayout: booking.instructorPayout ?? 0,
          reason: reason || `${refundPercentage}% cancellation refund`,
          createdBy: user.id,
        }
        if (refundPercentage === 100) {
          await recordFullRefund(args)
        } else {
          await recordPartialRefund({
            ...args,
            refundAmount,
            refundPercentage,
            originalPlatformFee: booking.platformFee ?? 0,
            originalInstructorPayout: booking.instructorPayout ?? 0,
          })
        }
      } catch (ledgerErr) {
        console.error('[Ledger] Failed to record cancellation refund (non-critical):', ledgerErr)
      }
    }

    // Email notifications (non-critical)
    const cancelChannels = getNotifChannels('BOOKING_CANCELLED')
    const bookingDateStr = booking.startTime
      ? new Date(booking.startTime).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Perth' })
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
      }).catch(async (e) => {
        console.error('Cancel email to client failed:', e)
        await enqueueNotification({
          channel: 'EMAIL',
          recipient: booking.client!.email,
          subject: `Booking Cancelled — ${bookingDateStr}`,
          body: `<h2>Your booking has been cancelled</h2><p>Hi ${booking.client!.name},</p><p>Your booking with <strong>${booking.instructor.name}</strong> on ${bookingDateStr} has been cancelled.</p><p>${refundNote}</p>`,
          idempotencyKey: `cancel-client-email-${params.id}`,
          bookingId: params.id,
          userId: booking.client!.userId ?? undefined,
        })
      })

      // Send structured cancellation receipt to student
      try {
        const noRefundReason = isPastBooking ? 'lesson had already passed'
          : isNonRefundable ? 'booking was non-refundable'
          : 'less than 24 hours notice'
        const walletAfter = booking.client.userId
          ? (await prisma.clientWallet.findUnique({ where: { userId: booking.client.userId } }))?.balance ?? 0
          : 0
        await sendCancellationReceipt({
          clientName: booking.client.name,
          clientEmail: booking.client.email,
          receiptId: params.id,
          cancelledAt: now,
          instructorName: booking.instructor.name,
          lessonDate: new Date(booking.startTime!),
          lessonPrice: booking.price,
          refundAmount,
          refundPercent: refundPercentage,
          walletBalanceAfter: walletAfter,
          cancelledBy: isInstructor ? 'instructor' : isClient ? 'client' : 'admin',
          noRefundReason: refundAmount === 0 ? noRefundReason : undefined,
        })
      } catch (e) {
        console.error('Cancellation receipt email failed:', e)
        await enqueueNotification({
          channel: 'EMAIL',
          recipient: booking.client.email,
          subject: `Cancellation Receipt — ${bookingDateStr}`,
          body: `<p>Hi ${booking.client.name}, your booking on ${bookingDateStr} was cancelled. Refund: $${refundAmount.toFixed(2)}. Log in to view details.</p>`,
          idempotencyKey: `cancel-receipt-email-${params.id}`,
          bookingId: params.id,
          userId: booking.client.userId ?? undefined,
        })
      }
    }

    if (cancelChannels.email && booking.instructor?.user?.email) {
      emailService.sendGenericEmail({
        to: booking.instructor.user.email,
        subject: `Booking Cancelled — ${booking.client?.name || booking.clientName || 'Client'}`,
        html: `<h2>Booking Cancelled</h2><p>Hi ${booking.instructor.name},</p><p>A booking with <strong>${booking.client?.name || booking.clientName || 'Client'}</strong> on ${bookingDateStr} has been cancelled.</p>`,
      }).catch(async (e) => {
        console.error('Cancel email to instructor failed:', e)
        await enqueueNotification({
          channel: 'EMAIL',
          recipient: booking.instructor.user!.email,
          subject: `Booking Cancelled — ${booking.client?.name || booking.clientName || 'Client'}`,
          body: `<h2>Booking Cancelled</h2><p>Hi ${booking.instructor.name},</p><p>A booking with <strong>${booking.client?.name || booking.clientName || 'Client'}</strong> on ${bookingDateStr} has been cancelled.</p>`,
          idempotencyKey: `cancel-instructor-email-${params.id}`,
          bookingId: params.id,
        })
      })
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
