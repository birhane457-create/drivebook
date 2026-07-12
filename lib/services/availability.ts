import { prisma } from '../prisma'
import { addMinutes, format } from 'date-fns'

interface TimeSlot {
  start: string
  end: string
}

interface WorkingHours {
  [key: string]: TimeSlot[]
}

// Parse HH:mm string (Perth local time) into a UTC Date for the given YYYY-MM-DD.
// Working hours in the DB are always Perth wall-clock time (AWST = UTC+8).
// Constructing with +08:00 offset instead of Z ensures 09:00 Perth = 01:00 UTC,
// fixing the previous 8-hour shift that showed 9 AM hours as 5 PM slots.
// Perth does not observe daylight saving -- AWST (+08:00) is constant year-round.
function parseTimeUTC(hhMm: string, dateStr: string): Date {
  const [h, m] = hhMm.split(':').map(Number)
  const hh = String(h).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  return new Date(`${dateStr}T${hh}:${mm}:00.000+08:00`)
}

export class AvailabilityService {
  async getAvailableSlots(
    instructorId: string,
    date: Date,
    lessonDurationMinutes: number = 60
  ): Promise<Date[]> {
    // 1. Get instructor's working hours and buffer settings for this day
    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
      select: {
        workingHours: true,
        bookingBufferMinutes: true,
        enableTravelTime: true,
        travelTimeMinutes: true,
      }
    })

    if (!instructor) throw new Error('Instructor not found')

    const bufferMinutes = instructor.bookingBufferMinutes ?? 10; // platform minimum is 10
    const travelMinutes = instructor.enableTravelTime ? (instructor.travelTimeMinutes ?? 0) : 0;
    // Effective gap after any booking before the next slot can start
    const effectiveGapMinutes = Math.max(bufferMinutes, travelMinutes);

    const dayName = format(date, 'EEEE').toLowerCase()
    const workingHours = (instructor.workingHours as unknown) as WorkingHours
    const daySlots = workingHours[dayName] || []

    if (daySlots.length === 0) return []

    // 2. Get existing bookings for this day (excluding PDA tests — handled separately)
    // Use UTC day boundaries derived from the date's ISO string to avoid server TZ shifting
    const dateStr = date.toISOString().slice(0, 10)
    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`)
    const endOfDay   = new Date(`${dateStr}T23:59:59.999Z`)

    const bookings = await prisma.booking.findMany({
      where: {
        instructorId,
        startTime: { gte: startOfDay, lte: endOfDay },
        status: { in: ['PENDING', 'PENDING_PAYMENT', 'CONFIRMED'] },
        NOT: { bookingType: 'PDA_TEST' } as any,
      },
      select: { startTime: true, endTime: true }
    })

    // 3. Get PDA tests — block from (testStart - bufferMinutes) to (testEnd)
    // The instructor's buffer already handles the gap after the test ends.
    // PDA test duration is stored on the booking (165 min = 2h45).
    const pdaTestBookings = await prisma.booking.findMany({
      where: {
        instructorId,
        bookingType: 'PDA_TEST',
        startTime: { gte: startOfDay, lte: endOfDay },
        status: { in: ['CONFIRMED', 'PENDING'] },
      } as any,
      select: { startTime: true, endTime: true, duration: true },
    });

    // 4. Get availability exceptions
    const exceptions = await prisma.availabilityException.findMany({
      where: {
        instructorId,
        exceptionDate: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      select: {
        startTime: true,
        endTime: true
      }
    })

    // 5. Generate all possible slots
    const availableSlots: Date[] = []

    for (const slot of daySlots) {
      const slotStart = parseTimeUTC(slot.start, dateStr)
      const slotEnd   = parseTimeUTC(slot.end,   dateStr)

      let currentTime = slotStart

      while (currentTime < slotEnd) {
        const slotEndTime = addMinutes(currentTime, lessonDurationMinutes)

        if (slotEndTime > slotEnd) break

        // Check if this slot conflicts with any regular booking (+ buffer after each booking)
        const hasBookingConflict = bookings.some(booking => {
          if (!booking.startTime || !booking.endTime) return false;
          const bufferedEnd = addMinutes(booking.endTime, effectiveGapMinutes);
          return this.hasTimeConflict(currentTime, slotEndTime, booking.startTime, bufferedEnd);
        });

        // Check if this slot conflicts with a PDA test block.
        const hasPDAConflict = pdaTestBookings.some(test => {
          if (!test.startTime) return false;
          const testDurationMins = (test as any).duration ?? 165;
          const testEnd = test.endTime ?? addMinutes(test.startTime, testDurationMins);
          const blockStart = addMinutes(test.startTime, -effectiveGapMinutes);
          return this.hasTimeConflict(currentTime, slotEndTime, blockStart, testEnd);
        });

        // Check if this slot conflicts with exceptions
        const hasExceptionConflict = exceptions.some(exception => {
          const exceptionStart = parseTimeUTC(exception.startTime, dateStr)
          const exceptionEnd   = parseTimeUTC(exception.endTime,   dateStr)
          return this.hasTimeConflict(currentTime, slotEndTime, exceptionStart, exceptionEnd)
        })

        if (!hasBookingConflict && !hasPDAConflict && !hasExceptionConflict) {
          availableSlots.push(new Date(currentTime))
        }

        currentTime = addMinutes(currentTime, 30)
      }
    }

    return availableSlots
  }

  private hasTimeConflict(
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date
  ): boolean {
    return (
      (start1 >= start2 && start1 < end2) ||
      (end1 > start2 && end1 <= end2) ||
      (start1 <= start2 && end1 >= end2)
    )
  }

  async checkDoubleBooking(
    instructorId: string,
    startTime: Date,
    endTime: Date,
    excludeBookingId?: string
  ): Promise<boolean> {
    const conflictingBooking = await prisma.booking.findFirst({
      where: {
        instructorId,
        id: excludeBookingId ? { not: excludeBookingId } : undefined,
        status: {
          in: ['PENDING', 'PENDING_PAYMENT', 'CONFIRMED']
        },
        OR: [
          {
            AND: [
              { startTime: { lte: startTime } },
              { endTime: { gt: startTime } }
            ]
          },
          {
            AND: [
              { startTime: { lt: endTime } },
              { endTime: { gte: endTime } }
            ]
          },
          {
            AND: [
              { startTime: { gte: startTime } },
              { endTime: { lte: endTime } }
            ]
          }
        ]
      }
    })

    return !!conflictingBooking
  }
}

export const availabilityService = new AvailabilityService()
