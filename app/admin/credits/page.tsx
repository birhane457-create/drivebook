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
      const res = await fetch('/api/admin/clients');
      if (res.ok) {
        const clients = await res.json();

        const totalPaid = clients.reduce((sum: number, c: any) => sum + c.totalPaid, 0);
        const totalSpent = clients.reduce((sum: number, c: any) => sum + c.totalSpent, 0);
        const creditsWithBalance = clients.filter((c: any) => c.totalPaid > 0).length;
        const zeroBalance = clients.filter((c: any) => c.status === 'zero-balance').length;
        const negativeBalance = clients.filter((c: any) => c.status === 'negative').length;

        setStats({
          totalCreditsInSystem: totalPaid,
          totalSpent: totalSpent,
          totalRemaining: totalPaid - totalSpent,
          clientsWithCredits: creditsWithBalance,
          clientsWithZeroBalance: zeroBalance,
          clientsWithNegativeBalance: negativeBalance,
          averageCreditPerClient: creditsWithBalance > 0 ? totalPaid / clients.length : 0,
          averageSpentPerClient: clients.length > 0 ? totalSpent / clients.length : 0
        });
      }
    } catch (error) {
      console.error('Failed to fetch credits stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Credits Management</h1>
          <p className="text-gray-600 mt-2">Overview of all credits in the system</p>
        </div>

        {/* Main Stats */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading credits data...</p>
          </div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {/* Total Credits */}
              <div className="bg-white rounded-lg shadow p-6 border-t-4 border-blue-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-semibold">Total Credits Paid</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      ${stats.totalCreditsInSystem.toFixed(2)}
                    </p>
                  </div>
                  <DollarSign className="w-12 h-12 text-blue-500 opacity-20" />
                </div>
              </div>

              {/* Total Spent */}
              <div className="bg-white rounded-lg shadow p-6 border-t-4 border-orange-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-semibold">Total Spent</p>
                    <p className="text-3xl font-bold text-orange-600 mt-2">
                      ${stats.totalSpent.toFixed(2)}
                    </p>
                  </div>
                  <TrendingUp className="w-12 h-12 text-orange-500 opacity-20" />
                </div>
              </div>

              {/* Credits Remaining */}
              <div className="bg-white rounded-lg shadow p-6 border-t-4 border-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-semibold">Total Remaining</p>
                    <p className="text-3xl font-bold text-green-600 mt-2">
                      ${stats.totalRemaining.toFixed(2)}
                    </p>
                  </div>
                  <AlertCircle className="w-12 h-12 text-green-500 opacity-20" />
                </div>
              </div>

              {/* Clients Active */}
              <div className="bg-white rounded-lg shadow p-6 border-t-4 border-purple-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-semibold">Clients with Credits</p>
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
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm text-gray-600 font-semibold">Average Credits/Client</p>
                <p className="text-2xl font-bold text-gray-900 mt-3">
                  ${stats.averageCreditPerClient.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-2">Based on total clients</p>
              </div>

              {/* Average Spent Per Client */}
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm text-gray-600 font-semibold">Average Spent/Client</p>
                <p className="text-2xl font-bold text-orange-600 mt-3">
                  ${stats.averageSpentPerClient.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-2">Per booking average</p>
              </div>

              {/* Utilization Rate */}
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm text-gray-600 font-semibold">Credit Utilization</p>
                <p className="text-2xl font-bold text-blue-600 mt-3">
                  {stats.totalCreditsInSystem > 0
                    ? ((stats.totalSpent / stats.totalCreditsInSystem) * 100).toFixed(1)
                    : '0'}%
                </p>
                <p className="text-xs text-gray-500 mt-2">Of all credits in system</p>
              </div>
            </div>

            {/* Problem Areas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Zero Balance Clients */}
              <div className="bg-amber-50 rounded-lg shadow p-6 border border-amber-200">
                <h3 className="text-lg font-bold text-amber-900 mb-3">⚠️ Zero Balance Clients</h3>
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
              <div className="bg-red-50 rounded-lg shadow p-6 border border-red-200">
                <h3 className="text-lg font-bold text-red-900 mb-3">❌ Negative Balance Clients</h3>
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
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-bold text-blue-900 mb-3">💡 Credit System Overview</h3>
              <ul className="space-y-2 text-sm text-blue-800">
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
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-semibold"
              >
                Refresh Data
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-600">Failed to load credits data</p>
          </div>
        )}
      </div>
    </div>
  );
}
