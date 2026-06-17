/**
 * GET /api/public/bookings/{id}/payment-status?token={paymentToken}
 *
 * Lean polling endpoint for AI voice agents and mobile apps.
 * Returns only the booking status and a payment-status field.
 * No PII returned — token is still required for security.
 *
 * AI usage:
 *   "I can see your payment is still processing. Please wait a moment."
 *   "Your booking is now confirmed — you'll receive an SMS shortly."
 *
 * Designed for polling (every 3-5 seconds) after the user says they've paid.
 * Rate limited to 30 requests per minute per IP.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const SLOT_HOLD_MINUTES = 10

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
        instructorId: true,
        startTime: true,
        paymentToken: true,
        paymentIntentId: true,
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

    // Derive server-side expiry
    let expiresAt = new Date(
      booking.createdAt.getTime() + SLOT_HOLD_MINUTES * 60 * 1000
    )

    // Prefer SlotReservation expiry when present (align with payment-summary)
    try {
      const slotReservation = await prisma.slotReservation.findFirst({
        where: {
          instructorId: booking.instructorId,
          startTime: booking.startTime ?? undefined,
        },
        orderBy: { expiresAt: 'desc' },
        take: 1,
      })
      if (slotReservation && slotReservation.expiresAt > new Date()) {
        expiresAt = slotReservation.expiresAt
      }
    } catch {
      // non-fatal; fall back to createdAt+10m
    }
    const serverExpired =
      booking.status === 'EXPIRED' ||
      (booking.status === 'PENDING_PAYMENT' && new Date() > expiresAt)

    // Derive a human-readable paymentStatus for AI/mobile consumers
    let paymentStatus: string
    if (booking.isPaid || booking.status === 'CONFIRMED') {
      paymentStatus = 'succeeded'
    } else if (serverExpired) {
      paymentStatus = 'expired'
    } else if (booking.status === 'CANCELLED') {
      paymentStatus = 'cancelled'
    } else if (booking.status === 'PENDING_PAYMENT') {
      paymentStatus = 'pending'   // slot reserved, payment not yet received
    } else if (booking.status === 'PENDING') {
      paymentStatus = 'awaiting_approval'  // short-notice: waiting for instructor
    } else {
      paymentStatus = booking.status.toLowerCase()
    }

    return NextResponse.json({
      bookingId: booking.id,
      status: serverExpired ? 'EXPIRED' : booking.status,
      paymentStatus,
      isPaid: booking.isPaid,
      canPay: !booking.isPaid &&
              !serverExpired &&
              booking.status === 'PENDING_PAYMENT',
      expiresAt: expiresAt.toISOString(),
    })
  } catch (error) {
    console.error('Payment status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
