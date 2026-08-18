import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { availabilityService, invalidateAvailabilityCache } from '@/lib/services/availability'
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
import { getCommissionRate, getPlatformFeeRate } from '@/lib/services/platform-pricing'
import { recordBookingPayment } from '@/lib/services/ledger-operations'
import { enqueueNotification, drainRetryQueueAsync } from '@/lib/services/notificationRetry'
import { z } from 'zod'
import { getDisplayName } from '@/lib/utils/account'
import { DEFAULT_TIMEZONE, resolveTimezone, timezoneFromState } from '@/lib/utils/timezone'

export const dynamic = 'force-dynamic'

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

    // Approval check — instructor must be APPROVED before creating bookings
    // They can register and set up their profile while PENDING, but cannot book until approved.
    const instructorApproval = await prisma.instructor.findUnique({
      where: { id: session.user.instructorId },
      select: { approvalStatus: true, isActive: true }
    })
    if (!instructorApproval || instructorApproval.approvalStatus !== 'APPROVED') {
      return NextResponse.json({
        error: 'Your account is pending approval. You can create bookings once an admin approves your application.',
        requiresApproval: true,
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

    // Reject legacy instructor add-on / special-service payloads
    if (
      Object.prototype.hasOwnProperty.call(body, 'specialServiceId') ||
      Object.prototype.hasOwnProperty.call(body, 'specialServiceName') ||
      Object.prototype.hasOwnProperty.call(body, 'specialServiceType') ||
      Object.prototype.hasOwnProperty.call(body, 'customPackageId') ||
      Object.prototype.hasOwnProperty.call(body, 'customPackagePrice')
    ) {
      return NextResponse.json({
        error: 'Instructor special services are not supported. Use standard hourly lessons, platform bulk packages (6/10/15h), or PDA test packs configured in instructor settings.'
      }, { status: 400 })
    }

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
      select: {
        id: true,
        name: true,
        approvalStatus: true,
        isActive: true,
        subscriptionStatus: true,
        subscriptionTier: true,
        syncGoogleCalendar: true,
        hourlyRate: true,
        timezone: true,
        state: true,
        paymentMode: true,
        accountType: true,
        user: { select: { email: true } },
      },
    })
    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 })
    }

    // Calculate price — always server-side, never trust client input
    const durationHours = (newEnd.getTime() - newStart.getTime()) / (1000 * 60 * 60)
    
    const lessonPrice = parseFloat((instructor.hourlyRate * durationHours).toFixed(2))
    const instructorTimezone = instructor.timezone
      ? resolveTimezone(instructor.timezone)
      : timezoneFromState(instructor.state)

    // ── Commission calculation — DIRECT mode = zero commission ───────────────
    // DIRECT (BUSINESS): instructor receives 100% — no DriveBook cut per booking.
    // PLATFORM (all other tiers): standard commission deducted.
    const isDirectMode = instructor.paymentMode === 'DIRECT'
    const platformFeeRate = isDirectMode ? 0 : await getPlatformFeeRate()
    const platformFee = isDirectMode ? 0 : parseFloat((lessonPrice * (platformFeeRate / 100)).toFixed(2))
    const commissionRatePct = isDirectMode ? 0 : await getCommissionRate(instructor.subscriptionTier ?? 'BASIC')
    const commissionRate = commissionRatePct / 100
    const instructorPayout = isDirectMode
      ? lessonPrice
      : parseFloat((lessonPrice * (1 - commissionRate)).toFixed(2))

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
      
      // ── ATOMIC TRANSACTION FOR RACE CONDITION PREVENTION ─────────────────────────
      // Use Prisma transaction to atomically:
      // 1. Check for slot conflicts (within transaction lock)
      // 2. Create booking
      // This prevents race conditions where multiple requests could book same slot
      const pickupLocation = data.pickupAddress || client.defaultPickupAddress || null
      
      let pendingBooking
      try {
        pendingBooking = await prisma.$transaction(async (tx) => {
          // Within transaction: check for overlapping bookings
          const overlappingBookings = await tx.booking.findFirst({
            where: {
              instructorId: session.user.instructorId,
              status: { in: ['PENDING', 'PENDING_PAYMENT', 'CONFIRMED'] },
              OR: [
                // Booking starts during this slot
                { AND: [{ startTime: { gte: newStart } }, { startTime: { lt: newEnd } }] },
                // Booking ends during this slot
                { AND: [{ endTime: { gt: newStart } }, { endTime: { lte: newEnd } }] },
                // Booking completely encompasses this slot
                { AND: [{ startTime: { lte: newStart } }, { endTime: { gte: newEnd } }] }
              ]
            }
          })

          if (overlappingBookings) {
            throw new Error('SLOT_CONFLICT')
          }

          // Create booking atomically within the transaction
          return await tx.booking.create({
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
              // Lock hourly rate at booking time — immutable even if instructor changes rate later.
              lockedHourlyRate: instructor.hourlyRate,
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
        })
      } catch (txError) {
        if ((txError as Error).message === 'SLOT_CONFLICT') {
          return NextResponse.json({ 
            error: 'Time slot already booked by another request. Please select a different time.' 
          }, { status: 409 })
        }
        throw txError
      }

      // Send "top up to confirm" email — always includes a fresh setup/login link
      try {
        let clientUser = await prisma.user.findUnique({
          where: { id: client.userId },
          select: { resetToken: true, resetTokenExpiry: true }
        })
        const shortfall = parseFloat((lessonPrice - balance).toFixed(2))
        const topUpAmount = parseFloat((shortfall / (1 - platformFeeRate / 100)).toFixed(2))
        const dateStr = newStart.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: instructorTimezone })
        const timeStr = newStart.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: instructorTimezone })

        // Always generate a fresh setup/reset token so the email link works
        // regardless of whether account was just created or was added days ago.
        // This is safe — it only lets them set a password, not bypass payment.
        const { randomUUID } = await import('crypto')
        const freshToken = randomUUID()
        const freshExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        await prisma.user.update({
          where: { id: client.userId! },
          data: { resetToken: freshToken, resetTokenExpiry: freshExpiry },
        })

        const actionUrl = `${process.env.NEXTAUTH_URL}/set-password?token=${freshToken}`
        const actionLabel = 'Set up your account & Top Up →'

        await emailService.sendGenericEmail({
          from: 'DriveBook Bookings <bookings@drivebook.com.au>',
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
        // Queue for retry — client won't see their booking confirmation if this stays lost
        await enqueueNotification({
          channel: 'EMAIL',
          recipient: client.email,
          subject: `📅 ${instructor.name} booked a lesson for you — top up to confirm`,
          body: `<p>Hi ${client.name}, your lesson was booked but the confirmation email failed to send. Please log in to view your booking.</p>`,
          idempotencyKey: `topup-email-${pendingBooking.id}`,
          bookingId: pendingBooking.id,
          userId: client.userId ?? undefined,
        })
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

    // ── AVAILABILITY CHECK & BOOKING CREATION (atomic transaction) ────────────
    // NO pre-check outside transaction — eliminates TOCTOU race condition.
    // All validation (slot conflict, wallet, etc) happens atomically within transaction.
    // If check fails, entire transaction rolls back (no partial booking created).

    // ── CREATE BOOKING + DEDUCT WALLET (atomic) ───────────────────────────────
    let booking
    try {
      booking = await prisma.$transaction(async (tx) => {
        // First: Check for overlapping bookings with current read lock
        const overlappingBookings = await tx.booking.findFirst({
          where: {
            instructorId: session.user.instructorId,
            status: { in: ['PENDING', 'PENDING_PAYMENT', 'CONFIRMED'] },
            OR: [
              { AND: [{ startTime: { gte: newStart } }, { startTime: { lt: newEnd } }] },
              { AND: [{ endTime: { gt: newStart } }, { endTime: { lte: newEnd } }] },
              { AND: [{ startTime: { lte: newStart } }, { endTime: { gte: newEnd } }] }
            ]
          }
        })

        if (overlappingBookings) {
          throw new Error('SLOT_CONFLICT')
        }

        // Second: All checks passed, proceed with booking creation and wallet deduction
        const pickupLocation = data.pickupAddress || client.defaultPickupAddress || null
        const pickupLat = data.pickupLatitude ?? client.defaultPickupLat
        const pickupLng = data.pickupLongitude ?? client.defaultPickupLng

        // Re-check wallet balance inside transaction to prevent race conditions
        // Use aggregate (not findMany) — avoids loading all transactions into memory
        const wallet = await tx.clientWallet.findUnique({ where: { userId: client.userId! } })
        if (!wallet) throw new Error('Wallet not found')

        const balanceAgg = await tx.walletTransaction.aggregate({
          where: { walletId: wallet.id, status: 'CONFIRMED', type: 'CREDIT' },
          _sum: { amount: true },
        })
        const debitAgg = await tx.walletTransaction.aggregate({
          where: { walletId: wallet.id, status: 'CONFIRMED', type: 'DEBIT' },
          _sum: { amount: true },
        })
        const txBalance = (balanceAgg._sum.amount ?? 0) - (debitAgg._sum.amount ?? 0)
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
            description: `Lesson booking — ${newStart.toLocaleDateString('en-AU', { timeZone: instructorTimezone })} ${newStart.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: instructorTimezone })}`,
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
            // Lock hourly rate at booking time — immutable even if instructor changes rate later.
            lockedHourlyRate: instructor.hourlyRate,
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
    } catch (error) {
      if (error instanceof Error && (error.message === 'SLOT_TAKEN' || error.message === 'SLOT_ALREADY_BOOKED')) {
        return NextResponse.json({
          error: 'Time slot already booked. Please select a different time.',
        }, { status: 409 })
      }
      if (error instanceof Error && error.message === 'INSUFFICIENT_BALANCE') {
        return NextResponse.json({
          error: 'Insufficient wallet balance.',
          insufficientBalance: true,
        }, { status: 422 })
      }
      throw error
    }

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

    // Invalidate availability cache for this instructor+date so the next slot
    // query reflects the newly created booking immediately.
    if (booking.startTime) {
      invalidateAvailabilityCache(
        session.user.instructorId,
        booking.startTime.toISOString().slice(0, 10)
      );
    }

    // FinancialLedger — record booking payment with deterministic idempotency keys
    // Written after the $transaction commits so the DB connection is clean.
    // Idempotent: safe to retry — duplicate idempotencyKey is silently ignored.
    try {
      if (booking.isPaid && client.userId) {
        await recordBookingPayment({
          bookingId: booking.id,
          userId: client.userId,
          instructorId: session.user.instructorId,
          totalAmount: booking.price,
          platformFee: booking.platformFee ?? 0,
          instructorPayout: booking.instructorPayout ?? 0,
          createdBy: session.user.instructorId,
        })
      }
    } catch (ledgerErr) {
      console.error('[Ledger] Failed to record booking payment (non-critical):', ledgerErr)
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

    // Email confirmation + receipt — with SMS + in-app fallback if email fails
    let emailConfirmationSent = false;
    try {
      await emailService.sendBookingConfirmation({
        clientName: booking.client!.name,
        clientEmail: booking.client!.email,
        instructorName: getDisplayName(booking.instructor),
        instructorEmail: booking.instructor.user!.email,
        startTime: booking.startTime!,
        endTime: booking.endTime!,
        pickupAddress: booking.pickupAddress || undefined,
      })
      emailConfirmationSent = true;
    } catch (e) {
      console.error('Email confirmation failed — attempting SMS + in-app fallback:', e)

      // Fallback 1: SMS to client if they have a phone number
      if (client.phone) {
        try {
          const { smsService } = await import('@/lib/services/sms');
          await smsService.sendBookingConfirmation({
            clientPhone: client.phone,
            clientName: client.name,
            instructorName: getDisplayName(booking.instructor),
            startTime: booking.startTime!,
            price: booking.price,
          });
        } catch (smsErr) {
          console.error('SMS fallback also failed:', smsErr)
          // Queue SMS retry as well
          await enqueueNotification({
            channel: 'SMS',
            recipient: client.phone,
            body: `Booking confirmed with ${getDisplayName(booking.instructor)} on ${booking.startTime!.toLocaleDateString('en-AU', { timeZone: instructorTimezone })}. Cost: $${booking.price.toFixed(2)}`,
            idempotencyKey: `booking-confirm-sms-${booking.id}`,
            bookingId: booking.id,
            userId: client.userId ?? undefined,
          })
        }
      }

      // Queue email retry — client must get their confirmation
      await enqueueNotification({
        channel: 'EMAIL',
        recipient: booking.client!.email,
        subject: `Booking Confirmed — ${booking.startTime!.toLocaleDateString('en-AU', { timeZone: instructorTimezone })}`,
        body: `<p>Hi ${booking.client!.name}, your lesson with ${getDisplayName(booking.instructor)} is confirmed. Log in to view details.</p>`,
        idempotencyKey: `booking-confirm-email-${booking.id}`,
        bookingId: booking.id,
        userId: client.userId ?? undefined,
      })

      // Fallback 2: In-app notification so the client sees confirmation in their dashboard
      if (client.userId) {
        try {
          const { notifyClientBookingConfirmed } = await import('@/lib/services/notifications');
          await notifyClientBookingConfirmed(
            client.userId,
            booking.instructor.name,
            booking.id,
            booking.startTime!,
            booking.instructor
          );
        } catch (notifErr) {
          console.error('In-app notification fallback also failed:', notifErr);
        }
      }
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
        bookingId: booking.id,
      })
    } catch (e) {
      console.error('Receipt email failed:', e)
      await enqueueNotification({
        channel: 'EMAIL',
        recipient: booking.client!.email,
        subject: `Receipt — Lesson on ${newStart.toLocaleDateString('en-AU', { timeZone: instructorTimezone })}`,
        body: `<p>Hi ${booking.client!.name}, your wallet was charged $${lessonPrice.toFixed(2)} for your lesson with ${booking.instructor.name}. Log in to view your receipt.</p>`,
        idempotencyKey: `booking-receipt-email-${booking.id}`,
        bookingId: booking.id,
        userId: client.userId ?? undefined,
      })
    }

    // In-app notification (non-critical)
    try {
      const reqChannels = getNotifChannels('BOOKING_REQUEST')
      if (reqChannels.inApp && session.user.id) {
        await notifyBookingRequest(session.user.id, client.name, booking.id, newStart, instructorTimezone)
      }
    } catch (e) {
      console.error('Notification failed:', e)
    }

    return NextResponse.json({ success: true, booking }, { status: 201 })
  } catch (error: any) {
    // Handle race condition: slot already booked
    if (error?.message === 'SLOT_ALREADY_BOOKED' || error?.message === 'SLOT_TAKEN') {
      return NextResponse.json({ 
        error: 'Time slot was just taken. Please choose another time.',
        slotConflict: true 
      }, { status: 409 })
    }
    
    // Handle wallet insufficient balance
    if (error?.message === 'INSUFFICIENT_BALANCE' || error?.message === 'WALLET_INSUFFICIENT') {
      return NextResponse.json({ 
        error: 'Insufficient wallet balance', 
        insufficientBalance: true 
      }, { status: 422 })
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

    const { searchParams } = new URL(req.url)
    const sourceFilter = searchParams.get('source') // 'platform' | 'offline' | null (all)
    const fromParam    = searchParams.get('from')   // ISO date string
    const toParam      = searchParams.get('to')     // ISO date string
    const statusParam  = searchParams.get('status') // comma-separated status values
    const limitParam   = searchParams.get('limit')  // integer
    // Hard cap at 500; default to 200 so callers without ?limit get a safe result
    const limit = Math.min(500, parseInt(limitParam ?? '200', 10))

    // Status filter — comma-separated or default set
    const defaultStatuses = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']
    const statuses = statusParam
      ? statusParam.split(',').map(s => s.trim()).filter(Boolean)
      : defaultStatuses

    const bookings = await prisma.booking.findMany({
      where: {
        instructorId: session.user.instructorId,
        status: { in: statuses },
        deletedAt: null,
        ...(fromParam ? { startTime: { gte: new Date(fromParam) } } : {}),
        ...(toParam   ? { startTime: { ...(fromParam ? { gte: new Date(fromParam) } : {}), lte: new Date(toParam) } } : {}),
        ...(sourceFilter ? { source: sourceFilter } as any : {}),
      } as any,
      select: {
        id:            true,
        startTime:     true,
        endTime:       true,
        duration:      true,
        status:        true,
        clientName:    true,
        clientPhone:   true,
        pickupAddress: true,
        price:         true,
        client: {
          select: { name: true, phone: true },
        },
      },
      orderBy: { startTime: 'asc' },
      take: limit,
    })

    // Normalise: merge clientPhone from booking or client relation
    const normalised = bookings.map((b: any) => ({
      ...b,
      clientName:  b.clientName  ?? b.client?.name  ?? null,
      clientPhone: b.clientPhone ?? b.client?.phone ?? null,
      client:      undefined, // don't expose full client object
    }))

    return NextResponse.json(normalised)
  } catch (error) {
    console.error('Fetch bookings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
