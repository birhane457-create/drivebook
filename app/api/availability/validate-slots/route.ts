import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';


export const dynamic = 'force-dynamic';
const validateSlotsSchema = z.object({
  instructorId: z.string(),
  slots: z.array(z.object({
    date: z.string(),
    time: z.string(),
    duration: z.number()
  })),
  sessionId: z.string()
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = validateSlotsSchema.parse(body);

    const invalidSlots = [];

    for (const slot of data.slots) {
      // Parse date and time
      const [hours, minutes] = slot.time.split(':').map(Number);
      const startDateTime = new Date(slot.date + 'T00:00:00');
      startDateTime.setHours(hours, minutes, 0, 0);
      
      const endDateTime = new Date(startDateTime);
      endDateTime.setMinutes(endDateTime.getMinutes() + slot.duration);

      // Check for overlapping confirmed bookings in database
      const overlappingBookings = await prisma.booking.count({
        where: {
          instructorId: data.instructorId,
          status: {
            in: ['PENDING', 'CONFIRMED', 'COMPLETED']
          },
          OR: [
            {
              // Booking starts during this slot
              AND: [
                { startTime: { gte: startDateTime } },
                { startTime: { lt: endDateTime } }
              ]
            },
            {
              // Booking ends during this slot
              AND: [
                { endTime: { gt: startDateTime } },
                { endTime: { lte: endDateTime } }
              ]
            },
            {
              // Booking completely encompasses this slot
              AND: [
                { startTime: { lte: startDateTime } },
                { endTime: { gte: endDateTime } }
              ]
            }
          ]
        }
      });

      if (overlappingBookings > 0) {
        invalidSlots.push({
          date: slot.date,
          time: slot.time,
          duration: slot.duration,
          reason: 'This slot was booked by another user'
        });
      }
    }

    if (invalidSlots.length > 0) {
      return NextResponse.json({
        valid: false,
        invalidSlots,
        message: `${invalidSlots.length} slot(s) are no longer available. Please select different times.`
      }, { status: 409 });
    }

    return NextResponse.json({
      valid: true,
      message: 'All slots are available'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Validate slots error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
