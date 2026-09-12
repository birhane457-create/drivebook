'use client';

import { useState, useEffect } from 'react';
import { DollarSign, Package, TrendingUp, Shield, Wallet, Percent, Zap, Save, CheckCircle, XCircle } from 'lucide-react';

interface Settings {
  platformFeePercentage: number;
  package6Discount: number;
  package10Discount: number;
  package15Discount: number;
  packageTiers: Array<{ hours: number; label: string; discount: number; featured: boolean }>;
  basicCommissionRate: number;
  proCommissionRate: number;
  studioCommissionRate: number;
  businessCommissionRate: number;
  discountPaidBy: 'platform' | 'shared' | 'provider';
  cancellationFee: number;
  lateCancellationWindowHours: number;
  noShowPenaltyAmount: number;
  walletTopUpMin: number;
  walletTopUpMax: number;
  gstEnabled: boolean;
  gstRate: number;
  withholdingTaxRate: number;
  peakSurchargeEnabled: boolean;
  peakSurchargePercent: number;
}

type Toast = { type: 'success' | 'error'; message: string } | null;

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function NumInput({ value, onChange, step = 1, min = 0, max = 9999, prefix }: {
  value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; prefix?: string;
}) {
  return (
    <div className="relative">
      {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{prefix}</span>}
      <input
        type="number" step={step} min={min} max={max} value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className={`w-full border border-border rounded-lg py-2 pr-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${prefix ? 'pl-7' : 'pl-3'}`}
      />
    </div>
  );
}

function Section({ icon, title, color, children }: { icon: React.ReactNode; title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-6">
      <h2 className={`text-base font-semibold flex items-center gap-2 mb-5 ${color}`}>
        {icon}{title}
      </h2>
      {children}
    </div>
  );
}

