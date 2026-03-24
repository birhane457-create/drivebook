'use client';

import { useState, useEffect, useRef } from 'react';
import { Building2, CreditCard, FileText, Save, CheckCircle, XCircle, Info, Loader2, AlertTriangle } from 'lucide-react';
import { isValidABNFormat, formatABN, isValidBSB, isValidBankAccount, getBankNameFromBSB } from '@/lib/utils/abn-validation';

interface PayoutSettings {
  payoutMethod: 'stripe_connect' | 'bank_transfer' | 'manual';
  bankBsb: string;
  bankAccount: string;
  bankAccountName: string;
  abn: string;
  abnHolderName: string;  // name as registered with ABR (may differ from profile name)
  abnVerified: boolean;
  abnStatus: string | null;
  abnEntityName: string | null;
  gstRegistered: boolean;
  withholdingTaxRate: number;
  stripeAccountId: string | null;
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
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
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
    name: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<AbnVerifyResult | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const abnDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;
  }

  const abnChecksumValid = (s.abn ?? '').length === 11 && isValidABNFormat(s.abn ?? '');
  const withholdingApplies = s.withholdingTaxRate > 0;
  // Only show verified state when the current input is exactly 11 digits AND DB says verified
  const showVerifiedBadge = s.abnVerified && s.abn.length === 11 && !verifyResult;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Payout & Tax Settings</h1>
      <p className="text-sm text-gray-500 mb-6">How you receive payments and your Australian tax details.</p>

      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {toast.message}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">

        {/* Payout Method */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-600" />
            Payout Method
          </h2>
          <div className="grid gap-3">
            {([
              { value: 'stripe_connect', label: 'Stripe Connect', desc: 'Automatic transfer to your connected Stripe account' },
              { value: 'bank_transfer', label: 'Bank Transfer (EFT)', desc: 'Manual transfer to your Australian bank account' },
              { value: 'manual', label: 'Manual / Cheque', desc: 'Admin will arrange payment manually' },
            ] as const).map(opt => (
              <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${s.payoutMethod === opt.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input
                  type="radio" name="payoutMethod" value={opt.value}
                  checked={s.payoutMethod === opt.value}
                  onChange={() => set({ payoutMethod: opt.value })}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>

          {s.payoutMethod === 'stripe_connect' && (
            <div className={`flex items-center gap-2 text-sm p-3 rounded-lg ${s.stripeAccountId ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
              <Info className="h-4 w-4 flex-shrink-0" />
              {s.stripeAccountId
                ? `Stripe account connected (${s.stripeAccountId.slice(0, 12)}...)`
                : 'No Stripe account connected. Contact admin to set up Stripe Connect.'}
            </div>
          )}
        </div>

        {/* Bank Details */}
        {s.payoutMethod === 'bank_transfer' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-green-600" />
              Bank Account Details
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="BSB" hint="Format: XXX-XXX">
                <input
                  type="text" placeholder="012-345" maxLength={7}
                  value={s.bankBsb} onChange={e => set({ bankBsb: e.target.value })}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 ${
                    s.bankBsb && !isValidBSB(s.bankBsb) ? 'border-red-400 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {s.bankBsb && isValidBSB(s.bankBsb) && (() => {
                  const bank = getBankNameFromBSB(s.bankBsb);
                  return bank ? (
                    <p className="text-xs text-green-700 mt-1 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> {bank}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">BSB format valid</p>
                  );
                })()}
                {s.bankBsb && !isValidBSB(s.bankBsb) && (
                  <p className="text-xs text-red-600 mt-1">Invalid BSB format</p>
                )}
              </Field>
              <Field label="Account Number">
                <input
                  type="text" placeholder="123456789" maxLength={10}
                  value={s.bankAccount} onChange={e => set({ bankAccount: e.target.value })}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 ${
                    s.bankAccount && !isValidBankAccount(s.bankAccount) ? 'border-red-400 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {s.bankAccount && !isValidBankAccount(s.bankAccount) && (
                  <p className="text-xs text-red-600 mt-1">Must be 6–10 digits</p>
                )}
              </Field>
            </div>
            <Field label="Account Holder Name">
              <input
                type="text" placeholder="John Smith"
                value={s.bankAccountName} onChange={e => set({ bankAccountName: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </Field>
            <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
              <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              Bank details are not verified against your identity. Admin will confirm before processing your first bank transfer payout.
            </div>
          </div>
        )}

        {/* Tax Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-600" />
            Australian Tax Details
          </h2>

          {/* ABN field with live verification */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ABN (Australian Business Number)
            </label>

            {/* ABN registered name — used for name-match against ABR */}
            <div className="mb-3">
              <input
                type="text"
                placeholder="Name as registered with ABR (e.g. John Smith or ABC Driving Pty Ltd)"
                value={s.abnHolderName}
                onChange={e => {
                  handleHolderNameChange(e.target.value);
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Must match the name on your ABR registration. Used to verify ABN ownership.
              </p>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="12345678901"
                maxLength={11}
                value={s.abn}
                onChange={e => handleAbnChange(e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 pr-10 ${
                  s.abn.length === 11 && !abnChecksumValid
                    ? 'border-red-400 bg-red-50'
                    : s.abn.length === 11 && s.abnVerified
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-300'
                }`}
              />
              <div className="absolute right-3 top-2.5">
                {verifying && <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />}
                {!verifying && s.abn.length === 11 && s.abnVerified && <CheckCircle className="h-4 w-4 text-green-600" />}
                {!verifying && s.abn.length === 11 && !abnChecksumValid && <XCircle className="h-4 w-4 text-red-500" />}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">11 digits — no spaces. Verified automatically via the Australian Business Register.</p>

            {/* ABN status feedback */}
            {s.abn.length === 11 && !abnChecksumValid && (
              <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
                <XCircle className="h-4 w-4 flex-shrink-0" />
                Invalid ABN — please check the number.
              </div>
            )}

            {verifyResult && !verifying && (
              <>
                {verifyResult.valid && (verifyResult.abnStatus === 'ACTIVE' || verifyResult.abnStatus === 'UNVERIFIED') && (
                  <div className="flex items-start gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 mt-2">
                    <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">
                        {verifyResult.abnStatus === 'UNVERIFIED'
                          ? 'ABN checksum valid'
                          : 'ABN verified via Australian Business Register'}
                      </p>
                      {verifyResult.entityName && <p className="text-green-600">{verifyResult.entityName}</p>}
                      {verifyResult.nameMatchStatus === 'REVIEW_REQUIRED' && (
                        <p className="text-yellow-700 text-xs mt-1">Name match is partial — admin will review before enabling payouts.</p>
                      )}
                      {verifyResult.nameMatchStatus === 'NO_MATCH' && (
                        <p className="text-red-700 text-xs mt-1">Name does not match ABR records — admin review required.</p>
                      )}
                      <p className="text-xs text-green-600 mt-0.5">Save settings to apply.</p>
                    </div>
                  </div>
                )}
                {verifyResult.valid && verifyResult.abnStatus !== 'ACTIVE' && verifyResult.abnStatus !== 'UNVERIFIED' && (
                  <div className="flex items-start gap-2 text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded-lg p-3 mt-2">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    ABN found but status is not Active. Please update your business registration at{' '}
                    <a href="https://abr.gov.au" target="_blank" rel="noreferrer" className="underline">abr.gov.au</a>.
                  </div>
                )}
                {!verifyResult.valid && verifyResult.error && (
                  <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
                    <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    {verifyResult.error}
                  </div>
                )}
                {verifyResult.warning && (
                  <div className="flex items-start gap-2 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-2">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    {verifyResult.warning}
                  </div>
                )}
              </>
            )}

            {/* Already verified badge */}
            {showVerifiedBadge && (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 mt-2">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <div>
                  <span className="font-medium">ABN verified — {formatABN(s.abn)}</span>
                  {s.abnEntityName && <span className="text-green-600"> · {s.abnEntityName}</span>}
                </div>
              </div>
            )}

            {/* No ABN warning */}
            {!s.abn && (
              <div className="flex items-start gap-2 text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded-lg p-3 mt-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>
                  Without an ABN, 47% ATO withholding tax applies to all payouts.{' '}
                  <a href="https://abr.gov.au" target="_blank" rel="noreferrer" className="underline font-medium">
                    Register for a free ABN →
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* GST toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => set({ gstRegistered: !s.gstRegistered })}
              className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${s.gstRegistered ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${s.gstRegistered ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <div>
              <span className="text-sm text-gray-700">I am registered for GST</span>
              {s.gstRegistered && !s.abnVerified && (
                <p className="text-xs text-gray-500 mt-0.5">GST registration is noted — withholding still applies until your ABN is verified.</p>
              )}
            </div>
          </div>

          {/* Withholding summary */}
          {(() => {
            const verified = s.abn.length === 11 && s.abnVerified;
            // Effective rate: only trust DB rate when ABN is actually verified
            const effectiveRate = verified ? (s.withholdingTaxRate ?? 0) : 47;
            return (
              <div className={`flex items-start gap-2 text-sm p-3 rounded-lg ${verified && effectiveRate === 0 ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-orange-50 text-orange-700 border border-orange-200'}`}>
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                {verified && effectiveRate === 0
                  ? 'No withholding tax — your ABN is verified.'
                  : `ATO withholding of ${effectiveRate}% applies to your payouts. Provide and verify your ABN to remove withholding.`}
              </div>
            );
          })()}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit" disabled={saving || verifying}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg font-medium text-sm transition-colors"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : verifying ? 'Verifying ABN...' : 'Save Settings'}
          </button>
          <p className="text-xs text-gray-500">Changes apply to future payouts only.</p>
        </div>
      </form>
    </div>
  );
}
