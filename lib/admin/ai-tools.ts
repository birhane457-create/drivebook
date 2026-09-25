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
  semantics: {
    formula: string
    weightSummary: Record<string, number>
    allSignalsFail: 'ERROR'
    partialPolicy: string
    nullMeans: 'unavailable, not zero'
  }
  signalDefinitions: Record<string, string>
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

  const semantics = {
    formula: 'Weighted sum of available signals, capped to 0-100; unavailable signals are excluded from the calculation and are represented as null instead of zero.',
    weightSummary: {
      completionRate: 25,
      onboardingRate: 15,
      openDisputes: 20,
      revChangePercent: 10,
      payoutFailRate: 10,
      failedPayments: 20,
    },
    allSignalsFail: 'ERROR' as const,
    partialPolicy: 'If any signal fails, return PARTIAL with missing[] and keep the score based only on available evidence.',
    nullMeans: 'unavailable, not zero' as const,
  }

  const signalDefinitions = {
    completionRate: 'Booking completion rate over the last 30 days; a valid 0% completion is real data, while null means data was unavailable.',
    onboardingRate: 'Current approved providers with active Stripe onboarding; this is not time-windowed and reflects the current provider set.',
    openDisputes: 'Open Stripe disputes currently awaiting response; 0 means none, null means unavailable.',
    revChangePercent: 'Revenue change versus the previous 7-day window; a negative value is real data, null means unavailable.',
    payoutFailRate: 'Failed payout rate over the last 30 days; null means unavailable, not zero.',
    failedPayments: 'Pending-payment failures; null means the query failed, not that there were zero failed payments.',
  }

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
    semantics,
    signalDefinitions,
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
    policeCheck: DocumentStatus
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
      select: { providerId: true, licenseExpiry: true, insuranceExpiry: true, wwcCheckExpiry: true, policeCheckExpiry: true },
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
      ? { profile: 'unavailable' as const, licence: 'unavailable' as const, insurance: 'unavailable' as const, wwcCheck: 'unavailable' as const, policeCheck: 'unavailable' as const }
      : !profile
        ? { profile: 'missing' as const, licence: 'no_profile' as const, insurance: 'no_profile' as const, wwcCheck: 'no_profile' as const, policeCheck: 'no_profile' as const }
        : { profile: 'present' as const, licence: getDocumentStatus(profile.licenseExpiry, now), insurance: getDocumentStatus(profile.insuranceExpiry, now), wwcCheck: getDocumentStatus(profile.wwcCheckExpiry, now), policeCheck: getDocumentStatus(profile.policeCheckExpiry, now) }

    if (documents.profile === 'unavailable') flags.push('Driving profile data unavailable')
    else if (documents.profile === 'missing') flags.push('Driving profile missing')

    if (documents.profile === 'present') {
      const checks = [
        { label: 'Licence', status: documents.licence, date: profile.licenseExpiry },
        { label: 'Insurance', status: documents.insurance, date: profile.insuranceExpiry },
        { label: 'WWC Check', status: documents.wwcCheck, date: profile.wwcCheckExpiry },
        { label: 'Police Check', status: documents.policeCheck, date: profile.policeCheckExpiry },
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
export type WeeklyReportData = {
  revenue: { thisWeek: number | null; lastWeek: number | null; changePercent: number | null }
  bookings: {
    thisWeek: number | null
    lastWeek: number | null
    changePercent: number | null
    completed: number | null
    cancelled: number | null
    completionRate: number | null
  }
  newStudents: number | null
}

export async function getWeeklyReport(): Promise<ToolResult<WeeklyReportData>> {
  const now = new Date()
  const last7 = new Date(now.getTime() - 7 * 86400000)
  const prev7 = new Date(now.getTime() - 14 * 86400000)

  const results = await safeQueryAll([
    () => prisma.walletTransaction.aggregate({ where: { createdAt: { gte: last7 }, type: 'CREDIT' }, _sum: { amount: true } }),
    () => prisma.walletTransaction.aggregate({ where: { createdAt: { gte: prev7, lt: last7 }, type: 'CREDIT' }, _sum: { amount: true } }),
    () => prisma.booking.count({ where: { createdAt: { gte: last7 }, deletedAt: null } as any }),
    () => prisma.booking.count({ where: { createdAt: { gte: prev7, lt: last7 }, deletedAt: null } as any }),
    () => prisma.booking.count({ where: { status: 'COMPLETED', updatedAt: { gte: last7 }, deletedAt: null } as any }),
    () => prisma.booking.count({ where: { status: 'CANCELLED', updatedAt: { gte: last7 }, deletedAt: null } as any }),
    () => prisma.customer.count({ where: { createdAt: { gte: last7 } } }),
  ] as const, ['this-week revenue', 'last-week revenue', 'this-week bookings', 'last-week bookings', 'completed bookings', 'cancelled bookings', 'new students'])

  const missing = results
    .map((result, index) => result.status === 'ERROR' ? ['this-week revenue', 'last-week revenue', 'this-week bookings', 'last-week bookings', 'completed bookings', 'cancelled bookings', 'new students'][index] : null)
    .filter((label): label is string => label !== null)

  if (results.every((result) => result.status === 'ERROR')) {
    return toolError(`getWeeklyReport: all queries failed — ${missing.join(', ')}`)
  }

  const value = <T,>(result: ToolResult<T>): T | null => result.status === 'SUCCESS' ? result.data : null
  const thisWeekAggregate = value(results[0]) as { _sum?: { amount?: unknown } } | null
  const lastWeekAggregate = value(results[1]) as { _sum?: { amount?: unknown } } | null
  const thisWeek = thisWeekAggregate ? Number(thisWeekAggregate._sum?.amount ?? 0) : null
  const lastWeek = lastWeekAggregate ? Number(lastWeekAggregate._sum?.amount ?? 0) : null
  const thisWeekBookings = value(results[2])
  const lastWeekBookings = value(results[3])
  const completed = value(results[4])
  const cancelled = value(results[5])
  const finalized = completed != null && cancelled != null ? completed + cancelled : null

  const data: WeeklyReportData = {
    revenue: {
      thisWeek,
      lastWeek,
      changePercent: thisWeek != null && lastWeek != null && lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null,
    },
    bookings: {
      thisWeek: thisWeekBookings,
      lastWeek: lastWeekBookings,
      changePercent: thisWeekBookings != null && lastWeekBookings != null && lastWeekBookings > 0 ? Math.round(((thisWeekBookings - lastWeekBookings) / lastWeekBookings) * 100) : null,
      completed,
      cancelled,
      completionRate: finalized != null && finalized > 0 && completed != null ? Math.round((completed / finalized) * 100) : null,
    },
    newStudents: value(results[6]),
  }

  return missing.length > 0 ? partial(data, missing) : ok(data)
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. getRevenueBreakdown — cancellation losses + top earners
// ─────────────────────────────────────────────────────────────────────────────
export type RevenueBreakdownData = {
  period: string
  totalRevenue: number | null
  cancellationLoss: { amount: number | null; count: number | null }
  topEarners: Array<{ name: string; revenue: number; lessons: number }> | null
}

export async function getRevenueBreakdown(args: { days?: number }): Promise<ToolResult<RevenueBreakdownData>> {
  const days = Math.min(90, args.days ?? 30)
  const since = new Date(Date.now() - days * 86400000)

  const results = await safeQueryAll([
    () => prisma.walletTransaction.aggregate({
      where: { createdAt: { gte: since }, type: 'CREDIT' },
      _sum: { amount: true },
    }),
    () => prisma.booking.aggregate({
      where: { status: 'CANCELLED', updatedAt: { gte: since }, deletedAt: null, price: { gt: 0 } } as any,
      _sum: { price: true },
      _count: { id: true },
    }),
    () => prisma.booking.groupBy({
      by: ['providerId'],
      where: { status: 'COMPLETED', updatedAt: { gte: since }, deletedAt: null } as any,
      _sum: { price: true },
      _count: { id: true },
      orderBy: { _sum: { price: 'desc' } },
      take: 5,
    }),
  ] as const, ['total revenue', 'cancellation loss', 'top instructors'])

  const missing = results
    .map((result, index) => result.status === 'ERROR' ? ['total revenue', 'cancellation loss', 'top instructors'][index] : null)
    .filter((label): label is string => label !== null)
  if (results.every((result) => result.status === 'ERROR')) {
    return toolError(`getRevenueBreakdown: all queries failed — ${missing.join(', ')}`)
  }

  const value = <T,>(result: ToolResult<T>): T | null => result.status === 'SUCCESS' ? result.data : null
  const totalRevenueAgg = value(results[0]) as { _sum?: { amount?: unknown } } | null
  const cancellationAgg = value(results[1]) as { _sum?: { price?: unknown }; _count?: { id?: number } } | null
  const topInstructors = value(results[2]) as Array<{ providerId: string; _sum: { price: unknown }; _count: { id: number } }> | null
  let names: Array<{ id: string; name: string }> | null = null
  let namesMissing = false

  if (topInstructors) {
    const ids = topInstructors.map((row) => row.providerId).filter(Boolean)
    if (ids.length === 0) {
      names = []
    } else {
      const namesResult = await safeQuery(
        () => prisma.provider.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
        'instructor names',
      )
      if (namesResult.status === 'SUCCESS') names = namesResult.data
      else namesMissing = true
    }
  }

  const data: RevenueBreakdownData = {
    period: `Last ${days} days`,
    totalRevenue: totalRevenueAgg ? Number(totalRevenueAgg._sum?.amount ?? 0) : null,
    cancellationLoss: {
      amount: cancellationAgg ? Number(cancellationAgg._sum?.price ?? 0) : null,
      count: cancellationAgg?._count?.id ?? null,
    },
    topEarners: topInstructors && names
      ? topInstructors.map((row) => ({
          name: names?.find((name) => name.id === row.providerId)?.name ?? 'Unknown',
          revenue: Number(row._sum?.price ?? 0),
          lessons: row._count.id,
        }))
      : null,
  }

  if (namesMissing) missing.push('instructor names')
  return missing.length > 0 ? partial(data, missing) : ok(data)
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. getStudentRetention
// ─────────────────────────────────────────────────────────────────────────────
export type StudentRetentionData = {
  totalStudents: number | null
  activeStudents30d: number | null
  repeatBookers60d: number | null
  returnRatePercent: number | null
}

export async function getStudentRetention(): Promise<ToolResult<StudentRetentionData>> {
  const now = new Date()
  const last30 = new Date(now.getTime() - 30 * 86400000)
  const last60 = new Date(now.getTime() - 60 * 86400000)

  const results = await safeQueryAll([
    () => prisma.booking.findMany({
      where: { createdAt: { gte: last30 }, deletedAt: null } as any,
      select: { customerId: true },
      distinct: ['customerId'],
    }),
    () => prisma.booking.groupBy({
      by: ['customerId'],
      where: { createdAt: { gte: last60 }, deletedAt: null } as any,
      _count: { id: true },
      having: { id: { _count: { gt: 1 } } },
    }),
    () => prisma.customer.count(),
    () => prisma.booking.findMany({
      where: { createdAt: { gte: last30 }, deletedAt: null } as any,
      select: { customerId: true },
      distinct: ['customerId'],
    }),
  ] as const, ['recent bookers', 'repeat bookers', 'total students', 'active students'])

  const missing = results
    .map((result, index) => result.status === 'ERROR' ? ['recent bookers', 'repeat bookers', 'total students', 'active students'][index] : null)
    .filter((label): label is string => label !== null)
  if (results.every((result) => result.status === 'ERROR')) {
    return toolError(`getStudentRetention: all queries failed — ${missing.join(', ')}`)
  }

  const value = <T,>(result: ToolResult<T>): T | null => result.status === 'SUCCESS' ? result.data : null
  const recentBookers = value(results[0])
  const repeatBookers = value(results[1])
  const activeStudents = value(results[3])
  const recentCount = recentBookers?.length ?? null
  const repeatCount = repeatBookers?.length ?? null
  const data: StudentRetentionData = {
    totalStudents: value(results[2]),
    activeStudents30d: activeStudents?.length ?? null,
    repeatBookers60d: repeatCount,
    returnRatePercent: recentCount != null && repeatCount != null
      ? recentCount > 0 ? Math.round((repeatCount / recentCount) * 100) : 0
      : null,
  }

  return missing.length > 0 ? partial(data, missing) : ok(data)
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. getSuburbDemand — top suburbs by booking count
// ─────────────────────────────────────────────────────────────────────────────
export type SuburbDemandData = {
  period: string
  topSuburbs: Array<{ suburb: string; bookings: number }>
  totalBookings: number
  sampleSize: number
  truncated: false
}

export async function getSuburbDemand(args: { limit?: number }): Promise<ToolResult<SuburbDemandData>> {
  const limit = Math.min(20, args.limit ?? 10)
  const last30 = new Date(Date.now() - 30 * 86400000)

  const bookingsResult = await safeQuery(
    () => prisma.booking.findMany({
      where: { createdAt: { gte: last30 }, pickupAddress: { not: null }, deletedAt: null } as any,
      select: { pickupAddress: true },
      orderBy: { createdAt: 'asc' },
    }),
    'suburb demand bookings',
  )

  if (bookingsResult.status === 'ERROR') return bookingsResult
  if (bookingsResult.status === 'EMPTY' || bookingsResult.status === 'UNKNOWN') return bookingsResult
  if (bookingsResult.status === 'PARTIAL') return { status: 'ERROR', error: 'Suburb demand booking query returned partial data' }

  const bookings = bookingsResult.data
  if (bookings.length === 0) return { status: 'EMPTY', reason: 'No bookings with pickup addresses found in the last 30 days' }

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

  return ok({
    period: 'Last 30 days',
    topSuburbs: sorted,
    totalBookings: bookings.length,
    sampleSize: bookings.length,
    truncated: false,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. getOperationsTimeline — recent events summary
// ─────────────────────────────────────────────────────────────────────────────
export type OperationsTimelineData = {
  period: string
  bookings: Record<string, number> | null
  payouts: Record<string, number> | null
  disputeActivity: number | null
  auditEvents: number | null
}

export async function getOperationsTimeline(args: { hours?: number }): Promise<ToolResult<OperationsTimelineData>> {
  const hours = Math.min(168, args.hours ?? 24)
  const since = new Date(Date.now() - hours * 3600000)

  const results = await safeQueryAll([
    () => prisma.booking.groupBy({
      by: ['status'],
      where: { updatedAt: { gte: since }, deletedAt: null } as any,
      _count: { id: true },
    }),
    () => prisma.payout.groupBy({
      by: ['status'],
      where: { updatedAt: { gte: since } },
      _count: { id: true },
    }),
    () => prisma.stripeDispute.count({
      where: { updatedAt: { gte: since } },
    }),
    () => prisma.auditLog.count({
      where: { createdAt: { gte: since } },
    }),
  ] as const, ['booking activity', 'payout activity', 'dispute activity', 'audit events'])

  const missing = results
    .map((result, index) => result.status === 'ERROR' ? ['booking activity', 'payout activity', 'dispute activity', 'audit events'][index] : null)
    .filter((label): label is string => label !== null)
  if (results.every((result) => result.status === 'ERROR')) {
    return toolError(`getOperationsTimeline: all queries failed — ${missing.join(', ')}`)
  }

  const value = <T,>(result: ToolResult<T>): T | null => result.status === 'SUCCESS' ? result.data : null
  const bookingRows = value(results[0]) as Array<{ status: string; _count: { id: number } }> | null
  const payoutRows = value(results[1]) as Array<{ status: string; _count: { id: number } }> | null
  const bookingSummary = bookingRows ? Object.fromEntries(bookingRows.map((row) => [row.status, row._count.id])) : null
  const payoutSummary = payoutRows ? Object.fromEntries(payoutRows.map((row) => [row.status, row._count.id])) : null

  const data: OperationsTimelineData = {
    period: `Last ${hours} hours`,
    bookings: bookingSummary,
    payouts: payoutSummary,
    disputeActivity: value(results[2]),
    auditEvents: value(results[3]),
  }
  return missing.length > 0 ? partial(data, missing) : ok(data)
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool dispatcher — called by the API route
// ─────────────────────────────────────────────────────────────────────────────
export type ToolArgumentValidation =
  | { valid: true; args: Record<string, unknown> }
  | { valid: false; error: string }

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function validateToolArguments(name: string, args: Record<string, unknown>): ToolArgumentValidation {
  const numericFields: Record<string, string[]> = {
    getInstructorRisk: ['limit', 'minScore'],
    getRevenueBreakdown: ['days'],
    getSuburbDemand: ['limit'],
    getOperationsTimeline: ['hours'],
  }
  const knownTools = new Set([
    'getDailySummary', 'getHealthScore', 'getInstructorRisk', 'getWeeklyReport',
    'getRevenueBreakdown', 'getStudentRetention', 'getSuburbDemand', 'getOperationsTimeline',
  ])

  if (!knownTools.has(name)) return { valid: false, error: `Unknown or unauthorized tool: ${name}` }

  const allowedFields = numericFields[name] ?? []
  for (const key of Object.keys(args)) {
    if (!allowedFields.includes(key)) return { valid: false, error: `Unexpected argument for ${name}: ${key}` }
    if (!isFiniteNumber(args[key]) || args[key] < 0) return { valid: false, error: `Invalid numeric argument for ${name}: ${key}` }
  }

  return { valid: true, args }
}

export async function callTool(name: string, args: Record<string, unknown>): Promise<ToolResult<unknown>> {
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