export default function PricingSettingsForm() {
  const [s, setS] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [previewRate, setPreviewRate] = useState(75);

  useEffect(() => {
    fetch('/api/admin/pricing')
      .then(r => r.json())
      .then(data => {
        // Seed packageTiers from named columns if not yet in DB
        if (!data.packageTiers || data.packageTiers.length === 0) {
          data.packageTiers = [
            { hours: 6,  label: 'Starter',    discount: data.package6Discount,  featured: false },
            { hours: 10, label: 'Popular',    discount: data.package10Discount, featured: true  },
            { hours: 15, label: 'Best Value', discount: data.package15Discount, featured: false },
          ];
        }
        setS(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function set(patch: Partial<Settings>) {
    setS(prev => prev ? { ...prev, ...patch } : prev);
  }

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!s) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s),
      });
      if (res.ok) {
        showToast('success', 'Pricing settings saved successfully');
      } else {
        const data = await res.json();
        showToast('error', data.error || 'Failed to save settings');
      }
    } catch {
      showToast('error', 'Network error — settings not saved');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !s) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground/60">Loading settings...</div>;
  }

  // Live preview calc (featured tier, PRO tier)
  const featuredTier = s.packageTiers.find(t => t.featured) ?? s.packageTiers[0];
  const previewHours = featuredTier?.hours ?? 10;
  const previewDiscount = featuredTier?.discount ?? 0;
  const subtotal = previewRate * previewHours;
  const discountAmt = (subtotal * previewDiscount) / 100;
  const afterDiscount = subtotal - discountAmt;
  const gstAmt = s.gstEnabled ? (afterDiscount * s.gstRate) / 100 : 0;
  const platformFeeAmt = (afterDiscount * s.platformFeePercentage) / 100;
  const clientTotal = afterDiscount + gstAmt + platformFeeAmt;
  const commissionAmt = (afterDiscount * s.proCommissionRate) / 100;
  const providerPayout = afterDiscount - commissionAmt;
  const platformRevenue = platformFeeAmt + commissionAmt;

  return (
    <form onSubmit={handleSave} className="space-y-5">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-foreground text-sm font-medium transition-all ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-destructive'}`}>
          {toast.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {toast.message}
        </div>
      )}

      {/* Platform Fee */}
      <Section icon={<DollarSign className="h-5 w-5" />} title="Platform Fee" color="text-blue-700">
        <div className="max-w-xs">
          <Field label="Processing fee charged to clients (%)" hint="Added on top of the booking amount at checkout">
            <NumInput value={s.platformFeePercentage} onChange={v => set({ platformFeePercentage: v })} step={0.1} min={0} max={10} />
          </Field>
        </div>
      </Section>

      {/* Package Discounts */}
      <Section icon={<Package className="h-5 w-5" />} title="Package Discounts" color="text-green-700">
        {/* Master toggle */}
        <div className="flex items-center gap-3 mb-5 p-3 bg-green-900/20 rounded-lg border border-green-700/50">
          <button
            type="button"
            onClick={() => {
              const anyActive = s.packageTiers.some(t => t.discount > 0);
              if (anyActive) {
                set({ packageTiers: s.packageTiers.map(t => ({ ...t, discount: 0 })) });
              } else {
                // Restore sensible defaults per tier hours
                const defaults: Record<number, number> = { 6: 5, 10: 10, 15: 12 };
                set({ packageTiers: s.packageTiers.map(t => ({ ...t, discount: defaults[t.hours] ?? 5 })) });
              }
            }}
            className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${
              s.packageTiers.some(t => t.discount > 0)
                ? 'bg-emerald-600' : 'bg-gray-300'
            }`}
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-card shadow transform transition-transform mt-0.5 ${
              s.packageTiers.some(t => t.discount > 0)
                ? 'translate-x-5' : 'translate-x-0.5'
            }`} />
          </button>
          <div>
            <span className="text-sm font-medium text-foreground">Enable bulk discounts</span>
            <p className="text-xs text-muted-foreground">Turning off sets all rates to 0% — clients pay full hourly rate for any package size</p>
          </div>
        </div>
        {/* Developer note for tier structure changes */}
        <div className="mb-4 p-4 bg-amber-900/20 border border-amber-700/40 rounded-lg text-xs text-amber-200">
          <p className="font-semibold text-amber-100 mb-2 flex items-center gap-2">
            <span className="text-base">⚠️</span>
            Important — Marketing pages reference
          </p>
          <p className="mb-2">
            The booking flow reads tiers directly from this database table. Changes to discount % take effect immediately with no code deploy.
          </p>
          <p className="mb-2">
            <span className="font-semibold text-amber-100">However</span>, the public marketing pages (<code className="bg-amber-950/50 px-1 py-0.5 rounded">/lessons</code> and <code className="bg-amber-950/50 px-1 py-0.5 rounded">/lessons/packages</code>) still reference a static fallback constant called <code className="bg-amber-950/50 px-1 py-0.5 rounded font-mono">PREDEFINED_PACKAGES</code> in <code className="bg-amber-950/50 px-1 py-0.5 rounded font-mono">lib/config/packages.ts</code>.
          </p>
          <p className="font-semibold">
            If you add or remove tiers (not just change %), also update <code className="bg-amber-950/50 px-1 py-0.5 rounded font-mono">PREDEFINED_PACKAGES</code> and redeploy to keep those pages in sync.
          </p>
        </div>
        {/* Dynamic tier table */}
