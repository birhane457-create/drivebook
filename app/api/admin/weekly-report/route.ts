import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/weekly-report
 *
 * Aggregates a full weekly executive report covering the last 7 days
 * vs the prior 7 days. Returns structured JSON used by both the
 * dashboard widget and the email send action.
 *
 * POST /api/admin/weekly-report
 *
 * Triggers an email send of the weekly report to the admin email address
 * configured in ADMIN_REPORT_EMAIL (falls back to NEXTAUTH_EMAIL).
 * Uses the existing Nodemailer/SMTP transport already in the project.
 */

interface WeeklyReport {
  period: { from: string; to: string; label: string }
  revenue: { thisWeek: number; lastWeek: number; changePercent: number | null }
  bookings: {
    thisWeek: number; lastWeek: number; changePercent: number | null
    completed: number; cancelled: number; completionRate: number | null
  }
  users: { newStudents: number; newInstructors: number; totalStudents: number; totalInstructors: number }
  instructors: { active: number; approved: number; pendingApproval: number; highRisk: number }
  openIssues: {
    openDisputes: number; failedPayouts: number; stuckPayments: number
    stripeIncomplete: number; expiringDocs: number
  }
  topInstructor: { name: string; completedLessons: number } | null
  highestRiskInstructor: { name: string; riskScore: number; topFlag: string } | null
  healthScore: number | null
  generatedAt: string
}

