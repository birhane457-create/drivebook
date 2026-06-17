import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/operations-timeline
 *
 * Returns a unified chronological event feed sourced from:
 *   - AuditLog      (instructor approvals, bookings, payouts, settings changes)
 *   - Booking       (created, confirmed, completed, cancelled, no-show)
 *   - Payout        (created, sent, failed)
 *   - StripeDispute (opened, resolved)
 *
 * Query params:
 *   hours   number  look-back window in hours (default 24, max 168 = 7 days)
 *   limit   number  max events to return (default 50, max 200)
 *   types   string  comma-separated filter: audit,booking,payout,dispute
 */

type EventType =
  | 'instructor_approved' | 'instructor_rejected' | 'instructor_suspended'
  | 'booking_created' | 'booking_confirmed' | 'booking_completed'
  | 'booking_cancelled' | 'booking_no_show'
  | 'payout_sent' | 'payout_failed' | 'payout_created'
  | 'dispute_opened' | 'dispute_resolved'
  | 'stripe_onboarding' | 'document_verified'
  | 'audit_event'

type EventSeverity = 'info' | 'success' | 'warning' | 'error'

interface TimelineEvent {
  id: string
  type: EventType
  severity: EventSeverity
  title: string
  detail: string | null
  actorName: string | null
  link: string | null
  timestamp: string
  source: 'audit' | 'booking' | 'payout' | 'dispute'
}

