/**
 * Voice Service: Check Availability
 * 
 * Used by AI voice receptionist to check if a time slot is available
 * before creating a booking
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withVoiceServiceAuth } from '@/lib/middleware/voiceServiceAuth';
import { availabilityService } from '@/lib/services/availability';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const availabilityCheckSchema = z.object({
  instructorId: z.string(),
  date: z.string(), // YYYY-MM-DD
  time: z.string(), // HH:MM
  duration: z.number().default(60) // minutes
});

async function handler(req: NextRequest) {
  try {
    const body = await req.json();
    const data = availabilityCheckSchema.parse(body);

    // Parse date and time
    const [year, month, day] = data.date.split('-').map(Number);
    const [hours, minutes] = data.time.split(':').map(Number);
    
    const startTime = new Date(year, month - 1, day, hours, minutes);
    const endTime = new Date(startTime.getTime() + data.duration * 60 * 1000);

    // Validate booking time is not in the past
    if (startTime < new Date()) {
      return NextResponse.json({
        available: false,
        reason: 'Time slot is in the past',
        alternatives: []
      });
    }

    // Get instructor
    const instructor = await prisma.instructor.findUnique({
      where: { id: data.instructorId },
      select: { 
        name: true,
        workingHours: true 
      }
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
      // Get alternative slots for the same day
      const alternatives = await availabilityService.getAvailableSlots(
        data.instructorId,
        startTime,
        data.duration
      );

      // Format alternatives (limit to 3)
      const formattedAlternatives = alternatives
        .slice(0, 3)
        .map(slot => ({
          date: data.date,
          time: slot.toTimeString().substring(0, 5), // HH:MM
          available: true
        }));

      return NextResponse.json({
        available: false,
        reason: 'Time slot already booked',
        requestedTime: data.time,
        alternatives: formattedAlternatives
      });
    }

    // Slot is available
    return NextResponse.json({
      available: true,
      instructorName: instructor.name,
      date: data.date,
      time: data.time,
      duration: data.duration
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Availability check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const POST = withVoiceServiceAuth(handler);
