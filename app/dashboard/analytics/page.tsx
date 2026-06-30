'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, DollarSign, Calendar, Users, Award, XCircle } from 'lucide-react'

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
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [period, setPeriod] = useState<'week' | 'month' | 'year' | 'all'>('month')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnalytics()
  }, [period])

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/analytics?period=${period}`)
      if (res.ok) {
        const data = await res.json()
        setAnalytics(data)
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !analytics) {
    return (
      <div className="flex items-center justify-center py-12"><div className="text-center text-slate-400">Loading analytics...</div></div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto py-4 sm:py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">Analytics</h1>
          <div className="flex gap-2 w-full sm:w-auto flex-wrap">
            <button
              onClick={() => setPeriod('week')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base ${
                period === 'week' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base ${
                period === 'month' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setPeriod('year')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base ${
                period === 'year' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              This Year
            </button>
            <button
              onClick={() => setPeriod('all')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base ${
                period === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              All Time
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 bg-emerald-950 rounded-full flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-emerald-400" />
              </div>
              <TrendingUp className="h-5 w-5 text-emerald-400" />
            </div>
            <p className="text-slate-400 text-sm">Net Earnings</p>
            <p className="text-3xl font-bold text-slate-100">${analytics.netEarnings.toFixed(2)}</p>
            <p className="text-xs text-slate-500 mt-1">
              After platform fees
            </p>
          </div>

          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 bg-sky-950 rounded-full flex items-center justify-center">
                <Calendar className="h-6 w-6 text-sky-400" />
              </div>
            </div>
            <p className="text-slate-400 text-sm">Total Bookings</p>
            <p className="text-3xl font-bold text-slate-100">{analytics.totalBookings}</p>
            <p className="text-sm text-slate-400 mt-1">
              {analytics.completedBookings} completed, {analytics.pendingBookings} pending
            </p>
          </div>

          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 bg-violet-950 rounded-full flex items-center justify-center">
                <Users className="h-6 w-6 text-violet-400" />
              </div>
            </div>
            <p className="text-slate-400 text-sm">New Clients</p>
            <p className="text-3xl font-bold text-slate-100">{analytics.newClients}</p>
          </div>

          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 bg-amber-950 rounded-full flex items-center justify-center">
                <Award className="h-6 w-6 text-amber-400" />
              </div>
            </div>
            <p className="text-slate-400 text-sm">Average Rating</p>
            <p className="text-3xl font-bold text-slate-100">{analytics.averageRating.toFixed(1)}</p>
            <div className="flex gap-1 mt-2">
              {[...Array(5)].map((_, i) => (
                <span key={i} className={i < Math.round(analytics.averageRating) ? 'text-amber-400' : 'text-slate-600'}>★</span>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 bg-emerald-950 rounded-full flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-emerald-400" />
              </div>
            </div>
            <p className="text-slate-400 text-sm">Completion Rate</p>
            <p className="text-3xl font-bold text-slate-100">{analytics.completionRate.toFixed(1)}%</p>
          </div>

          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 bg-rose-950 rounded-full flex items-center justify-center">
                <XCircle className="h-6 w-6 text-rose-400" />
              </div>
            </div>
            <p className="text-slate-400 text-sm">Cancelled</p>
            <p className="text-3xl font-bold text-slate-100">{analytics.cancelledBookings}</p>
          </div>
        </div>

        <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-sm p-6">
          <h2 className="text-xl font-bold text-slate-100 mb-4">Performance Summary</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-slate-400">Completion Rate</span>
                <span className="text-sm font-semibold text-slate-100">{analytics.completionRate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full"
                  style={{ width: `${Math.min(analytics.completionRate, 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-slate-400">Total Net Earnings</span>
                <span className="text-sm font-semibold text-emerald-300">
                  ${analytics.netEarnings.toFixed(2)}
                </span>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-slate-400">Average Earnings per Booking</span>
                <span className="text-sm font-semibold">
                  ${analytics.completedBookings > 0 
                    ? (analytics.netEarnings / analytics.completedBookings).toFixed(2) 
                    : '0.00'}
                </span>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-slate-400">Bookings per Client</span>
                <span className="text-sm font-semibold">
                  {analytics.newClients > 0 
                    ? (analytics.totalBookings / analytics.newClients).toFixed(1) 
                    : '0'}
                </span>
              </div>
            </div>
          </div>
        </div>
    </div>
  )
}
