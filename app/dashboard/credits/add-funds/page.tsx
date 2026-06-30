'use client';

import { useState } from 'react';
import { CreditCard } from 'lucide-react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import Link from 'next/link';

interface CreditPackage {
  amount: number;
  popular?: boolean;
}

const CREDIT_PACKAGES: CreditPackage[] = [
  { amount: 50 },
  { amount: 100, popular: true },
  { amount: 200 },
  { amount: 500 },
];

export default function AddFundsPage() {
  const stripe = useStripe();
  const elements = useElements();

  const [selectedAmount, setSelectedAmount] = useState<number | null>(100);
  const [customAmount, setCustomAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const amountToCharge = customAmount ? parseFloat(customAmount) : selectedAmount;

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      setError('Payment system is not ready');
      return;
    }
    if (!amountToCharge || amountToCharge <= 0) {
      setError('Please select or enter a valid amount');
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setError('Card element not found');
      return;
    }

    setProcessing(true);
    setError(null);
    setCardError(null);

    try {
      const res = await fetch('/api/client/wallet-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountToCharge }),
      });

      if (!res.ok) throw new Error('Failed to create payment intent');

      const { clientSecret } = await res.json();

      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: { name: 'Customer' },
        },
      });

      if (result.error) {
        setCardError(result.error.message || 'Payment failed');
      } else if (result.paymentIntent?.status === 'succeeded') {
        setSuccess(true);
        setSelectedAmount(null);
        setCustomAmount('');
        setTimeout(() => {
          window.location.href = '/dashboard/wallet';
        }, 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  if (success) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
          <p className="text-gray-600 mb-4">
            ${amountToCharge?.toFixed(2)} has been added to your wallet.
          </p>
          <p className="text-sm text-gray-500">Redirecting to your wallet...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-2xl mx-auto px-2 sm:px-4 lg:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard/wallet" className="text-blue-600 hover:underline flex items-center gap-2 mb-4">
            &larr; Back to Wallet
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Add Funds</h1>
          <p className="text-gray-600 mt-2">Purchase credits to book more lessons</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Left — Amount selection */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Select Amount</h2>

              <div className="space-y-3 mb-6">
                {CREDIT_PACKAGES.map((pkg) => (
                  <button
                    key={pkg.amount}
                    type="button"
                    onClick={() => { setSelectedAmount(pkg.amount); setCustomAmount(''); }}
                    className={`w-full p-4 border-2 rounded-lg transition text-left ${
                      selectedAmount === pkg.amount && customAmount === ''
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-slate-700 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">${pkg.amount}</p>
                        <p className="text-sm text-gray-600">{pkg.amount} lesson credits</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {pkg.popular && (
                          <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                            Popular
                          </span>
                        )}
                        {selectedAmount === pkg.amount && customAmount === '' && (
                          <div className="w-5 h-5 rounded-full border-2 border-blue-600 flex items-center justify-center">
                            <div className="w-3 h-3 rounded-full bg-blue-600" />
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="border-t border-slate-700 pt-6">
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Or enter a custom amount
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-gray-500 text-lg">$</span>
                  <input
                    type="number"
                    min="10"
                    step="0.01"
                    value={customAmount}
                    onChange={(e) => { setCustomAmount(e.target.value); setSelectedAmount(null); }}
                    placeholder="Enter amount"
                    className="w-full pl-8 pr-4 py-3 border-2 border-slate-700 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                </div>
                <p className="text-xs text-gray-600 mt-2">Minimum: $10</p>
              </div>
            </div>

            {/* Order summary */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Order Summary</h3>
              <div className="flex justify-between mb-2">
                <span className="text-slate-400">Amount</span>
                <span className="font-semibold text-gray-900">${amountToCharge?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="border-t border-blue-200 pt-2 flex justify-between">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="text-lg font-bold text-blue-600">${amountToCharge?.toFixed(2) || '0.00'}</span>
              </div>
            </div>
          </div>

          {/* Right — Payment form */}
          <div>
            <div className="bg-white rounded-lg shadow p-6 sticky top-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Method
              </h2>

              <form onSubmit={handlePayment} className="space-y-4">
                <div className="border-2 border-slate-700 rounded-lg p-4">
                  <CardElement
                    options={{
                      style: {
                        base: { fontSize: '14px', color: '#1f2937' },
                        invalid: { color: '#dc2626' },
                      },
                    }}
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}
                {cardError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-800">{cardError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={processing || !amountToCharge}
                  className={`w-full py-3 rounded-lg font-semibold transition ${
                    processing || !amountToCharge
                      ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {processing ? 'Processing...' : `Pay $${amountToCharge?.toFixed(2) || '0.00'}`}
                </button>

                <p className="text-center text-xs text-gray-500">
                  Secure 256-bit SSL encrypted
                </p>
              </form>

              <div className="mt-6 pt-6 border-t border-slate-700">
                <h3 className="font-semibold text-gray-900 text-sm mb-3">Good to know</h3>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>Credits never expire</li>
                  <li>All payments are secure</li>
                  <li>24/7 customer support</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
