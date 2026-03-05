import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { googleCalendarService } from '@/lib/services/googleCalendar'
import { logBookingAction, AuditAction, ActorRole } from '@/lib/services/auditLogger'
import { z } from 'zod'


export const dynamic = 'force-dynamic';
const updateSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']).optional(),
  notes: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  pickupAddress: z.string().optional(),
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
            // Check if client has enough balance
            if (wallet.creditsRemaining < priceDifference) {
              throw new Error(`Insufficient wallet balance. Need $${priceDifference.toFixed(2)} more for the duration increase.`);
            }

            // Deduct from wallet
            await tx.clientWallet.update({
              where: { userId: booking.client.userId },
              data: {
                creditsRemaining: { decrement: priceDifference },
                totalSpent: { increment: priceDifference },
                version: { increment: 1 }
              }
            });

            // Create wallet transaction
            await tx.walletTransaction.create({
              data: {
                walletId: wallet.id,
                type: 'debit',
                amount: -priceDifference,
                description: `Duration increase for booking on ${new Date(booking.startTime).toLocaleDateString()}`,
                status: 'completed'
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
            // Add to wallet
            await tx.clientWallet.update({
              where: { userId: booking.client.userId },
              data: {
                creditsRemaining: { increment: refundAmount },
                version: { increment: 1 }
              }
            });

            // Create wallet transaction
            await tx.walletTransaction.create({
              data: {
                walletId: wallet.id,
                type: 'credit',
                amount: refundAmount,
                description: `Duration reduction for booking on ${new Date(booking.startTime).toLocaleDateString()}`,
                status: 'completed'
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
    if (updated.googleCalendarEventId && updated.instructor.syncGoogleCalendar) {
      try {
        await googleCalendarService.updateCalendarEvent(
          updated.instructorId,
          updated.googleCalendarEventId,
          {
            startTime: updated.startTime,
            endTime: updated.endTime,
            clientName: updated.client.name,
            clientPhone: updated.client.phone,
            pickupAddress: updated.pickupAddress || undefined,
            notes: updated.notes || undefined
          }
        )
      } catch (calendarError) {
        console.error('Failed to update calendar event:', calendarError)
        // Don't fail the booking update if calendar update fails
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

    // Check if user is admin or instructor
    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN'
    const instructorId = session.user.instructorId

    // Only admins and instructors can delete bookings
    if (!isAdmin && !instructorId) {
      return NextResponse.json({ error: 'Unauthorized - must be admin or instructor' }, { status: 403 })
    }

    // Verify booking exists and user has permission
    const bookingWhere: any = { id: params.id }
    if (!isAdmin) {
      // Non-admins (instructors) can only delete their own bookings
      bookingWhere.instructorId = instructorId
    }

    const booking = await prisma.booking.findFirst({
      where: bookingWhere,
      include: {
        instructor: true
      }
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found or access denied' }, { status: 404 })
    }

    // FIXED: Prevent deleting completed bookings (financial records)
    if (booking.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Cannot delete completed bookings. Use cancel instead.' },
        { status: 403 }
      )
    }

    // FIXED: Use soft delete (mark as cancelled) instead of hard delete
    await prisma.booking.update({
      where: { id: params.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy: 'instructor'
      } as any
    })

    // Delete Google Calendar event if exists and calendar is connected
    if (booking.googleCalendarEventId && booking.instructor.syncGoogleCalendar) {
      try {
        await googleCalendarService.deleteCalendarEvent(
          booking.instructorId,
          booking.googleCalendarEventId
        )
      } catch (calendarError) {
        console.error('Failed to delete calendar event:', calendarError)
        // Don't fail the booking cancellation if calendar deletion fails
      }
    }

    return NextResponse.json({ success: true, message: 'Booking cancelled' })
  } catch (error) {
    console.error('Delete booking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
