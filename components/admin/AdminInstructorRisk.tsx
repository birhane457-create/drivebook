'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Shield, RefreshCw, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle, Minus, ExternalLink,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'

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
    bookings30d: number; completed: number; cancelled: number; noShow: number
    openDisputes: number; bookingsThisWeek: number; bookingsLastWeek: number
  }
}

interface RiskData {
  providers: InstructorRisk[]
  summary: { total: number; high: number; medium: number; low: number }
  generatedAt: string
}

const levelConfig = {
  high:   { badgeVariant: 'destructive' as const, barColor: 'bg-destructive',  rowBorder: 'border-destructive/30', icon: '🔴', label: 'High Risk' },
  medium: { badgeVariant: 'warning'     as const, barColor: 'bg-amber-500',    rowBorder: 'border-amber-500/25',  icon: '🟡', label: 'Medium Risk' },
  low:    { badgeVariant: 'success'     as const, barColor: 'bg-emerald-500',  rowBorder: 'border-border',        icon: '🟢', label: 'Low Risk' },
}

const flagColor = { high: 'text-destructive', medium: 'text-amber-400', low: 'text-muted-foreground' }

type Filter = 'all' | 'high' | 'medium' | 'low'

function RiskBar({ score }: { score: number }) {
  const level: 'high' | 'medium' | 'low' = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low'
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', levelConfig[level].barColor)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-mono text-muted-foreground w-6 text-right">{score}</span>
    </div>
  )
}

function InstructorRow({ instructor }: { instructor: InstructorRisk }) {
  const [open, setOpen] = useState(false)
  const cfg = levelConfig[instructor.riskLevel]

  return (
    <div className={cn('border rounded-xl overflow-hidden', cfg.rowBorder)}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="text-base shrink-0">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground truncate">{instructor.name}</span>
            <Badge variant={cfg.badgeVariant}>{cfg.label}</Badge>
          </div>
          {instructor.flags.length > 0 && (
            <p className={cn('text-xs mt-0.5 truncate', flagColor[instructor.flags[0].severity])}>
              {instructor.flags[0].label}
              {instructor.flags.length > 1 && (
                <span className="text-muted-foreground/40"> +{instructor.flags.length - 1} more</span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <RiskBar score={instructor.riskScore} />
          <Link
            href={`/admin/instructors/${instructor.id}`}
            onClick={(e) => e.stopPropagation()}
            className="p-1 rounded text-muted-foreground/40 hover:text-foreground transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          {open
            ? <ChevronUp className="w-4 h-4 text-muted-foreground/40" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground/40" />
          }
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4 bg-background/60 space-y-4">
          {instructor.flags.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Risk Factors</p>
              {instructor.flags.map((flag, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', flagColor[flag.severity])} />
                  <span className="text-sm text-foreground">{flag.label}</span>
                  {flag.points > 0 && <span className="ml-auto text-xs text-muted-foreground/40 shrink-0">+{flag.points}pts</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">No risk factors detected</span>
            </div>
          )}

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[
              { label: 'Bookings',   value: instructor.stats.bookings30d,        sub: '30d' },
              { label: 'Completed',  value: instructor.stats.completed,          sub: '30d' },
              { label: 'Cancelled',  value: instructor.stats.cancelled,          sub: '30d' },
              { label: 'No-shows',   value: instructor.stats.noShow,             sub: '30d' },
              { label: 'Disputes',   value: instructor.stats.openDisputes,       sub: 'open' },
              { label: 'This week',  value: instructor.stats.bookingsThisWeek,   sub: `vs ${instructor.stats.bookingsLastWeek} last` },
            ].map(({ label, value, sub }) => (
              <div key={label} className="bg-card rounded-lg p-2 text-center">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground/40">{sub}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground/40">{instructor.phone}</span>
            <Link
              href={`/admin/instructors/${instructor.id}`}
              className="text-xs text-primary hover:text-primary/80 transition flex items-center gap-1"
            >
              View full profile <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

interface Props { compact?: boolean }

export default function AdminInstructorRisk({ compact = false }: Props) {
  const [data, setData]             = useState<RiskData | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [filter, setFilter]         = useState<Filter>('all')
  const [expanded, setExpanded]     = useState(!compact)
  const [refreshing, setRefreshing] = useState(false)

  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
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

  const filtered = data?.providers.filter((i) =>
    filter === 'all' ? true : i.riskLevel === filter
  ) ?? []

  if (loading) {
    return (
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <Skeleton className="h-5 w-44" />
        </div>
        <CardContent className="pt-4 space-y-2">
          {[...Array(compact ? 3 : 5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          {error ?? 'Risk data unavailable'}
          <button onClick={() => load()} className="text-xs underline ml-4">Retry</button>
        </AlertDescription>
      </Alert>
    )
  }

  const { summary } = data
  const hasRisk = summary.high > 0 || summary.medium > 0

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-destructive/15 border border-destructive/25 flex items-center justify-center">
            <Shield className="w-4 h-4 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Instructor Risk Monitor</p>
            <p className="text-xs text-muted-foreground">{summary.total} approved instructors</p>
          </div>
          <div className="flex items-center gap-1.5 ml-2">
            {summary.high   > 0 && <Badge variant="destructive">{summary.high} high</Badge>}
            {summary.medium > 0 && <Badge variant="warning">{summary.medium} medium</Badge>}
            {!hasRisk && (
              <Badge variant="success" className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> All clear
              </Badge>
            )}
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
          {!compact && (
            <div className="flex gap-1">
              {(['all', 'high', 'medium', 'low'] as Filter[]).map((f) => {
                const count = f === 'all' ? summary.total : f === 'high' ? summary.high : f === 'medium' ? summary.medium : summary.low
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-semibold transition capitalize',
                      filter === f ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                    )}
                  >
                    {f} ({count})
                  </button>
                )
              })}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="flex items-center gap-2 py-6 justify-center">
              <Minus className="w-4 h-4 text-muted-foreground/40" />
              <span className="text-sm text-muted-foreground">No instructors in this category</span>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((instructor) => (
                <InstructorRow key={instructor.id} instructor={instructor} />
              ))}
              {compact && filtered.length >= 5 && (
                <p className="text-xs text-muted-foreground/40 text-center pt-2 mt-2 border-t border-border">
                  Showing top at-risk instructors · Full list on dedicated page
                </p>
              )}
            </div>
          )}

          {compact && data.providers.length > 0 && (
            <Link href="/admin/instructors" className="block text-center text-xs text-primary hover:text-primary/80 transition pt-1">
              View all instructors →
            </Link>
          )}

          <p className="text-xs text-muted-foreground/40 text-right">
            Updated {new Date(data.generatedAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </CardContent>
      )}
    </Card>
  )
}
