'use client'

import { useEffect, useState, useCallback } from 'react'
import { DollarSign, Clock, CheckCircle, ArrowRight, RefreshCw, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { resolveTimezone, DEFAULT_TIMEZONE } from '@/lib/utils/timezone'
import { DashboardPageLayout, TransactionStatusBadge } from '@/components/ui'
import { cn } from '@/lib/cn'

interface Transaction {
  id: string
  amount: number
  providerPayout: number
  status: string
  createdAt: string
  description: string
  booking?: { customer: { name: string }; startTime: string }
}

interface EarningsData {
  totalEarnings: number
  pendingPayouts: number
  thisMonthEarnings: number
  platform: { pendingPayouts: number }
  transactions: Transaction[]
}

interface WeeklyData {
  totalEarned: number
}

export default function InstructorWalletPage() {
  const [data, setData]             = useState<EarningsData | null>(null)
  const [weekData, setWeekData]     = useState<WeeklyData | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [instructorTz, setInstructorTz] = useState(DEFAULT_TIMEZONE)
  const [refreshing, setRefreshing] = useState(false)

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      // Parallel fetch — earnings summary + correct this-week figure from dedicated endpoint
      const [earningsRes, weekRes, settingsRes] = await Promise.all([
        fetch('/api/instructor/earnings'),
        fetch('/api/instructor/earnings/this-week'),
        fetch('/api/instructor/settings'),
      ])
      if (!earningsRes.ok) throw new Error('Failed to load earnings')
      const [earnings, week, settings] = await Promise.all([
        earningsRes.json(),
        weekRes.ok ? weekRes.json() : null,
        settingsRes.ok ? settingsRes.json() : null,
      ])
      setData(earnings)
      if (week) setWeekData(week)
      if (settings?.timezone) setInstructorTz(resolveTimezone(settings.timezone))
    } catch {
      setError('Failed to load payout data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const pendingPayouts   = data?.platform?.pendingPayouts ?? 0
  const thisWeekEarnings = weekData?.totalEarned ?? 0
  const recent           = data?.transactions?.slice(0, 15) ?? []

  const kpis = [
    {
      label:   'Pending Payout',
      value:   `$${pendingPayouts.toFixed(2)}`,
      icon:    <Clock className="w-4 h-4" />,
      color:   'text-amber-400',
      sub:     'awaiting processing',
    },
    {
      label:   'This Week',
      value:   `$${thisWeekEarnings.toFixed(2)}`,
      icon:    <TrendingUp className="w-4 h-4" />,
      color:   'text-emerald-400',
      sub:     'net earnings',
    },
    {
      label:   'This Month',
      value:   `$${(data?.thisMonthEarnings ?? 0).toFixed(2)}`,
      icon:    <DollarSign className="w-4 h-4" />,
      color:   'text-primary',
      sub:     'net earnings',
    },
    {
      label:   'All Time',
      value:   `$${(data?.totalEarnings ?? 0).toFixed(2)}`,
      icon:    <CheckCircle className="w-4 h-4" />,
      sub:     'total paid out',
    },
  ]

  return (
    <DashboardPageLayout
      title="Payout Wallet"
      description="Your earnings balance and payout history"
      breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Wallet' }]}
      primaryAction={{
        label: 'Full Earnings',
        icon: <ArrowRight className="w-4 h-4" />,
        href: '/dashboard/earnings',
      }}
      secondaryActions={[{
        label: refreshing ? 'Refreshing…' : 'Refresh',
        icon: <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />,
        onClick: () => loadAll(true),
        disabled: refreshing,
        variant: 'outline',
      }]}
      kpis={kpis}
      isLoading={loading}
      error={error}
    >
      {/* Recent payouts */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Recent Payouts</h2>
          <Link
            href="/dashboard/earnings"
            className="text-sm text-primary hover:text-primary/80 transition font-medium"
          >
            View all →
          </Link>
        </div>

        {!loading && recent.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <DollarSign className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
            <p className="text-muted-foreground font-medium">No payout transactions yet</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Completed lessons will appear here</p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background border-b border-border">
                  <tr>
                    {['Client / Description', 'Date', 'Amount', 'Status'].map(h => (
                      <th key={h} className={cn(
                        'px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-left',
                        h === 'Amount' && 'text-right',
                        h === 'Status' && 'text-right',
                      )}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading
                    ? [...Array(5)].map((_, i) => (
                        <tr key={i}>
                          {[...Array(4)].map((_, j) => (
                            <td key={j} className="px-5 py-4">
                              <div className="h-4 bg-secondary rounded animate-pulse" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : recent.map(tx => (
                        <tr key={tx.id} className="hover:bg-secondary/50 transition-colors">
                          <td className="px-5 py-4 font-medium text-foreground">
                            {tx.booking?.customer?.name ?? tx.description ?? 'Payout'}
                          </td>
                          <td className="px-5 py-4 text-muted-foreground">
                            {new Date(tx.booking?.startTime ?? tx.createdAt).toLocaleDateString('en-AU', {
                              day: 'numeric', month: 'short', year: 'numeric', timeZone: instructorTz,
                            })}
                          </td>
                          <td className="px-5 py-4 text-right font-bold text-emerald-400">
                            +${((tx as any).providerPayout ?? tx.amount).toFixed(2)}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <TransactionStatusBadge status={tx.status} />
                          </td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="sm:hidden divide-y divide-border">
              {recent.map(tx => (
                <div key={tx.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {tx.booking?.customer?.name ?? tx.description ?? 'Payout'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(tx.booking?.startTime ?? tx.createdAt).toLocaleDateString('en-AU', {
                        day: 'numeric', month: 'short', timeZone: instructorTz,
                      })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-emerald-400">
                      +${((tx as any).providerPayout ?? tx.amount).toFixed(2)}
                    </p>
                    <TransactionStatusBadge status={tx.status} className="mt-0.5 text-xs" />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Payouts processed weekly by the platform admin.{' '}
        <Link href="/dashboard/earnings" className="text-primary hover:text-primary/80 transition">
          View full earnings breakdown →
        </Link>
      </p>
    </DashboardPageLayout>
  )
}
