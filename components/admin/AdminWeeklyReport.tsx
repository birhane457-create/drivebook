'use client'

import { useEffect, useState } from 'react'
import {
  BarChart3, RefreshCw, ChevronDown, ChevronUp,
  Send, Loader2, TrendingUp, TrendingDown, Minus, CheckCircle, AlertTriangle,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'

interface WeeklyReport {
  period: { from: string; to: string; label: string }
  revenue: { thisWeek: number; lastWeek: number; changePercent: number | null }
  bookings: {
    thisWeek: number; lastWeek: number; changePercent: number | null
    completed: number; cancelled: number; completionRate: number | null
  }
  users: { newStudents: number; newInstructors: number; totalStudents: number; totalInstructors: number }
  providers: { active: number; approved: number; pendingApproval: number; highRisk: number }
  openIssues: {
    openDisputes: number; failedPayouts: number; stuckPayments: number
    stripeIncomplete: number; expiringDocs: number
  }
  topInstructor: { name: string; completedLessons: number } | null
  highestRiskInstructor: { name: string; riskScore: number; topFlag: string } | null
  healthScore: number | null
  generatedAt: string
}

function ChangeBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-muted-foreground text-xs">—</span>
  if (pct > 0) return (
    <span className="flex items-center gap-0.5 text-emerald-400 text-xs font-semibold">
      <TrendingUp className="w-3 h-3" />+{pct}%
    </span>
  )
  if (pct < 0) return (
    <span className="flex items-center gap-0.5 text-destructive text-xs font-semibold">
      <TrendingDown className="w-3 h-3" />{pct}%
    </span>
  )
  return <span className="flex items-center gap-0.5 text-muted-foreground text-xs"><Minus className="w-3 h-3" />0%</span>
}

