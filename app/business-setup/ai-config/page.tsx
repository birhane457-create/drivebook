'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2, Plus, Trash2, Bot } from 'lucide-react'

type FAQ = { question: string; answer: string }

const ACTIONS = ['book', 'reschedule', 'cancel', 'quote', 'message', 'payment'] as const
const ACTION_LABELS: Record<string, string> = {
  book: 'Book appointments', reschedule: 'Reschedule bookings',
  cancel: 'Cancel bookings', quote: 'Initiate quotes',
  message: 'Take messages', payment: 'Collect payments',
}

const INPUT = 'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-foreground placeholder-gray-600 focus:outline-none focus:border-blue-500'

export default function AIConfigPage() {
  const [form, setForm] = useState({
    businessDescription: '', openingHours: 'Mon–Fri 9am–5pm',
    greetingScript: '', personality: 'friendly' as string,
    allowedActions: ['book', 'reschedule', 'cancel', 'message'] as string[],
    faq: [] as FAQ[],
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/business/ai-config').then(r => r.json()).then(d => {
      if (d?.businessDescription !== undefined) {
        setForm({ businessDescription: d.businessDescription ?? '', openingHours: d.openingHours ?? 'Mon–Fri 9am–5pm', greetingScript: d.greetingScript ?? '', personality: d.personality ?? 'friendly', allowedActions: d.allowedActions ?? ['book', 'reschedule', 'cancel', 'message'], faq: d.faq ?? [] })
      }
      setLoading(false)
    })
  }, [])

  const toggleAction = (action: string) =>
    setForm(f => ({ ...f, allowedActions: f.allowedActions.includes(action) ? f.allowedActions.filter(a => a !== action) : [...f.allowedActions, action] }))

  const updateFAQ = (i: number, patch: Partial<FAQ>) =>
    setForm(f => ({ ...f, faq: f.faq.map((q, idx) => idx === i ? { ...q, ...patch } : q) }))

  const save = async () => {
    setSaving(true); setMsg(null)
    const r = await fetch('/api/business/ai-config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const d = await r.json()
    setSaving(false)
    setMsg(r.ok ? { type: 'ok', text: 'Saved. Your AI receptionist is updated.' } : { type: 'err', text: d.error ?? 'Save failed.' })
  }

  if (loading) return <div className="text-muted-foreground/60 text-sm">Loading…</div>

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-foreground">AI Receptionist</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configure how your AI answers on your behalf.</p>
      </div>

      {/* Business description */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /> Business Knowledge</h2>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Business Description <span className="text-destructive">*</span></label>
          <textarea className={INPUT + ' resize-none h-28'} value={form.businessDescription}
            onChange={e => setForm(f => ({ ...f, businessDescription: e.target.value }))}
            placeholder="A professional tax and accounting practice specialising in small business and individual returns…" />
          <p className="mt-1 text-xs text-gray-600">{form.businessDescription.length}/1000 — describe what your business does and who it serves.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Opening Hours</label>
            <input className={INPUT} value={form.openingHours} onChange={e => setForm(f => ({ ...f, openingHours: e.target.value }))} placeholder="Mon–Fri 9am–5pm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Personality</label>
            <select className={INPUT} value={form.personality} onChange={e => setForm(f => ({ ...f, personality: e.target.value }))}>
              <option value="friendly">Friendly</option>
              <option value="professional">Professional</option>
              <option value="concise">Concise</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Greeting Script (optional)</label>
          <input className={INPUT} value={form.greetingScript} onChange={e => setForm(f => ({ ...f, greetingScript: e.target.value }))} placeholder="Thank you for calling. How can I help you today?" />
        </div>
      </div>

      {/* Allowed actions */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-6 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">What the AI can do</h2>
        <p className="text-xs text-muted-foreground/60">Control which actions your AI receptionist is permitted to perform.</p>
        <div className="grid grid-cols-2 gap-2">
          {ACTIONS.map(action => (
            <label key={action} className="flex items-center gap-3 cursor-pointer rounded-lg px-3 py-2.5 bg-gray-800 border border-gray-700 hover:border-gray-600 transition-colors">
              <input type="checkbox" className="rounded border-gray-600 bg-gray-700 text-blue-500"
                checked={form.allowedActions.includes(action)} onChange={() => toggleAction(action)} />
              <span className="text-sm text-foreground">{ACTION_LABELS[action]}</span>
            </label>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">FAQ</h2>
          <button onClick={() => setForm(f => ({ ...f, faq: [...f.faq, { question: '', answer: '' }] }))}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add question
          </button>
        </div>
        {form.faq.length === 0 && <p className="text-xs text-gray-600">No FAQ entries yet. Add common questions your AI should know.</p>}
        {form.faq.map((entry, i) => (
          <div key={i} className="space-y-2 pb-4 border-b border-gray-800 last:border-0 last:pb-0">
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <input className={INPUT} value={entry.question} onChange={e => updateFAQ(i, { question: e.target.value })} placeholder="What should I bring to my appointment?" />
                <textarea className={INPUT + ' resize-none h-20'} value={entry.answer} onChange={e => updateFAQ(i, { answer: e.target.value })} placeholder="Your answer…" />
              </div>
              <button onClick={() => setForm(f => ({ ...f, faq: f.faq.filter((_, idx) => idx !== i) }))}
                className="mt-1 p-1.5 text-gray-600 hover:text-destructive transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {msg && <p className={`text-sm ${msg.type === 'ok' ? 'text-emerald-400' : 'text-destructive'}`}>{msg.text}</p>}

      <button onClick={save} disabled={saving}
        className="flex items-center gap-2 rounded-lg bg-primary hover:bg-blue-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-foreground transition-colors">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save AI Config
      </button>
    </div>
  )
}
