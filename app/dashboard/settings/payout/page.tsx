'use client';

import { useState, useEffect, useRef } from 'react';
import { Building2, CreditCard, FileText, Save, CheckCircle, XCircle, Info, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import { isValidABNFormat, formatABN, isValidBSB, isValidBankAccount, getBankNameFromBSB } from '@/lib/utils/abn-validation';
import { useSearchParams } from 'next/navigation';

interface PayoutSettings {
  payoutMethod: 'stripe_connect' | 'bank_transfer' | 'manual';
  bankBsb: string;
  bankAccount: string;
  bankAccountName: string;
  abn: string;
  abnHolderName: string;
  abnVerified: boolean;
  abnStatus: string | null;
  abnEntityName: string | null;
  gstRegistered: boolean;
  withholdingTaxRate: number;
  stripeAccountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  name: string;
}

interface AbnVerifyResult {
  valid: boolean;
  abnStatus?: string;
  entityName?: string | null;
  gstRegistered?: boolean;
  nameMatchScore?: number | null;
  nameMatchStatus?: 'MATCHED' | 'REVIEW_REQUIRED' | 'NO_MATCH' | null;
  error?: string;
  warning?: string;
}

type Toast = { type: 'success' | 'error'; message: string } | null;

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-200 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function PayoutSettingsPage() {
  const [s, setS] = useState<PayoutSettings>({
    payoutMethod: 'stripe_connect',
    bankBsb: '',
    bankAccount: '',
    bankAccountName: '',
    abn: '',
    abnHolderName: '',
    abnVerified: false,
    abnStatus: null,
    abnEntityName: null,
    gstRegistered: false,
    withholdingTaxRate: 47,
    stripeAccountId: null,
    chargesEnabled: false,
    payoutsEnabled: false,
    name: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<AbnVerifyResult | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const abnDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchParams = useSearchParams();

  // Handle Stripe Connect return
  useEffect(() => {
    const stripeParam = searchParams?.get('stripe');
    if (stripeParam === 'success') {
      showToast('success', 'Stripe account connected — payouts will be processed automatically');
      // Refresh settings to pick up the new stripeAccountId
      fetch('/api/instructor/payout-settings').then(r => r.json()).then(data => {
        setS(prev => ({ ...prev, ...data, abn: data.abn ?? '', bankBsb: data.bankBsb ?? '', bankAccount: data.bankAccount ?? '', bankAccountName: data.bankAccountName ?? '', abnHolderName: data.abnHolderName ?? data.abnEntityName ?? '' }));
      });
    } else if (stripeParam === 'refresh') {
      showToast('error', 'Stripe setup was not completed. Click "Connect with Stripe" to try again.');
    }
  }, [searchParams]);

  useEffect(() => {
    fetch('/api/instructor/payout-settings')
      .then(r => r.json())
      .then(data => {
        setS(prev => ({
          ...prev,
          ...data,
          // Normalise nullable string fields so components never receive null
          abn: data.abn ?? '',
          bankBsb: data.bankBsb ?? '',
          bankAccount: data.bankAccount ?? '',
          bankAccountName: data.bankAccountName ?? '',
          // abnHolderName is UI-only (not in DB) — pre-fill from saved entity name
          abnHolderName: data.abnHolderName ?? data.abnEntityName ?? '',
        }));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function set(patch: Partial<PayoutSettings>) {
    setS(prev => ({ ...prev, ...patch }));
  }

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }

  // Auto-verify ABN via ABR when 11 valid digits are entered
  function handleAbnChange(raw: string) {
    const cleaned = raw.replace(/\D/g, '');
    set({ abn: cleaned, abnVerified: false, abnStatus: null, abnEntityName: null });
    setVerifyResult(null);

    if (abnDebounceRef.current) clearTimeout(abnDebounceRef.current);

    if (cleaned.length === 11 && isValidABNFormat(cleaned)) {
      const nameForMatch = s.abnHolderName.trim() || s.name.trim();
      abnDebounceRef.current = setTimeout(() => verifyAbn(cleaned, nameForMatch), 600);
    }
  }

  // Re-trigger verification when the holder name changes and ABN is already valid
  function handleHolderNameChange(newName: string) {
    set({ abnHolderName: newName, abnVerified: false, abnStatus: null });
    setVerifyResult(null);

    if (abnDebounceRef.current) clearTimeout(abnDebounceRef.current);

    const currentAbn = s.abn;
    if (currentAbn.length === 11 && isValidABNFormat(currentAbn) && newName.trim().length >= 2) {
      abnDebounceRef.current = setTimeout(() => verifyAbn(currentAbn, newName.trim()), 800);
    }
  }

  async function verifyAbn(abn: string, holderName: string) {
    if (!holderName) {
      setVerifyResult({ valid: false, error: 'Enter your ABR-registered name above before verifying.' });
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch('/api/abn/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ abn, instructorName: holderName }),
      });
      const data: AbnVerifyResult = await res.json();
      setVerifyResult(data);

      // ACTIVE = real ABR confirmation; UNVERIFIED = checksum-only (no ABR_GUID configured)
      const isConfirmed = data.valid && (data.abnStatus === 'ACTIVE' || data.abnStatus === 'UNVERIFIED');

      if (isConfirmed) {
        const locallyVerified =
          data.abnStatus === 'UNVERIFIED' ||
          data.nameMatchStatus === 'MATCHED' ||
          data.nameMatchStatus == null;
        const verifiedStatus = data.abnStatus === 'UNVERIFIED' ? 'PENDING' : 'ACTIVE';
        const verifiedRate = locallyVerified ? 0 : 47;
        set({
          abnStatus: verifiedStatus,
          abnEntityName: data.entityName ?? null,
          abnVerified: locallyVerified,
          withholdingTaxRate: verifiedRate,
        });
        if (data.gstRegistered !== undefined) set({ gstRegistered: data.gstRegistered });

        // Auto-persist immediately — don't wait for Save button
        try {
          await fetch('/api/instructor/payout-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              abn,
              abnEntityName: data.entityName ?? null,
              abnVerified: locallyVerified,
              abnStatus: verifiedStatus,
              withholdingTaxRate: verifiedRate,
              ...(data.gstRegistered !== undefined ? { gstRegistered: data.gstRegistered } : {}),
            }),
          });
        } catch (e) {
          console.warn('[verifyAbn] auto-persist failed (non-critical):', e);
        }
      }
    } catch {
      setVerifyResult({ valid: false, error: 'Verification service unavailable' });
    } finally {
      setVerifying(false);
    }
  }

  async function handleStripeConnect() {
    setConnectingStripe(true);
    try {
      const res = await fetch('/api/instructor/stripe-connect/onboard', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        showToast('error', data.error || 'Failed to start Stripe setup');
      }
    } catch {
      showToast('error', 'Network error — please try again');
    } finally {
      setConnectingStripe(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    // Client-side checksum guard before submitting
    if (s.abn && !isValidABNFormat(s.abn)) {
      showToast('error', 'ABN checksum invalid — please check the number');
      return;
    }

    setSaving(true);
    try {
      const isConfirmedResult = verifyResult?.valid && (verifyResult.abnStatus === 'ACTIVE' || verifyResult.abnStatus === 'UNVERIFIED');
      const locallyVerifiedResult = isConfirmedResult && (
        verifyResult?.abnStatus === 'UNVERIFIED' ||
        verifyResult?.nameMatchStatus === 'MATCHED' ||
        verifyResult?.nameMatchStatus == null
      );

      const payload = {
        payoutMethod: s.payoutMethod,
        bankBsb: s.bankBsb || null,
        bankAccount: s.bankAccount || null,
        bankAccountName: s.bankAccountName || null,
        abn: s.abn || null,
        gstRegistered: isConfirmedResult && verifyResult?.gstRegistered !== undefined ? verifyResult.gstRegistered : s.gstRegistered,
        // Use fresh verifyResult values if available, otherwise fall back to state
        abnEntityName: isConfirmedResult ? (verifyResult?.entityName ?? null) : (s.abnEntityName || null),
        abnVerified: isConfirmedResult ? locallyVerifiedResult : s.abnVerified,
        abnStatus: isConfirmedResult ? (verifyResult?.abnStatus === 'UNVERIFIED' ? 'PENDING' : 'ACTIVE') : (s.abnStatus || null),
        withholdingTaxRate: isConfirmedResult ? (locallyVerifiedResult ? 0 : 47) : s.withholdingTaxRate,
      };
      const res = await fetch('/api/instructor/payout-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setS(prev => ({ ...prev, ...data.settings }));
        showToast('success', 'Payout settings saved');
      } else {
        showToast('error', Array.isArray(data.error) ? data.error[0]?.message : (data.error || 'Save failed'));
      }
    } catch {
      showToast('error', 'Network error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">Loading...</div>;
  }

  const abnChecksumValid = (s.abn ?? '').length === 11 && isValidABNFormat(s.abn ?? '');
  const withholdingApplies = s.withholdingTaxRate > 0;
  const showVerifiedBadge = s.abnVerified && s.abn.length === 11 && !verifyResult;

  // Dark-themed reusable input classes
  const inputBase = 'w-full border border-slate-700 bg-slate-950 text-slate-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 placeholder-slate-500';

  return (
    <div className="max-w-2xl mx-auto py-8 px-1">
      <h1 className="text-2xl font-bold text-slate-100 mb-1">Payout &amp; Tax Settings</h1>
      <p className="text-sm text-slate-400 mb-6">How you receive payments and your Australian tax details.</p>

      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {toast.message}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">

        {/* Payout Method */}
        <div className="bg-slate-900 rounded-3xl border border-slate-800 p-1 space-y-4">
          <h2 className="font-semibold text-slate-100 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-400" />
            Payout Method
          </h2>
          <div className="grid gap-3">
            {([
              { value: 'stripe_connect', label: 'Stripe Connect (Recommended)', desc: 'Automatic transfer to your bank — Stripe verifies your account, DriveBook never sees your details' },
              { value: 'bank_transfer', label: 'Bank Transfer (EFT)', desc: 'Manual transfer — admin processes weekly. Requires admin to confirm your bank details first.' },
              { value: 'manual', label: 'Manual / Cheque', desc: 'Admin will arrange payment manually — contact support' },
            ] as const).map(opt => (
              <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${s.payoutMethod === opt.value ? 'border-blue-500 bg-blue-900/20' : 'border-slate-700 hover:border-slate-600'}`}>
                <input type="radio" name="payoutMethod" value={opt.value} checked={s.payoutMethod === opt.value} onChange={() => set({ payoutMethod: opt.value })} className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-100">{opt.label}</p>
                  <p className="text-xs text-slate-400">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>

          {s.payoutMethod === 'stripe_connect' && (
            <div className="space-y-3">
              {s.stripeAccountId ? (
                (() => {
                  const fullyOnboarded = s.chargesEnabled && s.payoutsEnabled;
                  return (
                    <div className="space-y-3">
                      {fullyOnboarded ? (
                        <div className="flex items-start gap-3 p-4 rounded-lg bg-green-900/30 border border-green-700/50">
                          <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-green-300">Stripe account ready — automatic payouts active</p>
                            <p className="text-xs text-green-400 mt-1">Your earnings are paid automatically every Tuesday at 2:00 AM. Lessons must be completed at least 48 hours before the payout run.</p>
                            <p className="text-xs text-green-500 mt-1 font-mono">Account: {s.stripeAccountId.slice(0, 20)}…</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-900/30 border border-amber-700/50">
                            <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-semibold text-amber-300">Stripe setup incomplete — payouts are on hold</p>
                              <p className="text-xs text-amber-400 mt-1">Stripe needs a bit more information before you can receive payments. This usually takes 2–3 minutes to complete.</p>
                            </div>
                          </div>
                          <div className="bg-slate-950 rounded-lg border border-slate-700 p-4 space-y-3">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Onboarding progress</p>
                            {[
                              { label: 'Account created', done: true },
                              { label: 'Identity verified (charges enabled)', done: s.chargesEnabled },
                              { label: 'Bank account linked (payouts enabled)', done: s.payoutsEnabled },
                            ].map((step) => (
                              <div key={step.label} className="flex items-center gap-3">
                                {step.done ? <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" /> : <div className="h-4 w-4 rounded-full border-2 border-slate-600 flex-shrink-0" />}
                                <span className={`text-sm ${step.done ? 'text-slate-200' : 'text-slate-500'}`}>{step.label}</span>
                              </div>
                            ))}
                          </div>
                          <button type="button" onClick={handleStripeConnect} disabled={connectingStripe}
                            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors">
                            {connectingStripe ? <><Loader2 className="h-4 w-4 animate-spin" /> Opening Stripe…</> : <><ExternalLink className="h-4 w-4" /> Continue Stripe setup →</>}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-sm p-3 rounded-lg bg-sky-900/20 text-sky-300 border border-sky-700/40">
                    <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Connect your bank account via Stripe</p>
                      <p className="text-xs text-sky-400 mt-1">You&apos;ll be taken to Stripe&apos;s secure page to enter your bank details directly. DriveBook never sees your account number — Stripe verifies it for you. Once set up, earnings are paid automatically every Tuesday.</p>
                    </div>
                  </div>
                  <button type="button" onClick={handleStripeConnect} disabled={connectingStripe}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors">
                    {connectingStripe ? <><Loader2 className="h-4 w-4 animate-spin" /> Connecting...</> : <><ExternalLink className="h-4 w-4" /> Connect with Stripe →</>}
                  </button>
                  <p className="text-xs text-slate-400">Need help?{' '}<a href="https://stripe.com/au/connect" target="_blank" rel="noreferrer" className="text-blue-400 underline">Learn about Stripe Connect</a></p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bank Details */}
        {s.payoutMethod === 'bank_transfer' && (
          <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 space-y-4">
            <h2 className="font-semibold text-slate-100 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-green-400" />
              Bank Account Details
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="BSB" hint="Format: XXX-XXX">
                <input type="text" placeholder="012-345" maxLength={7} value={s.bankBsb} onChange={e => set({ bankBsb: e.target.value })}
                  className={`${inputBase} ${s.bankBsb && !isValidBSB(s.bankBsb) ? 'border-red-500' : ''}`} />
                {s.bankBsb && isValidBSB(s.bankBsb) && (() => {
                  const bank = getBankNameFromBSB(s.bankBsb);
                  return bank ? <p className="text-xs text-green-400 mt-1 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> {bank}</p> : <p className="text-xs text-slate-400 mt-1">BSB format valid</p>;
                })()}
                {s.bankBsb && !isValidBSB(s.bankBsb) && <p className="text-xs text-red-400 mt-1">Invalid BSB format</p>}
              </Field>
              <Field label="Account Number">
                <input type="text" placeholder="123456789" maxLength={10} value={s.bankAccount} onChange={e => set({ bankAccount: e.target.value })}
                  className={`${inputBase} ${s.bankAccount && !isValidBankAccount(s.bankAccount) ? 'border-red-500' : ''}`} />
                {s.bankAccount && !isValidBankAccount(s.bankAccount) && <p className="text-xs text-red-400 mt-1">Must be 6–10 digits</p>}
              </Field>
            </div>
            <Field label="Account Holder Name">
              <input type="text" placeholder="John Smith" value={s.bankAccountName} onChange={e => set({ bankAccountName: e.target.value })} className={inputBase} />
            </Field>
            <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-950 border border-slate-800 rounded-lg p-3">
              <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              Bank details are not verified against your identity. Admin will confirm before processing your first bank transfer payout.
            </div>
          </div>
        )}

        {/* Tax Details */}
        <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 space-y-4">
          <h2 className="font-semibold text-slate-100 flex items-center gap-2">
            <FileText className="h-5 w-5 text-violet-400" />
            Australian Tax Details
          </h2>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">ABN (Australian Business Number)</label>
            <div className="mb-3">
              <input type="text" placeholder="Name as registered with ABR (e.g. John Smith or ABC Driving Pty Ltd)"
                value={s.abnHolderName} onChange={e => handleHolderNameChange(e.target.value)} className={inputBase} />
              <p className="text-xs text-slate-400 mt-1">Must match the name on your ABR registration. Used to verify ABN ownership.</p>
            </div>
            <div className="relative">
              <input type="text" placeholder="12345678901" maxLength={11} value={s.abn} onChange={e => handleAbnChange(e.target.value)}
                className={`${inputBase} pr-10 ${s.abn.length === 11 && !abnChecksumValid ? 'border-red-500' : s.abn.length === 11 && s.abnVerified ? 'border-green-500' : ''}`} />
              <div className="absolute right-3 top-2.5">
                {verifying && <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />}
                {!verifying && s.abn.length === 11 && s.abnVerified && <CheckCircle className="h-4 w-4 text-green-400" />}
                {!verifying && s.abn.length === 11 && !abnChecksumValid && <XCircle className="h-4 w-4 text-red-400" />}
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1">11 digits — no spaces. Verified automatically via the Australian Business Register.</p>

            {s.abn.length === 11 && !abnChecksumValid && (
              <div className="flex items-center gap-2 text-sm text-red-300 bg-red-900/30 border border-red-700/50 rounded-lg p-3 mt-2">
                <XCircle className="h-4 w-4 flex-shrink-0" /> Invalid ABN — please check the number.
              </div>
            )}

            {verifyResult && !verifying && (
              <>
                {verifyResult.valid && (verifyResult.abnStatus === 'ACTIVE' || verifyResult.abnStatus === 'UNVERIFIED') && (
                  <div className="flex items-start gap-2 text-sm text-green-300 bg-green-900/30 border border-green-700/50 rounded-lg p-3 mt-2">
                    <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">{verifyResult.abnStatus === 'UNVERIFIED' ? 'ABN checksum valid' : 'ABN verified via Australian Business Register'}</p>
                      {verifyResult.entityName && <p className="text-green-400">{verifyResult.entityName}</p>}
                      {verifyResult.nameMatchStatus === 'REVIEW_REQUIRED' && <p className="text-yellow-400 text-xs mt-1">Name match is partial — admin will review before enabling payouts.</p>}
                      {verifyResult.nameMatchStatus === 'NO_MATCH' && <p className="text-red-400 text-xs mt-1">Name does not match ABR records — admin review required.</p>}
                      <p className="text-xs text-green-400 mt-0.5">Save settings to apply.</p>
                    </div>
                  </div>
                )}
                {verifyResult.valid && verifyResult.abnStatus !== 'ACTIVE' && verifyResult.abnStatus !== 'UNVERIFIED' && (
                  <div className="flex items-start gap-2 text-sm text-orange-300 bg-orange-900/30 border border-orange-700/50 rounded-lg p-3 mt-2">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    ABN found but status is not Active. Please update your business registration at{' '}
                    <a href="https://abr.gov.au" target="_blank" rel="noreferrer" className="underline text-orange-400">abr.gov.au</a>.
                  </div>
                )}
                {!verifyResult.valid && verifyResult.error && (
                  <div className="flex items-start gap-2 text-sm text-red-300 bg-red-900/30 border border-red-700/50 rounded-lg p-3 mt-2">
                    <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> {verifyResult.error}
                  </div>
                )}
                {verifyResult.warning && (
                  <div className="flex items-start gap-2 text-sm text-yellow-300 bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-3 mt-2">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" /> {verifyResult.warning}
                  </div>
                )}
              </>
            )}

            {showVerifiedBadge && (
              <div className="flex items-center gap-2 text-sm text-green-300 bg-green-900/30 border border-green-700/50 rounded-lg p-3 mt-2">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <div>
                  <span className="font-medium">ABN verified — {formatABN(s.abn)}</span>
                  {s.abnEntityName && <span className="text-green-400"> · {s.abnEntityName}</span>}
                </div>
              </div>
            )}

            {!s.abn && (
              <div className="flex items-start gap-2 text-sm text-amber-300 bg-amber-900/30 border border-amber-700/50 rounded-lg p-3 mt-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>
                  Without an ABN, 47% ATO withholding tax applies to all payouts.{' '}
                  <a href="https://abr.gov.au" target="_blank" rel="noreferrer" className="underline font-medium text-amber-400">Register for a free ABN →</a>
                </div>
              </div>
            )}
          </div>

          {/* GST toggle */}
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => set({ gstRegistered: !s.gstRegistered })}
              className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${s.gstRegistered ? 'bg-blue-600' : 'bg-slate-700'}`}>
              <span className={`inline-block h-5 w-5 rounded-full bg-slate-100 shadow transform transition-transform mt-0.5 ${s.gstRegistered ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <div>
              <span className="text-sm text-slate-200">I am registered for GST</span>
              {s.gstRegistered && !s.abnVerified && <p className="text-xs text-slate-400 mt-0.5">GST registration is noted — withholding still applies until your ABN is verified.</p>}
            </div>
          </div>

          {/* Withholding summary */}
          {(() => {
            const verified = s.abn.length === 11 && s.abnVerified;
            const effectiveRate = verified ? (s.withholdingTaxRate ?? 0) : 47;
            return (
              <div className={`flex items-start gap-2 text-sm p-3 rounded-lg ${verified && effectiveRate === 0 ? 'bg-green-900/30 text-green-300 border border-green-700/50' : 'bg-amber-900/30 text-amber-300 border border-amber-700/50'}`}>
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                {verified && effectiveRate === 0
                  ? 'No withholding tax — your ABN is verified.'
                  : `ATO withholding of ${effectiveRate}% applies to your payouts. Provide and verify your ABN to remove withholding.`}
              </div>
            );
          })()}
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving || verifying}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg font-medium text-sm transition-colors">
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : verifying ? 'Verifying ABN...' : 'Save Settings'}
          </button>
          <p className="text-xs text-slate-400">Changes apply to future payouts only.</p>
        </div>
      </form>
    </div>
  );
}
 