function HealthLabel({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted-foreground">—</span>
  const color = score >= 90 ? 'text-emerald-400' : score >= 70 ? 'text-amber-400' : 'text-destructive'
  const label = score >= 90 ? 'Healthy' : score >= 70 ? 'Watch' : 'Needs Attention'
  return <span className={cn('font-bold', color)}>{score}/100 — {label}</span>
}

export default function AdminWeeklyReport() {
  const [data, setData]               = useState<WeeklyReport | null>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [expanded, setExpanded]       = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [sending, setSending]         = useState(false)
  const [sendResult, setSendResult]   = useState<{ ok: boolean; msg: string } | null>(null)

  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/weekly-report')
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError('Could not load weekly report')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const sendEmail = async () => {
    setSending(true)
    setSendResult(null)
    try {
      const res = await fetch('/api/admin/weekly-report', { method: 'POST' })
      const json = await res.json()
      setSendResult(res.ok
        ? { ok: true,  msg: `Report sent to ${json.to}` }
        : { ok: false, msg: json.error ?? 'Send failed' }
      )
    } catch {
      setSendResult({ ok: false, msg: 'Network error — could not send' })
    } finally {
      setSending(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <Skeleton className="h-5 w-48" />
        </div>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          {error ?? 'Report unavailable'}
          <button onClick={() => load()} className="text-xs underline ml-4">Retry</button>
        </AlertDescription>
      </Alert>
    )
  }

  const totalIssues = Object.values(data.openIssues).reduce((s: number, v) => s + (v as number), 0)

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Weekly Executive Report</p>
            <p className="text-xs text-muted-foreground">{data.period.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={sendEmail}
            disabled={sending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-40 text-emerald-400 text-xs font-semibold transition border border-emerald-500/25"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {sending ? 'Sending…' : 'Email Report'}
          </button>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Send result */}
      {sendResult && (
        <div className={cn(
          'px-5 py-2.5 text-xs flex items-center gap-2 border-b border-border',
          sendResult.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-destructive/10 text-destructive',
        )}>
          {sendResult.ok ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          {sendResult.msg}
          <button onClick={() => setSendResult(null)} className="ml-auto text-muted-foreground hover:text-foreground">✕</button>
        </div>
      )}

      {expanded && (
        <CardContent className="pt-5 space-y-5">
          {/* Health score */}
          <p className="text-sm text-muted-foreground">
            Platform Health: <HealthLabel score={data.healthScore} />
          </p>

          {/* KPI grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Revenue',         value: `$${data.revenue.thisWeek > 0 ? data.revenue.thisWeek.toFixed(0) : '0'}`, pct: data.revenue.changePercent, valueClass: 'text-emerald-400' },
              { label: 'Bookings',        value: data.bookings.thisWeek, pct: data.bookings.changePercent },
              { label: 'Completion Rate', value: data.bookings.completionRate !== null ? `${data.bookings.completionRate}%` : '—', sub: `${data.bookings.completed} done · ${data.bookings.cancelled} cancelled` },
              { label: 'New Users',       value: data.users.newStudents + data.users.newInstructors, sub: `${data.users.newStudents} students · ${data.users.newInstructors} instructors` },
            ].map(({ label, value, pct, sub, valueClass }) => (
              <div key={label} className="bg-background rounded-xl p-4 border border-border">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className={cn('text-xl font-bold text-foreground', valueClass)}>{value}</p>
                {pct !== undefined && <ChangeBadge pct={pct ?? null} />}
                {sub && <p className="text-xs text-muted-foreground/50 mt-0.5">{sub}</p>}
              </div>
            ))}
          </div>

          {/* Highlights row */}
          <div className="grid sm:grid-cols-3 gap-3">
            {/* Platform totals */}
            <div className="bg-background rounded-xl p-4 border border-border space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Platform Totals</p>
              {[
                { label: 'Active instructors', value: data.providers.active },
                { label: 'Total students',     value: data.users.totalStudents },
                { label: 'Pending approvals',  value: data.providers.pendingApproval, warn: data.providers.pendingApproval > 0 },
              ].map(({ label, value, warn }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className={cn('text-xs font-bold', warn ? 'text-amber-400' : 'text-foreground')}>{value}</span>
                </div>
              ))}
            </div>

            {/* Top instructor */}
            <div className="bg-background rounded-xl p-4 border border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">⭐ Top Instructor</p>
              {data.topInstructor ? (
                <>
                  <p className="text-sm font-bold text-foreground">{data.topInstructor.name}</p>
                  <p className="text-xs text-muted-foreground">{data.topInstructor.completedLessons} lessons completed</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground/50">No completed lessons this week</p>
              )}
              {data.highestRiskInstructor && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs font-semibold text-destructive mb-1">⚠️ Highest Risk</p>
                  <p className="text-sm font-bold text-foreground">{data.highestRiskInstructor.name}</p>
                  <p className="text-xs text-muted-foreground">{data.highestRiskInstructor.topFlag}</p>
                </div>
              )}
            </div>

            {/* Open issues */}
            <div className={cn(
              'rounded-xl p-4 border',
              totalIssues > 0
                ? 'bg-destructive/10 border-destructive/30'
                : 'bg-emerald-500/10 border-emerald-500/25',
            )}>
              <p className={cn(
                'text-xs font-semibold uppercase tracking-wider mb-2',
                totalIssues > 0 ? 'text-destructive' : 'text-emerald-400',
              )}>
                {totalIssues > 0 ? `⚠️ Open Issues (${totalIssues})` : '✅ No Open Issues'}
              </p>
              {totalIssues > 0 ? (
                <div className="space-y-1 text-xs">
                  {data.openIssues.openDisputes     > 0 && <p className="text-destructive">{data.openIssues.openDisputes} dispute{data.openIssues.openDisputes > 1 ? 's' : ''}</p>}
                  {data.openIssues.failedPayouts    > 0 && <p className="text-destructive">{data.openIssues.failedPayouts} failed payout{data.openIssues.failedPayouts > 1 ? 's' : ''}</p>}
                  {data.openIssues.stuckPayments    > 0 && <p className="text-amber-400">{data.openIssues.stuckPayments} stuck payment{data.openIssues.stuckPayments > 1 ? 's' : ''}</p>}
                  {data.openIssues.stripeIncomplete > 0 && <p className="text-amber-400">{data.openIssues.stripeIncomplete} incomplete onboarding</p>}
                  {data.openIssues.expiringDocs     > 0 && <p className="text-amber-400">{data.openIssues.expiringDocs} expiring doc{data.openIssues.expiringDocs > 1 ? 's' : ''}</p>}
                </div>
              ) : (
                <p className="text-xs text-emerald-400">Platform is operating cleanly.</p>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground/40 text-right">
            Generated {new Date(data.generatedAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
            {' '}· Set <code className="bg-secondary px-1 rounded">ADMIN_REPORT_EMAIL</code> in .env to receive email reports
          </p>
        </CardContent>
      )}
    </Card>
  )
}
