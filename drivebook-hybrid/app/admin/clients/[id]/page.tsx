'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminNav from '@/components/admin/AdminNav';
import { ChevronLeft, Plus, Minus, AlertCircle, Loader2, Edit2, Trash2, Filter } from 'lucide-react';
import Link from 'next/link';

interface ClientWallet {
  user: {
    name: string;
    email: string;
    createdAt: string;
  };
  wallet: {
    id: string;
    totalPaid: number;
    totalSpent: number;
    creditsRemaining: number;
    transactions: Array<{
      id: string;
      amount: number;
      type: string;
      description: string;
      status: string;
      createdAt: string;
    }>;
  };
  bookings: Array<{
    id: string;
    startTime: string;
    status: string;
    price: number;
    instructor: { name: string };
  }>;
}

export default function AdminClientDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [client, setClient] = useState<ClientWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showAddCredit, setShowAddCredit] = useState(false);
  const [showDeductCredit, setShowDeductCredit] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Filters
  const [transactionFilter, setTransactionFilter] = useState('all');
  const [bookingFilter, setBookingFilter] = useState('all');
  
  // Edit states
  const [editingTransaction, setEditingTransaction] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');

  useEffect(() => {
    fetchClientDetails();
  }, []);

  const fetchClientDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/clients/${params.id}/wallet`);
      if (res.ok) {
        const data = await res.json();
        setClient(data);
      }
    } catch (err) {
      console.error('Failed to fetch client:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCredit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    try {
      setActionLoading(true);
      setError('');
      setSuccess('');

      const res = await fetch(`/api/admin/clients/${params.id}/wallet/add-credit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          reason: reason || 'Manual credit addition by admin'
        })
      });

      if (res.ok) {
        setSuccess(`Added $${amount} to wallet`);
        setAmount('');
        setReason('');
        setShowAddCredit(false);
        setTimeout(() => fetchClientDetails(), 500);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to add credit');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeductCredit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    try {
      setActionLoading(true);
      setError('');
      setSuccess('');

      const res = await fetch(`/api/admin/clients/${params.id}/wallet/deduct-credit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          reason: reason || 'Manual deduction by admin'
        })
      });

      if (res.ok) {
        setSuccess(`Deducted $${amount} from wallet`);
        setAmount('');
        setReason('');
        setShowDeductCredit(false);
        setTimeout(() => fetchClientDetails(), 500);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to deduct credit');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!confirm('Are you sure you want to delete this transaction? This will adjust the wallet balance.')) {
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch(`/api/admin/clients/${params.id}/wallet/transactions/${transactionId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setSuccess('Transaction deleted successfully');
        setTimeout(() => fetchClientDetails(), 500);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to delete transaction');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditTransaction = async (transactionId: string) => {
    if (!editAmount || parseFloat(editAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch(`/api/admin/clients/${params.id}/wallet/transactions/${transactionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(editAmount),
          description: editDescription
        })
      });

      if (res.ok) {
        setSuccess('Transaction updated successfully');
        setEditingTransaction(null);
        setEditAmount('');
        setEditDescription('');
        setTimeout(() => fetchClientDetails(), 500);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to update transaction');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to delete this booking? This cannot be undone.')) {
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setSuccess('Booking deleted successfully');
        setTimeout(() => fetchClientDetails(), 500);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to delete booking');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredTransactions = client?.wallet.transactions.filter(tx => {
    if (transactionFilter === 'all') return true;
    if (transactionFilter === 'credit') return tx.type === 'CREDIT' || tx.type === 'REFUND';
    if (transactionFilter === 'debit') return tx.type === 'DEBIT';
    return true;
  }) || [];

  const filteredBookings = client?.bookings.filter(booking => {
    if (bookingFilter === 'all') return true;
    return booking.status === bookingFilter.toUpperCase();
  }) || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav />
        <div className="max-w-7xl mx-auto px-4 py-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
          <p className="text-gray-600 mt-4">Loading client details...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-center text-gray-600">Client not found</p>
        </div>
      </div>
    );
  }

  const usagePercent = client.wallet.totalPaid > 0
    ? (client.wallet.totalSpent / client.wallet.totalPaid) * 100
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link
          href="/admin/clients"
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Clients
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{client.user.name}</h1>
          <p className="text-gray-600 mt-1">{client.user.email}</p>
          <p className="text-sm text-gray-500">
            Joined {new Date(client.user.createdAt).toLocaleDateString()}
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-700 text-sm">{success}</p>
          </div>
        )}

        {/* Wallet Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6 border-t-4 border-blue-500">
            <p className="text-sm text-gray-600">Total Paid</p>
            <p className="text-3xl font-bold text-gray-900">${client.wallet.totalPaid.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-t-4 border-orange-500">
            <p className="text-sm text-gray-600">Total Spent</p>
            <p className="text-3xl font-bold text-orange-600">${client.wallet.totalSpent.toFixed(2)}</p>
          </div>
          <div className={`rounded-lg shadow p-6 border-t-4 ${
            client.wallet.creditsRemaining > 0 ? 'bg-white border-green-500' : 'bg-red-50 border-red-500'
          }`}>
            <p className="text-sm text-gray-600">Credits Remaining</p>
            <p className={`text-3xl font-bold ${
              client.wallet.creditsRemaining > 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              ${client.wallet.creditsRemaining.toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-t-4 border-purple-500">
            <p className="text-sm text-gray-600">Bookings</p>
            <p className="text-3xl font-bold text-purple-600">{client.bookings.length}</p>
          </div>
        </div>

        {/* Credit Usage */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Credit Usage</h2>
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">Usage Progress</span>
              <span className="text-sm font-bold text-gray-900">{usagePercent.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
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
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {!showAddCredit ? (
            <button
              onClick={() => setShowAddCredit(true)}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
            >
              <Plus className="w-5 h-5" />
              Add Credit
            </button>
          ) : (
            <div className="bg-white rounded-lg shadow p-6">
              <label className="block font-semibold text-gray-900 mb-2">Add Credit Amount ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-green-500"
              />
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (optional)"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-green-500"
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddCredit}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Adding...' : 'Confirm'}
                </button>
                <button
                  onClick={() => {
                    setShowAddCredit(false);
                    setAmount('');
                    setReason('');
                    setError('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!showDeductCredit ? (
            <button
              onClick={() => setShowDeductCredit(true)}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold"
            >
              <Minus className="w-5 h-5" />
              Deduct Credit
            </button>
          ) : (
            <div className="bg-white rounded-lg shadow p-6">
              <label className="block font-semibold text-gray-900 mb-2">Deduct Credit Amount ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-red-500"
              />
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (optional)"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-red-500"
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleDeductCredit}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Deducting...' : 'Confirm'}
                </button>
                <button
                  onClick={() => {
                    setShowDeductCredit(false);
                    setAmount('');
                    setReason('');
                    setError('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Transaction History */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-900">Transaction History</h2>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={transactionFilter}
                onChange={(e) => setTransactionFilter(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Transactions</option>
                <option value="credit">Credits Only</option>
                <option value="debit">Debits Only</option>
              </select>
            </div>
          </div>
          {filteredTransactions.length > 0 ? (
            <div className="divide-y">
              {filteredTransactions.map((tx) => (
                <div key={tx.id} className="p-6 hover:bg-gray-50">
                  {editingTransaction === tx.id ? (
                    <div className="space-y-3">
                      <input
                        type="number"
                        step="0.01"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Amount"
                      />
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Description"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditTransaction(tx.id)}
                          disabled={actionLoading}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingTransaction(null);
                            setEditAmount('');
                            setEditDescription('');
                          }}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{tx.description}</p>
                        <p className="text-sm text-gray-600">
                          {new Date(tx.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right flex items-start gap-3">
                        <div>
                          <p className={`font-bold text-lg ${
                            tx.type === 'CREDIT' || tx.type === 'REFUND'
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}>
                            {tx.type === 'CREDIT' || tx.type === 'REFUND' ? '+' : '-'}${tx.amount.toFixed(2)}
                          </p>
                          <span className={`text-xs font-semibold px-2 py-1 rounded ${
                            tx.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {tx.status}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setEditingTransaction(tx.id);
                              setEditAmount(tx.amount.toString());
                              setEditDescription(tx.description);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Edit transaction"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTransaction(tx.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Delete transaction"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-600">
              {transactionFilter === 'all' ? 'No transactions yet' : 'No transactions match this filter'}
            </div>
          )}
        </div>

        {/* Bookings */}
        <div className="bg-white rounded-lg shadow overflow-hidden mt-8">
          <div className="p-6 border-b flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-900">Bookings ({filteredBookings.length})</h2>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={bookingFilter}
                onChange={(e) => setBookingFilter(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Bookings</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          {filteredBookings.length > 0 ? (
            <div className="divide-y max-h-96 overflow-y-auto">
              {filteredBookings.map((booking: ClientWallet['bookings'][number]) => (
                <div key={booking.id} className="p-6 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{booking.instructor.name}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(booking.startTime).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right flex items-start gap-3">
                      <div>
                        <p className="font-bold text-gray-900">${booking.price.toFixed(2)}</p>
                        <span className={`text-xs font-semibold px-2 py-1 rounded ${
                          booking.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-700'
                            : booking.status === 'CANCELLED'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {booking.status}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteBooking(booking.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Delete booking"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-600">
              {bookingFilter === 'all' ? 'No bookings yet' : 'No bookings match this filter'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
