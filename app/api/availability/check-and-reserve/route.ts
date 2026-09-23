import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { localDateTimeToUTC, resolveTimezone, timezoneFromState, DEFAULT_TIMEZONE } from '@/lib/utils/timezone';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const reserveSlotSchema = z.object({
  providerId: z.string(),
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
async function parseInstructorDateTime(providerId: string, date: string, time: string, durationMinutes: number) {
  const instructor = await prisma.provider.findUnique({
    where: { id: providerId },
    select: { timezone: true, state: true },
  });

  const instructorTimezone = instructor
    ? resolveTimezone(instructor.timezone) !== DEFAULT_TIMEZONE
      ? resolveTimezone(instructor.timezone)
      : timezoneFromState(instructor.state)
    : DEFAULT_TIMEZONE;

  const startDateTime = localDateTimeToUTC(date, time, instructorTimezone);
  const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000);
  return { startDateTime, endDateTime };
}

/**
 * Check if slot is available:
 * 1. No active database reservations by other sessions
 * 2. No overlapping confirmed/pending bookings
 */
async function isSlotAvailable(
  providerId: string,
  date: string,
  time: string,
  duration: number,
  sessionId: string
): Promise<{ available: boolean; reason?: string }> {
  const { startDateTime, endDateTime } = await parseInstructorDateTime(providerId, date, time, duration);

  const now = new Date();

  // PAY-H-04 Layer 1: Delete expired rows that overlap the target interval.
  // Scoped to (providerId, expiredAt, overlapping range) so the all-rows
  // GiST exclusion constraint does not fire on logically-expired rows.
  // The broader provider-scoped cleanup that follows handles the rest.
  await prisma.slotReservation.deleteMany({
    where: {
      providerId,
      expiresAt: { lt: now },
      AND: [
        { startTime: { lt: endDateTime } },
        { endTime:   { gt: startDateTime } },
      ],
    },
  });

  // Also clean up other expired reservations for this provider (general hygiene)
  await prisma.slotReservation.deleteMany({
    where: {
      providerId,
      expiresAt: { lt: now },
    },
  });

  // Check if another session has an active reservation overlapping this slot
  // CRITICAL: Use range overlap logic — other.startTime < thisEnd AND other.endTime > thisStart
  const existingReservation = await prisma.slotReservation.findFirst({
    where: {
      providerId,
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
      providerId,
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
      data.providerId,
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
    const { startDateTime, endDateTime } = await parseInstructorDateTime(
      data.providerId,
      data.date,
      data.time,
      data.duration
    );

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    let reservation;
    try {
      reservation = await prisma.slotReservation.create({
        data: {
          providerId: data.providerId,
          startTime: startDateTime,
          endTime: endDateTime,
          sessionId: data.sessionId,
          expiresAt
        }
      });
    } catch (createError: any) {
      // PAY-H-04 Layer 3: GiST exclusion constraint fired (PostgreSQL 23P01).
      // This catches races that slipped through the application overlap check —
      // the constraint is the final concurrency invariant.
      // Note: exclusion constraint violations surface as PrismaClientUnknownRequestError
      // (not P2002). We match on the PostgreSQL error code 23P01 and/or the constraint
      // name in the message, which is more robust than checking constructor name
      // (which can be minified in production bundles).
      if (
        createError.message?.includes('23P01') ||
        createError.message?.includes('SlotReservation_no_overlap')
      ) {
        return NextResponse.json({
          success: false,
          available: false,
          reason: 'Slot is temporarily reserved by another user',
        }, { status: 409 });
      }
      throw createError;
    }

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
    const providerId = searchParams.get('providerId');
    const date = searchParams.get('date');
    const time = searchParams.get('time');
    const duration = searchParams.get('duration');
    const sessionId = searchParams.get('sessionId');

    if (!providerId || !date || !time || !duration || !sessionId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Reserve the slot in database (10 minutes) — DELETE handler
    const { startDateTime: delStart, endDateTime: delEnd } = await parseInstructorDateTime(
      providerId,
      date,
      time,
      parseInt(duration)
    );

    // Find and delete the reservation only if sessionId matches (ownership check)
    const result = await prisma.slotReservation.deleteMany({
      where: {
        providerId,
        startTime: delStart,
        endTime: delEnd,
        sessionId
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
