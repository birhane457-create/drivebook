import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/health-score
 *
 * Calculates a 0–100 platform health score from 6 weighted signals.
 * All queries are non-fatal — a failing signal defaults to 50 (neutral).
 *
 * Weights:
 *   Booking completion rate     25
 *   Failed payment rate         20
 *   Open disputes               20
 *   Instructor onboarding       15
 *   Revenue trend WoW           10
 *   Failed payout rate          10
 *   Total                      100
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  const deny = await requirePermission(session, PERM.OPERATIONS_AUDIT_LOG_VIEW)
  if (deny) return deny

  const now = new Date()
  const last30 = new Date(now.getTime() - 30 * 86400000)
  const last7 = new Date(now.getTime() - 7 * 86400000)
  const prev7 = new Date(now.getTime() - 14 * 86400000)

  const signals: Record<string, { score: number; label: string; detail: string; weight: number }> = {}

  // ── 1. Booking completion rate (weight: 25) ──────────────────────────────
  try {
    const [completed, total] = await Promise.all([
      prisma.booking.count({
        where: { status: 'COMPLETED', updatedAt: { gte: last30 }, deletedAt: null } as any,
      }),
      prisma.booking.count({
        where: {
          status: { in: ['COMPLETED', 'CANCELLED', 'NO_SHOW'] },
          updatedAt: { gte: last30 },
          deletedAt: null,
        } as any,
      }),
    ])
    const rate = total > 0 ? completed / total : 1
    const score = Math.round(rate * 25)
    const pct = Math.round(rate * 100)
    signals.completionRate = {
      score,
      label: 'Booking Completion',
      detail: total > 0 ? `${pct}% (${completed}/${total} lessons)` : 'No data yet',
      weight: 25,
    }
  } catch {
    signals.completionRate = { score: 17, label: 'Booking Completion', detail: 'Unable to calculate', weight: 25 }
  }

  // ── 2. Failed payment rate (weight: 20) ──────────────────────────────────
  try {
    // Count bookings that were created but NEVER confirmed because payment failed
    // We use bookings that have been stuck in PENDING_PAYMENT for > 48h as the signal
    const cutoff = new Date(now.getTime() - 48 * 3600000)
    const [stuckOld, totalBookings30d] = await Promise.all([
      prisma.booking.count({
        where: { status: 'PENDING_PAYMENT', createdAt: { lt: cutoff }, deletedAt: null } as any,
      }),
      prisma.booking.count({
        where: { createdAt: { gte: last30 }, deletedAt: null } as any,
      }),
    ])
    const failRate = totalBookings30d > 0 ? stuckOld / totalBookings30d : 0
    // 0% stuck = 20pts, 20%+ = 0pts
    const score = Math.round(Math.max(0, 20 - failRate * 100))
    signals.paymentFailRate = {
      score,
      label: 'Payment Success',
      detail: totalBookings30d > 0
        ? stuckOld === 0
          ? 'All payments processing normally'
          : `${stuckOld} booking${stuckOld > 1 ? 's' : ''} stuck in pending payment (>48h)`
        : 'No bookings yet',
      weight: 20,
    }
  } catch {
    signals.paymentFailRate = { score: 14, label: 'Payment Success', detail: 'Unable to calculate', weight: 20 }
  }

  // ── 3. Open disputes (weight: 20) ────────────────────────────────────────
  try {
    const [open, totalApproved] = await Promise.all([
      (prisma as any).stripeDispute.count({
        where: { status: { in: ['warning_needs_response', 'needs_response', 'under_review'] } },
      }).catch(() => 0),
      prisma.instructor.count({ where: { approvalStatus: 'APPROVED' } }),
    ])
    // 0 disputes = 20pts, scales down: 1 per 20 instructors = 0pts
    const disputeRate = totalApproved > 0 ? open / totalApproved : 0
    const score = Math.round(Math.max(0, 20 - disputeRate * 400))
    signals.disputes = {
      score,
      label: 'Dispute Health',
      detail: open === 0 ? 'No open disputes' : `${open} open dispute${open > 1 ? 's' : ''}`,
      weight: 20,
    }
  } catch {
    signals.disputes = { score: 14, label: 'Dispute Health', detail: 'Unable to calculate', weight: 20 }
  }

  // ── 4. Instructor onboarding completion (weight: 15) ─────────────────────
  try {
    const [approved, stripeComplete] = await Promise.all([
      prisma.instructor.count({ where: { approvalStatus: 'APPROVED' } }),
      prisma.instructor.count({
        where: { approvalStatus: 'APPROVED', stripeAccountId: { not: null }, chargesEnabled: true },
      }),
    ])
    const completionRate = approved > 0 ? stripeComplete / approved : 1
    const score = Math.round(completionRate * 15)
    const pct = Math.round(completionRate * 100)
    signals.onboarding = {
      score,
      label: 'Instructor Onboarding',
      detail: approved > 0 ? `${pct}% Stripe-complete (${stripeComplete}/${approved})` : 'No instructors yet',
      weight: 15,
    }
  } catch {
    signals.onboarding = { score: 10, label: 'Instructor Onboarding', detail: 'Unable to calculate', weight: 15 }
  }

  // ── 5. Revenue trend week-over-week (weight: 10) ─────────────────────────
  try {
    const [thisWeek, lastWeek] = await Promise.all([
      (prisma as any).walletTransaction.aggregate({
        where: { createdAt: { gte: last7 }, type: 'CREDIT' },
        _sum: { amount: true },
      }).catch(() => ({ _sum: { amount: 0 } })),
      (prisma as any).walletTransaction.aggregate({
        where: { createdAt: { gte: prev7, lt: last7 }, type: 'CREDIT' },
        _sum: { amount: true },
      }).catch(() => ({ _sum: { amount: 0 } })),
    ])
    const tw = Number(thisWeek._sum?.amount ?? 0)
    const lw = Number(lastWeek._sum?.amount ?? 0)
    const change = lw > 0 ? (tw - lw) / lw : 0
    // -20%+ = 0pts, flat = 5pts, +20%+ = 10pts
    const score = Math.round(Math.min(10, Math.max(0, 5 + change * 25)))
    const pct = Math.round(change * 100)
    signals.revenueTrend = {
      score,
      label: 'Revenue Trend',
      detail: lw > 0 ? `${pct >= 0 ? '+' : ''}${pct}% WoW ($${tw.toFixed(0)} vs $${lw.toFixed(0)})` : 'First week of data',
      weight: 10,
    }
  } catch {
    signals.revenueTrend = { score: 5, label: 'Revenue Trend', detail: 'Unable to calculate', weight: 10 }
  }

  // ── 6. Failed payout rate (weight: 10) ───────────────────────────────────
  try {
    const [failed, total] = await Promise.all([
      (prisma as any).payout.count({
        where: { status: 'FAILED', createdAt: { gte: last30 } },
      }).catch(() => 0),
      (prisma as any).payout.count({
        where: { createdAt: { gte: last30 } },
      }).catch(() => 0),
    ])
    const failRate = total > 0 ? failed / total : 0
    const score = Math.round(Math.max(0, 10 - failRate * 50))
    signals.payoutFailRate = {
      score,
      label: 'Payout Reliability',
      detail: total > 0
        ? failed === 0 ? `All ${total} payouts succeeded` : `${failed} of ${total} payouts failed`
        : 'No payouts yet',
      weight: 10,
    }
  } catch {
    signals.payoutFailRate = { score: 7, label: 'Payout Reliability', detail: 'Unable to calculate', weight: 10 }
  }

  // ── Aggregate ─────────────────────────────────────────────────────────────
  const totalScore = Object.values(signals).reduce((sum, s) => sum + s.score, 0)
  const clampedScore = Math.min(100, Math.max(0, totalScore))

  const status: 'healthy' | 'watch' | 'critical' =
    clampedScore >= 90 ? 'healthy' : clampedScore >= 70 ? 'watch' : 'critical'

  return NextResponse.json({
    score: clampedScore,
    status,
    signals: Object.entries(signals).map(([key, s]) => ({
      key,
      label: s.label,
      score: s.score,
      maxScore: s.weight,
      detail: s.detail,
    })),
    generatedAt: now.toISOString(),
  })
}
