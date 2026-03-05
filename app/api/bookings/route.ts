import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { availabilityService } from '@/lib/services/availability'
import { emailService } from '@/lib/services/email'
import { googleCalendarService } from '@/lib/services/googleCalendar'
import { paymentService } from '@/lib/services/payment'
import { recordBookingPayment } from '@/lib/services/ledger-operations'
import { getAccountBalance, buildAccount, AccountType } from '@/lib/services/ledger'
import { requireActiveSubscription } from '@/lib/middleware/subscriptionValidation'
import { z } from 'zod'
import { bookingRateLimit, checkRateLimit, getRateLimitIdentifier } from '@/lib/ratelimit'


export const dynamic = 'force-dynamic';
const bookingSchema = z.object({
  clientId: z.string(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  bookingType: z.enum(['LESSON', 'PDA_TEST', 'MOCK_TEST']).optional(),
  pickupAddress: z.string().optional(),
  pickupLatitude: z.number().optional(),
  pickupLongitude: z.number().optional(),
  dropoffAddress: z.string().optional(),
  notes: z.string().optional(),
  price: z.number().optional(),
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

    // CRITICAL: Validate subscription before allowing booking creation
    const subscriptionCheck = await requireActiveSubscription(session.user.id);
    if (!subscriptionCheck.valid) {
      return NextResponse.json({ 
        error: subscriptionCheck.message,
        status: subscriptionCheck.status,
        requiresSubscription: true
      }, { status: 403 });
    }

    // FIXED: Rate limiting to prevent spam
    const rateLimitId = getRateLimitIdentifier(
      session.user.instructorId,
      req.headers.get('x-forwarded-for'),
      'booking'
    );
    
    const rateLimitResult = await checkRateLimit(bookingRateLimit, rateLimitId);
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { 
          status: 429,
          headers: rateLimitResult.headers 
        }
      );
    }

    const body = await req.json()
    const data = bookingSchema.parse(body)

    const startTime = new Date(data.startTime)
    const endTime = new Date(data.endTime)
    
    // FIXED: Validate booking time is not in the past
    if (startTime < new Date()) {
      return NextResponse.json({ 
        error: 'Cannot create bookings in the past' 
      }, { status: 400 })
    }
    
    // Get instructor to calculate price if not provided
    const instructor = await prisma.instructor.findUnique({
      where: { id: session.user.instructorId }
    })
    
    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 })
    }

    // FIXED: Validate client belongs to instructor and is active
    const client = await prisma.client.findFirst({
      where: {
        id: data.clientId,
        instructorId: session.user.instructorId
      }
    })

    if (!client) {
      return NextResponse.json({ 
        error: 'Client not found or does not belong to you' 
      }, { status: 404 })
    }

    // FIXED: Check if client is suspended
    if ((client as any).status === 'SUSPENDED') {
      return NextResponse.json({ 
        error: 'Cannot book with suspended client' 
      }, { status: 403 })
    }
    
    // Calculate price if not provided
    const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60)
    const price = data.price || (instructor.hourlyRate * (durationMinutes / 60))

    // Calculate commission for this booking
    const commission = await paymentService.calculateCommission(
      session.user.instructorId,
      data.clientId,
      price
    )

    // Check for double booking
    const hasConflict = await availabilityService.checkDoubleBooking(
      session.user.instructorId,
      startTime,
      endTime
    )

    if (hasConflict) {
      return NextResponse.json(
        { error: 'Time slot already booked' },
        { status: 409 }
      )
    }

    // FIXED: Use transaction wrapper for atomic operations + LEDGER
    const booking = await prisma.$transaction(async (tx) => {
      // Create booking
      const newBooking = await tx.booking.create({
        data: {
          instructorId: session.user.instructorId,
          clientId: data.clientId,
          bookingType: data.bookingType || 'LESSON',
          startTime,
          endTime,
          pickupAddress: data.pickupAddress,
          pickupLatitude: data.pickupLatitude,
          pickupLongitude: data.pickupLongitude,
          dropoffAddress: data.dropoffAddress,
          price,
          platformFee: commission.platformFee,
          instructorPayout: commission.instructorPayout,
          commissionRate: commission.commissionRate,
          isFirstBooking: commission.isFirstBooking,
          notes: data.notes,
          status: 'CONFIRMED',
          createdBy: 'instructor',
          isPaid: false // Will be marked paid when payment captured
        } as any,
        include: {
          client: true,
          instructor: {
            include: {
              user: true
            }
          }
        }
      })
      
      // If booking type is PDA_TEST, create a PDA test entry
      if (data.bookingType === 'PDA_TEST' && data.testCenterName && data.testCenterAddress && session.user.instructorId) {
        await tx.pDATest.create({
          data: {
            instructorId: session.user.instructorId,
            clientId: data.clientId,
            testCenterName: data.testCenterName,
            testCenterAddress: data.testCenterAddress,
            testCenterLatitude: data.pickupLatitude || 0,
            testCenterLongitude: data.pickupLongitude || 0,
            testDate: startTime,
            testTime: startTime.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false 
            }),
            result: 'PENDING',
            notes: data.notes,
          }
        })
      }

      // ✅ CRITICAL FIX: Create transaction immediately when booking is created
      // This ensures instructor gets paid even if check-out fails
      await (tx as any).transaction.create({
        data: {
          bookingId: newBooking.id,
          instructorId: session.user.instructorId,
          type: 'BOOKING_PAYMENT',
          amount: commission.totalAmount,
          platformFee: commission.platformFee,
          instructorPayout: commission.instructorPayout,
          commissionRate: commission.commissionRate,
          status: 'PENDING', // Will be COMPLETED when booking completes
          description: `Booking payment - ${commission.isFirstBooking ? 'First booking with client' : 'Repeat booking'}`,
          metadata: {
            isFirstBooking: commission.isFirstBooking,
          },
        },
      })

      return newBooking
    }, {
      maxWait: 5000, // Wait max 5s to start transaction
      timeout: 10000, // Max 10s for transaction
    })

    // Create Google Calendar event if instructor has calendar connected
    if (booking.instructor.syncGoogleCalendar) {
      try {
        const result = await googleCalendarService.createCalendarEvent(
          booking.instructorId,
          {
            id: booking.id,
            startTime: booking.startTime,
            endTime: booking.endTime,
            clientName: booking.client.name,
            clientPhone: booking.client.phone,
            pickupAddress: booking.pickupAddress || undefined,
            notes: booking.notes || undefined
          }
        )

        // Update booking with calendar event ID
        if (result.success && result.eventId) {
          await prisma.booking.update({
            where: { id: booking.id },
            data: { googleCalendarEventId: result.eventId }
          })
        }
      } catch (calendarError) {
        console.error('Failed to create calendar event:', calendarError)
        // Don't fail the booking if calendar creation fails
      }
    }

    // Send confirmation emails
    await emailService.sendBookingConfirmation({
      clientName: booking.client.name,
      clientEmail: booking.client.email,
      instructorName: booking.instructor.name,
      instructorEmail: booking.instructor.user.email,
      startTime: booking.startTime,
      endTime: booking.endTime,
      pickupAddress: booking.pickupAddress || undefined
    })

    return NextResponse.json({ 
      booking,
      requiresPayment: true,
      redirectTo: `/booking/${booking.id}/payment` // Redirect to payment page
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Booking creation error:', error)
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
        status: { in: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] } // ✅ Include PENDING for manual confirmation
      },
      include: {
        client: true
      },
      orderBy: {
        startTime: 'asc'
      }
    })

    return NextResponse.json(bookings)
  } catch (error) {
    console.error('Fetch bookings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
