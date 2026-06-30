/**
 * POST /api/public/bookings/{id}/cancel
 *
 * Public cancel endpoint for AI voice agent and client self-service.
 * No instructor auth session required.
 *
 * Security:
 *   - verificationToken (optional but recommended): short-lived token from
 *     POST /api/verifications/otp/confirm, stored as `verified:{token}` in
 *     User.resetToken. When provided, identity is verified before cancelling.
 *   - Without a token the endpoint still works (backward compat with simple
 *     voice flows), but callers should complete OTP first.
 *
 * Refund policy:
 *   - 48+ hours before lesson: 100% refund
 *   - 24–48 hours before: 50% refund
 *   - Less than 24 hours: No refund
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' })
  : null

const cancelSchema = z.object({
  reason: z.string().max(500).optional(),
  /** Short-lived token from POST /api/verifications/otp/confirm */
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
    const body = await req.json().catch(() => ({}))
    const data = cancelSchema.parse(body)

    // Also accept token from header (hybrid service sends it there)
    const headerToken = req.headers.get('x-verification-token')
    const verificationToken = data.verificationToken ?? headerToken ?? undefined

    // ── 1. Load booking ──────────────────────────────────────────────────────
    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        client: true,
        instructor: {
          include: { user: true },
        },
      },
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Booking is already cancelled' }, { status: 400 })
    }

    if (booking.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Cannot cancel a completed booking' }, { status: 400 })
    }

    // ── 2. Verify identity via token (when provided) ─────────────────────────
    if (verificationToken) {
      if (!data.phone && !data.email) {
        return NextResponse.json(
          { error: 'phone or email required when verificationToken is provided' },
          { status: 400 }
        )
      }

      let user = null
      if (data.email) {
        user = await prisma.user.findUnique({ where: { email: data.email } })
      } else if (data.phone) {
        const client = await prisma.client.findFirst({
          where: {
            phone: data.phone.replace(/\s/g, ''),
            instructorId: booking.instructorId,
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

      if (new Date() > user.resetTokenExpiry) {
        return NextResponse.json(
          { error: 'Verification token has expired. Please request a new OTP.' },
          { status: 403 }
        )
      }

      const storedToken = user.resetToken.replace('verified:', '')
      if (storedToken !== verificationToken) {
        return NextResponse.json(
          { error: 'Verification token does not match' },
          { status: 403 }
        )
      }

      // Confirm the booking belongs to this client
      if (booking.client?.userId && booking.client.userId !== user.id) {
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
      // HIGH-1 fix: require ownership verification when no OTP token is provided.
      if (!data.phone && !data.email) {
        return NextResponse.json(
          {
            error: 'For security, please provide phone or email to verify ownership before cancelling.',
            code: 'OWNERSHIP_VERIFICATION_REQUIRED'
          },
          { status: 400 }
        )
      }

      const clientPhone = data.phone?.replace(/\s/g, '')
      const clientEmail = data.email?.toLowerCase().trim()
      const bookingClientPhone = booking.client?.phone?.replace(/\s/g, '')
      const bookingClientEmail = booking.client?.userId
        ? (await prisma.user.findUnique({
            where: { id: booking.client.userId },
            select: { email: true },
          }))?.email?.toLowerCase().trim()
        : null

      const phoneMatches = clientPhone && bookingClientPhone && clientPhone === bookingClientPhone
      const emailMatches = clientEmail && bookingClientEmail && clientEmail === bookingClientEmail

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

    // ── 3. Calculate refund ──────────────────────────────────────────────────
    const now = new Date()
    const bookingTime = booking.startTime ? new Date(booking.startTime) : null
    const hoursUntilBooking = bookingTime
      ? (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60)
      : 0

    let refundPercentage = 0
    let refundAmount = 0

    if (hoursUntilBooking >= 48) {
      refundPercentage = 100
      refundAmount = booking.price
    } else if (hoursUntilBooking >= 24) {
      refundPercentage = 50
      refundAmount = parseFloat((booking.price * 0.5).toFixed(2))
    }

    // ── 4. Cancel booking atomically ────────────────────────────────────────
    // FIX #1: updateMany with status guard — prevents double-cancel under concurrency.
    // Two concurrent requests both reading status=CONFIRMED would previously both proceed.
    // Now only the first writer wins; the second gets count=0 and returns 400.
    let updated: any
    try {
      updated = await prisma.$transaction(async (tx) => {
        const guard = await tx.booking.updateMany({
          where: {
            id: params.id,
            status: { notIn: ['CANCELLED', 'COMPLETED', 'EXPIRED', 'NO_SHOW'] },
          },
          data: {
            status: 'CANCELLED',
            cancelledAt: now,
            notes: `${booking.notes || ''}\n\nCancelled: ${data.reason || 'No reason provided'}. Refund: ${refundPercentage}%`.trim(),
          } as any,
        })

        if (guard.count === 0) {
          throw Object.assign(new Error('ALREADY_CANCELLED'), { code: 'ALREADY_CANCELLED' })
        }

        return await tx.booking.findUnique({ where: { id: params.id } })
      })
    } catch (err: any) {
      if (err?.code === 'ALREADY_CANCELLED') {
        return NextResponse.json({ error: 'Booking has already been cancelled' }, { status: 400 })
      }
      throw err
    }

    // Issue Stripe refund when booking was paid and a refund applies
    let stripeRefundId: string | null = null
    let stripeRefundError: string | null = null

    if (refundAmount > 0 && booking.isPaid) {
      // Look up the PaymentIntent on the booking
      const paymentIntentId = (booking as any).paymentIntentId as string | null

      if (paymentIntentId && stripe) {
        try {
          // Refund the appropriate amount in cents
          const refundAmountCents = Math.round(refundAmount * 100)
          const refund = await stripe.refunds.create({
            payment_intent: paymentIntentId,
            amount: refundAmountCents,
            reason: 'requested_by_customer',
            metadata: {
              bookingId: params.id,
              refundPercentage: String(refundPercentage),
              cancelledBy: 'voice_agent',
              reason: data.reason ?? 'student_request',
            },
          })
          stripeRefundId = refund.id
          console.log(`✅ Stripe refund issued: ${refund.id} — $${refundAmount} for booking ${params.id}`)

          // Record refund in audit log
          await prisma.booking.update({
            where: { id: params.id },
            data: {
              notes: `${updated.notes}\n[Stripe refund: ${refund.id}]`,
            } as any,
          })
        } catch (refundErr: any) {
          stripeRefundError = refundErr.message ?? 'Refund failed'
          console.error(`🚨 Stripe refund failed for booking ${params.id}:`, refundErr)
          // Non-fatal — booking is cancelled, but refund needs manual action
        }
      } else if (!paymentIntentId) {
        console.warn(`⚠️ No paymentIntentId on booking ${params.id} — refund must be processed manually`)
      }
    }

    return NextResponse.json({
      success: true,
      booking: updated,
      refund: {
        percentage: refundPercentage,
        amount: refundAmount,
        stripeRefundId,
        // Tell AI if refund failed so it can advise the caller
        requiresManualAction: refundAmount > 0 && booking.isPaid && !stripeRefundId,
        error: stripeRefundError,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Cancel booking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
