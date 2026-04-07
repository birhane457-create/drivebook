import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { availabilityService } from '@/lib/services/availability'
import { emailService } from '@/lib/services/email'
import { sendWalletLessonReceipt } from '@/lib/services/receipt-email'
import { googleCalendarService } from '@/lib/services/googleCalendar'
import { logBookingAction, AuditAction, ActorRole } from '@/lib/services/auditLogger'
import { paymentService } from '@/lib/services/payment'
import { getWalletBalance } from '@/lib/services/wallet-helpers'
import { notifyBookingRequest } from '@/lib/services/notifications'
import { getNotifChannels, getBookingSettings } from '@/lib/config/platform-settings'
import { requireActiveSubscription } from '@/lib/middleware/subscriptionValidation'
import { bookingRateLimit, checkRateLimit, getRateLimitIdentifier } from '@/lib/ratelimit'
import { getCommissionRate } from '@/lib/services/platform-pricing'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const PLATFORM_FEE_RATE = 0.036 // 3.6% — stored on booking for reporting

const bookingSchema = z.object({
  clientId: z.string(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  bookingType: z.enum(['LESSON', 'PDA_TEST', 'MOCK_TEST']).optional().default('LESSON'),
  pickupAddress: z.string().optional(),
  pickupLatitude: z.number().optional(),
  pickupLongitude: z.number().optional(),
  dropoffAddress: z.string().optional(),
  notes: z.string().optional(),
  // PDA Test specific fields
  testCenterName: z.string().optional(),
  testCenterAddress: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Subscription check
    const subscriptionCheck = await requireActiveSubscription(session.user.id)
    if (!subscriptionCheck.valid) {
      return NextResponse.json({
        error: subscriptionCheck.message,
        requiresSubscription: true
      }, { status: 403 })
    }

    // Rate limiting
    const rateLimitId = getRateLimitIdentifier(
      session.user.instructorId,
      req.headers.get('x-forwarded-for'),
      'booking'
    )
    const rateLimitResult = await checkRateLimit(bookingRateLimit, rateLimitId)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const body = await req.json()
    const data = bookingSchema.parse(body)

    const newStart = new Date(data.startTime)
    const newEnd = new Date(data.endTime)
    const now = new Date()

    // Past booking guard
    if (newStart < now) {
      return NextResponse.json({ error: 'Cannot create bookings in the past' }, { status: 400 })
    }

    // Admin-configured booking window
    const bookingSettings = getBookingSettings()
    const isPackageBooking = !!(body.packageId || body.isPackage)
    const minAdvanceMs = bookingSettings.minAdvanceHours * 60 * 60 * 1000
    if (!isPackageBooking || !bookingSettings.packageBypassMinAdvance) {
      if (newStart.getTime() - now.getTime() < minAdvanceMs) {
        return NextResponse.json({
          error: `Bookings must be made at least ${bookingSettings.minAdvanceHours} hour${bookingSettings.minAdvanceHours !== 1 ? 's' : ''} in advance`
        }, { status: 400 })
      }
    }
    const maxAdvanceMs = bookingSettings.maxAdvanceDays * 24 * 60 * 60 * 1000
    if (newStart.getTime() - now.getTime() > maxAdvanceMs) {
      return NextResponse.json({
        error: `Bookings cannot be made more than ${bookingSettings.maxAdvanceDays} days in advance`
      }, { status: 400 })
    }

    // Verify client belongs to this instructor
    const client = await prisma.client.findFirst({
      where: { id: data.clientId, instructorId: session.user.instructorId },
      include: { user: true }
    })
    if (!client) {
      return NextResponse.json({ error: 'Client not found or does not belong to you' }, { status: 404 })
    }

    // Suspended client guard
    if ((client as any).status === 'SUSPENDED') {
      return NextResponse.json({ error: 'Cannot book with suspended client' }, { status: 403 })
    }

    // Get instructor for pricing + calendar check
    const instructor = await prisma.instructor.findUnique({
      where: { id: session.user.instructorId },
      include: { user: true }
    })
    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 })
    }

    // Calculate price — always server-side, never trust client input
    const durationHours = (newEnd.getTime() - newStart.getTime()) / (1000 * 60 * 60)
    const lessonPrice = parseFloat((instructor.hourlyRate * durationHours).toFixed(2))
    const platformFee = parseFloat((lessonPrice * PLATFORM_FEE_RATE).toFixed(2))
    const commissionRatePct = await getCommissionRate(instructor.subscriptionTier ?? 'BASIC')
    const commissionRate = commissionRatePct / 100
    const instructorPayout = parseFloat((lessonPrice * (1 - commissionRate)).toFixed(2))

    // isFirstBooking check (real DB query via paymentService)
    const isFirstBooking = await paymentService.isFirstBookingWithClient(
      session.user.instructorId,
      data.clientId
    )

    // ── WALLET CHECK ──────────────────────────────────────────────────────────
    // Every client added via POST /api/clients now has a userId (silently
    // created). The no-account path is a legacy edge case — handle gracefully.
    if (!client.userId) {
      return NextResponse.json({
        error: 'Client account not set up. Please remove and re-add this client.',
        noAccount: true,
      }, { status: 422 })
    }

    const { balance } = await getWalletBalance(client.userId)
    if (balance < lessonPrice) {
      // Create booking as PENDING_PAYMENT — no wallet deduction yet.
      // Send the student an email: "your instructor booked a lesson, top up to confirm."
      // This is the natural first contact — they have a real reason to act.
      const hasConflict = await availabilityService.checkDoubleBooking(
        session.user.instructorId, newStart, newEnd
      )
      if (hasConflict) {
        return NextResponse.json({ error: 'Time slot already booked' }, { status: 409 })
      }

      const pickupLocation = data.pickupAddress || client.defaultPickupAddress || null
      const pendingBooking = await prisma.booking.create({
        data: {
          instructorId: session.user.instructorId,
          clientId: data.clientId,
          clientName: client.name,
          clientPhone: client.phone,
          bookingType: data.bookingType,
          startTime: newStart,
          endTime: newEnd,
          duration: durationHours * 60,
          price: lessonPrice,
          platformFee,
          instructorPayout,
          commissionRate,
          isFirstBooking,
          isPaid: false,
          pickupAddress: pickupLocation,
          pickupLatitude: data.pickupLatitude ?? client.defaultPickupLat,
          pickupLongitude: data.pickupLongitude ?? client.defaultPickupLng,
          dropoffAddress: data.dropoffAddress,
          notes: data.notes,
          status: 'PENDING_PAYMENT',
          createdBy: 'instructor',
          originalStartTime: newStart,
        } as any,
        include: { client: true, instructor: { include: { user: true } } }
      })

      // Send "top up to confirm" email — includes set-password link if account is new
      try {
        const clientUser = await prisma.user.findUnique({
          where: { id: client.userId },
          select: { resetToken: true, resetTokenExpiry: true }
        })
        const shortfall = parseFloat((lessonPrice - balance).toFixed(2))
        const topUpAmount = parseFloat((shortfall / (1 - PLATFORM_FEE_RATE)).toFixed(2))
        const dateStr = newStart.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })
        const timeStr = newStart.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })

        // If account is new (has a resetToken), link to set-password page
        // Otherwise link to login page
        const isNewAccount = !!(clientUser?.resetToken && clientUser.resetTokenExpiry && clientUser.resetTokenExpiry > new Date())
        const actionUrl = isNewAccount
          ? `${process.env.NEXTAUTH_URL}/reset-password?token=${clientUser!.resetToken}`
          : `${process.env.NEXTAUTH_URL}/login`
        const actionLabel = isNewAccount ? 'Set Password & Top Up →' : 'Log In & Top Up →'

        await emailService.sendGenericEmail({
          to: client.email,
          subject: `📅 ${instructor.name} booked a lesson for you — top up to confirm`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                .lesson-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #10b981; }
                .cta-box { background: #eff6ff; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center; }
                .button { display: inline-block; background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; }
                .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1 style="margin:0;font-size:24px;">📅 Lesson Booked for You</h1>
                </div>
                <div class="content">
                  <p>Hi ${client.name},</p>
                  <p><strong>${instructor.name}</strong> has booked a driving lesson for you.</p>
                  <div class="lesson-box">
                    <h3 style="margin-top:0;">Lesson Details</h3>
                    <p style="margin:5px 0;"><strong>Date:</strong> ${dateStr}</p>
                    <p style="margin:5px 0;"><strong>Time:</strong> ${timeStr}</p>
                    <p style="margin:5px 0;"><strong>Duration:</strong> ${durationHours} hour${durationHours !== 1 ? 's' : ''}</p>
                    <p style="margin:5px 0;"><strong>Cost:</strong> $${lessonPrice.toFixed(2)}</p>
                  </div>
                  <div class="cta-box">
                    <h3 style="margin-top:0;">Top up your wallet to confirm</h3>
                    <p>You need <strong>$${topUpAmount.toFixed(2)}</strong> in your DriveBook wallet to confirm this booking.</p>
                    <a href="${actionUrl}" class="button">${actionLabel}</a>
                  </div>
                  <p style="color:#6b7280;font-size:14px;">Once your wallet is topped up, the booking will be confirmed automatically.</p>
                  <div class="footer"><p><strong>DriveBook</strong> — Your Driving Instructor Platform</p></div>
                </div>
              </div>
            </body>
            </html>
          `
        })
      } catch (e) {
        console.error('Top-up email failed:', e)
      }

      try {
        await logBookingAction({
          bookingId: pendingBooking.id,
          action: AuditAction.BOOKING_CREATED,
          actorId: session.user.instructorId,
          actorRole: ActorRole.INSTRUCTOR,
          metadata: { clientId: data.clientId, price: pendingBooking.price, pendingPayment: true }
        })
      } catch (e) { /* non-critical */ }

      return NextResponse.json({
        success: true,
        booking: pendingBooking,
        pendingPayment: true,
        message: `Booking created. An email has been sent to ${client.email} to top up their wallet and confirm.`,
      }, { status: 201 })
    }

    // ── AVAILABILITY CHECK ────────────────────────────────────────────────────
    // NOTE: Pre-check outside transaction for fast rejection. The definitive
    // check is INSIDE the transaction below to prevent TOCTOU race conditions.
    const hasConflict = await availabilityService.checkDoubleBooking(
      session.user.instructorId,
      newStart,
      newEnd
    )
    if (hasConflict) {
      return NextResponse.json({ error: 'Time slot already booked' }, { status: 409 })
    }

    // ── CREATE BOOKING + DEDUCT WALLET (atomic) ───────────────────────────────
    const booking = await prisma.$transaction(async (tx) => {
      // Pickup location: use provided value or fall back to client's default
      const pickupLocation = data.pickupAddress || client.defaultPickupAddress || null
      const pickupLat = data.pickupLatitude ?? client.defaultPickupLat
      const pickupLng = data.pickupLongitude ?? client.defaultPickupLng

      // Re-check wallet balance inside transaction to prevent race conditions
      const wallet = await tx.clientWallet.findUnique({ where: { userId: client.userId! } })
      if (!wallet) throw new Error('Wallet not found')

      const txns = await tx.walletTransaction.findMany({
        where: { walletId: wallet.id, status: 'CONFIRMED' }
      })
      const txBalance = txns.reduce((sum, t) => t.type === 'CREDIT' ? sum + t.amount : sum - t.amount, 0)
      if (txBalance < lessonPrice) throw new Error('INSUFFICIENT_BALANCE')

      // ── Definitive slot conflict check inside transaction (prevents TOCTOU race) ──
      const slotConflict = await tx.booking.findFirst({
        where: {
          instructorId: session.user.instructorId,
          status: { in: ['PENDING', 'PENDING_PAYMENT', 'CONFIRMED'] },
          OR: [
            { startTime: { lte: newStart }, endTime: { gt: newStart } },
            { startTime: { lt: newEnd }, endTime: { gte: newEnd } },
            { startTime: { gte: newStart }, endTime: { lte: newEnd } },
          ],
        },
        select: { id: true },
      })
      if (slotConflict) throw new Error('SLOT_TAKEN')

      // Deduct from wallet (update both stored balance and transaction log)
      await tx.clientWallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: lessonPrice } },
      })
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'DEBIT',
          amount: lessonPrice,
          description: `Lesson booking — ${newStart.toLocaleDateString('en-AU')} ${newStart.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}`,
          status: 'CONFIRMED',
        }
      })

      // Create booking
      const newBooking = await tx.booking.create({
        data: {
          instructorId: session.user.instructorId,
          clientId: data.clientId,
          clientName: client.name,
          clientPhone: client.phone,
          bookingType: data.bookingType,
          startTime: newStart,
          endTime: newEnd,
          duration: durationHours * 60,
          price: lessonPrice,
          platformFee,
          instructorPayout,
          commissionRate,
          isFirstBooking,
          isPaid: true,
          paidAt: now,
          pickupAddress: pickupLocation,
          pickupLatitude: pickupLat,
          pickupLongitude: pickupLng,
          dropoffAddress: data.dropoffAddress,
          notes: data.notes,
          status: 'CONFIRMED',
          createdBy: 'instructor',
          originalStartTime: newStart,
        } as any,
        include: {
          client: true,
          instructor: { include: { user: true } }
        }
      })

      // Create transaction record
      await (tx as any).transaction.create({
        data: {
          bookingId: newBooking.id,
          instructorId: session.user.instructorId,
          type: 'BOOKING_PAYMENT',
          amount: lessonPrice,
          platformFee,
          instructorPayout,
          commissionRate,
          status: 'COMPLETED',
          description: `Booking payment — ${isFirstBooking ? 'First booking with client' : 'Repeat booking'}`,
          metadata: { isFirstBooking },
        }
      })

      return newBooking
    }, { maxWait: 5000, timeout: 10000 })

    // Audit log — record instructor-created booking (non-critical)
    try {
      await logBookingAction({
        bookingId: booking.id,
        action: AuditAction.BOOKING_CREATED,
        actorId: session.user.instructorId,
        actorRole: ActorRole.INSTRUCTOR,
        metadata: { clientId: data.clientId, price: booking.price, durationHours }
      })
    } catch (auditErr) {
      console.error('Audit log failed for booking creation:', auditErr)
    }

    // Google Calendar sync (non-critical)
    try {
      if (instructor.syncGoogleCalendar) {
        const result = await googleCalendarService.createCalendarEvent(
          session.user.instructorId,
          {
            id: booking.id,
            startTime: newStart,
            endTime: newEnd,
            clientName: client.name,
            clientPhone: client.phone,
            pickupAddress: data.pickupAddress,
            notes: data.notes,
          }
        )
        if (result.success && result.eventId) {
          await prisma.booking.update({
            where: { id: booking.id },
            data: { googleCalendarEventId: result.eventId } as any
          })
        }
      }
    } catch (e) {
      console.error('Calendar sync failed:', e)
    }

    // Email confirmation + receipt (non-critical)
    try {
      await emailService.sendBookingConfirmation({
        clientName: booking.client!.name,
        clientEmail: booking.client!.email,
        instructorName: booking.instructor.name,
        instructorEmail: booking.instructor.user!.email,
        startTime: booking.startTime!,
        endTime: booking.endTime!,
        pickupAddress: booking.pickupAddress || undefined,
      })
    } catch (e) {
      console.error('Email confirmation failed:', e)
    }

    try {
      // Fetch wallet balance after deduction for the receipt
      const clientWallet = await prisma.clientWallet.findUnique({ where: { userId: client.userId! } })
      const walletAfter = clientWallet?.balance ?? 0
      await sendWalletLessonReceipt({
        clientName: booking.client!.name,
        clientEmail: booking.client!.email,
        receiptId: booking.id,
        bookedAt: now,
        instructorName: booking.instructor.name,
        lessonDate: newStart,
        durationHours,
        hourlyRate: instructor.hourlyRate,
        lessonCost: lessonPrice,
        walletBalanceBefore: walletAfter + lessonPrice,
        walletBalanceAfter: walletAfter,
        bookedBy: 'instructor',
      })
    } catch (e) {
      console.error('Receipt email failed:', e)
    }

    // In-app notification (non-critical)
    try {
      const reqChannels = getNotifChannels('BOOKING_REQUEST')
      if (reqChannels.inApp && session.user.id) {
        await notifyBookingRequest(session.user.id, client.name, booking.id, newStart)
      }
    } catch (e) {
      console.error('Notification failed:', e)
    }

    return NextResponse.json({ success: true, booking }, { status: 201 })
  } catch (error: any) {
    if (error?.message === 'INSUFFICIENT_BALANCE') {
      return NextResponse.json({ error: 'Insufficient wallet balance', insufficientBalance: true }, { status: 422 })
    }
    if (error?.message === 'SLOT_TAKEN') {
      return NextResponse.json({ error: 'Time slot was just taken. Please choose another time.' }, { status: 409 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Create booking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const bookings = await prisma.booking.findMany({
      where: {
        instructorId: session.user.instructorId,
        status: { in: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] },
        deletedAt: null,
      } as any,
      include: { client: true },
      orderBy: { startTime: 'asc' }
    })

    return NextResponse.json(bookings)
  } catch (error) {
    console.error('Fetch bookings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
