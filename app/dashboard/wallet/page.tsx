'use client';

import { useEffect, useState } from 'react';
import { DollarSign, Clock, CheckCircle, ArrowRight, RefreshCw, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { resolveTimezone, DEFAULT_TIMEZONE } from '@/lib/utils/timezone';

interface EarningsData {
  totalEarnings: number;
  pendingPayouts: number;
  thisMonthEarnings: number;
  platform: {
    pendingPayouts: number;
  };
  transactions: {
    id: string;
    amount: number;
    instructorPayout: number;
    status: string;
    createdAt: string;
    description: string;
    booking?: { client: { name: string }; startTime: string };
  }[];
}

export default function InstructorWalletPage() {
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [instructorTz, setInstructorTz] = useState(DEFAULT_TIMEZONE);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/instructor/earnings');
      if (!res.ok) throw new Error('Failed to load');
      setData(await res.json());
    } catch {
      setError('Failed to load payout data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    fetch('/api/instructor/settings').then(r => r.ok ? r.json() : null).then(s => { if (s?.timezone) setInstructorTz(resolveTimezone(s.timezone)); }).catch(() => {});
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center text-red-400">{error}</div>
  );

  // Derive this-week earnings from completed transactions where booking.startTime falls in Mon–Sun
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMonday);
  weekStart.setHours(0, 0, 0, 0);
  const thisWeekEarnings = (data?.transactions ?? [])
    .filter(tx => tx.status === 'COMPLETED' && tx.booking?.startTime && new Date(tx.booking.startTime) >= weekStart)
    .reduce((sum, tx) => sum + (tx.instructorPayout ?? tx.amount), 0);

  const pendingPayouts = data?.platform?.pendingPayouts ?? 0;
  const recent = data?.transactions?.slice(0, 10) ?? [];

  return (
          <div className="max-w-5xl mx-auto px-2 sm:px-4 lg:px-6 py-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-sm">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-100">Payout Wallet</h1>
            <p className="text-slate-400 mt-1">Your earnings balance and payout history</p>
          </div>
          <div className="flex gap-3">
            <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <Link href="/dashboard/earnings" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition">
              Full Earnings <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-900 rounded-3xl shadow-sm p-5 border border-slate-800">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Pending Payout</p>
            <p className="text-2xl font-bold text-amber-400">${pendingPayouts.toFixed(2)}</p>
            <div className="flex items-center gap-1 mt-2 text-xs text-amber-300">
              <Clock className="w-3 h-3" /> Awaiting processing
            </div>
          </div>
          <div className="bg-slate-900 rounded-3xl shadow-sm p-5 border border-slate-800">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">This Week</p>
            <p className="text-2xl font-bold text-green-400">${thisWeekEarnings.toFixed(2)}</p>
            <div className="flex items-center gap-1 mt-2 text-xs text-green-300">
              <TrendingUp className="w-3 h-3" /> Net earnings
            </div>
          </div>
          <div className="bg-slate-900 rounded-3xl shadow-sm p-5 border border-slate-800">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">This Month</p>
            <p className="text-2xl font-bold text-sky-400">${(data?.thisMonthEarnings ?? 0).toFixed(2)}</p>
            <div className="flex items-center gap-1 mt-2 text-xs text-sky-300">
              <DollarSign className="w-3 h-3" /> Net earnings
            </div>
          </div>
          <div className="bg-slate-900 rounded-3xl shadow-sm p-5 border border-slate-800">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">All Time</p>
            <p className="text-2xl font-bold text-slate-100">${(data?.totalEarnings ?? 0).toFixed(2)}</p>
            <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
              <CheckCircle className="w-3 h-3" /> Total paid out
            </div>
          </div>
        </div>

        {/* Recent transactions */}
        <div className="bg-slate-900 rounded-3xl shadow-sm border border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-semibold text-slate-100">Recent Payouts</h2>
            <Link href="/dashboard/earnings" className="text-sm text-cyan-400 hover:text-cyan-300">View all</Link>
          </div>

          {recent.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400">
              <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No payout transactions yet</p>
              <p className="text-sm mt-1">Completed lessons will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {recent.map(tx => (
                <div key={tx.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-800 transition">
                  <div>
                    <p className="text-sm font-medium text-slate-100">
                      {tx.booking?.client?.name ?? tx.description ?? 'Payout'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {tx.booking?.startTime
                        ? new Date(tx.booking.startTime).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: instructorTz })
                        : new Date(tx.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: instructorTz })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-600">+${(tx.instructorPayout ?? tx.amount).toFixed(2)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      tx.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' :
                      tx.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{tx.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info note */}
        <p className="text-xs text-slate-400 text-center mt-6">
          Payouts are processed by the platform admin. For detailed earnings breakdown, visit the{' '}
          <Link href="/dashboard/earnings" className="text-cyan-300 hover:text-cyan-200">Earnings page</Link>.
        </p>
      </div>
  );
}
