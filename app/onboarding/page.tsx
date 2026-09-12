'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Building2, Palette, Type, Briefcase, ChevronRight,
  CheckCircle, ArrowRight, Loader2, Globe
} from 'lucide-react'

// ── Step definitions ──────────────────────────────────────────────────────────

const STEPS = [
  {
    id: 'identity',
    title: 'Your Business',
    desc: 'What should we call your business?',
    icon: Building2,
  },
  {
    id: 'terminology',
    title: 'Your Language',
    desc: 'What do you call your customers and bookings?',
    icon: Type,
  },
  {
    id: 'branding',
    title: 'Your Look',
    desc: 'Choose your brand colour and URL.',
    icon: Palette,
  },
  {
    id: 'services',
    title: 'Your Services',
    desc: 'What do you offer? Add at least one service.',
    icon: Briefcase,
  },
]

const DRIVING_PRESET = {
  provider: 'provider', providers: 'Instructors',
  customer: 'Learner', customers: 'Learners',
  booking: 'Lesson', bookings: 'Lessons',
  service: 'Driving Lesson', services: 'Driving Lessons',
  providerGroup: 'Driving School',
}

const GENERIC_PRESET = {
  provider: 'Provider', providers: 'Providers',
  customer: 'Customer', customers: 'Customers',
  booking: 'Booking', bookings: 'Bookings',
  service: 'Service', services: 'Services',
  providerGroup: 'Business',
}

const INPUT = 'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-foreground placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors'

