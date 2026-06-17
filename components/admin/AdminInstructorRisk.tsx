'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Shield, RefreshCw, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle, Minus, ExternalLink,
} from 'lucide-react'

interface RiskFlag {
  label: string
  severity: 'high' | 'medium' | 'low'
  points: number
}

interface InstructorRisk {
  id: string
  name: string
  phone: string
  riskScore: number
  riskLevel: 'low' | 'medium' | 'high'
  flags: RiskFlag[]
  stats: {
    bookings30d: number
    completed: number
    cancelled: number
    noShow: number
    openDisputes: number
    bookingsThisWeek: number
    bookingsLastWeek: number
  }
}

interface RiskData {
  instructors: InstructorRisk[]
  summary: { total: number; high: number; medium: number; low: number }
  generatedAt: string
}

const levelConfig = {
  high: {
    badge: 'bg-red-900/50 text-red-300 border-red-700/60',
    dot: 'bg-red-400',
    bar: 'bg-red-500',
    row: 'border-red-900/40',
    icon: '🔴',
    label: 'High Risk',
  },
  medium: {
    badge: 'bg-amber-900/40 text-amber-300 border-amber-700/50',
    dot: 'bg-amber-400',
    bar: 'bg-amber-500',
    row: 'border-amber-900/30',
    icon: '🟡',
    label: 'Medium Risk',
  },
  low: {
    badge: 'bg-emerald-900/30 text-emerald-300 border-emerald-700/40',
    dot: 'bg-emerald-400',
    bar: 'bg-emerald-500',
    row: 'border-slate-800',
    icon: '🟢',
    label: 'Low Risk',
  },
}

const flagSeverityColor = {
  high: 'text-red-400',
  medium: 'text-amber-400',
  low: 'text-slate-400',
}

type Filter = 'all' | 'high' | 'medium' | 'low'

function RiskBar({ score }: { score: number }) {
  const level: 'high' | 'medium' | 'low' =
    score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low'
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${levelConfig[level].bar}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs font-mono text-slate-400 w-6 text-right">{score}</span>
    </div>
  )
}

