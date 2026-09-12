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

// -- Availability slot cache (Gap 20) -----------------------------------------
// getAvailableSlots makes 4 DB round-trips per call. Under concurrent voice-AI
// booking traffic (multiple callers hitting the same instructor's slots at once)
// this becomes the first DB scaling bottleneck.
//
// Fix: 30-second in-process TTL cache keyed by providerId + date + duration.
// Cache is invalidated immediately when a booking is created or cancelled via
// invalidateAvailabilityCache(providerId, dateStr).
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

function cacheKey(providerId: string, dateStr: string, durationMinutes: number): string {
  return `${providerId}:${dateStr}:${durationMinutes}`;
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
export function invalidateAvailabilityCache(providerId: string, dateStr: string): void {
  const prefix = `${providerId}:${dateStr}:`;
  for (const key of availabilityCache.keys()) {
    if (key.startsWith(prefix)) availabilityCache.delete(key);
  }
}

/**
 * Validate and parse working hours from the DB JSON blob.
 * Returns the parsed WorkingHours if valid, or null if malformed.
 * Logs a specific error so the instructor can diagnose the issue.
 */
function parseWorkingHours(raw: unknown, providerId: string): WorkingHours | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    // This should not happen — settings route validates on write, but DB may have legacy data
    console.error(`[Availability] Invalid workingHours structure for instructor ${providerId}:`, typeof raw)
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
      console.error(`[Availability] workingHours.${day} is not an array for instructor ${providerId}`)
      return null
    }
    const parsedSlots: TimeSlot[] = []
    for (const slot of slots) {
      if (!slot || typeof slot !== 'object' || Array.isArray(slot)) {
        console.error(`[Availability] workingHours.${day} contains non-object slot for instructor ${providerId}:`, slot)
        return null
      }
      const s = slot as Record<string, unknown>
      if (typeof s.start !== 'string' || typeof s.end !== 'string') {
        console.error(`[Availability] workingHours.${day} slot missing start/end strings for instructor ${providerId}:`, slot)
        return null
      }
      if (!HH_MM_REGEX.test(s.start) || !HH_MM_REGEX.test(s.end)) {
        console.error(`[Availability] workingHours.${day} slot has invalid HH:MM format for instructor ${providerId}: start="${s.start}" end="${s.end}"`)
        return null
      }
      if (s.start >= s.end) {
        console.error(`[Availability] workingHours.${day} slot start >= end for instructor ${providerId}: "${s.start}" >= "${s.end}"`)
        return null
      }
      parsedSlots.push({ start: s.start, end: s.end })
    }
    validated[day] = parsedSlots
  }

  return validated
}

// Parse HH:mm string (instructor's local time) into a UTC Date for the given YYYY-MM-DD.
// Working hours are stored in the instructor's wall-clock timezone.
// Uses localDateTimeToUTC from the timezone utility so any AU timezone works correctly.
// Falls back to Perth (AWST = UTC+8) for instructors who haven't set their timezone.
import { localDateTimeToUTC, resolveTimezone, timezoneFromState, DEFAULT_TIMEZONE } from '@/lib/utils/timezone'

function parseTimeUTC(hhMm: string, dateStr: string, timezone = DEFAULT_TIMEZONE): Date {
  return localDateTimeToUTC(dateStr, hhMm, resolveTimezone(timezone))
}

