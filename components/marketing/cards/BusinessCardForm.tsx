'use client'

// components/marketing/cards/BusinessCardForm.tsx
//
// Editable fields for the card.
// Name, phone, booking URL are locked (come from verified profile).
// Suburbs, car details, and transmission are pre-filled but fully editable.

import { CardData, Transmission } from './types'

interface Props {
  data: CardData
  onChange: (next: CardData) => void
  /** When true, name/phone/url fields are locked (dashboard mode). */
  locked?: boolean
}

export function BusinessCardForm({ data, onChange, locked = true }: Props) {
  function set<K extends keyof CardData>(key: K, value: CardData[K]) {
    onChange({ ...data, [key]: value })
  }

  return (
    <div className="space-y-4">

      {/* ── Locked fields ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        <Field
          label="Name"
          value={data.instructorName}
          readOnly={locked}
          onChange={v => set('instructorName', v)}
          hint={locked ? 'From your profile' : undefined}
        />
        <Field
          label="Phone"
          value={data.phone}
          readOnly={locked}
          onChange={v => set('phone', v)}
          hint={locked ? 'From your profile' : undefined}
        />
        <Field
          label="Booking URL"
          value={data.bookingUrl}
          readOnly={locked}
          onChange={v => set('bookingUrl', v)}
          hint={locked ? 'Your DriveBook booking page' : undefined}
          mono
        />
      </div>

      <hr className="border-border" />

      {/* ── Pre-filled but editable ────────────────────────────────────── */}
      <p className="text-[11px] text-muted-foreground/60 -mb-1">
        Pre-filled from your profile — edit freely for this card.
      </p>

      <div className="space-y-3">

        {/* Suburbs / service area */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Service areas
          </label>
          <input
            type="text"
            value={data.suburbs}
            onChange={e => set('suburbs', e.target.value)}
            maxLength={80}
            placeholder="e.g. Perth • Maylands • Morley"
            className="w-full px-3 py-2 bg-background border border-border text-foreground rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
          />
          <p className="text-[11px] text-muted-foreground/60 mt-1">
            Separate suburbs with • or commas. Edit to match your actual service area.
          </p>
        </div>

        {/* Car details */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Vehicle
          </label>
          <input
            type="text"
            value={data.carLabel ?? ''}
            onChange={e => set('carLabel', e.target.value)}
            maxLength={40}
            placeholder="e.g. Toyota Corolla"
            className="w-full px-3 py-2 bg-background border border-border text-foreground rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
          />
          <p className="text-[11px] text-muted-foreground/60 mt-1">
            Shown on the card alongside transmission type.
          </p>
        </div>

        {/* Transmission */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Transmission
          </label>
          <div className="flex gap-2">
            {(['AUTOMATIC', 'MANUAL', 'BOTH'] as Transmission[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => set('transmission', t)}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${
                  data.transmission === t
                    ? 'bg-primary border-sky-500 text-foreground'
                    : 'bg-background border-border text-muted-foreground hover:border-sky-600 hover:text-primary'
                }`}
              >
                {t === 'BOTH' ? 'Both' : t === 'AUTOMATIC' ? 'Auto' : 'Manual'}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Helper ────────────────────────────────────────────────────────────────────

function Field({
  label, value, readOnly, onChange, hint, mono,
}: {
  label: string
  value: string
  readOnly?: boolean
  onChange: (v: string) => void
  hint?: string
  mono?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-foreground mb-1">{label}</label>
      {readOnly ? (
        <div className={`px-3 py-2 bg-card border border-border rounded-lg text-sm text-muted-foreground ${mono ? 'font-mono text-xs truncate' : ''}`}>
          {value || <span className="text-slate-600 italic">Not set</span>}
        </div>
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`w-full px-3 py-2 bg-background border border-border text-foreground rounded-lg text-sm focus:ring-2 focus:ring-sky-500 ${mono ? 'font-mono text-xs' : ''}`}
        />
      )}
      {hint && <p className="text-[11px] text-slate-600 mt-0.5">{hint}</p>}
    </div>
  )
}
