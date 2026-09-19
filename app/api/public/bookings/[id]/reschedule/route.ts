/**
 * POST /api/public/bookings/{id}/reschedule
 *
 * Public reschedule endpoint for AI voice agent and client self-service.
 * No instructor auth session required.
 *
 * Security:
 *   - verificationToken (optional but recommended): short-lived token from
 *     POST /api/verifications/otp/confirm, stored as `verified:{token}` in
 *     User.resetToken. When provided, identity is verified before rescheduling.
 *   - Without a token the endpoint still works (for backward compat with
 *     simple voice flows), but the caller should ideally complete OTP first.
 *
 * Slot conflict checking:
 *   - Uses availabilityService.checkDoubleBooking (same as authenticated route)
 *   - Excludes the current booking from the conflict check
 *
 * Returns:
 *   { success, booking, oldStartTime, newStartTime }
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import {
  notifyBookingRescheduled,
  notifyClientBookingRescheduled,
} from '@/lib/services/notifications'
import { getNotifChannels } from '@/lib/config/platform-settings'

export const dynamic = 'force-dynamic'

const rescheduleSchema = z.object({
  /** New date in YYYY-MM-DD format */
  newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'newDate must be YYYY-MM-DD'),
  /** New time in HH:MM (24-hour) format */
  newTime: z.string().regex(/^\d{2}:\d{2}$/, 'newTime must be HH:MM'),
  /** Duration in minutes — defaults to existing booking duration */
  duration: z.number().int().positive().optional(),
  /** Human-readable reason for rescheduling */
  reason: z.string().max(500).optional(),
  /**
   * Short-lived token from POST /api/verifications/otp/confirm.
   * When provided, the user's identity is verified before rescheduling.
   * When omitted, the reschedule proceeds without identity verification
   * (suitable for simple voice flows where OTP was already confirmed
   * earlier in the call, or for low-risk rescheduling scenarios).
   */
  verificationToken: z.string().optional(),
  /** Phone number of the client — required when verificationToken is provided */
  phone: z.string().optional(),
  /** Email of the client — alternative to phone for token lookup */
  email: z.string().email().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const data = rescheduleSchema.parse(body)

    // ── 1. Load booking ──────────────────────────────────────────────────────
    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: { customer: true,
        provider: {
          include: { user: true },
        },
      },
    }) as any

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Only allow rescheduling of active bookings
    if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Cannot reschedule a completed or cancelled booking' },
        { status: 400 }
      )
    }

    if (!['CONFIRMED', 'PENDING_PAYMENT', 'PENDING'].includes(booking.status)) {
      return NextResponse.json(
        { error: `Booking status '${booking.status}' does not allow rescheduling` },
        { status: 400 }
      )
    }

    // ── 2. Verify identity via token (when provided) ─────────────────────────
    if (data.verificationToken) {
      if (!data.phone && !data.email) {
        return NextResponse.json(
          { error: 'phone or email required when verificationToken is provided' },
          { status: 400 }
        )
      }

      // Find the user associated with this booking's client.
      // Scope the phone lookup to the booking's providerId to avoid
      // matching a different client who happens to share the same phone
      // number under a different instructor.
      let user = null
      if (data.email) {
        user = await prisma.user.findUnique({ where: { email: data.email } })
      } else if (data.phone) {
        const client = await prisma.customer.findFirst({
          where: {
            phone: data.phone.replace(/\s/g, ''),
            bookings: { some: { providerId: booking.providerId } },
          },
          include: { user: true },
        })
        user = client?.user ?? null
      }

      if (!user) {
        return NextResponse.json(
          { error: 'Could not verify identity — user not found' },
          { status: 403 }
        )
      }

      // Validate token format: "verified:{token}"
      if (
        !user.resetToken ||
        !user.resetToken.startsWith('verified:') ||
        !user.resetTokenExpiry
      ) {
        return NextResponse.json(
          { error: 'Verification token is invalid or has already been used' },
          { status: 403 }
        )
      }

      // Check expiry
      if (new Date() > user.resetTokenExpiry) {
        return NextResponse.json(
          { error: 'Verification token has expired. Please request a new OTP.' },
          { status: 403 }
        )
      }

      const storedToken = user.resetToken.replace('verified:', '')
      if (storedToken !== data.verificationToken) {
        return NextResponse.json(
          { error: 'Verification token does not match' },
          { status: 403 }
        )
      }

      // Confirm the booking belongs to this client
      if (booking.customer?.userId && booking.customer.userId !== user.id) {
        return NextResponse.json(
          { error: 'Verification token does not match the booking owner' },
          { status: 403 }
        )
      }

      // Consume the token — one-time use
      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken: null, resetTokenExpiry: null },
      })
    } else {
      // HIGH-1 FIX: When verificationToken is omitted, still verify ownership
      // Require phone or email to prove this is the client's booking
      if (!data.phone && !data.email) {
        return NextResponse.json(
          { 
            error: 'For security, please provide phone or email (or use verificationToken for OTP-verified reschedules)',
            code: 'OWNERSHIP_VERIFICATION_REQUIRED'
          },
          { status: 400 }
        )
      }

      // Verify the provided phone/email matches the booking's client
      const clientPhone = data.phone?.replace(/\s/g, '')
      const customerEmail = data.email?.toLowerCase().trim()
      const bookingClientPhone = booking.customer?.phone?.replace(/\s/g, '')
      const bookingClientEmail = booking.customer?.userId 
        ? (await prisma.user.findUnique({ 
            where: { id: booking.customer.userId },
            select: { email: true }
          }))?.email?.toLowerCase().trim()
        : null

      const phoneMatches = clientPhone && bookingClientPhone && clientPhone === bookingClientPhone
      const emailMatches = customerEmail && bookingClientEmail && customerEmail === bookingClientEmail

      if (!phoneMatches && !emailMatches) {
        return NextResponse.json(
          { 
            error: 'Phone or email does not match the booking owner',
            code: 'OWNERSHIP_VERIFICATION_FAILED'
          },
          { status: 403 }
        )
      }
    }

    // ── 3. Build new start/end times ─────────────────────────────────────────
    const [year, month, day] = data.newDate.split('-').map(Number)
    const [hour, minute] = data.newTime.split(':').map(Number)

    // Construct in local time (server timezone) — same pattern as availability service
    const newStart = new Date(year, month - 1, day, hour, minute, 0, 0)

    // Duration: use provided value, or fall back to existing booking duration
    let durationMinutes = data.duration
    if (!durationMinutes) {
      if (booking.startTime && booking.endTime) {
        durationMinutes = Math.round(
          (new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime()) /
            60000
        )
      } else {
        durationMinutes = 60 // safe default
      }
    }

    const newEnd = new Date(newStart.getTime() + durationMinutes * 60 * 1000)
    const now = new Date()

    if (newStart <= now) {
      return NextResponse.json(
        { error: 'Cannot reschedule to a past time' },
        { status: 400 }
      )
    }

    // ── 4–6. Delegate to shared service (PAY-H-02 FIX) ─────────────────────
    // The shared rescheduleBooking() performs the slot-conflict check INSIDE a
    // SERIALIZABLE transaction (eliminating the previous TOCTOU gap where the
    // conflict check and booking write were separated). All financial invariants
    // are enforced there: Stripe-paid price-change block, wallet adjustment,
    // package duration guard, Transaction update, CAS on rescheduleCount.
    const { rescheduleBooking } = await import('@/lib/services/booking-service')
    const result = await rescheduleBooking(
      params.id,
      { newStartTime: newStart, newEndTime: newEnd, reason: data.reason },
      'voice_agent',
      'CLIENT',
    )

    if ('requiresConfirmation' in result) {
      return NextResponse.json(result, { status: 200 })
    }

    const updated    = result
    const oldStartTime = booking.startTime

    // ── 7. Notifications ─────────────────────────────────────────────────────
    try {
      const channels = getNotifChannels('BOOKING_RESCHEDULED')
      if (channels.inApp) {
        if (updated.provider?.userId) {
          await notifyBookingRescheduled(
            updated.provider.userId,
            updated.customer?.name ?? 'Client',
            params.id,
            newStart
          )
        }
        if (updated.customer?.userId) {
          await notifyClientBookingRescheduled(
            updated.customer.userId,
            updated.provider?.name ?? 'provider',
            params.id,
            newStart
          )
        }
      }
    } catch (e) {
      console.error('Reschedule notification failed:', e)
    }

    // ── 8. Response ──────────────────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      booking: updated,
      oldStartTime: oldStartTime?.toISOString() ?? null,
      newStartTime: newStart.toISOString(),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    const code = (error as any)?.code
    if (code === 'SLOT_CONFLICT')            return NextResponse.json({ error: 'The requested time slot is not available', code }, { status: 409 })
    if (code === 'STRIPE_PAID_PRICE_CHANGE') return NextResponse.json({ error: (error as Error).message, code }, { status: 409 })
    if (code === 'PACKAGE_DURATION_LOCKED')  return NextResponse.json({ error: (error as Error).message, code }, { status: 400 })
    if (code === 'CONCURRENT_RESCHEDULE')    return NextResponse.json({ error: (error as Error).message, code }, { status: 409 })
    if (code === 'INSUFFICIENT_BALANCE')     return NextResponse.json({ error: (error as Error).message, code }, { status: 400 })
    if (code === 'INVALID_DURATION')         return NextResponse.json({ error: (error as Error).message, code }, { status: 400 })
    console.error('Public reschedule error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