async function buildReport(): Promise<WeeklyReport> {
  const now = new Date()
  const weekStart = new Date(now.getTime() - 7 * 86400000)
  const prevWeekStart = new Date(now.getTime() - 14 * 86400000)
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000)
  const last30 = new Date(now.getTime() - 30 * 86400000)

  const [
    revenueThis, revenueLast,
    bookingsThis, bookingsLast,
    completedThis, cancelledThis,
    newStudents, newInstructors,
    totalStudents, totalInstructors,
    approvedInstructors, pendingApprovals,
    openDisputes, failedPayouts, stuckPayments, stripeIncomplete, expiringDocs,
    topInstructorRows,
  ] = await Promise.all([
    (prisma as any).walletTransaction.aggregate({
      where: { createdAt: { gte: weekStart }, type: 'CREDIT' },
      _sum: { amount: true },
    }).catch(() => ({ _sum: { amount: 0 } })),

    (prisma as any).walletTransaction.aggregate({
      where: { createdAt: { gte: prevWeekStart, lt: weekStart }, type: 'CREDIT' },
      _sum: { amount: true },
    }).catch(() => ({ _sum: { amount: 0 } })),

    prisma.booking.count({
      where: { createdAt: { gte: weekStart }, deletedAt: null } as any,
    }).catch(() => 0),

    prisma.booking.count({
      where: { createdAt: { gte: prevWeekStart, lt: weekStart }, deletedAt: null } as any,
    }).catch(() => 0),

    prisma.booking.count({
      where: { status: 'COMPLETED', updatedAt: { gte: weekStart }, deletedAt: null } as any,
    }).catch(() => 0),

    prisma.booking.count({
      where: { status: 'CANCELLED', updatedAt: { gte: weekStart }, deletedAt: null } as any,
    }).catch(() => 0),

    prisma.client.count({ where: { createdAt: { gte: weekStart } } }).catch(() => 0),
    prisma.instructor.count({ where: { createdAt: { gte: weekStart } } as any }).catch(() => 0),
    prisma.client.count().catch(() => 0),
    prisma.instructor.count().catch(() => 0),
    prisma.instructor.count({ where: { approvalStatus: 'APPROVED', isActive: true } }).catch(() => 0),
    prisma.instructor.count({ where: { approvalStatus: 'PENDING' } }).catch(() => 0),

    (prisma as any).stripeDispute.count({
      where: { status: { in: ['warning_needs_response', 'needs_response', 'under_review'] } },
    }).catch(() => 0),

    (prisma as any).payout.count({
      where: { status: 'FAILED', createdAt: { gte: last30 } },
    }).catch(() => 0),

    prisma.booking.count({
      where: { status: 'PENDING_PAYMENT', createdAt: { lt: new Date(now.getTime() - 86400000) }, deletedAt: null } as any,
    }).catch(() => 0),

    prisma.instructor.count({
      where: { approvalStatus: 'APPROVED', stripeAccountId: null },
    }).catch(() => 0),

    prisma.instructor.count({
      where: {
        approvalStatus: 'APPROVED',
        OR: [
          { licenseExpiry: { gte: now, lte: thirtyDaysFromNow } },
          { insuranceExpiry: { gte: now, lte: thirtyDaysFromNow } },
        ],
      },
    }).catch(() => 0),

    prisma.booking.groupBy({
      by: ['instructorId'],
      where: { status: 'COMPLETED', updatedAt: { gte: weekStart }, deletedAt: null } as any,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 1,
    }).catch(() => []),
  ])

  // Resolve top instructor name
  let topInstructor: WeeklyReport['topInstructor'] = null
  if (topInstructorRows.length > 0) {
    const top = topInstructorRows[0] as any
    const inst = await prisma.instructor.findUnique({
      where: { id: top.instructorId },
      select: { name: true },
    }).catch(() => null)
    if (inst) topInstructor = { name: inst.name, completedLessons: top._count.id }
  }

  // Find highest risk instructor (cancellations + disputes proxy)
  let highestRiskInstructor: WeeklyReport['highestRiskInstructor'] = null
  try {
    const cancellationLeaders = await prisma.booking.groupBy({
      by: ['instructorId'],
      where: { status: 'CANCELLED', updatedAt: { gte: last30 }, deletedAt: null } as any,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 1,
    })
    if (cancellationLeaders.length > 0) {
      const leader = cancellationLeaders[0] as any
      const inst = await prisma.instructor.findUnique({
        where: { id: leader.instructorId },
        select: { name: true },
      }).catch(() => null)
      if (inst) {
        highestRiskInstructor = {
          name: inst.name,
          riskScore: Math.min(100, leader._count.id * 10),
          topFlag: `${leader._count.id} cancellations in 30 days`,
        }
      }
    }
  } catch { /* non-fatal */ }

  // Fetch current health score
  let healthScore: number | null = null
  try {
    const latest = await (prisma as any).adminBrief.findFirst({
      orderBy: { date: 'desc' },
      select: { healthScore: true },
    }).catch(() => null)
    healthScore = latest?.healthScore ?? null
  } catch { /* non-fatal */ }

  const tw = Number(revenueThis._sum?.amount ?? 0)
  const lw = Number(revenueLast._sum?.amount ?? 0)
  const revenueChange = lw > 0 ? Math.round(((tw - lw) / lw) * 100) : null
  const bookingChange = bookingsLast > 0
    ? Math.round(((bookingsThis - bookingsLast) / bookingsLast) * 100)
    : null
  const finalized = completedThis + cancelledThis
  const completionRate = finalized > 0 ? Math.round((completedThis / finalized) * 100) : null

  return {
    period: {
      from: weekStart.toISOString(),
      to: now.toISOString(),
      label: `Week of ${weekStart.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`,
    },
    revenue: { thisWeek: tw, lastWeek: lw, changePercent: revenueChange },
    bookings: {
      thisWeek: bookingsThis,
      lastWeek: bookingsLast,
      changePercent: bookingChange,
      completed: completedThis,
      cancelled: cancelledThis,
      completionRate,
    },
    users: { newStudents, newInstructors, totalStudents, totalInstructors },
    instructors: {
      active: approvedInstructors,
      approved: approvedInstructors,
      pendingApproval: pendingApprovals,
      highRisk: 0, // populated by risk monitor separately if needed
    },
    openIssues: { openDisputes, failedPayouts, stuckPayments, stripeIncomplete, expiringDocs },
    topInstructor,
    highestRiskInstructor,
    healthScore,
    generatedAt: now.toISOString(),
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const report = await buildReport()
  return NextResponse.json(report)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const report = await buildReport()

  const recipientEmail =
    process.env.ADMIN_REPORT_EMAIL ||
    process.env.ADMIN_EMAIL ||
    session.user.email

  if (!recipientEmail) {
    return NextResponse.json({ error: 'No recipient email configured. Set ADMIN_REPORT_EMAIL in .env.' }, { status: 503 })
  }

  // Build HTML email
  const sign = (n: number | null) => n === null ? '—' : n >= 0 ? `+${n}%` : `${n}%`
  const fmt = (n: number) => n > 0 ? `$${n.toFixed(0)}` : '$0'

  const totalIssues = Object.values(report.openIssues).reduce((s, v) => s + v, 0)

  const issueLines = [
    report.openIssues.openDisputes > 0 && `<li>${report.openIssues.openDisputes} open dispute${report.openIssues.openDisputes > 1 ? 's' : ''}</li>`,
    report.openIssues.failedPayouts > 0 && `<li>${report.openIssues.failedPayouts} failed payout${report.openIssues.failedPayouts > 1 ? 's' : ''}</li>`,
    report.openIssues.stuckPayments > 0 && `<li>${report.openIssues.stuckPayments} stuck payment${report.openIssues.stuckPayments > 1 ? 's' : ''}</li>`,
    report.openIssues.stripeIncomplete > 0 && `<li>${report.openIssues.stripeIncomplete} instructor${report.openIssues.stripeIncomplete > 1 ? 's' : ''} with incomplete Stripe onboarding</li>`,
    report.openIssues.expiringDocs > 0 && `<li>${report.openIssues.expiringDocs} instructor${report.openIssues.expiringDocs > 1 ? 's' : ''} with documents expiring soon</li>`,
  ].filter(Boolean).join('\n')

  const healthLabel =
    report.healthScore === null ? '—' :
    report.healthScore >= 90 ? `${report.healthScore}/100 🟢 Healthy` :
    report.healthScore >= 70 ? `${report.healthScore}/100 🟡 Watch` :
    `${report.healthScore}/100 🔴 Needs Attention`

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DriveBook Weekly Executive Report</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">

    <!-- Header -->
    <div style="background:#1e293b;border:1px solid #334155;border-radius:16px;padding:24px;margin-bottom:16px;">
      <p style="margin:0 0 4px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;">DriveBook</p>
      <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#f1f5f9;">Weekly Executive Report</h1>
      <p style="margin:0;font-size:13px;color:#64748b;">${report.period.label} · Generated ${new Date(report.generatedAt).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
    </div>

    <!-- Health Score -->
    <div style="background:#1e293b;border:1px solid #334155;border-radius:16px;padding:20px;margin-bottom:16px;">
      <p style="margin:0 0 8px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;">Platform Health</p>
      <p style="margin:0;font-size:20px;font-weight:700;color:#f1f5f9;">${healthLabel}</p>
    </div>

    <!-- Key Metrics -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
      <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:16px;">
        <p style="margin:0 0 4px;font-size:11px;color:#64748b;text-transform:uppercase;">Revenue</p>
        <p style="margin:0 0 2px;font-size:24px;font-weight:700;color:#34d399;">${fmt(report.revenue.thisWeek)}</p>
        <p style="margin:0;font-size:12px;color:#64748b;">${sign(report.revenue.changePercent)} vs last week</p>
      </div>
      <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:16px;">
        <p style="margin:0 0 4px;font-size:11px;color:#64748b;text-transform:uppercase;">Bookings</p>
        <p style="margin:0 0 2px;font-size:24px;font-weight:700;color:#f1f5f9;">${report.bookings.thisWeek}</p>
        <p style="margin:0;font-size:12px;color:#64748b;">${sign(report.bookings.changePercent)} vs last week</p>
      </div>
      <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:16px;">
        <p style="margin:0 0 4px;font-size:11px;color:#64748b;text-transform:uppercase;">Completion Rate</p>
        <p style="margin:0 0 2px;font-size:24px;font-weight:700;color:#f1f5f9;">${report.bookings.completionRate !== null ? `${report.bookings.completionRate}%` : '—'}</p>
        <p style="margin:0;font-size:12px;color:#64748b;">${report.bookings.completed} completed · ${report.bookings.cancelled} cancelled</p>
      </div>
      <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:16px;">
        <p style="margin:0 0 4px;font-size:11px;color:#64748b;text-transform:uppercase;">New Users</p>
        <p style="margin:0 0 2px;font-size:24px;font-weight:700;color:#f1f5f9;">${report.users.newStudents + report.users.newInstructors}</p>
        <p style="margin:0;font-size:12px;color:#64748b;">${report.users.newStudents} students · ${report.users.newInstructors} instructors</p>
      </div>
    </div>

    <!-- Platform Totals -->
    <div style="background:#1e293b;border:1px solid #334155;border-radius:16px;padding:20px;margin-bottom:16px;">
      <p style="margin:0 0 12px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;">Platform Totals</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:4px 0;font-size:13px;color:#94a3b8;">Active instructors</td>
          <td style="padding:4px 0;font-size:13px;font-weight:600;color:#f1f5f9;text-align:right;">${report.instructors.active}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:13px;color:#94a3b8;">Total students</td>
          <td style="padding:4px 0;font-size:13px;font-weight:600;color:#f1f5f9;text-align:right;">${report.users.totalStudents}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:13px;color:#94a3b8;">Pending approvals</td>
          <td style="padding:4px 0;font-size:13px;font-weight:600;color:${report.instructors.pendingApproval > 0 ? '#fbbf24' : '#f1f5f9'};text-align:right;">${report.instructors.pendingApproval}</td>
        </tr>
      </table>
    </div>

    <!-- Top Instructor -->
    ${report.topInstructor ? `
    <div style="background:#1e293b;border:1px solid #334155;border-radius:16px;padding:20px;margin-bottom:16px;">
      <p style="margin:0 0 8px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;">⭐ Top Instructor This Week</p>
      <p style="margin:0 0 2px;font-size:16px;font-weight:700;color:#f1f5f9;">${report.topInstructor.name}</p>
      <p style="margin:0;font-size:13px;color:#64748b;">${report.topInstructor.completedLessons} lessons completed</p>
    </div>` : ''}

    <!-- Highest Risk -->
    ${report.highestRiskInstructor ? `
    <div style="background:#1e293b;border:1px solid #7f1d1d33;border-radius:16px;padding:20px;margin-bottom:16px;">
      <p style="margin:0 0 8px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;">⚠️ Highest Risk Instructor</p>
      <p style="margin:0 0 2px;font-size:16px;font-weight:700;color:#fca5a5;">${report.highestRiskInstructor.name}</p>
      <p style="margin:0;font-size:13px;color:#94a3b8;">${report.highestRiskInstructor.topFlag}</p>
    </div>` : ''}

    <!-- Open Issues -->
    ${totalIssues > 0 ? `
    <div style="background:#1e293b;border:1px solid #7f1d1d33;border-radius:16px;padding:20px;margin-bottom:16px;">
      <p style="margin:0 0 12px;font-size:11px;color:#ef4444;text-transform:uppercase;letter-spacing:.08em;">🔴 Open Issues (${totalIssues})</p>
      <ul style="margin:0;padding-left:18px;font-size:13px;color:#fca5a5;line-height:1.8;">
        ${issueLines}
      </ul>
    </div>` : `
    <div style="background:#1e293b;border:1px solid #14532d33;border-radius:16px;padding:20px;margin-bottom:16px;">
      <p style="margin:0;font-size:13px;color:#86efac;">✅ No open issues — platform is operating cleanly.</p>
    </div>`}

    <!-- Footer -->
    <p style="text-align:center;font-size:11px;color:#334155;margin-top:24px;">
      DriveBook Admin · Auto-generated report · ${new Date(report.generatedAt).toLocaleString('en-AU')}
    </p>
  </div>
</body>
</html>`

  // Send via Nodemailer (same transport used for booking confirmations)
  try {
    const { emailService } = await import('@/lib/services/email')
    await emailService.sendGenericEmail({
      to: recipientEmail,
      subject: `📊 DriveBook Weekly Report — ${report.period.label}`,
      html,
    })
    return NextResponse.json({ sent: true, to: recipientEmail, report })
  } catch (err: unknown) {
    console.error('[weekly-report] email send failed:', err)
    return NextResponse.json({ error: 'Report generated but email send failed', report }, { status: 500 })
  }
}
