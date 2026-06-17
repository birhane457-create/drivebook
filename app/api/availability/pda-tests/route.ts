import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { addMinutes, format, parse, startOfDay, endOfDay } from 'date-fns'

export const dynamic = 'force-dynamic'

interface TimeSlot {
  time: string
  available: boolean
  reason?: string
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const instructorId = searchParams.get('instructorId')
    const testCentreId = searchParams.get('testCentreId')
    const configId = searchParams.get('configId')
    const date = searchParams.get('date')

    if (!instructorId || !testCentreId || !configId || !date) {
      return NextResponse.json({
        error: 'Missing parameters: instructorId, testCentreId, configId, date'
      }, { status: 400 })
    }

    // Get PDA config to fetch duration
    const config = await prisma.pDATestConfig.findUnique({
      where: { id: configId }
    })

    if (!config) {
      return NextResponse.json({ error: 'PDA config not found' }, { status: 404 })
    }

    if (config.instructorId !== instructorId) {
      return NextResponse.json({ error: 'Config does not belong to this instructor' }, { status: 403 })
    }

    // Verify test centre is linked to this config
    const configWithCentres = await prisma.pDATestConfig.findUnique({
      where: { id: configId },
      include: { testCentres: { where: { id: testCentreId } } }
    })

    if (!configWithCentres || configWithCentres.testCentres.length === 0) {
      return NextResponse.json({
        error: 'This config is not offered at this test centre'
      }, { status: 404 })
    }

    const selectedDate = new Date(date)
    const dayName = format(selectedDate, 'EEEE').toLowerCase()
    const duration = config.durationMinutes

    // Get instructor's working hours and buffer settings
    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
      select: {
        workingHours: true,
        bookingBufferMinutes: true,
        enableTravelTime: true,
        travelTimeMinutes: true
      }
    })

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 })
    }

    const bookingBufferMinutes = (instructor as any).bookingBufferMinutes || 15
    const enableTravelTime = (instructor as any).enableTravelTime || false
    const travelTimeMinutes = (instructor as any).travelTimeMinutes || 10

    const workingHours = (instructor.workingHours as any) || {}

    // Normalize working hours
    function normalizeDaySlots(val: any): { start: string; end: string }[] {
      if (!val) return []
      if (Array.isArray(val)) return val.filter((s: any) => s?.start && s?.end)
      if (typeof val === 'object' && val.start && val.end && val.enabled !== false) return [{ start: val.start, end: val.end }]
      return []
    }

    const daySlots = normalizeDaySlots(workingHours[dayName])

    if (daySlots.length === 0) {
      return NextResponse.json({
        slots: [],
        message: 'Instructor not available on this day'
      })
    }

    // Get all bookings for this day (standard lessons that block PDA test time)
    const bookings = await prisma.booking.findMany({
      where: {
        instructorId,
        startTime: {
          gte: startOfDay(selectedDate),
          lte: endOfDay(selectedDate)
        },
        status: {
          in: ['PENDING', 'CONFIRMED']
        }
      },
      select: {
        startTime: true,
        endTime: true,
        status: true
      },
      orderBy: {
        startTime: 'asc'
      }
    })

    // Get all PDA test bookings for this day at this centre
    const pdaBookings = await prisma.pDATestBooking.findMany({
      where: {
        instructorId,
        testCentreId,
        testDate: {
          gte: startOfDay(selectedDate),
          lte: endOfDay(selectedDate)
        },
        status: {
          in: ['PENDING', 'CONFIRMED']
        }
      },
      select: {
        testDate: true,
        testTime: true,
        config: {
          select: {
            durationMinutes: true
          }
        }
      }
    })

    // Build blocked time ranges
    const blockedRanges: Array<{ start: Date; end: Date; reason: string }> = []

    // Add standard lesson bookings
    bookings.forEach((booking) => {
      if (!booking.startTime || !booking.endTime) return

      blockedRanges.push({
        start: booking.startTime,
        end: booking.endTime,
        reason: 'Standard lesson booked'
      })

      // Add buffer after lesson
      const bufferEnd = addMinutes(booking.endTime, bookingBufferMinutes)
      blockedRanges.push({
        start: booking.endTime,
        end: bufferEnd,
        reason: 'Transition time'
      })

      // Add travel time if enabled
      if (enableTravelTime && travelTimeMinutes) {
        blockedRanges.push({
          start: bufferEnd,
          end: addMinutes(bufferEnd, travelTimeMinutes),
          reason: 'Travel time'
        })
      }
    })

    // Add other PDA test bookings at this centre
    pdaBookings.forEach((booking: any) => {
      if (!booking.testTime) return

      const testDateTime = parse(booking.testTime, 'HH:mm', booking.testDate)
      const testDurationMinutes = booking.config.durationMinutes

      blockedRanges.push({
        start: testDateTime,
        end: addMinutes(testDateTime, testDurationMinutes),
        reason: 'Other PDA test scheduled'
      })

      // Add buffer after test
      const bufferEnd = addMinutes(testDateTime, testDurationMinutes + bookingBufferMinutes)
      blockedRanges.push({
        start: addMinutes(testDateTime, testDurationMinutes),
        end: bufferEnd,
        reason: 'Transition time'
      })
    })

    // Sort blocked ranges
    blockedRanges.sort((a, b) => a.start.getTime() - b.start.getTime())

    // Generate available time slots
    const slots: TimeSlot[] = []
    const slotInterval = 30 // Generate slots every 30 minutes

    for (const workSlot of daySlots) {
      const workStart = parse(workSlot.start, 'HH:mm', selectedDate)
      const workEnd = parse(workSlot.end, 'HH:mm', selectedDate)

      let currentTime = workStart

      while (currentTime < workEnd) {
        const slotEnd = addMinutes(currentTime, duration)

        // Check if slot fits within working hours
        if (slotEnd > workEnd) {
          break
        }

        // Check for conflicts with blocked ranges
        const hasConflict = blockedRanges.some(blocked =>
          (currentTime >= blocked.start && currentTime < blocked.end) ||
          (slotEnd > blocked.start && slotEnd <= blocked.end) ||
          (currentTime <= blocked.start && slotEnd >= blocked.end)
        )

        if (!hasConflict) {
          slots.push({
            time: format(currentTime, 'HH:mm'),
            available: true
          })
        }

        currentTime = addMinutes(currentTime, slotInterval)
      }
    }

    // Remove duplicates and sort
    const uniqueSlots = Array.from(
      new Map(slots.map(slot => [slot.time, slot])).values()
    ).sort((a, b) => a.time.localeCompare(b.time))

    // Get next available slot
    const nextAvailable = uniqueSlots.find(s => s.available)?.time ?? null

    return NextResponse.json({
      config: {
        id: config.id,
        name: config.name,
        durationMinutes: config.durationMinutes,
        price: config.price,
        discountPercent: config.discountPercent,
        includes: config.includes
      },
      testCentre: {
        id: testCentreId
      },
      slots: uniqueSlots,
      date,
      duration,
      nextAvailable
    })
  } catch (error) {
    console.error('Get PDA availability error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
