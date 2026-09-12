'use client'

import { useEffect, useState } from 'react'
import { History, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Activity } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/cn'

interface BriefRecord {
  id: string
  date: string
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
  if (score === null) return <span className="text-xs text-muted-foreground/40">—</span>
  const color = score >= 90 ? 'text-emerald-400' : score >= 70 ? 'text-amber-400' : 'text-destructive'
  return (
    <span className={cn('flex items-center gap-1 text-xs font-semibold', color)}>
      <Activity className="w-3 h-3" />{score}
    </span>
  )
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

function BriefRow({ record }: { record: BriefRecord }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition text-left"
        onClick={() => setOpen(!open)}
      >
        <div className="shrink-0 w-28">
          <p className="text-sm font-semibold text-foreground">{formatDate(record.date)}</p>
        </div>
        <p className="flex-1 text-xs text-muted-foreground truncate min-w-0">
          {record.brief.slice(0, 120)}…
        </p>
        <div className="shrink-0 w-12 text-right">
          <HealthBadge score={record.healthScore} />
        </div>
        <span className="shrink-0 text-xs text-muted-foreground/40 bg-secondary px-1.5 py-0.5 rounded hidden sm:block">
          {record.model}
        </span>
        {open
          ? <ChevronUp className="w-4 h-4 text-muted-foreground/40 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground/40 shrink-0" />
        }
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4 bg-background/60 space-y-3">
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{record.brief}</p>
          <div className="flex items-center gap-4 pt-1 border-t border-border">
            <span className="text-xs text-muted-foreground/50">
              Generated {new Date(record.createdAt).toLocaleString('en-AU', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </span>
            <span className="text-xs text-muted-foreground/40">{record.tokens} tokens</span>
            <span className="text-xs text-muted-foreground/40 ml-auto">{record.model}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function HealthSparkline({ briefs }: { briefs: BriefRecord[] }) {
  const points = briefs
    .filter((b) => b.healthScore !== null)
    .slice(0, 14)
    .reverse()

  if (points.length < 2) return null

  const scores  = points.map((b) => b.healthScore as number)
  const min     = Math.min(...scores)
  const max     = Math.max(...scores)
  const range   = max - min || 1
  const w = 200, h = 36, pad = 4

  const coords = scores.map((s, i) => {
    const x = pad + (i / (scores.length - 1)) * (w - pad * 2)
    const y = h - pad - ((s - min) / range) * (h - pad * 2)
    return `${x},${y}`
  })

  const latest = scores[scores.length - 1]
  const latestColor = latest >= 90 ? '#34d399' : latest >= 70 ? '#fbbf24' : 'hsl(var(--destructive))'

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground">14-day trend</span>
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
        {(() => {
          const [x, y] = coords[coords.length - 1].split(',').map(Number)
          return <circle cx={x} cy={y} r="3" fill={latestColor} />
        })()}
      </svg>
    </div>
  )
}

export default function AdminBriefHistory() {
  const [data, setData]           = useState<HistoryData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [page, setPage]           = useState(1)
  const [expanded, setExpanded]   = useState(true)

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

  if (loading) {
    return (
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <Skeleton className="h-5 w-44" />
        </div>
        <CardContent className="pt-4 space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex items-center justify-between">
          {error}
          <button onClick={() => load(page)} className="text-xs underline ml-4">Retry</button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!data || data.briefs.length === 0) {
    return (
      <Card>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
            <History className="w-4 h-4 text-violet-400" />
          </div>
          <p className="text-sm font-semibold text-foreground">Brief History</p>
        </div>
        <CardContent className="pt-5">
          <p className="text-sm text-muted-foreground text-center py-4">
            No briefs saved yet. Generate your first AI brief from the Operations Brief section above.
          </p>
        </CardContent>
      </Card>
    )
  }

  const { pagination } = data

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
            <History className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Brief History</p>
            <p className="text-xs text-muted-foreground">
              {pagination.total} brief{pagination.total !== 1 ? 's' : ''} saved
            </p>
          </div>
          <div className="ml-4 hidden sm:block">
            <HealthSparkline briefs={data.briefs} />
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <CardContent className="pt-4 space-y-3">
          {/* Column headers */}
          <div className="flex items-center gap-3 px-4 pb-1">
            <span className="text-xs text-muted-foreground/50 w-28">Date</span>
            <span className="flex-1 text-xs text-muted-foreground/50">Summary</span>
            <span className="text-xs text-muted-foreground/50 w-12 text-right">Health</span>
            <span className="text-xs text-muted-foreground/50 w-20 hidden sm:block">Model</span>
            <span className="w-4" />
          </div>

          {data.briefs.map((record) => (
            <BriefRow key={record.id} record={record} />
          ))}

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page === 1}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={!pagination.hasMore}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
