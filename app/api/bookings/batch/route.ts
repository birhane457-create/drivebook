import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { emailService } from '@/lib/services/email'
import { googleCalendarService } from '@/lib/services/googleCalendar'
import { logBookingAction, AuditAction, ActorRole } from '@/lib/services/auditLogger'
import { writeAuditLog, writeAuditLogSafe } from '@/lib/services/audit'
import { getWalletBalance } from '@/lib/services/wallet-helpers'
import { bulkBookingRateLimit, checkRateLimit, getRateLimitIdentifier } from '@/lib/ratelimit'
import { getCommissionRate, getPlatformFeeRate } from '@/lib/services/platform-pricing'
import { checkSubscriptionAccess } from '@/lib/middleware/subscriptionValidation'
import { DEFAULT_TIMEZONE, resolveTimezone, timezoneFromState } from '@/lib/utils/timezone'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const MAX_DURATION_MINUTES = 480
// Process batch bookings sequentially to avoid intra-batch slot conflicts.
// Parallel batch processing can allow overlapping bookings within the same
// request if each transaction only checks the DB and not the other pending
// bookings in the batch.
const BATCH_CONCURRENCY = 1

const latitudeSchema = z
  .number()
  .min(-90, 'Latitude must be between -90 and 90')
  .max(90, 'Latitude must be between -90 and 90')
const longitudeSchema = z
  .number()
  .min(-180, 'Longitude must be between -180 and 180')
  .max(180, 'Longitude must be between -180 and 180')

const bookingItemSchema = z
  .object({
    customerId: z.string().min(1),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    bookingType: z.enum(['LESSON', 'PDA_TEST', 'MOCK_TEST']).optional().default('LESSON'),
    pickupAddress: z.string().optional(),
    pickupLatitude: latitudeSchema.optional(),
    pickupLongitude: longitudeSchema.optional(),
    dropoffAddress: z.string().optional(),
    notes: z.string().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const start = new Date(data.startTime)
    const end = new Date(data.endTime)
    if (end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End time must be after start time',
        path: ['endTime'],
      })
      return
    }
    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60)
    if (durationMinutes < 30) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Duration must be at least 30 minutes',
        path: ['endTime'],
      })
    }
    if (durationMinutes > MAX_DURATION_MINUTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Duration cannot exceed 8 hours',
        path: ['endTime'],
      })
    }
  })

const batchBookingSchema = z
  .object({
    bookings: z.array(bookingItemSchema).min(1).max(50),
  })
  .strict()

type BatchBookingItem = z.infer<typeof bookingItemSchema>

type ClientWithUser = {
  id: string
  name: string
  email: string
  phone: string | null
  userId: string | null
  defaultPickupAddress: string | null
  defaultPickupLat: number | null
  defaultPickupLng: number | null
  user: {
    resetToken: string | null
    resetTokenExpiry: Date | null
  } | null
}

type InstructorContext = {
  id: string
  name: string
  approvalStatus: string
  subscriptionStatus: string
  subscriptionTier: string | null
  syncGoogleCalendar: boolean
  hourlyRate: number
}

type BatchSuccess = {
  index: number
  id: string
  customerId: string
  status: 'CONFIRMED' | 'PENDING_PAYMENT'
  price: number
  message: string
}

type BatchFailure = {
  index: number
  customerId: string
  error: string
  status: number
}

function slotOverlapWhere(
  providerId: string,
  startTime: Date,
  endTime: Date
): Prisma.BookingWhereInput {
  return {
    providerId,
    status: { in: ['PENDING', 'PENDING_PAYMENT', 'CONFIRMED'] },
    OR: [
      { AND: [{ startTime: { gte: startTime } }, { startTime: { lt: endTime } }] },
      { AND: [{ endTime: { gt: startTime } }, { endTime: { lte: endTime } }] },
      { AND: [{ startTime: { lte: startTime } }, { endTime: { gte: endTime } }] },
    ],
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (true) {
      const i = nextIndex++
      if (i >= items.length) break
      results[i] = await fn(items[i], i)
    }
  }

  const workers = Math.min(limit, items.length)
  await Promise.all(Array.from({ length: workers }, () => worker()))
  return results
}

