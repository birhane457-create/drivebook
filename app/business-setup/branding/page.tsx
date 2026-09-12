'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2 } from 'lucide-react'

export default function BrandingPage() {
  const [form, setForm] = useState({
    logo: '', primaryColour: '#3B82F6', secondaryColour: '', fontFamily: '',
    theme: 'light', showPlatformBranding: true, customSlug: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/business/branding').then(r => r.json()).then(d => {
      if (d) setForm(f => ({ ...f, ...d, logo: d.logo ?? '', secondaryColour: d.secondaryColour ?? '', fontFamily: d.fontFamily ?? '', customSlug: d.customSlug ?? '' }))
      setLoading(false)
    })
  }, [])

  const save = async () => {
    setSaving(true); setMsg(null)
    const payload = { ...form, logo: form.logo || null, secondaryColour: form.secondaryColour || null, fontFamily: form.fontFamily || null, customSlug: form.customSlug || null }
    const r = await fetch('/api/business/branding', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const d = await r.json()
    setSaving(false)
    setMsg(r.ok ? { type: 'ok', text: 'Saved.' } : { type: 'err', text: d.error ?? 'Save failed.' })
  }

  if (loading) return <div className="light text-muted-foreground/60 text-sm">Loading…</div>

  return (
    <div className="light space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-foreground">Branding</h1>
        <p className="mt-1 text-sm text-muted-foreground">Logo, colours and your public URL.</p>
      </div>

      <div className="light space-y-5 rounded-xl bg-gray-900 border border-gray-800 p-6">
        {/* Logo URL */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Logo URL</label>
          <input className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-foreground placeholder-gray-600 focus:outline-none focus:border-blue-500"
            value={form.logo} onChange={e => setForm(f => ({ ...f, logo: e.target.value }))}
            placeholder="https://res.cloudinary.com/…" />
          {form.logo && <img src={form.logo} alt="Logo preview" className="mt-2 h-10 object-contain rounded" />}
        </div>

        {/* Colours */}
        <div className="light grid grid-cols-2 gap-4">
          {[
            { key: 'primaryColour',   label: 'Primary Colour' },
            { key: 'secondaryColour', label: 'Secondary Colour (optional)' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
              <div className="light flex items-center gap-2">
                <input type="color" className="h-9 w-9 rounded cursor-pointer border border-gray-700 bg-transparent"
                  value={String(form[key as keyof typeof form] || '#3B82F6')}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                <input className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:border-blue-500"
                  value={String(form[key as keyof typeof form] ?? '')}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder="#3B82F6" />
              </div>
            </div>
          ))}
        </div>

        {/* Theme */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-2">Theme</label>
          <div className="light flex gap-3">
            {['light', 'dark'].map(t => (
              <button key={t} onClick={() => setForm(f => ({ ...f, theme: t }))}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${form.theme === t ? 'border-blue-500 bg-blue-500/10 text-primary' : 'border-gray-700 text-muted-foreground hover:border-gray-600'}`}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Slug */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">URL Slug</label>
          <div className="light flex items-center rounded-lg bg-gray-800 border border-gray-700 overflow-hidden focus-within:border-blue-500">
            <span className="px-3 py-2 text-sm text-muted-foreground/60 border-r border-gray-700 shrink-0">
              {process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'platform.com'}/
            </span>
            <input className="flex-1 bg-transparent px-3 py-2 text-sm text-foreground focus:outline-none"
              value={form.customSlug} onChange={e => setForm(f => ({ ...f, customSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
              placeholder="your-business" />
          </div>
          <p className="mt-1 text-xs text-gray-600">Lowercase letters, numbers and hyphens only.</p>
        </div>

        {/* Platform branding toggle */}
        <div className="light flex items-center justify-between py-2">
          <div>
            <p className="text-sm text-foreground">Show "Powered by" footer</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">Displays the platform credit on your booking page.</p>
          </div>
          <button
            onClick={() => setForm(f => ({ ...f, showPlatformBranding: !f.showPlatformBranding }))}
            className={`relative h-6 w-11 rounded-full transition-colors ${form.showPlatformBranding ? 'bg-primary' : 'bg-gray-700'}`}
          >
            <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${form.showPlatformBranding ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      {msg && <p className={`text-sm ${msg.type === 'ok' ? 'text-emerald-400' : 'text-destructive'}`}>{msg.text}</p>}

      <button onClick={save} disabled={saving}
        className="flex items-center gap-2 rounded-lg bg-primary hover:bg-blue-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-foreground transition-colors">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save Branding
      </button>
    </div>
  )
}
