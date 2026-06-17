'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Calendar, MapPin, Banknote, AlertCircle } from 'lucide-react'
import BookingFormNew from '@/components/BookingFormNew'

interface Client {
  id: string
  name: string
  phone: string
  email: string
  addressText?: string
  addressLatitude?: number
  addressLongitude?: number
}

export default function NewBookingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedClientId = searchParams.get('clientId')
  const isOfflineMode = searchParams.get('offline') === 'true'

  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showCalendar, setShowCalendar] = useState(false)
  const [instructorData, setInstructorData] = useState<any>(null)

  // Offline form state
  const [offlineForm, setOfflineForm] = useState({
    clientName: '', clientPhone: '', clientEmail: '',
    date: '', time: '', durationMinutes: 60,
    pickupAddress: '', notes: '',
    offlinePaymentMethod: 'cash' as 'cash' | 'bank_transfer' | 'other',
    offlineAmountPaid: '',
  })
  const [offlineSubmitting, setOfflineSubmitting] = useState(false)
  const [offlineError, setOfflineError] = useState<string | null>(null)
  const [offlineSuccess, setOfflineSuccess] = useState(false)

  // Availability slots for offline booking date picker
  const [offlineSlots, setOfflineSlots] = useState<{ time: string; available: boolean }[]>([])
  const [loadingOfflineSlots, setLoadingOfflineSlots] = useState(false)
  const [offlineSlotsMessage, setOfflineSlotsMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isOfflineMode) {
      fetchClients()
      fetchInstructorData()
    } else {
      // Need instructor data for slot availability even in offline mode
      fetchInstructorData()
    }
  }, [isOfflineMode])

  // Fetch available slots when date or duration changes in offline mode
  useEffect(() => {
    if (!isOfflineMode || !offlineForm.date || !instructorData?.id) return
    setLoadingOfflineSlots(true)
    setOfflineSlots([])
    setOfflineSlotsMessage(null)
    setOfflineForm(p => ({ ...p, time: '' }))
    fetch(`/api/availability/slots?instructorId=${instructorData.id}&date=${offlineForm.date}&duration=${offlineForm.durationMinutes}&bypassDurationCheck=true`)
      .then(r => r.json())
      .then(data => {
        if (data.slots && data.slots.length > 0) {
          setOfflineSlots(data.slots)
        } else {
          setOfflineSlots([])
          setOfflineSlotsMessage(data.message || 'No available slots on this day')
        }
      })
      .catch(() => setOfflineSlotsMessage('Could not load availability'))
      .finally(() => setLoadingOfflineSlots(false))
  }, [isOfflineMode, offlineForm.date, offlineForm.durationMinutes, instructorData?.id])

  useEffect(() => {
    if (preselectedClientId && clients.length > 0) {
      const client = clients.find(c => c.id === preselectedClientId)
      if (client) { setSelectedClient(client); setShowCalendar(true) }
    }
  }, [preselectedClientId, clients])

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients')
      setClients(await res.json())
    } catch { console.error('Failed to fetch clients') }
  }

  const fetchInstructorData = async () => {
    try {
      const res = await fetch('/api/instructor/profile')
      const data = await res.json()
      if (data?.id) setInstructorData(data)
    } catch { console.error('Failed to fetch instructor data') }
  }

  const handleClientSelect = (clientId: string) => {
    const client = clients.find(c => c.id === clientId)
    setSelectedClient(client || null)
    if (client) setShowCalendar(true)
  }

  const handleOfflineSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setOfflineSubmitting(true)
    setOfflineError(null)
    try {
      const res = await fetch('/api/bookings/offline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...offlineForm,
          durationMinutes: Number(offlineForm.durationMinutes),
          offlineAmountPaid: offlineForm.offlineAmountPaid ? Number(offlineForm.offlineAmountPaid) : undefined,
          clientEmail: offlineForm.clientEmail || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setOfflineSuccess(true)
      } else if (data.upgradeRequired) {
        setOfflineError('Offline booking tracking requires PRO or above. Upgrade your subscription to use this feature.')
      } else if (data.platformClientBlocked) {
        setOfflineError('This student has a DriveBook account linked to your profile. Please use a platform booking so they can pay through their wallet.')
      } else if (Array.isArray(data.error)) {
        // Handle validation errors (ZodError returns array)
        const messages = data.error.map((err: any) => {
          const path = Array.isArray(err.path) ? err.path.join('.') : err.path || 'Field'
          return `${path}: ${err.message}`
        }).join('; ')
        setOfflineError(`Validation error: ${messages}`)
      } else if (typeof data.error === 'string') {
        setOfflineError(data.error)
      } else {
        setOfflineError('Failed to create offline booking')
      }
    } catch {
      setOfflineError('Network error. Please try again.')
    } finally {
      setOfflineSubmitting(false)
    }
  }

  if (offlineSuccess) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="bg-slate-900/80 border border-white/10 rounded-3xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-white mb-2">Offline booking logged</h2>
          <p className="text-slate-400 text-sm mb-6">The lesson has been added to your schedule.</p>
          <div className="flex gap-3">
            <button onClick={() => router.push('/dashboard/bookings')} className="flex-1 py-2.5 bg-sky-600 text-white rounded-lg font-medium hover:bg-sky-700 transition-colors">View Bookings</button>
            <button onClick={() => { setOfflineSuccess(false); setOfflineForm({ clientName: '', clientPhone: '', clientEmail: '', date: '', time: '', durationMinutes: 60, pickupAddress: '', notes: '', offlinePaymentMethod: 'cash', offlineAmountPaid: '' }) }} className="flex-1 py-2.5 border border-white/20 text-white rounded-lg font-medium hover:bg-white/10 transition-colors">Add Another</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 py-4 sm:py-8">
        <div className="mb-6">
          <button onClick={() => router.back()} className="text-sky-300 hover:text-sky-200 mb-4 text-sm font-medium">← Back to Bookings</button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              {isOfflineMode ? 'Log Offline / Cash Booking' : 'Create New Booking'}
            </h1>
            {isOfflineMode && <span className="px-3 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-200 rounded-full text-xs font-semibold flex items-center gap-1"><Banknote className="h-3 w-3" /> Offline</span>}
          </div>
          <p className="text-slate-400 mt-1">
            {isOfflineMode
              ? 'Log a lesson paid by cash or bank transfer. Only for students without a DriveBook account.'
              : 'Select a client and choose an available time slot'}
          </p>
        </div>

        {/* ── OFFLINE BOOKING FORM ── */}
        {isOfflineMode ? (
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 shadow-lg p-6">
            <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg mb-6">
              <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-200">
                <p className="font-semibold mb-1">Platform client guard active</p>
                <p>If you provide an email that belongs to a student with a DriveBook account linked to you, the booking will be blocked. Those students must book through the platform.</p>
              </div>
            </div>

            <form onSubmit={handleOfflineSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Client Name *</label>
                  <input required value={offlineForm.clientName} onChange={e => setOfflineForm(p => ({ ...p, clientName: e.target.value }))} className="w-full border border-white/10 bg-slate-950/60 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:border-transparent" placeholder="John Smith" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Phone</label>
                  <input value={offlineForm.clientPhone} onChange={e => setOfflineForm(p => ({ ...p, clientPhone: e.target.value }))} className="w-full border border-white/10 bg-slate-950/60 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:border-transparent" placeholder="0400 000 000" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Email (optional — used for platform client check)</label>
                <input type="email" value={offlineForm.clientEmail} onChange={e => setOfflineForm(p => ({ ...p, clientEmail: e.target.value }))} className="w-full border border-white/10 bg-slate-950/60 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:border-transparent" placeholder="john@example.com" />
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Date *</label>
                  <input required type="date" value={offlineForm.date} onChange={e => setOfflineForm(p => ({ ...p, date: e.target.value, time: '' }))} className="w-full border border-white/10 bg-slate-950/60 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Duration *</label>
                  <select value={offlineForm.durationMinutes} onChange={e => setOfflineForm(p => ({ ...p, durationMinutes: Number(e.target.value), time: '' }))} className="w-full border border-white/10 bg-slate-950/60 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:border-transparent">
                    {[30, 60, 90, 120, 150, 165, 180, 240].map(m => <option key={m} value={m}>{m < 60 ? `${m} min` : `${Math.floor(m/60)}h${m%60>0?` ${m%60}m`:''}`}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Time *</label>
                  {!offlineForm.date ? (
                    <div className="w-full border border-white/10 bg-slate-950/60 rounded-lg px-3 py-2 text-sm text-slate-400">Select a date first</div>
                  ) : loadingOfflineSlots ? (
                    <div className="w-full border border-white/10 bg-slate-950/60 rounded-lg px-3 py-2 text-sm text-slate-400 flex items-center gap-2">
                      <svg className="animate-spin h-3 w-3 text-sky-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                      Checking availability...
                    </div>
                  ) : offlineSlots.length > 0 ? (
                    <select required value={offlineForm.time} onChange={e => setOfflineForm(p => ({ ...p, time: e.target.value }))} className="w-full border border-white/10 bg-slate-950/60 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:border-transparent">
                      <option value="">Pick a slot</option>
                      {offlineSlots.filter(s => s.available).map(s => (
                        <option key={s.time} value={s.time}>{s.time}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-1">
                      <input required type="time" value={offlineForm.time} onChange={e => setOfflineForm(p => ({ ...p, time: e.target.value }))} className="w-full border border-amber-500/40 bg-amber-500/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
                      {offlineSlotsMessage && <p className="text-xs text-amber-300">⚠ {offlineSlotsMessage} — enter time manually</p>}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Payment method</label>
                  <select value={offlineForm.offlinePaymentMethod} onChange={e => setOfflineForm(p => ({ ...p, offlinePaymentMethod: e.target.value as any }))} className="w-full border border-white/10 bg-slate-950/60 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:border-transparent">
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Amount paid ($)</label>
                  <input type="number" min="0" step="0.01" value={offlineForm.offlineAmountPaid} onChange={e => setOfflineForm(p => ({ ...p, offlineAmountPaid: e.target.value }))} className="w-full border border-white/10 bg-slate-950/60 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:border-transparent" placeholder="75.00" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Pickup address</label>
                <input value={offlineForm.pickupAddress} onChange={e => setOfflineForm(p => ({ ...p, pickupAddress: e.target.value }))} className="w-full border border-white/10 bg-slate-950/60 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:border-transparent" placeholder="123 Main St" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Notes</label>
                <textarea rows={2} value={offlineForm.notes} onChange={e => setOfflineForm(p => ({ ...p, notes: e.target.value }))} className="w-full border border-white/10 bg-slate-950/60 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none" placeholder="Any notes..." />
              </div>

              {offlineError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-200 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  {offlineError}
                </div>
              )}

              <button type="submit" disabled={offlineSubmitting} className="w-full py-3 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
                {offlineSubmitting ? 'Logging...' : 'Log Offline Booking'}
              </button>
            </form>
          </div>
        ) : (
          <>
            {/* ── PLATFORM BOOKING FORM ── */}
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 shadow-lg p-4 sm:p-6 mb-6">
              <h2 className="text-lg font-semibold text-white mb-4">Step 1: Select Client</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Choose Client</label>
                  <select value={selectedClient?.id || ''} onChange={(e) => handleClientSelect(e.target.value)} className="w-full px-3 py-2 border border-white/10 bg-slate-950/60 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent">
                    <option value="" className="bg-slate-950">Select a client...</option>
                    {clients.map(client => <option key={client.id} value={client.id} className="bg-slate-950">{client.name} - {client.phone}</option>)}
                  </select>
                </div>
                {selectedClient && (
                  <div className="bg-sky-500/10 border border-sky-500/30 p-4 rounded-lg">
                    <h3 className="font-medium text-white mb-2">Selected Client:</h3>
                    <div className="space-y-1 text-sm text-slate-300">
                      <p><strong className="text-sky-300">Name:</strong> {selectedClient.name}</p>
                      <p><strong className="text-sky-300">Phone:</strong> {selectedClient.phone}</p>
                      <p><strong className="text-sky-300">Email:</strong> {selectedClient.email}</p>
                      {selectedClient.addressText && <p className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 shrink-0 text-sky-400" /><span>{selectedClient.addressText}</span></p>}
                    </div>
                  </div>
                )}
                <p className="text-sm text-slate-400">Don't see your client? <a href="/dashboard/clients" className="text-sky-300 hover:text-sky-200 font-medium">Add a new client first</a></p>
              </div>
            </div>

            {showCalendar && selectedClient && instructorData?.id && (
              <div className="rounded-3xl border border-white/10 bg-slate-900/80 shadow-lg p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Calendar className="h-5 w-5 text-sky-400" />Step 2: Select Date & Time</h2>
                <BookingFormNew instructorId={instructorData.id} hourlyRate={instructorData.hourlyRate} preselectedClient={selectedClient} isInstructorBooking={true} />
              </div>
            )}
            {showCalendar && (!instructorData || !instructorData.id) && (
              <div className="rounded-3xl border border-white/10 bg-slate-900/80 shadow-lg p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto mb-4" />
                <p className="text-slate-400">Loading instructor information...</p>
              </div>
            )}
            {!showCalendar && (
              <div className="rounded-3xl border border-white/10 bg-slate-900/80 shadow-lg p-8 text-center">
                <Calendar className="h-16 w-16 text-slate-500 mx-auto mb-4" />
                <p className="text-slate-400">Select a client above to see available time slots</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