function InstructorRow({ instructor }: { instructor: InstructorRisk }) {
  const [open, setOpen] = useState(false)
  const cfg = levelConfig[instructor.riskLevel]

  return (
    <div className={`border rounded-xl overflow-hidden ${cfg.row}`}>
      {/* Summary row */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/40 transition text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="text-base shrink-0">{cfg.icon}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-100 truncate">{instructor.name}</span>
            <span className={`px-1.5 py-0.5 rounded-md text-xs font-bold border ${cfg.badge}`}>
              {cfg.label}
            </span>
          </div>
          {/* Top flag preview */}
          {instructor.flags.length > 0 && (
            <p className={`text-xs mt-0.5 truncate ${flagSeverityColor[instructor.flags[0].severity]}`}>
              {instructor.flags[0].label}
              {instructor.flags.length > 1 && (
                <span className="text-slate-600"> +{instructor.flags.length - 1} more</span>
              )}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <RiskBar score={instructor.riskScore} />
          <Link
            href={`/admin/instructors/${instructor.id}`}
            onClick={(e) => e.stopPropagation()}
            className="p-1 rounded text-slate-600 hover:text-slate-300 transition"
            title="View instructor"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          {open
            ? <ChevronUp className="w-4 h-4 text-slate-600" />
            : <ChevronDown className="w-4 h-4 text-slate-600" />
          }
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-slate-800 px-4 py-4 bg-slate-950/60 space-y-4">
          {/* Risk flags */}
          {instructor.flags.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Risk Factors</p>
              {instructor.flags.map((flag, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${flagSeverityColor[flag.severity]}`} />
                  <span className="text-sm text-slate-300">{flag.label}</span>
                  {flag.points > 0 && (
                    <span className="ml-auto text-xs text-slate-600 shrink-0">+{flag.points}pts</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">No risk factors detected</span>
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
            {[
              { label: 'Bookings', value: instructor.stats.bookings30d, sub: '30d' },
              { label: 'Completed', value: instructor.stats.completed, sub: '30d' },
              { label: 'Cancelled', value: instructor.stats.cancelled, sub: '30d' },
              { label: 'No-shows', value: instructor.stats.noShow, sub: '30d' },
              { label: 'Disputes', value: instructor.stats.openDisputes, sub: 'open' },
              { label: 'This week', value: instructor.stats.bookingsThisWeek, sub: `vs ${instructor.stats.bookingsLastWeek} last` },
            ].map(({ label, value, sub }) => (
              <div key={label} className="bg-slate-900 rounded-lg p-2 text-center">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-lg font-bold text-slate-100">{value}</p>
                <p className="text-xs text-slate-600">{sub}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-600">{instructor.phone}</span>
            <Link
              href={`/admin/instructors/${instructor.id}`}
              className="text-xs text-blue-400 hover:text-blue-300 transition flex items-center gap-1"
            >
              View full profile <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

interface Props {
  /** When true, shows as a compact dashboard widget (top 5 at-risk only) */
  compact?: boolean
}

export default function AdminInstructorRisk({ compact = false }: Props) {
  const [data, setData] = useState<RiskData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [expanded, setExpanded] = useState(!compact)
  const [refreshing, setRefreshing] = useState(false)

  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      // Compact mode: only fetch medium/high risk (score >= 30), top 5
      const params = compact ? '?minScore=30&limit=5' : '?minScore=0&limit=50'
      const res = await fetch(`/api/admin/instructor-risk${params}`)
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError('Could not load instructor risk data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = data?.instructors.filter((i) =>
    filter === 'all' ? true : i.riskLevel === filter
  ) ?? []

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 animate-pulse">
        <div className="h-5 bg-slate-800 rounded w-44 mb-4" />
        <div className="space-y-2">
          {[...Array(compact ? 3 : 5)].map((_, i) => (
            <div key={i} className="h-14 bg-slate-800 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-red-900/20 border border-red-700/40 rounded-2xl p-4 flex items-center justify-between">
        <span className="text-red-300 text-sm">{error ?? 'Risk data unavailable'}</span>
        <button onClick={() => load()} className="text-xs text-red-400 hover:text-red-200 underline">Retry</button>
      </div>
    )
  }

  const { summary } = data
  const hasRisk = summary.high > 0 || summary.medium > 0

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center">
            <Shield className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Instructor Risk Monitor</h2>
            <p className="text-xs text-slate-500">{summary.total} approved instructors</p>
          </div>

          {/* Summary badges */}
          <div className="flex items-center gap-1.5 ml-2">
            {summary.high > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-900/40 text-red-300 border border-red-700/50">
                {summary.high} high
              </span>
            )}
            {summary.medium > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-900/30 text-amber-300 border border-amber-700/40">
                {summary.medium} medium
              </span>
            )}
            {!hasRisk && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-900/30 text-emerald-300 border border-emerald-700/40 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> All clear
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition"
            title="Refresh"
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

      {expanded && (
        <div className="p-5 space-y-4">
          {/* Filter tabs — only show in full mode */}
          {!compact && (
            <div className="flex gap-1">
              {(['all', 'high', 'medium', 'low'] as Filter[]).map((f) => {
                const count =
                  f === 'all' ? summary.total :
                  f === 'high' ? summary.high :
                  f === 'medium' ? summary.medium : summary.low
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition capitalize ${
                      filter === f
                        ? 'bg-slate-700 text-slate-100'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {f} ({count})
                  </button>
                )
              })}
            </div>
          )}

          {/* Instructor list — shows top 5 in dashboard, full list on dedicated page */}
          {filtered.length === 0 ? (
            <div className="flex items-center gap-2 py-6 justify-center">
              <Minus className="w-4 h-4 text-slate-600" />
              <span className="text-sm text-slate-500">No instructors in this category</span>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((instructor) => (
                <InstructorRow key={instructor.id} instructor={instructor} />
              ))}
              {compact && filtered.length >= 5 && (
                <div className="text-xs text-slate-600 text-center pt-2 mt-2 border-t border-slate-800">
                  Showing top at-risk instructors · Full list on dedicated page
                </div>
              )}
            </div>
          )}

          {/* Compact mode footer — link to full view */}
          {compact && data.instructors.length > 0 && (
            <Link
              href="/admin/instructors"
              className="block text-center text-xs text-blue-400 hover:text-blue-300 transition pt-1"
            >
              View all instructors →
            </Link>
          )}

          <p className="text-xs text-slate-600 text-right">
            Updated {new Date(data.generatedAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}
    </div>
  )
}
