import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { addMinutes } from 'date-fns'
import { formatLocalTime, localDateTimeToUTC, resolveTimezone } from '@/lib/utils/timezone'

export const dynamic = 'force-dynamic'

interface TimeSlot {
  time: string
  available: boolean
  reason?: string
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const providerId = searchParams.get('providerId')
    const testCentreId = searchParams.get('testCentreId')
    const configId = searchParams.get('configId')
    const date = searchParams.get('date')  // YYYY-MM-DD

    if (!providerId || !testCentreId || !configId || !date) {
      return NextResponse.json({
        error: 'Missing parameters: providerId, testCentreId, configId, date'
      }, { status: 400 })
    }

    // Get PDA config to fetch duration
    const config = await prisma.pDATestConfig.findUnique({
      where: { id: configId }
    })

    if (!config) {
      return NextResponse.json({ error: 'PDA config not found' }, { status: 404 })
    }

    if (config.providerId !== providerId) {
      return NextResponse.json({ error: 'Config does not belong to this instructor' }, { status: 403 })
    }

    // Verify test centre is linked to this config
    const configWithCentres = await prisma.pDATestConfig.findUnique({
      where: { id: configId },
      include: { testCentres: { where: { testCentreId: testCentreId } } }
    })

    if (!configWithCentres || configWithCentres.testCentres.length === 0) {
      return NextResponse.json({
        error: 'This config is not offered at this test centre'
      }, { status: 404 })
    }

    const instructor = await prisma.provider.findUnique({
      where: { id: providerId },
      select: {
        timezone: true,
        workingHours: true,
        bookingBufferMinutes: true,
        enableTravelTime: true,
        travelTimeMinutes: true
      }
    })

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 })
    }

    const timezone = resolveTimezone(instructor.timezone)
    const dayStart = localDateTimeToUTC(date, '00:00', timezone)
    const dayEnd = localDateTimeToUTC(date, '23:59', timezone)
    const dayName = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
    }).format(dayStart).toLowerCase()
    const duration = config.durationMinutes

    const bookingBufferMinutes = (instructor as any).bookingBufferMinutes || 15
    const enableTravelTime = (instructor as any).enableTravelTime || false
    const travelTimeMinutes = (instructor as any).travelTimeMinutes || 10

    const workingHours = (instructor.workingHours as any) || {}

    // Normalize working hours slot format
    function normalizeDaySlots(val: any): { start: string; end: string }[] {
      if (!val) return []
      if (Array.isArray(val)) return val.filter((s: any) => s?.start && s?.end)
      if (typeof val === 'object' && val.start && val.end && val.enabled !== false) return [{ start: val.start, end: val.end }]
      return []
    }

    const daySlots = normalizeDaySlots(workingHours[dayName])

    if (daySlots.length === 0) {
      return NextResponse.json({ slots: [], message: 'Instructor not available on this day' })
    }

    // Get all standard lesson bookings for this day
    // These are stored as UTC ISO datetimes — comparisons are TZ-safe
    const bookings = await prisma.booking.findMany({
      where: {
        providerId,
        startTime: { gte: dayStart, lte: dayEnd },
        status: { in: ['PENDING', 'CONFIRMED'] }
      },
      select: { startTime: true, endTime: true, status: true },
      orderBy: { startTime: 'asc' }
    }) as any[]

    // Get all PDA test bookings for this day at this centre
    const pdaBookings = await prisma.pDATestBooking.findMany({
      where: {
        providerId,
        testCentreId,
        testDate: { gte: dayStart, lte: dayEnd },
        status: { in: ['PENDING', 'CONFIRMED'] }
      },
      select: {
        testDate: true,
        testTime: true,
        config: { select: { durationMinutes: true } }
      }
    })

    // Build blocked time ranges (all as UTC Date objects)
    const blockedRanges: Array<{ start: Date; end: Date; reason: string }> = []

    bookings.forEach((booking: any) => {
      if (!booking.startTime || !booking.endTime) return
      blockedRanges.push({ start: booking.startTime, end: booking.endTime, reason: 'Standard lesson booked' })
      const bufferEnd = addMinutes(booking.endTime, bookingBufferMinutes)
      blockedRanges.push({ start: booking.endTime, end: bufferEnd, reason: 'Transition time' })
      if (enableTravelTime && travelTimeMinutes) {
        blockedRanges.push({ start: bufferEnd, end: addMinutes(bufferEnd, travelTimeMinutes), reason: 'Travel time' })
      }
    })

    pdaBookings.forEach((booking: any) => {
      if (!booking.testTime) return
      const testDateTime = localDateTimeToUTC(
        new Intl.DateTimeFormat('en-CA', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(booking.testDate),
        booking.testTime,
        timezone,
      )
      const testDurationMinutes = booking.config.durationMinutes
      const testEnd = addMinutes(testDateTime, testDurationMinutes)
      blockedRanges.push({ start: testDateTime, end: testEnd, reason: 'Other PDA test scheduled' })
      blockedRanges.push({ start: testEnd, end: addMinutes(testEnd, bookingBufferMinutes), reason: 'Transition time' })
    })

    blockedRanges.sort((a: any, b: any) => a.start.getTime() - b.start.getTime())

    // Generate available slots in UTC, converted from provider-local wall times
    const slots: TimeSlot[] = []
    const slotInterval = 30

    for (const workSlot of daySlots) {
      const workStart = localDateTimeToUTC(date, workSlot.start, timezone)
      const workEnd   = localDateTimeToUTC(date, workSlot.end, timezone)

      let currentTime = workStart

      while (currentTime < workEnd) {
        const slotEnd = addMinutes(currentTime, duration)
        if (slotEnd > workEnd) break

        const hasConflict = blockedRanges.some(blocked =>
          (currentTime >= blocked.start && currentTime < blocked.end) ||
          (slotEnd > blocked.start && slotEnd <= blocked.end) ||
          (currentTime <= blocked.start && slotEnd >= blocked.end)
        )

        if (!hasConflict) {
          slots.push({ time: formatLocalTime(currentTime, timezone), available: true })
        }

        currentTime = addMinutes(currentTime, slotInterval)
      }
    }

    const uniqueSlots = Array.from(
      new Map(slots.map(slot => [slot.time, slot])).values()
    ).sort((a: any, b: any) => a.time.localeCompare(b.time))

    return NextResponse.json({
      config: {
        id: config.id,
        name: config.name,
        durationMinutes: config.durationMinutes,
        price: config.price,
        discountPercent: config.discountPercent,
        includes: config.includes
      },
      testCentre: { id: testCentreId },
      slots: uniqueSlots,
      date,
      duration,
      nextAvailable: uniqueSlots.find(s => s.available)?.time ?? null
    })
  } catch (error) {
    console.error('Get PDA availability error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
