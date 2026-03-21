import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { availabilityService } from '@/lib/services/availability'
import { googleCalendarService } from '@/lib/services/googleCalendar'
import { z } from 'zod'
import { notifyBookingRescheduled, notifyClientBookingRescheduled } from '@/lib/services/notifications'
import { getNotifChannels } from '@/lib/config/platform-settings'

export const dynamic = 'force-dynamic'

const HOURS_24 = 24 * 60 * 60 * 1000

const rescheduleSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  reason: z.string().optional(),
  // Frontend must explicitly confirm when inside 24h window
  confirmedPenaltyWaiver: z.boolean().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const data = rescheduleSchema.parse(body)

    const newStart = new Date(data.startTime)
    const newEnd = new Date(data.endTime)
    const now = new Date()

    if (newStart < now) {
      return NextResponse.json({ error: 'Cannot reschedule to a past time' }, { status: 400 })
    }

    // Fetch booking and verify ownership
    const booking = await prisma.booking.findFirst({
      where: { id: params.id, instructorId: session.user.instructorId },
      include: { instructor: true, client: true }
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Cannot reschedule a completed or cancelled booking' }, { status: 400 })
    }

    // Block rescheduling past bookings that were never completed
    // These should have been auto-expired — treat them as expired now
    if (booking.startTime && booking.startTime < now) {
      return NextResponse.json({
        error: 'This booking is in the past and was never completed. It cannot be rescheduled — please mark it as completed or cancelled first.'
      }, { status: 400 })
    }

    // Check if current booking is inside the 24h penalty window
    const currentStart = booking.startTime ? new Date(booking.startTime) : null
    const isInsidePenaltyWindow = currentStart
      ? (currentStart.getTime() - now.getTime()) < HOURS_24
      : false

    // If inside penalty window, require explicit confirmation from frontend
    if (isInsidePenaltyWindow && !data.confirmedPenaltyWaiver) {
      const hoursUntil = currentStart
        ? Math.round((currentStart.getTime() - now.getTime()) / (1000 * 60 * 60) * 10) / 10
        : 0
      return NextResponse.json({
        requiresConfirmation: true,
        hoursUntil,
        warning: `This booking starts in ${hoursUntil} hours. Rescheduling now will mark it as non-refundable — if the client cancels after rescheduling, they receive no refund regardless of the new date. Do you want to proceed?`
      }, { status: 200 })
    }

    // Check availability (exclude this booking from conflict check)
    const hasConflict = await availabilityService.checkDoubleBooking(
      session.user.instructorId,
      newStart,
      newEnd,
      params.id
    )

    if (hasConflict) {
      return NextResponse.json({ error: 'New time slot conflicts with another booking' }, { status: 409 })
    }

    // Build reschedule history entry
    const historyEntry = {
      previousStart: booking.startTime,
      previousEnd: booking.endTime,
      rescheduledAt: now.toISOString(),
      rescheduledBy: session.user.id,
      reason: data.reason || null,
      wasInsidePenaltyWindow: isInsidePenaltyWindow,
    }

    const existingHistory = ((booking as any).rescheduledFrom as any[]) || []

    // If rescheduled inside penalty window: mark non-refundable + increment instructor exception count
    const updateData: any = {
      startTime: newStart,
      endTime: newEnd,
      rescheduledFrom: [...existingHistory, historyEntry],
      rescheduleCount: { increment: 1 },
    }

    // Track original start time on first reschedule
    if (!booking.originalStartTime && booking.startTime) {
      updateData.originalStartTime = booking.startTime
    }

    if (isInsidePenaltyWindow) {
      updateData.isNonRefundable = true
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id: params.id },
        data: updateData,
        include: { client: true, instructor: { include: { user: true } } }
      })

      // Increment instructor's policy exception count if they waived the penalty
      if (isInsidePenaltyWindow) {
        await tx.instructor.update({
          where: { id: session.user.instructorId },
          data: { policyExceptionCount: { increment: 1 } } as any
        })
      }

      return updatedBooking
    })

    // Update Google Calendar if connected
    if ((booking as any).googleCalendarEventId && booking.instructor.syncGoogleCalendar) {
      try {
        await googleCalendarService.updateCalendarEvent(
          booking.instructorId,
          (booking as any).googleCalendarEventId,
          {
            startTime: newStart,
            endTime: newEnd,
            clientName: booking.client?.name || '',
            clientPhone: booking.client?.phone || '',
            pickupAddress: booking.pickupAddress || undefined,
            notes: booking.notes || undefined,
          }
        )
      } catch (e) {
        console.error('Calendar update failed:', e)
      }
    }
  // Notifications for reschedule
  try {
    const reschedChannels = getNotifChannels('BOOKING_RESCHEDULED');
    if (reschedChannels.inApp) {
      if (updated.instructor?.userId) {
        await notifyBookingRescheduled(updated.instructor.userId, updated.client?.name || 'Client', params.id, newStart);
      }
      if (updated.client?.userId) {
        await notifyClientBookingRescheduled(updated.client.userId, updated.instructor.name, params.id, newStart);
      }
    }
  } catch (e) { console.error('Reschedule notification failed:', e); }


    return NextResponse.json({
      success: true,
      booking: updated,
      penaltyWaived: isInsidePenaltyWindow,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Reschedule error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
