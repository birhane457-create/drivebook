import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emailService } from '@/lib/services/email'
import { pingCronHealth, failCronHealth } from '@/lib/services/cron-health'

export const dynamic = 'force-dynamic'

/**
 * Instructor Setup Nudge Cron
 * Runs daily at 9am UTC (7pm AEST).
 * Targets instructors who registered ~24h ago (between 23h and 49h ago)
 * and have NOT completed all 5 setup steps.
 *
 * The 23–49h window means every instructor is caught exactly once,
 * even if the cron fires a little late.
 *
 * Setup completion is evaluated as:
 *   1. Documents   — at least one doc field is non-null
 *   2. Rate/area   — hourlyRate > 0 AND (baseAddress is non-empty OR serviceRadiusKm set)
 *   3. Availability — workingHours is set (non-null JSON)
 *   4. Bio          — bio field is non-null and non-empty
 *   5. Stripe       — stripeAccountId is set AND chargesEnabled = true
 *
 * If all 5 are complete we still send a single "you're all set" email.
 * Set SKIP_COMPLETE_NUDGE=true in env to suppress that.
 *
 * Schedule: "0 9 * * *" in vercel.json
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const windowStart = new Date(now.getTime() - 49 * 60 * 60 * 1000) // 49h ago
    const windowEnd   = new Date(now.getTime() - 23 * 60 * 60 * 1000) // 23h ago

    // Fetch instructors who registered in the 23–49h window
    const users = await prisma.user.findMany({
      where: {
        role: 'INSTRUCTOR',
        createdAt: { gte: windowStart, lte: windowEnd },
        emailVerified: true,          // only email-verified accounts
        instructor: {
          approvalStatus: 'PENDING',  // only pending — approved instructors don't need the nudge
        },
      },
      select: {
        email: true,
        instructor: {
          select: {
            name: true,
            bio: true,
            hourlyRate: true,
            baseAddress: true,
            serviceRadiusKm: true,
            workingHours: true,
            stripeAccountId: true,
            chargesEnabled: true,
            // Document fields — any one being set counts as "uploaded"
            licenseImageFront: true,
            licenseImageBack: true,
            insurancePolicyDoc: true,
            policeCheckDoc: true,
            wwcCheckDoc: true,
            photoIdDoc: true,
            certificationDoc: true,
          },
        },
      },
    })

    let sent = 0
    let skipped = 0
    let failed = 0

    for (const user of users) {
      const inst = user.instructor
      if (!inst) { skipped++; continue }

      const steps = {
        documentsUploaded: !!(
          inst.licenseImageFront ||
          inst.licenseImageBack  ||
          inst.insurancePolicyDoc ||
          inst.policeCheckDoc ||
          inst.wwcCheckDoc ||
          inst.photoIdDoc ||
          inst.certificationDoc
        ),
        rateAndAreaSet: (inst.hourlyRate ?? 0) > 0 && (
          (inst.baseAddress != null && inst.baseAddress.trim().length > 0) ||
          (inst.serviceRadiusKm != null && inst.serviceRadiusKm > 0)
        ),
        availabilitySet: inst.workingHours != null,
        bioComplete: inst.bio != null && inst.bio.trim().length > 0,
        stripeConnected: !!(inst.stripeAccountId && inst.chargesEnabled),
      }

      const allDone = Object.values(steps).every(Boolean)

      // Optionally skip sending to fully-complete instructors
      if (allDone && process.env.SKIP_COMPLETE_NUDGE === 'true') {
        skipped++
        continue
      }

      try {
        await emailService.sendInstructorSetupEmail({
          instructorName: inst.name,
          instructorEmail: user.email,
          steps,
        })
        sent++
      } catch (err) {
        console.error(`[setup-nudge] Email failed for ${user.email}:`, err)
        failed++
      }
    }

    console.log(`✅ Instructor setup nudge: ${sent} sent, ${skipped} skipped, ${failed} failed, ${users.length} total`)
    await pingCronHealth('instructor-setup-nudge')
    return NextResponse.json({ success: true, sent, skipped, failed, total: users.length })
  } catch (error) {
    console.error('[setup-nudge] Cron error:', error)
    await failCronHealth('instructor-setup-nudge', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
