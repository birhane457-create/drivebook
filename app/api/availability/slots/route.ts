import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { addMinutes, format, parse, startOfDay, endOfDay } from 'date-fns'


export const dynamic = 'force-dynamic';
interface TimeSlot {
  time: string
  available: boolean
  reason?: string
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const instructorId = searchParams.get('instructorId')
    const date = searchParams.get('date')
    const duration = parseInt(searchParams.get('duration') || '60')
    const excludeBookingId = searchParams.get('excludeBookingId') // For edit mode

    if (!instructorId || !date) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const selectedDate = new Date(date)
    const dayName = format(selectedDate, 'EEEE').toLowerCase()

    // Get instructor's working hours, buffer settings, and slot configuration
    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
      select: {
        workingHours: true,
        allowedDurations: true,
        bookingBufferMinutes: true,
        enableTravelTime: true,
        travelTimeMinutes: true
      }
    } as any) // Temporary type assertion until Prisma client is regenerated

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 })
    }

    // Use instructor's configuration or defaults
    const allowedDurations = (instructor as any).allowedDurations || [60, 120]
    const bookingBufferMinutes = (instructor as any).bookingBufferMinutes || 15
    const enableTravelTime = (instructor as any).enableTravelTime || false
    const travelTimeMinutes = (instructor as any).travelTimeMinutes || 10

    // Validate that requested duration is allowed by instructor
    if (!allowedDurations.includes(duration)) {
      return NextResponse.json({ 
        slots: [], 
        message: `This instructor does not offer ${duration}-minute lessons. Available durations: ${allowedDurations.join(', ')} minutes` 
      })
    }

    const workingHours = (instructor.workingHours as any) || {}
    const daySlots = workingHours[dayName] || []

    if (daySlots.length === 0) {
      return NextResponse.json({ slots: [], message: 'Instructor not available on this day' })
    }

    // Get all bookings for this day (including PENDING) with location data
    // Exclude the booking being edited if excludeBookingId is provided
    const bookingWhere: any = {
      instructorId,
      startTime: {
        gte: startOfDay(selectedDate),
        lte: endOfDay(selectedDate)
      },
      status: {
        in: ['PENDING', 'CONFIRMED']
      }
    }
    
    if (excludeBookingId) {
      bookingWhere.id = { not: excludeBookingId }
    }
    
    const bookings = await prisma.booking.findMany({
      where: bookingWhere,
      select: {
        startTime: true,
        endTime: true,
        status: true,
        pickupAddress: true
      },
      orderBy: {
        startTime: 'asc'
      }
    })

    // Get PDA tests for this day (if model exists)
    let pdaTests: any[] = []
    try {
      pdaTests = await prisma.pDATest.findMany({
        where: {
          instructorId,
          testDate: {
            gte: startOfDay(selectedDate),
            lte: endOfDay(selectedDate)
          }
        },
        select: {
          testDate: true,
          testTime: true
        }
      })
    } catch (error) {
      console.log('PDATest model not available or error fetching:', error)
    }

    // Get availability exceptions (if model exists)
    let exceptions: any[] = []
    try {
      if ((prisma as any).availabilityException) {
        exceptions = await (prisma as any).availabilityException.findMany({
          where: {
            instructorId,
            exceptionDate: {
              gte: startOfDay(selectedDate),
              lte: endOfDay(selectedDate)
            }
          },
          select: {
            startTime: true,
            endTime: true,
            reason: true
          }
        })
      }
    } catch (error) {
      console.log('AvailabilityException model not available or error fetching:', error)
    }

    // Build list of blocked time ranges
    const blockedRanges: Array<{ start: Date; end: Date; reason: string }> = []

    // Add bookings to blocked ranges WITH buffer and optional travel time
    bookings.forEach((booking) => {
      // Block the actual booking time
      blockedRanges.push({
        start: booking.startTime,
        end: booking.endTime,
        reason: booking.status === 'PENDING' ? 'Pending booking' : 'Booked'
      })

      // Always block buffer time after booking (for rest/paperwork)
      const bufferEnd = addMinutes(booking.endTime, bookingBufferMinutes)
      blockedRanges.push({
        start: booking.endTime,
        end: bufferEnd,
        reason: 'Transition time'
      })

      // Optionally block travel time (if instructor has it enabled)
      if (enableTravelTime && travelTimeMinutes) {
        blockedRanges.push({
          start: bufferEnd,
          end: addMinutes(bufferEnd, travelTimeMinutes),
          reason: 'Travel time to next location'
        })
      }
    })

    // Add PDA tests with buffer
    pdaTests.forEach(test => {
      const testDateTime = parse(test.testTime, 'HH:mm', test.testDate)
      blockedRanges.push({
        start: addMinutes(testDateTime, -120), // 2 hours before
        end: addMinutes(testDateTime, 60), // 1 hour after
        reason: 'PDA test scheduled'
      })
    })

    // Add exceptions
    exceptions.forEach(exception => {
      const exceptionStart = parse(exception.startTime, 'HH:mm', selectedDate)
      const exceptionEnd = parse(exception.endTime, 'HH:mm', selectedDate)
      blockedRanges.push({
        start: exceptionStart,
        end: exceptionEnd,
        reason: exception.reason || 'Unavailable'
      })
    })

    // Sort blocked ranges by start time
    blockedRanges.sort((a, b) => a.start.getTime() - b.start.getTime())

    // Determine slot interval (smallest allowed duration)
    const slotInterval = Math.min(...allowedDurations)

    // Calculate total buffer time (booking buffer + optional travel time)
    const totalBufferMinutes = bookingBufferMinutes + (enableTravelTime ? travelTimeMinutes : 0)

    // Generate time slots based on instructor's configuration
    const slots: TimeSlot[] = []

    for (const workSlot of daySlots) {
      const workStart = parse(workSlot.start, 'HH:mm', selectedDate)
      const workEnd = parse(workSlot.end, 'HH:mm', selectedDate)

      // Generate slots at the configured interval
      let currentTime = workStart
      
      while (currentTime < workEnd) {
        // Calculate when this slot would end (lesson + buffer)
        const slotEnd = addMinutes(currentTime, duration)
        const bufferEnd = addMinutes(slotEnd, totalBufferMinutes)
        
        // Check if slot + buffer fits within working hours
        if (bufferEnd > workEnd) {
          break
        }
        
        // Check if slot conflicts with any blocked ranges
        const hasConflict = blockedRanges.some(blocked => 
          // Check if there's any overlap between [currentTime, bufferEnd] and [blocked.start, blocked.end]
          (currentTime >= blocked.start && currentTime < blocked.end) ||
          (bufferEnd > blocked.start && bufferEnd <= blocked.end) ||
          (currentTime <= blocked.start && bufferEnd >= blocked.end)
        )
        
        if (!hasConflict) {
          slots.push({
            time: format(currentTime, 'HH:mm'),
            available: true
          })
        }
        
        // Move to next interval
        currentTime = addMinutes(currentTime, slotInterval)
      }
    }

    // Remove duplicates and sort
    const uniqueSlots = Array.from(
      new Map(slots.map(slot => [slot.time, slot])).values()
    ).sort((a, b) => a.time.localeCompare(b.time))

    return NextResponse.json({ slots: uniqueSlots, date, duration })
  } catch (error) {
    console.error('Get slots error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
