'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, TrendingUp, TrendingDown, Minus,
  CheckCircle, Users, DollarSign, Calendar,
  ChevronDown, ChevronUp, RefreshCw, Zap,
} from 'lucide-react'
import AdminAIBrief from './AdminAIBrief'

interface AttentionItem {
  type: string
  severity: 'high' | 'medium' | 'low'
  message: string
  link: string
  count?: number
  estimatedImpact: string | null
  action: string
}

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
  attentionItems: AttentionItem[]
  attentionCount: number
}

const severityConfig = {
  high: { bg: 'bg-red-900/30 border-red-700/50', icon: 'text-red-400', dot: 'bg-red-400' },
  medium: { bg: 'bg-amber-900/20 border-amber-700/40', icon: 'text-amber-400', dot: 'bg-amber-400' },
  low: { bg: 'bg-blue-900/20 border-blue-700/40', icon: 'text-blue-400', dot: 'bg-blue-400' },
}

function TrendBadge({ percent }: { percent: number | null }) {
  if (percent === null) return <span className="text-slate-500 text-xs">—</span>
  if (percent > 0) return (
    <span className="flex items-center gap-0.5 text-green-400 text-xs font-medium">
      <TrendingUp className="w-3 h-3" />+{percent}%
    </span>
  )
  if (percent < 0) return (
    <span className="flex items-center gap-0.5 text-red-400 text-xs font-medium">
      <TrendingDown className="w-3 h-3" />{percent}%
    </span>
  )
  return <span className="flex items-center gap-0.5 text-slate-400 text-xs"><Minus className="w-3 h-3" />0%</span>
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

  if (loading) return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 mb-6 animate-pulse">
      <div className="h-5 bg-slate-800 rounded w-48 mb-4" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-slate-800 rounded-xl" />)}
      </div>
    </div>
  )

  if (error || !data) return (
    <div className="bg-red-900/20 border border-red-700/40 rounded-2xl p-4 mb-6 flex items-center justify-between">
      <span className="text-red-300 text-sm">{error ?? 'No summary available'}</span>
      <button onClick={() => load()} className="text-xs text-red-400 hover:text-red-200 underline">Retry</button>
    </div>
  )

  const { yesterday: y, weeklyTrend, attentionItems, topPerformers } = data
  const hasAttention = attentionItems.length > 0
  const highCount = attentionItems.filter(i => i.severity === 'high').length

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 mb-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
            <Zap className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Operations Brief</h2>
            <p className="text-xs text-slate-500">
              Yesterday · {new Date(data.period.from).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
            </p>
          </div>
          {hasAttention && (
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${highCount > 0 ? 'bg-red-900/40 text-red-300 border border-red-700/50' : 'bg-amber-900/30 text-amber-300 border border-amber-700/40'}`}>
              {attentionItems.length} item{attentionItems.length > 1 ? 's' : ''} need attention
            </span>
          )}
          {!hasAttention && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-green-900/30 text-green-300 border border-green-700/40 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> All clear
            </span>
          )}
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
        <div className="p-5 space-y-5">
          {/* Attention Items */}
          {hasAttention && (
            <div className="space-y-2">
              {attentionItems.map((item, i) => {
                const cfg = severityConfig[item.severity]
                return (
                  <Link
                    key={i}
                    href={item.link}
                    className={`flex items-start gap-3 p-3 rounded-xl border ${cfg.bg} hover:opacity-90 transition no-underline`}
                  >
                    <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.icon}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200">{item.message}</p>
                      {item.estimatedImpact && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          <span className="font-medium text-amber-400">Impact:</span> {item.estimatedImpact}
                        </p>
                      )}
                      {item.action && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          → {item.action}
                        </p>
                      )}
                    </div>
                    <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${cfg.dot}`} />
                  </Link>
                )
              })}
            </div>
          )}

          {/* Yesterday Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-slate-400">Completed</span>
              </div>
              <p className="text-2xl font-bold text-slate-100">{y.bookingsCompleted}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {y.bookingsCancelled} cancelled · {y.bookingsNew} new
              </p>
            </div>

            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-green-400" />
                <span className="text-xs text-slate-400">Revenue</span>
              </div>
              <p className="text-2xl font-bold text-slate-100">
                ${y.revenueCollected.toFixed(0)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                ${y.platformFee.toFixed(0)} platform fee
              </p>
            </div>

            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-violet-400" />
                <span className="text-xs text-slate-400">New Users</span>
              </div>
              <p className="text-2xl font-bold text-slate-100">{y.newStudents + y.newInstructors}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {y.newStudents} students · {y.newInstructors} instructors
              </p>
            </div>

            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-slate-400">This Week</span>
              </div>
              <p className="text-2xl font-bold text-slate-100">{weeklyTrend.bookingsThisWeek}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs text-slate-500">vs last week</span>
                <TrendBadge percent={weeklyTrend.bookingChangePercent} />
              </div>
            </div>
          </div>

          {/* Top Performers + Quick Stats row */}
          <div className="grid sm:grid-cols-2 gap-3">
            {/* Top performers — limit to 3 on overview */}
            {topPerformers.length > 0 && (
              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Top Instructors (Top 3)</p>
                <div className="space-y-2">
                  {topPerformers.slice(0, 3).map((p, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600 w-4">{i + 1}.</span>
                        <span className="text-sm text-slate-200 font-medium">{p.name}</span>
                      </div>
                      <span className="text-xs text-slate-400">{p.completedLessons} lessons</span>
                    </div>
                  ))}
                </div>
                {topPerformers.length > 3 && (
                  <p className="text-xs text-slate-600 mt-2 pt-2 border-t border-slate-800">
                    +{topPerformers.length - 3} more on detailed view
                  </p>
                )}
              </div>
            )}

            {/* Quick links */}
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Quick Actions</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Review Bookings', href: '/admin/bookings', icon: Calendar },
                  { label: 'View Payouts', href: '/admin/payouts', icon: DollarSign },
                  { label: 'Approve Instructors', href: '/admin/instructors', icon: Users },
                  { label: 'Check Disputes', href: '/admin/disputes', icon: AlertTriangle },
                ].map(({ label, href, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white hover:border-slate-700 transition no-underline"
                  >
                    <Icon className="w-3.5 h-3.5 text-slate-500" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-600 text-right">
            Generated {new Date(data.generatedAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
          </p>

          {/* AI interpretation layer */}
          <AdminAIBrief summaryData={data as unknown as Record<string, unknown>} />
        </div>
      )}
    </div>
  )
}
