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
import {
  type ToolResult,
  ok,
  partial,
  toolError,
  safeQuery,
  safeQueryAll,
  collectErrors,
} from './tool-contracts'

// Temporary alias for tools not yet migrated to ToolResult<T>.
// Replaced one-by-one in P1-03 through P1-06.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LegacyToolResult = Record<string, any>

// ─────────────────────────────────────────────────────────────────────────────
// 1. getDailySummary
// ─────────────────────────────────────────────────────────────────────────────
export type DailySummaryData = {
  yesterday: {
    completed: number | null
    cancelled: number | null
    newBookings: number | null
    newStudents: number | null
  }
  weekRevenue: number | null
  openIssues: {
    stuckPayments: number | null
    openDisputes: number | null
    pendingApprovals: number | null
    expiringDocs: number | null
  }
}

export async function getDailySummary(): Promise<ToolResult<DailySummaryData>> {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 86400000)
  const last7 = new Date(now.getTime() - 7 * 86400000)
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000)

  const results = await safeQueryAll([
    () => prisma.booking.count({ where: { status: 'COMPLETED', updatedAt: { gte: yesterdayStart, lt: todayStart }, deletedAt: null } as any }),
    () => prisma.booking.count({ where: { status: 'CANCELLED', updatedAt: { gte: yesterdayStart, lt: todayStart }, deletedAt: null } as any }),
    () => prisma.booking.count({ where: { createdAt: { gte: yesterdayStart, lt: todayStart }, deletedAt: null } as any }),
    () => prisma.customer.count({ where: { createdAt: { gte: yesterdayStart, lt: todayStart } } }),
    () => prisma.booking.count({ where: { status: 'PENDING_PAYMENT', createdAt: { lt: yesterdayStart }, deletedAt: null } as any }),
    () => prisma.stripeDispute.count({ where: { status: { in: ['needs_response', 'warning_needs_response', 'under_review'] } } }),
    () => prisma.provider.count({ where: { approvalStatus: 'PENDING' } }),
    () => prisma.walletTransaction.aggregate({ where: { createdAt: { gte: last7 }, type: 'CREDIT' }, _sum: { amount: true } }),
    () => prisma.provider.findMany({ where: { approvalStatus: 'APPROVED' }, select: { id: true } }),
  ] as const, [
    'completed', 'cancelled', 'new bookings', 'new students', 'stuck payments',
    'disputes', 'pending approvals', 'week revenue', 'approved providers',
  ])

  const approvedProvidersResult = results[8]
  const expiringResult: ToolResult<number> = approvedProvidersResult.status === 'SUCCESS'
    ? await safeQuery(
        () => prisma.drivingProviderProfile.count({
          where: {
            providerId: { in: approvedProvidersResult.data.map((provider) => provider.id) },
            OR: [
              { licenseExpiry: { lte: thirtyDaysFromNow } },
              { insuranceExpiry: { lte: thirtyDaysFromNow } },
              { policeCheckExpiry: { lte: thirtyDaysFromNow } },
              { wwcCheckExpiry: { lte: thirtyDaysFromNow } },
            ],
          },
        }),
        'expiring documents',
      )
    : { status: 'ERROR', error: 'expiring documents: approved providers unavailable' }

  const allResults: ToolResult<unknown>[] = [...results, expiringResult]
  const missingLabels = [
    'completed', 'cancelled', 'new bookings', 'new students', 'stuck payments',
    'disputes', 'pending approvals', 'week revenue', 'approved providers',
    'expiring documents',
  ]
  const missing = allResults
    .map((result, index) => result.status === 'ERROR' ? missingLabels[index] : null)
    .filter((label): label is string => label !== null)

  if (allResults.every((result) => result.status === 'ERROR')) {
    return toolError(`getDailySummary: all queries failed — ${missing.join(', ')}`)
  }

  const value = <T,>(result: ToolResult<T>): T | null => result.status === 'SUCCESS' ? result.data : null
  const data: DailySummaryData = {
    yesterday: {
      completed: value(results[0]),
      cancelled: value(results[1]),
      newBookings: value(results[2]),
      newStudents: value(results[3]),
    },
    weekRevenue: (() => {
      const aggregate = value(results[7]) as { _sum?: { amount?: unknown } } | null
      return aggregate ? Number(aggregate._sum?.amount ?? 0) : null
    })(),
    openIssues: {
      stuckPayments: value(results[4]),
      openDisputes: value(results[5]),
      pendingApprovals: value(results[6]),
      expiringDocs: value(expiringResult),
    },
  }

  return missing.length > 0 ? partial(data, missing) : ok(data)
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. getHealthScore
// ─────────────────────────────────────────────────────────────────────────────
// 2. getHealthScore
// ─────────────────────────────────────────────────────────────────────────────

