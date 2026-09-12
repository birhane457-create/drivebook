'use client'

import { useEffect, useState } from 'react'
import {
  TrendingUp, TrendingDown, Minus,
  CheckCircle, Users, DollarSign, Calendar,
  ChevronDown, ChevronUp, RefreshCw, Zap,
  AlertTriangle,
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'
import AdminAIBrief from './AdminAIBrief'
import AttentionItemList from './AttentionItemList'
import { Signal, SignalSeverity } from '@/lib/types/signal'

interface DailySummary {
  generatedAt: string
  period: { from: string; to: string; label: string }
  yesterday: {
    bookingsCompleted: number
    bookingsCancelled: number
    bookingsRescheduled: number
    bookingsNew: number
    revenueCollected: number
    platformFee: number
    newStudents: number
    newInstructors: number
  }
  weeklyTrend: {
    bookingsThisWeek: number
    bookingsLastWeek: number
    bookingChangePercent: number | null
    revenueThisWeek: number
  }
  topPerformers: Array<{ name: string; completedLessons: number }>
  attentionItems: Array<{
    type: string
    severity: SignalSeverity  // Now using canonical enum
    message: string
    link: string
    count?: number
    estimatedImpact: string | null
    action: string
  }>
  attentionCount: number
}

function TrendBadge({ percent }: { percent: number | null }) {
  if (percent === null) return <span className="text-muted-foreground text-xs">—</span>
  if (percent > 0) return (
    <span className="flex items-center gap-0.5 text-emerald-400 text-xs font-medium">
      <TrendingUp className="w-3 h-3" />+{percent}%
    </span>
  )
  if (percent < 0) return (
    <span className="flex items-center gap-0.5 text-destructive text-xs font-medium">
      <TrendingDown className="w-3 h-3" />{percent}%
    </span>
  )
  return <span className="flex items-center gap-0.5 text-muted-foreground text-xs"><Minus className="w-3 h-3" />0%</span>
}

export default function AdminDailySummary() {
  const [data, setData] = useState<DailySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/daily-summary')
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError('Could not load daily summary')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          {error ?? 'No summary available'}
          <button onClick={() => load()} className="text-xs underline ml-4">Retry</button>
        </AlertDescription>
      </Alert>
    )
  }

  const { yesterday: y, weeklyTrend, attentionItems: rawItems, topPerformers } = data
  const hasAttention = rawItems.length > 0
  const highCount = rawItems.filter((i) => i.severity === 'high' || i.severity === 'critical').length

  // Transform API response to Signal format
  const signals: Signal[] = rawItems.map((item, idx) => ({
    id: `${item.type}-${idx}`,
    severity: item.severity,
    source: 'operations' as const, // Daily summary is operations-focused
    title: item.message,
    description: [
      item.estimatedImpact && `Impact: ${item.estimatedImpact}`,
      item.action && `→ ${item.action}`,
    ].filter(Boolean).join(' · ') || undefined,
    link: item.link,
    count: item.count,
    createdAt: new Date(data.generatedAt),
  }))

  return (
    <Card className="mb-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
            <Zap className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Operations Brief</p>
            <p className="text-xs text-muted-foreground">
              Yesterday · {new Date(data.period.from).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
            </p>
          </div>
          {hasAttention ? (
            <Badge variant={highCount > 0 ? 'destructive' : 'warning'} className="ml-2">
              {rawItems.length} item{rawItems.length > 1 ? 's' : ''} need attention
            </Badge>
          ) : (
            <Badge variant="success" className="ml-2 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> All clear
            </Badge>
          )}
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
        <CardContent className="pt-5 space-y-5">
          {/* Attention items */}
          {hasAttention && (
            <AttentionItemList items={signals} />
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                icon: <Calendar className="w-4 h-4 text-primary" />,
                label: 'Completed',
                value: y.bookingsCompleted,
                sub: `${y.bookingsCancelled} cancelled · ${y.bookingsNew} new`,
              },
              {
                icon: <DollarSign className="w-4 h-4 text-emerald-400" />,
                label: 'Revenue',
                value: `$${y.revenueCollected.toFixed(0)}`,
                sub: `$${y.platformFee.toFixed(0)} platform fee`,
              },
              {
                icon: <Users className="w-4 h-4 text-violet-400" />,
                label: 'New Users',
                value: y.newStudents + y.newInstructors,
                sub: `${y.newStudents} students · ${y.newInstructors} instructors`,
              },
              {
                icon: <TrendingUp className="w-4 h-4 text-amber-400" />,
                label: 'This Week',
                value: weeklyTrend.bookingsThisWeek,
                trend: weeklyTrend.bookingChangePercent,
              },
            ].map(({ icon, label, value, sub, trend }) => (
              <div key={label} className="bg-background rounded-xl p-4 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  {icon}
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{value}</p>
                {sub && <p className="text-xs text-muted-foreground/60 mt-0.5">{sub}</p>}
                {trend !== undefined && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-muted-foreground">vs last week</span>
                    <TrendBadge percent={trend} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Top performers + quick actions */}
          <div className="grid sm:grid-cols-2 gap-3">
            {topPerformers.length > 0 && (
              <div className="bg-background rounded-xl p-4 border border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Top Instructors
                </p>
                <div className="space-y-2">
                  {topPerformers.slice(0, 3).map((p, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground/50 w-4">{i + 1}.</span>
                        <span className="text-sm text-foreground font-medium">{p.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{p.completedLessons} lessons</span>
                    </div>
                  ))}
                  {topPerformers.length > 3 && (
                    <p className="text-xs text-muted-foreground/40 mt-2 pt-2 border-t border-border">
                      +{topPerformers.length - 3} more on detailed view
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="bg-background rounded-xl p-4 border border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Quick Actions
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Review Bookings',    href: '/admin/bookings',     icon: Calendar },
                  { label: 'View Payouts',        href: '/admin/payouts',      icon: DollarSign },
                  { label: 'Approve Instructors', href: '/admin/instructors',  icon: Users },
                  { label: 'Check Disputes',      href: '/admin/disputes',     icon: AlertTriangle },
                ].map(({ label, href, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border text-xs text-foreground hover:text-foreground hover:border-border/80 hover:bg-accent transition no-underline"
                  >
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground/40 text-right">
            Generated {new Date(data.generatedAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
          </p>

          <AdminAIBrief summaryData={data as unknown as Record<string, unknown>} />
        </CardContent>
      )}
    </Card>
  )
}
