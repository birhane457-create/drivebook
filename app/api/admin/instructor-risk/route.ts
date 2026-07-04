import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/instructor-risk
 *
 * Scores every approved instructor 0–100 for risk.
 * Higher score = higher risk. Signals:
 *
 *   Cancellation rate (30d)        max 20pts
 *   No-show rate (30d)             max 20pts
 *   Open disputes                  max 20pts
 *   Stripe onboarding incomplete   max 15pts
 *   Expiring documents (<30d)      max 15pts
 *   Low booking volume trend       max 5pts
 *   Low completion rate (30d)      max 5pts
 *   Total                          max 100pts
 *
 * Query params:
 *   minScore  number  only return instructors >= this risk score (default 0)
 *   limit     number  max results (default 50)
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const minScore = parseInt(searchParams.get('minScore') ?? '0', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)

  const now = new Date()
  const last30 = new Date(now.getTime() - 30 * 86400000)
  const last7 = new Date(now.getTime() - 7 * 86400000)
  const prev7 = new Date(now.getTime() - 14 * 86400000)
  const in30Days = new Date(now.getTime() + 30 * 86400000)

  // ── Fetch all approved instructors ────────────────────────────────────────
  const instructors = await prisma.instructor.findMany({
    where: { approvalStatus: 'APPROVED' },
    select: {
      id: true,
      name: true,
      phone: true,
      stripeAccountId: true,
      chargesEnabled: true,
      licenseExpiry: true,
      insuranceExpiry: true,
      policeCheckExpiry: true,
      wwcCheckExpiry: true,
      abnVerified: true,
      payoutHold: true,
    },
  })

  if (instructors.length === 0) {
    return NextResponse.json({ instructors: [], generatedAt: now.toISOString() })
  }

  const ids = instructors.map((i) => i.id)

  // ── Batch queries for all instructors at once ─────────────────────────────

  // Bookings last 30d grouped by instructor + status
  const bookings30d = await prisma.booking.groupBy({
    by: ['instructorId', 'status'],
    where: {
      instructorId: { in: ids },
      createdAt: { gte: last30 },
      deletedAt: null,
    } as any,
    _count: { id: true },
  }).catch(() => [])

  // Bookings this week vs last week (volume trend)
  const [bookingsThisWeek, bookingsLastWeek] = await Promise.all([
    prisma.booking.groupBy({
      by: ['instructorId'],
      where: { instructorId: { in: ids }, createdAt: { gte: last7 }, deletedAt: null } as any,
      _count: { id: true },
    }).catch(() => []),
    prisma.booking.groupBy({
      by: ['instructorId'],
      where: { instructorId: { in: ids }, createdAt: { gte: prev7, lt: last7 }, deletedAt: null } as any,
      _count: { id: true },
    }).catch(() => []),
  ])

  // Open disputes per instructor
  const openDisputes = await (prisma as any).stripeDispute.groupBy({
    by: ['instructorId'],
    where: {
      instructorId: { in: ids },
      status: { in: ['warning_needs_response', 'needs_response', 'under_review'] },
    },
    _count: { id: true },
  }).catch(() => [])

  // ── Index into maps for O(1) lookup ───────────────────────────────────────
  type BookingCount = { instructorId: string; status: string; _count: { id: number } }

  const bookingMap: Record<string, Record<string, number>> = {}
  for (const row of bookings30d as BookingCount[]) {
    if (!bookingMap[row.instructorId]) bookingMap[row.instructorId] = {}
    bookingMap[row.instructorId][row.status] = row._count.id
  }

  const thisWeekMap: Record<string, number> = {}
  for (const row of bookingsThisWeek as { instructorId: string; _count: { id: number } }[]) {
    thisWeekMap[row.instructorId] = row._count.id
  }

  const lastWeekMap: Record<string, number> = {}
  for (const row of bookingsLastWeek as { instructorId: string; _count: { id: number } }[]) {
    lastWeekMap[row.instructorId] = row._count.id
  }

  const disputeMap: Record<string, number> = {}
  for (const row of openDisputes as { instructorId: string; _count: { id: number } }[]) {
    if (row.instructorId) disputeMap[row.instructorId] = row._count.id
  }

  // ── Score each instructor ─────────────────────────────────────────────────
  type RiskFlag = {
    label: string
    severity: 'high' | 'medium' | 'low'
    points: number
  }

  const results = instructors.map((instructor) => {
    const counts = bookingMap[instructor.id] ?? {}
    const completed = counts['COMPLETED'] ?? 0
    const cancelled = counts['CANCELLED'] ?? 0
    const noShow = counts['NO_SHOW'] ?? 0
    const total = Object.values(counts).reduce((s, n) => s + n, 0)
    const finalized = completed + cancelled + noShow

    const tw = thisWeekMap[instructor.id] ?? 0
    const lw = lastWeekMap[instructor.id] ?? 0
    const disputes = disputeMap[instructor.id] ?? 0

    let riskScore = 0
    const flags: RiskFlag[] = []

    // 1. Cancellation rate (max 20pts)
    if (finalized > 0) {
      const cancelRate = cancelled / finalized
      if (cancelRate >= 0.4) {
        riskScore += 20
        flags.push({ label: `${cancelled} cancellations in 30 days (${Math.round(cancelRate * 100)}% rate)`, severity: 'high', points: 20 })
      } else if (cancelRate >= 0.2) {
        riskScore += 12
        flags.push({ label: `${cancelled} cancellations in 30 days (${Math.round(cancelRate * 100)}% rate)`, severity: 'medium', points: 12 })
      } else if (cancelRate >= 0.1) {
        riskScore += 6
        flags.push({ label: `${cancelled} cancellations in 30 days`, severity: 'low', points: 6 })
      }
    }

    // 2. No-show rate (max 20pts)
    if (finalized > 0) {
      const noShowRate = noShow / finalized
      if (noShowRate >= 0.2) {
        riskScore += 20
        flags.push({ label: `${noShow} no-shows in 30 days (${Math.round(noShowRate * 100)}% rate)`, severity: 'high', points: 20 })
      } else if (noShowRate >= 0.1) {
        riskScore += 10
        flags.push({ label: `${noShow} no-shows in 30 days`, severity: 'medium', points: 10 })
      } else if (noShow > 0) {
        riskScore += 4
        flags.push({ label: `${noShow} no-show recorded`, severity: 'low', points: 4 })
      }
    }

    // 3. Open disputes (max 20pts)
    if (disputes >= 2) {
      riskScore += 20
      flags.push({ label: `${disputes} open disputes`, severity: 'high', points: 20 })
    } else if (disputes === 1) {
      riskScore += 12
      flags.push({ label: '1 open dispute', severity: 'high', points: 12 })
    }

    // 4. Stripe onboarding incomplete (max 15pts)
    if (!instructor.stripeAccountId) {
      riskScore += 15
      flags.push({ label: 'Stripe account not connected', severity: 'high', points: 15 })
    } else if (!instructor.chargesEnabled) {
      riskScore += 8
      flags.push({ label: 'Stripe onboarding incomplete', severity: 'medium', points: 8 })
    }

    // 5. Expiring documents within 30 days (max 15pts total across all docs)
    const expiryChecks = [
      { field: 'Driving licence', date: instructor.licenseExpiry },
      { field: 'Insurance policy', date: instructor.insuranceExpiry },
      { field: 'Police check', date: instructor.policeCheckExpiry },
      { field: 'Working With Children Check', date: instructor.wwcCheckExpiry },
    ]

    let docPoints = 0
    for (const check of expiryChecks) {
      if (!check.date) continue
      const daysLeft = Math.ceil((check.date.getTime() - now.getTime()) / 86400000)
      if (daysLeft <= 0) {
        flags.push({ label: `${check.field} has expired`, severity: 'high', points: 15 })
        docPoints = 15 // max — expired doc already caps the signal
      } else if (daysLeft <= 14 && docPoints < 15) {
        const pts = Math.min(12, 15 - docPoints)
        docPoints = Math.min(15, docPoints + pts)
        flags.push({ label: `${check.field} expires in ${daysLeft} days`, severity: 'high', points: pts })
      } else if (daysLeft <= 30 && docPoints < 8) {
        flags.push({ label: `${check.field} expires in ${daysLeft} days`, severity: 'medium', points: 8 })
        docPoints = Math.min(15, docPoints + 8)
      }
    }
    riskScore += docPoints

    // 6. Low booking volume trend (max 5pts)
    if (lw > 0 && tw < lw * 0.5) {
      riskScore += 5
      flags.push({ label: `Booking volume dropped ${Math.round((1 - tw / lw) * 100)}% this week`, severity: 'low', points: 5 })
    } else if (total === 0) {
      riskScore += 3
      flags.push({ label: 'No bookings in 30 days', severity: 'low', points: 3 })
    }

    // 7. Low completion rate (max 5pts)
    if (finalized >= 5 && completed / finalized < 0.5) {
      riskScore += 5
      flags.push({ label: `Low lesson completion rate (${Math.round((completed / finalized) * 100)}%)`, severity: 'medium', points: 5 })
    }

    // Payout hold — informational flag, no score impact (already counted via disputes)
    if (instructor.payoutHold) {
      flags.push({ label: 'Payout on hold', severity: 'high', points: 0 })
    }

    const clampedScore = Math.min(100, riskScore)
    const level: 'low' | 'medium' | 'high' =
      clampedScore >= 60 ? 'high' : clampedScore >= 30 ? 'medium' : 'low'

    return {
      id: instructor.id,
      name: instructor.name,
      phone: instructor.phone,
      riskScore: clampedScore,
      riskLevel: level,
      flags,
      stats: {
        bookings30d: total,
        completed,
        cancelled,
        noShow,
        openDisputes: disputes,
        bookingsThisWeek: tw,
        bookingsLastWeek: lw,
      },
    }
  })

  // Sort by risk score descending, apply minScore filter, apply limit
  const filtered = results
    .filter((r) => r.riskScore >= minScore)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, limit)

  // Summary counts
  const summary = {
    total: results.length,
    high: results.filter((r) => r.riskLevel === 'high').length,
    medium: results.filter((r) => r.riskLevel === 'medium').length,
    low: results.filter((r) => r.riskLevel === 'low').length,
  }

  return NextResponse.json({
    instructors: filtered,
    summary,
    generatedAt: now.toISOString(),
  })
}
