'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2, Lock } from 'lucide-react'

type Caps = Record<string, boolean>

const CAPABILITY_GROUPS = [
  {
    title: 'Booking & Payments',
    items: [
      { key: 'onlineBooking',   label: 'Online Booking',    desc: 'Customers can book services through your website.', tier: null },
      { key: 'onlinePayments',  label: 'Online Payments',   desc: 'Accept card payments via Stripe.', tier: null },
      { key: 'quotes',          label: 'Quotes',            desc: 'Request → quote → approval → booking workflow.', tier: null },
      { key: 'packages',        label: 'Packages',          desc: 'Multi-session or bulk-purchase packages.', tier: null },
      { key: 'waitingList',     label: 'Waiting List',      desc: 'Let customers join a waiting list when slots are full.', tier: 'PRO' },
    ],
  },
  {
    title: 'Communication & AI',
    items: [
      { key: 'reviews',         label: 'Reviews',           desc: 'Customers can leave ratings and written reviews.', tier: null },
      { key: 'aiReceptionist',  label: 'AI Receptionist',   desc: 'AI answers calls and books appointments as your business.', tier: 'PRO' },
      { key: 'voiceLine',       label: 'Voice Line',        desc: 'Dedicated phone number for your AI receptionist.', tier: 'PRO' },
      { key: 'mobileApp',       label: 'Mobile App',        desc: 'Provider and customer mobile app access.', tier: null },
    ],
  },
  {
    title: 'Operations',
    items: [
      { key: 'googleCalendar',        label: 'Google Calendar Sync',      desc: 'Sync bookings with provider Google Calendars.', tier: null },
      { key: 'travelTime',            label: 'Travel Time',               desc: 'Buffer travel time between appointments.', tier: 'PRO' },
      { key: 'documentVerification',  label: 'Document Verification',     desc: 'Verify provider licences and compliance documents.', tier: 'PRO' },
      { key: 'assessmentTracking',    label: 'Assessment Tracking',       desc: 'Track structured outcomes per booking.', tier: 'PRO' },
      { key: 'websiteBuilder',        label: 'Website Builder',           desc: 'Configurable public website on your domain.', tier: null },
    ],
  },
]

export default function CapabilitiesPage() {
  const [caps, setCaps] = useState<Caps>({})
  const [tier, setTier] = useState('BASIC')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/business/capabilities').then(r => r.json()),
      fetch('/api/business').then(r => r.json()),
    ]).then(([c, b]) => {
      setCaps(c)
      setTier(b.subscriptionTier ?? 'BASIC')
      setLoading(false)
    })
  }, [])

  const isPro = ['PRO', 'STUDIO', 'PREMIUM'].includes(tier)

  const toggle = (key: string, requiredTier: string | null) => {
    if (requiredTier && !isPro) return  // blocked by tier
    setCaps(p => ({ ...p, [key]: !p[key] }))
  }

  const save = async () => {
    setSaving(true); setMsg(null)
    const r = await fetch('/api/business/capabilities', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(caps) })
    const d = await r.json()
    setSaving(false)
    setMsg(r.ok ? { type: 'ok', text: 'Saved.' } : { type: 'err', text: d.error ?? 'Save failed.' })
  }

  if (loading) return <div className="text-muted-foreground/60 text-sm">Loading…</div>

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-foreground">Capabilities</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enable or disable platform features for your business.</p>
      </div>

      {!isPro && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-sm text-amber-300">
          Some capabilities require a Pro subscription. <a href="/dashboard/subscription" className="underline">Upgrade</a> to unlock them.
        </div>
      )}

      {CAPABILITY_GROUPS.map(group => (
        <div key={group.title} className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group.title}</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {group.items.map(({ key, label, desc, tier: reqTier }) => {
              const locked = !!reqTier && !isPro
              const enabled = !!caps[key]
              return (
                <div key={key} className={`flex items-center justify-between px-5 py-4 ${locked ? 'opacity-60' : ''}`}>
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{label}</span>
                      {reqTier && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/15 text-primary font-medium">{reqTier}+</span>}
                    </div>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">{desc}</p>
                  </div>
                  <button
                    onClick={() => toggle(key, reqTier)}
                    disabled={locked}
                    className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${locked ? 'cursor-not-allowed' : 'cursor-pointer'} ${enabled && !locked ? 'bg-primary' : 'bg-gray-700'}`}
                  >
                    {locked
                      ? <Lock className="absolute inset-0 m-auto h-3 w-3 text-muted-foreground/60" />
                      : <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    }
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {msg && <p className={`text-sm ${msg.type === 'ok' ? 'text-emerald-400' : 'text-destructive'}`}>{msg.text}</p>}

      <button onClick={save} disabled={saving}
        className="flex items-center gap-2 rounded-lg bg-primary hover:bg-blue-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-foreground transition-colors">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save Capabilities
      </button>
    </div>
  )
}
