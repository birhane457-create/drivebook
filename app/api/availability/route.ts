import { NextRequest, NextResponse } from 'next/server'
import { availabilityService } from '@/lib/services/availability'
import { withVoiceServiceAuth } from '@/lib/middleware/voiceServiceAuth'
import { z } from 'zod'

const availabilitySchema = z.object({
  providerId: z.string(),
  date: z.string(),
  lessonDuration: z.number().optional()
})

async function handler(req: NextRequest) {
  try {
    const body = await req.json()
    const { providerId, date, lessonDuration } = availabilitySchema.parse(body)

    const slots = await availabilityService.getAvailableSlots(
      providerId,
      new Date(`${date}T00:00:00.000Z`),
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

// PH4-AV-01 FIX: Require voice service authentication on POST.
// The hybrid gateway (drivebook-hybrid) applies VAPI secret verification before
// proxying requests to this endpoint, but the main app was accepting direct
// unauthenticated POST requests, bypassing the gateway entirely.
// withVoiceServiceAuth validates VOICE_SERVICE_API_KEY (x-api-key header).
export const POST = withVoiceServiceAuth(handler)