// Signal labels — used in PARTIAL missing[] and ERROR messages
const HEALTH_SIGNAL_LABELS = [
  'completed',       // 0
  'finalized',       // 1
  'failedPayments',  // 2  ← C-1a: if this fails, old code added +20 bonus points
  'approved',        // 3
  'stripeComplete',  // 4
  'openDisputes',    // 5
  'thisWeekRev',     // 6
  'lastWeekRev',     // 7
  'failedPayouts',   // 8
  'totalPayouts',    // 9
] as const

export type HealthScoreData = {
  score: number
  status: 'healthy' | 'watch' | 'critical'
  signals: {
    completionRate: number | null
    onboardingRate: number | null
    openDisputes: number | null
    revChangePercent: number | null
    payoutFailRate: number | null
    failedPayments: number | null
  }
  scoringNotes?: string[]
}

export async function getHealthScore(): Promise<ToolResult<HealthScoreData>> {
  const now = new Date()
  const last30 = new Date(now.getTime() - 30 * 86400000)
  const last7 = new Date(now.getTime() - 7 * 86400000)
  const prev7 = new Date(now.getTime() - 14 * 86400000)

  const results = await safeQueryAll([
    () => prisma.booking.count({ where: { status: 'COMPLETED', updatedAt: { gte: last30 }, deletedAt: null } as any }),
    () => prisma.booking.count({ where: { status: { in: ['COMPLETED', 'CANCELLED', 'NO_SHOW'] }, updatedAt: { gte: last30 }, deletedAt: null } as any }),
    () => prisma.booking.count({ where: { status: 'PENDING_PAYMENT', createdAt: { gte: last30 }, deletedAt: null } as any }),
    () => prisma.provider.count({ where: { approvalStatus: 'APPROVED' } }),
    () => prisma.provider.count({ where: { approvalStatus: 'APPROVED', stripeAccountId: { not: null }, chargesEnabled: true } }),
    () => prisma.stripeDispute.count({ where: { status: { in: ['needs_response', 'warning_needs_response', 'under_review'] } } }),
    () => prisma.walletTransaction.aggregate({ where: { createdAt: { gte: last7 }, type: 'CREDIT' }, _sum: { amount: true } }),
    () => prisma.walletTransaction.aggregate({ where: { createdAt: { gte: prev7, lt: last7 }, type: 'CREDIT' }, _sum: { amount: true } }),
    () => prisma.payout.count({ where: { status: 'FAILED', createdAt: { gte: last30 } } }),
    () => prisma.payout.count({ where: { createdAt: { gte: last30 } } }),
  ], [...HEALTH_SIGNAL_LABELS])

  // Collect any failed queries
  const errors = collectErrors(results)
  const missingSignals = HEALTH_SIGNAL_LABELS.filter((_, i) => results[i].status === 'ERROR')

  // If all queries failed, return a hard error — no score is meaningful
  if (errors.length === results.length) {
    return toolError(`getHealthScore: all ${results.length} queries failed — ${errors[0]}`)
  }

  // C-1a: if failedPayments query failed, we must not treat it as zero
  // (which would add +20 bonus points to the score).
  // Instead, mark it as a missing signal and exclude it from scoring.
  const failedPaymentsResult = results[2]
  const failedPayments = failedPaymentsResult.status === 'SUCCESS'
    ? (failedPaymentsResult.data as number)
    : null  // null = unknown, not zero

  // Extract values, using null for any failed signal
  const completed      = results[0].status === 'SUCCESS' ? (results[0].data as number) : null
  const finalized      = results[1].status === 'SUCCESS' ? (results[1].data as number) : null
  const approved       = results[3].status === 'SUCCESS' ? (results[3].data as number) : null
  const stripeComplete = results[4].status === 'SUCCESS' ? (results[4].data as number) : null
  const openDisputes   = results[5].status === 'SUCCESS' ? (results[5].data as number) : null
  const twAgg          = results[6].status === 'SUCCESS' ? (results[6].data as { _sum: { amount: unknown } }) : null
  const lwAgg          = results[7].status === 'SUCCESS' ? (results[7].data as { _sum: { amount: unknown } }) : null
  const failedPayouts  = results[8].status === 'SUCCESS' ? (results[8].data as number) : null
  const totalPayouts   = results[9].status === 'SUCCESS' ? (results[9].data as number) : null

  // Compute signals only from available data
  const completionRate  = (finalized != null && finalized > 0 && completed != null)
    ? Math.round((completed / finalized) * 100) : null
  const onboardingRate  = (approved != null && approved > 0 && stripeComplete != null)
    ? Math.round((stripeComplete / approved) * 100) : null
  const thisWeek        = twAgg != null ? Number(twAgg._sum?.amount ?? 0) : null
  const lastWeek        = lwAgg != null ? Number(lwAgg._sum?.amount ?? 0) : null
  const revChange       = (lastWeek != null && lastWeek > 0 && thisWeek != null)
    ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null
  const payoutFailRate  = (totalPayouts != null && totalPayouts > 0 && failedPayouts != null)
    ? Math.round((failedPayouts / totalPayouts) * 100) : null

  // Build score from available components only.
  // Missing signals are excluded — they do not contribute 0 or a bonus.
  let score = 0
  const scoringNotes: string[] = []

  if (completionRate != null) {
    score += Math.round(completionRate * 0.25)
  } else {
    scoringNotes.push('completionRate excluded (data unavailable)')
  }

  if (failedPayments != null) {
    score += Math.round(Math.max(0, 20 - (failedPayments > 0 ? 20 : 0)))
  } else {
    // C-1a: do NOT add bonus points when failedPayments is unknown
    scoringNotes.push('failedPayments excluded (query failed — no bonus or penalty applied)')
  }

  if (openDisputes != null) {
    score += Math.round(Math.max(0, 20 - openDisputes * 5))
  } else {
    scoringNotes.push('openDisputes excluded (data unavailable)')
  }

  if (onboardingRate != null) {
    score += Math.round(onboardingRate * 0.15)
  } else {
    scoringNotes.push('onboardingRate excluded (data unavailable)')
  }

  if (revChange != null) {
    score += Math.min(10, Math.max(0, 5 + revChange * 0.25))
  } else {
    scoringNotes.push('revChange excluded (data unavailable)')
  }

  if (payoutFailRate != null) {
    score += Math.round(Math.max(0, 10 - payoutFailRate * 0.5))
  } else {
    scoringNotes.push('payoutFailRate excluded (data unavailable)')
  }

  score = Math.min(100, Math.max(0, Math.round(score)))

  const data = {
    score,
    status: (score >= 90 ? 'healthy' : score >= 70 ? 'watch' : 'critical') as 'healthy' | 'watch' | 'critical',
    signals: {
      completionRate,
      onboardingRate,
      openDisputes,
      revChangePercent: revChange,
      payoutFailRate,
      failedPayments,
    },
    ...(scoringNotes.length > 0 && { scoringNotes }),
  }

  // Return PARTIAL if some queries failed but we could still compute a score
  if (missingSignals.length > 0) {
    return partial(data, missingSignals)
  }

  return ok(data)
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. getInstructorRisk — top N at-risk instructors
// ─────────────────────────────────────────────────────────────────────────────
type DocumentStatus = 'valid' | 'expiring' | 'expired' | 'unavailable' | 'no_profile'

type InstructorRiskProvider = {
  name: string
  riskScore: number | null
  riskLevel: 'high' | 'medium' | 'low' | 'unknown'
  flags: string[]
  documents: {
    profile: 'present' | 'missing' | 'unavailable'
    licence: DocumentStatus
    insurance: DocumentStatus
    wwcCheck: DocumentStatus
  }
}

export type InstructorRiskData = {
  providers: InstructorRiskProvider[]
  summary: { high: number; medium: number; unknown: number }
}

function getDocumentStatus(expiry: Date | null | undefined, now: Date): DocumentStatus {
  if (!expiry) return 'unavailable'
  const days = Math.ceil((expiry.getTime() - now.getTime()) / 86400000)
  if (days <= 0) return 'expired'
  if (days <= 30) return 'expiring'
  return 'valid'
}

export async function getInstructorRisk(args: { limit?: number; minScore?: number }): Promise<ToolResult<InstructorRiskData>> {
  const limit = Math.min(20, Math.max(1, args.limit ?? 5))
  const minScore = Math.max(0, args.minScore ?? 30)
  const now = new Date()
  const last30 = new Date(now.getTime() - 30 * 86400000)

  const instructorsResult = await safeQuery(
    () => prisma.provider.findMany({
      where: { approvalStatus: 'APPROVED' },
      select: { id: true, name: true, stripeAccountId: true, chargesEnabled: true },
    }),
    'approved providers',
  )

  if (instructorsResult.status === 'ERROR') return instructorsResult
  if (instructorsResult.status === 'EMPTY' || instructorsResult.status === 'UNKNOWN') return instructorsResult
  if (instructorsResult.status === 'PARTIAL') return { status: 'ERROR', error: 'Approved provider query returned partial data' }
  if (instructorsResult.data.length === 0) return { status: 'EMPTY', reason: 'No approved providers found' }

  const providerIds = instructorsResult.data.map((instructor) => instructor.id)
  const [profilesResult, cancellationsResult, disputesResult] = await safeQueryAll([
    () => prisma.drivingProviderProfile.findMany({
      where: { providerId: { in: providerIds } },
      select: { providerId: true, licenseExpiry: true, insuranceExpiry: true, wwcCheckExpiry: true },
    }),
    () => prisma.booking.groupBy({
      by: ['providerId'],
      where: { status: 'CANCELLED', updatedAt: { gte: last30 }, deletedAt: null },
      _count: { id: true },
    }),
    () => prisma.stripeDispute.groupBy({
      by: ['providerId'],
      where: { providerId: { in: providerIds }, status: { in: ['needs_response', 'warning_needs_response', 'under_review'] } },
      _count: { id: true },
    }),
  ] as const, ['driving profiles', 'cancellations', 'disputes'])

  const missing = [
    profilesResult.status === 'ERROR' ? 'driving profiles' : null,
    cancellationsResult.status === 'ERROR' ? 'cancellations' : null,
    disputesResult.status === 'ERROR' ? 'disputes' : null,
  ].filter((label): label is string => label !== null)

  const profileMap = profilesResult.status === 'SUCCESS'
    ? new Map(profilesResult.data.map((profile) => [profile.providerId, profile]))
    : new Map()
  const cancelMap = cancellationsResult.status === 'SUCCESS'
    ? new Map(cancellationsResult.data.map((row) => [row.providerId, row._count.id]))
    : new Map<string, number>()
  const disputeMap = disputesResult.status === 'SUCCESS'
    ? new Map(disputesResult.data.filter((row) => row.providerId).map((row) => [row.providerId as string, row._count.id]))
    : new Map<string, number>()

  const scored = instructorsResult.data.map((instructor): InstructorRiskProvider => {
    let score = 0
    const flags: string[] = []
    const profile = profileMap.get(instructor.id)
    const profileUnavailable = profilesResult.status === 'ERROR'
    const cancellationsUnavailable = cancellationsResult.status === 'ERROR'
    const disputesUnavailable = disputesResult.status === 'ERROR'

    if (cancellationsUnavailable) flags.push('Cancellation data unavailable')
    else {
      const cancels = cancelMap.get(instructor.id) ?? 0
      if (cancels >= 4) { score += 20; flags.push(`${cancels} cancellations in 30 days`) }
      else if (cancels >= 2) { score += 12; flags.push(`${cancels} cancellations in 30 days`) }
    }

    if (disputesUnavailable) flags.push('Dispute data unavailable')
    else {
      const dispCount = disputeMap.get(instructor.id) ?? 0
      if (dispCount >= 2) { score += 20; flags.push(`${dispCount} open disputes`) }
      else if (dispCount === 1) { score += 12; flags.push('1 open dispute') }
    }

    if (!instructor.stripeAccountId) { score += 15; flags.push('Stripe not connected') }
    else if (!instructor.chargesEnabled) { score += 8; flags.push('Stripe onboarding incomplete') }

    const documents = profileUnavailable
      ? { profile: 'unavailable' as const, licence: 'unavailable' as const, insurance: 'unavailable' as const, wwcCheck: 'unavailable' as const }
      : !profile
        ? { profile: 'missing' as const, licence: 'no_profile' as const, insurance: 'no_profile' as const, wwcCheck: 'no_profile' as const }
        : { profile: 'present' as const, licence: getDocumentStatus(profile.licenseExpiry, now), insurance: getDocumentStatus(profile.insuranceExpiry, now), wwcCheck: getDocumentStatus(profile.wwcCheckExpiry, now) }

    if (documents.profile === 'unavailable') flags.push('Driving profile data unavailable')
    else if (documents.profile === 'missing') flags.push('Driving profile missing')

    if (documents.profile === 'present') {
      const checks = [
        { label: 'Licence', status: documents.licence, date: profile.licenseExpiry },
        { label: 'Insurance', status: documents.insurance, date: profile.insuranceExpiry },
        { label: 'WWC Check', status: documents.wwcCheck, date: profile.wwcCheckExpiry },
      ]
      for (const check of checks) {
        if (check.status === 'unavailable') flags.push(`${check.label} expiry unavailable`)
        else if (check.status === 'expired') { score += 15; flags.push(`${check.label} expired`) }
        else if (check.status === 'expiring' && check.date) {
          const days = Math.ceil((check.date.getTime() - now.getTime()) / 86400000)
          if (days <= 14) { score += 12; flags.push(`${check.label} expires in ${days} days`) }
          else { score += 8; flags.push(`${check.label} expires in ${days} days`) }
        }
      }
    }

    const evidenceUnavailable = profileUnavailable || !profile || Object.values(documents).includes('unavailable') || Object.values(documents).includes('no_profile') || cancellationsUnavailable || disputesUnavailable
    return {
      name: instructor.name,
      riskScore: evidenceUnavailable ? null : Math.min(100, score),
      riskLevel: evidenceUnavailable ? 'unknown' : score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low',
      flags,
      documents,
    }
  }).filter((provider) => provider.riskLevel === 'unknown' || (provider.riskScore !== null && provider.riskScore >= minScore))
    .sort((a, b) => (b.riskScore ?? -1) - (a.riskScore ?? -1))
    .slice(0, limit)

  const data = {
    providers: scored,
    summary: {
      high: scored.filter((provider) => provider.riskLevel === 'high').length,
      medium: scored.filter((provider) => provider.riskLevel === 'medium').length,
      unknown: scored.filter((provider) => provider.riskLevel === 'unknown').length,
    },
  }

  return missing.length > 0 ? partial(data, missing) : ok(data)
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. getWeeklyReport
// ─────────────────────────────────────────────────────────────────────────────
export async function getWeeklyReport(): Promise<LegacyToolResult> {
  const now = new Date()
  const last7 = new Date(now.getTime() - 7 * 86400000)
  const prev7 = new Date(now.getTime() - 14 * 86400000)

  const [twRev, lwRev, twBookings, lwBookings, completed, cancelled, newStudents] = await Promise.all([
    (prisma.walletTransaction.aggregate({ where: { createdAt: { gte: last7 }, type: 'CREDIT' }, _sum: { amount: true } }) as any).catch(() => ({ _sum: { amount: 0 } })),
    (prisma.walletTransaction.aggregate({ where: { createdAt: { gte: prev7, lt: last7 }, type: 'CREDIT' }, _sum: { amount: true } }) as any).catch(() => ({ _sum: { amount: 0 } })),
    (prisma.booking.count({ where: { createdAt: { gte: last7 }, deletedAt: null } as any }) as any).catch(() => 0),
    (prisma.booking.count({ where: { createdAt: { gte: prev7, lt: last7 }, deletedAt: null } as any }) as any).catch(() => 0),
    (prisma.booking.count({ where: { status: 'COMPLETED', updatedAt: { gte: last7 }, deletedAt: null } as any }) as any).catch(() => 0),
    (prisma.booking.count({ where: { status: 'CANCELLED', updatedAt: { gte: last7 }, deletedAt: null } as any }) as any).catch(() => 0),
    (prisma.customer.count({ where: { createdAt: { gte: last7 } } }) as any).catch(() => 0),
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
export async function getRevenueBreakdown(args: { days?: number }): Promise<LegacyToolResult> {
  const days = Math.min(90, args.days ?? 30)
  const since = new Date(Date.now() - days * 86400000)

  const [totalRevAgg, cancelledBookings, topInstructors] = await Promise.all([
    (prisma.walletTransaction.aggregate({
      where: { createdAt: { gte: since }, type: 'CREDIT' },
      _sum: { amount: true },
    }) as any).catch(() => ({ _sum: { amount: 0 } })),

    (prisma.booking.aggregate({
      where: { status: 'CANCELLED', updatedAt: { gte: since }, deletedAt: null, price: { gt: 0 } } as any,
      _sum: { price: true },
      _count: { id: true },
    }) as any).catch(() => ({ _sum: { price: 0 }, _count: { id: 0 } })),

    (prisma.booking.groupBy({
      by: ['providerId'],
      where: { status: 'COMPLETED', updatedAt: { gte: since }, deletedAt: null } as any,
      _sum: { price: true },
      _count: { id: true },
      orderBy: { _sum: { price: 'desc' } },
      take: 5,
    }) as any).catch(() => []),
  ])

  const ids = (topInstructors as any[]).map((r: any) => r.providerId).filter(Boolean)
  const names = ids.length > 0
    ? await (prisma as any).provider.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }).catch(() => [])
    : []

  const topEarners = (topInstructors as any[]).map((r: any) => ({
    name: names.find((n: any) => n.id === r.providerId)?.name ?? 'Unknown',
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
export async function getStudentRetention(): Promise<LegacyToolResult> {
  const now = new Date()
  const last30 = new Date(now.getTime() - 30 * 86400000)
  const last60 = new Date(now.getTime() - 60 * 86400000)

  const [recentBookers, repeatBookers, totalStudents, activeStudents] = await Promise.all([
    (prisma.booking.findMany({
      where: { createdAt: { gte: last30 }, deletedAt: null } as any,
      select: { customerId: true },
      distinct: ['customerId'],
    }) as any).catch(() => []),

    (prisma.booking.groupBy({
      by: ['customerId'],
      where: { createdAt: { gte: last60 }, deletedAt: null } as any,
      _count: { id: true },
      having: { id: { _count: { gt: 1 } } },
    }) as any).catch(() => []),

    (prisma.customer.count() as any).catch(() => 0),

    (prisma.booking.findMany({
      where: { createdAt: { gte: last30 }, deletedAt: null } as any,
      select: { customerId: true },
      distinct: ['customerId'],
    }) as any).then((r: any) => r.length).catch(() => 0),
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
export async function getSuburbDemand(args: { limit?: number }): Promise<LegacyToolResult> {
  const limit = Math.min(20, args.limit ?? 10)
  const last30 = new Date(Date.now() - 30 * 86400000)

  const bookings = await (prisma.booking.findMany({
    where: { createdAt: { gte: last30 }, pickupAddress: { not: null }, deletedAt: null } as any,
    select: { pickupAddress: true },
    take: 500,
  }) as any).catch(() => [])

  const suburbCount: Record<string, number> = {}
  for (const b of bookings) {
    const addr = (b as any).pickupAddress as string
    if (!addr) continue
    const parts = addr.split(',').map((p: string) => p.trim()).filter(Boolean)
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
export async function getOperationsTimeline(args: { hours?: number }): Promise<LegacyToolResult> {
  const hours = Math.min(168, args.hours ?? 24)
  const since = new Date(Date.now() - hours * 3600000)

  const [recentBookings, recentPayouts, recentDisputes, recentAudit] = await Promise.all([
    (prisma.booking.groupBy({
      by: ['status'],
      where: { updatedAt: { gte: since }, deletedAt: null } as any,
      _count: { id: true },
    }) as any).catch(() => []),

    (prisma.payout.groupBy({
      by: ['status'],
      where: { updatedAt: { gte: since } },
      _count: { id: true },
    }) as any).catch(() => []),

    (prisma.stripeDispute.count({
      where: { updatedAt: { gte: since } },
    }) as any).catch(() => 0),

    (prisma.auditLog.count({
      where: { createdAt: { gte: since } },
    }) as any).catch(() => 0),
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
export async function callTool(name: string, args: Record<string, unknown>): Promise<LegacyToolResult> {
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
      description: "Get yesterday's operational summary: completed bookings, cancellations, new students, open issues (stuck payments, disputes, pending approvals, expiring docs), and this week's revenue.",
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
      description: "Get this week's performance vs last week: revenue, bookings, completion rate, new students. Use for trend questions like 'how are we doing this week' or 'is revenue up or down'.",
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
      description: "Get a summary of recent platform activity: booking status counts, payout activity, dispute events, audit log volume. Use for 'what happened today/recently' questions.",
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
