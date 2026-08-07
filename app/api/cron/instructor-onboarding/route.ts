import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pingCronHealth, failCronHealth } from '@/lib/services/cron-health'
import { ONBOARDING_SEQUENCE, sendOnboardingStep } from '@/lib/email/onboarding/sequence'

export const dynamic = 'force-dynamic'

/**
 * Instructor Onboarding Email Cron
 * Runs daily at 10am UTC (8pm AEST).
 *
 * Handles steps 2–5 of the onboarding sequence (time-based).
 * Step 1 (Welcome) is sent at registration.
 * Step 6 (Approved) is sent by the approve route.
 *
 * For each PENDING instructor:
 *   - Calculate which steps are due based on days since createdAt
 *   - Check deduplication via audit log
 *   - Send any due, unsent steps
 *
 * Window: each step fires when daysElapsed >= step.delayDays.
 * No upper bound — if a step was missed (e.g. email failed), it will
 * be retried on the next cron run.
 *
 * Schedule: "0 10 * * *" in vercel.json
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Cron steps only — excludes step 1 (registration) and step 6 (approval)
    const cronSteps = ONBOARDING_SEQUENCE.filter(s => s.trigger === 'cron')

    const now = new Date()

    // Fetch all PENDING instructors who have verified their email
    // We include emailVerified check — no point sending onboarding to unverified accounts
    const instructors = await prisma.instructor.findMany({
      where: {
        approvalStatus: 'PENDING',
        user: { emailVerified: true },
      },
      select: {
        id: true,
        name: true,
        voiceLineStatus: true,
        subscriptionTier: true,
        user: {
          select: { email: true, createdAt: true },
        },
      },
    })

    let sent = 0
    let skipped = 0
    let failed = 0

    for (const instructor of instructors) {
      if (!instructor.user?.email || !instructor.user.createdAt) continue

      const daysElapsed = Math.floor(
        (now.getTime() - new Date(instructor.user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      )

      const profile = {
        id: instructor.id,
        name: instructor.name,
        email: instructor.user.email,
        voiceLineStatus: instructor.voiceLineStatus,
        subscriptionTier: instructor.subscriptionTier,
      }

      for (const step of cronSteps) {
        if (daysElapsed < step.delayDays) continue   // not due yet

        try {
          const wasSent = await sendOnboardingStep(profile, step.id, step.version)
          if (wasSent) sent++
          else skipped++
        } catch (err) {
          console.error(`[onboarding-cron] Step ${step.id} failed for ${instructor.user.email}:`, err)
          failed++
        }
      }
    }

    console.log(`[onboarding-cron] sent=${sent} skipped=${skipped} failed=${failed} instructors=${instructors.length}`)
    await pingCronHealth('instructor-onboarding')
    return NextResponse.json({ success: true, sent, skipped, failed, instructors: instructors.length })
  } catch (error) {
    console.error('[onboarding-cron] Error:', error)
    await failCronHealth('instructor-onboarding', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
