'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, DollarSign, Calendar, Users, Award, XCircle, RefreshCw } from 'lucide-react'
import { DashboardPageLayout, BarChart, AreaChart } from '@/components/ui'
import { cn } from '@/lib/cn'

interface Analytics {
  period: string
  totalBookings: number
  completedBookings: number
  cancelledBookings: number
  pendingBookings: number
  grossRevenue: number
  commission: number
  netEarnings: number
  commissionRate: number
  newClients: number
  averageRating: number
  completionRate: number
  // Optional chart data from the API
  revenueByWeek?: { week: string; net: number; gross: number }[]
  bookingsByWeek?: { week: string; completed: number; cancelled: number }[]
}

type Period = 'week' | 'month' | 'year' | 'all'

const PERIOD_TABS = [
  { id: 'week'  as Period, label: 'This Week'  },
  { id: 'month' as Period, label: 'This Month' },
  { id: 'year'  as Period, label: 'This Year'  },
  { id: 'all'   as Period, label: 'All Time'   },
]

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [period, setPeriod]       = useState<Period>('month')
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => { fetchAnalytics() }, [period])

  const fetchAnalytics = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/analytics?period=${period}`)
      if (!res.ok) throw new Error('Failed to load analytics')
      setAnalytics(await res.json())
    } catch {
      setError('Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  const hasNoData = !loading && analytics
    ? analytics.totalBookings === 0 && analytics.newClients === 0 && analytics.netEarnings === 0
    : false

  // Build chart data from API response or synthetic fallback
  const revenueChart = analytics?.revenueByWeek ?? []
  const bookingsChart = analytics?.bookingsByWeek ?? []

  const kpis = [
    {
      label: 'Net Earnings',
      value: `$${(analytics?.netEarnings ?? 0).toFixed(2)}`,
      icon: <DollarSign className="w-4 h-4" />,
      color: 'text-emerald-400',
      sub: 'after platform fees',
      trendUp: null,
    },
    {
      label: 'Total Bookings',
      value: analytics?.totalBookings ?? 0,
      icon: <Calendar className="w-4 h-4" />,
      sub: `${analytics?.completedBookings ?? 0} completed · ${analytics?.pendingBookings ?? 0} pending`,
    },
    {
      label: 'Cancelled',
      value: analytics?.cancelledBookings ?? 0,
      icon: <XCircle className="w-4 h-4" />,
      color: analytics && analytics.cancelledBookings > 0 ? 'text-destructive' : undefined,
    },
    {
      label: 'New Clients',
      value: analytics?.newClients ?? 0,
      icon: <Users className="w-4 h-4" />,
      color: 'text-violet-400',
    },
    {
      label: 'Completion Rate',
      value: `${(analytics?.completionRate ?? 0).toFixed(1)}%`,
      icon: <TrendingUp className="w-4 h-4" />,
      color: analytics && analytics.completionRate >= 80 ? 'text-emerald-400' : 'text-amber-400',
    },
    {
      label: 'Avg Rating',
      value: analytics?.averageRating != null
        ? analytics.averageRating.toFixed(1)
        : '—',
      icon: <Award className="w-4 h-4" />,
      color: 'text-amber-400',
      sub: analytics?.averageRating
        ? '★'.repeat(Math.round(analytics.averageRating)) + '☆'.repeat(5 - Math.round(analytics.averageRating))
        : undefined,
    },
  ]

  return (
    <DashboardPageLayout
      title="Analytics"
    description="Performance overview for your business"
      breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Analytics' }]}
      secondaryActions={[{
        label: 'Refresh',
        icon: <RefreshCw className="w-4 h-4" />,
        onClick: fetchAnalytics,
        variant: 'outline',
      }]}
      tabs={PERIOD_TABS}
      activeTab={period}
      onTabChange={id => setPeriod(id as Period)}
      kpis={kpis}
      kpiColumns={3}
      isLoading={loading}
      error={error}
    >
      {/* Empty state — only shown when no data AND not loading */}
      {hasNoData && (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 text-muted-foreground/20" />
          <p className="text-foreground font-medium mb-1">No data yet</p>
          <p className="text-sm text-muted-foreground/60">
            Analytics will appear here once you have completed bookings and clients.
          </p>
        </div>
      )}

      {!hasNoData && (
        <>
          {/* Charts row — only shown if API returns chart data */}
          {revenueChart.length > 1 && (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-card rounded-xl border border-border p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Revenue Over Time</h3>
                <AreaChart
                  data={revenueChart}
                  xKey="week"
                  series={[
                    { key: 'net',   label: 'Net Earnings', color: '#10b981' },
                    { key: 'gross', label: 'Gross Revenue', color: '#3b82f6' },
                  ]}
                  height={200}
                  format={v => `$${v}`}
                />
              </div>
              <div className="bg-card rounded-xl border border-border p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Bookings Over Time</h3>
                <BarChart
                  data={bookingsChart}
                  xKey="week"
                  series={[
                    { key: 'completed', label: 'Completed', color: '#10b981' },
                    { key: 'cancelled', label: 'Cancelled',  color: '#ef4444' },
                  ]}
                  height={200}
                  stacked
                />
              </div>
            </div>
          )}

          {/* Performance summary */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h2 className="text-base font-bold text-foreground mb-5">Performance Summary</h2>
            <div className="space-y-5">
              {/* Completion rate bar */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Completion Rate</span>
                  <span className={cn('text-sm font-semibold', {
                    'text-emerald-400': (analytics?.completionRate ?? 0) >= 80,
                    'text-amber-400':   (analytics?.completionRate ?? 0) >= 60 && (analytics?.completionRate ?? 0) < 80,
                    'text-destructive': (analytics?.completionRate ?? 0) < 60,
                  })}>
                    {(analytics?.completionRate ?? 0).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className={cn('h-2 rounded-full transition-all', {
                      'bg-emerald-500': (analytics?.completionRate ?? 0) >= 80,
                      'bg-amber-500':   (analytics?.completionRate ?? 0) >= 60,
                      'bg-destructive': (analytics?.completionRate ?? 0) < 60,
                    })}
                    style={{ width: `${Math.min(analytics?.completionRate ?? 0, 100)}%` }}
                  />
                </div>
              </div>

              {[
                {
                  label: 'Gross Revenue',
                  value: `$${(analytics?.grossRevenue ?? 0).toFixed(2)}`,
                  sub: 'before platform fees',
                },
                {
                  label: 'Platform Commission',
                  value: `-$${(analytics?.commission ?? 0).toFixed(2)}`,
                  sub: `${analytics?.commissionRate ?? 0}% per booking`,
                  valueClass: 'text-muted-foreground',
                },
                {
                  label: 'Net Earnings',
                  value: `$${(analytics?.netEarnings ?? 0).toFixed(2)}`,
                  sub: 'after commission',
                  valueClass: 'text-emerald-400',
                },
                {
                  label: 'Avg Earnings per Booking',
                  value: analytics && analytics.completedBookings > 0
                    ? `$${(analytics.netEarnings / analytics.completedBookings).toFixed(2)}`
                    : '—',
                },
                {
                  label: 'Bookings per Client',
                  value: analytics && analytics.newClients > 0
                    ? (analytics.totalBookings / analytics.newClients).toFixed(1)
                    : '—',
                },
              ].map(({ label, value, sub, valueClass }) => (
                <div key={label} className="flex items-center justify-between gap-4 py-2 border-t border-border/50">
                  <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    {sub && <p className="text-xs text-muted-foreground/50">{sub}</p>}
                  </div>
                  <span className={cn('text-sm font-semibold text-foreground shrink-0', valueClass)}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
        
     
    
</DashboardPageLayout>

  )
}
