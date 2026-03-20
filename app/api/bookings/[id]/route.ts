import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { googleCalendarService } from '@/lib/services/googleCalendar'
import { logBookingAction, AuditAction, ActorRole } from '@/lib/services/auditLogger'
import { getWalletBalance, getOrCreateWallet } from '@/lib/services/wallet-helpers'
import { emailService } from '@/lib/services/email'
import { z } from 'zod'


export const dynamic = 'force-dynamic';
const updateSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']).optional(),
  notes: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  pickupAddress: z.string().optional(),
  dropoffAddress: z.string().optional(),
  price: z.number().optional(),
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

    // FIXED: Prevent editing completed or cancelled bookings
    if (booking.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Cannot edit completed bookings' },
        { status: 403 }
      )
    }

    if (booking.status === 'CANCELLED' && data.status !== 'CONFIRMED') {
      return NextResponse.json(
        { error: 'Cannot edit cancelled bookings except to reconfirm' },
        { status: 403 }
      )
    }

    // Track changes for audit log
    const changes: Record<string, any> = {};
    if (data.status && data.status !== booking.status) changes.status = { from: booking.status, to: data.status };
    if (data.price && data.price !== booking.price) changes.price = { from: booking.price, to: data.price };
    if (data.startTime) changes.startTime = { from: booking.startTime, to: new Date(data.startTime) };
    if (data.endTime) changes.endTime = { from: booking.endTime, to: new Date(data.endTime) };

    // FIXED: Use transaction wrapper for atomic updates
    const updated = await prisma.$transaction(async (tx) => {
      // Update booking
      const updatedBooking = await tx.booking.update({
        where: { id: params.id },
        data: {
          ...data,
          startTime: data.startTime ? new Date(data.startTime) : undefined,
          endTime: data.endTime ? new Date(data.endTime) : undefined,
        },
        include: {
          client: true,
          instructor: true
        }
      })

      // If price changed and transaction exists, update it
      if (data.price && data.price !== booking.price) {
        const priceDifference = data.price - booking.price;
        
        // If price increased, need to charge the client
        if (priceDifference > 0 && booking.client?.userId) {
          // Check if client has wallet
          const wallet = await tx.clientWallet.findUnique({
            where: { userId: booking.client.userId }
          });

          if (wallet) {
            // ✅ P0 FIX #2: Calculate balance from transactions
            const { balance } = await getWalletBalance(booking.client.userId);
            
            // Check if client has enough balance
            if (balance < priceDifference) {
              throw new Error(`Insufficient wallet balance. Need $${priceDifference.toFixed(2)} more for the duration increase.`);
            }

            // Create wallet transaction (debit)
            await tx.walletTransaction.create({
              data: {
                walletId: wallet.id,
                type: 'DEBIT',
                amount: priceDifference,
                description: `Duration increase for booking on ${booking.startTime ? new Date(booking.startTime).toLocaleDateString() : 'N/A'}`,
                status: 'CONFIRMED'
              }
            });
          }
        }
        
        // If price decreased, refund the client
        if (priceDifference < 0 && booking.client?.userId) {
          const refundAmount = Math.abs(priceDifference);
          
          const wallet = await tx.clientWallet.findUnique({
            where: { userId: booking.client.userId }
          });

          if (wallet) {
            // Create wallet transaction (credit)
            await tx.walletTransaction.create({
              data: {
                walletId: wallet.id,
                type: 'CREDIT',
                amount: refundAmount,
                description: `Duration reduction for booking on ${booking.startTime ? new Date(booking.startTime).toLocaleDateString() : 'N/A'}`,
                status: 'CONFIRMED'
              }
            });
          }
        }

        const existingTransaction = await (tx as any).transaction.findFirst({
          where: { bookingId: params.id }
        })

        if (existingTransaction) {
          // Recalculate commission
          const platformFee = data.price * (booking.commissionRate || 0.15)
          const instructorPayout = data.price - platformFee

          await (tx as any).transaction.update({
            where: { id: existingTransaction.id },
            data: {
              amount: data.price,
              platformFee,
              instructorPayout
            }
          })
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
        client: true
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
      await (prisma as any).auditLog.create({
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
      const bookingDateStr = booking.startTime
        ? new Date(booking.startTime).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        : 'N/A'
      const bookingTimeStr = booking.startTime
        ? new Date(booking.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
        : 'N/A'
      const cancelNote = isPastBooking
        ? 'No refund applies — this lesson had already passed at the time of cancellation.'
        : 'If a refund applies, it will be credited to your DriveBook wallet.'

      try {
        await emailService.sendGenericEmail({
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
          params.id
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
      auditId: params.id
    })
  } catch (error) {
    console.error('Delete booking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
