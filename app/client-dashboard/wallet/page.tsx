'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, AlertCircle, CreditCard, Plus } from 'lucide-react';
import AddCreditsModal from '@/components/AddCreditsModal';
import StripeProvider from '@/components/StripeProvider';

interface Wallet {
  totalPaid: number;
  totalSpent: number;
  creditsRemaining: number;
  totalBookedHours: number;
}

export default function WalletPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddCredits, setShowAddCredits] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      loadData();
    }
  }, [session]);

  const loadData = async () => {
    try {
      setLoading(true);
      const walletRes = await fetch('/api/client/wallet');
      const walletData = await walletRes.json();
      setWallet(walletData);
    } catch (error) {
      console.error('Error loading wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading wallet information...</p>
        </div>
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">Failed to load wallet</p>
        </div>
      </div>
    );
  }

  const usagePercent = wallet.totalPaid > 0 
    ? (wallet.totalSpent / wallet.totalPaid) * 100 
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-20">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Wallet & Credits</h1>
              <p className="text-blue-100 mt-2">Manage your account balance and payment methods</p>
            </div>
            <Link
              href="/client-dashboard"
              className="px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Wallet Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total Credits Added */}
          <div className="bg-white rounded-xl shadow-md p-6 border-t-4 border-blue-500">
            <p className="text-gray-600 text-sm font-semibold mb-2">Total Credits Added</p>
            <p className="text-4xl font-bold text-gray-900 mb-1">
              ${wallet.totalPaid.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500">Money you've added to wallet</p>
          </div>

          {/* Net Booking Costs */}
          <div className="bg-white rounded-xl shadow-md p-6 border-t-4 border-purple-500">
            <p className="text-gray-600 text-sm font-semibold mb-2">Net Booking Costs</p>
            <p className="text-4xl font-bold text-gray-900 mb-1">
              ${wallet.totalSpent.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500">Actual cost of your bookings</p>
          </div>

          {/* Current Balance */}
          <div className={`rounded-xl shadow-md p-6 border-t-4 ${
            wallet.creditsRemaining > 0
              ? 'bg-white border-green-500'
              : 'bg-red-50 border-red-500'
          }`}>
            <p className="text-gray-600 text-sm font-semibold mb-2">Current Balance</p>
            <p className={`text-4xl font-bold mb-1 ${
              wallet.creditsRemaining > 0
                ? 'text-gray-900'
                : 'text-red-600'
            }`}>
              ${wallet.creditsRemaining.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500">Available to spend</p>
          </div>
        </div>

        {/* Credit Usage Section */}
        <div className="bg-white rounded-xl shadow-md p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Credit Usage Breakdown</h2>
          
          <div className="space-y-4">
            {/* Progress Bar */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="font-semibold text-gray-700">Usage Progress</span>
                <span className="font-bold text-gray-900">{usagePercent.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    usagePercent > 80
                      ? 'bg-red-500'
                      : usagePercent > 50
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                />
              </div>
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-sm text-gray-600 font-semibold">Credits Added</p>
                <p className="text-2xl font-bold text-blue-600 mt-2">${wallet.totalPaid.toFixed(2)}</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                <p className="text-sm text-gray-600 font-semibold">Booking Costs</p>
                <p className="text-2xl font-bold text-orange-600 mt-2">${wallet.totalSpent.toFixed(2)}</p>
              </div>
              <div className={`rounded-lg p-4 border ${
                wallet.creditsRemaining > 0
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <p className="text-sm text-gray-600 font-semibold">Available Balance</p>
                <p className={`text-2xl font-bold mt-2 ${
                  wallet.creditsRemaining > 0
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}>
                  ${wallet.creditsRemaining.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-md p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setShowAddCredits(true)}
              className="flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:shadow-lg transition font-semibold"
            >
              <Plus className="w-5 h-5" />
              Add Credits to Wallet
            </button>
            <Link
              href="/client-dashboard"
              className="flex items-center justify-center gap-3 p-4 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition font-semibold"
            >
              <CreditCard className="w-5 h-5" />
              View All Bookings
            </Link>
          </div>
        </div>

        {/* Detailed Transaction Breakdown (Optional) */}
        <div className="bg-white rounded-xl shadow-md p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Detailed Accounting Breakdown</h2>
          <p className="text-sm text-gray-600 mb-6">
            This section shows all credits (money in) and debits (money out) for complete transparency.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Total Credits */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-green-900">Total Credits (Money In)</h3>
                <span className="text-2xl font-bold text-green-600">
                  +${wallet.totalPaid.toFixed(2)}
                </span>
              </div>
              <p className="text-sm text-green-800">
                All money added to your wallet, including initial deposits and top-ups.
              </p>
            </div>

            {/* Total Debits */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-red-900">Total Debits (Money Out)</h3>
                <span className="text-2xl font-bold text-red-600">
                  -${wallet.totalSpent.toFixed(2)}
                </span>
              </div>
              <p className="text-sm text-red-800">
                All money spent from your wallet, including bookings and duration adjustments.
              </p>
            </div>
          </div>

          {/* Net Balance */}
          <div className="mt-6 bg-blue-50 border-2 border-blue-300 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-blue-900 text-lg">Net Balance</h3>
                <p className="text-sm text-blue-700 mt-1">Credits - Debits = Current Balance</p>
              </div>
              <span className="text-3xl font-bold text-blue-600">
                ${wallet.creditsRemaining.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="mt-4 text-xs text-gray-500 italic">
            Note: Duration adjustments (increase/decrease) are included in the debit/credit totals for accounting purposes, 
            but your "Net Booking Costs" above shows only actual booking expenses.
          </div>
        </div>

        {/* Information Box */}
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">💡 How Credits Work</h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>• Credits represent the balance available in your wallet</li>
            <li>• Each booking deducts the lesson price from your credits</li>
            <li>• When credits run out, you can add more at any time</li>
            <li>• Credits don't expire and can be used across all instructors</li>
            <li>• If a booking is cancelled, credits are refunded within 3-5 business days</li>
          </ul>
        </div>
      </div>

      {/* Add Credits Modal */}
      {showAddCredits && (
        <StripeProvider>
          <AddCreditsModal
            isOpen={showAddCredits}
            onClose={() => setShowAddCredits(false)}
            onSuccess={() => {
              loadData();
            }}
          />
        </StripeProvider>
      )}
    </div>
  );
}
