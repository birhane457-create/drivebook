import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 86400000)
  const yesterdayEnd = todayStart
  const last7Days = new Date(now.getTime() - 7 * 86400000)
  const last30Days = new Date(now.getTime() - 30 * 86400000)
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000)

  try {
    const [
      ybCompleted,
      ybCancelled,
      ybRescheduled,
      ybNew,
      revenueYesterday,
      platformFeeYesterday,
      newStudents,
      newInstructors,
      stuckPayments,
      openDisputes,
      stripeIncomplete,
      expiringDocs,
      pendingApprovals,
      failedPayouts,
      bookingsThisWeek,
      bookingsLastWeek,
      revenueThisWeek,
      topInstructors,
    ] = await Promise.all([
      prisma.booking.count({
        where: { status: 'COMPLETED', updatedAt: { gte: yesterdayStart, lt: yesterdayEnd }, deletedAt: null } as any,
      }).catch(() => 0),

      prisma.booking.count({
        where: { status: 'CANCELLED', updatedAt: { gte: yesterdayStart, lt: yesterdayEnd }, deletedAt: null } as any,
      }).catch(() => 0),

      prisma.booking.count({
        where: { status: 'CONFIRMED', updatedAt: { gte: yesterdayStart, lt: yesterdayEnd }, createdAt: { lt: yesterdayStart }, deletedAt: null } as any,
      }).catch(() => 0),

      prisma.booking.count({
        where: { createdAt: { gte: yesterdayStart, lt: yesterdayEnd }, deletedAt: null } as any,
      }).catch(() => 0),

      prisma.walletTransaction.aggregate({
        where: { createdAt: { gte: yesterdayStart, lt: yesterdayEnd }, type: 'CREDIT' },
        _sum: { amount: true },
      }).catch(() => ({ _sum: { amount: 0 } })),

      prisma.transaction.aggregate({
        where: { createdAt: { gte: yesterdayStart, lt: yesterdayEnd }, status: 'SETTLED' },
        _sum: { platformFee: true },
      }).catch(() => ({ _sum: { platformFee: 0 } })),

      prisma.client.count({
        where: { createdAt: { gte: yesterdayStart, lt: yesterdayEnd } },
      }).catch(() => 0),

      prisma.instructor.count({
        where: { createdAt: { gte: yesterdayStart, lt: yesterdayEnd } } as any,
      }).catch(() => 0),

      // Stuck payments — include price for impact calculation
      prisma.booking.findMany({
        where: { status: 'PENDING_PAYMENT', createdAt: { lt: yesterdayStart }, deletedAt: null } as any,
        select: { id: true, price: true, createdAt: true, client: { select: { name: true } }, instructor: { select: { name: true } } },
        take: 20,
      }).catch(() => []),

      prisma.stripeDispute.findMany({
        where: { status: { in: ['warning_needs_response', 'needs_response', 'under_review'] } },
        select: { id: true, amount: true, status: true, createdAt: true, bookingId: true },
        take: 10,
      }).catch(() => []),

      // Stripe-incomplete instructors — include id for linking
      prisma.instructor.findMany({
        where: { approvalStatus: 'APPROVED', stripeAccountId: null },
        select: { id: true, name: true },
        take: 10,
      }).catch(() => []),

      prisma.instructor.findMany({
        where: {
          approvalStatus: 'APPROVED',
          OR: [
            { licenseExpiry: { gte: now, lte: thirtyDaysFromNow } },
            { insuranceExpiry: { gte: now, lte: thirtyDaysFromNow } },
          ],
        },
        select: { id: true, name: true, licenseExpiry: true, insuranceExpiry: true },
        take: 10,
      }).catch(() => []),

      prisma.instructor.findMany({
        where: { approvalStatus: 'PENDING' },
        select: { id: true, name: true },
        take: 10,
      }).catch(() => []),

      prisma.payout.findMany({
        where: { status: 'FAILED', createdAt: { gte: last30Days } },
        select: { id: true, amount: true, createdAt: true, instructor: { select: { name: true } } },
        take: 10,
      }).catch(() => []),

      prisma.booking.count({
        where: { createdAt: { gte: last7Days }, deletedAt: null } as any,
      }).catch(() => 0),

      prisma.booking.count({
        where: { createdAt: { gte: new Date(last7Days.getTime() - 7 * 86400000), lt: last7Days }, deletedAt: null } as any,
      }).catch(() => 0),

      prisma.walletTransaction.aggregate({
        where: { createdAt: { gte: last7Days }, type: 'CREDIT' },
        _sum: { amount: true },
      }).catch(() => ({ _sum: { amount: 0 } })),

      prisma.booking.groupBy({
        by: ['instructorId'],
        where: { status: 'COMPLETED', updatedAt: { gte: last7Days }, deletedAt: null } as any,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 3,
      }).catch(() => []),
    ])

    // ── Estimated impact: blocked payout for Stripe-incomplete instructors ──
    // Sum completed bookings (30d) for instructors without Stripe, as proxy for
    // how much revenue they cannot receive until onboarding is done.
    let stripeBlockedAmount = 0
    if (stripeIncomplete.length > 0) {
      const incompleteIds = stripeIncomplete.map((i: any) => i.id)
      const blockedAgg = await prisma.transaction.aggregate({
        where: {
          instructorId: { in: incompleteIds },
          createdAt: { gte: last30Days },
          status: { in: ['COMPLETED', 'SETTLED'] },
        },
        _sum: { instructorPayout: true },
      }).catch(() => ({ _sum: { instructorPayout: 0 } }))
      stripeBlockedAmount = Number(blockedAgg._sum?.instructorPayout ?? 0)
    }

    // ── Top performers ────────────────────────────────────────────────────────
    const topInstructorIds = topInstructors.map((t: any) => t.instructorId).filter(Boolean)
    const topInstructorDetails = topInstructorIds.length > 0
      ? await prisma.instructor.findMany({
          where: { id: { in: topInstructorIds } },
          select: { id: true, name: true },
        }).catch(() => [])
      : []

    const topPerformers = topInstructors.map((t: any) => ({
      name: topInstructorDetails.find((i: any) => i.id === t.instructorId)?.name ?? 'Unknown',
      completedLessons: t._count.id,
    }))

    // ── Attention items with estimatedImpact + action ─────────────────────────
    type AttentionItem = {
      type: string
      severity: 'high' | 'medium' | 'low'
      message: string
      link: string
      count?: number
      estimatedImpact: string | null
      action: string
    }

    const attentionItems: AttentionItem[] = []

    if (stuckPayments.length > 0) {
      const totalStuck = stuckPayments.reduce((sum: number, b: any) => sum + (b.price || 0), 0)
      attentionItems.push({
        type: 'stuck_payments',
        severity: 'high',
        message: `${stuckPayments.length} booking${stuckPayments.length > 1 ? 's' : ''} stuck in PENDING_PAYMENT for over 24 hours`,
        link: '/admin/bookings?status=PENDING_PAYMENT',
        count: stuckPayments.length,
        estimatedImpact: totalStuck > 0 ? `$${totalStuck.toFixed(0)} in revenue awaiting collection` : null,
        action: 'Chase students to top up wallets or cancel stale bookings',
      })
    }

    if (openDisputes.length > 0) {
      const totalDisputed = openDisputes.reduce((sum: number, d: any) => sum + (d.amount || 0), 0)
      attentionItems.push({
        type: 'open_disputes',
        severity: 'high',
        message: `${openDisputes.length} open dispute${openDisputes.length > 1 ? 's' : ''} require a response`,
        link: '/admin/disputes',
        count: openDisputes.length,
        estimatedImpact: totalDisputed > 0 ? `$${(totalDisputed / 100).toFixed(0)} at risk of chargeback loss` : null,
        action: 'Submit evidence before Stripe deadlines to protect revenue',
      })
    }

    if (failedPayouts.length > 0) {
      const totalFailed = failedPayouts.reduce((sum: number, p: any) => sum + (p.amount || 0), 0)
      attentionItems.push({
        type: 'failed_payouts',
        severity: 'high',
        message: `${failedPayouts.length} payout${failedPayouts.length > 1 ? 's' : ''} failed in the last 30 days`,
        link: '/admin/payouts',
        count: failedPayouts.length,
        estimatedImpact: totalFailed > 0 ? `$${(totalFailed / 100).toFixed(0)} owed to instructors not delivered` : null,
        action: 'Retry failed payouts or contact instructors to update bank details',
      })
    }

    if (stripeIncomplete.length > 0) {
      attentionItems.push({
        type: 'stripe_incomplete',
        severity: 'medium',
        message: `${stripeIncomplete.length} approved instructor${stripeIncomplete.length > 1 ? 's' : ''} haven't completed Stripe onboarding`,
        link: '/admin/payouts',
        count: stripeIncomplete.length,
        estimatedImpact: stripeBlockedAmount > 0
          ? `~$${stripeBlockedAmount.toFixed(0)} in earnings blocked until onboarding is complete`
          : `${stripeIncomplete.length} instructor${stripeIncomplete.length > 1 ? 's' : ''} unable to receive payouts`,
        action: 'Contact instructors to complete Stripe Connect onboarding',
      })
    }

    if (pendingApprovals.length > 0) {
      attentionItems.push({
        type: 'pending_approvals',
        severity: 'medium',
        message: `${pendingApprovals.length} instructor${pendingApprovals.length > 1 ? 's' : ''} awaiting approval`,
        link: '/admin/instructors?status=PENDING',
        count: pendingApprovals.length,
        estimatedImpact: `${pendingApprovals.length} instructor${pendingApprovals.length > 1 ? 's' : ''} blocked from taking bookings`,
        action: 'Review applications and approve or reject',
      })
    }

    if (expiringDocs.length > 0) {
      attentionItems.push({
        type: 'expiring_docs',
        severity: 'medium',
        message: `${expiringDocs.length} instructor${expiringDocs.length > 1 ? 's' : ''} have documents expiring within 30 days`,
        link: '/admin/documents',
        count: expiringDocs.length,
        estimatedImpact: 'Expired documents will trigger automatic suspension',
        action: 'Notify instructors to upload renewed documents now',
      })
    }

    // ── Week-over-week trend ──────────────────────────────────────────────────
    const bookingTrend = bookingsLastWeek > 0
      ? Math.round(((bookingsThisWeek - bookingsLastWeek) / bookingsLastWeek) * 100)
      : null

    const summary = {
      generatedAt: now.toISOString(),
      period: {
        from: yesterdayStart.toISOString(),
        to: yesterdayEnd.toISOString(),
        label: 'Yesterday',
      },
      yesterday: {
        bookingsCompleted: ybCompleted,
        bookingsCancelled: ybCancelled,
        bookingsRescheduled: ybRescheduled,
        bookingsNew: ybNew,
        revenueCollected: Number(revenueYesterday._sum?.amount ?? 0),
        platformFee: Number(platformFeeYesterday._sum?.platformFee ?? 0),
        newStudents,
        newInstructors,
      },
      weeklyTrend: {
        bookingsThisWeek,
        bookingsLastWeek,
        bookingChangePercent: bookingTrend,
        revenueThisWeek: Number(revenueThisWeek._sum?.amount ?? 0),
      },
      topPerformers,
      attentionItems,
      attentionCount: attentionItems.length,
      details: {
        stuckPayments: stuckPayments.slice(0, 5),
        openDisputes: openDisputes.slice(0, 5),
        pendingApprovals: pendingApprovals.slice(0, 5),
        stripeIncomplete: stripeIncomplete.slice(0, 5),
        expiringDocs: expiringDocs.slice(0, 5),
      },
    }

    return NextResponse.json(summary)
  } catch (error) {
    console.error('[daily-summary] error:', error)
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
  }
}
