'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2 } from 'lucide-react'

export default function IdentityPage() {
  const [form, setForm] = useState({ name: '', legalName: '', abn: '', supportEmail: '', phone: '', timezone: 'Australia/Perth' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/business')
      .then(r => r.json())
      .then(d => {
        setForm({ name: d.name ?? '', legalName: d.legalName ?? '', abn: d.abn ?? '', supportEmail: d.supportEmail ?? '', phone: d.phone ?? '', timezone: d.timezone ?? 'Australia/Perth' })
        setLoading(false)
      })
  }, [])

  const save = async () => {
    setSaving(true); setMsg(null)
    const r = await fetch('/api/business', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setSaving(false)
    setMsg(r.ok ? { type: 'ok', text: 'Saved.' } : { type: 'err', text: 'Save failed.' })
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  const TIMEZONES = ['Australia/Perth', 'Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Adelaide', 'Australia/Darwin', 'Australia/Hobart']

  if (loading) return <div className="text-muted-foreground/60 text-sm">Loading…</div>

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-foreground">Business Identity</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your business name, ABN and contact details.</p>
      </div>

      <div className="space-y-4 rounded-xl bg-gray-900 border border-gray-800 p-6">
        {[
          { key: 'name',         label: 'Business Name',     placeholder: 'Smith Tax & Accounting',  required: true },
          { key: 'legalName',    label: 'Legal Name',        placeholder: 'Smith Tax Pty Ltd' },
          { key: 'abn',          label: 'ABN',               placeholder: '12 345 678 901' },
          { key: 'supportEmail', label: 'Support Email',     placeholder: 'hello@yourbusiness.com', required: true },
          { key: 'phone',        label: 'Phone',             placeholder: '0400 000 000' },
        ].map(({ key, label, placeholder, required }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {label}{required && <span className="text-destructive ml-0.5">*</span>}
            </label>
            <input
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-foreground placeholder-gray-600 focus:outline-none focus:border-blue-500"
              value={form[key as keyof typeof form]}
              onChange={f(key as keyof typeof form)}
              placeholder={placeholder}
            />
          </div>
        ))}

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Timezone</label>
          <select
            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500"
            value={form.timezone}
            onChange={f('timezone')}
          >
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>
      </div>

      {msg && (
        <p className={`text-sm ${msg.type === 'ok' ? 'text-emerald-400' : 'text-destructive'}`}>{msg.text}</p>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 rounded-lg bg-primary hover:bg-blue-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-foreground transition-colors"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save Identity
      </button>
    </div>
  )
}
