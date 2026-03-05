'use client';

import { useEffect, useState } from 'react';
import AdminNav from '@/components/admin/AdminNav';
import { DollarSign, TrendingUp, Users, Calendar, FileText, RefreshCw, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface RevenueData {
  totalRevenue: number;
  thisMonthRevenue: number;
  lastMonthRevenue: number;
  pendingPayouts: number;
  completedPayouts: number;
  totalTransactions: number;
  totalRefunds: number;
  pendingRefunds: number;
  topInstructors: Array<{
    id: string;
    name: string;
    totalEarnings: number;
    transactionCount: number;
  }>;
  revenueByMonth: Array<{
    month: string;
    revenue: number;
    transactions: number;
  }>;
  recentTransactions: Array<{
    id: string;
    instructorId: string;
    amount: number;
    platformFee: number;
    instructorPayout: number;
    status: string;
    createdAt: string;
    instructor: {
      id: string;
      name: string;
    };
    booking?: {
      client: {
        name: string;
      };
    };
  }>;
}

export default function AdminRevenuePage() {
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'refunds' | 'reports'>('overview');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchRevenue();
  }, []);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  async function fetchRevenue() {
    try {
      const res = await fetch('/api/admin/revenue');
      if (res.ok) {
        const data = await res.json();
        setRevenue(data);
      } else {
        showToast('error', 'Failed to load revenue data.');
      }
    } catch (error) {
      console.error('Error fetching revenue:', error);
      showToast('error', 'Failed to load revenue data. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const downloadInvoice = async (transactionId: string) => {
    try {
      const res = await fetch(`/api/admin/transactions/${transactionId}/invoice`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${transactionId}.txt`;
        a.click();
      }
    } catch (error) {
      console.error('Error downloading invoice:', error);
      showToast('error', 'Failed to download invoice.');
    }
  };

  const handleRefund = async (transactionId: string) => {
    if (!confirm('Are you sure you want to process this refund?')) return;
    
    try {
      const res = await fetch(`/api/admin/transactions/${transactionId}/refund`, {
        method: 'POST',
      });
      
      if (res.ok) {
        showToast('success', 'Refund processed successfully.');
        fetchRevenue();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast('error', (data as any).error || 'Failed to process refund.');
      }
    } catch (error) {
      console.error('Error processing refund:', error);
      showToast('error', 'Failed to process refund. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading revenue data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!revenue) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <p className="text-red-600">Failed to load revenue data</p>
        </div>
      </div>
    );
  }

  const growthRate = revenue.lastMonthRevenue > 0
    ? ((revenue.thisMonthRevenue - revenue.lastMonthRevenue) / revenue.lastMonthRevenue) * 100
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Revenue Management</h1>
          <p className="text-gray-600 mt-2">Comprehensive financial overview and management</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  ${revenue.totalRevenue.toFixed(2)}
                </p>
              </div>
              <DollarSign className="h-12 w-12 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">This Month</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  ${revenue.thisMonthRevenue.toFixed(2)}
                </p>
                <p className={`text-sm mt-1 ${growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {growthRate >= 0 ? '+' : ''}{growthRate.toFixed(1)}% from last month
                </p>
              </div>
              <TrendingUp className="h-12 w-12 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Payouts</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  ${revenue.pendingPayouts.toFixed(2)}
                </p>
              </div>
              <Users className="h-12 w-12 text-orange-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Transactions</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {revenue.totalTransactions}
                </p>
              </div>
              <Calendar className="h-12 w-12 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'overview'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('transactions')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'transactions'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Transactions
              </button>
              <button
                onClick={() => setActiveTab('refunds')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'refunds'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Refunds
                {revenue.pendingRefunds > 0 && (
                  <span className="ml-2 bg-red-100 text-red-600 px-2 py-1 rounded-full text-xs">
                    {revenue.pendingRefunds}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('reports')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'reports'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Reports
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Top Instructors */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Earning Instructors</h3>
                  <div className="space-y-3">
                    {revenue.topInstructors.map((instructor, index) => (
                      <div key={instructor.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            index === 0 ? 'bg-yellow-100 text-yellow-800' :
                            index === 1 ? 'bg-gray-100 text-gray-800' :
                            index === 2 ? 'bg-orange-100 text-orange-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <Link 
                              href={`/admin/instructors/${instructor.id}`}
                              className="font-medium text-gray-900 hover:text-blue-600"
                            >
                              {instructor.name}
                            </Link>
                            <p className="text-xs text-gray-500">{instructor.transactionCount} transactions</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">${instructor.totalEarnings.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Revenue Chart */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend (Last 6 Months)</h3>
                  <div className="space-y-3">
                    {revenue.revenueByMonth.map((month) => (
                      <div key={month.month} className="flex items-center space-x-4">
                        <div className="w-24 text-sm text-gray-600">{month.month}</div>
                        <div className="flex-1">
                          <div className="bg-gray-200 rounded-full h-8 overflow-hidden">
                            <div
                              className="bg-blue-600 h-full flex items-center justify-end pr-2"
                              style={{
                                width: `${Math.min((month.revenue / Math.max(...revenue.revenueByMonth.map(m => m.revenue))) * 100, 100)}%`
                              }}
                            >
                              <span className="text-white text-xs font-medium">
                                ${month.revenue.toFixed(0)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="w-20 text-sm text-gray-600 text-right">
                          {month.transactions} txns
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'transactions' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
                  <Link
                    href="/admin/payouts"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
                  >
                    Process Payouts
                  </Link>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Instructor</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Platform Fee</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Instructor Payout</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {revenue.recentTransactions.map((transaction) => (
                        <tr key={transaction.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {new Date(transaction.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <Link 
                              href={`/admin/instructors/${transaction.instructorId}`}
                              className="hover:text-blue-600"
                            >
                              {transaction.booking?.instructor?.name || 'N/A'}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {transaction.booking?.client?.name || 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            ${transaction.amount.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-green-600">
                            ${transaction.platformFee.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            ${transaction.instructorPayout.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              transaction.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                              transaction.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                              transaction.status === 'REFUNDED' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {transaction.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex gap-2">
                              <button
                                onClick={() => downloadInvoice(transaction.id)}
                                className="text-blue-600 hover:text-blue-900"
                                title="Download Invoice"
                              >
                                <FileText className="h-4 w-4" />
                              </button>
                              {transaction.status === 'COMPLETED' && (
                                <button
                                  onClick={() => handleRefund(transaction.id)}
                                  className="text-red-600 hover:text-red-900"
                                  title="Process Refund"
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'refunds' && (
              <div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3" />
                    <div>
                      <h4 className="text-sm font-medium text-yellow-900">Refund Management</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        Process refunds for cancelled bookings or no-shows. Partial refunds can be deducted from instructor's future payouts.
                      </p>
                    </div>
                  </div>
                </div>
                
                <p className="text-gray-600">Refund management interface - Coming soon</p>
                <p className="text-sm text-gray-500 mt-2">
                  This section will allow you to:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-500 mt-2 space-y-1">
                  <li>View all refund requests</li>
                  <li>Process full or partial refunds</li>
                  <li>Deduct refund amounts from instructor payouts</li>
                  <li>Track refund history</li>
                </ul>
              </div>
            )}

            {activeTab === 'reports' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Reports</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-600 hover:bg-blue-50 text-left">
                    <FileText className="h-8 w-8 text-blue-600 mb-2" />
                    <h4 className="font-medium text-gray-900">Monthly Revenue Report</h4>
                    <p className="text-sm text-gray-600 mt-1">Download detailed monthly revenue breakdown</p>
                  </button>
                  
                  <button className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-600 hover:bg-blue-50 text-left">
                    <FileText className="h-8 w-8 text-green-600 mb-2" />
                    <h4 className="font-medium text-gray-900">Instructor Earnings Report</h4>
                    <p className="text-sm text-gray-600 mt-1">Export all instructor earnings data</p>
                  </button>
                  
                  <button className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-600 hover:bg-blue-50 text-left">
                    <FileText className="h-8 w-8 text-purple-600 mb-2" />
                    <h4 className="font-medium text-gray-900">Tax Report</h4>
                    <p className="text-sm text-gray-600 mt-1">Generate tax documentation for accounting</p>
                  </button>
                  
                  <button className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-600 hover:bg-blue-50 text-left">
                    <FileText className="h-8 w-8 text-red-600 mb-2" />
                    <h4 className="font-medium text-gray-900">Refund Report</h4>
                    <p className="text-sm text-gray-600 mt-1">View all refunds and chargebacks</p>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast notifications */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`max-w-sm rounded-lg shadow-lg px-4 py-3 text-sm text-white ${
              toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
