'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2, RefreshCw } from 'lucide-react'

const PRESETS = {
  driving:  { provider: 'provider', providers: 'Instructors', customer: 'Learner',  customers: 'Learners',  booking: 'Lesson',        bookings: 'Lessons',        service: 'Driving Lesson',  services: 'Driving Lessons',  providerGroup: 'Driving School' },
  tax:      { provider: 'Tax Agent',  providers: 'Tax Agents',  customer: 'Client',   customers: 'Clients',   booking: 'Consultation',  bookings: 'Consultations',  service: 'Tax Service',     services: 'Tax Services',     providerGroup: 'Practice'       },
  beauty:   { provider: 'Therapist',  providers: 'Therapists',  customer: 'Client',   customers: 'Clients',   booking: 'Appointment',   bookings: 'Appointments',   service: 'Treatment',       services: 'Treatments',       providerGroup: 'Studio'         },
  plumbing: { provider: 'Plumber',    providers: 'Plumbers',    customer: 'Customer', customers: 'Customers', booking: 'Job',           bookings: 'Jobs',           service: 'Plumbing Service',services: 'Plumbing Services',providerGroup: 'Business'       },
  generic:  { provider: 'Provider',   providers: 'Providers',   customer: 'Customer', customers: 'Customers', booking: 'Booking',       bookings: 'Bookings',       service: 'Service',         services: 'Services',         providerGroup: 'Business'       },
}

type TermKey = keyof typeof PRESETS.generic

const FIELDS: { key: TermKey; label: string; hint: string }[] = [
  { key: 'provider',      label: 'Provider (singular)', hint: '"Instructor", "Tax Agent", "Therapist"' },
  { key: 'providers',     label: 'Provider (plural)',   hint: '"Instructors", "Tax Agents"' },
  { key: 'customer',      label: 'Customer (singular)', hint: '"Learner", "Client", "Customer"' },
  { key: 'customers',     label: 'Customer (plural)',   hint: '"Learners", "Clients"' },
  { key: 'booking',       label: 'Booking (singular)',  hint: '"Lesson", "Consultation", "Appointment"' },
  { key: 'bookings',      label: 'Booking (plural)',    hint: '"Lessons", "Consultations"' },
  { key: 'service',       label: 'Service (singular)',  hint: '"Driving Lesson", "Tax Service"' },
  { key: 'services',      label: 'Service (plural)',    hint: '"Driving Lessons", "Tax Services"' },
  { key: 'providerGroup', label: 'Business type',       hint: '"Driving School", "Practice", "Studio"' },
]

export default function TerminologyPage() {
  const [form, setForm] = useState(PRESETS.generic)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/business/terminology').then(r => r.json()).then(d => {
      if (d && d.provider) setForm(d)
      setLoading(false)
    })
  }, [])

  const save = async () => {
    setSaving(true); setMsg(null)
    const r = await fetch('/api/business/terminology', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setSaving(false)
    setMsg(r.ok ? { type: 'ok', text: 'Saved. Labels will update across the platform.' } : { type: 'err', text: 'Save failed.' })
  }

  if (loading) return <div className="text-muted-foreground/60 text-sm">Loading…</div>

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-foreground">Terminology</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rename platform labels to match your industry. These appear in emails, notifications, dashboards and the AI receptionist.
        </p>
      </div>

      {/* Preset buttons */}
      <div>
        <p className="text-xs text-muted-foreground/60 mb-2">Quick-apply a preset</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(PRESETS).map(([key, preset]) => (
            <button key={key} onClick={() => setForm(preset)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 border border-gray-700 text-foreground hover:border-blue-500 hover:text-foreground transition-all">
              <RefreshCw className="h-3 w-3" />
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 rounded-xl bg-gray-900 border border-gray-800 p-6">
        {FIELDS.map(({ key, label, hint }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
            <input
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-foreground placeholder-gray-600 focus:outline-none focus:border-blue-500"
              value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              placeholder={hint} />
            <p className="mt-0.5 text-xs text-gray-600">e.g. {hint}</p>
          </div>
        ))}
      </div>

      {/* Live preview */}
      <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">Preview</p>
        <p className="text-sm text-foreground">
          Your <span className="text-primary">{form.customer}</span> can book a{' '}
          <span className="text-primary">{form.booking.toLowerCase()}</span> with a{' '}
          <span className="text-primary">{form.provider.toLowerCase()}</span> from your{' '}
          <span className="text-primary">{form.providerGroup.toLowerCase()}</span>.
        </p>
      </div>

      {msg && <p className={`text-sm ${msg.type === 'ok' ? 'text-emerald-400' : 'text-destructive'}`}>{msg.text}</p>}

      <button onClick={save} disabled={saving}
        className="flex items-center gap-2 rounded-lg bg-primary hover:bg-blue-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-foreground transition-colors">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save Terminology
      </button>
    </div>
  )
}
