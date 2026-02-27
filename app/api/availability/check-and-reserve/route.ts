import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const reserveSlotSchema = z.object({
  instructorId: z.string(),
  date: z.string(),
  time: z.string(),
  duration: z.number(),
  sessionId: z.string() // Unique session ID for this booking flow
});

// Temporary slot reservations (in-memory, expires after 10 minutes)
// In production, use Redis or database table
const slotReservations = new Map<string, { expiresAt: Date; sessionId: string }>();

// Clean up expired reservations
function cleanupExpiredReservations() {
  const now = new Date();
  for (const [key, reservation] of slotReservations.entries()) {
    if (reservation.expiresAt < now) {
      slotReservations.delete(key);
    }
  }
}

// Generate slot key
function getSlotKey(instructorId: string, date: string, time: string, duration: number): string {
  return `${instructorId}:${date}:${time}:${duration}`;
}

// Check if slot overlaps with existing bookings or reservations
async function isSlotAvailable(
  instructorId: string,
  date: string,
  time: string,
  duration: number,
  sessionId: string
): Promise<{ available: boolean; reason?: string }> {
  cleanupExpiredReservations();

  const slotKey = getSlotKey(instructorId, date, time, duration);
  
  // Check temporary reservations
  const reservation = slotReservations.get(slotKey);
  if (reservation && reservation.sessionId !== sessionId) {
    return { available: false, reason: 'Slot is temporarily reserved by another user' };
  }

  // Parse date and time
  const [hours, minutes] = time.split(':').map(Number);
  const startDateTime = new Date(date + 'T00:00:00');
  startDateTime.setHours(hours, minutes, 0, 0);
  
  const endDateTime = new Date(startDateTime);
  endDateTime.setMinutes(endDateTime.getMinutes() + duration);

  // Check for overlapping confirmed bookings in database
  const overlappingBookings = await prisma.booking.count({
    where: {
      instructorId,
      status: {
        in: ['PENDING', 'CONFIRMED']
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
    return { available: false, reason: 'Slot is already booked' };
  }

  return { available: true };
}

// POST - Reserve a slot temporarily
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = reserveSlotSchema.parse(body);

    // Check if slot is available
    const availability = await isSlotAvailable(
      data.instructorId,
      data.date,
      data.time,
      data.duration,
      data.sessionId
    );

    if (!availability.available) {
      return NextResponse.json({
        success: false,
        available: false,
        reason: availability.reason
      }, { status: 409 }); // 409 Conflict
    }

    // Reserve the slot temporarily (10 minutes)
    const slotKey = getSlotKey(data.instructorId, data.date, data.time, data.duration);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    slotReservations.set(slotKey, {
      expiresAt,
      sessionId: data.sessionId
    });

    return NextResponse.json({
      success: true,
      available: true,
      expiresAt: expiresAt.toISOString(),
      message: 'Slot reserved for 10 minutes'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Reserve slot error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Release a reserved slot
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const instructorId = searchParams.get('instructorId');
    const date = searchParams.get('date');
    const time = searchParams.get('time');
    const duration = searchParams.get('duration');
    const sessionId = searchParams.get('sessionId');

    if (!instructorId || !date || !time || !duration || !sessionId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const slotKey = getSlotKey(instructorId, date, time, parseInt(duration));
    const reservation = slotReservations.get(slotKey);

    // Only allow releasing if it's the same session
    if (reservation && reservation.sessionId === sessionId) {
      slotReservations.delete(slotKey);
      return NextResponse.json({ success: true, message: 'Slot released' });
    }

    return NextResponse.json({ success: false, message: 'Slot not found or not owned by session' });
  } catch (error) {
    console.error('Release slot error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
