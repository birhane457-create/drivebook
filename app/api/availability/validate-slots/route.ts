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
    const now = new Date();

    for (const slot of data.slots) {
      // Parse date (YYYY-MM-DD) + time (HH:MM) as Perth wall-clock time (AWST = UTC+8).
      // Using ISO 8601 with explicit offset avoids server-timezone ambiguity (Vercel = UTC).
      const startDateTime = new Date(`${slot.date}T${slot.time}:00+08:00`);
      const endDateTime = new Date(startDateTime.getTime() + slot.duration * 60 * 1000);

      // Clean up expired reservations for this instructor
      await prisma.slotReservation.deleteMany({
        where: {
          instructorId: data.instructorId,
          expiresAt: { lt: now },
        },
      });

      // Check for active slot reservations owned by other sessions.
      // Range overlap: reservation.startTime < thisEndDateTime AND reservation.endTime > thisStartDateTime
      const conflictingReservation = await prisma.slotReservation.findFirst({
        where: {
          instructorId: data.instructorId,
          sessionId: { not: data.sessionId },
          expiresAt: { gt: now },
          AND: [
            { startTime: { lt: endDateTime } },
            { endTime: { gt: startDateTime } }
          ]
        },
        select: { id: true },
      });

      // Check for overlapping active bookings in database.
      // COMPLETED bookings are past lessons and must NOT block future slots.
      const overlappingBookings = await prisma.booking.count({
        where: {
          instructorId: data.instructorId,
          status: {
            in: ['PENDING', 'PENDING_PAYMENT', 'CONFIRMED']
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

      if (conflictingReservation || overlappingBookings > 0) {
        invalidSlots.push({
          date: slot.date,
          time: slot.time,
          duration: slot.duration,
          reason: conflictingReservation
            ? 'This slot is temporarily reserved by another user'
            : 'This slot was booked by another user'
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
