import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { emailService } from '@/lib/services/email'
import { googleCalendarService } from '@/lib/services/googleCalendar'
import { logBookingAction, AuditAction, ActorRole } from '@/lib/services/auditLogger'
import { getWalletBalance } from '@/lib/services/wallet-helpers'
import { bulkBookingRateLimit, checkRateLimit, getRateLimitIdentifier } from '@/lib/ratelimit'
import { getCommissionRate } from '@/lib/services/platform-pricing'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const PLATFORM_FEE_RATE = 0.036
const MAX_DURATION_MINUTES = 480
const BATCH_CONCURRENCY = 4

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
    clientId: z.string().min(1),
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
  clientId: string
  status: 'CONFIRMED' | 'PENDING_PAYMENT'
  price: number
  message: string
}

type BatchFailure = {
  index: number
  clientId: string
  error: string
  status: number
}

function slotOverlapWhere(
  instructorId: string,
  startTime: Date,
  endTime: Date
): Prisma.BookingWhereInput {
  return {
    instructorId,
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
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const instructorId = session.user.instructorId

    const rateLimitId = getRateLimitIdentifier(
      instructorId,
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

    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
      select: {
        id: true,
        name: true,
        approvalStatus: true,
        subscriptionStatus: true,
        subscriptionTier: true,
        syncGoogleCalendar: true,
        hourlyRate: true,
        user: { select: { email: true } },
      },
    })

    if (!instructor || instructor.approvalStatus !== 'APPROVED') {
      return NextResponse.json(
        {
          error: 'Your account is pending approval',
          requiresApproval: true,
        },
        { status: 403 }
      )
    }

    if (instructor.subscriptionStatus !== 'ACTIVE') {
      return NextResponse.json(
        {
          error: 'Active subscription required',
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
    const uniqueClientIds = [...new Set(data.bookings.map((b) => b.clientId))]
    const clients = await prisma.client.findMany({
      where: { id: { in: uniqueClientIds }, instructorId },
      include: { user: true },
    })
    const clientMap = new Map<string, ClientWithUser>(
      clients.map((c) => [c.id, c as ClientWithUser])
    )

    const commissionRatePct = await getCommissionRate(instructor.subscriptionTier ?? 'BASIC')
    const commissionRate = commissionRatePct / 100

    const outcomes = await mapWithConcurrency(
      data.bookings,
      BATCH_CONCURRENCY,
      async (bookingData, index) =>
        processBooking({
          bookingData,
          index,
          instructor: instructor as InstructorContext,
          instructorId,
          clientMap,
          commissionRate,
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
        to: session.user.email || 'noreply@drivebook.com',
        subject: `✅ Batch Booking Summary: ${successful.length}/${data.bookings.length} created`,
        html: `
          <h2>Batch Booking Complete</h2>
          <p>Successfully created <strong>${successful.length} booking(s)</strong> out of ${data.bookings.length} requested.</p>
          ${failed.length > 0 ? `<p><strong>${failed.length} booking(s)</strong> failed due to validation errors.</p>` : ''}
          <div style="margin-top:20px;font-size:14px;color:#6b7280;">
            <p><strong>Successful:</strong> ${successful.length} (${successful.map((s) => s.status).join(', ')})</p>
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
  instructorId: string
  clientMap: Map<string, ClientWithUser>
  commissionRate: number
  now: Date
}

type ProcessOutcome =
  | { ok: true; value: BatchSuccess }
  | { ok: false; error: BatchFailure }

async function processBooking(args: ProcessBookingArgs): Promise<ProcessOutcome> {
  const { bookingData, index, instructor, instructorId, clientMap, commissionRate, now } = args

  try {
    const startTime = new Date(bookingData.startTime)
    const endTime = new Date(bookingData.endTime)

    if (startTime < now) {
      return fail(index, bookingData.clientId, 'Cannot create bookings in the past', 400)
    }

    const client = clientMap.get(bookingData.clientId)
    if (!client) {
      return fail(index, bookingData.clientId, 'Client not found or does not belong to your clients', 404)
    }

    if (!client.userId) {
      return fail(index, bookingData.clientId, 'Client account not set up', 422)
    }

    const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
    const lessonPrice = parseFloat((instructor.hourlyRate * durationHours).toFixed(2))
    const platformFee = parseFloat((lessonPrice * PLATFORM_FEE_RATE).toFixed(2))
    const instructorPayout = parseFloat((lessonPrice * (1 - commissionRate)).toFixed(2))
    const pickupLocation = bookingData.pickupAddress || client.defaultPickupAddress || null

    const { balance } = await getWalletBalance(client.userId)

    if (balance < lessonPrice) {
      return createPendingBooking({
        bookingData,
        index,
        instructor,
        instructorId,
        client,
        startTime,
        endTime,
        durationHours,
        lessonPrice,
        platformFee,
        instructorPayout,
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
      instructorId,
      client,
      startTime,
      endTime,
      durationHours,
      lessonPrice,
      platformFee,
      instructorPayout,
      commissionRate,
      pickupLocation,
      now,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return fail(index, bookingData.clientId, message, 500)
  }
}

function fail(
  index: number,
  clientId: string,
  error: string,
  status: number
): ProcessOutcome {
  return { ok: false, error: { index, clientId, error, status } }
}

async function createPendingBooking(ctx: {
  bookingData: BatchBookingItem
  index: number
  instructor: InstructorContext
  instructorId: string
  client: ClientWithUser
  startTime: Date
  endTime: Date
  durationHours: number
  lessonPrice: number
  platformFee: number
  instructorPayout: number
  commissionRate: number
  pickupLocation: string | null
  balance: number
  now: Date
}): Promise<ProcessOutcome> {
  const {
    bookingData,
    index,
    instructor,
    instructorId,
    client,
    startTime,
    endTime,
    durationHours,
    lessonPrice,
    platformFee,
    instructorPayout,
    commissionRate,
    pickupLocation,
    balance,
    now,
  } = ctx

  let pendingBooking
  try {
    pendingBooking = await prisma.$transaction(async (tx) => {
      const slotConflict = await tx.booking.findFirst({
        where: slotOverlapWhere(instructorId, startTime, endTime),
        select: { id: true },
      })
      if (slotConflict) throw new Error('SLOT_TAKEN')

      const completedCount = await tx.booking.count({
        where: { instructorId, clientId: bookingData.clientId, status: 'COMPLETED' },
      })
      const isFirstBooking = completedCount === 0

      return tx.booking.create({
        data: {
          instructorId,
          clientId: bookingData.clientId,
          clientName: client.name,
          clientPhone: client.phone,
          bookingType: bookingData.bookingType,
          startTime,
          endTime,
          duration: durationHours * 60,
          price: lessonPrice,
          platformFee,
          instructorPayout,
          commissionRate,
          isFirstBooking,
          isPaid: false,
          pickupAddress: pickupLocation,
          pickupLatitude: bookingData.pickupLatitude ?? client.defaultPickupLat,
          pickupLongitude: bookingData.pickupLongitude ?? client.defaultPickupLng,
          dropoffAddress: bookingData.dropoffAddress,
          notes: bookingData.notes,
          status: 'PENDING_PAYMENT',
          createdBy: 'instructor',
          originalStartTime: startTime,
        } as any,
      })
    })
  } catch (txError) {
    if (txError instanceof Error && txError.message === 'SLOT_TAKEN') {
      return fail(index, bookingData.clientId, 'Time slot already booked by another request', 409)
    }
    throw txError
  }

  try {
    const shortfall = parseFloat((lessonPrice - balance).toFixed(2))
    const topUpAmount = parseFloat((shortfall / (1 - PLATFORM_FEE_RATE)).toFixed(2))
    const dateStr = startTime.toLocaleDateString('en-AU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    const timeStr = startTime.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })

    const isNewAccount = !!(
      client.user?.resetToken &&
      client.user.resetTokenExpiry &&
      client.user.resetTokenExpiry > now
    )
    const actionUrl = isNewAccount
      ? `${process.env.NEXTAUTH_URL}/reset-password?token=${client.user!.resetToken}`
      : `${process.env.NEXTAUTH_URL}/login`
    const actionLabel = isNewAccount ? 'Set Password & Top Up →' : 'Log In & Top Up →'

    await emailService.sendGenericEmail({
      to: client.email,
      subject: `📅 ${instructor.name} booked a lesson — top up to confirm`,
      html: `
        <h2>Lesson Booked for You</h2>
        <p>Hi ${client.name},</p>
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

  try {
    await logBookingAction({
      bookingId: pendingBooking.id,
      action: AuditAction.BOOKING_CREATED,
      actorId: instructorId,
      actorRole: ActorRole.INSTRUCTOR,
      metadata: { clientId: bookingData.clientId, price: pendingBooking.price, pendingPayment: true },
    })
  } catch {
    /* non-critical */
  }

  return {
    ok: true,
    value: {
      index,
      id: pendingBooking.id,
      clientId: bookingData.clientId,
      status: 'PENDING_PAYMENT',
      price: lessonPrice,
      message: 'Pending payment — top-up email sent',
    },
  }
}

async function createConfirmedBooking(ctx: {
  bookingData: BatchBookingItem
  index: number
  instructor: InstructorContext
  instructorId: string
  client: ClientWithUser
  startTime: Date
  endTime: Date
  durationHours: number
  lessonPrice: number
  platformFee: number
  instructorPayout: number
  commissionRate: number
  pickupLocation: string | null
  now: Date
}): Promise<ProcessOutcome> {
  const {
    bookingData,
    index,
    instructor,
    instructorId,
    client,
    startTime,
    endTime,
    durationHours,
    lessonPrice,
    platformFee,
    instructorPayout,
    commissionRate,
    pickupLocation,
    now,
  } = ctx

  let booking
  let isFirstBooking = false

  try {
    booking = await prisma.$transaction(async (tx) => {
      const slotConflict = await tx.booking.findFirst({
        where: slotOverlapWhere(instructorId, startTime, endTime),
        select: { id: true },
      })
      if (slotConflict) throw new Error('SLOT_TAKEN')

      const completedCount = await tx.booking.count({
        where: { instructorId, clientId: bookingData.clientId, status: 'COMPLETED' },
      })
      isFirstBooking = completedCount === 0

      const wallet = await tx.clientWallet.findUnique({ where: { userId: client.userId! } })
      if (!wallet) throw new Error('Wallet not found')

      const txns = await tx.walletTransaction.findMany({
        where: { walletId: wallet.id, status: 'CONFIRMED' },
      })
      const txBalance = txns.reduce(
        (sum, t) => (t.type === 'CREDIT' ? sum + t.amount : sum - t.amount),
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
          description: `Lesson booking — ${startTime.toLocaleDateString('en-AU')} ${startTime.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}`,
          status: 'CONFIRMED',
        },
      })

      const newBooking = await tx.booking.create({
        data: {
          instructorId,
          clientId: bookingData.clientId,
          clientName: client.name,
          clientPhone: client.phone,
          bookingType: bookingData.bookingType,
          startTime,
          endTime,
          duration: durationHours * 60,
          price: lessonPrice,
          platformFee,
          instructorPayout,
          commissionRate,
          isFirstBooking,
          isPaid: true,
          paidAt: now,
          pickupAddress: pickupLocation,
          pickupLatitude: bookingData.pickupLatitude ?? client.defaultPickupLat,
          pickupLongitude: bookingData.pickupLongitude ?? client.defaultPickupLng,
          dropoffAddress: bookingData.dropoffAddress,
          notes: bookingData.notes,
          status: 'CONFIRMED',
          createdBy: 'instructor',
          originalStartTime: startTime,
        } as any,
      })

      await (tx as any).transaction.create({
        data: {
          bookingId: newBooking.id,
          instructorId,
          type: 'BOOKING_PAYMENT',
          amount: lessonPrice,
          platformFee,
          instructorPayout,
          commissionRate,
          status: 'COMPLETED',
          description: `Booking payment — ${isFirstBooking ? 'First booking with client' : 'Repeat booking'}`,
          metadata: { isFirstBooking },
        },
      })

      return newBooking
    })
  } catch (txError) {
    if (txError instanceof Error && txError.message === 'SLOT_TAKEN') {
      return fail(index, bookingData.clientId, 'Time slot already booked by another request', 409)
    }
    if (txError instanceof Error && txError.message === 'INSUFFICIENT_BALANCE') {
      return fail(index, bookingData.clientId, 'Insufficient wallet balance', 400)
    }
    throw txError
  }

  try {
    await logBookingAction({
      bookingId: booking.id,
      action: AuditAction.BOOKING_CREATED,
      actorId: instructorId,
      actorRole: ActorRole.INSTRUCTOR,
      metadata: { clientId: bookingData.clientId, price: booking.price, durationHours },
    })
  } catch (auditErr) {
    console.error('Audit log failed:', auditErr)
  }

  try {
    if (instructor.syncGoogleCalendar) {
      const result = await googleCalendarService.createCalendarEvent(instructorId, {
        id: booking.id,
        startTime,
        endTime,
        clientName: client.name,
        clientPhone: client.phone ?? '',
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
      to: client.email,
      subject: `✅ Lesson Confirmed — ${startTime.toLocaleDateString('en-AU', { month: 'long', day: 'numeric' })}`,
      html: `
        <h2>Lesson Confirmed</h2>
        <p>Hi ${client.name},</p>
        <p>Your lesson with <strong>${instructor.name}</strong> has been confirmed and paid.</p>
        <div style="background:#f3f4f6;padding:20px;margin:20px 0;border-radius:8px;">
          <p><strong>Date:</strong> ${startTime.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <p><strong>Time:</strong> ${startTime.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</p>
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
      clientId: bookingData.clientId,
      status: 'CONFIRMED',
      price: lessonPrice,
      message: 'Confirmed and paid',
    },
  }
}
