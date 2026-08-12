import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ONBOARDING_SEQUENCE } from '@/lib/email/onboarding/sequence'
import { requirePermission } from '@/lib/auth/requireRole'
import { PERM } from '@/lib/rbac/permissions'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const deny = await requirePermission(session, PERM.USERS_INSTRUCTORS_VIEW)
    if (deny) return deny

    // Fetch all onboarding audit log entries for this instructor
    const logs = await prisma.auditLog.findMany({
      where: {
        action: 'ONBOARDING_EMAIL_SENT',
        targetType: 'INSTRUCTOR',
        targetId: params.id,
      },
      select: { metadata: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })

    // Build a map of emailId → latest log entry
    const sentMap = new Map<string, { sentAt: Date; skipped: boolean; version: number }>()
    for (const log of logs) {
      const meta = log.metadata as Record<string, unknown>
      const emailId = meta?.emailId as string
      if (emailId && !sentMap.has(emailId)) {
        sentMap.set(emailId, {
          sentAt: log.createdAt,
          skipped: !!(meta?.skipped),
          version: (meta?.version as number) ?? 1,
        })
      }
    }

    // Build status for each step in the sequence
    const steps = ONBOARDING_SEQUENCE.map(step => {
      const entry = sentMap.get(step.id)
      return {
        id: step.id,
        label: step.label,
        trigger: step.trigger,
        delayDays: step.delayDays,
        version: step.version,
        status: entry
          ? entry.skipped ? 'SKIPPED' : 'SENT'
          : 'PENDING',
        sentAt: entry?.sentAt ?? null,
      }
    })

    return NextResponse.json({ steps })
  } catch (error) {
    console.error('[onboarding-status] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
