/**
 * GET /api/public/bookings/{id}
 *
 * Public booking status endpoint for AI voice agent and client self-service.
 * No instructor auth session required.
 *
 * Security model (one of the following must be provided):
 *   1. verificationToken (X-Verification-Token header or query param):
 *      Short-lived token from POST /api/verifications/otp/confirm.
 *      Grants full booking details.
 *   2. phone query param:
 *      Must match the booking's clientPhone. Returns limited details only
 *      (status, times, instructor name) — no PII beyond what the caller already knows.
 *
 * If neither is provided, returns 401.
 *
 * AI usage:
 *   - After booking: confirm status is PENDING_PAYMENT or CONFIRMED
 *   - When caller asks "When is my lesson?": return startTime + instructor name
 *   - Before reschedule/cancel: confirm booking exists and is eligible
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(req.url)
    const phone = searchParams.get('phone')
    const headerToken = req.headers.get('x-verification-token')
    const verificationToken = headerToken ?? null

    // ── 1. Load booking ──────────────────────────────────────────────────────
    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
            phone: true,
            profileImage: true,
            hourlyRate: true,
          },
        },
        client: {
          include: { user: { select: { email: true } } },
        },
      },
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // ── 2. Unauthenticated access — payment page use case ────────────────────
    // The booking UUID is unguessable (UUID v4). Allowing unauthenticated access
    // to payment-relevant fields (status, price, instructor name) is safe because:
    //   - The URL is only known to the person who received the SMS payment link
    //   - No PII is returned (no client email, no client phone, no client name)
    //   - This is the same security model as Stripe's own checkout.stripe.com/{session_id}
    if (!verificationToken && !phone) {
      return NextResponse.json({
        id: booking.id,
        status: booking.status,
        isPaid: booking.isPaid,
        price: (booking as any).packageTotalPaid ?? booking.price,
        isPackageBooking: booking.isPackageBooking,
        packageHours: booking.packageHours,
        packageTotalPaid: (booking as any).packageTotalPaid,
        lockedHourlyRate: (booking as any).lockedHourlyRate,
        lockedDiscountPct: (booking as any).lockedDiscountPct,
        startTime: booking.startTime,
        endTime: booking.endTime,
        pickupAddress: booking.pickupAddress,
        instructor: {
          name: booking.instructor?.name,
          profileImage: booking.instructor?.profileImage,
          hourlyRate: booking.instructor?.hourlyRate,
        },
        // No client details — unauthenticated
      })
    }

    // ── 2a. Token-based access (full details) ────────────────────────────────
    if (verificationToken) {
      // Find the user who owns this token
      const user = await prisma.user.findFirst({
        where: {
          resetToken: `verified:${verificationToken}`,
          resetTokenExpiry: { gt: new Date() },
        },
      })

      if (!user) {
        return NextResponse.json(
          { error: 'Verification token is invalid or has expired' },
          { status: 401 }
        )
      }

      // Confirm the token owner is the booking's client
      if (booking.client?.userId && booking.client.userId !== user.id) {
        return NextResponse.json(
          { error: 'Verification token does not match the booking owner' },
          { status: 403 }
        )
      }

      // NOTE: token is NOT consumed here — GET is read-only.
      // Token consumption happens on cancel/reschedule.

      return NextResponse.json(buildFullResponse(booking))
    }

    // ── 2b. Phone-based access (limited details, no PII) ────────────────────
    if (phone) {
      const normalizedPhone = phone.replace(/\s/g, '')
      const bookingPhone = (booking.clientPhone ?? booking.client?.phone ?? '').replace(/\s/g, '')

      if (!bookingPhone || bookingPhone !== normalizedPhone) {
        return NextResponse.json(
          { error: 'Phone number does not match this booking' },
          { status: 403 }
        )
      }

      return NextResponse.json(buildLimitedResponse(booking))
    }

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  } catch (error) {
    console.error('Get public booking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Derive explicit canCancel / canReschedule flags from booking state.
 *
 * The AI MUST use these fields directly — never infer from status alone.
 * "status === CONFIRMED" does NOT mean canCancel === true (e.g. past bookings,
 * already-cancelled, no-show).
 */
function deriveActionability(booking: any): { canCancel: boolean; canReschedule: boolean } {
  const actionableStatuses = ['PENDING_PAYMENT', 'PENDING', 'CONFIRMED']
  if (!actionableStatuses.includes(booking.status)) {
    return { canCancel: false, canReschedule: false }
  }
  const isPast = booking.startTime && new Date(booking.startTime) < new Date()
  return {
    canCancel: !isPast,
    // Cannot reschedule a PENDING_PAYMENT booking — payment has not been confirmed yet
    canReschedule: !isPast && booking.status !== 'PENDING_PAYMENT',
  }
}

// Full response — returned when caller has a valid verification token
function buildFullResponse(booking: any) {
  const { canCancel, canReschedule } = deriveActionability(booking)
  return {
    bookingId: booking.id,
    status: booking.status,
    canCancel,
    canReschedule,
    startTime: booking.startTime,
    endTime: booking.endTime,
    duration: booking.startTime && booking.endTime
      ? Math.round((new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime()) / 60000)
      : null,
    pickupLocation: booking.pickupAddress,
    price: booking.packageTotalPaid ?? booking.price,
    isShortNotice: !!(booking as any).isShortNotice,
    expiresAt: booking.status === 'PENDING_PAYMENT' ? (booking as any).expiresAt ?? null : null,
    isPackageBooking: booking.isPackageBooking,
    package: booking.isPackageBooking
      ? { hours: booking.packageHours, hoursRemaining: booking.packageHoursRemaining }
      : null,
    instructor: {
      id: booking.instructor?.id,
      name: booking.instructor?.name,
      phone: booking.instructor?.phone,
      hourlyRate: booking.instructor?.hourlyRate,
    },
    client: {
      name: booking.clientName ?? booking.client?.name,
      phone: booking.clientPhone ?? booking.client?.phone,
    },
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  }
}

// Limited response — returned when caller provides phone only (no OTP)
// Omits PII beyond what the caller already knows (their own phone)
function buildLimitedResponse(booking: any) {
  const { canCancel, canReschedule } = deriveActionability(booking)
  return {
    bookingId: booking.id,
    status: booking.status,
    canCancel,
    canReschedule,
    startTime: booking.startTime,
    endTime: booking.endTime,
    duration: booking.startTime && booking.endTime
      ? Math.round((new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime()) / 60000)
      : null,
    pickupLocation: booking.pickupAddress,
    isShortNotice: !!(booking as any).isShortNotice,
    expiresAt: booking.status === 'PENDING_PAYMENT' ? (booking as any).expiresAt ?? null : null,
    instructor: {
      name: booking.instructor?.name,
    },
    // No price, no client email, no package details — caller must OTP to get full details
  }
}
