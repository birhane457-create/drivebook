 import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { googleCalendarService } from '@/lib/services/googleCalendar'
import { logBookingAction, AuditAction, ActorRole } from '@/lib/services/auditLogger'
import { emailService } from '@/lib/services/email'
import { DEFAULT_TIMEZONE, resolveTimezone, timezoneFromState } from '@/lib/utils/timezone'
import { bookingActionRateLimit, checkRateLimit, getRateLimitIdentifier } from '@/lib/ratelimit'
import { z } from 'zod'


export const dynamic = 'force-dynamic';
const updateSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']).optional(),
  notes: z.string().max(2000, 'Notes cannot exceed 2000 characters').optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  pickupAddress: z.string().max(500).optional(),
  dropoffAddress: z.string().max(500).optional(),
  // price is NOT accepted from the client — it's recomputed server-side
  // from duration changes to prevent price manipulation
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const data = updateSchema.parse(body)

    // Rate limiting — prevent automated booking manipulation
    const rlId = getRateLimitIdentifier(session.user.id, req.headers.get('x-forwarded-for'), 'booking-edit')
    const rl = await checkRateLimit(bookingActionRateLimit, rlId)
    if (!rl.success) {
      return NextResponse.json({ error: rl.error }, { status: 429, headers: rl.headers })
    }

    // Check if user is admin or instructor
    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN'
    const instructorId = session.user.instructorId

    // Only admins and instructors can edit bookings
    if (!isAdmin && !instructorId) {
      return NextResponse.json({ error: 'Unauthorized - must be admin or instructor' }, { status: 403 })
    }

    // Verify booking exists and user has permission
    const bookingWhere: any = { id: params.id }
    if (!isAdmin) {
      // Non-admins (instructors) can only edit their own bookings
      bookingWhere.instructorId = instructorId
    }

    const booking = await prisma.booking.findFirst({
      where: bookingWhere,
      include: {
        client: true,
        instructor: true
      }
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found or access denied' }, { status: 404 })
    }

    const bookingTimezone = booking.instructor
      ? booking.instructor.timezone
        ? resolveTimezone(booking.instructor.timezone)
        : timezoneFromState(booking.instructor.state)
      : DEFAULT_TIMEZONE

    // FIXED: Prevent editing completed or cancelled bookings
    if (booking.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Cannot edit completed bookings' },
        { status: 403 }
      )
    }

    // Issue 9 fix: reject soft-deleted bookings
    if ((booking as any).deletedAt) {
      return NextResponse.json(
        { error: 'Booking not found or access denied' },
        { status: 404 }
      )
    }

    if (booking.status === 'CANCELLED' && data.status !== 'CONFIRMED') {
      return NextResponse.json(
        { error: 'Cannot edit cancelled bookings except to reconfirm' },
        { status: 403 }
      )
    }

    // Issue 7 fix: block invalid state transitions
    // PENDING_PAYMENT → COMPLETED skips payment — must go through CONFIRMED first
    if (booking.status === 'PENDING_PAYMENT' && data.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Cannot mark a PENDING_PAYMENT booking as COMPLETED. Payment must be confirmed first.' },
        { status: 422 }
      )
    }
    // CANCELLED → CONFIRMED requires admin — instructors cannot reactivate cancelled bookings
    if (booking.status === 'CANCELLED' && data.status === 'CONFIRMED' && !isAdmin) {
      return NextResponse.json(
        { error: 'Only admins can reinstate a cancelled booking.' },
        { status: 403 }
      )
    }

    // Track changes for audit log
    const changes: Record<string, any> = {};
    if (data.status && data.status !== booking.status) changes.status = { from: booking.status, to: data.status };
    if (data.startTime) changes.startTime = { from: booking.startTime, to: new Date(data.startTime) };
    if (data.endTime) changes.endTime = { from: booking.endTime, to: new Date(data.endTime) };

    const newStart = data.startTime ? new Date(data.startTime) : null
    const newEnd   = data.endTime   ? new Date(data.endTime)   : null

    if (data.startTime && isNaN(new Date(data.startTime).getTime())) {
      return NextResponse.json({ error: 'Invalid startTime' }, { status: 400 })
    }
    if (data.endTime && isNaN(new Date(data.endTime).getTime())) {
      return NextResponse.json({ error: 'Invalid endTime' }, { status: 400 })
    }

    const effectiveStart = newStart ?? (booking.startTime as Date)
    const effectiveEnd = newEnd ?? (booking.endTime as Date)
    if (effectiveEnd <= effectiveStart) {
      return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 })
    }

    // Compute new price server-side from duration — never trust client-supplied price
    const lockedRate = (booking as any).lockedHourlyRate ?? booking.instructor?.hourlyRate ?? 60
    const newDurationHours = (effectiveEnd.getTime() - effectiveStart.getTime()) / 3_600_000
    const newPrice = parseFloat((lockedRate * newDurationHours).toFixed(2))
    const priceChanged = Math.abs(newPrice - booking.price) > 0.01
    if (priceChanged) changes.price = { from: booking.price, to: newPrice }

    const updated = await prisma.$transaction(async (tx) => {
      // ── Slot conflict check when time is being changed ──────────────────────
      if (newStart || newEnd) {
        const slotConflict = await tx.booking.findFirst({
          where: {
            instructorId: booking.instructorId,
            id: { not: params.id },
            status: { in: ['PENDING', 'PENDING_PAYMENT', 'CONFIRMED'] },
            OR: [
              { AND: [{ startTime: { gte: effectiveStart } }, { startTime: { lt: effectiveEnd } }] },
              { AND: [{ endTime:   { gt: effectiveStart } }, { endTime:   { lte: effectiveEnd } }] },
              { AND: [{ startTime: { lte: effectiveStart } }, { endTime:  { gte: effectiveEnd } }] },
            ],
          },
          select: { id: true },
        })
        if (slotConflict) throw new Error('SLOT_CONFLICT')
      }

      // Update booking — price always derived server-side
      const updatedBooking = await tx.booking.update({
        where: { id: params.id },
        data: {
          status:         data.status  ?? undefined,
          notes:          data.notes   ?? undefined,
          pickupAddress:  data.pickupAddress  ?? undefined,
          dropoffAddress: data.dropoffAddress ?? undefined,
          startTime: newStart ?? undefined,
          endTime:   newEnd   ?? undefined,
          ...(priceChanged ? {
            price: newPrice,
            duration: newDurationHours * 60,
          } : {}),
        },
        include: { client: true, instructor: true }
      })

      // ── Wallet adjustment if price changed ────────────────────────────────
      if (priceChanged && booking.client?.userId) {
        const priceDifference = newPrice - booking.price

        const wallet = await tx.clientWallet.findUnique({
          where: { userId: booking.client.userId }
        })

        if (wallet) {
          if (priceDifference > 0) {
            // Duration increased — deduct the difference
            const creditAgg = await tx.walletTransaction.aggregate({
              where: { walletId: wallet.id, status: 'CONFIRMED', type: 'CREDIT' },
              _sum: { amount: true },
            })
            const debitAgg = await tx.walletTransaction.aggregate({
              where: { walletId: wallet.id, status: 'CONFIRMED', type: 'DEBIT' },
              _sum: { amount: true },
            })
            const txBalance = (creditAgg._sum.amount ?? 0) - (debitAgg._sum.amount ?? 0)
            if (txBalance < priceDifference) {
              throw new Error(`INSUFFICIENT_BALANCE:${priceDifference.toFixed(2)}`)
            }
            await tx.walletTransaction.create({
              data: {
                walletId: wallet.id,
                type: 'DEBIT',
                amount: priceDifference,
                description: `Duration increase for booking on ${booking.startTime ? new Date(booking.startTime).toLocaleDateString('en-AU', { timeZone: bookingTimezone }) : 'N/A'}`,
                status: 'CONFIRMED',
              }
            })
            await tx.clientWallet.update({
              where: { id: wallet.id },
              data: { balance: { decrement: priceDifference } },
            })
          } else {
            // Duration reduced — refund the difference
            const refundAmount = Math.abs(priceDifference)
            await tx.walletTransaction.create({
              data: {
                walletId: wallet.id,
                type: 'CREDIT',
                amount: refundAmount,
                description: `Duration reduction for booking on ${booking.startTime ? new Date(booking.startTime).toLocaleDateString('en-AU', { timeZone: bookingTimezone }) : 'N/A'}`,
                status: 'CONFIRMED',
              }
            })
            await tx.clientWallet.update({
              where: { id: wallet.id },
              data: { balance: { increment: refundAmount } },
            })
          }

          // Update transaction record to match new price
          const existingTransaction = await (tx as any).transaction.findFirst({
            where: { bookingId: params.id }
          })
          if (existingTransaction) {
            const platformFee = newPrice * (booking.commissionRate || 0.15)
            const instructorPayout = newPrice - platformFee
            await (tx as any).transaction.update({
              where: { id: existingTransaction.id },
              data: { amount: newPrice, platformFee, instructorPayout }
            })
          }
        } else {
          console.warn(`[PATCH booking] Wallet adjustment skipped: no wallet for userId=${booking.client.userId}`)
          await tx.auditLog.create({
            data: {
              action: 'WALLET_REFUND_SKIPPED',
              actorId: session.user.id!,
              actorRole: 'INSTRUCTOR',
              targetType: 'BOOKING',
              targetId: params.id,
              success: false,
              metadata: { reason: 'Wallet not found', priceDifference, clientUserId: booking.client.userId },
            },
          }).catch(() => {})
        }
      }

      return updatedBooking
    })

    // FIXED: Add audit logging
    await logBookingAction({
      bookingId: params.id,
      action: AuditAction.BOOKING_UPDATED,
      actorId: session.user.id!,
      actorRole: (isAdmin ? 'ADMIN' : 'INSTRUCTOR') as ActorRole,
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
      metadata: { changes }
    })

    // Update Google Calendar event if exists and calendar is connected
    if ((updated as any).googleCalendarEventId && updated.instructor.syncGoogleCalendar) {
      try {
        await googleCalendarService.updateCalendarEvent(
          updated.instructorId,
          (updated as any).googleCalendarEventId,
          {
            startTime: updated.startTime as Date,
            endTime: updated.endTime as Date,
            clientName: updated.client?.name || '',
            clientPhone: updated.client?.phone || '',
            pickupAddress: updated.pickupAddress || undefined,
            notes: updated.notes || undefined
          }
        )
      } catch (calendarError) {
        console.error('Failed to update calendar event:', calendarError)
      }
    }

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    if ((error as Error).message === 'SLOT_CONFLICT') {
      return NextResponse.json({ error: 'The new time slot conflicts with an existing booking.' }, { status: 409 })
    }
    if ((error as Error).message?.startsWith('INSUFFICIENT_BALANCE:')) {
      const needed = (error as Error).message.split(':')[1]
      return NextResponse.json({ error: `Insufficient wallet balance. Need $${needed} more for the price increase.` }, { status: 422 })
    }
    console.error('Update booking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin or instructor
    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN'
    const instructorId = session.user.instructorId

    // Only admins and instructors can view bookings
    if (!isAdmin && !instructorId) {
      return NextResponse.json({ error: 'Unauthorized - must be admin or instructor' }, { status: 403 })
    }

    // Verify booking exists and user has permission
    const bookingWhere: any = { id: params.id }
    if (!isAdmin) {
      // Non-admins (instructors) can only view their own bookings
      bookingWhere.instructorId = instructorId
    }

    const booking = await prisma.booking.findFirst({
      where: bookingWhere,
      include: {
        client: {
          select: { id: true, name: true, phone: true, email: true, userId: true }
        },
        // Include instructor timezone fields so the detail page can display times correctly
        instructor: {
          select: { timezone: true, state: true }
        }
      }
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found or access denied' }, { status: 404 })
    }

    return NextResponse.json(booking)
  } catch (error) {
    console.error('Fetch booking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN'
    const instructorId = session.user.instructorId

    if (!isAdmin && !instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Rate limiting — prevent automated deletion spam
    const rlDeleteId = getRateLimitIdentifier(session.user.id, req.headers.get('x-forwarded-for'), 'booking-delete')
    const rlDelete = await checkRateLimit(bookingActionRateLimit, rlDeleteId)
    if (!rlDelete.success) {
      return NextResponse.json({ error: rlDelete.error }, { status: 429, headers: rlDelete.headers })
    }

    const bookingWhere: any = { id: params.id }
    if (!isAdmin) bookingWhere.instructorId = instructorId

    const booking = await prisma.booking.findFirst({
      where: bookingWhere,
      include: { instructor: { include: { user: true } }, client: true }
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found or access denied' }, { status: 404 })
    }

    if (booking.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Cannot delete completed bookings. Financial records must be retained.' },
        { status: 403 }
      )
    }

    const now = new Date()

    // Block deletion of paid future bookings — must use /cancel instead
    // which applies the correct refund policy. DELETE is only for unpaid or past bookings.
    if (booking.isPaid && booking.startTime && booking.startTime > now) {
      return NextResponse.json({
        error: 'Cannot delete a paid upcoming booking. Use the cancel endpoint to apply the correct refund policy.',
        useCancel: true,
      }, { status: 409 })
    }

    // For paid past bookings or bookings that passed without completion,
    // issue a full refund to the client wallet before soft-deleting
    let refundIssued = false
    if (booking.isPaid && booking.price > 0 && booking.client?.userId) {
      try {
        await prisma.$transaction(async (tx) => {
          const wallet = await tx.clientWallet.findUnique({
            where: { userId: booking.client!.userId! },
          })
          if (wallet) {
            await tx.walletTransaction.create({
              data: {
                walletId: wallet.id,
                type: 'CREDIT',
                amount: booking.price,
                description: `Refund — booking deleted (${booking.id.slice(-8)})`,
                status: 'CONFIRMED',
              },
            })
            await tx.clientWallet.update({
              where: { id: wallet.id },
              data: { balance: { increment: booking.price } },
            })
          }
        })
        refundIssued = true
      } catch (refundErr) {
        console.error('Refund on delete failed — proceeding with soft delete:', refundErr)
      }
    }

    // Soft delete — data is NEVER hard deleted
    await prisma.booking.update({
      where: { id: params.id },
      data: {
        status: 'CANCELLED',
        deletedAt: now,
        deletedBy: session.user.id,
      } as any
    })

    // Write immutable audit log entry with full booking snapshot
    try {
      await prisma.auditLog.create({
        data: {
          action: 'BOOKING_DELETED',
          actorId: session.user.id!,
          actorRole: isAdmin ? 'ADMIN' : 'INSTRUCTOR',
          targetType: 'BOOKING',
          targetId: params.id,
          ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
          userAgent: req.headers.get('user-agent') || 'unknown',
          metadata: {
            // Full snapshot before deletion — court-ready evidence
            bookingSnapshot: {
              id: booking.id,
              clientId: booking.clientId,
              clientName: booking.client?.name,
              instructorId: booking.instructorId,
              instructorName: booking.instructor?.name,
              startTime: booking.startTime,
              endTime: booking.endTime,
              price: booking.price,
              status: booking.status,
              isPaid: booking.isPaid,
              createdAt: booking.createdAt,
            },
            deletedAt: now.toISOString(),
            deletedBy: session.user.id,
            deletedByRole: isAdmin ? 'ADMIN' : 'INSTRUCTOR',
          }
        }
      })
    } catch (auditError) {
      console.error('Audit log failed for booking deletion:', auditError)
    }

    // Email client when booking is removed from list
    if (booking.client?.email) {
      const isPastBooking = booking.startTime && booking.startTime < now
      // Resolve timezone for this booking's context — booking.instructor is included above
      const deleteBookingTimezone = booking.instructor
        ? booking.instructor.timezone
          ? resolveTimezone(booking.instructor.timezone)
          : timezoneFromState(booking.instructor.state)
        : DEFAULT_TIMEZONE
      const bookingDateStr = booking.startTime
        ? new Date(booking.startTime).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: deleteBookingTimezone })
        : 'N/A'
      const bookingTimeStr = booking.startTime
        ? new Date(booking.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: deleteBookingTimezone })
        : 'N/A'
      const cancelNote = isPastBooking
        ? 'No refund applies — this lesson had already passed at the time of cancellation.'
        : 'If a refund applies, it will be credited to your DriveBook wallet.'

      try {
        await emailService.sendGenericEmail({
          from: 'DriveBook Bookings <bookings@drivebook.com.au>',
          to: booking.client.email,
          subject: `Booking Cancelled — ${bookingDateStr}`,
          html: `
            <h2>Booking Cancelled</h2>
            <p>Hi ${booking.client.name},</p>
            <p>Your driving lesson with <strong>${booking.instructor?.name}</strong> has been cancelled.</p>
            <table style="border-collapse:collapse;width:100%;margin:16px 0">
              <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600">Date</td>
                  <td style="padding:8px;border:1px solid #e5e7eb">${bookingDateStr}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600">Time</td>
                  <td style="padding:8px;border:1px solid #e5e7eb">${bookingTimeStr}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600">Reference</td>
                  <td style="padding:8px;border:1px solid #e5e7eb;font-family:monospace">${booking.id}</td></tr>
            </table>
            <p>${cancelNote}</p>
            <p style="color:#6b7280;font-size:12px">If you believe this was an error, please contact support with your booking reference above.</p>
          `
        })
      } catch (emailError) {
        console.error('Failed to send deletion email to client:', emailError)
      }
    }

    // In-app notification to client
    try {
      if (booking.client?.userId) {
        const { notifyClientBookingCancelled } = await import('@/lib/services/notifications')
        await notifyClientBookingCancelled(
          booking.client.userId,
          booking.instructor?.name || 'Your instructor',
          params.id,
          booking.instructor ?? undefined
        )
      }
    } catch (notifError) {
      console.error('Failed to send client notification:', notifError)
    }

    // Delete from Google Calendar if connected
    if ((booking as any).googleCalendarEventId && booking.instructor?.syncGoogleCalendar) {
      try {
        await googleCalendarService.deleteCalendarEvent(
          booking.instructorId,
          (booking as any).googleCalendarEventId
        )
      } catch (calendarError) {
        console.error('Failed to delete calendar event:', calendarError)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Booking cancelled. Record retained for audit purposes.',
      refundIssued,
      auditId: params.id
    })
  } catch (error) {
    console.error('Delete booking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
