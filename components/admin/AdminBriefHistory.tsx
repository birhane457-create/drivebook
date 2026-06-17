'use client'

import { useEffect, useState } from 'react'
import { History, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Activity } from 'lucide-react'

interface BriefRecord {
  id: string
  date: string          // YYYY-MM-DD
  brief: string
  model: string
  tokens: number
  healthScore: number | null
  createdAt: string
  generatedBy: string
}

interface HistoryData {
  briefs: BriefRecord[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
  }
}

function HealthBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-slate-600">—</span>
  const color =
    score >= 90 ? 'text-emerald-400' :
    score >= 70 ? 'text-amber-400' :
    'text-red-400'
  return (
    <span className={`flex items-center gap-1 text-xs font-semibold ${color}`}>
      <Activity className="w-3 h-3" />
      {score}
    </span>
  )
}

function formatDate(dateStr: string): string {
  // dateStr is YYYY-MM-DD
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function BriefRow({ record }: { record: BriefRecord }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/40 transition text-left"
        onClick={() => setOpen(!open)}
      >
        {/* Date */}
        <div className="shrink-0 w-28">
          <p className="text-sm font-semibold text-slate-200">{formatDate(record.date)}</p>
        </div>

        {/* Brief preview */}
        <p className="flex-1 text-xs text-slate-500 truncate min-w-0">
          {record.brief.slice(0, 120)}…
        </p>

        {/* Health score */}
        <div className="shrink-0 w-12 text-right">
          <HealthBadge score={record.healthScore} />
        </div>

        {/* Model tag */}
        <span className="shrink-0 text-xs text-slate-700 bg-slate-800 px-1.5 py-0.5 rounded hidden sm:block">
          {record.model}
        </span>

        {open
          ? <ChevronUp className="w-4 h-4 text-slate-600 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-slate-600 shrink-0" />
        }
      </button>

      {open && (
        <div className="border-t border-slate-800 px-4 py-4 bg-slate-950/60 space-y-3">
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{record.brief}</p>
          <div className="flex items-center gap-4 pt-1 border-t border-slate-800">
            <span className="text-xs text-slate-600">
              Generated {new Date(record.createdAt).toLocaleString('en-AU', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
              })}
            </span>
            <span className="text-xs text-slate-700">{record.tokens} tokens</span>
            <span className="text-xs text-slate-700 ml-auto">{record.model}</span>
          </div>
        </div>
      )}
    </div>
  )
}

/** Mini health score sparkline — last 14 data points */
function HealthSparkline({ briefs }: { briefs: BriefRecord[] }) {
  const points = briefs
    .filter((b) => b.healthScore !== null)
    .slice(0, 14)
    .reverse() // oldest → newest left to right

  if (points.length < 2) return null

  const scores = points.map((b) => b.healthScore as number)
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  const range = max - min || 1
  const w = 200
  const h = 36
  const pad = 4

  const coords = scores.map((s, i) => {
    const x = pad + (i / (scores.length - 1)) * (w - pad * 2)
    const y = h - pad - ((s - min) / range) * (h - pad * 2)
    return `${x},${y}`
  })

  const latest = scores[scores.length - 1]
  const latestColor = latest >= 90 ? '#34d399' : latest >= 70 ? '#fbbf24' : '#f87171'

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500">14-day trend</span>
      <svg width={w} height={h} className="overflow-visible">
        <polyline
          points={coords.join(' ')}
          fill="none"
          stroke={latestColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
        />
        {/* Latest dot */}
        {coords.length > 0 && (() => {
          const [x, y] = coords[coords.length - 1].split(',').map(Number)
          return <circle cx={x} cy={y} r="3" fill={latestColor} />
        })()}
      </svg>
    </div>
  )
}

export default function AdminBriefHistory() {
  const [data, setData] = useState<HistoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState(true)

  const load = async (p: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/ai-brief/history?page=${p}&limit=14`)
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError('Could not load brief history')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(page) }, [page])

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 animate-pulse">
        <div className="h-5 bg-slate-800 rounded w-44 mb-4" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-slate-800 rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700/40 rounded-2xl p-4 flex items-center justify-between">
        <span className="text-red-300 text-sm">{error}</span>
        <button onClick={() => load(page)} className="text-xs text-red-400 hover:text-red-200 underline">Retry</button>
      </div>
    )
  }

  // No briefs yet
  if (!data || data.briefs.length === 0) {
    return (
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
            <History className="w-4 h-4 text-violet-400" />
          </div>
          <h2 className="text-sm font-semibold text-slate-100">Brief History</h2>
        </div>
        <p className="text-sm text-slate-500 py-4 text-center">
          No briefs saved yet. Generate your first AI brief from the Operations Brief section above.
        </p>
      </div>
    )
  }

  const { pagination } = data

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
            <History className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Brief History</h2>
            <p className="text-xs text-slate-500">{pagination.total} brief{pagination.total !== 1 ? 's' : ''} saved</p>
          </div>
          {/* Sparkline inline */}
          <div className="ml-4 hidden sm:block">
            <HealthSparkline briefs={data.briefs} />
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="p-5 space-y-3">
          {/* Column headers */}
          <div className="flex items-center gap-3 px-4 pb-1">
            <span className="text-xs text-slate-600 w-28">Date</span>
            <span className="flex-1 text-xs text-slate-600">Summary</span>
            <span className="text-xs text-slate-600 w-12 text-right">Health</span>
            <span className="text-xs text-slate-600 w-20 hidden sm:block">Model</span>
            <span className="w-4" />
          </div>

          {/* Brief rows */}
          {data.briefs.map((record) => (
            <BriefRow key={record.id} record={record} />
          ))}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page === 1}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 disabled:opacity-30 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={!pagination.hasMore}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 disabled:opacity-30 transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
