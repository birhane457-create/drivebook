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
    // 1. Get instructor's working hours for this day
    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
      select: { workingHours: true }
    })

    if (!instructor) throw new Error('Instructor not found')

    const dayName = format(date, 'EEEE').toLowerCase()
    const workingHours = (instructor.workingHours as unknown) as WorkingHours
    const daySlots = workingHours[dayName] || []

    if (daySlots.length === 0) return []

    // 2. Get existing bookings for this day
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    const bookings = await prisma.booking.findMany({
      where: {
        instructorId,
        startTime: {
          gte: startOfDay,
          lte: endOfDay
        },
        status: {
          in: ['PENDING', 'CONFIRMED']
        }
      },
      select: {
        startTime: true,
        endTime: true
      }
    })

    // 3. Get PDA tests and their 2-hour prep blocks
    const pdaTests = await prisma.pDATest.findMany({
      where: {
        instructorId,
        testDate: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      select: {
        testDate: true,
        testTime: true
      }
    })

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

        // Check if this slot conflicts with any booking
        const hasBookingConflict = bookings.some(booking => 
          this.hasTimeConflict(currentTime, slotEndTime, booking.startTime, booking.endTime)
        )

        // Check if this slot conflicts with PDA test prep time
        const hasPDAConflict = pdaTests.some(test => {
          const testDateTime = this.parseTestDateTime(test.testDate, test.testTime)
          const prepStart = addMinutes(testDateTime, -120) // 2 hours before
          const prepEnd = addMinutes(testDateTime, 60) // 1 hour after
          return this.hasTimeConflict(currentTime, slotEndTime, prepStart, prepEnd)
        })

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

  private parseTestDateTime(testDate: Date, testTime: string): Date {
    return parse(testTime, 'HH:mm', testDate)
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
          in: ['PENDING', 'CONFIRMED']
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
