/**
 * Admin: Failed Notifications Dashboard
 * View and retry failed email/SMS/push notifications
 */

'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, RefreshCw, CheckCircle, XCircle, Mail, MessageSquare, Bell } from 'lucide-react'
import AdminNav from '@/components/admin/AdminNav'

interface FailedNotification {
  id: string
  status: string
  notificationStatus: string
  notificationAttempts: number
  lastNotificationAttempt: string | null
  notificationFailureReason: string | null
  startTime: string
  clientName: string | null
  clientEmail: string | null
  clientPhone: string | null
  instructor: {
    name: string
    email: string
    phone: string
  }
}

interface FailureLog {
  id: string
  bookingId: string
  timestamp: string
  error: string
  metadata: any
}

export default function FailedNotificationsPage() {
  const [bookings, setBookings] = useState<FailedNotification[]>([])
  const [failureLogs, setFailureLogs] = useState<FailureLog[]>([])
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    fetchFailedNotifications()
  }, [])

  async function fetchFailedNotifications() {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/notifications/failed')
      if (!res.ok) throw new Error('Failed to fetch')
      
      const data = await res.json()
      setBookings(data.bookings)
      setFailureLogs(data.failureLogs)
      setTotal(data.total)
    } catch (error) {
      console.error('Error fetching failed notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  async function retryNotification(bookingId: string) {
    try {
      setRetrying(bookingId)
      const res = await fetch('/api/admin/notifications/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      })

      if (!res.ok) throw new Error('Retry failed')

      // Refresh the list
      await fetchFailedNotifications()
      
      alert('Notification retry initiated successfully')
    } catch (error) {
      console.error('Error retrying notification:', error)
      alert('Failed to retry notification')
    } finally {
      setRetrying(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminNav />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-100">Failed Notifications</h1>
              <p className="text-sm text-slate-500 mt-1">
                Monitor and retry failed email, SMS, and push notifications
              </p>
            </div>
            <button
              onClick={fetchFailedNotifications}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span className="text-sm text-slate-500">Failed</span>
            </div>
            <p className="text-3xl font-bold text-red-400">{total}</p>
            <p className="text-xs text-slate-600 mt-1">Bookings with failed notifications</p>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            <div className="flex items-center gap-3 mb-2">
              <XCircle className="w-5 h-5 text-orange-400" />
              <span className="text-sm text-slate-500">Recent Failures</span>
            </div>
            <p className="text-3xl font-bold text-orange-400">{failureLogs.length}</p>
            <p className="text-xs text-slate-600 mt-1">Errors in last 7 days</p>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            <div className="flex items-center gap-3 mb-2">
              <RefreshCw className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-slate-500">Avg Attempts</span>
            </div>
            <p className="text-3xl font-bold text-blue-400">
              {bookings.length > 0
                ? (bookings.reduce((sum, b) => sum + b.notificationAttempts, 0) / bookings.length).toFixed(1)
                : '0'}
            </p>
            <p className="text-xs text-slate-600 mt-1">Per failed notification</p>
          </div>
        </div>

        {/* Failed Notifications Table */}
        <div className="bg-slate-900 rounded-xl border border-slate-800">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-lg font-semibold text-slate-100">Failed Notification Queue</h2>
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
              Loading failed notifications...
            </div>
          ) : bookings.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <p className="text-slate-400">No failed notifications!</p>
              <p className="text-sm text-slate-600 mt-2">All booking notifications delivered successfully.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800">
                <thead className="bg-slate-950">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Booking</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Client</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Instructor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Attempts</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Failure Reason</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-slate-800/50 transition">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-slate-100">{booking.id.slice(0, 8)}</p>
                          <p className="text-xs text-slate-500">
                            {booking.startTime ? new Date(booking.startTime).toLocaleString('en-AU') : 'No date'}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm text-slate-200">{booking.clientName || 'Unknown'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {booking.clientEmail && (
                              <span className="flex items-center gap-1 text-xs text-slate-500">
                                <Mail className="w-3 h-3" /> {booking.clientEmail}
                              </span>
                            )}
                            {booking.clientPhone && (
                              <span className="flex items-center gap-1 text-xs text-slate-500">
                                <MessageSquare className="w-3 h-3" /> {booking.clientPhone}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-200">{booking.instructor.name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          booking.notificationStatus === 'failed'
                            ? 'bg-red-900/40 text-red-300'
                            : 'bg-orange-900/40 text-orange-300'
                        }`}>
                          {booking.notificationStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-400">{booking.notificationAttempts}</span>
                          {booking.lastNotificationAttempt && (
                            <span className="text-xs text-slate-600">
                              {new Date(booking.lastNotificationAttempt).toLocaleString('en-AU', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-slate-500 max-w-xs truncate">
                          {booking.notificationFailureReason || 'Unknown error'}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => retryNotification(booking.id)}
                          disabled={retrying === booking.id}
                          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm rounded-lg transition"
                        >
                          <RefreshCw className={`w-3 h-3 ${retrying === booking.id ? 'animate-spin' : ''}`} />
                          Retry
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Failure Logs */}
        {failureLogs.length > 0 && (
          <div className="mt-8 bg-slate-900 rounded-xl border border-slate-800">
            <div className="px-6 py-4 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-slate-100">Recent Failure Logs (Last 7 Days)</h2>
            </div>
            <div className="px-6 py-4 space-y-3 max-h-96 overflow-y-auto">
              {failureLogs.map((log) => (
                <div key={log.id} className="bg-slate-950 rounded-lg p-4 border border-slate-800">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                        <span className="text-sm font-medium text-slate-300">Booking {log.bookingId.slice(0, 8)}</span>
                        <span className="text-xs text-slate-600">
                          {new Date(log.timestamp).toLocaleString('en-AU')}
                        </span>
                      </div>
                      <p className="text-sm text-red-400 mt-1">{log.error}</p>
                      {log.metadata && (
                        <details className="mt-2">
                          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400">
                            View metadata
                          </summary>
                          <pre className="text-xs text-slate-600 mt-2 bg-slate-900 p-2 rounded overflow-x-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
