/**
 * GET /api/public/bookings/{id}/timeline?token={paymentToken}
 *
 * Returns a human-readable event timeline for a booking.
 * Designed for AI voice agents and mobile apps to answer questions like:
 * "What happened to my booking?"
 *
 * Security: requires paymentToken (same as payment-summary and payment-status).
 * Returns 404 on token mismatch — prevents bookingId enumeration.
 *
 * Events are reconstructed from the booking's current state and timestamps.
 * No internal table names, IDs, or financial data are exposed.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const SLOT_HOLD_MINUTES = 10

interface TimelineEvent {
  type: string
  time: string // ISO 8601
  description: string
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Payment token required' }, { status: 401 })
    }

    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        isPaid: true,
        createdAt: true,
        paidAt: true,
        paymentCapturedAt: true,
        startTime: true,
        endTime: true,
        cancelledAt: true,
        checkInTime: true,
        checkOutTime: true,
        feedbackGivenAt: true,
        paymentToken: true,
        instructor: {
          select: { name: true },
        },
      },
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Token validation
    const storedToken = (booking as any).paymentToken ?? ''
    if (!storedToken || storedToken !== token) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const events: TimelineEvent[] = []
    const instructorName = booking.instructor?.name ?? 'your instructor'
    const expiresAt = new Date(
      booking.createdAt.getTime() + SLOT_HOLD_MINUTES * 60 * 1000
    )

    // ── Event: booking created ──────────────────────────────────────────────
    events.push({
      type: 'BOOKING_CREATED',
      time: booking.createdAt.toISOString(),
      description: `Booking created with ${instructorName}. Slot reserved for ${SLOT_HOLD_MINUTES} minutes.`,
    })

    // ── Event: slot reservation window ──────────────────────────────────────
    if (booking.status === 'PENDING_PAYMENT') {
      events.push({
        type: 'AWAITING_PAYMENT',
        time: booking.createdAt.toISOString(),
        description: `Awaiting payment. Slot reserved until ${expiresAt.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: 'Australia/Perth' })}.`,
      })
    }

    // ── Event: slot expired ─────────────────────────────────────────────────
    if (booking.status === 'EXPIRED') {
      events.push({
        type: 'SLOT_EXPIRED',
        time: expiresAt.toISOString(),
        description: 'Payment was not completed within the 10-minute window. Slot was released.',
      })
    }

    // ── Event: payment completed ────────────────────────────────────────────
    const paidAt = (booking as any).paidAt ?? (booking as any).paymentCapturedAt
    if (paidAt) {
      events.push({
        type: 'PAYMENT_COMPLETED',
        time: new Date(paidAt).toISOString(),
        description: 'Payment received.',
      })
    }

    // ── Event: booking confirmed ────────────────────────────────────────────
    if (
      ['CONFIRMED', 'COMPLETED', 'NO_SHOW'].includes(booking.status) ||
      booking.isPaid
    ) {
      const confirmedAt = paidAt ?? booking.createdAt
      events.push({
        type: 'BOOKING_CONFIRMED',
        time: new Date(confirmedAt).toISOString(),
        description: `Booking confirmed with ${instructorName}.`,
      })
    }

    // ── Event: cancelled ────────────────────────────────────────────────────
    if (booking.status === 'CANCELLED') {
      const cancelTime = (booking as any).cancelledAt ?? booking.createdAt
      events.push({
        type: 'BOOKING_CANCELLED',
        time: new Date(cancelTime).toISOString(),
        description: 'Booking was cancelled.',
      })
    }

    // ── Event: check-in ─────────────────────────────────────────────────────
    if ((booking as any).checkInTime) {
      events.push({
        type: 'LESSON_STARTED',
        time: new Date((booking as any).checkInTime).toISOString(),
        description: 'Lesson started — check-in recorded.',
      })
    }

    // ── Event: check-out ────────────────────────────────────────────────────
    if ((booking as any).checkOutTime) {
      events.push({
        type: 'LESSON_ENDED',
        time: new Date((booking as any).checkOutTime).toISOString(),
        description: 'Lesson ended — check-out recorded.',
      })
    }

    // ── Event: completed ────────────────────────────────────────────────────
    if (booking.status === 'COMPLETED') {
      const completedAt =
        (booking as any).checkOutTime ??
        (booking.endTime ? new Date(booking.endTime) : null) ??
        new Date()
      events.push({
        type: 'BOOKING_COMPLETED',
        time: new Date(completedAt).toISOString(),
        description: 'Lesson completed.',
      })
    }

    // ── Event: no-show ──────────────────────────────────────────────────────
    if (booking.status === 'NO_SHOW') {
      events.push({
        type: 'NO_SHOW',
        time: (booking.endTime ?? new Date()).toISOString(),
        description: 'Lesson time passed without check-in.',
      })
    }

    // ── Event: review left ──────────────────────────────────────────────────
    if ((booking as any).feedbackGivenAt) {
      events.push({
        type: 'REVIEW_SUBMITTED',
        time: new Date((booking as any).feedbackGivenAt).toISOString(),
        description: 'Lesson feedback submitted.',
      })
    }

    // Sort chronologically
    events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

    return NextResponse.json({
      bookingId: booking.id,
      status: booking.status,
      events,
    })
  } catch (error) {
    console.error('Timeline error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
