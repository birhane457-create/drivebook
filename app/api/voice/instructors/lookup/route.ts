import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/voice/instructors/lookup?phone=+61894001234
 *
 * Internal endpoint — called exclusively by the voice service (drivebook-hybrid)
 * to resolve which instructor owns a dialled Twilio number.
 *
 * Auth: VOICE_SERVICE_API_KEY header (x-api-key).
 * Never exposed to the public or to the AI agent.
 *
 * Returns the instructor's profile fields needed to:
 *   1. Confirm the dedicated line greeting ("Hi, you've reached [Name]'s booking line")
 *   2. Pre-load the system prompt context for this instructor
 *
 * Returns 404 if no instructor owns that number — voice service falls back
 * to the general DriveBook line greeting.
 *
 * Lookup is by Instructor.voiceLine (the assigned Twilio number),
 * NOT by Instructor.phone (the instructor's personal mobile).
 *
 * Only returns instructors with voiceLineStatus = ACTIVE.
 * SUSPENDED lines return 404 so the call falls to the general line.
 */
export async function GET(req: NextRequest) {
  // Voice service auth
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.VOICE_SERVICE_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const phone = req.nextUrl.searchParams.get('phone')
  if (!phone) {
    return NextResponse.json({ error: 'Missing phone parameter' }, { status: 400 })
  }

  const instructor = await prisma.instructor.findFirst({
    where: {
      voiceLine: phone,
      voiceLineStatus: 'ACTIVE', // SUSPENDED lines fall to general line
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      hourlyRate: true,
      serviceAreas: true,
      baseLatitude: true,
      baseLongitude: true,
      serviceRadiusKm: true,
      copilotAgentEndpoint: true,
      voiceLine: true,
      voiceLineStatus: true,
      subscriptionTier: true,
    },
  })

  if (!instructor) {
    return NextResponse.json({ error: 'No active instructor found for this number' }, { status: 404 })
  }

  return NextResponse.json(instructor)
}
