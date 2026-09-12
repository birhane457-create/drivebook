'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Save, Loader2, ChevronDown, ChevronUp } from 'lucide-react'

type Service = {
  id?: string
  name: string
  description: string
  duration: number
  price: number
  bookingMode: 'appointment' | 'request' | 'package'
  locationMode: 'provider_travels' | 'customer_travels' | 'remote' | 'flexible'
  payOnBooking: boolean
  quoteRequired: boolean
  freeCancellationHours: number
  minAdvanceHours: number
  aiCanBook: boolean
  aiCanQuote: boolean
}

const BLANK: Service = {
  name: '', description: '', duration: 60, price: 0,
  bookingMode: 'appointment', locationMode: 'flexible',
  payOnBooking: true, quoteRequired: false,
  freeCancellationHours: 48, minAdvanceHours: 2,
  aiCanBook: false, aiCanQuote: false,
}

const SELECT = 'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500'
const INPUT  = 'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-foreground placeholder-gray-600 focus:outline-none focus:border-blue-500'

export default function ServicesPage() {
  const [services, setServices]   = useState<Service[]>([])
  const [expanded, setExpanded]   = useState<number | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState<number | null>(null)
  const [deleting, setDeleting]   = useState<number | null>(null)
  const [msg, setMsg]             = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/business/services').then(r => r.json()).then(d => {
      setServices(Array.isArray(d) ? d : [])
      setLoading(false)
    })
  }, [])

  const update = (i: number, patch: Partial<Service>) =>
    setServices(s => s.map((x, idx) => idx === i ? { ...x, ...patch } : x))

  const addService = () => {
    setServices(s => [...s, { ...BLANK }])
    setExpanded(services.length)
  }

  const saveService = async (i: number) => {
    setSaving(i); setMsg(null)
    const svc = services[i]
    const method = svc.id ? 'PUT' : 'POST'
    const url    = svc.id ? `/api/business/services/${svc.id}` : '/api/business/services'
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(svc) })
    const d = await r.json()
    setSaving(null)
    if (r.ok) {
      update(i, d.service ?? {})
      setMsg('Saved.')
    } else {
      setMsg(d.error ?? 'Save failed.')
    }
  }

  const deleteService = async (i: number) => {
    const svc = services[i]
    if (!svc.id) { setServices(s => s.filter((_, idx) => idx !== i)); return }
    if (!confirm(`Delete "${svc.name}"?`)) return
    setDeleting(i)
    await fetch(`/api/business/services/${svc.id}`, { method: 'DELETE' })
    setServices(s => s.filter((_, idx) => idx !== i))
    setDeleting(null)
  }

  if (loading) return <div className="text-muted-foreground/60 text-sm">Loading…</div>

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Services</h1>
          <p className="mt-1 text-sm text-muted-foreground">Define what your business offers.</p>
        </div>
        <button onClick={addService}
          className="flex items-center gap-2 rounded-lg bg-primary hover:bg-blue-500 px-3 py-2 text-sm font-medium text-foreground transition-colors">
          <Plus className="h-4 w-4" /> Add Service
        </button>
      </div>

      {msg && <p className="text-sm text-emerald-400">{msg}</p>}

      {services.length === 0 && (
        <div className="rounded-xl bg-gray-900 border border-gray-800 border-dashed p-10 text-center">
          <p className="text-muted-foreground/60 text-sm">No services yet. Add your first service to get started.</p>
        </div>
      )}

      {services.map((svc, i) => (
        <div key={i} className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
          {/* Header row */}
          <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800/50 transition-colors"
            onClick={() => setExpanded(expanded === i ? null : i)}>
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-medium text-foreground text-sm truncate">{svc.name || 'Untitled service'}</span>
              {svc.price > 0 && <span className="text-xs text-muted-foreground/60">${svc.price} · {svc.duration}min</span>}
              <span className="text-xs px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-muted-foreground">{svc.bookingMode}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={e => { e.stopPropagation(); deleteService(i) }} disabled={deleting === i}
                className="p-1.5 rounded text-gray-600 hover:text-destructive transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
              {expanded === i ? <ChevronUp className="h-4 w-4 text-muted-foreground/60" /> : <ChevronDown className="h-4 w-4 text-muted-foreground/60" />}
            </div>
          </button>

          {/* Expanded form */}
          {expanded === i && (
            <div className="px-5 pb-5 border-t border-gray-800 pt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Name <span className="text-destructive">*</span></label>
                <input className={INPUT} value={svc.name} onChange={e => update(i, { name: e.target.value })} placeholder="60-Minute Consultation" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                <textarea className={INPUT + ' resize-none h-20'} value={svc.description} onChange={e => update(i, { description: e.target.value })} placeholder="Brief description…" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Price ($)</label>
                  <input type="number" className={INPUT} value={svc.price} onChange={e => update(i, { price: Number(e.target.value) })} min="0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Duration (min)</label>
                  <input type="number" className={INPUT} value={svc.duration} onChange={e => update(i, { duration: Number(e.target.value) })} min="0" step="15" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Booking Mode</label>
                  <select className={SELECT} value={svc.bookingMode} onChange={e => update(i, { bookingMode: e.target.value as any })}>
                    <option value="appointment">Appointment</option>
                    <option value="request">Request (quote first)</option>
                    <option value="package">Package</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Location</label>
                  <select className={SELECT} value={svc.locationMode} onChange={e => update(i, { locationMode: e.target.value as any })}>
                    <option value="provider_travels">Provider travels to customer</option>
                    <option value="customer_travels">Customer travels to provider</option>
                    <option value="remote">Remote (phone/video)</option>
                    <option value="flexible">Flexible</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Free cancellation (hours)</label>
                  <input type="number" className={INPUT} value={svc.freeCancellationHours} onChange={e => update(i, { freeCancellationHours: Number(e.target.value) })} min="0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Min. advance booking (hours)</label>
                  <input type="number" className={INPUT} value={svc.minAdvanceHours} onChange={e => update(i, { minAdvanceHours: Number(e.target.value) })} min="0" />
                </div>
              </div>
              {/* Toggles */}
              <div className="space-y-3">
                {[
                  { key: 'quoteRequired', label: 'Requires a quote before payment' },
                  { key: 'aiCanBook',     label: 'AI receptionist can book this service' },
                  { key: 'aiCanQuote',    label: 'AI receptionist can initiate a quote' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-700 bg-gray-800 text-blue-500"
                      checked={!!(svc as any)[key]} onChange={e => update(i, { [key]: e.target.checked } as any)} />
                    <span className="text-sm text-foreground">{label}</span>
                  </label>
                ))}
              </div>

              <button onClick={() => saveService(i)} disabled={saving === i}
                className="flex items-center gap-2 rounded-lg bg-primary hover:bg-blue-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-foreground transition-colors">
                {saving === i ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Service
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
