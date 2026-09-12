'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Clock, CreditCard, DollarSign, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'

interface PaymentStatusData {
  platformStripe:     { count: number; totalValue: number; avgPrice: number; label: string }
  platformWallet:     { count: number; totalValue: number; label: string }
  offlineCash:        { count: number; totalValue: number; label: string }
  offlineBankTransfer:{ count: number; totalValue: number; label: string }
  pendingPayment: {
    count: number; totalValue: number
    expiringBookings: Array<{ bookingId: string; minutesLeft: number; expired: boolean }>
    allBookings:      Array<{ bookingId: string; minutesLeft: number; expired: boolean }>
    label: string
  }
  expiredBookings: { count: number; totalValue: number; label: string }
  summary: { totalBookings: number; totalValue: number; platformFeeCollected: number; timeRange: string }
}

type CardColor = 'blue' | 'emerald' | 'amber' | 'red'

const colorMap: Record<CardColor, string> = {
  blue:    'bg-primary/10 border-primary/25 text-primary',
  emerald: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400',
  amber:   'bg-amber-500/10 border-amber-500/25 text-amber-400',
  red:     'bg-destructive/10 border-destructive/25 text-destructive',
}

function PaymentCard({
  label, count, value, icon, color, subtext,
}: {
  label: string; count: number; value: number; icon: React.ReactNode; color: CardColor; subtext?: string
}) {
  return (
    <div className={cn('rounded-xl border p-4', colorMap[color])}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
          <p className="text-2xl font-bold">{count}</p>
          <p className="text-xs opacity-60 mt-1">${value.toFixed(2)}</p>
          {subtext && <p className="text-xs opacity-50 mt-1">{subtext}</p>}
        </div>
        <div className="opacity-60">{icon}</div>
      </div>
    </div>
  )
}

export default function BookingPaymentStatus() {
  const [data, setData]       = useState<PaymentStatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/admin/booking-payment-status')
        if (!res.ok) throw new Error('Failed to fetch payment status')
        setData(await res.json())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Error: {error}</AlertDescription>
      </Alert>
    )
  }

  if (!data) return null

  const hasUrgentExpiring =
    data.pendingPayment.expiringBookings.length > 0 || data.expiredBookings.count > 0

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-1">Platform Revenue Status</h2>
        <p className="text-xs text-muted-foreground">Last 24 hours — payments processed through DriveBook</p>
      </div>

      {/* Urgent alerts */}
      {hasUrgentExpiring && (
        <div className="space-y-2">
          {data.pendingPayment.expiringBookings.length > 0 && (
            <Alert variant="warning">
              <Clock className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold">
                  {data.pendingPayment.expiringBookings.length} payment{data.pendingPayment.expiringBookings.length > 1 ? 's' : ''} expiring soon
                </p>
                <p className="mt-0.5 opacity-70">
                  {data.pendingPayment.expiringBookings.map((b) => `${b.minutesLeft}m`).join(', ')} remaining
                </p>
              </AlertDescription>
            </Alert>
          )}
          {data.expiredBookings.count > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold">
                  {data.expiredBookings.count} expired unpaid booking{data.expiredBookings.count > 1 ? 's' : ''}
                </p>
                <p className="mt-0.5 opacity-70">${data.expiredBookings.totalValue.toFixed(2)} in abandoned payments</p>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Payment method cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <PaymentCard
          label={data.platformStripe.label}
          count={data.platformStripe.count}
          value={data.platformStripe.totalValue}
          icon={<CreditCard className="w-5 h-5" />}
          color="blue"
          subtext={`Avg $${data.platformStripe.avgPrice.toFixed(2)}`}
        />
        <PaymentCard
          label={data.platformWallet.label}
          count={data.platformWallet.count}
          value={data.platformWallet.totalValue}
          icon={<DollarSign className="w-5 h-5" />}
          color="emerald"
        />
        <PaymentCard
          label={data.pendingPayment.label}
          count={data.pendingPayment.count}
          value={data.pendingPayment.totalValue}
          icon={<Clock className="w-5 h-5" />}
          color="amber"
          subtext={`${data.pendingPayment.allBookings.filter((b) => b.minutesLeft > 0).length} active`}
        />
        <PaymentCard
          label={data.expiredBookings.label}
          count={data.expiredBookings.count}
          value={data.expiredBookings.totalValue}
          icon={<AlertCircle className="w-5 h-5" />}
          color="red"
        />
      </div>

      {/* Summary footer */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Total Platform Revenue (24h)</span>
          <span className="text-sm font-semibold text-emerald-400">${data.summary.totalValue.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Platform Fees Collected</span>
          <span className="text-sm font-semibold text-violet-400">${data.summary.platformFeeCollected.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}
