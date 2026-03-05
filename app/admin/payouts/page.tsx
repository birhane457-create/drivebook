'use client';

import { useEffect, useState } from 'react';
import AdminNav from '@/components/admin/AdminNav';
import { DollarSign, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface PayoutData {
  pendingPayouts: Array<{
    instructorId: string;
    instructorName: string;
    totalAmount: number;
    transactionCount: number;
    transactions: Array<{
      id: string;
      amount: number;
      instructorPayout: number;
      createdAt: string;
    }>;
  }>;
  totalPending: number;
  completedThisMonth: number;
}

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<PayoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchPayouts();
  }, []);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchPayouts = async () => {
    try {
      const res = await fetch('/api/admin/payouts');
      if (res.ok) {
        const data = await res.json();
        setPayouts(data);
      } else {
        showToast('error', 'Failed to load payout data.');
      }
    } catch (error) {
      console.error('Failed to fetch payouts:', error);
      showToast('error', 'Failed to load payout data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const processPayout = async (instructorId: string) => {
    if (!confirm('Process payout for this instructor? This will mark all pending transactions as completed.')) {
      return;
    }

    setProcessing(instructorId);
    try {
      const res = await fetch('/api/admin/payouts/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructorId })
      });

      if (res.ok) {
        showToast('success', 'Payout processed successfully.');
        fetchPayouts(); // Refresh data
      } else {
        const data = await res.json().catch(() => ({}));
        showToast('error', (data as any).error || 'Failed to process payout.');
      }
    } catch (error) {
      console.error('Payout error:', error);
      showToast('error', 'Failed to process payout. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  const processAllPayouts = async () => {
    if (!confirm(`Process ALL pending payouts? Total: $${payouts?.totalPending.toFixed(2)}`)) {
      return;
    }

    setProcessing('all');
    try {
      const res = await fetch('/api/admin/payouts/process-all', {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        showToast('success', `Processed ${data.count} payouts totaling $${data.total.toFixed(2)}.`);
        fetchPayouts();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast('error', (data as any).error || 'Failed to process payouts.');
      }
    } catch (error) {
      console.error('Bulk payout error:', error);
      showToast('error', 'Failed to process payouts. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <p>Loading payout data...</p>
        </div>
      </div>
    );
  }

  if (!payouts) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <p>Failed to load payout data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Payout Management</h1>
          <p className="text-gray-600 mt-1">Process instructor payouts</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Total Pending</p>
              <DollarSign className="h-5 w-5 text-yellow-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">${payouts.totalPending.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">{payouts.pendingPayouts.length} instructors</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Completed This Month</p>
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">${payouts.completedThisMonth.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">Already paid out</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <button
              onClick={processAllPayouts}
              disabled={processing !== null || payouts.pendingPayouts.length === 0}
              className="w-full h-full bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <DollarSign className="h-6 w-6 mx-auto mb-2" />
              <p className="font-semibold">Process All Payouts</p>
              <p className="text-sm opacity-90">${payouts.totalPending.toFixed(2)}</p>
            </button>
          </div>
        </div>

        {/* Pending Payouts */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Pending Payouts</h2>
          </div>

          {payouts.pendingPayouts.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {payouts.pendingPayouts.map((payout) => (
                <div key={payout.instructorId} className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <Link 
                        href={`/admin/instructors/${payout.instructorId}`}
                        className="text-lg font-semibold text-gray-900 hover:text-blue-600"
                      >
                        {payout.instructorName}
                      </Link>
                      <p className="text-sm text-gray-600">{payout.transactionCount} pending transactions</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">${payout.totalAmount.toFixed(2)}</p>
                      <button
                        onClick={() => processPayout(payout.instructorId)}
                        disabled={processing !== null}
                        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
                      >
                        {processing === payout.instructorId ? 'Processing...' : 'Process Payout'}
                      </button>
                    </div>
                  </div>

                  {/* Transaction Details */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Transactions:</p>
                    <div className="space-y-2">
                      {payout.transactions.map((transaction) => (
                        <div key={transaction.id} className="flex justify-between text-sm">
                          <span className="text-gray-600">
                            {new Date(transaction.createdAt).toLocaleDateString()} - ${transaction.amount.toFixed(2)}
                          </span>
                          <span className="font-medium text-gray-900">
                            Payout: ${transaction.instructorPayout.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <p className="text-xl font-semibold text-gray-900 mb-2">All Caught Up!</p>
              <p className="text-gray-600">No pending payouts at this time</p>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">Payout Information</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Payouts are typically processed weekly on Fridays</li>
                <li>• Instructors must have completed bookings to receive payouts</li>
                <li>• Processing a payout marks all pending transactions as COMPLETED</li>
                <li>• Funds are transferred via Stripe Connect (if configured)</li>
                <li>• Instructors receive SMS notification when payout is processed</li>
              </ul>
            </div>
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
