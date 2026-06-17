import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const pdaBookingSchema = z.object({
  clientId: z.string().min(1),
  configId: z.string().min(1),
  testCentreId: z.string().min(1),
  testDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  testTime: z.string().regex(/^([0-1]?\d|2[0-3]):[0-5]\d$/),
  parentBookingId: z.string().min(1).optional() // Link to parent lesson package booking
})

// POST - Create PDA test booking
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const data = pdaBookingSchema.parse(body)

    // Get client from user email
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get client by ID and verify it belongs to user
    const client = await prisma.client.findFirst({
      where: { id: data.clientId, userId: user.id }
    })

    if (!client) {
      return NextResponse.json({
        error: 'Client not found or does not belong to you'
      }, { status: 404 })
    }

    // Get PDA config
    const config = await prisma.pDATestConfig.findUnique({
      where: { id: data.configId },
      include: {
        instructor: { select: { id: true, name: true } },
        testCentres: {
          where: {
            testCentreId: data.testCentreId
          },
          include: {
            testCentre: true
          }
        }
      }
    })

    if (!config) {
      return NextResponse.json({ error: 'PDA config not found' }, { status: 404 })
    }

    // Verify test centre is linked to config
    if (config.testCentres.length === 0) {
      return NextResponse.json({
        error: 'This config is not offered at this test centre'
      }, { status: 404 })
    }

    const testCentre = config.testCentres[0].testCentre

    // Parse test date and time
    const [year, month, day] = data.testDate.split('-').map(Number)
    const [hour, minute] = data.testTime.split(':').map(Number)
    const testDateTime = new Date(year, month - 1, day, hour, minute)

    // Verify test date is in the future
    if (testDateTime < new Date()) {
      return NextResponse.json({
        error: 'Test date must be in the future'
      }, { status: 400 })
    }

    // Check for conflicts with other PDA bookings at same centre and time
    const testStart = testDateTime
    const testEnd = new Date(testStart.getTime() + config.durationMinutes * 60 * 1000)

    const conflict = await prisma.pDATestBooking.findFirst({
      where: {
        instructorId: config.instructorId,
        testCentreId: data.testCentreId,
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
      const conflictStart = new Date(
        testStart.toDateString() + ' ' + conflict.testTime
      )
      const conflictEnd = new Date(
        conflictStart.getTime() + (conflict.config?.durationMinutes || 180) * 60 * 1000
      )

      // Check for time overlap
      if (
        (testStart >= conflictStart && testStart < conflictEnd) ||
        (testEnd > conflictStart && testEnd <= conflictEnd) ||
        (testStart <= conflictStart && testEnd >= conflictEnd)
      ) {
        return NextResponse.json({
          error: 'This time slot is not available at this test centre'
        }, { status: 409 })
      }
    }

    // Calculate price with discount
    let finalPrice = config.price
    if (config.discountPercent) {
      finalPrice = config.price * (1 - config.discountPercent / 100)
    }

    // Create booking
    const booking = await prisma.pDATestBooking.create({
      data: {
        instructorId: config.instructorId,
        clientId: data.clientId,
        configId: data.configId,
        testCentreId: data.testCentreId,
        testDate: testDateTime,
        testTime: data.testTime,
        price: finalPrice,
        discountPercent: config.discountPercent,
        status: 'PENDING',
        parentBookingId: data.parentBookingId
      },
      include: {
        testCentre: true,
        instructor: { select: { id: true, name: true } }
      }
    })

    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        instructorName: booking.instructor.name,
        configName: config.name,
        testCentre: booking.testCentre.name,
        testDate: booking.testDate.toISOString().split('T')[0],
        testTime: booking.testTime,
        price: booking.price,
        status: booking.status
      }
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Create PDA booking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET - List PDA bookings for client
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get all PDA bookings for clients belonging to this user
    const bookings = await prisma.pDATestBooking.findMany({
      where: {
        client: {
          userId: user.id
        }
      },
      include: {
        config: { select: { name: true, durationMinutes: true, price: true } },
        testCentre: { select: { name: true, address: true } },
        instructor: { select: { id: true, name: true } }
      },
      orderBy: { testDate: 'desc' }
    })

    return NextResponse.json({ bookings })
  } catch (error) {
    console.error('Get PDA bookings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
