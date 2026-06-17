import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { availabilityService } from '@/lib/services/availability'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  instructorId: z.string().min(1, 'Instructor ID required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  lessonDurationMinutes: z.coerce.number().min(30).max(480).default(60)
})

/**
 * GET /api/availability/slots
 * 
 * Returns available time slots for lesson booking on a specific day.
 * Respects instructor's:
 * - Working hours
 * - Booking buffer & travel time
 * - Existing bookings (lessons + PDA tests)
 * - Availability exceptions
 * - Google Calendar sync (if enabled)
 * 
 * Query params:
 * - instructorId: Instructor ID
 * - date: YYYY-MM-DD format
 * - lessonDurationMinutes: Duration of the lesson (default 60)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const query = querySchema.parse({
      instructorId: searchParams.get('instructorId'),
      date: searchParams.get('date'),
      lessonDurationMinutes: searchParams.get('lessonDurationMinutes')
    })

    // Verify instructor exists
    const instructor = await prisma.instructor.findUnique({
      where: { id: query.instructorId }
    })

    if (!instructor) {
      return NextResponse.json(
        { error: 'Instructor not found' },
        { status: 404 }
      )
    }

    // Parse date
    const date = new Date(query.date + 'T00:00:00Z')
    if (isNaN(date.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      )
    }

    // Get available slots using the availability service
    const availableSlots = await availabilityService.getAvailableSlots(
      query.instructorId,
      date,
      query.lessonDurationMinutes
    )

    return NextResponse.json({
      instructorId: query.instructorId,
      date: query.date,
      lessonDurationMinutes: query.lessonDurationMinutes,
      availableSlots: availableSlots.map(slot => ({
        startTime: slot.toISOString(),
        endTime: new Date(slot.getTime() + query.lessonDurationMinutes * 60 * 1000).toISOString()
      }))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error fetching availability slots:', error)
    return NextResponse.json(
      { error: 'Failed to fetch availability slots' },
      { status: 500 }
    )
  }
}
