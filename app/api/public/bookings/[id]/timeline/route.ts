import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/public/bookings/:id/timeline
 *
 * Returns a human-readable chronological event list for a booking.
 * Used by the AI receptionist to read back booking history when a caller
 * asks "what happened to my booking?"
 *
 * Auth: paymentToken from the SMS payment link — scoped per booking.
 * The caller must have the token, which they received in their SMS.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = req.nextUrl.searchParams.get('token')
    const bookingId = params.id

    if (!bookingId) {
      return NextResponse.json({ error: 'Missing booking ID' }, { status: 400 })
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        instructor: { select: { name: true } },
        client: { select: { name: true } },
      },
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Verify token matches — paymentToken is required unless booking is unpaid
    // (unpaid bookings have no payment link, so token may be absent)
    if (booking.paymentToken && token !== booking.paymentToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }

    const instructorName = booking.instructor?.name ?? 'your instructor'
    const events: { timestamp: Date; description: string }[] = []

    // Booking created
    events.push({
      timestamp: booking.createdAt,
      description: `Booking created with ${instructorName}`,
    })

    // Lesson scheduled
    if (booking.startTime) {
      const lessonDate = booking.startTime.toLocaleDateString('en-AU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
      const lessonTime = booking.startTime.toLocaleTimeString('en-AU', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
      events.push({
        timestamp: booking.startTime,
        description: `Lesson scheduled for ${lessonDate} at ${lessonTime}`,
      })
    }

    // Payment received
    if (booking.isPaid && booking.paidAt) {
      events.push({
        timestamp: booking.paidAt,
        description: `Payment received — booking confirmed`,
      })
    }

    // Rescheduled
    if (booking.rescheduleCount && booking.rescheduleCount > 0) {
      events.push({
        timestamp: booking.updatedAt,
        description: `Booking rescheduled (${booking.rescheduleCount} time${booking.rescheduleCount !== 1 ? 's' : ''})`,
      })
    }

    // Cancelled
    if (booking.cancelledAt) {
      events.push({
        timestamp: booking.cancelledAt,
        description: `Booking cancelled`,
      })
    }

    // Check-in
    if (booking.checkInTime) {
      events.push({
        timestamp: booking.checkInTime,
        description: `Lesson started (checked in)`,
      })
    }

    // Check-out / completed
    if (booking.checkOutTime) {
      events.push({
        timestamp: booking.checkOutTime,
        description: `Lesson completed`,
      })
    }

    // Sort chronologically
    const sorted = events.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    )

    return NextResponse.json({
      bookingId,
      status: booking.status,
      events: sorted.map((e) => ({
        timestamp: e.timestamp.toISOString(),
        description: e.description,
      })),
    })
  } catch (error) {
    console.error('Timeline fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
