'use client'

import { useState, useEffect } from 'react'
import {
  Car, Calendar, MapPin, Plus, CheckCircle, XCircle, Clock,
  ChevronDown, ChevronUp, Edit2, Save, X, Loader2, User, Phone, Mail, DollarSign,
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { resolveTimezone, DEFAULT_TIMEZONE } from '@/lib/utils/timezone'
import Toast from '@/components/ui/Toast'

// ── Types ──────────────────────────────────────────────────────────────────────

interface PDATest {
  id: string
  testDate: string
  testTime: string
  testCenterName: string
  testCenterAddress: string
  result: string
  price: number
  status: string
  client: { name: string; phone: string; email: string }
}

interface Client { id: string; name: string; phone: string; email: string }

interface PDAConfig {
  id: string
  name: string
  durationMinutes: number
  price: number
  discountPercent: number | null
  isActive: boolean
  testCentres: {
    testCentre: { id: string; name: string; address: string }
  }[]
}

interface AvailableSlot {
  time: string
  available: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const resultColor = (r: string) =>
  r === 'PASS' ? 'bg-green-900/40 text-green-300' :
  r === 'FAIL' ? 'bg-red-900/40 text-red-300' :
  'bg-yellow-900/40 text-yellow-300'

const resultIcon = (r: string) =>
  r === 'PASS' ? <CheckCircle className="h-5 w-5 text-green-600" /> :
  r === 'FAIL' ? <XCircle className="h-5 w-5 text-red-600" /> :
  <Clock className="h-5 w-5 text-yellow-600" />

const today = new Date().toISOString().split('T')[0]

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PDATestsPage() {
  // List data
  const [tests, setTests]     = useState<PDATest[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [configs, setConfigs] = useState<PDAConfig[]>([])
  const [instructorId, setInstructorId] = useState<string>('')

  // UI state
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [editResult, setEditResult] = useState('')
  // C-03: validation error for slot selection (inline, near the form)
  const [slotError, setSlotError] = useState<string | null>(null)

  const { toast, showToast, clearToast } = useToast()
  const [instructorTz, setInstructorTz] = useState(DEFAULT_TIMEZONE)

  // Form — step-by-step
  const [form, setForm] = useState({
    clientId:    '',
    configId:    '',
    testCentreId: '',
    testDate:    '',
    selectedSlot: '', // HH:mm
    price:       '',  // override
  })

  // Derived from selected config
  const [availableCentres, setAvailableCentres] = useState<{ id: string; name: string; address: string }[]>([])
  const [slots, setSlots]           = useState<AvailableSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError]     = useState('')

  // ── Load on mount ────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchAll()
    fetch('/api/instructor/settings').then(r => r.ok ? r.json() : null).then(s => { if (s?.timezone) setInstructorTz(resolveTimezone(s.timezone)) }).catch(() => {})
  }, [])

  const fetchAll = async () => {
    try {
      const [testsRes, clientsRes, configsRes, profileRes] = await Promise.all([
        fetch('/api/pda-tests'),
        fetch('/api/clients'),
        fetch('/api/instructor/pda-configs'),
        fetch('/api/instructor/profile'),
      ])

      if (testsRes.ok)   setTests(await testsRes.json())

      if (clientsRes.ok) {
        const d = await clientsRes.json()
        setClients(Array.isArray(d) ? d : (Array.isArray(d.clients) ? d.clients : []))
      }

      if (configsRes.ok) {
        const d = await configsRes.json()
        const list: PDAConfig[] = Array.isArray(d) ? d : (Array.isArray(d.configs) ? d.configs : [])
        setConfigs(list.filter(c => c.isActive))
      }

      if (profileRes.ok) {
        const p = await profileRes.json()
        if (p?.id) setInstructorId(p.id)
      }
    } catch (e) {
      console.error('Failed to load PDA test data:', e)
    } finally {
      setLoading(false)
    }
  }

  // ── When config changes → update available test centres ──────────────────────

  useEffect(() => {
    if (!form.configId) {
      setAvailableCentres([])
      setForm(f => ({ ...f, testCentreId: '', testDate: '', selectedSlot: '' }))
      return
    }
    const config = configs.find(c => c.id === form.configId)
    if (!config) return
    const centres = config.testCentres.map(tc => tc.testCentre)
    setAvailableCentres(centres)
    // Auto-select if only one centre
    const autoId = centres.length === 1 ? centres[0].id : ''
    setForm(f => ({ ...f, testCentreId: autoId, testDate: '', selectedSlot: '', price: String(config.price) }))
    setSlots([])
  }, [form.configId, configs])

  // ── When date + centre + config all set → fetch available slots ──────────────

  useEffect(() => {
    if (!form.configId || !form.testCentreId || !form.testDate || !instructorId) {
      setSlots([])
      return
    }

    const fetchSlots = async () => {
      setSlotsLoading(true)
      setSlotsError('')
      setForm(f => ({ ...f, selectedSlot: '' }))
      try {
        const res = await fetch(
          `/api/availability/pda-tests?instructorId=${instructorId}&configId=${form.configId}&testCentreId=${form.testCentreId}&date=${form.testDate}`
        )
        if (!res.ok) {
          const d = await res.json()
          throw new Error(d.error || 'Failed to fetch slots')
        }
        const d = await res.json()
        setSlots(Array.isArray(d.slots) ? d.slots : [])
      } catch (err: any) {
        setSlotsError(err.message || 'Could not load available slots')
        setSlots([])
      } finally {
        setSlotsLoading(false)
      }
    }

    fetchSlots()
  }, [form.configId, form.testCentreId, form.testDate, instructorId])

  // ── Submit ───────────────────────────────────────────────────────────────────

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.selectedSlot) {
      setSlotError('Please select a time slot.')
      return
    }
    setSlotError(null)
    setSaving(true)
    try {
      const config = configs.find(c => c.id === form.configId)
      const res = await fetch('/api/pda-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId:     form.clientId,
          testDate:     form.testDate,
          testTime:     form.selectedSlot,
          testCentreId: form.testCentreId,
          price: form.price ? parseFloat(form.price) : undefined,
        }),
      })
      if (res.ok) {
        setForm({ clientId: '', configId: '', testCentreId: '', testDate: '', selectedSlot: '', price: '' })
        setShowForm(false)
        setSlots([])
        fetchAll()
      } else {
        const d = await res.json()
        showToast('error', d.error || 'Failed to schedule test.')
      }
    } catch {
      showToast('error', 'Failed to schedule test.')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateResult = async (id: string) => {
    try {
      const res = await fetch(`/api/pda-tests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: editResult }),
      })
      if (res.ok) { setEditingId(null); setEditResult(''); fetchAll() }
      else showToast('error', 'Failed to update result.')
    } catch { showToast('error', 'Failed to update result.') }
  }

  const toggleExpand = (id: string) => {
    if (editingId === id) return
    setExpandedId(expandedId === id ? null : id)
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const selectedConfig = configs.find(c => c.id === form.configId)
  const formComplete = form.clientId && form.configId && form.testCentreId && form.testDate


  // ── Render ───────────────────────────────────────────────────────────────────

  return (
          <div className="max-w-4xl mx-auto px-1 py-2 sm:py-8">
        <Toast toast={toast} onClose={clearToast} />

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100">PDA Tests ({tests.length})</h1>
          <button
            onClick={() => { setShowForm(!showForm); setForm({ clientId: '', configId: '', testCentreId: '', testDate: '', selectedSlot: '', price: '' }); setSlots([]) }}
            className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700"
          >
            {showForm ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            {showForm ? 'Cancel' : 'Schedule Test'}
          </button>
        </div>

        {/* No configs warning */}
        {showForm && configs.length === 0 && (
          <div className="bg-amber-900/30 border border-amber-700 rounded-xl p-4 mb-6 text-amber-300 text-sm">
            You have no active PDA test configurations. Go to <strong>Settings → PDA Test Packages</strong> to create one first.
          </div>
        )}

        {/* Schedule Form */}
        {showForm && configs.length > 0 && (
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 mb-6">
            <h2 className="text-lg font-bold text-slate-100 mb-5">Schedule PDA Test</h2>
            <form onSubmit={handleSchedule} className="space-y-5">

              {/* Row 1: Student + PDA Package */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Student <span className="text-red-400">*</span></label>
                  <select
                    required
                    value={form.clientId}
                    onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select student...</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {clients.length === 0 && (
                    <p className="text-xs text-slate-500 mt-1">No students found. Add students from the Clients page.</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">PDA Package <span className="text-red-400">*</span></label>
                  <select
                    required
                    value={form.configId}
                    onChange={e => setForm(f => ({ ...f, configId: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select package...</option>
                    {configs.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.durationMinutes}min — ${c.discountPercent ? (c.price * (1 - c.discountPercent / 100)).toFixed(0) : c.price}
                        {c.discountPercent ? ` (${c.discountPercent}% off)` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Config details pill */}
              {selectedConfig && (
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="bg-blue-900/40 text-blue-300 px-2.5 py-1 rounded-full">{selectedConfig.durationMinutes} min</span>
                  <span className="bg-emerald-900/40 text-emerald-300 px-2.5 py-1 rounded-full">${selectedConfig.price}</span>
                  {selectedConfig.discountPercent && (
                    <span className="bg-purple-900/40 text-purple-300 px-2.5 py-1 rounded-full">{selectedConfig.discountPercent}% discount applied</span>
                  )}
                  <span className="bg-slate-700/60 text-slate-300 px-2.5 py-1 rounded-full">{selectedConfig.testCentres.length} centre{selectedConfig.testCentres.length !== 1 ? 's' : ''} available</span>
                </div>
              )}

              {/* Row 2: Test Centre (only when config selected) */}
              {form.configId && availableCentres.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Test Centre <span className="text-red-400">*</span></label>
                  <select
                    required
                    value={form.testCentreId}
                    onChange={e => setForm(f => ({ ...f, testCentreId: e.target.value, testDate: '', selectedSlot: '' }))}
                    className="w-full px-3 py-2.5 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {availableCentres.length > 1 && <option value="">Select test centre...</option>}
                    {availableCentres.map(tc => (
                      <option key={tc.id} value={tc.id}>{tc.name} — {tc.address}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Row 3: Date (only when centre selected) */}
              {form.testCentreId && (
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Test Date <span className="text-red-400">*</span></label>
                  <input
                    type="date"
                    required
                    min={today}
                    value={form.testDate}
                    onChange={e => setForm(f => ({ ...f, testDate: e.target.value, selectedSlot: '' }))}
                    className="w-full sm:w-64 px-3 py-2.5 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              )}

              {/* Row 4: Available slots (only when date selected) */}
              {formComplete && (
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Available Slots
                    {slotsLoading && <span className="ml-2 text-slate-400 text-xs">Loading...</span>}
                  </label>

                  {slotsLoading && (
                    <div className="flex items-center gap-2 text-slate-400 text-sm py-3">
                      <Loader2 className="h-4 w-4 animate-spin" /> Checking availability...
                    </div>
                  )}

                  {!slotsLoading && slotsError && (
                    <div className="text-red-400 text-sm py-2">{slotsError}</div>
                  )}

                  {!slotsLoading && !slotsError && slots.length === 0 && (
                    <div className="bg-slate-800 rounded-lg px-4 py-3 text-slate-400 text-sm">
                      No available slots on this date. Try a different date.
                    </div>
                  )}

                  {!slotsLoading && slots.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {slots.filter(s => s.available).map(slot => (
                        <button
                          key={slot.time}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, selectedSlot: slot.time }))}
                          className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition ${
                            form.selectedSlot === slot.time
                              ? 'border-blue-500 bg-blue-900/40 text-blue-200'
                              : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-blue-600 hover:text-white'
                          }`}
                        >
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Price override */}
              {form.selectedSlot && (
                <div className="sm:w-64">
                  <label className="block text-sm font-medium text-slate-200 mb-1">
                    Price ($)
                    <span className="ml-1 text-xs text-slate-400 font-normal">optional override</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={selectedConfig ? String(selectedConfig.price) : '0.00'}
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-xs text-slate-500 mt-1">Leave blank to use the package price.</p>
                </div>
              )}

              {/* Booking summary */}
              {form.selectedSlot && selectedConfig && (
                <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg px-4 py-3 text-sm text-blue-200 space-y-1">
                  <div className="font-semibold text-blue-100">Booking summary</div>
                  <div>Package: {selectedConfig.name}</div>
                  <div>Duration: {selectedConfig.durationMinutes} min — blocks until {(() => {
                    const [h, m] = form.selectedSlot.split(':').map(Number)
                    const end = new Date(0, 0, 0, h, m + selectedConfig.durationMinutes)
                    return `${String(end.getHours()).padStart(2,'0')}:${String(end.getMinutes()).padStart(2,'0')}`
                  })()}</div>
                  <div>Time: {form.testDate} at {form.selectedSlot}</div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1 flex-col">
                {/* C-03: inline slot validation error — stays visible near the button */}
                {slotError && (
                  <p role="alert" className="text-sm text-amber-300 bg-amber-950/40 border border-amber-700/50 rounded-lg px-3 py-2">
                    ⚠️ {slotError}
                  </p>
                )}
                <div className="flex gap-3">
                  <button type="button" onClick={() => { setShowForm(false); setSlots([]) }}
                    className="flex-1 py-2.5 border border-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-800 transition">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !form.selectedSlot}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Car className="h-4 w-4" />}
                    Schedule Test
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Tests list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : tests.length === 0 ? (
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-12 text-center">
            <Car className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-slate-100">No PDA tests scheduled</h3>
            <p className="text-slate-400">Click &quot;Schedule Test&quot; to add your first test</p>
          </div>
        ) : (
          <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
            <div className="divide-y divide-slate-700">
              {tests.map(test => {
                const isExpanded = expandedId === test.id
                const isEditing  = editingId  === test.id
                const testDate   = new Date(test.testDate)

                return (
                  <div key={test.id} className="hover:bg-slate-800 transition">
                    <div className="p-4 cursor-pointer flex items-center justify-between gap-4"
                      onClick={() => !isEditing && toggleExpand(test.id)}>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="shrink-0">{resultIcon(test.result)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="font-semibold truncate text-slate-100">{test.client.name}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${resultColor(test.result)}`}>{test.result}</span>
                            {test.price > 0 && <span className="text-xs text-slate-400">${test.price.toFixed(0)}</span>}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-slate-400">
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{testDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: instructorTz })}</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{test.testTime}</span>
                            <span className="hidden sm:flex items-center gap-1 truncate"><MapPin className="h-3 w-3 shrink-0" />{test.testCenterName}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!isEditing && test.result === 'PENDING' && (
                          <button onClick={e => { e.stopPropagation(); setEditingId(test.id); setEditResult(test.result); setExpandedId(test.id) }}
                            className="p-2 hover:bg-slate-700 rounded-lg text-sky-400" title="Update result">
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                        {!isEditing && (isExpanded
                          ? <ChevronUp className="h-5 w-5 text-slate-400" />
                          : <ChevronDown className="h-5 w-5 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 bg-slate-950 space-y-4 border-t border-slate-700">
                        {isEditing ? (
                          <div className="space-y-4 pt-4">
                            <p className="text-sm font-medium text-slate-200">Update Test Result</p>
                            <div className="flex gap-3">
                              <button onClick={() => setEditResult('PASS')}
                                className={`flex-1 px-4 py-3 rounded-xl border-2 flex items-center justify-center gap-2 font-medium transition ${editResult === 'PASS' ? 'border-green-500 bg-green-900/40 text-green-300' : 'border-slate-700 hover:border-green-600 text-slate-300'}`}>
                                <CheckCircle className="h-5 w-5" /> Pass
                              </button>
                              <button onClick={() => setEditResult('FAIL')}
                                className={`flex-1 px-4 py-3 rounded-xl border-2 flex items-center justify-center gap-2 font-medium transition ${editResult === 'FAIL' ? 'border-red-500 bg-red-900/40 text-red-300' : 'border-slate-700 hover:border-red-600 text-slate-300'}`}>
                                <XCircle className="h-5 w-5" /> Fail
                              </button>
                            </div>
                            <div className="flex gap-3">
                              <button onClick={() => handleUpdateResult(test.id)} disabled={!editResult || editResult === test.result}
                                className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-semibold">
                                <Save className="h-4 w-4" /> Save Result
                              </button>
                              <button onClick={() => { setEditingId(null); setEditResult('') }}
                                className="flex-1 border border-slate-700 text-slate-300 px-4 py-2.5 rounded-lg hover:bg-slate-800 flex items-center justify-center gap-2 text-sm">
                                <X className="h-4 w-4" /> Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="grid sm:grid-cols-2 gap-4 text-sm pt-4">
                            <div>
                              <p className="font-medium text-slate-200 mb-2">Student</p>
                              <div className="space-y-1.5 text-slate-400">
                                <div className="flex items-center gap-2"><User className="h-4 w-4 text-slate-500" />{test.client.name}</div>
                                <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-500" />{test.client.phone}</div>
                                <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-500" />{test.client.email}</div>
                              </div>
                            </div>
                            <div>
                              <p className="font-medium text-slate-200 mb-2">Test Centre</p>
                              <div className="space-y-1.5 text-slate-400">
                                <div className="font-medium text-slate-200">{test.testCenterName}</div>
                                <div className="flex items-start gap-2"><MapPin className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />{test.testCenterAddress}</div>
                                {test.price > 0 && (
                                  <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-slate-500" />${test.price.toFixed(2)}</div>
                                )}
                              </div>
                            </div>
                            {test.result === 'PENDING' && (
                              <div className="sm:col-span-2 pt-2 border-t border-slate-800">
                                <button onClick={() => { setEditingId(test.id); setEditResult(test.result) }}
                                  className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm font-semibold">
                                  <Edit2 className="h-4 w-4" /> Update Result
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>

  )
}
