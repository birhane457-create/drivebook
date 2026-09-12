import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ONBOARDING_SEQUENCE, sendOnboardingStep } from '@/lib/extensions/driving/emails/onboarding-sequence'
import { requirePermission } from '@/lib/auth/requireRole'
import { PERM } from '@/lib/rbac/permissions'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const deny = await requirePermission(session, PERM.USERS_PROVIDERS_SEND_EMAIL)
    if (deny) return deny

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

    const instructor = await (prisma as any).provider.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        subscriptionTier: true,
        user: { select: { email: true, name: true } },
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
      voiceLineStatus: (instructor as any).voiceLineStatus ?? 'NONE',
      subscriptionTier: instructor.subscriptionTier ?? 'BASIC',
    }

    await sendOnboardingStep(profile, stepId, step.version, {
      force: true,                          // always send regardless of prior sends
      triggeredBy: session!.user!.id!,        // recorded in audit log
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
