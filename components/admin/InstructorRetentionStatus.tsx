'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, BarChart3, Loader2 } from 'lucide-react'

interface RetentionData {
  offlineCash: { count: number; totalValue: number; label: string }
  offlineBankTransfer: { count: number; totalValue: number; label: string }
  summary: { totalOfflineBookings: number; totalOfflineValue: number; timeRange: string }
}

function RetentionCard({
  label,
  count,
  value,
  color,
}: {
  label: string
  count: number
  value: number
  color: string
}) {
  return (
    <div className={`rounded-lg border p-4 ${color}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
          <p className="text-2xl font-bold">{count}</p>
          <p className="text-xs opacity-60 mt-1">${value.toFixed(2)}</p>
        </div>
        <BarChart3 className="w-5 h-5 opacity-60" />
      </div>
    </div>
  )
}

export default function InstructorRetentionStatus() {
  const [data, setData] = useState<RetentionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/admin/booking-payment-status')
        if (!res.ok) throw new Error('Failed to fetch retention status')
        const json = await res.json()
        setData({
          offlineCash: json.offlineCash,
          offlineBankTransfer: json.offlineBankTransfer,
          summary: {
            totalOfflineBookings: json.offlineCash.count + json.offlineBankTransfer.count,
            totalOfflineValue: json.offlineCash.totalValue + json.offlineBankTransfer.totalValue,
            timeRange: '24 hours',
          },
        })
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
        <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
        <span className="text-sm text-slate-400">Loading retention status…</span>
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

  if (!data || (data.summary.totalOfflineBookings === 0)) {
    return null // Don't show if no offline bookings
  }

  return (
    <div className="space-y-4">
      {/* Header with info */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 mb-1">Instructor Retention (Offline)</h2>
          <p className="text-xs text-slate-500">
            Lessons tracked on platform but paid outside DriveBook — helps retain instructors on the platform
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-slate-100">{data.summary.totalOfflineBookings}</p>
          <p className="text-xs text-slate-500">bookings this 24h</p>
        </div>
      </div>

      {/* Offline payment methods */}
      <div className="grid grid-cols-2 gap-3">
        <RetentionCard
          label={data.offlineCash.label}
          count={data.offlineCash.count}
          value={data.offlineCash.totalValue}
          color="bg-slate-800/50 border-slate-700/50 text-slate-300"
        />
        <RetentionCard
          label={data.offlineBankTransfer.label}
          count={data.offlineBankTransfer.count}
          value={data.offlineBankTransfer.totalValue}
          color="bg-slate-800/50 border-slate-700/50 text-slate-300"
        />
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2 bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
        <AlertCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <div className="flex-1 text-xs text-slate-400">
          <p>
            These are <strong>not platform revenue</strong>. Instructors handle payment directly. DriveBook takes zero
            fees. This feature helps retain instructors on the platform instead of switching to competitors.
          </p>
        </div>
      </div>
    </div>
  )
}
