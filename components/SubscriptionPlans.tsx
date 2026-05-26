'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { SUBSCRIPTION_PLANS } from '@/lib/config/subscriptions';
import { X, ArrowUp, ArrowDown, CreditCard, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

interface SubscriptionPlansProps {
  currentTier: string;
  currentStatus: string;
  instructorId: string;
}

type DialogType = 'upgrade-trial' | 'downgrade-trial' | 'active-change' | null;

interface DialogState {
  type: DialogType;
  targetTier: string;
}

const TIER_ORDER: Record<string, number> = { BASIC: 1, PRO: 2, STUDIO: 3, BUSINESS: 4 };
const TIER_COLOR: Record<string, string> = {
  BASIC: 'text-gray-700',
  PRO: 'text-blue-700',
  STUDIO: 'text-indigo-700',
  BUSINESS: 'text-purple-700',
};

function isUpgrade(from: string, to: string) {
  return (TIER_ORDER[to] || 0) > (TIER_ORDER[from] || 0);
}

// ── Confirmation Dialog ───────────────────────────────────────────────────────

function PlanChangeDialog({
  dialog,
  currentTier,
  currentStatus,
  billingCycle,
  onClose,
  onConfirm,
  loading,
}: {
  dialog: DialogState;
  currentTier: string;
  currentStatus: string;
  billingCycle: 'monthly' | 'annual';
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const targetPlan = SUBSCRIPTION_PLANS[dialog.targetTier as keyof typeof SUBSCRIPTION_PLANS];
  const currentPlan = SUBSCRIPTION_PLANS[currentTier as keyof typeof SUBSCRIPTION_PLANS];
  const upgrade = isUpgrade(currentTier, dialog.targetTier);
  const targetPrice = billingCycle === 'monthly' ? targetPlan.monthlyPrice : targetPlan.annualPrice;

  const content = {
    'upgrade-trial': {
      icon: <ArrowUp className="w-6 h-6 text-green-600" />,
      iconBg: 'bg-green-100',
      title: `Upgrade to ${targetPlan.name}`,
      body: (
        <div className="space-y-3 text-sm text-gray-600">
          <p>
            You're switching from <strong>{currentPlan.name}</strong> to <strong className={TIER_COLOR[dialog.targetTier]}>{targetPlan.name}</strong> during your trial.
          </p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="font-semibold text-green-800 mb-1">What changes immediately:</p>
            <ul className="space-y-1 text-green-700">
              <li>✓ Commission rate: {currentPlan.commissionRate}% → <strong>{targetPlan.commissionRate}%</strong></li>
              <li>✓ All {targetPlan.name} features unlocked</li>
              <li>✓ Your trial end date stays the same</li>
            </ul>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-800">
            <p className="text-xs">When your trial ends, you'll be charged <strong>${targetPrice}/{billingCycle === 'monthly' ? 'month' : 'year'}</strong> for {targetPlan.name}.</p>
          </div>
        </div>
      ),
      confirmLabel: `Upgrade to ${targetPlan.name}`,
      confirmStyle: 'bg-green-600 hover:bg-green-700 text-white',
    },
    'downgrade-trial': {
      icon: <ArrowDown className="w-6 h-6 text-amber-600" />,
      iconBg: 'bg-amber-100',
      title: `Downgrade to ${targetPlan.name}`,
      body: (
        <div className="space-y-3 text-sm text-gray-600">
          <p>
            You're switching from <strong>{currentPlan.name}</strong> to <strong>{targetPlan.name}</strong> during your trial.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="font-semibold text-amber-800 mb-1">What changes immediately:</p>
            <ul className="space-y-1 text-amber-700">
              <li>• Commission rate: {currentPlan.commissionRate}% → <strong>{targetPlan.commissionRate}%</strong></li>
              <li>• Some features will be removed</li>
              <li>• Your trial end date stays the same</li>
            </ul>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-600">
            <p className="text-xs">When your trial ends, you'll be charged <strong>${targetPrice}/{billingCycle === 'monthly' ? 'month' : 'year'}</strong> for {targetPlan.name}.</p>
          </div>
        </div>
      ),
      confirmLabel: `Downgrade to ${targetPlan.name}`,
      confirmStyle: 'bg-amber-600 hover:bg-amber-700 text-white',
    },
    'active-change': {
      icon: <CreditCard className="w-6 h-6 text-blue-600" />,
      iconBg: 'bg-blue-100',
      title: upgrade ? `Upgrade to ${targetPlan.name}` : `Downgrade to ${targetPlan.name}`,
      body: (
        <div className="space-y-3 text-sm text-gray-600">
          <p>
            You have an active paid subscription on <strong>{currentPlan.name}</strong>.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="font-semibold text-blue-900 mb-2">You'll be taken to the Stripe Billing Portal where you can:</p>
            <ul className="space-y-1 text-blue-800">
              {upgrade ? (
                <>
                  <li>✓ Upgrade to {targetPlan.name} — Stripe calculates the prorated difference</li>
                  <li>✓ New rate applies immediately after payment</li>
                  <li>✓ Commission changes to {targetPlan.commissionRate}% for new bookings</li>
                </>
              ) : (
                <>
                  <li>• Downgrade to {targetPlan.name} at end of current billing period</li>
                  <li>• You keep {currentPlan.name} features until then</li>
                  <li>• Commission changes to {targetPlan.commissionRate}% when downgrade takes effect</li>
                </>
              )}
            </ul>
          </div>
          <div className="flex items-start gap-2 text-xs text-gray-500">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
            <p>Existing confirmed bookings keep their original commission rate — only new bookings are affected.</p>
          </div>
        </div>
      ),
      confirmLabel: 'Open Billing Portal →',
      confirmStyle: 'bg-blue-600 hover:bg-blue-700 text-white',
    },
  };

  const c = content[dialog.type!];
  if (!c) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-gray-100">
          <div className={`w-10 h-10 rounded-full ${c.iconBg} flex items-center justify-center shrink-0`}>
            {c.icon}
          </div>
          <h2 className="text-lg font-bold text-gray-900 flex-1">{c.title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {c.body}
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-5 border-t border-gray-100">
          <button onClick={onClose} disabled={loading}
            className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg disabled:opacity-60 ${c.confirmStyle}`}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Processing...' : c.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SubscriptionPlans({
  currentTier,
  currentStatus,
  instructorId,
}: SubscriptionPlansProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [syncing, setSyncing] = useState(false);

  const searchParams = useSearchParams();

  // When returning from Stripe Billing Portal, sync subscription state from Stripe
  // This ensures plan changes (upgrade/downgrade) are reflected immediately
  useEffect(() => {
    const success = searchParams.get('success');
    const paymentAdded = searchParams.get('payment_added');
    const portalReturn = searchParams.get('portal_return');

    if (success === 'true' && paymentAdded === 'true') {
      setSuccessMsg('Payment method added successfully. Your subscription is now active.');
      // Clean up URL params
      const url = new URL(window.location.href);
      url.searchParams.delete('success');
      url.searchParams.delete('payment_added');
      window.history.replaceState({}, '', url.toString());
      setTimeout(() => window.location.reload(), 1500);
    } else if (portalReturn === 'true') {
      // Returning from billing portal after a plan change — sync from Stripe
      setSyncing(true);
      // Clean up URL params immediately
      const url = new URL(window.location.href);
      url.searchParams.delete('portal_return');
      window.history.replaceState({}, '', url.toString());

      fetch('/api/instructor/subscription/sync', { method: 'POST' })
        .then(r => r.json())
        .then(data => {
          if (data.synced) {
            if (data.tierChanged) {
              setSuccessMsg(`Plan updated to ${data.tier}. Commission rate now applies to new bookings.`);
            } else if (data.cancelAtPeriodEnd) {
              setSuccessMsg('Subscription set to cancel at end of billing period.');
            } else {
              setSuccessMsg('Billing details updated successfully.');
            }
            setTimeout(() => window.location.reload(), 2000);
          }
        })
        .catch(() => {
          // Sync failed — page reload will show current DB state
          window.location.reload();
        })
        .finally(() => setSyncing(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isOnTrial = currentStatus === 'TRIAL';
  const isActive = currentStatus === 'ACTIVE';
  const isPastDue = currentStatus === 'PAST_DUE';

  const handlePlanClick = (tier: string) => {
    setErrorMsg('');
    setSuccessMsg('');

    if (isOnTrial) {
      // Trial: change tier immediately via our API
      const type = isUpgrade(currentTier, tier) ? 'upgrade-trial' : 'downgrade-trial';
      setDialog({ type, targetTier: tier });
    } else if (isActive || isPastDue) {
      // Active paid: route to Stripe Billing Portal
      setDialog({ type: 'active-change', targetTier: tier });
    } else {
      // No subscription yet: start trial
      executeTrialStart(tier);
    }
  };

  const executeTrialStart = async (tier: string) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/instructor/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, billingCycle }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.checkoutUrl) window.location.href = data.checkoutUrl;
        else { setSuccessMsg(data.message || 'Trial started!'); setTimeout(() => window.location.reload(), 1500); }
      } else {
        setErrorMsg(data.error || 'Failed to start trial');
      }
    } catch { setErrorMsg('Something went wrong. Please try again.'); }
    finally { setLoading(false); }
  };

  const executeTrialChange = async (tier: string) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/instructor/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, billingCycle }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        } else {
          setDialog(null);
          setSuccessMsg(data.message || `Switched to ${tier} plan`);
          setTimeout(() => window.location.reload(), 1500);
        }
      } else {
        setDialog(null);
        setErrorMsg(data.error || 'Failed to change plan');
      }
    } catch { setDialog(null); setErrorMsg('Something went wrong. Please try again.'); }
    finally { setLoading(false); }
  };

  const executeActivePlanChange = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/instructor/subscription/billing-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ return_url: window.location.href }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.url) window.location.href = data.url;
        else if (data.checkoutUrl) window.location.href = data.checkoutUrl;
        else { setDialog(null); setErrorMsg('Could not open billing portal. Please try again.'); }
      } else {
        setDialog(null);
        setErrorMsg(data.error || 'Failed to open billing portal');
      }
    } catch { setDialog(null); setErrorMsg('Something went wrong. Please try again.'); }
    finally { setLoading(false); }
  };

  const handleDialogConfirm = () => {
    if (!dialog) return;
    if (dialog.type === 'active-change') {
      executeActivePlanChange();
    } else {
      executeTrialChange(dialog.targetTier);
    }
  };

  const handleManageBilling = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/instructor/subscription/billing-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ return_url: window.location.href }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.url) window.location.href = data.url;
        else if (data.checkoutUrl) window.location.href = data.checkoutUrl;
        else setErrorMsg('Could not open billing portal.');
      } else {
        setErrorMsg(data.error || 'Failed to open billing portal');
      }
    } catch { setErrorMsg('Something went wrong.'); }
    finally { setLoading(false); }
  };

  const getButtonText = (tier: string): string => {
    if (currentTier === tier && isActive) return 'Current Plan';
    if (currentTier === tier && isOnTrial) return 'Current Plan (Trial)';
    if (isActive || isPastDue) return isUpgrade(currentTier, tier) ? 'Upgrade' : 'Downgrade';
    if (isOnTrial) return isUpgrade(currentTier, tier) ? 'Upgrade' : 'Downgrade';
    return 'Start Free Trial';
  };

  const activePlans = [
    { tier: 'BASIC',    plan: SUBSCRIPTION_PLANS.BASIC,    badge: null,            badgeColor: '',              highlight: false, comingSoon: false },
    { tier: 'PRO',      plan: SUBSCRIPTION_PLANS.PRO,      badge: 'POPULAR',       badgeColor: 'bg-blue-600',   highlight: true,  comingSoon: false },
    { tier: 'STUDIO',   plan: SUBSCRIPTION_PLANS.STUDIO,   badge: 'CUSTOM DOMAIN', badgeColor: 'bg-indigo-600', highlight: false, comingSoon: false },
    { tier: 'BUSINESS', plan: SUBSCRIPTION_PLANS.BUSINESS, badge: 'COMING SOON',   badgeColor: 'bg-gray-400',   highlight: false, comingSoon: true  },
  ];

  return (
    <div>
      {/* Dialog */}
      {dialog && (
        <PlanChangeDialog
          dialog={dialog}
          currentTier={currentTier}
          currentStatus={currentStatus}
          billingCycle={billingCycle}
          onClose={() => { if (!loading) setDialog(null); }}
          onConfirm={handleDialogConfirm}
          loading={loading}
        />
      )}

      {/* Syncing banner — shown while syncing from Stripe after billing portal return */}
      {syncing && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-blue-800">
          <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
          Syncing your plan changes from Stripe...
        </div>
      )}

      {/* Success / Error banners */}
      {successMsg && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-green-800">
          <CheckCircle className="w-4 h-4 shrink-0" /> {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-red-800">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {errorMsg}
        </div>
      )}

      {/* Manage Billing button */}
      {(isActive || isOnTrial || isPastDue) && (
        <div className="mb-8 flex justify-end">
          <button
            onClick={handleManageBilling}
            disabled={loading}
            className="px-5 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-50"
          >
            <CreditCard className="h-4 w-4" />
            {isPastDue ? 'Update Payment Method' : 'Manage Billing & Payment'}
          </button>
        </div>
      )}

      {/* Billing Cycle Toggle */}
      <div className="flex justify-center mb-8">
        <div className="bg-gray-100 rounded-lg p-1 inline-flex">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${billingCycle === 'monthly' ? 'bg-white text-gray-900 shadow' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${billingCycle === 'annual' ? 'bg-white text-gray-900 shadow' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Annual
            <span className="ml-2 text-xs text-green-600 font-semibold">Save 17%</span>
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {activePlans.map(({ tier, plan, badge, badgeColor, highlight, comingSoon }) => {
          const isCurrent = currentTier === tier;
          const isDisabled = loading || (isCurrent && isActive) || comingSoon;

          return (
            <div
              key={tier}
              className={`bg-white rounded-xl shadow-md overflow-hidden relative flex flex-col transition-all
                ${isCurrent ? 'ring-2 ring-blue-500' : ''}
                ${comingSoon ? 'opacity-60' : ''}
                ${highlight ? 'shadow-lg' : ''}
              `}
            >
              {badge && (
                <div className={`absolute top-0 right-0 ${badgeColor} text-white px-3 py-1 text-xs font-semibold rounded-bl-lg`}>
                  {badge}
                </div>
              )}

              <div className="p-5 flex-1">
                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {tier === 'BASIC' && 'Individual instructor'}
                  {tier === 'PRO' && 'Growing your business'}
                  {tier === 'STUDIO' && 'Your own branded domain'}
                  {tier === 'BUSINESS' && 'Multi-instructor schools'}
                </p>

                {comingSoon ? (
                  <div className="mt-4">
                    <p className="text-sm text-gray-500 italic">Under review — launching soon</p>
                  </div>
                ) : (
                  <div className="mt-4">
                    <span className="text-3xl font-bold text-gray-900">
                      ${billingCycle === 'monthly' ? plan.monthlyPrice : plan.annualPrice}
                    </span>
                    <span className="text-gray-500 text-sm">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                    <p className="mt-1 text-xs text-gray-400">{plan.trialDays}-day free trial</p>
                  </div>
                )}

                <ul className="mt-4 space-y-2">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <svg className="h-4 w-4 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="px-5 pb-5">
                {comingSoon ? (
                  <button disabled className="w-full py-2.5 px-4 rounded-lg text-sm font-medium bg-gray-100 text-gray-400 cursor-not-allowed">
                    Coming Soon
                  </button>
                ) : (
                  <button
                    onClick={() => !isDisabled && handlePlanClick(tier)}
                    disabled={isDisabled}
                    className={`w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-colors
                      ${isCurrent && isActive
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : highlight
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : tier === 'STUDIO'
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                            : 'bg-gray-800 text-white hover:bg-gray-900'
                      }`}
                  >
                    {loading && dialog?.targetTier === tier ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                      </span>
                    ) : getButtonText(tier)}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Why upgrade */}
      <div className="mt-10 bg-blue-50 rounded-xl p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Why upgrade?</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <div className="text-2xl font-bold text-blue-600">15% → 11%</div>
            <p className="text-sm text-gray-600 mt-1">Lower commission as you grow</p>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">Custom domain</div>
            <p className="text-sm text-gray-600 mt-1">Studio: your own branded URL</p>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">Priority support</div>
            <p className="text-sm text-gray-600 mt-1">Pro & Studio get faster responses</p>
          </div>
        </div>
      </div>
    </div>
  );
}
