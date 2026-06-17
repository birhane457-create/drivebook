'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Clock, RefreshCw, ChevronDown, ChevronUp,
  CheckCircle, AlertTriangle, XCircle, Info,
  User, Calendar, DollarSign, Shield,
} from 'lucide-react'

interface TimelineEvent {
  id: string
  type: string
  severity: 'info' | 'success' | 'warning' | 'error'
  title: string
  detail: string | null
  actorName: string | null
  link: string | null
  timestamp: string
  source: 'audit' | 'booking' | 'payout' | 'dispute'
}

type HoursFilter = 6 | 24 | 48 | 168
type SourceFilter = 'all' | 'audit' | 'booking' | 'payout' | 'dispute'

const severityIcon = {
  success: <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
  warning: <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
  error:   <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />,
  info:    <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />,
}

const sourceIcon = {
  audit:   <User className="w-3 h-3" />,
  booking: <Calendar className="w-3 h-3" />,
  payout:  <DollarSign className="w-3 h-3" />,
  dispute: <Shield className="w-3 h-3" />,
}

const sourceColor = {
  audit:   'bg-violet-900/30 text-violet-400 border-violet-700/40',
  booking: 'bg-blue-900/30 text-blue-400 border-blue-700/40',
  payout:  'bg-green-900/30 text-green-400 border-green-700/40',
  dispute: 'bg-red-900/30 text-red-400 border-red-700/40',
}

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function EventRow({ event }: { event: TimelineEvent }) {
  const content = (
    <div className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-800/40 transition rounded-lg">
      {/* Severity dot */}
      <div className="mt-0.5">{severityIcon[event.severity]}</div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-200">{event.title}</span>
          <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border ${sourceColor[event.source]}`}>
            {sourceIcon[event.source]}
            {event.source}
          </span>
        </div>
        {event.detail && (
          <p className="text-xs text-slate-500 mt-0.5 truncate">{event.detail}</p>
        )}
      </div>

      {/* Timestamp */}
      <span className="text-xs text-slate-600 shrink-0 mt-0.5">{relativeTime(event.timestamp)}</span>
    </div>
  )

  if (event.link) {
    return (
      <Link href={event.link} className="block no-underline">
        {content}
      </Link>
    )
  }
  return content
}

// Group events by day label
function groupByDay(events: TimelineEvent[]): Array<{ label: string; events: TimelineEvent[] }> {
  const groups: Record<string, TimelineEvent[]> = {}
  const today = new Date()
  const yesterday = new Date(today.getTime() - 86400000)

  for (const event of events) {
    const d = new Date(event.timestamp)
    let label: string
    if (d.toDateString() === today.toDateString()) {
      label = 'Today'
    } else if (d.toDateString() === yesterday.toDateString()) {
      label = 'Yesterday'
    } else {
      label = d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })
    }
    if (!groups[label]) groups[label] = []
    groups[label].push(event)
  }

  return Object.entries(groups).map(([label, events]) => ({ label, events }))
}

export default function AdminOperationsTimeline() {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [hours, setHours] = useState<HoursFilter>(24)
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [total, setTotal] = useState(0)

  const load = useCallback(async (silent = false, h = hours) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const types = sourceFilter === 'all' ? 'audit,booking,payout,dispute' : sourceFilter
      const res = await fetch(`/api/admin/operations-timeline?hours=${h}&limit=100&types=${types}`)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setEvents(data.events)
      setTotal(data.total)
    } catch {
      setError('Could not load timeline')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [hours, sourceFilter])

  useEffect(() => { load() }, [load])

  const grouped = groupByDay(events)

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 animate-pulse">
        <div className="h-5 bg-slate-800 rounded w-44 mb-4" />
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-slate-800 rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Operations Timeline</h2>
            <p className="text-xs text-slate-500">{total} event{total !== 1 ? 's' : ''}</p>
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
          {/* Controls */}
          <div className="flex flex-wrap gap-2 items-center justify-between">
            {/* Time range */}
            <div className="flex gap-1">
              {([6, 24, 48, 168] as HoursFilter[]).map((h) => (
                <button
                  key={h}
                  onClick={() => { setHours(h); load(false, h) }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    hours === h ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {h === 168 ? '7d' : h === 48 ? '48h' : h === 24 ? '24h' : '6h'}
                </button>
              ))}
            </div>

            {/* Source filter */}
            <div className="flex gap-1">
              {(['all', 'audit', 'booking', 'payout', 'dispute'] as SourceFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSourceFilter(s)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition ${
                    sourceFilter === s ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {s !== 'all' && sourceIcon[s as keyof typeof sourceIcon]}
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-400 text-center py-4">{error}</div>
          )}

          {/* Empty */}
          {!error && events.length === 0 && (
            <div className="text-sm text-slate-500 text-center py-8">
              No events in the last {hours === 168 ? '7 days' : `${hours} hours`}
            </div>
          )}

          {/* Grouped events — limit to today/yesterday on overview */}
          {grouped.map(({ label, events: dayEvents }) => (
            <div key={label}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 px-1">
                {label} · {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
              </p>
              <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/60">
                {/* Show only first 5 events per day on overview */}
                {dayEvents.slice(0, 5).map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
                {dayEvents.length > 5 && (
                  <div className="px-4 py-2 text-xs text-slate-600 text-center border-t border-slate-800/60">
                    +{dayEvents.length - 5} more events
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