const BOOKING_STATUS_MAP: Record<string, { type: EventType; severity: EventSeverity; title: string }> = {
  CONFIRMED:      { type: 'booking_confirmed',  severity: 'success', title: 'Booking confirmed' },
  COMPLETED:      { type: 'booking_completed',  severity: 'success', title: 'Lesson completed' },
  CANCELLED:      { type: 'booking_cancelled',  severity: 'warning', title: 'Booking cancelled' },
  NO_SHOW:        { type: 'booking_no_show',    severity: 'error',   title: 'No-show recorded' },
  PENDING:        { type: 'booking_created',    severity: 'info',    title: 'Booking created' },
  PENDING_PAYMENT:{ type: 'booking_created',    severity: 'warning', title: 'Booking awaiting payment' },
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const hours = Math.min(168, Math.max(1, parseInt(searchParams.get('hours') ?? '24', 10)))
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))
  const typesParam = searchParams.get('types')
  const typeFilter = typesParam ? typesParam.split(',').map((t) => t.trim()) : ['audit', 'booking', 'payout', 'dispute']

  const since = new Date(Date.now() - hours * 3600000)
  const events: TimelineEvent[] = []

  // ── Audit Log ─────────────────────────────────────────────────────────────
  if (typeFilter.includes('audit')) {
    const auditRows = await prisma.auditLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, action: true, actorId: true, actorRole: true,
        targetType: true, targetId: true, metadata: true,
        success: true, errorMessage: true, createdAt: true,
      },
    }).catch(() => [])

    for (const row of auditRows) {
      const meta = row.metadata as Record<string, any> | null
      let type: EventType = 'audit_event'
      let severity: EventSeverity = row.success ? 'info' : 'error'
      let title = row.action.replace(/_/g, ' ').toLowerCase()
      let detail: string | null = null
      let link: string | null = null

      if (row.action === 'INSTRUCTOR_APPROVED') {
        type = 'instructor_approved'; severity = 'success'; title = 'Instructor approved'
        link = `/admin/instructors/${row.targetId}`
        detail = meta?.instructorName ?? null
      } else if (row.action === 'INSTRUCTOR_REJECTED') {
        type = 'instructor_rejected'; severity = 'warning'; title = 'Instructor rejected'
        link = `/admin/instructors/${row.targetId}`
        detail = meta?.instructorName ?? null
      } else if (row.action === 'INSTRUCTOR_SUSPENDED') {
        type = 'instructor_suspended'; severity = 'error'; title = 'Instructor suspended'
        link = `/admin/instructors/${row.targetId}`
        detail = meta?.instructorName ?? null
      } else if (row.action === 'DOCUMENTS_VERIFIED') {
        type = 'document_verified'; severity = 'success'; title = 'Documents verified'
        link = `/admin/instructors/${row.targetId}`
      } else if (row.action === 'STRIPE_ONBOARDING_COMPLETE') {
        type = 'stripe_onboarding'; severity = 'success'; title = 'Stripe onboarding completed'
        link = `/admin/instructors/${row.targetId}`
      } else if (row.action === 'ADMIN_AI_QUERY') {
        type = 'audit_event'; severity = 'info'; title = 'AI copilot query'
        detail = meta?.question ? `"${String(meta.question).slice(0, 80)}"` : null
      } else if (row.action === 'BOOKING_CREATED') {
        type = 'booking_created'; severity = 'info'; title = 'Booking created'
        link = `/admin/bookings`
      } else if (row.action === 'BOOKING_CANCELLED') {
        type = 'booking_cancelled'; severity = 'warning'; title = 'Booking cancelled'
        link = `/admin/bookings`
      } else if (row.action === 'PAYOUT_SENT') {
        type = 'payout_sent'; severity = 'success'; title = 'Payout sent'
        link = `/admin/payouts`
      } else if (row.action === 'PAYOUT_FAILED') {
        type = 'payout_failed'; severity = 'error'; title = 'Payout failed'
        link = `/admin/payouts`
      } else if (row.action.includes('_')) {
        // Generic: convert SNAKE_CASE to Title Case
        title = row.action.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        severity = row.success ? 'info' : 'error'
        detail = row.errorMessage ?? null
      } else if (!row.success) {
        severity = 'error'
        detail = row.errorMessage ?? null
      }
      events.push({
        id: `audit-${row.id}`,
        type,
        severity,
        title,
        detail,
        actorName: meta?.actorName ?? row.actorRole ?? null,
        link,
        timestamp: row.createdAt.toISOString(),
        source: 'audit',
      })
    }
  }

  // ── Bookings ──────────────────────────────────────────────────────────────
  if (typeFilter.includes('booking')) {
    const bookingRows = await prisma.booking.findMany({
      where: { updatedAt: { gte: since }, deletedAt: null } as any,
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: {
        id: true, status: true, price: true, updatedAt: true,
        instructor: { select: { name: true } },
        client: { select: { name: true } },
        clientName: true,
      },
    }).catch(() => [])

    for (const row of bookingRows) {
      const cfg = BOOKING_STATUS_MAP[row.status as string] ?? {
        type: 'booking_created' as EventType, severity: 'info' as EventSeverity, title: `Booking ${row.status}`,
      }
      const clientName = (row as any).client?.name ?? (row as any).clientName ?? 'Unknown student'
      const instructorName = (row as any).instructor?.name ?? 'Unknown instructor'
      events.push({
        id: `booking-${row.id}`,
        type: cfg.type,
        severity: cfg.severity,
        title: cfg.title,
        detail: `${clientName} with ${instructorName}${(row as any).price ? ` · $${(row as any).price.toFixed(0)}` : ''}`,
        actorName: instructorName,
        link: `/admin/bookings`,
        timestamp: (row as any).updatedAt.toISOString(),
        source: 'booking',
      })
    }
  }

  // ── Payouts ───────────────────────────────────────────────────────────────
  if (typeFilter.includes('payout')) {
    const payoutRows = await (prisma as any).payout.findMany({
      where: { updatedAt: { gte: since } },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true, status: true, netAmount: true, updatedAt: true, failureReason: true,
        instructor: { select: { name: true } },
      },
    }).catch(() => [])

    for (const row of payoutRows) {
      const amount = `$${(row.netAmount / 100).toFixed(0)}`
      const instructorName = row.instructor?.name ?? 'Unknown'
      let type: EventType = 'payout_created'
      let severity: EventSeverity = 'info'
      let title = 'Payout created'

      if (row.status === 'SENT' || row.status === 'COMPLETED') {
        type = 'payout_sent'; severity = 'success'; title = 'Payout sent'
      } else if (row.status === 'FAILED') {
        type = 'payout_failed'; severity = 'error'; title = 'Payout failed'
      }

      events.push({
        id: `payout-${row.id}`,
        type,
        severity,
        title,
        detail: `${instructorName} · ${amount}${row.failureReason ? ` — ${row.failureReason}` : ''}`,
        actorName: instructorName,
        link: '/admin/payouts',
        timestamp: row.updatedAt.toISOString(),
        source: 'payout',
      })
    }
  }

  // ── Disputes ──────────────────────────────────────────────────────────────
  if (typeFilter.includes('dispute')) {
    const disputeRows = await (prisma as any).stripeDispute.findMany({
      where: { updatedAt: { gte: since } },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      select: {
        id: true, status: true, amount: true, reason: true, updatedAt: true, resolvedAt: true,
      },
    }).catch(() => [])

    for (const row of disputeRows) {
      const isResolved = ['won', 'lost', 'charge_refunded', 'warning_closed'].includes(row.status)
      const amount = `$${(row.amount / 100).toFixed(0)}`
      events.push({
        id: `dispute-${row.id}`,
        type: isResolved ? 'dispute_resolved' : 'dispute_opened',
        severity: isResolved ? (row.status === 'won' ? 'success' : 'warning') : 'error',
        title: isResolved ? `Dispute ${row.status.replace(/_/g, ' ')}` : 'Dispute opened',
        detail: `${amount} · ${(row.reason ?? 'unknown').replace(/_/g, ' ')}`,
        actorName: null,
        link: '/admin/disputes',
        timestamp: row.updatedAt.toISOString(),
        source: 'dispute',
      })
    }
  }

  // ── Sort all events newest-first, deduplicate by id, apply limit ──────────
  const seen = new Set<string>()
  const sorted = events
    .filter((e) => { if (seen.has(e.id)) return false; seen.add(e.id); return true })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit)

  return NextResponse.json({
    events: sorted,
    total: sorted.length,
    since: since.toISOString(),
    generatedAt: new Date().toISOString(),
  })
}