// ── Main component ────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromRegister = searchParams.get('from') === 'register'

  const [step, setStep]   = useState(0)
  const [saving, setSaving] = useState(false)
  const [done, setDone]   = useState(false)

  const [identity, setIdentity] = useState({ name: '', supportEmail: '', timezone: 'Australia/Perth' })
  const [terminology, setTerminology] = useState(DRIVING_PRESET)
  const [branding, setBranding] = useState({ primaryColour: '#3B82F6', customSlug: '' })
  const [services, setServices] = useState([
    { name: '', duration: 60, price: 0, bookingMode: 'appointment', locationMode: 'provider_travels', aiCanBook: true, aiCanQuote: false, payOnBooking: true, payOnCompletion: false, quoteRequired: false, freeCancellationHours: 48, refundPercent: 100, minAdvanceHours: 2, maxAdvanceDays: 60, providerRequired: true }
  ])

  // Pre-fill identity from session
  useEffect(() => {
    fetch('/api/business').then(r => r.json()).then(d => {
      if (d?.name) setIdentity(i => ({ ...i, name: d.name, supportEmail: d.supportEmail ?? '' }))
    }).catch(() => {})
  }, [])

  const saveStep = async () => {
    setSaving(true)
    try {
      if (step === 0) {
        await fetch('/api/business', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(identity) })
      } else if (step === 1) {
        await fetch('/api/business/terminology', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(terminology) })
      } else if (step === 2) {
        await fetch('/api/business/branding', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(branding) })
      } else if (step === 3) {
        for (const svc of services) {
          if (svc.name.trim()) {
            await fetch('/api/business/services', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(svc) })
          }
        }
      }
    } catch { /* non-fatal */ }
    setSaving(false)
  }

  const next = async () => {
    await saveStep()
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      setDone(true)
      setTimeout(() => router.push('/dashboard'), 1500)
    }
  }

  const skip = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1)
    else router.push('/dashboard')
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <CheckCircle className="h-16 w-16 text-emerald-400 mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">You&apos;re all set!</h1>
          <p className="text-muted-foreground">Taking you to your dashboard…</p>
        </div>
      </div>
    )
  }

  const currentStep = STEPS[step]
  const Icon = currentStep.icon

  return (
    <div className="light min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground text-sm">Business Setup</span>
        </div>
        <span className="text-xs text-muted-foreground/60">Step {step + 1} of {STEPS.length}</span>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-gray-800">
        <div className="h-1 bg-blue-500 transition-all duration-500" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg space-y-8">
          {/* Step header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-blue-500/15 border border-blue-500/30 mx-auto">
              <Icon className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">{currentStep.title}</h1>
            <p className="text-muted-foreground text-sm">{currentStep.desc}</p>
          </div>

          {/* Step content */}
          <div className="rounded-2xl bg-gray-900 border border-gray-800 p-6 space-y-4">
            {step === 0 && (
              <>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Business Name <span className="text-destructive">*</span></label>
                  <input className={INPUT} value={identity.name} onChange={e => setIdentity(i => ({ ...i, name: e.target.value }))} placeholder="e.g. Perth Drive Academy" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Support Email <span className="text-destructive">*</span></label>
                  <input type="email" className={INPUT} value={identity.supportEmail} onChange={e => setIdentity(i => ({ ...i, supportEmail: e.target.value }))} placeholder="hello@yourbusiness.com" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Timezone</label>
                  <select className={INPUT} value={identity.timezone} onChange={e => setIdentity(i => ({ ...i, timezone: e.target.value }))}>
                    {['Australia/Perth','Australia/Sydney','Australia/Melbourne','Australia/Brisbane','Australia/Adelaide'].map(tz => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="flex gap-2 mb-4">
                  {[['Driving', DRIVING_PRESET], ['Generic', GENERIC_PRESET]].map(([label, preset]) => (
                    <button key={label as string} onClick={() => setTerminology(preset as typeof DRIVING_PRESET)}
                      className="flex-1 py-2 rounded-lg text-xs font-medium border transition-all bg-gray-800 border-gray-700 text-foreground hover:border-blue-500 hover:text-foreground">
                      Use {label as string} defaults
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'provider', label: 'Provider (e.g. Instructor)' },
                    { key: 'customer', label: 'Customer (e.g. Learner)' },
                    { key: 'booking',  label: 'Booking (e.g. Lesson)' },
                    { key: 'providerGroup', label: 'Group (e.g. Driving School)' },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-xs text-muted-foreground/60 mb-1">{label}</label>
                      <input className={INPUT} value={(terminology as any)[key]}
                        onChange={e => setTerminology(t => ({ ...t, [key]: e.target.value }))} />
                    </div>
                  ))}
                </div>
                <div className="rounded-lg bg-gray-800/50 border border-gray-700 p-3 text-xs text-muted-foreground mt-2">
                  Preview: Your <span className="text-primary">{terminology.customer}</span> can book a{' '}
                  <span className="text-primary">{terminology.booking.toLowerCase()}</span> with a{' '}
                  <span className="text-primary">{terminology.provider.toLowerCase()}</span>.
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Primary Brand Colour</label>
                  <div className="flex items-center gap-3">
                    <input type="color" className="h-10 w-10 rounded cursor-pointer border border-gray-700 bg-transparent"
                      value={branding.primaryColour} onChange={e => setBranding(b => ({ ...b, primaryColour: e.target.value }))} />
                    <input className={INPUT} value={branding.primaryColour}
                      onChange={e => setBranding(b => ({ ...b, primaryColour: e.target.value }))} placeholder="#3B82F6" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Your URL Slug</label>
                  <div className="flex items-center rounded-lg bg-gray-800 border border-gray-700 overflow-hidden focus-within:border-blue-500">
                    <span className="px-3 py-2.5 text-xs text-muted-foreground/60 border-r border-gray-700 shrink-0">
                      {process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'platform.com'}/
                    </span>
                    <input className="flex-1 bg-transparent px-3 py-2.5 text-sm text-foreground focus:outline-none"
                      value={branding.customSlug}
                      onChange={e => setBranding(b => ({ ...b, customSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                      placeholder="your-business" />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Customers will book at this URL. You can change it later.</p>
                </div>
                <div className="rounded-lg p-4 text-center" style={{ background: `${branding.primaryColour}20`, border: `1px solid ${branding.primaryColour}40` }}>
                  <p className="text-xs text-muted-foreground mb-1">Preview</p>
                  <div className="h-6 w-24 rounded mx-auto" style={{ background: branding.primaryColour }} />
                </div>
              </>
            )}

            {step === 3 && (
              <div className="space-y-4">
                {services.map((svc, i) => (
                  <div key={i} className="space-y-3 pb-4 border-b border-gray-800 last:border-0">
                    <div>
                      <label className="block text-xs text-muted-foreground/60 mb-1">Service name <span className="text-destructive">*</span></label>
                      <input className={INPUT} value={svc.name}
                        onChange={e => setServices(s => s.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                        placeholder={`e.g. 60-Minute ${terminology.booking}`} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-muted-foreground/60 mb-1">Duration (minutes)</label>
                        <input type="number" className={INPUT} value={svc.duration}
                          onChange={e => setServices(s => s.map((x, idx) => idx === i ? { ...x, duration: Number(e.target.value) } : x))}
                          min="15" step="15" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground/60 mb-1">Price ($)</label>
                        <input type="number" className={INPUT} value={svc.price}
                          onChange={e => setServices(s => s.map((x, idx) => idx === i ? { ...x, price: Number(e.target.value) } : x))}
                          min="0" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-muted-foreground/60 mb-1">Booking type</label>
                        <select className={INPUT} value={svc.bookingMode}
                          onChange={e => setServices(s => s.map((x, idx) => idx === i ? { ...x, bookingMode: e.target.value } : x))}>
                          <option value="appointment">Appointment</option>
                          <option value="request">Quote first</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground/60 mb-1">Location</label>
                        <select className={INPUT} value={svc.locationMode}
                          onChange={e => setServices(s => s.map((x, idx) => idx === i ? { ...x, locationMode: e.target.value } : x))}>
                          <option value="provider_travels">I travel to customer</option>
                          <option value="customer_travels">Customer comes to me</option>
                          <option value="remote">Remote / online</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={() => setServices(s => [...s, { name: '', duration: 60, price: 0, bookingMode: 'appointment', locationMode: 'provider_travels', aiCanBook: true, aiCanQuote: false, payOnBooking: true, payOnCompletion: false, quoteRequired: false, freeCancellationHours: 48, refundPercent: 100, minAdvanceHours: 2, maxAdvanceDays: 60, providerRequired: true }])}
                  className="text-sm text-primary hover:text-primary transition-colors">
                  + Add another service
                </button>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button onClick={skip} className="text-sm text-muted-foreground/60 hover:text-foreground transition-colors">
              Skip for now
            </button>
            <button onClick={next} disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-primary hover:bg-blue-500 disabled:opacity-50 px-6 py-3 text-sm font-semibold text-foreground transition-colors">
              {saving
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                : step < STEPS.length - 1
                  ? <><span>Continue</span><ChevronRight className="h-4 w-4" /></>
                  : <><span>Finish setup</span><ArrowRight className="h-4 w-4" /></>
              }
            </button>
          </div>

          {/* Step dots */}
          <div className="flex justify-center gap-2">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-blue-500' : i < step ? 'w-2 bg-blue-500/40' : 'w-2 bg-gray-700'}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
