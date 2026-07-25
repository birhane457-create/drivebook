'use client';

import React, { useState, useEffect } from 'react';
import AdminNav from '@/components/admin/AdminNav';
import { TrendingUp, DollarSign, AlertCircle, Users } from 'lucide-react';
import Link from 'next/link';

interface CreditsStats {
  totalCreditsInSystem: number;
  totalSpent: number;
  totalRemaining: number;
  clientsWithCredits: number;
  clientsWithZeroBalance: number;
  clientsWithNegativeBalance: number;
  averageCreditPerClient: number;
  averageSpentPerClient: number;
}

export default function AdminCreditsPage() {
  const [stats, setStats] = useState<CreditsStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCreditsStats();
  }, []);

  const fetchCreditsStats = async () => {
    try {
      setLoading(true);
      // C-10 fix: call stats=true endpoint which runs DB-level aggregates.
      // The old approach fetched the first 25 clients and summed client-side —
      // giving completely wrong totals for any platform with more than 25 clients.
      const res = await fetch('/api/admin/clients?stats=true');
      if (res.ok) {
        const data = await res.json();
        const s = data.stats;
        const totalCredits = s.totalWalletBalance ?? 0;
        const totalSpent = s.totalDebitAmount ?? 0;
        const totalClients = s.totalClients ?? 0;

        setStats({
          totalCreditsInSystem: totalCredits,
          totalSpent,
          totalRemaining: totalCredits,
          clientsWithCredits: s.clientsWithPositiveBalance ?? 0,
          clientsWithZeroBalance: s.clientsWithZeroBalance ?? 0,
          clientsWithNegativeBalance: s.clientsWithNegativeBalance ?? 0,
          averageCreditPerClient: totalClients > 0 ? totalCredits / totalClients : 0,
          averageSpentPerClient: totalClients > 0 ? totalSpent / totalClients : 0,
        });
      }
    } catch (error) {
      console.error('Failed to fetch credits stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100">Credits Management</h1>
          <p className="text-slate-400 mt-2">Overview of all credits in the system</p>
        </div>

        {/* Main Stats */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-slate-400">Loading credits data...</p>
          </div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {/* Total Credits */}
              <div className="bg-slate-900 rounded-lg border border-slate-800 p-6 border-t-4 border-blue-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400 font-semibold">Total Credits Paid</p>
                    <p className="text-3xl font-bold text-slate-100 mt-2">
                      ${stats.totalCreditsInSystem.toFixed(2)}
                    </p>
                  </div>
                  <DollarSign className="w-12 h-12 text-blue-500 opacity-20" />
                </div>
              </div>

              {/* Total Spent */}
              <div className="bg-slate-900 rounded-lg border border-slate-800 p-6 border-t-4 border-orange-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400 font-semibold">Total Spent</p>
                    <p className="text-3xl font-bold text-orange-600 mt-2">
                      ${stats.totalSpent.toFixed(2)}
                    </p>
                  </div>
                  <TrendingUp className="w-12 h-12 text-orange-500 opacity-20" />
                </div>
              </div>

              {/* Credits Remaining */}
              <div className="bg-slate-900 rounded-lg border border-slate-800 p-6 border-t-4 border-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400 font-semibold">Total Remaining</p>
                    <p className="text-3xl font-bold text-green-600 mt-2">
                      ${stats.totalRemaining.toFixed(2)}
                    </p>
                  </div>
                  <AlertCircle className="w-12 h-12 text-green-500 opacity-20" />
                </div>
              </div>

              {/* Clients Active */}
              <div className="bg-slate-900 rounded-lg border border-slate-800 p-6 border-t-4 border-purple-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400 font-semibold">Clients with Credits</p>
                    <p className="text-3xl font-bold text-purple-600 mt-2">
                      {stats.clientsWithCredits}
                    </p>
                  </div>
                  <Users className="w-12 h-12 text-purple-500 opacity-20" />
                </div>
              </div>
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Average Per Client */}
              <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
                <p className="text-sm text-slate-400 font-semibold">Average Credits/Client</p>
                <p className="text-2xl font-bold text-slate-100 mt-3">
                  ${stats.averageCreditPerClient.toFixed(2)}
                </p>
                <p className="text-xs text-slate-500 mt-2">Based on total clients</p>
              </div>

              {/* Average Spent Per Client */}
              <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
                <p className="text-sm text-slate-400 font-semibold">Average Spent/Client</p>
                <p className="text-2xl font-bold text-orange-600 mt-3">
                  ${stats.averageSpentPerClient.toFixed(2)}
                </p>
                <p className="text-xs text-slate-500 mt-2">Per booking average</p>
              </div>

              {/* Utilization Rate */}
              <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
                <p className="text-sm text-slate-400 font-semibold">Credit Utilization</p>
                <p className="text-2xl font-bold text-blue-600 mt-3">
                  {stats.totalCreditsInSystem > 0
                    ? ((stats.totalSpent / stats.totalCreditsInSystem) * 100).toFixed(1)
                    : '0'}%
                </p>
                <p className="text-xs text-slate-500 mt-2">Of all credits in system</p>
              </div>
            </div>

            {/* Problem Areas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Zero Balance Clients */}
              <div className="bg-amber-900/20 rounded-lg shadow p-6 border border-amber-700/50">
                <h3 className="text-lg font-bold text-amber-200 mb-3">⚠️ Zero Balance Clients</h3>
                <p className="text-3xl font-bold text-amber-700">{stats.clientsWithZeroBalance}</p>
                <p className="text-sm text-amber-600 mt-2">
                  Clients who have exhausted their credits
                </p>
                <Link
                  href="/admin/clients?status=zero-balance"
                  className="inline-block mt-4 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition text-sm font-semibold"
                >
                  View Clients →
                </Link>
              </div>

              {/* Negative Balance Clients */}
              <div className="bg-red-900/20 rounded-lg shadow p-6 border border-red-700/50">
                <h3 className="text-lg font-bold text-red-200 mb-3">❌ Negative Balance Clients</h3>
                <p className="text-3xl font-bold text-red-700">{stats.clientsWithNegativeBalance}</p>
                <p className="text-sm text-red-600 mt-2">
                  Clients with dispute or refund issues
                </p>
                <Link
                  href="/admin/clients?status=negative"
                  className="inline-block mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-semibold"
                >
                  Resolve Issues →
                </Link>
              </div>
            </div>

            {/* Information Box */}
            <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-6">
              <h3 className="font-bold text-blue-200 mb-3">💡 Credit System Overview</h3>
              <ul className="space-y-2 text-sm text-blue-300">
                <li>• Total system credits represent all funds clients have paid into their wallets</li>
                <li>• Spent credits are deducted from bookings and completed lessons</li>
                <li>• Remaining credits are available for future bookings</li>
                <li>• Zero balance clients cannot book without adding more credits</li>
                <li>• Negative balance indicates refund disputes that need resolution</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 flex gap-4 flex-wrap">
              <Link
                href="/admin/clients"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                Manage All Clients
              </Link>
              <button
                onClick={fetchCreditsStats}
                className="px-6 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-800 transition font-semibold"
              >
                Refresh Data
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-slate-400">Failed to load credits data</p>
          </div>
        )}
      </div>
    </div>
  );
}
