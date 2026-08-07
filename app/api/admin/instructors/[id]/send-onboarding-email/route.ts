import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ONBOARDING_SEQUENCE, sendOnboardingStep } from '@/lib/email/onboarding/sequence'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/instructors/[id]/send-onboarding-email
 *
 * Manually triggers any onboarding sequence email from the admin panel.
 * Uses the same template + sender + audit trail as the automatic sequence.
 *
 * Body: { stepId: string }
 *
 * Always sends even if the email was already sent (force=true).
 * Records triggeredBy admin user id so audit log shows who sent it manually.
 *
 * Examples:
 *   { stepId: "onboarding.setup" }      — resend the setup guide
 *   { stepId: "onboarding.bookings" }   — explain how bookings work
 *   { stepId: "onboarding.approved" }   — send approval email manually
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { stepId } = body as { stepId?: string }

    if (!stepId) {
      return NextResponse.json({ error: 'stepId is required' }, { status: 400 })
    }

    // Validate stepId is a known sequence step
    const step = ONBOARDING_SEQUENCE.find(s => s.id === stepId)
    if (!step) {
      return NextResponse.json({
        error: `Unknown stepId: ${stepId}`,
        validSteps: ONBOARDING_SEQUENCE.map(s => s.id),
      }, { status: 400 })
    }

    const instructor = await prisma.instructor.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        voiceLineStatus: true,
        subscriptionTier: true,
        user: { select: { email: true } },
      },
    })

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 })
    }
    if (!instructor.user?.email) {
      return NextResponse.json({ error: 'Instructor has no email address' }, { status: 422 })
    }

    const profile = {
      id: instructor.id,
      name: instructor.name,
      email: instructor.user.email,
      voiceLineStatus: instructor.voiceLineStatus ?? 'NONE',
      subscriptionTier: instructor.subscriptionTier ?? 'BASIC',
    }

    await sendOnboardingStep(profile, stepId, step.version, {
      force: true,                          // always send regardless of prior sends
      triggeredBy: session.user.id!,        // recorded in audit log
    })

    return NextResponse.json({
      success: true,
      message: `"${step.label}" sent to ${instructor.user.email}`,
      stepId,
      label: step.label,
      sentTo: instructor.user.email,
    })
  } catch (error) {
    console.error('[send-onboarding-email] Error:', error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
