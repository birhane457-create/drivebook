'use client';

import { useEffect, useState } from 'react';
import AdminNav from '@/components/admin/AdminNav';
import { DollarSign, TrendingUp, TrendingDown, Users, BarChart2, FileText, RefreshCw, AlertCircle, Download, Calendar } from 'lucide-react';
import Link from 'next/link';

interface MonthData { month: string; commission: number; gross: number; instructorPayout: number; transactions: number; }
interface InstructorRow { id: string; name: string; totalEarnings: number; platformFee: number; grossAmount: number; transactionCount: number; }
interface TxnRow {
  id: string; instructorId: string; amount: number; platformFee: number;
  instructorPayout: number; status: string; type: string; createdAt: string; description: string;
  booking?: { clientName: string; startTime: string; status: string; instructor?: { id: string; name: string } };
}
interface RevenueData {
  rangeCommission: number; rangeGross: number; rangeInstructorPayout: number;
  rangeLessons: number; rangeRefunds: number; rangeRefundCount: number;
  totalCommission: number; totalGross: number; totalInstructorPayouts: number; totalCompletedLessons: number;
  thisMonthCommission: number; lastMonthCommission: number; thisMonthGross: number;
  pendingPayouts: number; completedPayouts: number;
  totalRefunds: number; refundCount: number; pendingRefunds: number; totalTransactions: number;
  topInstructors: InstructorRow[];
  revenueByMonth: MonthData[];
  recentTransactions: TxnRow[];
  refundedTransactions: TxnRow[];
  from: string; to: string;
}

type Tab = 'overview' | 'transactions' | 'refunds' | 'reports';

const PRESETS = [
  { label: 'Today', days: 0 },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: 'This month', days: -1 },
  { label: '3 months', days: 90 },
  { label: 'All time', days: -2 },
];

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'bg-green-900/40 text-green-300',
  PENDING: 'bg-yellow-900/40 text-yellow-300',
  REFUNDED: 'bg-red-900/40 text-red-300',
  CANCELLED: 'bg-slate-800 text-slate-400',
};

function toDateInput(d: Date) {
  return d.toISOString().split('T')[0];
}

