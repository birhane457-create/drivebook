import { prisma } from '../prisma'
import { addMinutes, format } from 'date-fns'

interface TimeSlot {
  start: string
  end: string
}

interface WorkingHours {
  [key: string]: TimeSlot[]
}

// HH:MM format regex — Perth wall-clock time (AWST, no DST)
const HH_MM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

// ── Availability slot cache (Gap 20) ─────────────────────────────────────────
// getAvailableSlots makes 4 DB round-trips per call. Under concurrent voice-AI
// booking traffic (multiple callers hitting the same instructor's slots at once)
// this becomes the first DB scaling bottleneck.
//
// Fix: 30-second in-process TTL cache keyed by instructorId + date + duration.
// Cache is invalidated immediately when a booking is created or cancelled via
// invalidateAvailabilityCache(instructorId, dateStr).
//
// Production with multiple Vercel instances: each instance has its own cache
// (acceptable — 30s TTL means at worst a caller sees a 30s-stale list of slots,
// and the createBooking endpoint still double-checks availability before confirming).
// For Redis-backed cross-instance invalidation, replace the Map with ioredis/Upstash.

interface CacheEntry {
  slots: Date[];
  expiresAt: number;
}

const CACHE_TTL_MS = 30_000; // 30 seconds
const availabilityCache = new Map<string, CacheEntry>();

function cacheKey(instructorId: string, dateStr: string, durationMinutes: number): string {
  return `${instructorId}:${dateStr}:${durationMinutes}`;
}

function getCached(key: string): Date[] | null {
  const entry = availabilityCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    availabilityCache.delete(key);
    return null;
  }
  return entry.slots;
}

function setCached(key: string, slots: Date[]): void {
  availabilityCache.set(key, { slots, expiresAt: Date.now() + CACHE_TTL_MS });
  // Evict expired entries periodically (1% chance) to prevent unbounded memory growth
  if (Math.random() < 0.01) {
    const now = Date.now();
    for (const [k, v] of availabilityCache.entries()) {
      if (now > v.expiresAt) availabilityCache.delete(k);
    }
  }
}

/**
 * Invalidate availability cache for an instructor on a specific date.
 * Call this after creating, confirming, cancelling, or rescheduling a booking.
 * Clears all duration variants for that instructor+date.
 */
export function invalidateAvailabilityCache(instructorId: string, dateStr: string): void {
  const prefix = `${instructorId}:${dateStr}:`;
  for (const key of availabilityCache.keys()) {
    if (key.startsWith(prefix)) availabilityCache.delete(key);
  }
}

/**
 * Validate and parse working hours from the DB JSON blob.
 * Returns the parsed WorkingHours if valid, or null if malformed.
 * Logs a specific error so the instructor can diagnose the issue.
 */
function parseWorkingHours(raw: unknown, instructorId: string): WorkingHours | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    // This should not happen — settings route validates on write, but DB may have legacy data
    console.error(`[Availability] Invalid workingHours structure for instructor ${instructorId}:`, typeof raw)
    return null
  }

  const hours = raw as Record<string, unknown>
  const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const validated: WorkingHours = {}

  for (const day of DAYS) {
    const slots = hours[day]
    if (slots === undefined || slots === null) {
      validated[day] = []
      continue
    }
    if (!Array.isArray(slots)) {
      console.error(`[Availability] workingHours.${day} is not an array for instructor ${instructorId}`)
      return null
    }
    const parsedSlots: TimeSlot[] = []
    for (const slot of slots) {
      if (!slot || typeof slot !== 'object' || Array.isArray(slot)) {
        console.error(`[Availability] workingHours.${day} contains non-object slot for instructor ${instructorId}:`, slot)
        return null
      }
      const s = slot as Record<string, unknown>
      if (typeof s.start !== 'string' || typeof s.end !== 'string') {
        console.error(`[Availability] workingHours.${day} slot missing start/end strings for instructor ${instructorId}:`, slot)
        return null
      }
      if (!HH_MM_REGEX.test(s.start) || !HH_MM_REGEX.test(s.end)) {
        console.error(`[Availability] workingHours.${day} slot has invalid HH:MM format for instructor ${instructorId}: start="${s.start}" end="${s.end}"`)
        return null
      }
      if (s.start >= s.end) {
        console.error(`[Availability] workingHours.${day} slot start >= end for instructor ${instructorId}: "${s.start}" >= "${s.end}"`)
        return null
      }
      parsedSlots.push({ start: s.start, end: s.end })
    }
    validated[day] = parsedSlots
  }

  return validated
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
    const dateStr = date.toISOString().slice(0, 10);
    const key = cacheKey(instructorId, dateStr, lessonDurationMinutes);

    // Return cached result if still fresh
    const cached = getCached(key);
    if (cached) return cached;

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

    // Validate working hours JSON — returns null if malformed, with a logged error
    const workingHours = parseWorkingHours(instructor.workingHours, instructorId)
    if (!workingHours) {
      // Malformed working hours — return empty rather than crashing.
      // The error is already logged above so the instructor can diagnose it.
      return []
    }
    const daySlots = workingHours[dayName] || []

    if (daySlots.length === 0) return []

    // 2. Get existing bookings for this day (excluding PDA tests — handled separately)
    // Use UTC day boundaries derived from the date's ISO string to avoid server TZ shifting
    // dateStr is already defined above (used for cache key)
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

    // Store in cache before returning
    setCached(key, availableSlots);
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
