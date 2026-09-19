import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
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
    if (!session?.user?.providerId) {
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
      where: { id: params.id, providerId: session!.user!.providerId },
      include: { provider: true, customer: true }
    }) as any

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

    // Delegate to the shared service (PAY-H-02 FIX: financial invariants enforced there)
    const { rescheduleBooking } = await import('@/lib/services/booking-service')
    const result = await rescheduleBooking(
      params.id,
      { newStartTime: newStart, newEndTime: newEnd, reason: data.reason, confirmedPenaltyWaiver: data.confirmedPenaltyWaiver },
      session!.user!.id,
      'provider',
    )

    if ('requiresConfirmation' in result) {
      return NextResponse.json(result, { status: 200 })
    }

    const updated = result

    // Update Google Calendar if connected
    if ((booking as any).googleCalendarEventId && booking.provider.syncGoogleCalendar) {
      try {
        await googleCalendarService.updateCalendarEvent(
          booking.providerId,
          (booking as any).googleCalendarEventId,
          {
            startTime: newStart,
            endTime: newEnd,
            customerName: booking.customer?.name || '',
            customerPhone: booking.customer?.phone || '',
            pickupAddress: booking.pickupAddress || undefined,
            notes: booking.notes || undefined,
          }
        )
      } catch (e) {
        console.error('Calendar update failed:', e)
      }
    }

  // FIX #13: Audit log on reschedule — required for dispute evidence and refund
  // policy anchor (originalStartTime). Previously there was no audit trail for reschedules.
  try {
    await prisma.auditLog.create({
      data: {
        action: 'BOOKING_RESCHEDULED',
        actorId: session!.user.id!,
        actorRole: 'provider',
        targetType: 'BOOKING',
        targetId: params.id,
        success: true,
        metadata: {
          oldStartTime: booking.startTime?.toISOString() ?? null,
          oldEndTime: booking.endTime?.toISOString() ?? null,
          newStartTime: newStart.toISOString(),
          newEndTime: newEnd.toISOString(),
          reason: data.reason ?? null,
          isInsidePenaltyWindow,
          rescheduledBy: 'provider',
        } as any,
      },
    })
  } catch (auditErr) {
    console.error('Audit log failed for reschedule:', auditErr)
  }

  // Notifications for reschedule
  try {
    const reschedChannels = getNotifChannels('BOOKING_RESCHEDULED');
    if (reschedChannels.inApp) {
      if (updated.provider?.userId) {
        await notifyBookingRescheduled(updated.provider.userId, updated.customer?.name || 'Client', params.id, newStart);
      }
      if (updated.customer?.userId) {
        await notifyClientBookingRescheduled(updated.customer.userId, updated.provider.name, params.id, newStart);
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
    const code = (error as any)?.code
    if (code === 'SLOT_CONFLICT' || (error instanceof Error && error.message === 'SLOT_TAKEN')) {
      return NextResponse.json({ error: 'New time slot conflicts with another booking' }, { status: 409 })
    }
    if (code === 'STRIPE_PAID_PRICE_CHANGE') {
      return NextResponse.json({ error: (error as Error).message, code }, { status: 409 })
    }
    if (code === 'PACKAGE_DURATION_LOCKED') {
      return NextResponse.json({ error: (error as Error).message, code }, { status: 400 })
    }
    if (code === 'CONCURRENT_RESCHEDULE') {
      return NextResponse.json({ error: (error as Error).message, code }, { status: 409 })
    }
    console.error('Reschedule error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
