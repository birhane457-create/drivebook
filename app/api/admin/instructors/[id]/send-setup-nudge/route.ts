import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emailService } from '@/lib/services/email'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/instructors/[id]/send-setup-nudge
 *
 * Manually triggers the instructor setup nudge email from the admin panel.
 * Fetches live DB state to compute step completion — same logic as the cron.
 * Logs to audit_log so admins can see when nudges were sent and by whom.
 *
 * Unlike the cron, this has no 24h window restriction and can be sent at any time.
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

    const instructor = await prisma.instructor.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        bio: true,
        hourlyRate: true,
        baseAddress: true,
        serviceRadiusKm: true,
        workingHours: true,
        stripeAccountId: true,
        chargesEnabled: true,
        licenseImageFront: true,
        licenseImageBack: true,
        insurancePolicyDoc: true,
        policeCheckDoc: true,
        wwcCheckDoc: true,
        user: {
          select: { email: true, emailVerified: true }
        },
      },
    })

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 })
    }

    if (!instructor.user?.email) {
      return NextResponse.json({ error: 'Instructor has no email address' }, { status: 422 })
    }

    // Compute step completion — same logic as the cron
    const steps = {
      documentsUploaded: !!(
        instructor.licenseImageFront ||
        instructor.licenseImageBack  ||
        instructor.insurancePolicyDoc ||
        instructor.policeCheckDoc ||
        instructor.wwcCheckDoc
      ),
      rateAndAreaSet: (instructor.hourlyRate ?? 0) > 0 && (
        (instructor.baseAddress != null && instructor.baseAddress.trim().length > 0) ||
        (instructor.serviceRadiusKm != null && instructor.serviceRadiusKm > 0)
      ),
      availabilitySet: instructor.workingHours != null,
      bioComplete: instructor.bio != null && instructor.bio.trim().length > 0,
      stripeConnected: !!(instructor.stripeAccountId && instructor.chargesEnabled),
    }

    await emailService.sendInstructorSetupEmail({
      instructorName: instructor.name,
      instructorEmail: instructor.user.email,
      steps,
    })

    // Audit log — tracks who sent the nudge and when
    await prisma.auditLog.create({
      data: {
        action: 'ADMIN_SETUP_NUDGE_SENT',
        actorId: session.user.id!,
        actorRole: 'ADMIN',
        targetType: 'INSTRUCTOR',
        targetId: params.id,
        success: true,
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
        metadata: {
          sentTo: instructor.user.email,
          steps,
          completedCount: Object.values(steps).filter(Boolean).length,
        } as any,
      },
    })

    const completedCount = Object.values(steps).filter(Boolean).length
    return NextResponse.json({
      success: true,
      message: `Setup nudge sent to ${instructor.user.email}`,
      completedCount,
      totalSteps: 5,
    })
  } catch (error) {
    console.error('[send-setup-nudge] Error:', error)
    return NextResponse.json({ error: 'Failed to send nudge email' }, { status: 500 })
  }
}
