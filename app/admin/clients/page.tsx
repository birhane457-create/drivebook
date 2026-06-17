'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminNav from '@/components/admin/AdminNav';
import { Search, ChevronRight, AlertCircle, TrendingUp } from 'lucide-react';
import Link from 'next/link';

interface Client {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  totalPaid: number;
  totalSpent: number;
  creditsRemaining: number;
  bookingCount: number;
  status: 'active' | 'zero-balance' | 'negative';
}

export default function AdminClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    pages: 0,
    hasMore: false,
  });

  useEffect(() => {
    fetchClients(1);
  }, []);

  const fetchClients = async (page: number) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/clients?page=${page}&limit=25`);
      if (res.ok) {
        const data = await res.json();
        if (data.pagination) {
          setClients(data.clients);
          setPagination(data.pagination);
        }
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients
    .filter(c => 
      (c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
       c.email.toLowerCase().includes(searchQuery.toLowerCase())) &&
      (filterStatus === 'all' || c.status === filterStatus)
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const stats = {
    total: pagination.total,
    totalCredits: clients.reduce((sum, c) => sum + c.totalPaid, 0),
    totalSpent: clients.reduce((sum, c) => sum + c.totalSpent, 0),
    activeClients: clients.filter(c => c.status === 'active').length,
    zeroBalance: clients.filter(c => c.status === 'zero-balance').length,
    negativeBalance: clients.filter(c => c.status === 'negative').length
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100">Client Management</h1>
          <p className="text-slate-400 mt-2">Manage client accounts, wallets, and credits</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <p className="text-sm text-slate-400">Total Clients</p>
            <p className="text-2xl font-bold text-slate-100">{stats.total}</p>
          </div>
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <p className="text-sm text-slate-400">Active Wallets</p>
            <p className="text-2xl font-bold text-green-600">{stats.activeClients}</p>
          </div>
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <p className="text-sm text-slate-400">Total Credits Paid</p>
            <p className="text-2xl font-bold text-blue-600">${stats.totalCredits.toFixed(2)}</p>
          </div>
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <p className="text-sm text-slate-400">Total Spent</p>
            <p className="text-2xl font-bold text-orange-600">${stats.totalSpent.toFixed(2)}</p>
          </div>
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <p className="text-sm text-slate-400">Zero Balance</p>
            <p className="text-2xl font-bold text-amber-600">{stats.zeroBalance}</p>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active (Has Credits)</option>
              <option value="zero-balance">Zero Balance</option>
              <option value="negative">Negative Balance</option>
            </select>
          </div>
        </div>

        {/* Clients Table */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-slate-400">Loading clients...</p>
          </div>
        ) : filteredClients.length > 0 ? (
          <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-950 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-100">Client Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-100">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-100">Total Paid</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-100">Spent</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-100">Remaining</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-100">Bookings</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-100">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-100">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-800">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-100">{client.name}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">{client.email}</td>
                    <td className="px-6 py-4 font-semibold text-slate-100">${client.totalPaid.toFixed(2)}</td>
                    <td className="px-6 py-4 text-orange-600 font-semibold">${client.totalSpent.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`font-bold ${
                        client.creditsRemaining > 0
                          ? 'text-green-600'
                          : client.creditsRemaining === 0
                          ? 'text-slate-400'
                          : 'text-red-600'
                      }`}>
                        ${client.creditsRemaining.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-100">{client.bookingCount}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        client.status === 'active'
                          ? 'bg-green-900/40 text-green-300'
                          : client.status === 'zero-balance'
                          ? 'bg-amber-900/40 text-amber-300'
                          : 'bg-red-900/40 text-red-300'
                      }`}>
                        {client.status === 'active' ? '✓ Active' : client.status === 'zero-balance' ? '⚠️ Zero' : '❌ Negative'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="inline-flex items-center gap-1 px-3 py-2 text-blue-600 hover:bg-blue-900/20 rounded-lg transition"
                      >
                        Details
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-12 text-center">
            <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <p className="text-slate-400">No clients found</p>
          </div>
        )}

        {/* Pagination Controls */}
        {pagination.pages > 1 && (
          <div className="mt-6 flex items-center justify-between gap-4">
            <div className="text-sm text-slate-400">
              Page {pagination.page} of {pagination.pages} ({pagination.total} total)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fetchClients(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-4 py-2 border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => fetchClients(pagination.page + 1)}
                disabled={!pagination.hasMore}
                className="px-4 py-2 border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Results */}
        <p className="text-sm text-slate-400 mt-4">
          Showing {filteredClients.length} of {pagination.total} clients
        </p>
      </div>
    </div>
  );
}
