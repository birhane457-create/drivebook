import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkProviderEligible } from '@/lib/booking/checkProviderEligible'
import { emailService } from '@/lib/services/email'
import { googleCalendarService } from '@/lib/services/googleCalendar'
import { calculateTravelTimeToNextBooking } from '@/lib/services/travelTime'
import { paymentService } from '@/lib/services/payment'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { bookingRateLimit, checkRateLimitStrict, getRateLimitIdentifier } from '@/lib/ratelimit'

// Maximum Idempotency-Key length accepted (UUID = 36 chars; allow generous headroom)
const MAX_IDEMPOTENCY_KEY_LENGTH = 128

export const dynamic = 'force-dynamic';

const phoneSchema = z
  .string()
  .transform((s) => s.replace(/\s+/g, ''))
  .refine((p) => /^\+?\d{9,15}$/.test(p), { message: 'Invalid phone number' })

const publicBookingSchema = z.object({
  providerId: z.string(),
  customerName: z.string(),
  customerEmail: z.string().email(),
  customerPhone: phoneSchema,
  pickupAddress: z.string(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  notes: z.string().optional(),
  price: z.number().optional(),
  createAccount: z.boolean().optional(),
  password: z.string().optional(),
  termsAccepted: z.boolean().optional(),
  ageDeclaration: z.boolean().optional(),
  termsVersion: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = publicBookingSchema.parse(body)

    // Idempotency-Key deduplication
    // Callers (browser double-click, Twilio retry, AI retry) may send the same
    // request multiple times. If we already processed this key + email pair,
    // replay the stored response — no duplicate booking, no double-charge.
    const idempotencyKey = req.headers.get('Idempotency-Key')?.trim() ?? null
    if (idempotencyKey) {
      if (idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
        return NextResponse.json({ error: 'Idempotency-Key too long' }, { status: 400 })
      }
      const existing = await (prisma as any).bookingIdempotencyKey.findUnique({
        where: { key: idempotencyKey },
      })
      if (existing) {
        // Scope guard: key must belong to the same email to prevent cross-account replay
        if (existing.email !== data.customerEmail) {
          return NextResponse.json({ error: 'Idempotency-Key does not match account' }, { status: 409 })
        }
        return NextResponse.json(existing.response, { status: 201 })
      }
    }

    const startTime = new Date(data.startTime)
    const endTime = new Date(data.endTime)

    // Basic sanity check on times
    if (
      !(startTime instanceof Date) || isNaN(startTime.getTime()) ||
      !(endTime instanceof Date)   || isNaN(endTime.getTime())   ||
      endTime <= startTime
    ) {
      return NextResponse.json({ error: 'Invalid start or end time' }, { status: 400 })
    }

    // ── Provider eligibility gate (DOC-EXP-01 fix) ───────────────────────────
    // Checks: exists, approvalStatus=APPROVED, isActive, subscription,
    // acceptingBookings, and driving document expiry dates.
    // Replaces the previous inline subscription+pause-only gate which was missing
    // approvalStatus, isActive, and all document expiry checks.
    const eligible = await checkProviderEligible(data.providerId, prisma)
    if (!eligible.allowed) {
      return NextResponse.json(
        { error: eligible.error, code: eligible.code },
        { status: eligible.status },
      )
    }
    const instructor = eligible.provider

    // Fetch user email + phone for booking confirmation notification only
    const instructorContact = instructor.userId
      ? await prisma.user.findUnique({
          where:  { id: instructor.userId },
          select: { email: true },
        })
      : null
    // Phone lives on Provider — fetch it separately for the confirmation email
    const instructorPhone = await prisma.provider.findUnique({
      where:  { id: instructor.id },
      select: { phone: true },
    }).then(r => r?.phone ?? '')

    // Rate limiting: limit bookings per client/instructor/IP
    const ip = req.headers.get('x-forwarded-for') || req.ip || 'unknown'
    const identifier = getRateLimitIdentifier(undefined, ip, `public-booking:${data.customerEmail}:${data.providerId}`)
    const rate = await checkRateLimitStrict(bookingRateLimit, identifier)
    if (!rate.success) {
      return new NextResponse(JSON.stringify({ error: rate.error }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...(rate.headers || {}),
        },
      })
    }

    // Compute authoritative price on server (ignore client-provided amount)
    const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
    if (durationHours <= 0) {
      return NextResponse.json({ error: 'Invalid booking duration' }, { status: 400 })
    }

    const rawPrice = instructor.hourlyRate * durationHours
    const bookingPrice = Math.round(rawPrice * 100) / 100

    // Create user account if requested
    let userId: string | undefined;
    if (data.createAccount && data.password) {
      const existingUser = await prisma.user.findUnique({
        where: { email: data.customerEmail }
      });

      if (!existingUser) {
        const hashedPassword = await bcrypt.hash(data.password, 10);
        const newUser = await prisma.user.create({
          data: {
            email: data.customerEmail,
            password: hashedPassword,
            role: 'CLIENT',
            ...(data.termsAccepted && {
              termsAcceptedAt: new Date(),
              termsVersion: data.termsVersion || '1.0',
              ageDeclaration: data.ageDeclaration ?? false,
            }),
          } as any
        });
        userId = newUser.id;

        await emailService.sendWelcomeEmail({
          customerName: data.customerName,
          customerEmail: data.customerEmail,
        });
      } else {
        userId = existingUser.id;
        if (data.termsAccepted && !(existingUser as any).termsAcceptedAt) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              termsAcceptedAt: new Date(),
              termsVersion: data.termsVersion || '1.0',
              ageDeclaration: data.ageDeclaration ?? false,
            } as any
          })
        }
      }
    }

    // Create or find client
    let client = await prisma.customer.findFirst({
      where: {
        email: data.customerEmail,
        bookings: { some: { providerId: data.providerId } }
      }
    })

    if (!client) {
      client = await prisma.customer.create({
        data: {
          preferredProviderId: data.providerId,
          userId: userId,
          name: data.customerName,
          email: data.customerEmail,
          phone: data.customerPhone
        }
      })
    } else if (userId && !client.userId) {
      client = await prisma.customer.update({
        where: { id: client.id },
        data: { userId }
      });
    }

    const travelTime = await calculateTravelTimeToNextBooking(
      data.providerId,
      startTime,
      data.pickupAddress,
      prisma
    )

    const commission = await paymentService.calculateCommission(
      data.providerId,
      client.id,
      bookingPrice
    )

    let booking: any
    try {
      booking = await prisma.$transaction(async (tx) => {
        const conflictingBooking = await tx.booking.findFirst({
          where: {
            providerId: data.providerId,
            status: { in: ['PENDING', 'PENDING_PAYMENT', 'CONFIRMED'] },
            OR: [
              { startTime: { lte: startTime }, endTime: { gt: startTime } },
              { startTime: { lt: endTime }, endTime: { gte: endTime } },
              { startTime: { gte: startTime }, endTime: { lte: endTime } },
            ],
          },
        })

        if (conflictingBooking) {
          throw Object.assign(new Error('SLOT_UNAVAILABLE'), { code: 'SLOT_UNAVAILABLE' })
        }

        const newBooking = await tx.booking.create({
          data: {
            providerId: data.providerId,
            customerId: client.id,
            bookingType: 'LESSON',
            status: 'PENDING',
            startTime,
            endTime,
            pickupAddress: data.pickupAddress,
            price: bookingPrice,
            platformFee: commission.platformFee,
            providerPayout: commission.providerPayout,
            commissionRate: commission.commissionRate,
            isFirstBooking: commission.isFirstBooking,
            notes: data.notes,
            createdBy: 'customer',
            originalStartTime: startTime,
            travelTimeMinutes: travelTime,
          } as any,
        })

        if (idempotencyKey) {
          await (tx as any).bookingIdempotencyKey.upsert({
            where: { key: idempotencyKey },
            update: {},
            create: {
              key: idempotencyKey,
              email: data.customerEmail,
              bookingId: newBooking.id,
              response: {
                success: true,
                booking: newBooking,
                redirectTo: `/booking/${newBooking.id}/payment`,
              },
            },
          })
        }

        return newBooking
      })
    } catch (err: any) {
      if (err?.code === 'SLOT_UNAVAILABLE') {
        return NextResponse.json({
          error: 'This time slot is no longer available. Please select a different time.',
          code: 'SLOT_UNAVAILABLE',
        }, { status: 409 })
      }
      throw err
    }

    // Push to Google Calendar if connected
    if (instructor.syncGoogleCalendar) {
      try {
        const calendarResult = await googleCalendarService.createCalendarEvent(data.providerId, {
          id: booking.id,
          startTime,
          endTime,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          pickupAddress: data.pickupAddress,
          notes: data.notes
        })
        if (calendarResult.eventId) {
          await prisma.booking.update({
            where: { id: booking.id },
            data: { googleCalendarEventId: calendarResult.eventId } as any
          })
        }
      } catch (error) {
        console.error('Failed to push to Google Calendar:', error)
      }
    }

    // Send booking confirmation emails
    await emailService.sendBookingConfirmation({
      customerName:   data.customerName,
      customerEmail:  data.customerEmail,
      customerPhone:  data.customerPhone,
      instructorName:  instructor.name,
      instructorEmail: instructorContact?.email || '',
      instructorPhone: instructorPhone,
      startTime,
      endTime,
      pickupAddress: data.pickupAddress
    })

    // Audit log
    try {
      await prisma.auditLog.create({
        data: {
          action:    'BOOKING_CREATED',
          actorId:   userId ?? 'GUEST',
          actorRole: 'CLIENT',
          targetType: 'BOOKING',
          targetId:   booking.id,
          success:    true,
          metadata: {
            providerId:    data.providerId,
            customerName:  data.customerName,
            customerPhone: data.customerPhone,
            startTime:     startTime.toISOString(),
            price:         bookingPrice,
            source:        'public_single',
          },
        },
      })
    } catch (auditErr) {
      console.error('Audit log failed for public booking creation:', auditErr)
    }

    const responsePayload = {
      success:    true,
      booking,
      redirectTo: `/booking/${booking.id}/payment`,
    }

    return NextResponse.json(responsePayload, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Public booking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
