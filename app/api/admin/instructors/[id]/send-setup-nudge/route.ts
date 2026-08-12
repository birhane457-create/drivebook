import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emailService } from '@/lib/services/email'
import { requirePermission } from '@/lib/auth/requireRole'
import { PERM } from '@/lib/rbac/permissions'
import { enqueueNotification } from '@/lib/services/notificationRetry'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const deny = await requirePermission(session, PERM.USERS_INSTRUCTORS_SEND_EMAIL)
    if (deny) return deny
    const actorId = session!.user!.id!

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
        actorId: actorId,
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
