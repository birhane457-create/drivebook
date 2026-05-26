'use client';

import { useState, useEffect } from 'react';
import { DollarSign, Package, TrendingUp, Shield, Wallet, Percent, Zap, Save, CheckCircle, XCircle } from 'lucide-react';

interface Settings {
  platformFeePercentage: number;
  package6Discount: number;
  package10Discount: number;
  package15Discount: number;
  basicCommissionRate: number;
  proCommissionRate: number;
  businessCommissionRate: number;
  drivingTestPackagePrice: number;
  discountPaidBy: 'platform' | 'shared' | 'instructor';
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
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

function NumInput({ value, onChange, step = 1, min = 0, max = 9999, prefix }: {
  value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; prefix?: string;
}) {
  return (
    <div className="relative">
      {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">{prefix}</span>}
      <input
        type="number" step={step} min={min} max={max} value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className={`w-full border border-gray-300 rounded-lg py-2 pr-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${prefix ? 'pl-7' : 'pl-3'}`}
      />
    </div>
  );
}

function Section({ icon, title, color, children }: { icon: React.ReactNode; title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
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
      .then(data => { setS(data); setLoading(false); })
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
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading settings...</div>;
  }

  // Live preview calc (10-lesson package, PRO tier)
  const subtotal = previewRate * 10;
  const discountAmt = (subtotal * s.package10Discount) / 100;
  const afterDiscount = subtotal - discountAmt;
  const gstAmt = s.gstEnabled ? (afterDiscount * s.gstRate) / 100 : 0;
  const platformFeeAmt = (afterDiscount * s.platformFeePercentage) / 100;
  const clientTotal = afterDiscount + gstAmt + platformFeeAmt;
  const commissionAmt = (afterDiscount * s.proCommissionRate) / 100;
  const instructorPayout = afterDiscount - commissionAmt;
  const platformRevenue = platformFeeAmt + commissionAmt;

  return (
    <form onSubmit={handleSave} className="space-y-5">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
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
        <div className="flex items-center gap-3 mb-5 p-3 bg-green-50 rounded-lg border border-green-200">
          <button
            type="button"
            onClick={() => {
              const allZero = s.package6Discount === 0 && s.package10Discount === 0 && s.package15Discount === 0;
              if (allZero) {
                // Restore sensible defaults
                set({ package6Discount: 5, package10Discount: 10, package15Discount: 12 });
              } else {
                set({ package6Discount: 0, package10Discount: 0, package15Discount: 0 });
              }
            }}
            className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${
              s.package6Discount > 0 || s.package10Discount > 0 || s.package15Discount > 0
                ? 'bg-green-600' : 'bg-gray-300'
            }`}
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
              s.package6Discount > 0 || s.package10Discount > 0 || s.package15Discount > 0
                ? 'translate-x-5' : 'translate-x-0.5'
            }`} />
          </button>
          <div>
            <span className="text-sm font-medium text-gray-700">Enable bulk discounts</span>
            <p className="text-xs text-gray-500">Turning off sets all rates to 0% — clients pay full hourly rate for any package size</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-4 mb-4">
          <Field label="6-lesson package (%)">
            <NumInput value={s.package6Discount} onChange={v => set({ package6Discount: v })} min={0} max={30} />
          </Field>
          <Field label="10-lesson package (%)">
            <NumInput value={s.package10Discount} onChange={v => set({ package10Discount: v })} min={0} max={30} />
          </Field>
          <Field label="15-lesson package (%)">
            <NumInput value={s.package15Discount} onChange={v => set({ package15Discount: v })} min={0} max={30} />
          </Field>
        </div>
        <Field label="Who absorbs the discount cost?">
          <select
            value={s.discountPaidBy}
            onChange={e => set({ discountPaidBy: e.target.value as Settings['discountPaidBy'] })}
            className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="platform">Platform — lower commission to cover it</option>
            <option value="shared">Shared — client saves, instructor gets slightly less</option>
            <option value="instructor">Instructor — full discount from their payout</option>
          </select>
        </Field>
      </Section>

      {/* Commission by Tier */}
      <Section icon={<TrendingUp className="h-5 w-5" />} title="Commission Rates by Subscription Tier" color="text-purple-700">
        <div className="grid sm:grid-cols-3 gap-5">
          {([
            { key: 'basic', label: 'Basic', border: 'border-gray-200', bg: '' },
            { key: 'pro', label: 'Pro', border: 'border-blue-200', bg: 'bg-blue-50' },
            { key: 'business', label: 'Business', border: 'border-purple-200', bg: 'bg-purple-50' },
          ] as const).map(({ key, label, border, bg }) => (
            <div key={key} className={`border-2 ${border} ${bg} rounded-xl p-4 space-y-3`}>
              <p className="font-semibold text-sm text-gray-800">{label}</p>
              <Field label="Commission (%)">
                <NumInput
                  value={s[`${key}CommissionRate`]}
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
                className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${s.gstEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${s.gstEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-sm font-medium text-gray-700">GST / Tax enabled</span>
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
                className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${s.peakSurchargeEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${s.peakSurchargeEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-sm font-medium text-gray-700">Peak hour surcharge enabled</span>
            </div>
            {s.peakSurchargeEnabled && (
              <Field label="Peak surcharge (%)" hint="Applied during peak hours (weekday evenings, weekends)">
                <NumInput value={s.peakSurchargePercent} onChange={v => set({ peakSurchargePercent: v })} step={1} min={0} max={50} />
              </Field>
            )}
          </div>
        </div>
      </Section>

      {/* Driving Test Package */}
      <Section icon={<Zap className="h-5 w-5" />} title="Driving Test Package" color="text-teal-700">
        <div className="max-w-xs">
          <Field label="Package price ($)" hint="Includes vehicle, pickup/dropoff, 45-min warm-up lesson">
            <NumInput value={s.drivingTestPackagePrice} onChange={v => set({ drivingTestPackagePrice: v })} step={5} min={0} max={1000} prefix="$" />
          </Field>
        </div>
      </Section>

      {/* Live Preview */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 text-white">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-400" />
          Live Revenue Preview
          <span className="text-xs font-normal text-slate-400 ml-1">— 10-lesson package, PRO tier, first booking</span>
        </h2>
        <div className="mb-4 flex items-center gap-3">
          <label className="text-sm text-slate-300">Instructor hourly rate:</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input
              type="number" min={20} max={300} value={previewRate}
              onChange={e => setPreviewRate(parseFloat(e.target.value) || 0)}
              className="w-24 bg-slate-700 border border-slate-600 rounded-lg pl-7 pr-2 py-1.5 text-sm text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <span className="text-slate-400 text-sm">/hr</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-6 text-sm">
          <div className="space-y-2">
            <p className="text-slate-400 font-medium uppercase text-xs tracking-wide mb-2">Client pays</p>
            <div className="flex justify-between"><span className="text-slate-300">Subtotal (10 × ${previewRate})</span><span>${subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-green-400"><span>Package discount ({s.package10Discount}%)</span><span>−${discountAmt.toFixed(2)}</span></div>
            {s.gstEnabled && <div className="flex justify-between text-yellow-400"><span>GST ({s.gstRate}%)</span><span>+${gstAmt.toFixed(2)}</span></div>}
            <div className="flex justify-between text-slate-300"><span>Platform fee ({s.platformFeePercentage}%)</span><span>+${platformFeeAmt.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-white border-t border-slate-600 pt-2 text-base"><span>Total</span><span className="text-blue-400">${clientTotal.toFixed(2)}</span></div>
          </div>
          <div className="space-y-2">
            <p className="text-slate-400 font-medium uppercase text-xs tracking-wide mb-2">Revenue split</p>
            <div className="flex justify-between text-slate-300"><span>Platform fee</span><span>${platformFeeAmt.toFixed(2)}</span></div>
            <div className="flex justify-between text-slate-300"><span>Commission ({s.proCommissionRate}%)</span><span>${commissionAmt.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-green-400 border-t border-slate-600 pt-2"><span>Platform revenue</span><span>${platformRevenue.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-purple-400"><span>Instructor payout</span><span>${instructorPayout.toFixed(2)}</span></div>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit" disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg font-medium text-sm transition-colors"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        <p className="text-xs text-gray-500">Changes apply to new bookings only. Existing bookings are unaffected.</p>
      </div>
    </form>
  );
}
