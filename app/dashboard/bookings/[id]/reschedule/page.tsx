'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Clock, ArrowLeft, History, AlertTriangle } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import Toast from '@/components/ui/Toast'
import { resolveTimezone, timezoneFromState, formatLocalDate, formatLocalTime, localDateTimeToUTC, DEFAULT_TIMEZONE } from '@/lib/utils/timezone'

interface Booking {
  id: string
  startTime: string
  endTime: string
  status: string
  price: number
  instructorId: string
  isNonRefundable: boolean
  rescheduledFrom: { previousStart: string; previousEnd: string; rescheduledAt: string; reason?: string; wasInsidePenaltyWindow?: boolean }[]
  rescheduleCount: number
  client: { name: string; phone: string }
  instructor: { timezone: string | null; state: string | null } | null
}

interface TimeSlot {
  time: string
  available: boolean
}

export default function ReschedulePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { toast, showToast, clearToast } = useToast()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [reason, setReason] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  // Penalty warning state
  const [penaltyWarning, setPenaltyWarning] = useState<{ message: string; hoursUntil: number } | null>(null)

  // Resolved from booking.instructor once loaded — avoids always-Perth fallback
  const instructorTz = booking
    ? resolveTimezone((booking as any)?.instructor?.timezone) || timezoneFromState((booking as any)?.instructor?.state ?? '')
    : DEFAULT_TIMEZONE

  useEffect(() => { fetchBooking() }, [params.id])
  useEffect(() => { if (date && booking) fetchSlots() }, [date, booking])

  const fetchBooking = async () => {
    try {
      const res = await fetch(`/api/bookings/${params.id}`)
      if (res.ok) {
        setBooking(await res.json())
      } else {
        router.push('/dashboard/bookings')
      }
    } catch {
      router.push('/dashboard/bookings')
    } finally {
      setLoading(false)
    }
  }

  const fetchSlots = async () => {
    if (!booking) return
    setLoadingSlots(true)
    setTime('')
    try {
      const durationMins = Math.round(
        (new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime()) / 60000
      )
      const res = await fetch(
        `/api/availability/slots?instructorId=${booking.instructorId}&date=${date}&duration=${durationMins}&excludeBookingId=${params.id}&bypassDurationCheck=true`
      )
      if (res.ok) {
        const data = await res.json()
        setSlots(data.slots || [])
      }
    } catch {
      setSlots([])
          showToast(
      'error',
      'Unable to load available times. Please try again.'
    )
    } finally {
      setLoadingSlots(false)
    }
  }

  const doReschedule = async (confirmedPenaltyWaiver = false) => {
    if (!date || !time || !booking) return
    setSaving(true)
    try {
      // Build UTC datetime using instructor's timezone — not the browser's local TZ
      const newStart = localDateTimeToUTC(date, time, instructorTz)
      const durationMins = Math.round(
        (new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime()) / 60000
      )
      const newEnd = new Date(newStart.getTime() + durationMins * 60000)

      const res = await fetch(`/api/bookings/${params.id}/reschedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: newStart.toISOString(),
          endTime: newEnd.toISOString(),
          reason: reason || undefined,
          confirmedPenaltyWaiver,
        }),
      })

      const data = await res.json()

      if (res.ok && data.requiresConfirmation) {
        // Server says we're inside penalty window — show warning
        setPenaltyWarning({ message: data.warning, hoursUntil: data.hoursUntil })
        setSaving(false)
        return
      }

      if (res.ok && data.success) {
        router.push('/dashboard/bookings')
      } else {
        showToast('error', data.error || 'Reschedule failed')
      }
    } catch {
      showToast('error', 'Reschedule failed')
    } finally {
      setSaving(false)
    }
  }

  const handleReschedule = () => {
    if (!date || !time) return
    doReschedule(false)
  }

  const handleConfirmWaiver = () => {
    setPenaltyWarning(null)
    doReschedule(true)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  if (!booking) return null

  const durationMins = Math.round(
    (new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime()) / 60000
  )
  const hoursUntilCurrent = (new Date(booking.startTime).getTime() - Date.now()) / (1000 * 60 * 60)
  const isNearby = hoursUntilCurrent < 24 && hoursUntilCurrent > 0
  const isPast = hoursUntilCurrent <= 0

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Toast toast={toast} onClose={clearToast} />
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-400 hover:text-white mb-4">
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>

        <h1 className="text-2xl font-bold mb-1 text-slate-100">Reschedule Booking</h1>
        <p className="text-slate-400 text-sm mb-6">Client: {booking.client?.name ?? (booking as any).clientName ?? 'Guest'} · {booking.client?.phone ?? (booking as any).clientPhone ?? '—'}</p>

        {/* Past booking warning */}
        {isPast && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">This booking is in the past</p>
              <p className="text-sm text-red-700">It was never marked as completed. Please cancel or complete it before rescheduling.</p>
            </div>
          </div>
        )}

        {/* 24h warning banner */}
        {isNearby && !isPast && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-orange-800">Less than 24 hours away</p>
              <p className="text-sm text-orange-700">
                Rescheduling now will mark this booking as <strong>non-refundable</strong>. If the client cancels after rescheduling, they receive no refund regardless of the new date.
              </p>
            </div>
          </div>
        )}

        {/* Non-refundable badge */}
        {booking.isNonRefundable && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-800 font-medium">
            ⚠️ This booking is marked non-refundable (was rescheduled inside the 24h window)
          </div>
        )}

        {/* Current time */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-blue-800 mb-1">Current booking time</p>
          <p className="text-blue-900">
            {formatLocalDate(booking.startTime, instructorTz, { weekday: 'long', day: 'numeric', month: 'long' })}
              {' · '}
              {formatLocalTime(booking.startTime, instructorTz, { hour: '2-digit', minute: '2-digit' })}
              {' – '}
              {formatLocalTime(booking.endTime, instructorTz, { hour: '2-digit', minute: '2-digit' })}
            {' '}({durationMins} min)
          </p>
          {booking.rescheduleCount > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              <History className="h-3 w-3" />
              Rescheduled {booking.rescheduleCount} time{booking.rescheduleCount > 1 ? 's' : ''} — view history
            </button>
          )}
        </div>

        {/* Reschedule history */}
        {showHistory && booking.rescheduledFrom?.length > 0 && (
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 mb-6 space-y-2">
            <p className="text-sm font-semibold text-slate-200 mb-2">Reschedule history</p>
            {[...booking.rescheduledFrom].reverse().map((h, i) => (
              <div key={i} className="text-xs text-slate-300 border-l-2 border-slate-600 pl-3">
                <p className="font-medium">
                  {formatLocalDate(h.previousStart, instructorTz, { day: 'numeric', month: 'short' })}
                  {' '}
                  {formatLocalTime(h.previousStart, instructorTz, { hour: '2-digit', minute: '2-digit' })}
                  {' – '}
                  {formatLocalTime(h.previousEnd, instructorTz, { hour: '2-digit', minute: '2-digit' })}
                  {h.wasInsidePenaltyWindow && <span className="ml-2 text-orange-600 font-semibold">⚠️ inside 24h</span>}
                </p>
                <p className="text-slate-500">
                  Changed {formatLocalDate(h.rescheduledAt, instructorTz, { day: 'numeric', month: 'short', year: 'numeric' })}
                  {h.reason ? ` · ${h.reason}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}

        {!isPast && (
          <>
            {/* New date picker */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-4">
              <label className="block text-sm font-medium mb-2 text-slate-200">
                <Calendar className="inline h-4 w-4 mr-1" />
                New Date
              </label>
              <input
                type="date"
                value={date}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-950 text-slate-100 focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Time slots */}
            {date && (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-4">
                <label className="block text-sm font-medium mb-3 text-slate-200">
                  <Clock className="inline h-4 w-4 mr-1" />
                  Select New Time
                </label>
                {loadingSlots ? (
                  <p className="text-sm text-slate-400 text-center py-4">Loading available times...</p>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">No available slots on this date</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto">
                    {slots.map(slot => (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={!slot.available}
                        onClick={() => setTime(slot.time)}
                        className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                          time === slot.time
                            ? 'bg-blue-600 text-white ring-2 ring-blue-600'
                            : slot.available
                            ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                )}
                {time && <p className="text-sm text-emerald-400 mt-2">✓ Selected: {time}</p>}
              </div>
            )}

            {/* Optional reason */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-6">
              <label className="block text-sm font-medium mb-2 text-slate-200">Reason (optional)</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
                placeholder="e.g. Client requested, instructor unavailable..."
                className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-950 text-slate-100 focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <button
              onClick={handleReschedule}
              disabled={!date || !time || saving}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Checking...' : 'Confirm Reschedule'}
            </button>
          </>
        )}

        {/* Penalty waiver confirmation modal */}
        {penaltyWarning && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex gap-3 mb-4">
                <AlertTriangle className="h-6 w-6 text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-slate-100 mb-2">Policy Warning</h3>
                  <p className="text-sm text-slate-300">{penaltyWarning.message}</p>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setPenaltyWarning(null)}
                  className="flex-1 border border-slate-600 text-slate-300 py-2 rounded-lg hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmWaiver}
                  disabled={saving}
                  className="flex-1 bg-orange-500 text-white py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50"
                >
                  {saving ? 'Rescheduling...' : 'Confirm & Waive Fee'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
