'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Clock, CalendarOff, AlertCircle, Save, CheckCircle } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TimeSlot { start: string; end: string }
type WorkingHours = Record<string, TimeSlot[]>

interface Exception {
  id: string
  label: string | null
  exceptionDate: string
  startTime: string
  endTime: string
  allDay: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
}
const DAY_SHORT: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
}

const DEFAULT_SLOT: TimeSlot = { start: '09:00', end: '17:00' }

const defaultWorkingHours = (): WorkingHours =>
  Object.fromEntries(
    DAYS.map(d => [d, d === 'saturday' || d === 'sunday' ? [] : [{ ...DEFAULT_SLOT }]])
  )

// ── Component ─────────────────────────────────────────────────────────────────

export default function AvailabilityPage() {
  const [workingHours, setWorkingHours] = useState<WorkingHours>(defaultWorkingHours())
  const [exceptions, setExceptions] = useState<Exception[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // New exception form state
  const [newEx, setNewEx] = useState({
    label: '',
    exceptionDate: '',
    startTime: '09:00',
    endTime: '17:00',
    allDay: false,
  })
  const [addingEx, setAddingEx] = useState(false)
  const [exError, setExError] = useState<string | null>(null)

  // ── Load ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      fetch('/api/instructor/settings').then(r => r.json()),
      fetch('/api/instructor/availability/exceptions').then(r => r.json()),
    ]).then(([settings, excs]) => {
      if (settings?.workingHours) {
        // Merge with defaults so all 7 days are always present
        const merged = defaultWorkingHours()
        for (const day of DAYS) {
          if (Array.isArray(settings.workingHours[day])) {
            merged[day] = settings.workingHours[day]
          }
        }
        setWorkingHours(merged)
      }
      if (Array.isArray(excs)) setExceptions(excs)
    }).catch(() => {
      showToast('error', 'Failed to load availability settings')
    }).finally(() => setLoading(false))
  }, [])

  // ── Helpers ────────────────────────────────────────────────────────────────

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  function toggleDay(day: string) {
    setWorkingHours(prev => ({
      ...prev,
      [day]: prev[day].length > 0 ? [] : [{ ...DEFAULT_SLOT }],
    }))
  }

  function addSlot(day: string) {
    setWorkingHours(prev => ({
      ...prev,
      [day]: [...prev[day], { ...DEFAULT_SLOT }],
    }))
  }

  function removeSlot(day: string, idx: number) {
    setWorkingHours(prev => ({
      ...prev,
      [day]: prev[day].filter((_, i) => i !== idx),
    }))
  }

  function updateSlot(day: string, idx: number, field: 'start' | 'end', value: string) {
    setWorkingHours(prev => {
      const slots = [...prev[day]]
      slots[idx] = { ...slots[idx], [field]: value }
      return { ...prev, [day]: slots }
    })
  }

  // ── Save working hours ─────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/instructor/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workingHours }),
      })
      if (res.ok) {
        showToast('success', 'Availability saved')
      } else {
        const d = await res.json()
        showToast('error', d.error || 'Failed to save')
      }
    } catch {
      showToast('error', 'Network error')
    } finally {
      setSaving(false)
    }
  }

  // ── Add exception ──────────────────────────────────────────────────────────

  async function handleAddException() {
    setExError(null)
    if (!newEx.exceptionDate) { setExError('Please select a date'); return }
    if (!newEx.allDay && newEx.startTime >= newEx.endTime) {
      setExError('End time must be after start time'); return
    }

    setAddingEx(true)
    try {
      const res = await fetch('/api/instructor/availability/exceptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEx),
      })
      if (res.ok) {
        const created = await res.json()
        setExceptions(prev => [...prev, created])
        setNewEx({ label: '', exceptionDate: '', startTime: '09:00', endTime: '17:00', allDay: false })
        showToast('success', 'Exception added')
      } else {
        const d = await res.json()
        setExError(d.error || 'Failed to add exception')
      }
    } catch {
      setExError('Network error')
    } finally {
      setAddingEx(false)
    }
  }

  async function handleDeleteException(id: string) {
    try {
      const res = await fetch(`/api/instructor/availability/exceptions?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setExceptions(prev => prev.filter(e => e.id !== id))
      }
    } catch {
      showToast('error', 'Failed to delete exception')
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  const activeDays = DAYS.filter(d => workingHours[d].length > 0)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-1 py-8">
      <div className="max-w-3xl mx-auto space-y-8">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium
          ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Availability</h1>
          <p className="text-sm text-slate-400 mt-1">Set your regular working hours and block out specific dates</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Hours'}
        </button>
      </div>

      {/* Weekly hours */}
      <div className="bg-slate-950 rounded-xl shadow-sm border border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-2">
          <Clock className="h-5 w-5 text-cyan-400" />
          <h2 className="font-semibold text-slate-100">Weekly Working Hours</h2>
        </div>

        {/* Day summary strip */}
        <div className="flex gap-1.5 px-1 py-1 border-b border-slate-800 bg-slate-950">
          {DAYS.map(day => (
            <button
              key={day}
              onClick={() => toggleDay(day)}
              title={DAY_LABELS[day]}
              className={`flex-1 py-1.5 rounded text-xs font-semibold transition-colors
                ${workingHours[day].length > 0
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 border border-slate-700 text-slate-400 hover:border-cyan-400'}`}
            >
              {DAY_SHORT[day]}
            </button>
          ))}
        </div>

        <div className="divide-y divide-slate-800">
          {DAYS.map(day => {
            const slots = workingHours[day]
            const isOn = slots.length > 0
            return (
              <div key={day} className={`px-6 py-4 ${!isOn ? 'opacity-60' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {/* Toggle */}
                    <button
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`relative inline-flex h-5 w-9 rounded-full transition-colors shrink-0
                        ${isOn ? 'bg-blue-600' : 'bg-slate-700'}`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5
                        ${isOn ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                    <span className="text-sm font-medium text-slate-100 w-24">{DAY_LABELS[day]}</span>
                    {!isOn && <span className="text-xs text-slate-400">Unavailable</span>}
                  </div>
                  {isOn && (
                    <button
                      onClick={() => addSlot(day)}
                      className="text-xs text-sky-300 hover:text-sky-200 flex items-center gap-1 font-medium"
                    >
                      <Plus className="h-3.5 w-3.5 text-sky-300" /> Add slot
                    </button>
                  )}
                </div>

                {isOn && (
                  <div className="space-y-2 ml-12">
                    {slots.map((slot, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                                <input
                          type="time"
                          value={slot.start}
                          onChange={e => updateSlot(day, idx, 'start', e.target.value)}
                          className="border border-slate-700 rounded-lg px-3 py-1.5 text-sm bg-slate-950 text-slate-100 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                        />
                        <span className="text-slate-400 text-sm">–</span>
                        <input
                          type="time"
                          value={slot.end}
                          onChange={e => updateSlot(day, idx, 'end', e.target.value)}
                          className="border border-slate-700 rounded-lg px-3 py-1.5 text-sm bg-slate-950 text-slate-100 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                        />
                        {slots.length > 1 && (
                          <button
                            onClick={() => removeSlot(day, idx)}
                            className="text-red-400 hover:text-red-600 p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Summary */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 text-xs text-slate-400">
          {activeDays.length === 0
            ? 'No working days set — students cannot book you'
            : `Working ${activeDays.length} day${activeDays.length !== 1 ? 's' : ''} per week: ${activeDays.map(d => DAY_SHORT[d]).join(', ')}`}
        </div>
      </div>

      {/* Exceptions / blocked dates */}
      <div className="bg-slate-950 rounded-xl shadow-sm border border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-2">
          <CalendarOff className="h-5 w-5 text-orange-400" />
          <h2 className="font-semibold text-slate-100">Blocked Dates & Exceptions</h2>
        </div>

        {/* Add form */}
        <div className="px-6 py-5 border-b border-slate-800 space-y-4">
          <p className="text-sm text-slate-400">Block a specific date or time range — e.g. holidays, personal appointments, cash lessons.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Date *</label>
              <input
                type="date"
                value={newEx.exceptionDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setNewEx(p => ({ ...p, exceptionDate: e.target.value }))}
                className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-950 text-slate-100 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Label (optional)</label>
              <input
                type="text"
                value={newEx.label}
                onChange={e => setNewEx(p => ({ ...p, label: e.target.value }))}
                placeholder="e.g. Holiday, Cash lesson"
                className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-950 text-slate-100 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setNewEx(p => ({ ...p, allDay: !p.allDay }))}
              className={`relative inline-flex h-5 w-9 rounded-full transition-colors
                ${newEx.allDay ? 'bg-orange-500' : 'bg-slate-700'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5
                ${newEx.allDay ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm text-slate-300">All day</span>
          </div>

          {!newEx.allDay && (
            <div className="flex items-center gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">From</label>
                <input
                  type="time"
                  value={newEx.startTime}
                  onChange={e => setNewEx(p => ({ ...p, startTime: e.target.value }))}
                  className="border border-slate-700 rounded-lg px-3 py-1.5 text-sm bg-slate-950 text-slate-100 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>
              <span className="text-slate-400 mt-5">–</span>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">To</label>
                <input
                  type="time"
                  value={newEx.endTime}
                  onChange={e => setNewEx(p => ({ ...p, endTime: e.target.value }))}
                  className="border border-slate-700 rounded-lg px-3 py-1.5 text-sm bg-slate-950 text-slate-100 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>
            </div>
          )}

          {exError && (
            <p className="text-sm text-red-600 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" /> {exError}
            </p>
          )}

          <button
            onClick={handleAddException}
            disabled={addingEx}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            {addingEx ? 'Adding...' : 'Block this date'}
          </button>
        </div>

        {/* Existing exceptions */}
        {exceptions.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-slate-400">
            No blocked dates — you&apos;re available on all working days
          </div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {exceptions.map(ex => {
              const dateStr = new Date(ex.exceptionDate).toLocaleDateString('en-AU', {
                weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
              })
              return (
                <li key={ex.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-100">{dateStr}</p>
                    <p className="text-xs text-slate-400">
                      {ex.allDay ? 'All day' : `${ex.startTime} – ${ex.endTime}`}
                      {ex.label ? ` · ${ex.label}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteException(ex.id)}
                    className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-950 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  </div>
  )
}
