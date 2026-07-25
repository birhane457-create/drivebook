'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, AlertCircle } from 'lucide-react'

interface WeeklyEarnings {
  weekStart: string
  weekEnd: string
  weekStartDisplay: string
  weekEndDisplay: string
  completedCount: number
  totalEarned: number
  hourlyRate: number
  bookings: Array<{
    id: string
    date: string | null
    price: number
  }>
}

export function EarningsThisWeekCard() {
  const [data, setData] = useState<WeeklyEarnings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchWeeklyEarnings = async () => {
      try {
        const res = await fetch('/api/instructor/earnings/this-week', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        })
        
        if (res.status === 401) {
          setError('Please log in to view earnings')
          setLoading(false)
          return
        }
        
        if (!res.ok) {
          const errorText = await res.text()
          throw new Error(`API error: ${res.status} - ${errorText}`)
        }
        
        const earningsData = await res.json()
        setData(earningsData)
      } catch (err) {
        console.error('Earnings fetch error:', err)
        setError(err instanceof Error ? err.message : 'Failed to load earnings')
      } finally {
        setLoading(false)
      }
    }

    fetchWeeklyEarnings()
  }, [])

  if (loading) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/20 animate-pulse">
        <div className="h-24 bg-slate-800 rounded" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-red-500/20 bg-red-500/5 p-5 shadow-lg shadow-slate-950/20">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-300">Unable to load earnings</p>
            <p className="text-xs text-red-200/70">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/20 transition hover:bg-slate-900/90">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400 mb-1">This Week</p>
          <p className="text-xs text-slate-500 mb-3">
            {data.weekStartDisplay} - {data.weekEndDisplay}
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-semibold text-white">${data.totalEarned.toFixed(2)}</p>
            <p className="text-sm text-slate-400">
              {data.completedCount} lesson{data.completedCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <TrendingUp className="h-12 w-12 text-emerald-400 flex-shrink-0" />
      </div>

      {/* Breakdown */}
      {data.completedCount > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          {/* FIX DATA-4: removed misleading "N × $rate = total" formula label */}
          <p className="text-xs text-slate-400 mb-2">
            {data.completedCount} lesson{data.completedCount !== 1 ? 's' : ''} completed this week
          </p>
          <div className="text-xs text-slate-500 space-y-1">
            {data.bookings.slice(0, 3).map((booking) => (
              <div key={booking.id} className="flex justify-between">
                <span>{booking.date}</span>
                {/* FIX DATA-3: `booking.price` is now net payout from API (was gross) */}
                <span className="text-emerald-300 font-medium">${booking.price.toFixed(2)}</span>
              </div>
            ))}
            {data.bookings.length > 3 && (
              <p className="text-slate-600 pt-1">+{data.bookings.length - 3} more...</p>
            )}
          </div>
        </div>
      )}

      {data.completedCount === 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-xs text-slate-400">No lessons completed yet this week</p>
        </div>
      )}
    </div>
  )
}
