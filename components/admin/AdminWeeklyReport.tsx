'use client'

import { useEffect, useState } from 'react'
import { BarChart3, RefreshCw, ChevronDown, ChevronUp, Send, Loader2, TrendingUp, TrendingDown, Minus, CheckCircle, AlertTriangle } from 'lucide-react'

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

function ChangeBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-slate-500 text-xs">—</span>
  if (pct > 0) return (
    <span className="flex items-center gap-0.5 text-emerald-400 text-xs font-semibold">
      <TrendingUp className="w-3 h-3" />+{pct}%
    </span>
  )
  if (pct < 0) return (
    <span className="flex items-center gap-0.5 text-red-400 text-xs font-semibold">
      <TrendingDown className="w-3 h-3" />{pct}%
    </span>
  )
  return <span className="flex items-center gap-0.5 text-slate-400 text-xs"><Minus className="w-3 h-3" />0%</span>
}

function HealthLabel({ score }: { score: number | null }) {
  if (score === null) return <span className="text-slate-500">—</span>
  const color = score >= 90 ? 'text-emerald-400' : score >= 70 ? 'text-amber-400' : 'text-red-400'
  const label = score >= 90 ? 'Healthy' : score >= 70 ? 'Watch' : 'Needs Attention'
  return <span className={`font-bold ${color}`}>{score}/100 — {label}</span>
}