export class AvailabilityService {
  async getAvailableSlots(
    providerId: string,
    date: Date,
    lessonDurationMinutes: number = 60
  ): Promise<Date[]> {
    const dateStr = date.toISOString().slice(0, 10);
    const key = cacheKey(providerId, dateStr, lessonDurationMinutes);

    // Return cached result if still fresh
    const cached = getCached(key);
    if (cached) return cached;

    // 1. Get instructor's working hours and buffer settings for this day
    const instructor = await prisma.provider.findUnique({
      where: { id: providerId },
      select: {
        workingHours: true,
        bookingBufferMinutes: true,
        enableTravelTime: true,
        travelTimeMinutes: true,
        timezone: true,
        state: true,
      }
    })

    if (!instructor) throw new Error('Instructor not found')

    const bufferMinutes = instructor.bookingBufferMinutes ?? 10;
    const travelMinutes = instructor.enableTravelTime ? (instructor.travelTimeMinutes ?? 0) : 0;
    const effectiveGapMinutes = Math.max(bufferMinutes, travelMinutes);

    // Resolve timezone: use stored value, fall back to state-derived, then Perth
    const instructorTz = resolveTimezone(instructor.timezone) !== DEFAULT_TIMEZONE
      ? resolveTimezone(instructor.timezone)
      : timezoneFromState((instructor as any).state ?? '')

    const dayName = format(date, 'EEEE').toLowerCase()

    // Validate working hours JSON — returns null if malformed, with a logged error
    const workingHours = parseWorkingHours(instructor.workingHours, providerId)
    if (!workingHours) {
      // Malformed working hours — return empty rather than crashing.
      // The error is already logged above so the instructor can diagnose it.
      return []
    }
    const daySlots = workingHours[dayName] || []

    if (daySlots.length === 0) return []

    // 2. Get existing bookings for this day
    // Use UTC day boundaries derived from the date's ISO string to avoid server TZ shifting
    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`)
    const endOfDay   = new Date(`${dateStr}T23:59:59.999Z`)

    const bookings = await prisma.booking.findMany({
      where: {
        providerId: providerId,
        startTime: { gte: startOfDay, lte: endOfDay },
        status: { in: ['PENDING', 'PENDING_PAYMENT', 'CONFIRMED'] },
      },
      select: { startTime: true, endTime: true }
    }) as any[]

    // 3. Load domain extension slot blocker data (if any extension is active).
    // The extension hook is called per-slot below. To keep it synchronous,
    // we pre-fetch the data the extension needs and attach it to the context.
    let extensionCtxData: Record<string, unknown> = {}
    try {
      const { getBusinessConfig } = await import('@/lib/core/business-config')
      const config = await getBusinessConfig({ providerId: providerId })
      if (config.domainExtension?.hooks?.additionalSlotBlocker) {
        // Pre-fetch any extension-specific blocking data.
        // Currently: PDA test bookings for driving extension.
        const pdaBookings = await prisma.booking.findMany({
          where: {
            providerId,
            bookingType: 'PDA_TEST' as any,
            startTime: { gte: startOfDay, lte: endOfDay },
            status: { in: ['CONFIRMED', 'PENDING'] },
          } as any,
          select: { startTime: true, duration: true },
        }) as any[]
        extensionCtxData.__drivingPDATests = pdaBookings
          .filter((b: any) => b.startTime)
          .map((b: any) => ({ startTime: b.startTime, duration: b.duration ?? 165 }))
      }
    } catch {
      // Extension data fetch failure is non-fatal — continue without it
    }

    // 4. Get availability exceptions
    const exceptions = await prisma.availabilityException.findMany({
      where: {
        providerId: providerId,
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

    // 5. Load the domain extension slot blocker hook (if active)
    let additionalSlotBlocker: ((slot: { start: Date; end: Date }, ctx: { providerId: string; date: Date; durationMinutes: number }) => boolean) | undefined
    try {
      const { getBusinessConfig } = await import('@/lib/core/business-config')
      const config = await getBusinessConfig({ providerId: providerId })
      additionalSlotBlocker = config.domainExtension?.hooks?.additionalSlotBlocker
    } catch {
      // Non-fatal
    }

    // 6. Generate all possible slots
    const availableSlots: Date[] = []

    for (const slot of daySlots) {
      const slotStart = parseTimeUTC(slot.start, dateStr, instructorTz)
      const slotEnd   = parseTimeUTC(slot.end,   dateStr, instructorTz)

      let currentTime = slotStart

      while (currentTime < slotEnd) {
        const slotEndTime = addMinutes(currentTime, lessonDurationMinutes)

        if (slotEndTime > slotEnd) break

        // Check conflict with regular bookings (+ gap buffer)
        const hasBookingConflict = bookings.some(booking => {
          if (!booking.startTime || !booking.endTime) return false
          const bufferedEnd = addMinutes(booking.endTime, effectiveGapMinutes)
          return this.hasTimeConflict(currentTime, slotEndTime, booking.startTime, bufferedEnd)
        })

        // Check conflict via domain extension hook (e.g. PDA tests for driving)
        const hasExtensionConflict = additionalSlotBlocker
          ? additionalSlotBlocker(
              { start: currentTime, end: slotEndTime },
              { providerId: providerId, date, durationMinutes: lessonDurationMinutes, ...extensionCtxData } as any
            )
          : false

        // Check conflict with availability exceptions
        const hasExceptionConflict = exceptions.some(exception => {
          const exceptionStart = parseTimeUTC(exception.startTime, dateStr, instructorTz)
          const exceptionEnd   = parseTimeUTC(exception.endTime,   dateStr, instructorTz)
          return this.hasTimeConflict(currentTime, slotEndTime, exceptionStart, exceptionEnd)
        })

        if (!hasBookingConflict && !hasExtensionConflict && !hasExceptionConflict) {
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
    providerId: string,
    startTime: Date,
    endTime: Date,
    excludeBookingId?: string
  ): Promise<boolean> {
    const conflictingBooking = await prisma.booking.findFirst({
      where: {
        providerId: providerId,
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
    }) as any

    return !!conflictingBooking
  }
}

export const availabilityService = new AvailabilityService()
