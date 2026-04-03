'use client';

import { useState } from 'react';
import { SUBSCRIPTION_PLANS } from '@/lib/config/subscriptions';

interface SubscriptionPlansProps {
  currentTier: string;
  currentStatus: string;
  instructorId: string;
}

export default function SubscriptionPlans({
  currentTier,
  currentStatus,
  instructorId,
}: SubscriptionPlansProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async (tier: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/instructor/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, billingCycle }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.checkoutUrl) window.location.href = data.checkoutUrl;
        else { alert('Subscription updated successfully!'); window.location.reload(); }
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update subscription');
      }
    } catch { alert('An error occurred'); }
    finally { setLoading(false); }
  };

  const handleChangePlan = async (newTier: string) => {
    if (!confirm(`Are you sure you want to ${getChangeType(currentTier, newTier)} to ${newTier}?`)) return;
    setLoading(true);
    try {
      const res = await fetch('/api/instructor/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: newTier, billingCycle }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.checkoutUrl) window.location.href = data.checkoutUrl;
        else { alert(data.message || 'Plan changed successfully!'); window.location.href = '/dashboard/subscription?success=true'; }
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to change plan');
        setLoading(false);
      }
    } catch { alert('An error occurred'); setLoading(false); }
  };

  const handleManageBilling = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/instructor/subscription/billing-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ return_url: window.location.href }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.checkoutUrl) window.location.href = data.checkoutUrl;
        else if (data.url) window.location.href = data.url;
        else { alert('Unexpected response from server'); setLoading(false); }
      } else {
        alert(data.message || data.error || 'Failed to open billing portal');
        setLoading(false);
      }
    } catch { alert('An error occurred'); setLoading(false); }
  };

  const tierOrder: Record<string, number> = { BASIC: 1, PRO: 2, STUDIO: 3, BUSINESS: 4 };

  const getChangeType = (oldTier: string, newTier: string): string => {
    return (tierOrder[newTier] || 0) > (tierOrder[oldTier] || 0) ? 'upgrade' : 'downgrade';
  };

  const getButtonText = (tier: string): string => {
    if (currentTier === tier && currentStatus === 'ACTIVE') return 'Current Plan';
    if (currentTier === tier && currentStatus === 'TRIAL') return 'Current Plan (Trial)';
    if (currentStatus === 'ACTIVE' || currentStatus === 'TRIAL')
      return getChangeType(currentTier, tier) === 'upgrade' ? 'Upgrade' : 'Downgrade';
    return 'Start Free Trial';
  };

  const getButtonAction = (tier: string) => {
    if (currentTier === tier && currentStatus === 'TRIAL') return () => handleSubscribe(tier);
    if (currentTier === tier && currentStatus === 'ACTIVE') return null;
    if (currentStatus === 'ACTIVE' || currentStatus === 'TRIAL') return () => handleChangePlan(tier);
    return () => handleSubscribe(tier);
  };

  const isCurrentPlan = (tier: string) => currentTier === tier;

  // Active plans shown to instructors
  const activePlans = [
    {
      tier: 'BASIC',
      plan: SUBSCRIPTION_PLANS.BASIC,
      badge: null,
      badgeColor: '',
      highlight: false,
      comingSoon: false,
    },
    {
      tier: 'PRO',
      plan: SUBSCRIPTION_PLANS.PRO,
      badge: 'POPULAR',
      badgeColor: 'bg-blue-600',
      highlight: true,
      comingSoon: false,
    },
    {
      tier: 'STUDIO',
      plan: SUBSCRIPTION_PLANS.STUDIO,
      badge: 'CUSTOM DOMAIN',
      badgeColor: 'bg-indigo-600',
      highlight: false,
      comingSoon: false,
    },
    {
      tier: 'BUSINESS',
      plan: SUBSCRIPTION_PLANS.BUSINESS,
      badge: 'COMING SOON',
      badgeColor: 'bg-gray-400',
      highlight: false,
      comingSoon: true,
    },
  ];

  return (
    <div>
      {/* Manage Billing */}
      {(currentStatus === 'ACTIVE' || currentStatus === 'TRIAL' || currentStatus === 'PAST_DUE') && (
        <div className="mb-8 flex justify-end">
          <button
            onClick={handleManageBilling}
            disabled={loading}
            className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors flex items-center gap-2 font-medium disabled:opacity-50"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            {currentStatus === 'PAST_DUE' ? 'Update Payment Method' : 'Manage Billing & Payment'}
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

      {/* Plans Grid — 4 columns, Business greyed out */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {activePlans.map(({ tier, plan, badge, badgeColor, highlight, comingSoon }) => (
          <div
            key={tier}
            className={`bg-white rounded-xl shadow-md overflow-hidden relative flex flex-col transition-all
              ${isCurrentPlan(tier) ? 'ring-2 ring-blue-500' : ''}
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
                <button
                  disabled
                  className="w-full py-2.5 px-4 rounded-lg text-sm font-medium bg-gray-100 text-gray-400 cursor-not-allowed"
                >
                  Coming Soon
                </button>
              ) : (
                <button
                  onClick={getButtonAction(tier) || undefined}
                  disabled={loading || (isCurrentPlan(tier) && currentStatus === 'ACTIVE')}
                  className={`w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-colors
                    ${isCurrentPlan(tier) && currentStatus === 'ACTIVE'
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : highlight
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : tier === 'STUDIO'
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                          : 'bg-gray-800 text-white hover:bg-gray-900'
                    }`}
                >
                  {getButtonText(tier)}
                </button>
              )}
            </div>
          </div>
        ))}
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
