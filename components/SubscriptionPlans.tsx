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
        body: JSON.stringify({
          tier,
          billingCycle,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        } else {
          alert('Subscription updated successfully!');
          window.location.reload();
        }
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update subscription');
      }
    } catch (error) {
      alert('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePlan = async (newTier: string) => {
    if (!confirm(`Are you sure you want to ${getChangeType(currentTier, newTier)} to ${newTier}?`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/instructor/subscription/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newTier,
          billingCycle,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.requiresCheckout && data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        } else {
          alert(data.message || 'Plan changed successfully!');
          // Force page reload to show updated plan
          window.location.href = '/dashboard/subscription?success=true';
        }
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to change plan');
        setLoading(false);
      }
    } catch (error) {
      alert('An error occurred');
      setLoading(false);
    }
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
        // If checkout URL is returned (trial user without payment), redirect to checkout
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        } 
        // If portal URL is returned (active user with payment), redirect to portal
        else if (data.url) {
          window.location.href = data.url;
        } else {
          alert('Unexpected response from server');
          setLoading(false);
        }
      } else {
        // Show error message
        alert(data.message || data.error || 'Failed to open billing portal');
        setLoading(false);
      }
    } catch (error) {
      console.error('Billing portal error:', error);
      alert('An error occurred');
      setLoading(false);
    }
  };

  const getChangeType = (oldTier: string, newTier: string): string => {
    const tierOrder: Record<string, number> = { BASIC: 1, PRO: 2, BUSINESS: 3 };
    const oldOrder = tierOrder[oldTier] || 0;
    const newOrder = tierOrder[newTier] || 0;
    return newOrder > oldOrder ? 'upgrade' : 'downgrade';
  };

  const getButtonText = (tier: string): string => {
    if (currentTier === tier && currentStatus === 'ACTIVE') {
      return 'Current Plan';
    }
    if (currentTier === tier && currentStatus === 'TRIAL') {
      return 'Current Plan (Trial)';
    }
    if (currentStatus === 'ACTIVE' || currentStatus === 'TRIAL') {
      return getChangeType(currentTier, tier) === 'upgrade' ? 'Upgrade' : 'Downgrade';
    }
    return 'Start Free Trial';
  };

  const getButtonAction = (tier: string) => {
    // For current plan on TRIAL without payment method, allow clicking to add payment
    if (currentTier === tier && currentStatus === 'TRIAL') {
      return () => handleSubscribe(tier); // Allow adding payment method
    }
    // For current plan on ACTIVE, disable
    if (currentTier === tier && currentStatus === 'ACTIVE') {
      return null; // Disabled
    }
    // For other plans, allow upgrade/downgrade
    if (currentStatus === 'ACTIVE' || currentStatus === 'TRIAL') {
      return () => handleChangePlan(tier);
    }
    return () => handleSubscribe(tier);
  };

  return (
    <div>
      {/* Manage Billing Button (for active subscriptions and trials with payment method) */}
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
            className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
              billingCycle === 'monthly'
                ? 'bg-white text-gray-900 shadow'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
              billingCycle === 'annual'
                ? 'bg-white text-gray-900 shadow'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Annual
            <span className="ml-2 text-xs text-green-600 font-semibold">Save 17%</span>
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Basic Plan */}
        <div className={`bg-white rounded-lg shadow-lg overflow-hidden ${
          currentTier === 'BASIC' ? 'ring-2 ring-blue-500' : ''
        }`}>
          <div className="p-6">
            <h3 className="text-2xl font-bold text-gray-900">Basic</h3>
            <p className="mt-2 text-gray-600">Perfect for individual instructors</p>
            <div className="mt-4">
              <span className="text-4xl font-bold text-gray-900">
                ${billingCycle === 'monthly' ? SUBSCRIPTION_PLANS.BASIC.monthlyPrice : SUBSCRIPTION_PLANS.BASIC.annualPrice}
              </span>
              <span className="text-gray-600">/{billingCycle === 'monthly' ? 'month' : 'year'}</span>
            </div>
            <p className="mt-2 text-sm text-gray-500">14-day free trial</p>
          </div>

          <div className="px-6 pb-6">
            <ul className="space-y-3">
              {SUBSCRIPTION_PLANS.BASIC.features.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={getButtonAction('BASIC') || undefined}
              disabled={loading || (currentTier === 'BASIC' && currentStatus === 'ACTIVE')}
              className={`mt-6 w-full py-3 px-4 rounded-md font-medium ${
                currentTier === 'BASIC' && currentStatus === 'ACTIVE'
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {getButtonText('BASIC')}
            </button>
          </div>
        </div>

        {/* Pro Plan */}
        <div className={`bg-white rounded-lg shadow-lg overflow-hidden relative ${
          currentTier === 'PRO' ? 'ring-2 ring-blue-500' : ''
        }`}>
          <div className="absolute top-0 right-0 bg-blue-600 text-white px-3 py-1 text-xs font-semibold rounded-bl-lg">
            POPULAR
          </div>
          <div className="p-6">
            <h3 className="text-2xl font-bold text-gray-900">Pro</h3>
            <p className="mt-2 text-gray-600">For growing businesses</p>
            <div className="mt-4">
              <span className="text-4xl font-bold text-gray-900">
                ${billingCycle === 'monthly' ? SUBSCRIPTION_PLANS.PRO.monthlyPrice : SUBSCRIPTION_PLANS.PRO.annualPrice}
              </span>
              <span className="text-gray-600">/{billingCycle === 'monthly' ? 'month' : 'year'}</span>
            </div>
            <p className="mt-2 text-sm text-gray-500">14-day free trial</p>
          </div>

          <div className="px-6 pb-6">
            <ul className="space-y-3">
              {SUBSCRIPTION_PLANS.PRO.features.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={getButtonAction('PRO') || undefined}
              disabled={loading || (currentTier === 'PRO' && currentStatus === 'ACTIVE')}
              className={`mt-6 w-full py-3 px-4 rounded-md font-medium ${
                currentTier === 'PRO' && currentStatus === 'ACTIVE'
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {getButtonText('PRO')}
            </button>
          </div>
        </div>

        {/* Business Plan */}
        <div className={`bg-white rounded-lg shadow-lg overflow-hidden relative ${
          currentTier === 'BUSINESS' ? 'ring-2 ring-blue-500' : ''
        }`}>
          <div className="absolute top-0 right-0 bg-purple-600 text-white px-3 py-1 text-xs font-semibold rounded-bl-lg">
            BEST VALUE
          </div>
          <div className="p-6">
            <h3 className="text-2xl font-bold text-gray-900">Business</h3>
            <p className="mt-2 text-gray-600">For driving schools</p>
            <div className="mt-4">
              <span className="text-4xl font-bold text-gray-900">
                ${billingCycle === 'monthly' ? SUBSCRIPTION_PLANS.BUSINESS.monthlyPrice : SUBSCRIPTION_PLANS.BUSINESS.annualPrice}
              </span>
              <span className="text-gray-600">/{billingCycle === 'monthly' ? 'month' : 'year'}</span>
            </div>
            <p className="mt-2 text-sm text-gray-500">30-day free trial</p>
          </div>

          <div className="px-6 pb-6">
            <ul className="space-y-3">
              {SUBSCRIPTION_PLANS.BUSINESS.features.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={getButtonAction('BUSINESS') || undefined}
              disabled={loading || (currentTier === 'BUSINESS' && currentStatus === 'ACTIVE')}
              className={`mt-6 w-full py-3 px-4 rounded-md font-medium ${
                currentTier === 'BUSINESS' && currentStatus === 'ACTIVE'
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              {getButtonText('BUSINESS')}
            </button>
          </div>
        </div>
      </div>

      {/* Comparison Note */}
      <div className="mt-12 bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Why upgrade?</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="text-3xl font-bold text-blue-600">15% → 10%</div>
            <p className="text-sm text-gray-600 mt-1">Lower commission rates as you grow</p>
          </div>
          <div>
            <div className="text-3xl font-bold text-blue-600">8% → 12%</div>
            <p className="text-sm text-gray-600 mt-1">Higher bonuses for new students</p>
          </div>
          <div>
            <div className="text-3xl font-bold text-blue-600">Unlimited</div>
            <p className="text-sm text-gray-600 mt-1">Multiple instructors on Business</p>
          </div>
        </div>
      </div>
    </div>
  );
}
