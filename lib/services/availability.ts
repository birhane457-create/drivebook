import { prisma } from '../prisma'
import { addMinutes, format, parse, isWithinInterval, isSameDay } from 'date-fns'

interface TimeSlot {
  start: string
  end: string
}

interface WorkingHours {
  [key: string]: TimeSlot[]
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
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

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
      const slotStart = parse(slot.start, 'HH:mm', date)
      const slotEnd = parse(slot.end, 'HH:mm', date)

      let currentTime = slotStart

      while (currentTime < slotEnd) {
        const slotEndTime = addMinutes(currentTime, lessonDurationMinutes)

        if (slotEndTime > slotEnd) break

        // Check if this slot conflicts with any regular booking (+ buffer after each booking)
        const hasBookingConflict = bookings.some(booking => {
          if (!booking.startTime || !booking.endTime) return false;
          // Extend the booking's end time by the buffer — no new slot can start within that window
          const bufferedEnd = addMinutes(booking.endTime, effectiveGapMinutes);
          return this.hasTimeConflict(currentTime, slotEndTime, booking.startTime, bufferedEnd);
        });

        // Check if this slot conflicts with a PDA test block.
        // Block = (testStart - bufferMinutes) through testEnd.
        // The buffer before the test ensures the instructor can finish their last lesson,
        // travel to the centre, and arrive on time.
        // The buffer after the test is handled automatically by the regular booking buffer
        // when the next lesson is booked.
        const hasPDAConflict = pdaTestBookings.some(test => {
          if (!test.startTime) return false;
          const testDurationMins = (test as any).duration ?? 165; // default 2h45
          const testEnd = test.endTime ?? addMinutes(test.startTime, testDurationMins);
          const blockStart = addMinutes(test.startTime, -effectiveGapMinutes);
          return this.hasTimeConflict(currentTime, slotEndTime, blockStart, testEnd);
        });

        // Check if this slot conflicts with exceptions
        const hasExceptionConflict = exceptions.some(exception => {
          const exceptionStart = parse(exception.startTime, 'HH:mm', date)
          const exceptionEnd = parse(exception.endTime, 'HH:mm', date)
          return this.hasTimeConflict(currentTime, slotEndTime, exceptionStart, exceptionEnd)
        })

        if (!hasBookingConflict && !hasPDAConflict && !hasExceptionConflict) {
          availableSlots.push(new Date(currentTime))
        }

        currentTime = addMinutes(currentTime, 30) // Check every 30 minutes
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