export default function AdminWeeklyReport() {
  const [data, setData] = useState<WeeklyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null)

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
      if (res.ok) {
        setSendResult({ ok: true, msg: `Report sent to ${json.to}` })
      } else {
        setSendResult({ ok: false, msg: json.error ?? 'Send failed' })
      }
    } catch {
      setSendResult({ ok: false, msg: 'Network error — could not send' })
    } finally {
      setSending(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 animate-pulse">
        <div className="h-5 bg-slate-800 rounded w-48 mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-slate-800 rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-red-900/20 border border-red-700/40 rounded-2xl p-4 flex items-center justify-between">
        <span className="text-red-300 text-sm">{error ?? 'Report unavailable'}</span>
        <button onClick={() => load()} className="text-xs text-red-400 hover:text-red-200 underline">Retry</button>
      </div>
    )
  }

  const totalIssues = Object.values(data.openIssues).reduce((s, v) => s + v, 0)

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-600/20 border border-green-500/30 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-green-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Weekly Executive Report</h2>
            <p className="text-xs text-slate-500">{data.period.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Email send button */}
          <button
            onClick={sendEmail}
            disabled={sending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-700/40 hover:bg-green-700/60 disabled:opacity-40 text-green-300 text-xs font-semibold transition border border-green-700/50"
            title="Email report to admin"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {sending ? 'Sending…' : 'Email Report'}
          </button>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Send result toast */}
      {sendResult && (
        <div className={`px-5 py-2.5 text-xs flex items-center gap-2 border-b ${sendResult.ok ? 'bg-emerald-900/20 border-emerald-700/40 text-emerald-300' : 'bg-red-900/20 border-red-700/40 text-red-300'}`}>
          {sendResult.ok ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          {sendResult.msg}
          <button onClick={() => setSendResult(null)} className="ml-auto text-slate-500 hover:text-slate-300">✕</button>
        </div>
      )}

      {expanded && (
        <div className="p-5 space-y-5">
          {/* Health score */}
          <div className="text-sm text-slate-300">
            Platform Health: <HealthLabel score={data.healthScore} />
          </div>

          {/* Key metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
              <p className="text-xs text-slate-500 mb-1">Revenue</p>
              <p className="text-xl font-bold text-emerald-400">
                ${data.revenue.thisWeek > 0 ? data.revenue.thisWeek.toFixed(0) : '0'}
              </p>
              <ChangeBadge pct={data.revenue.changePercent} />
            </div>
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
              <p className="text-xs text-slate-500 mb-1">Bookings</p>
              <p className="text-xl font-bold text-slate-100">{data.bookings.thisWeek}</p>
              <ChangeBadge pct={data.bookings.changePercent} />
            </div>
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
              <p className="text-xs text-slate-500 mb-1">Completion Rate</p>
              <p className="text-xl font-bold text-slate-100">
                {data.bookings.completionRate !== null ? `${data.bookings.completionRate}%` : '—'}
              </p>
              <p className="text-xs text-slate-600">{data.bookings.completed} done · {data.bookings.cancelled} cancelled</p>
            </div>
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
              <p className="text-xs text-slate-500 mb-1">New Users</p>
              <p className="text-xl font-bold text-slate-100">{data.users.newStudents + data.users.newInstructors}</p>
              <p className="text-xs text-slate-600">{data.users.newStudents} students · {data.users.newInstructors} instructors</p>
            </div>
          </div>

          {/* Platform totals + highlights row */}
          <div className="grid sm:grid-cols-3 gap-3">
            {/* Totals */}
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Platform Totals</p>
              {[
                { label: 'Active instructors', value: data.instructors.active },
                { label: 'Total students', value: data.users.totalStudents },
                { label: 'Pending approvals', value: data.instructors.pendingApproval, warn: data.instructors.pendingApproval > 0 },
              ].map(({ label, value, warn }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{label}</span>
                  <span className={`text-xs font-bold ${warn ? 'text-amber-400' : 'text-slate-200'}`}>{value}</span>
                </div>
              ))}
            </div>

            {/* Top instructor */}
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">⭐ Top Instructor</p>
              {data.topInstructor ? (
                <>
                  <p className="text-sm font-bold text-slate-100">{data.topInstructor.name}</p>
                  <p className="text-xs text-slate-500">{data.topInstructor.completedLessons} lessons completed</p>
                </>
              ) : (
                <p className="text-xs text-slate-600">No completed lessons this week</p>
              )}
              {data.highestRiskInstructor && (
                <div className="mt-3 pt-3 border-t border-slate-800">
                  <p className="text-xs font-semibold text-red-400 mb-1">⚠️ Highest Risk</p>
                  <p className="text-sm font-bold text-slate-200">{data.highestRiskInstructor.name}</p>
                  <p className="text-xs text-slate-500">{data.highestRiskInstructor.topFlag}</p>
                </div>
              )}
            </div>

            {/* Open issues */}
            <div className={`rounded-xl p-4 border ${totalIssues > 0 ? 'bg-red-900/20 border-red-700/40' : 'bg-emerald-900/20 border-emerald-700/40'}`}>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${totalIssues > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {totalIssues > 0 ? `⚠️ Open Issues (${totalIssues})` : '✅ No Open Issues'}
              </p>
              {totalIssues > 0 ? (
                <div className="space-y-1">
                  {data.openIssues.openDisputes > 0 && <p className="text-xs text-red-300">{data.openIssues.openDisputes} dispute{data.openIssues.openDisputes > 1 ? 's' : ''}</p>}
                  {data.openIssues.failedPayouts > 0 && <p className="text-xs text-red-300">{data.openIssues.failedPayouts} failed payout{data.openIssues.failedPayouts > 1 ? 's' : ''}</p>}
                  {data.openIssues.stuckPayments > 0 && <p className="text-xs text-amber-300">{data.openIssues.stuckPayments} stuck payment{data.openIssues.stuckPayments > 1 ? 's' : ''}</p>}
                  {data.openIssues.stripeIncomplete > 0 && <p className="text-xs text-amber-300">{data.openIssues.stripeIncomplete} incomplete onboarding</p>}
                  {data.openIssues.expiringDocs > 0 && <p className="text-xs text-amber-300">{data.openIssues.expiringDocs} expiring doc{data.openIssues.expiringDocs > 1 ? 's' : ''}</p>}
                </div>
              ) : (
                <p className="text-xs text-emerald-300">Platform is operating cleanly.</p>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-600 text-right">
            Generated {new Date(data.generatedAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
            {' '}· Set <code className="bg-slate-800 px-1 rounded">ADMIN_REPORT_EMAIL</code> in .env to receive email reports
          </p>
        </div>
      )}
    </div>
  )
}
