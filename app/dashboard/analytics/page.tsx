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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">Loading analytics...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-4 sm:py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">Analytics</h1>
          <div className="flex gap-2 w-full sm:w-auto flex-wrap">
            <button
              onClick={() => setPeriod('week')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base ${
                period === 'week' ? 'bg-blue-600 text-white' : 'bg-white'
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base ${
                period === 'month' ? 'bg-blue-600 text-white' : 'bg-white'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setPeriod('year')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base ${
                period === 'year' ? 'bg-blue-600 text-white' : 'bg-white'
              }`}
            >
              This Year
            </button>
            <button
              onClick={() => setPeriod('all')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base ${
                period === 'all' ? 'bg-blue-600 text-white' : 'bg-white'
              }`}
            >
              All Time
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-gray-500 text-sm">Net Earnings</p>
            <p className="text-3xl font-bold">${analytics.netEarnings.toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-1">
              After platform fees
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <p className="text-gray-500 text-sm">Total Bookings</p>
            <p className="text-3xl font-bold">{analytics.totalBookings}</p>
            <p className="text-sm text-gray-500 mt-1">
              {analytics.completedBookings} completed, {analytics.pendingBookings} pending
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <p className="text-gray-500 text-sm">New Clients</p>
            <p className="text-3xl font-bold">{analytics.newClients}</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <Award className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
            <p className="text-gray-500 text-sm">Average Rating</p>
            <p className="text-3xl font-bold">{analytics.averageRating.toFixed(1)}</p>
            <div className="flex gap-1 mt-2">
              {[...Array(5)].map((_, i) => (
                <span key={i} className="text-yellow-400">★</span>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <p className="text-gray-500 text-sm">Completion Rate</p>
            <p className="text-3xl font-bold">{analytics.completionRate.toFixed(1)}%</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
            <p className="text-gray-500 text-sm">Cancelled</p>
            <p className="text-3xl font-bold">{analytics.cancelledBookings}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Performance Summary</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-600">Completion Rate</span>
                <span className="text-sm font-semibold">{analytics.completionRate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${Math.min(analytics.completionRate, 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-600">Total Net Earnings</span>
                <span className="text-sm font-semibold text-green-600">
                  ${analytics.netEarnings.toFixed(2)}
                </span>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-600">Average Earnings per Booking</span>
                <span className="text-sm font-semibold">
                  ${analytics.completedBookings > 0 
                    ? (analytics.netEarnings / analytics.completedBookings).toFixed(2) 
                    : '0.00'}
                </span>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-600">Bookings per Client</span>
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
    </div>
  )
}
