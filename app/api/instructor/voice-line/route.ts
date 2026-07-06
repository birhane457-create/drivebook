import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/instructor/voice-line
 *
 * Returns the authenticated instructor's voice line status.
 * Used by the instructor dashboard to display their assigned number.
 * Read-only — assignment is admin-only.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const instructor = await prisma.instructor.findFirst({
    where: session.user.instructorId
      ? { id: session.user.instructorId }
      : { userId: session.user.id },
    select: {
      id: true,
      name: true,
      voiceLine: true,
      voiceLineStatus: true,
      subscriptionTier: true,
      subscriptionStatus: true,
    },
  })

  if (!instructor) {
    return NextResponse.json({ error: 'Instructor not found' }, { status: 404 })
  }

  return NextResponse.json({
    voiceLine: instructor.voiceLine,
    voiceLineStatus: instructor.voiceLineStatus,
    subscriptionTier: instructor.subscriptionTier,
    subscriptionStatus: instructor.subscriptionStatus,
    // Formatted for display
    friendlyNumber: instructor.voiceLine
      ? instructor.voiceLine.replace(/^\+61(\d)/, '0$1').replace(/(\d{2})(\d{4})(\d{4})/, '$1 $2 $3')
      : null,
  })
}
