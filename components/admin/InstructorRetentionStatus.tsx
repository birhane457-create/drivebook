'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, BarChart3, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'

interface RetentionData {
  offlineCash:         { count: number; totalValue: number; label: string }
  offlineBankTransfer: { count: number; totalValue: number; label: string }
  summary: { totalOfflineBookings: number; totalOfflineValue: number; timeRange: string }
}

function RetentionCard({ label, count, value }: { label: string; count: number; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
          <p className="text-2xl font-bold text-foreground">{count}</p>
          <p className="text-xs text-muted-foreground/50 mt-1">${value.toFixed(2)}</p>
        </div>
        <BarChart3 className="w-5 h-5 text-muted-foreground/40" />
      </div>
    </div>
  )
}

export default function InstructorRetentionStatus() {
  const [data, setData]       = useState<RetentionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/admin/booking-payment-status')
        if (!res.ok) throw new Error('Failed to fetch retention status')
        const json = await res.json()
        setData({
          offlineCash:         json.offlineCash,
          offlineBankTransfer: json.offlineBankTransfer,
          summary: {
            totalOfflineBookings: json.offlineCash.count + json.offlineBankTransfer.count,
            totalOfflineValue:    json.offlineCash.totalValue + json.offlineBankTransfer.totalValue,
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
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-48" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
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

  if (!data || data.summary.totalOfflineBookings === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-1">Instructor Retention (Offline)</h2>
          <p className="text-xs text-muted-foreground max-w-sm">
            Lessons tracked on platform but paid outside DriveBook — helps retain instructors on the platform
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-foreground">{data.summary.totalOfflineBookings}</p>
          <p className="text-xs text-muted-foreground">bookings this 24h</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <RetentionCard
          label={data.offlineCash.label}
          count={data.offlineCash.count}
          value={data.offlineCash.totalValue}
        />
        <RetentionCard
          label={data.offlineBankTransfer.label}
          count={data.offlineBankTransfer.count}
          value={data.offlineBankTransfer.totalValue}
        />
      </div>

      <Alert variant="info">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          These are <strong>not platform revenue</strong>. Instructors handle payment directly.
          DriveBook takes zero fees. This feature helps retain instructors on the platform instead
          of switching to competitors.
        </AlertDescription>
      </Alert>
    </div>
  )
}