export default function AdminRevenuePage() {
  const now = new Date();
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');
  const [activePreset, setActivePreset] = useState('This month');
  const [fromDate, setFromDate] = useState(toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [toDate, setToDate] = useState(toDateInput(now));
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => { fetchRevenue(fromDate, toDate); }, []);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchRevenue = async (from: string, to: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/revenue?from=${from}&to=${to}`);
      if (res.ok) setData(await res.json());
      else showToast('error', 'Failed to load revenue data.');
    } catch { showToast('error', 'Failed to load revenue data.'); }
    finally { setLoading(false); }
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setActivePreset(preset.label);
    const n = new Date();
    let from: Date;
    if (preset.days === 0) {
      from = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    } else if (preset.days === -1) {
      from = new Date(n.getFullYear(), n.getMonth(), 1);
    } else if (preset.days === -2) {
      from = new Date(2020, 0, 1);
    } else {
      from = new Date(n.getTime() - preset.days * 86400000);
    }
    const f = toDateInput(from);
    const t = toDateInput(n);
    setFromDate(f); setToDate(t);
    fetchRevenue(f, t);
  };

  const applyCustom = () => {
    setActivePreset('');
    fetchRevenue(fromDate, toDate);
  };

  const fmt = (n: number) => `$${(n || 0).toFixed(2)}`;
  const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const exportCSV = (rows: TxnRow[], filename: string) => {
    const headers = ['Date', 'Instructor', 'Client', 'Booking Status', 'Lesson Amount', 'Platform Commission', 'Instructor Payout', 'Txn Status'];
    const lines = rows.map(t => [
      fmtDate(t.createdAt),
      t.booking?.instructor?.name || '—',
      t.booking?.clientName || '—',
      t.booking?.status || '—',
      t.amount.toFixed(2),
      t.platformFee.toFixed(2),
      t.instructorPayout.toFixed(2),
      t.status,
    ].join(','));
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 py-8 flex items-center gap-3 text-slate-500">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
        Loading revenue data...
      </div>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 py-8"><p className="text-red-500">Failed to load revenue data.</p></div>
    </div>
  );

  const growthRate = data.lastMonthCommission > 0
    ? ((data.thisMonthCommission - data.lastMonthCommission) / data.lastMonthCommission) * 100
    : 0;
  const maxMonthGross = Math.max(...data.revenueByMonth.map(m => m.gross), 1);
  const isFiltered = activePreset !== 'All time';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-slate-100">Revenue Management</h1>
            <p className="text-slate-500 mt-1 text-sm">
              Commission = platform fee on <span className="font-medium text-slate-300">completed lesson payments</span> (BOOKING_PAYMENT transactions).
              Wallet top-ups and package purchases are excluded.
            </p>
          </div>
          <button onClick={() => fetchRevenue(fromDate, toDate)} className="p-2 text-slate-500 hover:text-slate-400 rounded-lg hover:bg-slate-800 shrink-0">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Date filter */}
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="h-4 w-4 text-slate-500 shrink-0" />
            <span className="text-sm text-slate-500 shrink-0">Filter:</span>
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => applyPreset(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activePreset === p.label ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}>
                {p.label}
              </button>
            ))}
            <div className="flex items-center gap-2 ml-auto">
              <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setActivePreset(''); }}
                className="border border-slate-700 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="text-slate-500 text-xs">to</span>
              <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setActivePreset(''); }}
                className="border border-slate-700 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={applyCustom}
                className="px-3 py-1.5 bg-slate-950 text-white text-xs rounded-lg hover:bg-slate-900">
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* Stats — two rows: filtered range + all-time context */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-5 border-l-4 border-blue-500">
            <p className="text-xs text-slate-500 mb-1">Commission Earned</p>
            <p className="text-2xl font-bold text-blue-700">{fmt(data.rangeCommission)}</p>
            <p className="text-xs text-slate-500 mt-1">Platform fee · {data.rangeLessons} completed lessons</p>
            <p className="text-xs text-slate-500 mt-0.5">in selected period</p>
          </div>

          <div className="bg-slate-900 rounded-lg border border-slate-800 p-5 border-l-4 border-slate-600">
            <p className="text-xs text-slate-500 mb-1">Gross Lesson Revenue</p>
            <p className="text-2xl font-bold text-slate-100">{fmt(data.rangeGross)}</p>
            <p className="text-xs text-slate-500 mt-1">Total paid by students for lessons</p>
            <p className="text-xs text-slate-500 mt-0.5">in selected period</p>
          </div>

          <div className="bg-slate-900 rounded-lg border border-slate-800 p-5 border-l-4 border-green-400">
            <p className="text-xs text-slate-500 mb-1">Instructor Payouts</p>
            <p className="text-2xl font-bold text-slate-100">{fmt(data.rangeInstructorPayout)}</p>
            <p className="text-xs text-slate-500 mt-1">Paid to instructors</p>
            <p className="text-xs text-slate-500 mt-0.5">in selected period</p>
          </div>

          <div className="bg-slate-900 rounded-lg border border-slate-800 p-5 border-l-4 border-red-400">
            <p className="text-xs text-slate-500 mb-1">Refunds Issued</p>
            <p className="text-2xl font-bold text-slate-100">{fmt(data.rangeRefunds)}</p>
            <p className="text-xs text-slate-500 mt-1">{data.rangeRefundCount} refunds</p>
            <p className="text-xs text-slate-500 mt-0.5">in selected period</p>
          </div>
        </div>

        {/* All-time context bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'All-Time Commission', value: fmt(data.totalCommission), sub: `${data.totalCompletedLessons} lessons ever` },
            { label: 'This Month Commission', value: fmt(data.thisMonthCommission), sub: growthRate >= 0 ? `+${growthRate.toFixed(1)}% vs last month` : `${growthRate.toFixed(1)}% vs last month`, subColor: growthRate >= 0 ? 'text-green-600' : 'text-red-500' },
            { label: 'Pending Payouts', value: fmt(data.pendingPayouts), sub: 'awaiting processing', link: '/admin/payouts' },
            { label: 'Total Refunds (all time)', value: fmt(data.totalRefunds), sub: `${data.refundCount} refunds` },
          ].map(s => (
            <div key={s.label} className="bg-slate-950 rounded-lg border border-slate-700 px-4 py-3">
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="text-lg font-bold text-slate-300 mt-0.5">{s.value}</p>
              {s.link
                ? <Link href={s.link} className="text-xs text-blue-600 hover:underline">{s.sub}</Link>
                : <p className={`text-xs mt-0.5 ${(s as any).subColor || 'text-slate-500'}`}>{s.sub}</p>}
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="bg-slate-900 rounded-lg border border-slate-800">
          <div className="border-b border-slate-800 flex overflow-x-auto">
            {([
              { key: 'overview', label: 'Overview', icon: BarChart2 },
              { key: 'transactions', label: `Transactions (${data.recentTransactions.length})`, icon: DollarSign },
              { key: 'refunds', label: `Refunds (${data.rangeRefundCount})`, icon: RefreshCw },
              { key: 'reports', label: 'Export', icon: Download },
            ] as { key: Tab; label: string; icon: any }[]).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}>
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-6">

            {/* OVERVIEW */}
            {tab === 'overview' && (
              <div className="space-y-8">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold text-slate-100">Monthly Commission Trend (last 6 months)</h3>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-600 inline-block" /> Commission</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-900/40 inline-block" /> Gross</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {data.revenueByMonth.map(m => (
                      <div key={m.month} className="flex items-center gap-4">
                        <div className="w-20 text-xs text-slate-500 text-right shrink-0">{m.month}</div>
                        <div className="flex-1 relative h-8">
                          <div className="absolute inset-0 bg-slate-800 rounded-full" />
                          <div className="absolute inset-y-0 left-0 bg-blue-900/40 rounded-full" style={{ width: `${(m.gross / maxMonthGross) * 100}%` }} />
                          <div className="absolute inset-y-0 left-0 bg-blue-600 rounded-full flex items-center justify-end pr-2" style={{ width: `${(m.commission / maxMonthGross) * 100}%` }}>
                            {m.commission > 0 && <span className="text-white text-xs font-medium">{fmt(m.commission)}</span>}
                          </div>
                        </div>
                        <div className="w-28 text-xs text-slate-500 shrink-0">
                          <span className="font-medium text-slate-300">{fmt(m.gross)}</span> gross
                        </div>
                        <div className="w-16 text-xs text-slate-500 shrink-0">{m.transactions} lessons</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 p-4 bg-blue-900/20 border border-blue-100 rounded-lg text-sm">
                  <div>
                    <p className="text-xs text-blue-500 mb-1">All-Time Gross (lessons)</p>
                    <p className="font-bold text-slate-100 text-lg">{fmt(data.totalGross)}</p>
                    <p className="text-xs text-slate-500">paid by students</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-500 mb-1">All-Time Instructor Payouts</p>
                    <p className="font-bold text-slate-100 text-lg">{fmt(data.totalInstructorPayouts)}</p>
                    <p className="text-xs text-slate-500">paid to instructors</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-500 mb-1">All-Time Platform Commission</p>
                    <p className="font-bold text-blue-700 text-lg">{fmt(data.totalCommission)}</p>
                    <p className="text-xs text-slate-500">net platform revenue</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-slate-100 mb-4">Top Instructors by Payout <span className="text-xs font-normal text-slate-500 ml-1">(selected period)</span></h3>
                  <div className="space-y-2">
                    {data.topInstructors.map((inst, i) => (
                      <div key={inst.id} className="flex items-center gap-4 p-3 bg-slate-800 rounded-lg">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          i === 0 ? 'bg-yellow-900/40 text-yellow-300' : i === 1 ? 'bg-slate-700 text-slate-300' : i === 2 ? 'bg-orange-900/40 text-orange-300' : 'bg-blue-900/20 text-blue-700'
                        }`}>{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <Link href={`/admin/instructors/${inst.id}`} className="font-medium text-slate-100 hover:text-blue-600 text-sm">{inst.name}</Link>
                          <p className="text-xs text-slate-500">{inst.transactionCount} lessons · {fmt(inst.grossAmount)} gross</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-100 text-sm">{fmt(inst.totalEarnings)}</p>
                          <p className="text-xs text-blue-600">fee: {fmt(inst.platformFee)}</p>
                        </div>
                      </div>
                    ))}
                    {data.topInstructors.length === 0 && <p className="text-slate-500 text-sm">No completed lessons in this period.</p>}
                  </div>
                </div>
              </div>
            )}

            {/* TRANSACTIONS */}
            {tab === 'transactions' && (
              <div>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-100">Lesson Transactions</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Booking payments only — wallet top-ups excluded</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => exportCSV(data.recentTransactions, 'transactions.csv')}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-700 rounded-lg hover:bg-slate-800 text-slate-400">
                      <Download className="h-3.5 w-3.5" /> CSV
                    </button>
                    <Link href="/admin/payouts" className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      <DollarSign className="h-3.5 w-3.5" /> Payouts
                    </Link>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-950 text-slate-500 text-xs uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">Instructor</th>
                        <th className="px-4 py-3 text-left">Student</th>
                        <th className="px-4 py-3 text-right">Lesson Fee</th>
                        <th className="px-4 py-3 text-right">Platform Commission</th>
                        <th className="px-4 py-3 text-right">Instructor Payout</th>
                        <th className="px-4 py-3 text-left">Booking</th>
                        <th className="px-4 py-3 text-left">Txn Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {data.recentTransactions.map(t => (
                        <tr key={t.id} className="hover:bg-slate-800">
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDate(t.createdAt)}</td>
                          <td className="px-4 py-3">
                            {t.booking?.instructor
                              ? <Link href={`/admin/instructors/${t.booking.instructor.id}`} className="text-slate-100 hover:text-blue-600">{t.booking.instructor.name}</Link>
                              : <span className="text-slate-500">—</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-400">{t.booking?.clientName || '—'}</td>
                          <td className="px-4 py-3 text-right font-medium text-slate-100">{fmt(t.amount)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-blue-600">{fmt(t.platformFee)}</td>
                          <td className="px-4 py-3 text-right text-slate-400">{fmt(t.instructorPayout)}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.booking?.status || ''] || 'bg-slate-800 text-slate-400'}`}>
                              {t.booking?.status || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status] || 'bg-slate-800 text-slate-400'}`}>
                              {t.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.recentTransactions.length === 0 && <p className="text-center text-slate-500 py-8">No transactions in this period.</p>}
                </div>
              </div>
            )}

            {/* REFUNDS */}
            {tab === 'refunds' && (
              <div>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-100">Refunded Transactions</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Total: {fmt(data.rangeRefunds)} · {data.rangeRefundCount} refunds in period</p>
                  </div>
                  <button onClick={() => exportCSV(data.refundedTransactions, 'refunds.csv')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-700 rounded-lg hover:bg-slate-800 text-slate-400">
                    <Download className="h-3.5 w-3.5" /> CSV
                  </button>
                </div>
                <div className="bg-blue-900/20 border border-blue-100 rounded-lg p-4 mb-4 text-sm text-blue-300 flex gap-3">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    Refunds are processed from the <Link href="/admin/payouts" className="font-medium underline">Payouts → Withheld tab</Link>.
                    Each withheld transaction can be refunded to the student wallet, paid to the instructor, or voided.
                  </div>
                </div>
                {data.refundedTransactions.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <RefreshCw className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>No refunds in this period.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-950 text-slate-500 text-xs uppercase">
                        <tr>
                          <th className="px-4 py-3 text-left">Date</th>
                          <th className="px-4 py-3 text-left">Instructor</th>
                          <th className="px-4 py-3 text-left">Student</th>
                          <th className="px-4 py-3 text-right">Amount Refunded</th>
                          <th className="px-4 py-3 text-left">Note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {data.refundedTransactions.map(t => (
                          <tr key={t.id} className="hover:bg-slate-800">
                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDate(t.createdAt)}</td>
                            <td className="px-4 py-3">
                              {t.booking?.instructor
                                ? <Link href={`/admin/instructors/${t.booking.instructor.id}`} className="text-slate-100 hover:text-blue-600">{t.booking.instructor.name}</Link>
                                : <span className="text-slate-500">—</span>}
                            </td>
                            <td className="px-4 py-3 text-slate-400">{t.booking?.clientName || '—'}</td>
                            <td className="px-4 py-3 text-right font-semibold text-red-600">{fmt(t.amount)}</td>
                            <td className="px-4 py-3 text-slate-500 text-xs max-w-xs truncate">{t.description || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* EXPORT */}
            {tab === 'reports' && (
              <div>
                <h3 className="text-base font-semibold text-slate-100 mb-1">Export Reports</h3>
                <p className="text-xs text-slate-500 mb-4">All exports use the currently selected date range.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button onClick={() => exportCSV(data.recentTransactions, 'transactions.csv')}
                    className="p-5 border-2 border-slate-700 rounded-lg hover:border-blue-500 hover:bg-blue-900/20 text-left transition-colors">
                    <FileText className="h-7 w-7 text-blue-600 mb-2" />
                    <p className="font-semibold text-slate-100">Lesson Transactions (CSV)</p>
                    <p className="text-xs text-slate-500 mt-1">Date, instructor, student, lesson fee, commission, payout, status</p>
                  </button>
                  <button onClick={() => exportCSV(data.refundedTransactions, 'refunds.csv')}
                    className="p-5 border-2 border-slate-700 rounded-lg hover:border-red-400 hover:bg-red-900/20 text-left transition-colors">
                    <RefreshCw className="h-7 w-7 text-red-500 mb-2" />
                    <p className="font-semibold text-slate-100">Refunds Report (CSV)</p>
                    <p className="text-xs text-slate-500 mt-1">All refunded transactions with notes</p>
                  </button>
                  <button onClick={() => {
                    const rows = data.revenueByMonth.map(m => ({
                      id: '', instructorId: '', amount: m.gross, platformFee: m.commission,
                      instructorPayout: m.instructorPayout, status: m.month, type: `${m.transactions} lessons`,
                      createdAt: m.month, description: '',
                    } as TxnRow));
                    exportCSV(rows, 'revenue-by-month.csv');
                  }}
                    className="p-5 border-2 border-slate-700 rounded-lg hover:border-green-500 hover:bg-green-900/20 text-left transition-colors">
                    <BarChart2 className="h-7 w-7 text-green-600 mb-2" />
                    <p className="font-semibold text-slate-100">Monthly Summary (CSV)</p>
                    <p className="text-xs text-slate-500 mt-1">Gross, commission, instructor payout, lesson count per month</p>
                  </button>
                  <button onClick={() => {
                    const rows = data.topInstructors.map(i => ({
                      id: i.id, instructorId: i.id, amount: i.grossAmount, platformFee: i.platformFee,
                      instructorPayout: i.totalEarnings, status: `${i.transactionCount} lessons`, type: 'INSTRUCTOR',
                      createdAt: '', description: i.name,
                    } as TxnRow));
                    exportCSV(rows, 'instructor-earnings.csv');
                  }}
                    className="p-5 border-2 border-slate-700 rounded-lg hover:border-purple-500 hover:bg-violet-900/20 text-left transition-colors">
                    <Users className="h-7 w-7 text-purple-600 mb-2" />
                    <p className="font-semibold text-slate-100">Instructor Earnings (CSV)</p>
                    <p className="text-xs text-slate-500 mt-1">Gross, commission, payout per instructor</p>
                  </button>
                </div>

                {/* Full database exports — server-side, complete history */}
                <div className="mt-6 border-t border-slate-800 pt-5">
                  <h4 className="text-sm font-semibold text-slate-300 mb-1">Full Database Exports</h4>
                  <p className="text-xs text-slate-500 mb-4">Complete records from the database — not limited to the current date range view. Append <code className="text-slate-400">?from=YYYY-MM-DD&to=YYYY-MM-DD</code> to filter.</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <a
                      href="/api/admin/export?type=bookings"
                      download
                      className="flex items-start gap-3 p-4 border border-slate-700 rounded-xl hover:border-sky-500/50 hover:bg-sky-950/20 transition-colors no-underline"
                    >
                      <Calendar className="h-6 w-6 text-sky-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-slate-100 text-sm">All Bookings</p>
                        <p className="text-xs text-slate-500 mt-0.5">Every platform booking — client, instructor, price, status, dates</p>
                      </div>
                    </a>
                    <a
                      href="/api/admin/export?type=revenue"
                      download
                      className="flex items-start gap-3 p-4 border border-slate-700 rounded-xl hover:border-emerald-500/50 hover:bg-emerald-950/20 transition-colors no-underline"
                    >
                      <DollarSign className="h-6 w-6 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-slate-100 text-sm">All Revenue</p>
                        <p className="text-xs text-slate-500 mt-0.5">All settled transactions — gross, platform fee, instructor payout</p>
                      </div>
                    </a>
                    <a
                      href="/api/admin/export?type=instructors"
                      download
                      className="flex items-start gap-3 p-4 border border-slate-700 rounded-xl hover:border-violet-500/50 hover:bg-violet-950/20 transition-colors no-underline"
                    >
                      <Users className="h-6 w-6 text-violet-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-slate-100 text-sm">All Instructors</p>
                        <p className="text-xs text-slate-500 mt-0.5">Roster with subscription, rating, location, Stripe status</p>
                      </div>
                    </a>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className={`rounded-lg shadow-lg px-4 py-3 text-sm text-white ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
