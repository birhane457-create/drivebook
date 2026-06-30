import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const combinedBookingSchema = z.object({
  clientId: z.string().min(1, 'Client ID required'),
  instructorId: z.string().min(1, 'Instructor ID required'),
  
  // Lesson booking
  lesson: z.object({
    startTime: z.string().datetime('Invalid start time'),
    duration: z.number().min(30).max(480),
    pickupAddress: z.string().optional(),
    pickupLatitude: z.number().optional(),
    pickupLongitude: z.number().optional(),
    notes: z.string().optional()
  }).optional(),
  
  // PDA test booking
  pdaTest: z.object({
    configId: z.string().min(1, 'PDA config required'),
    testCentreId: z.string().min(1, 'Test centre required'),
    testDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    testTime: z.string().regex(/^([0-1]?\d|2[0-3]):[0-5]\d$/)
  }).optional()
}).refine(
  data => data.lesson || data.pdaTest,
  { message: 'At least one of lesson or PDA test must be provided' }
)

/**
 * POST /api/bookings/combined
 * 
 * Create a combined booking (lesson + PDA test together).
 * Both are optional but at least one must be provided.
 * 
 * Request body:
 * {
 *   clientId: string
 *   instructorId: string
 *   lesson?: {
 *     startTime: ISO datetime
 *     duration: minutes
 *     pickupAddress?: string
 *     pickupLatitude?: number
 *     pickupLongitude?: number
 *     notes?: string
 *   }
 *   pdaTest?: {
 *     configId: string
 *     testCentreId: string
 *     testDate: YYYY-MM-DD
 *     testTime: HH:mm
 *   }
 * }
 * 
 * Response:
 * {
 *   success: true
 *   bookings: {
 *     lesson?: { id, startTime, duration, price, ... }
 *     pdaTest?: { id, testDate, testTime, price, ... }
 *   }
 *   totals: {
 *     subtotal: number
 *     discount: number
 *     total: number
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const data = combinedBookingSchema.parse(body)

    // Verify user and client
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const client = await prisma.client.findFirst({
      where: { id: data.clientId, userId: user.id }
    })

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found or does not belong to you' },
        { status: 404 }
      )
    }

    // Verify instructor exists and is approved with active subscription
    const instructor = await prisma.instructor.findUnique({
      where: { id: data.instructorId },
      select: {
        hourlyRate: true,
        approvalStatus: true,
        subscriptionStatus: true,
        isActive: true,
        acceptingBookings: true,
        trialEndsAt: true,
      }
    })

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 })
    }

    if (!instructor.isActive) {
      return NextResponse.json({ error: 'Instructor account is not active' }, { status: 403 })
    }

    if (instructor.approvalStatus !== 'APPROVED') {
      return NextResponse.json({ error: 'Instructor is not yet approved' }, { status: 403 })
    }

    const trialExpires = instructor.trialEndsAt ? new Date(instructor.trialEndsAt) : null
    const trialActive = trialExpires ? trialExpires > new Date() : false
    const subscriptionActive = instructor.subscriptionStatus === 'ACTIVE' || (instructor.subscriptionStatus === 'TRIAL' && trialActive)

    if (!subscriptionActive) {
      return NextResponse.json({ error: 'Instructor subscription is not active' }, { status: 403 })
    }

    if (instructor.acceptingBookings === false) {
      return NextResponse.json({ error: 'Instructor is not currently accepting bookings' }, { status: 403 })
    }

    const bookings: any = {}
    let subtotal = 0
    let totalDiscount = 0

    // ── All booking creation is atomic — prevents TOCTOU races ───────────────
    await prisma.$transaction(async (tx) => {

    // Create lesson booking if provided
    if (data.lesson) {
      const startTime = new Date(data.lesson.startTime)
      const endTime = new Date(startTime.getTime() + data.lesson.duration * 60 * 1000)

      // Slot conflict check inside transaction (atomic)
      const lessonConflict = await tx.booking.findFirst({
        where: {
          instructorId: data.instructorId,
          status: { in: ['PENDING', 'PENDING_PAYMENT', 'CONFIRMED'] },
          OR: [
            { AND: [{ startTime: { gte: startTime } }, { startTime: { lt: endTime } }] },
            { AND: [{ endTime:   { gt: startTime } }, { endTime:   { lte: endTime } }] },
            { AND: [{ startTime: { lte: startTime } }, { endTime:  { gte: endTime } }] },
          ],
        },
        select: { id: true }
      })
      if (lessonConflict) throw new Error('LESSON_SLOT_CONFLICT')

      const lessonPrice = (instructor.hourlyRate || 0) * (data.lesson.duration / 60)

      const lessonBooking = await tx.booking.create({
        data: {
          instructorId: data.instructorId,
          clientId: data.clientId,
          clientName: client.name || 'Unknown',
          clientPhone: client.phone || '',
          clientEmail: user.email,
          startTime,
          endTime,
          duration: data.lesson.duration,
          price: lessonPrice,
          pickupAddress: data.lesson.pickupAddress,
          pickupLatitude: data.lesson.pickupLatitude,
          pickupLongitude: data.lesson.pickupLongitude,
          notes: data.lesson.notes,
          status: 'PENDING',
          bookingType: 'LESSON',
          source: 'platform',
          platformFee: 0,
          instructorPayout: lessonPrice,
          commissionRate: 0,
        }
      })

      bookings.lesson = {
        id: lessonBooking.id,
        startTime: lessonBooking.startTime,
        duration: lessonBooking.duration,
        price: lessonBooking.price,
        status: lessonBooking.status
      }

      subtotal += lessonPrice
    }

    // Create PDA test booking if provided
    if (data.pdaTest) {
      const config = await tx.pDATestConfig.findUnique({
        where: { id: data.pdaTest.configId },
        include: {
          testCentres: { where: { testCentreId: data.pdaTest.testCentreId } }
        }
      })

      if (!config) throw new Error('PDA_CONFIG_NOT_FOUND')
      if (config.instructorId !== data.instructorId) throw new Error('PDA_CONFIG_NOT_YOURS')
      if (config.testCentres.length === 0) throw new Error('TEST_CENTRE_NOT_AVAILABLE')

      // Parse as UTC — avoids local TZ shifting the datetime
      const testDateTime = new Date(`${data.pdaTest.testDate}T${data.pdaTest.testTime}:00.000Z`)
      if (isNaN(testDateTime.getTime())) throw new Error('INVALID_TEST_DATETIME')
      if (testDateTime < new Date()) throw new Error('TEST_DATE_IN_PAST')

      const testEnd = new Date(testDateTime.getTime() + config.durationMinutes * 60 * 1000)

      // Conflict check inside transaction (atomic)
      const pdaConflict = await tx.pDATestBooking.findFirst({
        where: {
          instructorId: data.instructorId,
          testCentreId: data.pdaTest.testCentreId,
          testDate: {
            gte: new Date(`${data.pdaTest.testDate}T00:00:00.000Z`),
            lt:  new Date(`${data.pdaTest.testDate}T23:59:59.999Z`),
          },
          status: { in: ['PENDING', 'CONFIRMED'] }
        },
        include: { config: { select: { durationMinutes: true } } }
      })

      if (pdaConflict?.testTime) {
        const conflictStart = new Date(`${data.pdaTest.testDate}T${pdaConflict.testTime.padStart(5,'0')}:00.000Z`)
        const conflictEnd   = new Date(conflictStart.getTime() + (pdaConflict.config?.durationMinutes || 180) * 60 * 1000)
        if (
          (testDateTime >= conflictStart && testDateTime < conflictEnd) ||
          (testEnd > conflictStart && testEnd <= conflictEnd) ||
          (testDateTime <= conflictStart && testEnd >= conflictEnd)
        ) {
          throw new Error('PDA_SLOT_CONFLICT')
        }
      }

      let pdaPrice = config.price
      if (config.discountPercent) {
        pdaPrice = config.price * (1 - config.discountPercent / 100)
        totalDiscount += config.price - pdaPrice
      }

      const pdaBooking = await tx.pDATestBooking.create({
        data: {
          instructorId: data.instructorId,
          clientId: data.clientId,
          configId: data.pdaTest.configId,
          testCentreId: data.pdaTest.testCentreId,
          testDate: testDateTime,
          testTime: data.pdaTest.testTime,
          price: pdaPrice,
          discountPercent: config.discountPercent,
          status: 'PENDING_PAYMENT'
        },
        include: { testCentre: true }
      })

      bookings.pdaTest = {
        id: pdaBooking.id,
        configName: config.name,
        testCentre: pdaBooking.testCentre.name,
        testDate: pdaBooking.testDate,
        testTime: pdaBooking.testTime,
        price: pdaBooking.price,
        discountPercent: pdaBooking.discountPercent,
        includes: config.includes,
        status: pdaBooking.status
      }

      subtotal += pdaPrice
    }

    }) // end $transaction

    const total = subtotal - totalDiscount

    return NextResponse.json(
      {
        success: true,
        bookings,
        totals: {
          subtotal,
          discount: totalDiscount,
          total
        }
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    const msg = (error as Error).message
    if (msg === 'LESSON_SLOT_CONFLICT') return NextResponse.json({ error: 'Lesson time slot conflicts with an existing booking' }, { status: 409 })
    if (msg === 'PDA_SLOT_CONFLICT')    return NextResponse.json({ error: 'PDA test time slot is not available' }, { status: 409 })
    if (msg === 'PDA_CONFIG_NOT_FOUND') return NextResponse.json({ error: 'PDA config not found' }, { status: 404 })
    if (msg === 'PDA_CONFIG_NOT_YOURS') return NextResponse.json({ error: 'PDA config does not belong to this instructor' }, { status: 403 })
    if (msg === 'TEST_CENTRE_NOT_AVAILABLE') return NextResponse.json({ error: 'Test centre not available for this config' }, { status: 404 })
    if (msg === 'TEST_DATE_IN_PAST')    return NextResponse.json({ error: 'Test date must be in the future' }, { status: 400 })
    if (msg === 'INVALID_TEST_DATETIME') return NextResponse.json({ error: 'Invalid test date or time' }, { status: 400 })
    console.error('Create combined booking error:', error)
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
  }
}
