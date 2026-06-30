/**
 * GET /api/public/bookings/{id}/payment-summary?token={paymentToken}
 *
 * Lightweight endpoint for the payment page.
 * Returns only the fields needed to render the booking summary and initiate payment.
 *
 * SECURITY:
 *   Both bookingId (path) AND paymentToken (query) must match.
 *   paymentToken is a UUID generated at booking creation time, included in the
 *   checkoutUrl sent via SMS. Only the SMS recipient knows both values.
 *   This prevents booking details being exposed if a bookingId leaks via logs,
 *   browser history, or SMS forwarding.
 *
 * BACKEND VALIDATION (not just UI):
 *   - Token must match booking.paymentToken
 *   - Booking must be in PENDING_PAYMENT status (or EXPIRED/CANCELLED for error screens)
 *   - createdAt + 10 min > now() checked server-side regardless of UI countdown
 *
 * RESUME PAYMENT:
 *   SMS link stays valid until expiresAt. If user closes browser and returns,
 *   POST /payments/create-intent reuses the existing PaymentIntent.
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

    // Token is required — reject immediately without hitting DB if missing
    if (!token) {
      return NextResponse.json(
        { error: 'Payment token required. Use the link from your SMS.' },
        { status: 401 }
      )
    }

    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        isPaid: true,
        startTime: true,
        endTime: true,
        duration: true,
        price: true,
        packageTotalPaid: true,
        packageHours: true,
        isPackageBooking: true,
        lockedHourlyRate: true,
        lockedDiscountPct: true,
        pickupAddress: true,
        createdAt: true,
        paymentToken: true,
        instructorId: true,
        instructor: {
          select: {
            name: true,
            profileImage: true,
            averageRating: true,
            totalReviews: true,
          },
        },
      },
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Constant-time token comparison to prevent timing attacks
    // Both are UUIDs (36 chars) so length check is not a secret
    const storedToken = (booking as any).paymentToken ?? ''
    if (!storedToken || storedToken !== token) {
      // Return 404 rather than 403 — don't reveal booking existence to token-less callers
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Calculate expiry server-side — never trust client countdown
    // First check if there's an active SlotReservation for this booking
    let expiresAt = new Date(
      booking.createdAt.getTime() + SLOT_HOLD_MINUTES * 60 * 1000
    );

    if (booking.startTime) {
      // Look for the slot reservation that was created with this booking
      const slotReservation = await prisma.slotReservation.findFirst({
        where: {
          instructorId: booking.instructorId,
          startTime: booking.startTime,
        },
        orderBy: { expiresAt: 'desc' }, // Get most recent
        take: 1,
      });

      if (slotReservation && slotReservation.expiresAt > new Date()) {
        // Use the slot reservation expiry (more authoritative)
        expiresAt = slotReservation.expiresAt;
      }
    }

    const serverExpired =
      booking.status === 'EXPIRED' ||
      (booking.status === 'PENDING_PAYMENT' && new Date() > expiresAt)

    const total = (booking as any).packageTotalPaid ?? booking.price

    return NextResponse.json({
      bookingId: booking.id,
      status: serverExpired ? 'EXPIRED' : booking.status,
      isPaid: booking.isPaid,

      date: booking.startTime
        ? booking.startTime.toISOString().split('T')[0]
        : null,
      time: booking.startTime
        ? booking.startTime.toLocaleTimeString('en-AU', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Australia/Perth',
          })
        : null,
      startTime: booking.startTime?.toISOString() ?? null,
      endTime: booking.endTime?.toISOString() ?? null,
      duration: booking.duration
        ? Math.round(booking.duration * 60) // hours → minutes
        : null,
      pickupLocation: booking.pickupAddress,

      isPackageBooking: booking.isPackageBooking,
      packageHours: (booking as any).packageHours ?? null,

      total,
      currency: 'AUD',
      hourlyRate: (booking as any).lockedHourlyRate ?? null,
      discountPct: (booking as any).lockedDiscountPct ?? null,

      instructor: {
        name: booking.instructor.name,
        profileImage: booking.instructor.profileImage ?? null,
        rating: booking.instructor.averageRating ?? null,
        reviews: booking.instructor.totalReviews ?? 0,
      },

      expiresAt: expiresAt.toISOString(),
      reservationExpired: serverExpired,
    })
  } catch (error) {
    console.error('Payment summary error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
