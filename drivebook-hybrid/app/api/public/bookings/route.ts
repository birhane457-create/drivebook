import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emailService } from '@/lib/services/email'
import { googleCalendarService } from '@/lib/services/googleCalendar'
import { calculateTravelTimeToNextBooking } from '@/lib/services/travelTime'
import { paymentService } from '@/lib/services/payment'
import { z } from 'zod'
import bcrypt from 'bcryptjs'


export const dynamic = 'force-dynamic';
const publicBookingSchema = z.object({
  instructorId: z.string(),
  clientName: z.string(),
  clientEmail: z.string().email(),
  clientPhone: z.string(),
  pickupAddress: z.string(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  notes: z.string().optional(),
  price: z.number(),
  createAccount: z.boolean().optional(),
  password: z.string().optional()
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = publicBookingSchema.parse(body)

    const startTime = new Date(data.startTime)
    const endTime = new Date(data.endTime)

    // Check if instructor exists
    const instructor = await prisma.instructor.findUnique({
      where: { id: data.instructorId },
      include: { user: true }
    })

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 })
    }

    // Create user account if requested
    let userId: string | undefined;
    if (data.createAccount && data.password) {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: data.clientEmail }
      });

      if (!existingUser) {
        // Create new user account
        const hashedPassword = await bcrypt.hash(data.password, 10);
        const newUser = await prisma.user.create({
          data: {
            email: data.clientEmail,
            password: hashedPassword,
            role: 'CLIENT'
          }
        });
        userId = newUser.id;

        // Send welcome email with mobile app instructions
        await emailService.sendWelcomeEmail({
          clientName: data.clientName,
          clientEmail: data.clientEmail,
        });
      } else {
        userId = existingUser.id;
      }
    }

    // Create or find client
    let client = await prisma.client.findFirst({
      where: {
        instructorId: data.instructorId,
        email: data.clientEmail
      }
    })

    if (!client) {
      client = await prisma.client.create({
        data: {
          instructorId: data.instructorId,
          userId: userId, // Link to user account if created
          name: data.clientName,
          email: data.clientEmail,
          phone: data.clientPhone,
          addressText: data.pickupAddress
        }
      })
    } else if (userId && !client.userId) {
      // Update existing client with user ID
      client = await prisma.client.update({
        where: { id: client.id },
        data: { userId }
      });
    }

    // Calculate travel time from previous booking to this one
    const travelTime = await calculateTravelTimeToNextBooking(
      data.instructorId,
      startTime,
      data.pickupAddress,
      prisma
    )

    // Calculate commission for this booking (for display purposes)
    const commission = await paymentService.calculateCommission(
      data.instructorId,
      client.id,
      data.price
    )

    // Create booking with commission details
    const booking = await prisma.booking.create({
      data: {
        instructorId: data.instructorId,
        clientId: client.id,
        bookingType: 'LESSON',
        status: 'PENDING',
        startTime,
        endTime,
        pickupAddress: data.pickupAddress,
        price: data.price,
        platformFee: commission.platformFee,
        instructorPayout: commission.instructorPayout,
        commissionRate: commission.commissionRate,
        isFirstBooking: commission.isFirstBooking,
        notes: data.notes,
        createdBy: 'client',
        travelTimeMinutes: travelTime
      } as any // Type assertion for new payment fields
    })

    // Note: Transaction will be created automatically when booking is completed (checked out)

    // Push to Google Calendar if connected
    if (instructor.syncGoogleCalendar) {
      try {
        const calendarResult = await googleCalendarService.createCalendarEvent(data.instructorId, {
          id: booking.id,
          startTime,
          endTime,
          clientName: data.clientName,
          clientPhone: data.clientPhone,
          pickupAddress: data.pickupAddress,
          notes: data.notes
        })

        // Save the Google Calendar event ID
        if (calendarResult.eventId) {
          await prisma.booking.update({
            where: { id: booking.id },
            data: { googleCalendarEventId: calendarResult.eventId } as any // Type assertion for new field
          })
        }
      } catch (error) {
        console.error('Failed to push to Google Calendar:', error)
        // Don't fail the booking if calendar push fails
      }
    }

    // Send emails
    await emailService.sendBookingConfirmation({
      clientName: data.clientName,
      clientEmail: data.clientEmail,
      clientPhone: data.clientPhone,
      instructorName: instructor.name,
      instructorEmail: instructor.user.email,
      instructorPhone: instructor.phone,
      startTime,
      endTime,
      pickupAddress: data.pickupAddress
    })

    return NextResponse.json({ 
      success: true, 
      booking,
      redirectTo: `/booking/${booking.id}/payment` // Redirect to payment page
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Public booking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
