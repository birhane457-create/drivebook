'use client'
import { DashboardPageLayout } from '@/components/ui'

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
  providerId: string
  isNonRefundable: boolean
  rescheduledFrom: { previousStart: string; previousEnd: string; rescheduledAt: string; reason?: string; wasInsidePenaltyWindow?: boolean }[]
  rescheduleCount: number
  customer: { name: string; phone: string }
  provider: { timezone: string | null; state: string | null } | null
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

  // Resolved from booking.provider once loaded — avoids always-Perth fallback
  const instructorTz = booking
    ? resolveTimezone((booking as any)?.provider?.timezone) || timezoneFromState((booking as any)?.provider?.state ?? '')
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
        `/api/availability/slots?providerId=${booking.providerId}&date=${date}&duration=${durationMins}&excludeBookingId=${params.id}&bypassDurationCheck=true`
      )
      if (res.ok) {
        const data = await res.json()
        setSlots((data as any).slots || [])
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
    <div className="min-h-screen bg-background text-foreground">
      <Toast toast={toast} onClose={clearToast} />
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>

        <h1 className="text-2xl font-bold mb-1 text-foreground">Reschedule Booking</h1>
        <p className="text-muted-foreground text-sm mb-6">Client: {booking.customer?.name ?? (booking as any).customerName ?? 'Guest'} · {booking.customer?.phone ?? (booking as any).customerPhone ?? '—'}</p>

        {/* Past booking warning */}
        {isPast && (
          <div className="bg-destructive/10 border border-destructive/25 rounded-lg p-4 mb-6 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive">This booking is in the past</p>
              <p className="text-sm text-destructive">It was never marked as completed. Please cancel or complete it before rescheduling.</p>
            </div>
          </div>
        )}

        {/* 24h warning banner */}
        {isNearby && !isPast && (
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg p-4 mb-6 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-400">Less than 24 hours away</p>
              <p className="text-sm text-amber-400">
                Rescheduling now will mark this booking as <strong>non-refundable</strong>. If the client cancels after rescheduling, they receive no refund regardless of the new date.
              </p>
            </div>
          </div>
        )}

        {/* Non-refundable badge */}
        {booking.isNonRefundable && (
          <div className="bg-destructive/10 border border-destructive/25 rounded-lg p-3 mb-4 text-sm text-destructive font-medium">
            ⚠️ This booking is marked non-refundable (was rescheduled inside the 24h window)
          </div>
        )}

        {/* Current time */}
        <div className="bg-primary/10 border border-primary/25 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-foreground mb-1">Current booking time</p>
          <p className="text-foreground">
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
              className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <History className="h-3 w-3" />
              Rescheduled {booking.rescheduleCount} time{booking.rescheduleCount > 1 ? 's' : ''} — view history
            </button>
          )}
        </div>

        {/* Reschedule history */}
        {showHistory && booking.rescheduledFrom?.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-4 mb-6 space-y-2">
            <p className="text-sm font-semibold text-foreground mb-2">Reschedule history</p>
            {[...booking.rescheduledFrom].reverse().map((h, i) => (
              <div key={i} className="text-xs text-foreground border-l-2 border-border pl-3">
                <p className="font-medium">
                  {formatLocalDate(h.previousStart, instructorTz, { day: 'numeric', month: 'short' })}
                  {' '}
                  {formatLocalTime(h.previousStart, instructorTz, { hour: '2-digit', minute: '2-digit' })}
                  {' – '}
                  {formatLocalTime(h.previousEnd, instructorTz, { hour: '2-digit', minute: '2-digit' })}
                  {h.wasInsidePenaltyWindow && <span className="ml-2 text-orange-600 font-semibold">⚠️ inside 24h</span>}
                </p>
                <p className="text-muted-foreground/60">
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
            <div className="bg-card border border-border rounded-lg p-4 mb-4">
              <label className="block text-sm font-medium mb-2 text-foreground">
                <Calendar className="inline h-4 w-4 mr-1" />
                New Date
              </label>
              <input
                type="date"
                value={date}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {/* Time slots */}
            {date && (
              <div className="bg-card border border-border rounded-lg p-4 mb-4">
                <label className="block text-sm font-medium mb-3 text-foreground">
                  <Clock className="inline h-4 w-4 mr-1" />
                  Select New Time
                </label>
                {loadingSlots ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Loading available times...</p>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No available slots on this date</p>
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
                            ? 'bg-primary text-foreground ring-2 ring-blue-600'
                            : slot.available
                            ? 'bg-green-50 text-emerald-400 hover:bg-emerald-500/15 border border-green-200'
                            : 'bg-secondary text-muted-foreground cursor-not-allowed'
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
            <div className="bg-card border border-border rounded-lg p-4 mb-6">
              <label className="block text-sm font-medium mb-2 text-foreground">Reason (optional)</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
                placeholder="e.g. Client requested, instructor unavailable..."
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <button
              onClick={handleReschedule}
              disabled={!date || !time || saving}
              className="w-full bg-primary text-foreground py-3 rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Checking...' : 'Confirm Reschedule'}
            </button>
          </>
        )}

        {/* Penalty waiver confirmation modal */}
        {penaltyWarning && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex gap-3 mb-4">
                <AlertTriangle className="h-6 w-6 text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Policy Warning</h3>
                  <p className="text-sm text-foreground">{penaltyWarning.message}</p>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setPenaltyWarning(null)}
                  className="flex-1 border border-border text-foreground py-2 rounded-lg hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmWaiver}
                  disabled={saving}
                  className="flex-1 bg-orange-500 text-foreground py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50"
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