<div className="space-y-2 mb-4">
          <div className="grid grid-cols-[1fr_2fr_80px_80px_40px] gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wide px-1 mb-1">
            <span>Hours</span>
            <span>Label</span>
            <span>Discount %</span>
            <span>Featured</span>
            <span></span>
          </div>
          {s.packageTiers.map((tier, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_2fr_80px_80px_40px] gap-2 items-center">
              <input
                type="number" min={1} max={50} value={tier.hours}
                onChange={e => {
                  const tiers = [...s.packageTiers];
                  tiers[idx] = { ...tier, hours: parseInt(e.target.value) || 1 };
                  set({ packageTiers: tiers });
                }}
                className="border border-border rounded-lg px-2 py-1.5 text-sm w-full"
              />
              <input
                type="text" value={tier.label} maxLength={40}
                onChange={e => {
                  const tiers = [...s.packageTiers];
                  tiers[idx] = { ...tier, label: e.target.value };
                  set({ packageTiers: tiers });
                }}
                className="border border-border rounded-lg px-2 py-1.5 text-sm w-full"
              />
              <NumInput value={tier.discount} min={0} max={50}
                onChange={v => {
                  const tiers = [...s.packageTiers];
                  tiers[idx] = { ...tier, discount: v };
                  set({ packageTiers: tiers });
                }}
              />
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    // Only one tier can be featured — toggle this one on, clear others
                    const tiers = s.packageTiers.map((t, i) => ({ ...t, featured: i === idx ? !t.featured : false }));
                    set({ packageTiers: tiers });
                  }}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${tier.featured ? 'bg-sky-500 border-sky-400' : 'border-border'}`}
                  title="Most Popular badge"
                >
                  {tier.featured && <span className="text-white text-xs font-black">★</span>}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  const tiers = s.packageTiers.filter((_, i) => i !== idx);
                  set({ packageTiers: tiers });
                }}
                className="text-destructive hover:text-red-400 text-sm font-bold transition-colors"
                title="Remove tier"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const tiers = [...s.packageTiers, { hours: 20, label: 'New Tier', discount: 0, featured: false }];
              set({ packageTiers: tiers });
            }}
            className="mt-1 text-sm text-emerald-600 hover:text-emerald-500 font-semibold transition-colors"
          >
            + Add tier
          </button>
        </div>

        <Field label="Who absorbs the discount cost?">
          <select
            value={s.discountPaidBy}
            onChange={e => set({ discountPaidBy: e.target.value as Settings['discountPaidBy'] })}
            className="w-full max-w-sm border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="platform">Platform — lower commission to cover it</option>
            <option value="shared">Shared — client saves, instructor gets slightly less</option>
            <option value="instructor">Instructor — full discount from their payout</option>
          </select>
        </Field>
        {/* Explain to admin how discount attribution works from the instructor and student perspective */}
        <div className="mt-3 bg-sky-900/20 border border-sky-700/40 rounded-lg px-4 py-3 text-xs text-primary space-y-1">
          <p className="font-semibold text-sky-200">How this appears to instructors and students</p>
          <p>
            <span className="font-semibold">Students</span> see: &quot;Package discount applied by DriveBook&quot; — they know it&apos;s a platform incentive, not a price cut by the instructor.
          </p>
          <p>
            <span className="font-semibold">Instructors</span> see: their hourly rate and earnings display unchanged when <em>Platform</em> is selected. If you change to <em>Shared</em> or <em>Instructor</em>, their effective payout per hour drops — communicate this change to instructors before activating.
          </p>
          <p className="text-primary/70 italic">
            Recommended: keep &quot;Platform&quot; selected. This lets you offer real discounts to students without impacting instructor trust or earnings.
          </p>
        </div>
      </Section>

      <Section icon={<TrendingUp className="h-5 w-5" />} title="Commission Rates by Subscription Tier" color="text-purple-700">
        <div className="grid sm:grid-cols-4 gap-5">
          {([
            { key: 'basic',    label: 'Basic',    border: 'border-border',       bg: '' },
            { key: 'pro',      label: 'Pro',      border: 'border-blue-700/50',     bg: 'bg-blue-900/20' },
            { key: 'studio',   label: 'Studio',   border: 'border-indigo-700/50',   bg: 'bg-indigo-900/20' },
            { key: 'business', label: 'Premium', border: 'border-purple-700/50',   bg: 'bg-violet-900/20' },
          ] as const).map(({ key, label, border, bg }) => (
            <div key={key} className={`border-2 ${border} ${bg} rounded-xl p-4 space-y-3`}>
              <p className="font-semibold text-sm text-foreground">{label}</p>
              <Field label="Commission (%)">
                <NumInput
                  value={(s as any)[`${key}CommissionRate`] ?? 0}
                  onChange={v => set({ [`${key}CommissionRate`]: v } as any)}
                  step={0.5} min={0} max={50}
                />
              </Field>
            </div>
          ))}
        </div>
      </Section>

      {/* Cancellation & No-Show */}
      <Section icon={<Shield className="h-5 w-5" />} title="Cancellation & No-Show Policy" color="text-red-700">
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Cancellation fee ($)" hint="Flat fee for cancellations within the late window">
            <NumInput value={s.cancellationFee} onChange={v => set({ cancellationFee: v })} min={0} max={200} prefix="$" />
          </Field>
          <Field label="Late cancellation window (hours)" hint="Cancellations within this window incur the fee">
            <NumInput value={s.lateCancellationWindowHours} onChange={v => set({ lateCancellationWindowHours: v })} min={0} max={168} />
          </Field>
          <Field label="No-show penalty ($)" hint="Charged to the party who didn't show">
            <NumInput value={s.noShowPenaltyAmount} onChange={v => set({ noShowPenaltyAmount: v })} min={0} max={200} prefix="$" />
          </Field>
        </div>
      </Section>

      {/* Wallet Limits */}
      <Section icon={<Wallet className="h-5 w-5" />} title="Wallet Top-Up Limits" color="text-yellow-700">
        <div className="grid sm:grid-cols-2 gap-4 max-w-sm">
          <Field label="Minimum top-up ($)">
            <NumInput value={s.walletTopUpMin} onChange={v => set({ walletTopUpMin: v })} min={1} max={500} prefix="$" />
          </Field>
          <Field label="Maximum top-up ($)">
            <NumInput value={s.walletTopUpMax} onChange={v => set({ walletTopUpMax: v })} min={10} max={5000} prefix="$" />
          </Field>
        </div>
      </Section>

      {/* GST & Peak Surcharge */}
      <Section icon={<Percent className="h-5 w-5" />} title="Tax & Surcharges" color="text-orange-700">
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => set({ gstEnabled: !s.gstEnabled })}
                className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${s.gstEnabled ? 'bg-primary' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-5 w-5 rounded-full bg-card shadow transform transition-transform mt-0.5 ${s.gstEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-sm font-medium text-foreground">GST / Tax enabled</span>
            </div>
            {s.gstEnabled && (
              <Field label="GST rate (%)" hint="Applied to the booking subtotal">
                <NumInput value={s.gstRate} onChange={v => set({ gstRate: v })} step={0.5} min={0} max={30} />
              </Field>
            )}
            <Field label="ATO withholding tax rate (%)" hint="Applied to instructor payouts when no ABN or TFN is on file. ATO default is 47%.">
              <NumInput value={s.withholdingTaxRate} onChange={v => set({ withholdingTaxRate: v })} step={1} min={0} max={47} />
            </Field>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => set({ peakSurchargeEnabled: !s.peakSurchargeEnabled })}
                className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${s.peakSurchargeEnabled ? 'bg-primary' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-5 w-5 rounded-full bg-card shadow transform transition-transform mt-0.5 ${s.peakSurchargeEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-sm font-medium text-foreground">Peak hour surcharge enabled</span>
            </div>
            {s.peakSurchargeEnabled && (
              <Field label="Peak surcharge (%)" hint="Applied during peak hours (weekday evenings, weekends)">
                <NumInput value={s.peakSurchargePercent} onChange={v => set({ peakSurchargePercent: v })} step={1} min={0} max={50} />
              </Field>
            )}
          </div>
        </div>
      </Section>

      {/* Live Preview */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 text-foreground">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Live Revenue Preview
          <span className="text-xs font-normal text-muted-foreground ml-1">— {previewHours}-hr package, PRO tier, first booking</span>
        </h2>
        <div className="mb-4 flex items-center gap-3">
          <label className="text-sm text-foreground">Instructor hourly rate:</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <input
              type="number" min={20} max={300} value={previewRate}
              onChange={e => setPreviewRate(parseFloat(e.target.value) || 0)}
              className="w-24 bg-secondary/70 border border-border rounded-lg pl-7 pr-2 py-1.5 text-sm text-foreground focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <span className="text-muted-foreground text-sm">/hr</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-6 text-sm">
          <div className="space-y-2">
            <p className="text-muted-foreground font-medium uppercase text-xs tracking-wide mb-2">Client pays</p>
            <div className="flex justify-between"><span className="text-foreground">Subtotal ({previewHours} × ${previewRate})</span><span>${subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-emerald-400"><span>Package discount ({previewDiscount}%)</span><span>−${discountAmt.toFixed(2)}</span></div>
            {s.gstEnabled && <div className="flex justify-between text-yellow-400"><span>GST ({s.gstRate}%)</span><span>+${gstAmt.toFixed(2)}</span></div>}
            <div className="flex justify-between text-foreground"><span>Platform fee ({s.platformFeePercentage}%)</span><span>+${platformFeeAmt.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-foreground border-t border-border pt-2 text-base"><span>Total</span><span className="text-primary">${clientTotal.toFixed(2)}</span></div>
          </div>
          <div className="space-y-2">
            <p className="text-muted-foreground font-medium uppercase text-xs tracking-wide mb-2">Revenue split</p>
            <div className="flex justify-between text-foreground"><span>Platform fee</span><span>${platformFeeAmt.toFixed(2)}</span></div>
            <div className="flex justify-between text-foreground"><span>Commission ({s.proCommissionRate}%)</span><span>${commissionAmt.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-emerald-400 border-t border-border pt-2"><span>Platform revenue</span><span>${platformRevenue.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-purple-400"><span>Instructor payout</span><span>${providerPayout.toFixed(2)}</span></div>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit" disabled={saving}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-foreground px-6 py-2.5 rounded-lg font-medium text-sm transition-colors"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        <p className="text-xs text-muted-foreground">Changes apply to new bookings only. Existing bookings are unaffected.</p>
      </div>
    </form>
  );
}