/**
 * POST /api/bookings/batch
 *
 * Create multiple bookings in a single request.
 * - Validates each booking individually (strict Zod schema)
 * - Attempts to create all bookings with proper payment logic
 * - Returns success/failure breakdown
 * - Does NOT rollback on partial failure (each booking is independent)
 * - Applies same payment rules as single bookings:
 *   - If wallet sufficient: CONFIRMED + wallet deducted
 *   - If wallet insufficient: PENDING_PAYMENT + top-up email sent
 *
 * Rate limited: 5 bulk requests per minute per instructor
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.providerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const providerId = session!.user!.providerId

    const rateLimitId = getRateLimitIdentifier(
      providerId,
      req.headers.get('x-forwarded-for'),
      'bulk-booking'
    )
    const rateLimitResult = await checkRateLimit(bulkBookingRateLimit, rateLimitId)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const instructor = await prisma.provider.findUnique({
      where: { id: providerId },
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
        user: { select: { email: true } },
      },
    })

    const instructorTimezone = instructor?.timezone
      ? resolveTimezone(instructor.timezone)
      : timezoneFromState(instructor?.state)

    // Issue 3 fix: check both approvalStatus and isActive
    if (!instructor || instructor.approvalStatus !== 'APPROVED' || instructor.isActive === false) {
      return NextResponse.json(
        {
          error: 'Your account is pending approval',
          requiresApproval: true,
        },
        { status: 403 }
      )
    }

    // Issue 2 fix: use checkSubscriptionAccess() to enforce trial expiry + read-only
    // parity with the single booking route (which calls requireActiveSubscription)
    const subAccess = await checkSubscriptionAccess(session!.user!.id)
    if (!subAccess.valid || (subAccess as any).readOnly) {
      return NextResponse.json(
        {
          error: 'Active subscription required to create bookings',
          requiresSubscription: true,
        },
        { status: 403 }
      )
    }

    const body = await req.json()
    const parseResult = batchBookingSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    const data = parseResult.data

    const now = new Date()
    const uniqueClientIds = [...new Set(data.bookings.map((b: any) => b.customerId))]
    const clients = await prisma.customer.findMany({
      where: { id: { in: uniqueClientIds } },
      include: { user: true },
    })
    const clientMap = new Map<string, ClientWithUser>(
      clients.map((c: any) => [c.id, c as unknown as ClientWithUser])
    )

    const commissionRatePct = await getCommissionRate(instructor.subscriptionTier ?? 'BASIC')
    const commissionRate = commissionRatePct / 100

    // MEDIUM-10 FIX: Get platform fee rate from DB instead of hardcoding
    const platformFeeRate = await getPlatformFeeRate()

    const outcomes = await mapWithConcurrency(
      data.bookings,
      BATCH_CONCURRENCY,
      async (bookingData, index) =>
        processBooking({
          bookingData,
          index,
          instructor: instructor as InstructorContext,
          providerId,
          instructorTimezone,
          clientMap,
          commissionRate,
          platformFeeRate,
          now,
        })
    )

    const successful: BatchSuccess[] = []
    const failed: BatchFailure[] = []
    for (const outcome of outcomes) {
      if (outcome.ok) successful.push(outcome.value)
      else failed.push(outcome.error)
    }

    try {
      await emailService.sendGenericEmail({
        from: 'DriveBook Bookings <bookings@drivebook.com.au>',
        to: session!.user!.email || 'noreply@drivebook.com',
        subject: `? Batch Booking Summary: ${successful.length}/${data.bookings.length} created`,
        html: `
          <h2>Batch Booking Complete</h2>
          <p>Successfully created <strong>${successful.length} booking(s)</strong> out of ${data.bookings.length} requested.</p>
          ${failed.length > 0 ? `<p><strong>${failed.length} booking(s)</strong> failed due to validation errors.</p>` : ''}
          <div style="margin-top:20px;font-size:14px;color:#6b7280;">
            <p><strong>Successful:</strong> ${successful.length} (${successful.map((s: any) => s.status).join(', ')})</p>
            <p><strong>Failed:</strong> ${failed.length}</p>
          </div>
        `,
      })
    } catch (err) {
      console.error('Batch summary email error:', err)
    }

    return NextResponse.json({
      successful,
      failed,
      summary: {
        total: data.bookings.length,
        created: successful.length,
        failed: failed.length,
      },
    })
  } catch (error: unknown) {
    console.error('Batch booking error:', error)
    const message = error instanceof Error ? error.message : 'Batch booking failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

type ProcessBookingArgs = {
  bookingData: BatchBookingItem
  index: number
  instructor: InstructorContext
  providerId: string
  instructorTimezone: string
  clientMap: Map<string, ClientWithUser>
  commissionRate: number
  platformFeeRate: number
  now: Date
}

type ProcessOutcome =
  | { ok: true; value: BatchSuccess }
  | { ok: false; error: BatchFailure }

async function processBooking(args: ProcessBookingArgs): Promise<ProcessOutcome> {
  const { bookingData, index, instructor, providerId, clientMap, commissionRate, platformFeeRate, now, instructorTimezone } = args

  try {
    const startTime = new Date(bookingData.startTime)
    const endTime = new Date(bookingData.endTime)

    if (startTime < now) {
      return fail(index, bookingData.customerId, 'Cannot create bookings in the past', 400)
    }

    const customer = clientMap.get(bookingData.customerId)
    if (!customer) {
      return fail(index, bookingData.customerId, 'Client not found or does not belong to your clients', 404)
    }

    if (!customer.userId) {
      return fail(index, bookingData.customerId, 'Client account not set up', 422)
    }

    const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
    const lessonPrice = parseFloat((instructor.hourlyRate * durationHours).toFixed(2))
    const platformFee = parseFloat((lessonPrice * (platformFeeRate / 100)).toFixed(2))
    const providerPayout = parseFloat((lessonPrice * (1 - commissionRate)).toFixed(2))
    const pickupLocation = bookingData.pickupAddress || customer.defaultPickupAddress || null

    const { balance } = await getWalletBalance(customer.userId)

    if (balance < lessonPrice) {
      return createPendingBooking({
        bookingData,
        index,
        instructor,
        providerId,
        instructorTimezone,
        customer,
        startTime,
        endTime,
        durationHours,
        lessonPrice,
        platformFee,
        providerPayout,
        commissionRate,
        pickupLocation,
        balance,
        now,
      })
    }

    return createConfirmedBooking({
      bookingData,
      index,
      instructor,
      providerId,
      instructorTimezone,
      customer,
      startTime,
      endTime,
      durationHours,
      lessonPrice,
      platformFee,
      providerPayout,
      commissionRate,
      pickupLocation,
      now,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return fail(index, bookingData.customerId, message, 500)
  }
}

function fail(
  index: number,
  customerId: string,
  error: string,
  status: number
): ProcessOutcome {
  return { ok: false, error: { index, customerId, error, status } }
}

async function createPendingBooking(ctx: {
  bookingData: BatchBookingItem
  index: number
  instructor: InstructorContext
  providerId: string
  instructorTimezone: string
  customer: ClientWithUser
  startTime: Date
  endTime: Date
  durationHours: number
  lessonPrice: number
  platformFee: number
  providerPayout: number
  commissionRate: number
  pickupLocation: string | null
  balance: number
  now: Date
}): Promise<ProcessOutcome> {
  const {
    bookingData,
    index,
    instructor,
    providerId,
    instructorTimezone,
    customer,
    startTime,
    endTime,
    durationHours,
    lessonPrice,
    platformFee,
    providerPayout,
    commissionRate,
    pickupLocation,
    balance,
    now,
  } = ctx

  let pendingBooking
  try {
    pendingBooking = await prisma.$transaction(async (tx) => {
      const slotConflict = await tx.booking.findFirst({
        where: slotOverlapWhere(providerId, startTime, endTime),
        select: { id: true },
      })
      if (slotConflict) throw new Error('SLOT_TAKEN')

      const completedCount = await tx.booking.count({
        where: { providerId, customerId: bookingData.customerId, status: 'COMPLETED' },
      })
      const isFirstBooking = completedCount === 0

      return tx.booking.create({
        data: {
          providerId,
          customerId: bookingData.customerId,
          customerName: customer.name,
          customerPhone: customer.phone,
          bookingType: bookingData.bookingType,
          startTime,
          endTime,
          duration: durationHours * 60,
          price: lessonPrice,
          platformFee,
          providerPayout,
          commissionRate,
          isFirstBooking,
          isPaid: false,
          pickupAddress: pickupLocation,
          pickupLatitude: bookingData.pickupLatitude ?? customer.defaultPickupLat,
          pickupLongitude: bookingData.pickupLongitude ?? customer.defaultPickupLng,
          dropoffAddress: bookingData.dropoffAddress,
          notes: bookingData.notes,
          status: 'PENDING_PAYMENT',
          createdBy: 'provider',
          originalStartTime: startTime,
        } as any,
      })
    })
  } catch (txError) {
    if (txError instanceof Error && txError.message === 'SLOT_TAKEN') {
      return fail(index, bookingData.customerId, 'Time slot already booked by another request', 409)
    }
    throw txError
  }

  try {
    const shortfall = parseFloat((lessonPrice - balance).toFixed(2))
    // topUpAmount = shortfall + the proportional platform fee on the shortfall
    // feeRate = platformFee / lessonPrice (already computed server-side)
    const feeRate = lessonPrice > 0 ? platformFee / lessonPrice : 0
    const topUpAmount = parseFloat((shortfall / (1 - feeRate)).toFixed(2))
    const dateStr = startTime.toLocaleDateString('en-AU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: instructorTimezone,
    })
    const timeStr = startTime.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: instructorTimezone })

    // Always generate a fresh setup token ï¿½ works for new accounts and old ones whose token expired
    const { randomUUID } = await import('crypto')
    const freshToken = randomUUID()
    const freshExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await prisma.user.update({
      where: { id: customer.userId! },
      data: { resetToken: freshToken, resetTokenExpiry: freshExpiry },
    })
    const actionUrl = `${process.env.NEXTAUTH_URL}/set-password?token=${freshToken}`
    const actionLabel = 'Set up your account & Top Up ?'

    await emailService.sendGenericEmail({
      from: 'DriveBook Bookings <bookings@drivebook.com.au>',
      to: customer.email,
      subject: `?? ${instructor.name} booked a lesson ï¿½ top up to confirm`,
      html: `
        <h2>Lesson Booked for You</h2>
        <p>Hi ${customer.name},</p>
        <p><strong>${instructor.name}</strong> has booked a driving lesson for you.</p>
        <div style="background:#f3f4f6;padding:20px;margin:20px 0;border-radius:8px;">
          <p><strong>Date:</strong> ${dateStr}</p>
          <p><strong>Time:</strong> ${timeStr}</p>
          <p><strong>Cost:</strong> $${lessonPrice.toFixed(2)}</p>
        </div>
        <p>You need <strong>$${topUpAmount.toFixed(2)}</strong> in your DriveBook wallet to confirm this booking.</p>
        <p><a href="${actionUrl}" style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">${actionLabel}</a></p>
      `,
    })
  } catch (e) {
    console.error('Top-up email failed:', e)
  }

  // AUDIT-01/02 fix (Tier 4): pending-payment — not yet financial, wallet not debited.
  await writeAuditLogSafe({
    action:     'BOOKING_CREATED',
    actorId:    providerId,
    actorRole:  'provider',
    targetType: 'BOOKING',
    targetId:   pendingBooking.id,
    metadata:   { customerId: bookingData.customerId, price: pendingBooking.price, pendingPayment: true },
  })

  return {
    ok: true,
    value: {
      index,
      id: pendingBooking.id,
      customerId: bookingData.customerId,
      status: 'PENDING_PAYMENT',
      price: lessonPrice,
      message: 'Pending payment ï¿½ top-up email sent',
    },
  }
}

async function createConfirmedBooking(ctx: {
  bookingData: BatchBookingItem
  index: number
  instructor: InstructorContext
  providerId: string
  instructorTimezone: string
  customer: ClientWithUser
  startTime: Date
  endTime: Date
  durationHours: number
  lessonPrice: number
  platformFee: number
  providerPayout: number
  commissionRate: number
  pickupLocation: string | null
  now: Date
}): Promise<ProcessOutcome> {
  const {
    bookingData,
    index,
    instructor,
    providerId,
    instructorTimezone,
    customer,
    startTime,
    endTime,
    durationHours,
    lessonPrice,
    platformFee,
    providerPayout,
    commissionRate,
    pickupLocation,
    now,
  } = ctx

  let booking
  let isFirstBooking = false

  try {
    booking = await prisma.$transaction(async (tx) => {
      const slotConflict = await tx.booking.findFirst({
        where: slotOverlapWhere(providerId, startTime, endTime),
        select: { id: true },
      })
      if (slotConflict) throw new Error('SLOT_TAKEN')

      const completedCount = await tx.booking.count({
        where: { providerId, customerId: bookingData.customerId, status: 'COMPLETED' },
      })
      isFirstBooking = completedCount === 0

      const wallet = await tx.clientWallet.findUnique({ where: { userId: customer.userId! } })
      if (!wallet) throw new Error('Wallet not found')

      const txns = await tx.walletTransaction.findMany({
        where: { walletId: wallet.id, status: 'CONFIRMED' },
      })
      const txBalance = txns.reduce(
        (sum, t) => (t.type === 'CREDIT' ? sum + Number(t.amount) : sum - Number(t.amount)),
        0
      )
      if (txBalance < lessonPrice) throw new Error('INSUFFICIENT_BALANCE')

      await tx.clientWallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: lessonPrice } },
      })
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'DEBIT',
          amount: lessonPrice,
          description: `Lesson booking ï¿½ ${startTime.toLocaleDateString('en-AU', { timeZone: instructorTimezone })} ${startTime.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: instructorTimezone })}`,
          status: 'CONFIRMED',
        },
      })

      const newBooking = await tx.booking.create({
        data: {
          providerId,
          customerId: bookingData.customerId,
          customerName: customer.name,
          customerPhone: customer.phone,
          bookingType: bookingData.bookingType,
          startTime,
          endTime,
          duration: durationHours * 60,
          price: lessonPrice,
          platformFee,
          providerPayout,
          commissionRate,
          isFirstBooking,
          isPaid: true,
          paidAt: now,
          pickupAddress: pickupLocation,
          pickupLatitude: bookingData.pickupLatitude ?? customer.defaultPickupLat,
          pickupLongitude: bookingData.pickupLongitude ?? customer.defaultPickupLng,
          dropoffAddress: bookingData.dropoffAddress,
          notes: bookingData.notes,
          status: 'CONFIRMED',
          createdBy: 'provider',
          originalStartTime: startTime,
        } as any,
      })

      await (tx as any).transaction.create({
        data: {
          bookingId: newBooking.id,
          providerId,
          type: 'BOOKING_PAYMENT',
          amount: lessonPrice,
          platformFee,
          providerPayout,
          commissionRate,
          status: 'COMPLETED',
          description: `Booking payment — ${isFirstBooking ? 'First booking with client' : 'Repeat booking'}`,
          metadata: { isFirstBooking },
        },
      })

      // AUDIT-01/02 fix (Tier 1): audit written atomically with financial state change.
      await (tx as any).auditLog.create({
        data: {
          action:     'BOOKING_CREATED',
          actorId:    providerId,
          actorRole:  'provider',
          targetType: 'BOOKING',
          targetId:   newBooking.id,
          metadata:   { customerId: bookingData.customerId, price: lessonPrice, durationHours, isPaid: true },
          success:    true,
        },
      })

      return newBooking
    })
  } catch (txError) {
    if (txError instanceof Error && txError.message === 'SLOT_TAKEN') {
      return fail(index, bookingData.customerId, 'Time slot already booked by another request', 409)
    }
    if (txError instanceof Error && txError.message === 'INSUFFICIENT_BALANCE') {
      return fail(index, bookingData.customerId, 'Insufficient wallet balance', 400)
    }
    throw txError
  }

  // Audit is now written atomically inside the $transaction above (AUDIT-01/02 fix).

  // FinancialLedger ï¿½ deterministic idempotency key per booking
  try {
    const { recordBookingPayment } = await import('@/lib/services/ledger-operations')
    if (booking.isPaid && customer?.userId) {
      await recordBookingPayment({
        bookingId: booking.id,
        userId: customer.userId,
        providerId,
        totalAmount: booking.price,
        platformFee: booking.platformFee ?? 0,
        providerPayout: booking.providerPayout ?? 0,
        createdBy: providerId,
      })
    }
  } catch (ledgerErr: any) {
    if (!ledgerErr?.message?.includes('idempotency')) {
      console.error('[Ledger] batch booking payment failed (non-critical):', ledgerErr?.message)
    }
  }

  try {
    if (instructor.syncGoogleCalendar) {
      const result = await googleCalendarService.createCalendarEvent(providerId, {
        id: booking.id,
        startTime,
        endTime,
        customerName: customer.name,
        customerPhone: customer.phone ?? '',
        pickupAddress: bookingData.pickupAddress,
        notes: bookingData.notes,
      })
      if (result.success && result.eventId) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { googleCalendarEventId: result.eventId } as any,
        })
      }
    }
  } catch (e) {
    console.error('Calendar sync failed:', e)
  }

  try {
    await emailService.sendGenericEmail({
      from: 'DriveBook Bookings <bookings@drivebook.com.au>',
      to: customer.email,
      subject: `? Lesson Confirmed ï¿½ ${startTime.toLocaleDateString('en-AU', { month: 'long', day: 'numeric', timeZone: instructorTimezone })}`,
      html: `
        <h2>Lesson Confirmed</h2>
        <p>Hi ${customer.name},</p>
        <p>Your lesson with <strong>${instructor.name}</strong> has been confirmed and paid.</p>
        <div style="background:#f3f4f6;padding:20px;margin:20px 0;border-radius:8px;">
          <p><strong>Date:</strong> ${startTime.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: instructorTimezone })}</p>
          <p><strong>Time:</strong> ${startTime.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: instructorTimezone })}</p>
          <p><strong>Cost:</strong> $${lessonPrice.toFixed(2)}</p>
        </div>
      `,
    })
  } catch (e) {
    console.error('Confirmation email failed:', e)
  }

  return {
    ok: true,
    value: {
      index,
      id: booking.id,
      customerId: bookingData.customerId,
      status: 'CONFIRMED',
      price: lessonPrice,
      message: 'Confirmed and paid',
    },
  }
}
