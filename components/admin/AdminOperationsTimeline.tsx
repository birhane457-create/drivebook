'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Clock, RefreshCw, ChevronDown, ChevronUp,
  CheckCircle, AlertTriangle, XCircle, Info,
  User, Calendar, DollarSign, Shield,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'

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

type HoursFilter  = 6 | 24 | 48 | 168
type SourceFilter = 'all' | 'audit' | 'booking' | 'payout' | 'dispute'

const severityIcon = {
  success: <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
  warning: <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
  error:   <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />,
  info:    <Info className="w-3.5 h-3.5 text-primary shrink-0" />,
}

const sourceIcon = {
  audit:   <User className="w-3 h-3" />,
  booking: <Calendar className="w-3 h-3" />,
  payout:  <DollarSign className="w-3 h-3" />,
  dispute: <Shield className="w-3 h-3" />,
}

const sourceBadgeClass = {
  audit:   'bg-violet-500/15 text-violet-400 border-violet-500/25',
  booking: 'bg-primary/15 text-primary border-primary/25',
  payout:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  dispute: 'bg-destructive/15 text-destructive border-destructive/25',
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
    <div className="flex items-start gap-3 px-4 py-2.5 hover:bg-accent transition rounded-lg">
      <div className="mt-0.5">{severityIcon[event.severity]}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">{event.title}</span>
          <span className={cn(
            'flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border',
            sourceBadgeClass[event.source],
          )}>
            {sourceIcon[event.source]}
            {event.source}
          </span>
        </div>
        {event.detail && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{event.detail}</p>
        )}
      </div>
      <span className="text-xs text-muted-foreground/50 shrink-0 mt-0.5">{relativeTime(event.timestamp)}</span>
    </div>
  )

  return event.link ? (
    <Link href={event.link} className="block no-underline">{content}</Link>
  ) : content
}

function groupByDay(events: TimelineEvent[]) {
  const groups: Record<string, TimelineEvent[]> = {}
  const today = new Date()
  const yesterday = new Date(today.getTime() - 86400000)

  for (const event of events) {
    const d = new Date(event.timestamp)
    const label =
      d.toDateString() === today.toDateString()     ? 'Today' :
      d.toDateString() === yesterday.toDateString() ? 'Yesterday' :
      d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })
    if (!groups[label]) groups[label] = []
    groups[label].push(event)
  }

  return Object.entries(groups).map(([label, evts]) => ({ label, events: evts }))
}

export default function AdminOperationsTimeline() {
  const [events, setEvents]           = useState<TimelineEvent[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [expanded, setExpanded]       = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [hours, setHours]             = useState<HoursFilter>(24)
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [total, setTotal]             = useState(0)

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

  if (loading) {
    return (
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <Skeleton className="h-5 w-44" />
        </div>
        <CardContent className="pt-4 space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
            <Clock className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Operations Timeline</p>
            <p className="text-xs text-muted-foreground">{total} event{total !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
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

      {expanded && (
        <CardContent className="pt-4 space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap gap-2 items-center justify-between">
            {/* Time range */}
            <div className="flex gap-1">
              {([6, 24, 48, 168] as HoursFilter[]).map((h) => (
                <button
                  key={h}
                  onClick={() => { setHours(h); load(false, h) }}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-semibold transition',
                    hours === h
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                  )}
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
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition',
                    sourceFilter === s
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                  )}
                >
                  {s !== 'all' && sourceIcon[s as keyof typeof sourceIcon]}
                  {s}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive text-center py-4">{error}</p>}

          {!error && events.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No events in the last {hours === 168 ? '7 days' : `${hours} hours`}
            </p>
          )}

          {grouped.map(({ label, events: dayEvents }) => (
            <div key={label}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-1">
                {label} · {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
              </p>
              <div className="border border-border rounded-xl overflow-hidden divide-y divide-border/60">
                {dayEvents.slice(0, 5).map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
                {dayEvents.length > 5 && (
                  <p className="px-4 py-2 text-xs text-muted-foreground/50 text-center">
                    +{dayEvents.length - 5} more events
                  </p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  )
}
