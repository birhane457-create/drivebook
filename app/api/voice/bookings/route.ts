/**
 * Voice Service: Create Booking
 * 
 * Used by AI voice receptionist to create bookings from phone calls
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withVoiceServiceAuth } from '@/lib/middleware/voiceServiceAuth';
import { availabilityService } from '@/lib/services/availability';
import { paymentService } from '@/lib/services/payment';
import { emailService } from '@/lib/services/email';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const voiceBookingSchema = z.object({
  instructorId: z.string(),
  clientPhone: z.string(),
  clientName: z.string().optional(),
  clientEmail: z.string().email().optional(),
  date: z.string(), // YYYY-MM-DD
  time: z.string(), // HH:MM
  duration: z.number().default(60), // minutes
  notes: z.string().optional(),
  pickupAddress: z.string().optional()
});

async function handler(req: NextRequest) {
  try {
    const body = await req.json();
    const data = voiceBookingSchema.parse(body);

    // Parse date and time
    const [year, month, day] = data.date.split('-').map(Number);
    const [hours, minutes] = data.time.split(':').map(Number);
    
    const startTime = new Date(year, month - 1, day, hours, minutes);
    const endTime = new Date(startTime.getTime() + data.duration * 60 * 1000);

    // Validate booking time is not in the past
    if (startTime < new Date()) {
      return NextResponse.json(
        { error: 'Cannot create bookings in the past' },
        { status: 400 }
      );
    }

    // Get instructor
    const instructor = await prisma.instructor.findUnique({
      where: { id: data.instructorId },
      include: { user: true }
    });

    if (!instructor) {
      return NextResponse.json(
        { error: 'Instructor not found' },
        { status: 404 }
      );
    }

    // Check for double booking
    const hasConflict = await availabilityService.checkDoubleBooking(
      data.instructorId,
      startTime,
      endTime
    );

    if (hasConflict) {
      return NextResponse.json(
        { error: 'Time slot already booked' },
        { status: 409 }
      );
    }

    // Find or create client
    let client = await prisma.client.findFirst({
      where: {
        instructorId: data.instructorId,
        phone: data.clientPhone
      }
    });

    if (!client) {
      // Create new client
      client = await prisma.client.create({
        data: {
          instructorId: data.instructorId,
          name: data.clientName || 'Voice Booking Client',
          phone: data.clientPhone,
          email: data.clientEmail || `voice-${Date.now()}@temp.drivebook.com`
        }
      });
    }

    // Calculate price and commission
    const durationHours = data.duration / 60;
    const price = instructor.hourlyRate * durationHours;

    const commission = await paymentService.calculateCommission(
      data.instructorId,
      client.id,
      price
    );

    // Create booking in transaction
    const booking = await prisma.$transaction(async (tx) => {
      const newBooking = await tx.booking.create({
        data: {
          instructorId: data.instructorId,
          clientId: client.id,
          bookingType: 'LESSON',
          startTime,
          endTime,
          pickupAddress: data.pickupAddress,
          price,
          platformFee: commission.platformFee,
          instructorPayout: commission.instructorPayout,
          commissionRate: commission.commissionRate,
          isFirstBooking: commission.isFirstBooking,
          notes: data.notes,
          status: 'CONFIRMED',
          createdBy: 'voice',
          isPaid: false
        } as any,
        include: {
          client: true,
          instructor: {
            include: {
              user: true
            }
          }
        }
      });

      // Create transaction record
      await (tx as any).transaction.create({
        data: {
          bookingId: newBooking.id,
          instructorId: data.instructorId,
          type: 'BOOKING_PAYMENT',
          amount: commission.totalAmount,
          platformFee: commission.platformFee,
          instructorPayout: commission.instructorPayout,
          commissionRate: commission.commissionRate,
          status: 'PENDING',
          description: `Voice booking - ${commission.isFirstBooking ? 'First booking' : 'Repeat booking'}`,
          metadata: {
            isFirstBooking: commission.isFirstBooking,
            source: 'voice'
          }
        }
      });

      return newBooking;
    });

    // Send confirmation emails (best effort, don't fail if this fails)
    try {
      if (booking.client && booking.instructor.user && booking.startTime && booking.endTime) {
        await emailService.sendBookingConfirmation({
          clientName: booking.client.name,
          clientEmail: booking.client.email,
          instructorName: booking.instructor.name,
          instructorEmail: booking.instructor.user.email,
          startTime: booking.startTime,
          endTime: booking.endTime,
          pickupAddress: booking.pickupAddress || undefined
        });
      }
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't fail the booking
    }

    // Return booking confirmation
    return NextResponse.json({
      bookingId: booking.id,
      message: 'Booking confirmed',
      smsConfirmation: true, // Voice service will handle SMS
      booking: {
        id: booking.id,
        instructorName: booking.instructor.name,
        clientName: booking.client?.name || data.clientName || 'Unknown',
        date: data.date,
        time: data.time,
        duration: data.duration,
        price: booking.price
      }
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Voice booking creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const POST = withVoiceServiceAuth(handler);
