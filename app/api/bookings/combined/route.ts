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

    // Verify instructor exists
    const instructor = await prisma.instructor.findUnique({
      where: { id: data.instructorId }
    })

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 })
    }

    const bookings: any = {}
    let subtotal = 0
    let totalDiscount = 0

    // Create lesson booking if provided
    if (data.lesson) {
      const startTime = new Date(data.lesson.startTime)
      const endTime = new Date(startTime.getTime() + data.lesson.duration * 60 * 1000)

      // Check for conflicts using availability service
      const { availabilityService } = await import('@/lib/services/availability')
      const hasConflict = await availabilityService.checkDoubleBooking(
        data.instructorId,
        startTime,
        endTime
      )

      if (hasConflict) {
        return NextResponse.json(
          { error: 'Time slot not available - conflict with existing booking' },
          { status: 409 }
        )
      }

      // Calculate lesson price
      const lessonPrice = (instructor.hourlyRate || 0) * (data.lesson.duration / 60)

      const lessonBooking = await prisma.booking.create({
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
          source: 'platform'
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
      // Verify PDA config exists and belongs to instructor
      const config = await prisma.pDATestConfig.findUnique({
        where: { id: data.pdaTest.configId },
        include: {
          testCentres: {
            where: {
              testCentreId: data.pdaTest.testCentreId
            }
          }
        }
      })

      if (!config) {
        return NextResponse.json({ error: 'PDA config not found' }, { status: 404 })
      }

      if (config.instructorId !== data.instructorId) {
        return NextResponse.json(
          { error: 'PDA config does not belong to this instructor' },
          { status: 403 }
        )
      }

      if (config.testCentres.length === 0) {
        return NextResponse.json(
          { error: 'Test centre not available for this config' },
          { status: 404 }
        )
      }

      // Parse test date and time
      const [year, month, day] = data.pdaTest.testDate.split('-').map(Number)
      const [hour, minute] = data.pdaTest.testTime.split(':').map(Number)
      const testDateTime = new Date(year, month - 1, day, hour, minute)

      // Verify test date is in the future
      if (testDateTime < new Date()) {
        return NextResponse.json(
          { error: 'Test date must be in the future' },
          { status: 400 }
        )
      }

      // Check for conflicts with other PDA bookings
      const testStart = testDateTime
      const testEnd = new Date(testStart.getTime() + config.durationMinutes * 60 * 1000)

      const conflict = await prisma.pDATestBooking.findFirst({
        where: {
          instructorId: data.instructorId,
          testCentreId: data.pdaTest.testCentreId,
          testDate: {
            gte: new Date(testStart.toDateString()),
            lt: new Date(new Date(testStart).setDate(testStart.getDate() + 1))
          },
          status: { in: ['PENDING', 'CONFIRMED'] }
        },
        include: {
          config: { select: { durationMinutes: true } }
        }
      })

      if (conflict && conflict.testTime) {
        const conflictStart = new Date(testStart.toDateString() + ' ' + conflict.testTime)
        const conflictEnd = new Date(
          conflictStart.getTime() + (conflict.config?.durationMinutes || 180) * 60 * 1000
        )

        if (
          (testStart >= conflictStart && testStart < conflictEnd) ||
          (testEnd > conflictStart && testEnd <= conflictEnd) ||
          (testStart <= conflictStart && testEnd >= conflictEnd)
        ) {
          return NextResponse.json(
            { error: 'This PDA test time slot is not available' },
            { status: 409 }
          )
        }
      }

      // Calculate PDA price with discount
      let pdaPrice = config.price
      if (config.discountPercent) {
        pdaPrice = config.price * (1 - config.discountPercent / 100)
        totalDiscount += config.price - pdaPrice
      }

      const pdaBooking = await prisma.pDATestBooking.create({
        data: {
          instructorId: data.instructorId,
          clientId: data.clientId,
          configId: data.pdaTest.configId,
          testCentreId: data.pdaTest.testCentreId,
          testDate: testDateTime,
          testTime: data.pdaTest.testTime,
          price: pdaPrice,
          discountPercent: config.discountPercent,
          status: 'PENDING'
        },
        include: {
          testCentre: true
        }
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
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Create combined booking error:', error)
    return NextResponse.json(
      { error: 'Failed to create booking' },
      { status: 500 }
    )
  }
}
