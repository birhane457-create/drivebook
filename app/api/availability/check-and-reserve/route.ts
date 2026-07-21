import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const reserveSlotSchema = z.object({
  instructorId: z.string(),
  date: z.string(),
  time: z.string(),
  duration: z.number(),
  sessionId: z.string() // Unique session ID for this booking flow
});

/**
 * Parse date (YYYY-MM-DD) and time (HH:MM) into UTC Date objects that correctly
 * represent Perth wall-clock time (AWST = UTC+8, no DST).
 *
 * e.g. "2026-07-15" + "09:00" → 2026-07-15T01:00:00Z (UTC equivalent of 9am Perth)
 *
 * Using new Date(date + 'T' + time + '+08:00') is the correct approach — it parses
 * the string as Perth local time and converts to UTC internally.
 * Do NOT use new Date(date + 'T00:00:00').setHours(...) — that uses the server's
 * local timezone (UTC on Vercel), shifting all Perth times by 8 hours.
 */
function parsePerthDateTime(date: string, time: string, durationMinutes: number) {
  const startDateTime = new Date(`${date}T${time}:00+08:00`);
  const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000);
  return { startDateTime, endDateTime };
}

/**
 * Check if slot is available:
 * 1. No active database reservations by other sessions
 * 2. No overlapping confirmed/pending bookings
 */
async function isSlotAvailable(
  instructorId: string,
  date: string,
  time: string,
  duration: number,
  sessionId: string
): Promise<{ available: boolean; reason?: string }> {
  const { startDateTime, endDateTime } = parsePerthDateTime(date, time, duration);

  // Clean up any expired reservations for this time slot
  const now = new Date();
  await prisma.slotReservation.deleteMany({
    where: {
      instructorId,
      expiresAt: { lt: now }
    }
  });

  // Check if another session has an active reservation overlapping this slot
  // CRITICAL: Use range overlap logic — other.startTime < thisEnd AND other.endTime > thisStart
  const existingReservation = await prisma.slotReservation.findFirst({
    where: {
      instructorId,
      sessionId: { not: sessionId },
      expiresAt: { gt: now },
      // Range overlap: reservation.startTime < thisEndDateTime AND reservation.endTime > thisStartDateTime
      AND: [
        { startTime: { lt: endDateTime } },
        { endTime: { gt: startDateTime } }
      ]
    }
  });

  if (existingReservation) {
    return { available: false, reason: 'Slot is temporarily reserved by another user' };
  }

  // Check for overlapping confirmed/pending bookings
  const overlappingBookings = await prisma.booking.count({
    where: {
      instructorId,
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

  if (overlappingBookings > 0) {
    return { available: false, reason: 'Slot is already booked' };
  }

  return { available: true };
}

/**
 * POST - Reserve a slot temporarily (10 minutes)
 * Saves to database instead of in-memory Map
 * Benefits: survives restarts, works in distributed systems, enables monitoring
 */
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

    // Reserve the slot in database (10 minutes)
    const { startDateTime, endDateTime } = parsePerthDateTime(
      data.date,
      data.time,
      data.duration
    );

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    const reservation = await prisma.slotReservation.create({
      data: {
        instructorId: data.instructorId,
        startTime: startDateTime,
        endTime: endDateTime,
        sessionId: data.sessionId,
        expiresAt
      }
    });

    return NextResponse.json({
      success: true,
      available: true,
      expiresAt: expiresAt.toISOString(),
      message: 'Slot reserved for 10 minutes',
      reservationId: reservation.id
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Reserve slot error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE - Release a reserved slot
 * Only allows releasing if the session owns it (sessionId matches)
 */
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

    const { startDateTime, endDateTime } = parsePerthDateTime(
      date,
      time,
      parseInt(duration)
    );

    // Find and delete the reservation only if sessionId matches (ownership check)
    const result = await prisma.slotReservation.deleteMany({
      where: {
        instructorId,
        startTime: startDateTime,
        endTime: endDateTime,
        sessionId // Only delete if same session owns it
      }
    });

    if (result.count > 0) {
      return NextResponse.json({ success: true, message: 'Slot released' });
    }

    return NextResponse.json(
      { success: false, message: 'Slot not found or not owned by session' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Release slot error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
