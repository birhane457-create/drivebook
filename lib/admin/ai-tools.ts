/**
 * Whitelisted read-only tool functions for the Admin AI Chat.
 *
 * SECURITY CONTRACT:
 *   - Every function here is read-only. No mutations.
 *   - No raw Prisma query construction from user input.
 *   - No arbitrary SQL.
 *   - The AI can only call functions in this file.
 *   - Each function returns sanitised JSON — no raw DB objects.
 *
 * Adding a new tool requires:
 *   1. A function here
 *   2. An entry in TOOL_DEFINITIONS (OpenAI function schema)
 *   3. A case in callTool()
 */

import { prisma } from '@/lib/prisma'

// ─────────────────────────────────────────────────────────────────────────────
// Tool result type
// ─────────────────────────────────────────────────────────────────────────────
export type ToolResult = Record<string, unknown>

// ─────────────────────────────────────────────────────────────────────────────
// 1. getDailySummary
// ─────────────────────────────────────────────────────────────────────────────
export async function getDailySummary(): Promise<ToolResult> {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 86400000)
  const last7 = new Date(now.getTime() - 7 * 86400000)
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000)

  const [completed, cancelled, newBookings, newStudents, stuckCount, disputeCount, pendingCount, expiringCount] =
    await Promise.all([
      prisma.booking.count({ where: { status: 'COMPLETED', updatedAt: { gte: yesterdayStart, lt: todayStart }, deletedAt: null } as any }).catch(() => 0),
      prisma.booking.count({ where: { status: 'CANCELLED', updatedAt: { gte: yesterdayStart, lt: todayStart }, deletedAt: null } as any }).catch(() => 0),
      prisma.booking.count({ where: { createdAt: { gte: yesterdayStart, lt: todayStart }, deletedAt: null } as any }).catch(() => 0),
      prisma.client.count({ where: { createdAt: { gte: yesterdayStart, lt: todayStart } } }).catch(() => 0),
      prisma.booking.count({ where: { status: 'PENDING_PAYMENT', createdAt: { lt: yesterdayStart }, deletedAt: null } as any }).catch(() => 0),
      (prisma as any).stripeDispute.count({ where: { status: { in: ['needs_response', 'warning_needs_response', 'under_review'] } } }).catch(() => 0),
      prisma.instructor.count({ where: { approvalStatus: 'PENDING' } }).catch(() => 0),
      prisma.instructor.count({
        where: { approvalStatus: 'APPROVED', OR: [{ licenseExpiry: { gte: now, lte: thirtyDaysFromNow } }, { insuranceExpiry: { gte: now, lte: thirtyDaysFromNow } }] },
      }).catch(() => 0),
    ])

  const weekRevAgg = await (prisma as any).walletTransaction.aggregate({
    where: { createdAt: { gte: last7 }, type: 'CREDIT' },
    _sum: { amount: true },
  }).catch(() => ({ _sum: { amount: 0 } }))

  return {
    yesterday: { completed, cancelled, newBookings, newStudents },
    weekRevenue: Number(weekRevAgg._sum?.amount ?? 0),
    openIssues: { stuckPayments: stuckCount, openDisputes: disputeCount, pendingApprovals: pendingCount, expiringDocs: expiringCount },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. getHealthScore
// ─────────────────────────────────────────────────────────────────────────────
export async function getHealthScore(): Promise<ToolResult> {
  const now = new Date()
  const last30 = new Date(now.getTime() - 30 * 86400000)
  const last7 = new Date(now.getTime() - 7 * 86400000)
  const prev7 = new Date(now.getTime() - 14 * 86400000)

  const [completed, finalized, failedPayments, approved, stripeComplete, openDisputes, tw, lw, failedPayouts, totalPayouts] =
    await Promise.all([
      prisma.booking.count({ where: { status: 'COMPLETED', updatedAt: { gte: last30 }, deletedAt: null } as any }).catch(() => 0),
      prisma.booking.count({ where: { status: { in: ['COMPLETED', 'CANCELLED', 'NO_SHOW'] }, updatedAt: { gte: last30 }, deletedAt: null } as any }).catch(() => 0),
      prisma.booking.count({ where: { status: 'PENDING_PAYMENT', createdAt: { gte: last30 }, deletedAt: null } as any }).catch(() => 0),
      prisma.instructor.count({ where: { approvalStatus: 'APPROVED' } }).catch(() => 0),
      prisma.instructor.count({ where: { approvalStatus: 'APPROVED', stripeAccountId: { not: null }, chargesEnabled: true } }).catch(() => 0),
      (prisma as any).stripeDispute.count({ where: { status: { in: ['needs_response', 'warning_needs_response', 'under_review'] } } }).catch(() => 0),
      (prisma as any).walletTransaction.aggregate({ where: { createdAt: { gte: last7 }, type: 'CREDIT' }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: 0 } })),
      (prisma as any).walletTransaction.aggregate({ where: { createdAt: { gte: prev7, lt: last7 }, type: 'CREDIT' }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: 0 } })),
      (prisma as any).payout.count({ where: { status: 'FAILED', createdAt: { gte: last30 } } }).catch(() => 0),
      (prisma as any).payout.count({ where: { createdAt: { gte: last30 } } }).catch(() => 0),
    ])

  const completionRate = finalized > 0 ? Math.round((completed / finalized) * 100) : 100
  const onboardingRate = approved > 0 ? Math.round((stripeComplete / approved) * 100) : 100
  const thisWeek = Number(tw._sum?.amount ?? 0)
  const lastWeek = Number(lw._sum?.amount ?? 0)
  const revChange = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : 0
  const payoutFailRate = totalPayouts > 0 ? Math.round((failedPayouts / totalPayouts) * 100) : 0

  // Approximate score
  const score = Math.min(100, Math.max(0,
    Math.round(completionRate * 0.25) +
    Math.round(Math.max(0, 20 - (failedPayments > 0 ? 20 : 0))) +
    Math.round(Math.max(0, 20 - openDisputes * 5)) +
    Math.round(onboardingRate * 0.15) +
    Math.min(10, Math.max(0, 5 + revChange * 0.25)) +
    Math.round(Math.max(0, 10 - payoutFailRate * 0.5))
  ))

  return {
    score,
    status: score >= 90 ? 'healthy' : score >= 70 ? 'watch' : 'critical',
    signals: { completionRate, onboardingRate, openDisputes, revChangePercent: revChange, payoutFailRate },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. getInstructorRisk — top N at-risk instructors
// ─────────────────────────────────────────────────────────────────────────────
export async function getInstructorRisk(args: { limit?: number; minScore?: number }): Promise<ToolResult> {
  const limit = Math.min(20, args.limit ?? 5)
  const minScore = args.minScore ?? 30

  const now = new Date()
  const last30 = new Date(now.getTime() - 30 * 86400000)
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000)

  const instructors = await prisma.instructor.findMany({
    where: { approvalStatus: 'APPROVED' },
    select: { id: true, name: true, stripeAccountId: true, chargesEnabled: true, licenseExpiry: true, insuranceExpiry: true, wwcCheckExpiry: true },
  })

  const [cancellations, disputes] = await Promise.all([
    prisma.booking.groupBy({
      by: ['instructorId'],
      where: { status: 'CANCELLED', updatedAt: { gte: last30 }, deletedAt: null } as any,
      _count: { id: true },
    }).catch(() => []),
    (prisma as any).stripeDispute.groupBy({
      by: ['instructorId'],
      where: { instructorId: { in: instructors.map(i => i.id) }, status: { in: ['needs_response', 'warning_needs_response', 'under_review'] } },
      _count: { id: true },
    }).catch(() => []),
  ])

  const cancelMap: Record<string, number> = {}
  for (const r of cancellations as any[]) cancelMap[r.instructorId] = r._count.id
  const disputeMap: Record<string, number> = {}
  for (const r of disputes as any[]) if (r.instructorId) disputeMap[r.instructorId] = r._count.id

  const scored = instructors.map(inst => {
    let score = 0
    const flags: string[] = []
    const cancels = cancelMap[inst.id] ?? 0
    const dispCount = disputeMap[inst.id] ?? 0

    if (cancels >= 4) { score += 20; flags.push(`${cancels} cancellations in 30 days`) }
    else if (cancels >= 2) { score += 12; flags.push(`${cancels} cancellations in 30 days`) }

    if (dispCount >= 2) { score += 20; flags.push(`${dispCount} open disputes`) }
    else if (dispCount === 1) { score += 12; flags.push('1 open dispute') }

    if (!inst.stripeAccountId) { score += 15; flags.push('Stripe not connected') }
    else if (!inst.chargesEnabled) { score += 8; flags.push('Stripe onboarding incomplete') }

    const checks = [
      { label: 'Licence', date: inst.licenseExpiry },
      { label: 'Insurance', date: inst.insuranceExpiry },
      { label: 'WWC Check', date: inst.wwcCheckExpiry },
    ]
    for (const c of checks) {
      if (!c.date) continue
      const days = Math.ceil((c.date.getTime() - now.getTime()) / 86400000)
      if (days <= 0) { score += 15; flags.push(`${c.label} expired`) }
      else if (days <= 14) { score += 12; flags.push(`${c.label} expires in ${days} days`) }
      else if (days <= 30) { score += 8; flags.push(`${c.label} expires in ${days} days`) }
    }

    return { name: inst.name, riskScore: Math.min(100, score), riskLevel: score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low', flags }
  })
    .filter(r => r.riskScore >= minScore)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, limit)

  return {
    instructors: scored,
    summary: {
      high: scored.filter(r => r.riskLevel === 'high').length,
      medium: scored.filter(r => r.riskLevel === 'medium').length,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. getWeeklyReport
// ─────────────────────────────────────────────────────────────────────────────
export async function getWeeklyReport(): Promise<ToolResult> {
  const now = new Date()
  const last7 = new Date(now.getTime() - 7 * 86400000)
  const prev7 = new Date(now.getTime() - 14 * 86400000)

  const [twRev, lwRev, twBookings, lwBookings, completed, cancelled, newStudents] = await Promise.all([
    (prisma as any).walletTransaction.aggregate({ where: { createdAt: { gte: last7 }, type: 'CREDIT' }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: 0 } })),
    (prisma as any).walletTransaction.aggregate({ where: { createdAt: { gte: prev7, lt: last7 }, type: 'CREDIT' }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: 0 } })),
    prisma.booking.count({ where: { createdAt: { gte: last7 }, deletedAt: null } as any }).catch(() => 0),
    prisma.booking.count({ where: { createdAt: { gte: prev7, lt: last7 }, deletedAt: null } as any }).catch(() => 0),
    prisma.booking.count({ where: { status: 'COMPLETED', updatedAt: { gte: last7 }, deletedAt: null } as any }).catch(() => 0),
    prisma.booking.count({ where: { status: 'CANCELLED', updatedAt: { gte: last7 }, deletedAt: null } as any }).catch(() => 0),
    prisma.client.count({ where: { createdAt: { gte: last7 } } }).catch(() => 0),
  ])

  const tw = Number(twRev._sum?.amount ?? 0)
  const lw = Number(lwRev._sum?.amount ?? 0)
  const revChange = lw > 0 ? Math.round(((tw - lw) / lw) * 100) : null
  const bookingChange = lwBookings > 0 ? Math.round(((twBookings - lwBookings) / lwBookings) * 100) : null
  const finalized = completed + cancelled
  const completionRate = finalized > 0 ? Math.round((completed / finalized) * 100) : null

  return {
    revenue: { thisWeek: tw, lastWeek: lw, changePercent: revChange },
    bookings: { thisWeek: twBookings, lastWeek: lwBookings, changePercent: bookingChange, completed, cancelled, completionRate },
    newStudents,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. getRevenueBreakdown — cancellation losses + top earners
// ─────────────────────────────────────────────────────────────────────────────
export async function getRevenueBreakdown(args: { days?: number }): Promise<ToolResult> {
  const days = Math.min(90, args.days ?? 30)
  const since = new Date(Date.now() - days * 86400000)

  const [totalRevAgg, cancelledBookings, topInstructors] = await Promise.all([
    (prisma as any).walletTransaction.aggregate({
      where: { createdAt: { gte: since }, type: 'CREDIT' },
      _sum: { amount: true },
    }).catch(() => ({ _sum: { amount: 0 } })),

    prisma.booking.aggregate({
      where: { status: 'CANCELLED', updatedAt: { gte: since }, deletedAt: null, price: { gt: 0 } } as any,
      _sum: { price: true },
      _count: { id: true },
    }).catch(() => ({ _sum: { price: 0 }, _count: { id: 0 } })),

    prisma.booking.groupBy({
      by: ['instructorId'],
      where: { status: 'COMPLETED', updatedAt: { gte: since }, deletedAt: null } as any,
      _sum: { price: true },
      _count: { id: true },
      orderBy: { _sum: { price: 'desc' } },
      take: 5,
    }).catch(() => []),
  ])

  // Resolve instructor names
  const ids = (topInstructors as any[]).map(r => r.instructorId).filter(Boolean)
  const names = ids.length > 0
    ? await prisma.instructor.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }).catch(() => [])
    : []

  const topEarners = (topInstructors as any[]).map(r => ({
    name: names.find((n: any) => n.id === r.instructorId)?.name ?? 'Unknown',
    revenue: Number(r._sum?.price ?? 0),
    lessons: r._count.id,
  }))

  return {
    period: `Last ${days} days`,
    totalRevenue: Number(totalRevAgg._sum?.amount ?? 0),
    cancellationLoss: { amount: Number(cancelledBookings._sum?.price ?? 0), count: cancelledBookings._count?.id ?? 0 },
    topEarners,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. getStudentRetention
// ─────────────────────────────────────────────────────────────────────────────
export async function getStudentRetention(): Promise<ToolResult> {
  const now = new Date()
  const last30 = new Date(now.getTime() - 30 * 86400000)
  const last60 = new Date(now.getTime() - 60 * 86400000)

  // Students who booked in last 30 days
  const [recentBookers, repeatBookers, totalStudents, activeStudents] = await Promise.all([
    prisma.booking.findMany({
      where: { createdAt: { gte: last30 }, deletedAt: null } as any,
      select: { clientId: true },
      distinct: ['clientId'],
    }).catch(() => []),

    prisma.booking.groupBy({
      by: ['clientId'],
      where: { createdAt: { gte: last60 }, deletedAt: null } as any,
      _count: { id: true },
      having: { id: { _count: { gt: 1 } } },
    }).catch(() => []),

    prisma.client.count().catch(() => 0),

    prisma.booking.findMany({
      where: { createdAt: { gte: last30 }, deletedAt: null } as any,
      select: { clientId: true },
      distinct: ['clientId'],
    }).then(r => r.length).catch(() => 0),
  ])

  const returnRate = recentBookers.length > 0
    ? Math.round((repeatBookers.length / recentBookers.length) * 100)
    : 0

  return {
    totalStudents,
    activeStudents30d: activeStudents,
    repeatBookers60d: repeatBookers.length,
    returnRatePercent: returnRate,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. getSuburbDemand — top suburbs by booking count
// ─────────────────────────────────────────────────────────────────────────────
export async function getSuburbDemand(args: { limit?: number }): Promise<ToolResult> {
  const limit = Math.min(20, args.limit ?? 10)
  const last30 = new Date(Date.now() - 30 * 86400000)

  const bookings = await prisma.booking.findMany({
    where: { createdAt: { gte: last30 }, pickupAddress: { not: null }, deletedAt: null } as any,
    select: { pickupAddress: true },
    take: 500,
  }).catch(() => [])

  // Extract suburb from address (last non-postcode, non-state segment)
  const suburbCount: Record<string, number> = {}
  for (const b of bookings) {
    const addr = (b as any).pickupAddress as string
    if (!addr) continue
    const parts = addr.split(',').map((p: string) => p.trim()).filter(Boolean)
    // Take second-to-last part as suburb approximation
    const suburb = parts.length >= 2 ? parts[parts.length - 2] : parts[0]
    if (suburb && suburb.length > 2) {
      suburbCount[suburb] = (suburbCount[suburb] ?? 0) + 1
    }
  }

  const sorted = Object.entries(suburbCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([suburb, count]) => ({ suburb, bookings: count }))

  return { period: 'Last 30 days', topSuburbs: sorted }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. getOperationsTimeline — recent events summary
// ─────────────────────────────────────────────────────────────────────────────
export async function getOperationsTimeline(args: { hours?: number }): Promise<ToolResult> {
  const hours = Math.min(168, args.hours ?? 24)
  const since = new Date(Date.now() - hours * 3600000)

  const [recentBookings, recentPayouts, recentDisputes, recentAudit] = await Promise.all([
    prisma.booking.groupBy({
      by: ['status'],
      where: { updatedAt: { gte: since }, deletedAt: null } as any,
      _count: { id: true },
    }).catch(() => []),

    (prisma as any).payout.groupBy({
      by: ['status'],
      where: { updatedAt: { gte: since } },
      _count: { id: true },
    }).catch(() => []),

    (prisma as any).stripeDispute.count({
      where: { updatedAt: { gte: since } },
    }).catch(() => 0),

    prisma.auditLog.count({
      where: { createdAt: { gte: since } },
    }).catch(() => 0),
  ])

  const bookingSummary: Record<string, number> = {}
  for (const r of recentBookings as any[]) bookingSummary[r.status] = r._count.id

  const payoutSummary: Record<string, number> = {}
  for (const r of recentPayouts as any[]) payoutSummary[r.status] = r._count.id

  return {
    period: `Last ${hours} hours`,
    bookings: bookingSummary,
    payouts: payoutSummary,
    disputeActivity: recentDisputes,
    auditEvents: recentAudit,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool dispatcher — called by the API route
// ─────────────────────────────────────────────────────────────────────────────
export async function callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case 'getDailySummary':       return getDailySummary()
    case 'getHealthScore':        return getHealthScore()
    case 'getInstructorRisk':     return getInstructorRisk(args as any)
    case 'getWeeklyReport':       return getWeeklyReport()
    case 'getRevenueBreakdown':   return getRevenueBreakdown(args as any)
    case 'getStudentRetention':   return getStudentRetention()
    case 'getSuburbDemand':       return getSuburbDemand(args as any)
    case 'getOperationsTimeline': return getOperationsTimeline(args as any)
    default:
      throw new Error(`Unknown tool: ${name}. Only whitelisted tools are permitted.`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI function schemas — passed to the LLM so it knows what to call
// ─────────────────────────────────────────────────────────────────────────────
export const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'getDailySummary',
      description: 'Get yesterday\'s operational summary: completed bookings, cancellations, new students, open issues (stuck payments, disputes, pending approvals, expiring docs), and this week\'s revenue.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'getHealthScore',
      description: 'Get the current platform health score (0–100) with signal breakdown: completion rate, payment success, dispute count, Stripe onboarding rate, revenue trend, payout reliability.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'getInstructorRisk',
      description: 'Get a list of at-risk instructors scored by risk level. Use to answer questions about which instructors need attention, have high cancellations, open disputes, or incomplete onboarding.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max number of instructors to return (default 5, max 20)' },
          minScore: { type: 'number', description: 'Minimum risk score to include (default 30)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'getWeeklyReport',
      description: 'Get this week\'s performance vs last week: revenue, bookings, completion rate, new students. Use for trend questions like "how are we doing this week" or "is revenue up or down".',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'getRevenueBreakdown',
      description: 'Get revenue breakdown for a period: total collected, amount lost to cancellations, and top earning instructors. Use for questions about cancellation losses or top performers.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Look-back period in days (default 30, max 90)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'getStudentRetention',
      description: 'Get student retention metrics: total students, active in last 30 days, repeat bookers, return rate. Use for questions about student engagement or retention.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'getSuburbDemand',
      description: 'Get the top suburbs by booking volume in the last 30 days. Use for questions about geographic demand, where students are booking from, or which areas are most active.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of suburbs to return (default 10, max 20)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'getOperationsTimeline',
      description: 'Get a summary of recent platform activity: booking status counts, payout activity, dispute events, audit log volume. Use for "what happened today/recently" questions.',
      parameters: {
        type: 'object',
        properties: {
          hours: { type: 'number', description: 'Look-back window in hours (default 24, max 168)' },
        },
        required: [],
      },
    },
  },
] as const
