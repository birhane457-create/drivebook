'use client';

import { useState, useEffect } from 'react';
import { CreditCard, TrendingUp, TrendingDown, DollarSign, RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface Wallet {
  totalPaid: number;
  totalSpent: number;
  creditsRemaining: number;
  transactionCount: number;
  lastUpdated: string;
  accountStatus: 'active' | 'zero-balance' | 'negative';
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  status: string;
}

interface Summary {
  packagesCount: number;
  activePackagesCount: number;
  totalHoursRemaining: number;
  completedLessons: number;
}

export default function WalletPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/client/wallet/summary');
      if (!res.ok) {
        throw new Error('Failed to fetch wallet data');
      }

      const data = await res.json();
      setWallet(data.wallet);
      setTransactions(data.recentTransactions);
      setSummary(data.summary);
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your wallet...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-red-600">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const statusColors = {
    active: 'bg-green-50 border-green-200',
    'zero-balance': 'bg-amber-50 border-amber-200',
    negative: 'bg-red-50 border-red-200'
  };

  const statusIcons = {
    active: '✓',
    'zero-balance': '⚠️',
    negative: '❌'
  };

  const statusText = {
    active: 'Active',
    'zero-balance': 'Zero Balance',
    negative: 'Negative Balance'
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Wallet</h1>
          <p className="text-gray-600 mt-2">Track your credits and payment history</p>
        </div>

        {/* Status Alert */}
        {wallet && (
          <div className={`mb-6 p-4 rounded-lg border-2 ${statusColors[wallet.accountStatus]}`}>
            <div className="flex items-center">
              <span className="text-2xl mr-3">{statusIcons[wallet.accountStatus]}</span>
              <div>
                <h3 className="font-semibold">Account Status: {statusText[wallet.accountStatus]}</h3>
                {wallet.accountStatus === 'negative' && (
                  <p className="text-sm mt-1">Your account is in negative. Please add funds to continue booking.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Total Paid */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Paid</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  ${wallet?.totalPaid.toFixed(2)}
                </p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Total Spent */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Spent</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  ${wallet?.totalSpent.toFixed(2)}
                </p>
              </div>
              <div className="bg-red-100 rounded-full p-3">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>

          {/* Credits Remaining */}
          <div className={`bg-white rounded-lg shadow p-6 border-2 ${
            wallet && wallet.creditsRemaining > 0 ? 'border-green-200' :
            wallet && wallet.creditsRemaining === 0 ? 'border-amber-200' : 'border-red-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Credits Remaining</p>
                <p className={`text-3xl font-bold mt-2 ${
                  wallet && wallet.creditsRemaining > 0 ? 'text-green-600' :
                  wallet && wallet.creditsRemaining === 0 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  ${wallet?.creditsRemaining.toFixed(2)}
                </p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <CreditCard className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 mb-8">
          <Link
            href="/dashboard/packages"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            View Packages
          </Link>
          <Link
            href="/dashboard/credits/add-funds"
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            Add Funds
          </Link>
          <button
            onClick={fetchWalletData}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {/* Transaction History */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Recent Transactions</h2>
            <p className="text-gray-600 text-sm mt-1">Your last {transactions.length} transactions</p>
          </div>

          {transactions.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              <CreditCard className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p>No transactions yet</p>
              <Link href="/dashboard/credits/add-funds" className="text-blue-600 hover:underline mt-2 block">
                Add funds to get started
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Description</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-gray-200 hover:bg-gray-50 transition">
                      <td className="px-6 py-3 text-sm text-gray-600">
                        {new Date(tx.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-900">
                        {tx.description}
                      </td>
                      <td className="px-6 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          tx.type === 'CREDIT' ? 'bg-green-100 text-green-800' :
                          tx.type === 'BOOKING' ? 'bg-blue-100 text-blue-800' :
                          tx.type === 'REFUND' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className={`px-6 py-3 text-sm font-semibold text-right ${
                        tx.amount > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <Link href="/dashboard/bookings" className="text-blue-600 hover:underline text-sm">
              View all bookings →
            </Link>
          </div>
        </div>

        {/* Summary Info */}
        {summary && (
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 mb-3">Quick Stats</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-blue-600">Active Packages</p>
                <p className="text-xl font-bold text-blue-900">{summary.activePackagesCount}</p>
              </div>
              <div>
                <p className="text-sm text-blue-600">Total Packages</p>
                <p className="text-xl font-bold text-blue-900">{summary.packagesCount}</p>
              </div>
              <div>
                <p className="text-sm text-blue-600">Total Hours Remaining</p>
                <p className="text-xl font-bold text-blue-900">{summary.totalHoursRemaining.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-sm text-blue-600">Completed Lessons</p>
                <p className="text-xl font-bold text-blue-900">{summary.completedLessons}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
