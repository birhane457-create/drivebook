'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Clock, CreditCard, DollarSign, Loader2 } from 'lucide-react'

interface PaymentStatusData {
  platformStripe: { count: number; totalValue: number; avgPrice: number; label: string }
  platformWallet: { count: number; totalValue: number; label: string }
  offlineCash: { count: number; totalValue: number; label: string }
  offlineBankTransfer: { count: number; totalValue: number; label: string }
  pendingPayment: {
    count: number
    totalValue: number
    expiringBookings: Array<{ bookingId: string; minutesLeft: number; expired: boolean }>
    allBookings: Array<{ bookingId: string; minutesLeft: number; expired: boolean }>
    label: string
  }
  expiredBookings: { count: number; totalValue: number; label: string }
  summary: { totalBookings: number; totalValue: number; platformFeeCollected: number; timeRange: string }
}

function PaymentCard({
  label,
  count,
  value,
  icon,
  color,
  subtext,
}: {
  label: string
  count: number
  value: number
  icon: React.ReactNode
  color: string
  subtext?: string
}) {
  return (
    <div className={`rounded-lg border p-4 ${color}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
          <p className="text-2xl font-bold">{count}</p>
          <p className="text-xs opacity-60 mt-1">${value.toFixed(2)}</p>
          {subtext && <p className="text-xs opacity-50 mt-1">{subtext}</p>}
        </div>
        {icon}
      </div>
    </div>
  )
}

export default function BookingPaymentStatus() {
  const [data, setData] = useState<PaymentStatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/admin/booking-payment-status')
        if (!res.ok) throw new Error('Failed to fetch payment status')
        const json = await res.json()
        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-8 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
        <span className="text-sm text-slate-400">Loading payment status…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4">
        <p className="text-sm text-red-300">Error: {error}</p>
      </div>
    )
  }

  if (!data) return null

  const hasUrgentExpiring =
    data.pendingPayment.expiringBookings.length > 0 || data.expiredBookings.count > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-sm font-semibold text-slate-100 mb-1">Platform Revenue Status</h2>
        <p className="text-xs text-slate-500">Last 24 hours — payments processed through DriveBook</p>
      </div>

      {/* Urgent alerts */}
      {hasUrgentExpiring && (
        <div className="space-y-2">
          {data.pendingPayment.expiringBookings.length > 0 && (
            <div className="flex items-start gap-3 bg-orange-900/20 border border-orange-700/40 rounded-lg p-3">
              <Clock className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <p className="font-semibold text-orange-300">
                  {data.pendingPayment.expiringBookings.length} payment{
                    data.pendingPayment.expiringBookings.length > 1 ? 's' : ''
                  } expiring soon
                </p>
                <p className="text-orange-200/70 mt-0.5">
                  {data.pendingPayment.expiringBookings.map((b) => `${b.minutesLeft}m`).join(', ')} remaining
                </p>
              </div>
            </div>
          )}
          {data.expiredBookings.count > 0 && (
            <div className="flex items-start gap-3 bg-red-900/20 border border-red-700/40 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <p className="font-semibold text-red-300">
                  {data.expiredBookings.count} expired unpaid booking{data.expiredBookings.count > 1 ? 's' : ''}
                </p>
                <p className="text-red-200/70 mt-0.5">${data.expiredBookings.totalValue.toFixed(2)} in abandoned payments</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payment methods grid — PLATFORM REVENUE ONLY */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <PaymentCard
          label={data.platformStripe.label}
          count={data.platformStripe.count}
          value={data.platformStripe.totalValue}
          icon={<CreditCard className="w-5 h-5 opacity-60" />}
          color="bg-blue-900/20 border-blue-700/40 text-blue-300"
          subtext={`Avg $${data.platformStripe.avgPrice.toFixed(2)}`}
        />
        <PaymentCard
          label={data.platformWallet.label}
          count={data.platformWallet.count}
          value={data.platformWallet.totalValue}
          icon={<DollarSign className="w-5 h-5 opacity-60" />}
          color="bg-emerald-900/20 border-emerald-700/40 text-emerald-300"
        />
        <PaymentCard
          label={data.pendingPayment.label}
          count={data.pendingPayment.count}
          value={data.pendingPayment.totalValue}
          icon={<Clock className="w-5 h-5 opacity-60" />}
          color="bg-orange-900/20 border-orange-700/40 text-orange-300"
          subtext={`${data.pendingPayment.allBookings.filter((b) => b.minutesLeft > 0).length} active`}
        />
        <PaymentCard
          label={data.expiredBookings.label}
          count={data.expiredBookings.count}
          value={data.expiredBookings.totalValue}
          icon={<AlertCircle className="w-5 h-5 opacity-60" />}
          color="bg-red-900/20 border-red-700/40 text-red-300"
        />
      </div>

      {/* Summary footer */}
      <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400">Total Platform Revenue (24h)</span>
          <span className="text-sm font-semibold text-emerald-300">${data.summary.totalValue.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400">Platform Fees Collected</span>
          <span className="text-sm font-semibold text-violet-300">${data.summary.platformFeeCollected.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}
