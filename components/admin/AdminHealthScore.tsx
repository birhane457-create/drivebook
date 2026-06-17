'use client'

import { useEffect, useState } from 'react'
import { Activity, RefreshCw, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react'

interface Signal {
  key: string
  label: string
  score: number
  maxScore: number
  detail: string
}

interface HealthScoreData {
  score: number
  status: 'healthy' | 'watch' | 'critical'
  signals: Signal[]
  generatedAt: string
}

const statusConfig = {
  healthy: {
    ring: 'stroke-emerald-400',
    text: 'text-emerald-400',
    bg: 'bg-emerald-900/20 border-emerald-700/40',
    badge: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
    label: 'Healthy',
    glow: 'shadow-emerald-500/20',
  },
  watch: {
    ring: 'stroke-amber-400',
    text: 'text-amber-400',
    bg: 'bg-amber-900/20 border-amber-700/40',
    badge: 'bg-amber-900/40 text-amber-300 border-amber-700/50',
    label: 'Watch',
    glow: 'shadow-amber-500/20',
  },
  critical: {
    ring: 'stroke-red-400',
    text: 'text-red-400',
    bg: 'bg-red-900/20 border-red-700/40',
    badge: 'bg-red-900/40 text-red-300 border-red-700/50',
    label: 'Needs Attention',
    glow: 'shadow-red-500/20',
  },
}

/** SVG ring — score 0–100 maps to circumference fill */
function ScoreRing({ score, status }: { score: number; status: 'healthy' | 'watch' | 'critical' }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const fill = ((100 - score) / 100) * circ
  const cfg = statusConfig[status]

  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
        {/* Track */}
        <circle cx="48" cy="48" r={r} fill="none" stroke="currentColor" strokeWidth="7" className="text-slate-800" />
        {/* Fill */}
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={fill}
          className={`${cfg.ring} transition-all duration-700 ease-out`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-bold leading-none ${cfg.text}`}>{score}</span>
        <span className="text-xs text-slate-500 mt-0.5">/ 100</span>
      </div>
    </div>
  )
}

/** Single signal bar */
function SignalBar({ signal }: { signal: Signal }) {
  const pct = signal.maxScore > 0 ? (signal.score / signal.maxScore) * 100 : 0
  const barColor =
    pct >= 80 ? 'bg-emerald-500' :
    pct >= 50 ? 'bg-amber-500' :
    'bg-red-500'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{signal.label}</span>
        <span className="text-xs text-slate-500">{signal.score}/{signal.maxScore}</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-slate-600">{signal.detail}</p>
    </div>
  )
}

export default function AdminHealthScore() {
  const [data, setData] = useState<HealthScoreData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/health-score')
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError('Could not load health score')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 mb-4 animate-pulse">
        <div className="flex items-center gap-5">
          <div className="w-24 h-24 rounded-full bg-slate-800 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-800 rounded w-32" />
            <div className="h-3 bg-slate-800 rounded w-48" />
            <div className="h-3 bg-slate-800 rounded w-24" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-red-900/20 border border-red-700/40 rounded-2xl p-4 mb-4 flex items-center justify-between">
        <span className="text-red-300 text-sm">{error ?? 'Health score unavailable'}</span>
        <button onClick={() => load()} className="text-xs text-red-400 hover:text-red-200 underline">
          Retry
        </button>
      </div>
    )
  }

  const cfg = statusConfig[data.status]

  return (
    <div className={`rounded-2xl border mb-4 overflow-hidden ${cfg.bg}`}>
      {/* Main row */}
      <div className="flex items-center gap-5 px-5 py-4">
        <ScoreRing score={data.score} status={data.status} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Activity className={`w-4 h-4 ${cfg.text}`} />
              <span className="text-sm font-semibold text-slate-100">Platform Health</span>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${cfg.badge}`}>
              {cfg.label}
            </span>
          </div>

          {/* Compact signal summary */}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {data.signals.map((s) => {
              const pct = s.maxScore > 0 ? (s.score / s.maxScore) * 100 : 0
              const color = pct >= 80 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400'
              return (
                <span key={s.key} className="flex items-center gap-1 text-xs text-slate-500">
                  {pct >= 80 ? <TrendingUp className={`w-3 h-3 ${color}`} /> :
                   pct >= 50 ? <Minus className={`w-3 h-3 ${color}`} /> :
                   <TrendingDown className={`w-3 h-3 ${color}`} />}
                  <span className={color}>{s.label}</span>
                </span>
              )
            })}
          </div>

          <p className="text-xs text-slate-600 mt-2">
            Updated {new Date(data.generatedAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition"
            title={expanded ? 'Hide breakdown' : 'Show breakdown'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded signal breakdown */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-white/5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-4 mb-3">
            Score Breakdown
          </p>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
            {data.signals.map((s) => (
              <SignalBar key={s.key} signal={s} />
            ))}
          </div>
          <p className="text-xs text-slate-600 mt-4">
            Score is calculated from the last 30 days of platform activity across 6 weighted signals.
          </p>
        </div>
      )}
    </div>
  )
}
