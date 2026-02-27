import { NextRequest, NextResponse } from 'next/server'
import { availabilityService } from '@/lib/services/availability'
import { z } from 'zod'

const availabilitySchema = z.object({
  instructorId: z.string(),
  date: z.string(),
  lessonDuration: z.number().optional()
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { instructorId, date, lessonDuration } = availabilitySchema.parse(body)

    const slots = await availabilityService.getAvailableSlots(
      instructorId,
      new Date(date),
      lessonDuration
    )

    return NextResponse.json({ slots })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Availability check error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
