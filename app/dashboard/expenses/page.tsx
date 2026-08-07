'use client';

import { useEffect, useState } from 'react';
import { Plus, Download, AlertCircle, Loader2, Banknote, X } from 'lucide-react';
import { formatLocalDate, DEFAULT_TIMEZONE, resolveTimezone, timezoneFromState } from '@/lib/utils/timezone';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
}

interface IncomeSummary {
  // Platform (DriveBook-processed)
  platformGross: number;
  platformCommission: number;
  platformNet: number;
  // Offline (cash / bank transfer, self-reported)
  offlineTotal: number;
  offlineCount: number;
  // Combined
  combinedTotal: number;
}

interface PendingDelete {
  id: string;
  description: string;
}

const CATEGORIES: Record<string, { label: string; color: string }> = {
  FUEL_VEHICLE:  { label: 'Fuel & Vehicle',      color: 'bg-orange-950 text-orange-200' },
  INSURANCE:     { label: 'Insurance',            color: 'bg-blue-950 text-blue-200' },
  TRAINING:      { label: 'Training & Courses',   color: 'bg-purple-950 text-purple-200' },
  EQUIPMENT:     { label: 'Equipment & Supplies', color: 'bg-teal-950 text-teal-200' },
  SUBSCRIPTION:  { label: 'Subscriptions',        color: 'bg-indigo-950 text-indigo-200' },
  OTHER:         { label: 'Other',                color: 'bg-slate-800 text-slate-200' },
};

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];
const MONTHS = [
  { value: '', label: 'Full year' },
  { value: '1',  label: 'January' },  { value: '2',  label: 'February' },
  { value: '3',  label: 'March' },    { value: '4',  label: 'April' },
  { value: '5',  label: 'May' },      { value: '6',  label: 'June' },
  { value: '7',  label: 'July' },     { value: '8',  label: 'August' },
  { value: '9',  label: 'September' },{ value: '10', label: 'October' },
  { value: '11', label: 'November' }, { value: '12', label: 'December' },
];


// ── Page ──────────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const [expenses, setExpenses]       = useState<Expense[]>([]);
  const [income, setIncome]           = useState<IncomeSummary | null>(null);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [instructorTimezone, setInstructorTimezone] = useState(DEFAULT_TIMEZONE);

  // Filters
  const [year, setYear]   = useState(String(CURRENT_YEAR));
  const [month, setMonth] = useState('');

  // New expense form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'FUEL_VEHICLE',
    description: '',
    amount: '',
  });

  // Load settings once on mount — timezone doesn't change between filter selections
  useEffect(() => {
    fetch('/api/instructor/settings')
      .then(r => r.ok ? r.json() : null)
      .then(s => {
        if (s?.timezone) {
          setInstructorTimezone(resolveTimezone(s.timezone) || timezoneFromState(s.state));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => { loadData(); }, [year, month]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ year });
      if (month) params.set('month', month);

      const [expRes, earningsRes] = await Promise.all([
        fetch(`/api/instructor/expenses?${params}`),
        fetch(`/api/instructor/earnings?${params}`),
      ]);

      if (expRes.ok) {
        const d = await expRes.json();
        setExpenses(d.expenses || []);
      }

      if (earningsRes.ok) {
        const d = await earningsRes.json();
        const p = d.platform ?? {};
        const o = d.offline ?? {};

        // The earnings API scopes all queries to the requested year+month via startTime filters.
        // thisMonth* fields always reflect the requested period — even for past years.
        // totalEarnings reflects all-time regardless of period, so we never use it here.
        const platformNet   = p.thisMonthEarnings ?? 0;
        const platformGross = p.thisMonthGross ?? 0;
        const platformFees  = p.thisMonthFees ?? 0;
        const offlineTotal  = o.thisMonthLogged ?? 0;
        const offlineCount  = o.thisMonthCount ?? 0;

        setIncome({
          platformGross,
          platformCommission: platformFees,
          platformNet,
          offlineTotal,
          offlineCount,
          combinedTotal: platformNet + offlineTotal,
        });
      }
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim() || !form.amount) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/instructor/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: form.date,
          category: form.category,
          description: form.description.trim(),
          amount: parseFloat(form.amount),
        }),
      });
      const d = await res.json();
      if (res.ok) {
        setExpenses(prev => [d.expense, ...prev]);
        setForm({ date: new Date().toISOString().split('T')[0], category: 'FUEL_VEHICLE', description: '', amount: '' });
        setShowForm(false);
      } else {
        setError(d.error || 'Failed to save');
      }
    } catch {
      setError('Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (id: string, description: string) => {
    setPendingDelete({ id, description });
  };

  const executeDelete = async () => {
    if (!pendingDelete) return;
    try {
      const res = await fetch(`/api/instructor/expenses/${pendingDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        setExpenses(prev => prev.filter(e => e.id !== pendingDelete.id));
      } else {
        setError('Failed to delete');
      }
    } catch {
      setError('Failed to delete');
    } finally {
      setPendingDelete(null);
    }
  };

  const periodLabel = month
    ? `${MONTHS.find(m => m.value === month)?.label}-${year}`
    : year;

  const exportCSV = () => {
    const incomeRows = income ? [
      ['INCOME', '', '', ''],
      ['Date range', 'Category', 'Description', 'Amount (AUD)'],
      [periodLabel, 'Platform lesson income (gross)', 'Gross lesson revenue via DriveBook', income.platformGross.toFixed(2)],
      [periodLabel, 'Platform commission', 'DriveBook commission deducted', (-income.platformCommission).toFixed(2)],
      [periodLabel, 'Platform net income', 'Net received after commission', income.platformNet.toFixed(2)],
      [periodLabel, 'Offline income', `Cash/bank transfer lessons (${income.offlineCount} lessons)`, income.offlineTotal.toFixed(2)],
      [periodLabel, 'Total income', 'Platform net + offline (no commission on offline)', income.combinedTotal.toFixed(2)],
      ['', '', '', ''],
    ] : [];

    const expenseRows = [
      ['EXPENSES (self-entered)', '', '', ''],
      ['Date', 'Category', 'Description', 'Amount (AUD)'],
      ...expenses.map(exp => [
        formatLocalDate(exp.date, instructorTimezone),
        CATEGORIES[exp.category]?.label || exp.category,
        exp.description,
        (-exp.amount).toFixed(2),
      ]),
      ['', '', '', ''],
      ['', '', 'Total expenses', (-totalExpenses).toFixed(2)],
    ];

    const disclaimer = [
      [''],
      ['DISCLAIMER'],
      ['This export is a record-keeping tool only. It does not constitute financial or tax advice.'],
      ['Consult a registered tax agent (BAS agent or accountant) for advice on deductibility and tax obligations.'],
      ['Platform income figures are sourced from DriveBook transaction records. Offline income is self-reported. Expense figures are self-entered.'],
    ];

    const csv = [...incomeRows, ...expenseRows, ...disclaimer]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drivebook-records-${periodLabel}.csv`;
    document.body.appendChild(a); a.click();
    URL.revokeObjectURL(url); document.body.removeChild(a);
  };

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const byCategory = Object.entries(CATEGORIES)
    .map(([key, meta]) => ({
      key, label: meta.label, color: meta.color,
      total: expenses.filter(e => e.category === key).reduce((s, e) => s + e.amount, 0),
    }))
    .filter(c => c.total > 0);


  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">

        {/* ── Header ── */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Business Records</h1>
            <p className="text-sm text-slate-300 mt-0.5">Track your income and expenses for record-keeping</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-800 text-slate-100 text-sm rounded-lg hover:bg-slate-800">
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button onClick={() => setShowForm(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              <Plus className="h-4 w-4" /> Add Expense
            </button>
          </div>
        </div>

        {/* ── Legal disclaimer ── */}
        <div className="mb-5 bg-amber-950/60 border border-amber-800/60 rounded-xl p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-200">
            <p className="font-semibold mb-1">Record-keeping tool only</p>
            <p className="text-amber-300/80">
              This page helps you keep records of your income and expenses. It does not provide tax advice,
              calculate tax liability, or determine what is deductible. Consult a registered tax agent or
              BAS agent for advice on your tax obligations.
            </p>
          </div>
        </div>

        {/* ── Period filter ── */}
        <div className="mb-5 flex gap-3 flex-wrap items-center">
          <select value={year} onChange={e => setYear(e.target.value)}
            className="px-3 py-2 border border-slate-700 rounded-lg text-sm bg-slate-900 text-slate-100 focus:ring-2 focus:ring-sky-500 outline-none">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={month} onChange={e => setMonth(e.target.value)}
            className="px-3 py-2 border border-slate-700 rounded-lg text-sm bg-slate-900 text-slate-100 focus:ring-2 focus:ring-sky-500 outline-none">
            {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}
          {!loading && (
            <span className="text-xs text-slate-400">
              Showing: {month ? MONTHS.find(m => m.value === month)?.label + ' ' : ''}{year}
            </span>
          )}
        </div>

        {error && (
          <div className="mb-4 bg-red-950 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-300">{error}</div>
        )}

        {/* ── Add expense form ── */}
        {showForm && (
          <div className="mb-5 bg-slate-900 rounded-xl border border-slate-800 p-5">
            <h2 className="font-semibold text-slate-100 mb-4">Add Expense Record</h2>
            <form onSubmit={addExpense} className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Date</label>
                  <input type="date" required value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-700 rounded-lg text-sm bg-slate-950 text-slate-100 focus:ring-2 focus:ring-sky-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-700 rounded-lg text-sm bg-slate-950 text-slate-100 focus:ring-2 focus:ring-sky-500 outline-none">
                    {Object.entries(CATEGORIES).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                  <input type="text" required maxLength={200}
                    placeholder="e.g. Fuel for lessons — week of 12 May"
                    value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-700 rounded-lg text-sm bg-slate-950 text-slate-100 focus:ring-2 focus:ring-sky-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Amount (AUD)</label>
                  <input type="number" required min="0.01" step="0.01" max="100000" placeholder="0.00"
                    value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-700 rounded-lg text-sm bg-slate-950 text-slate-100 focus:ring-2 focus:ring-sky-500 outline-none" />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2 border border-slate-700 text-slate-300 text-sm rounded-lg hover:bg-slate-900">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Save Record
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Inline delete confirm ── */}
        {pendingDelete && (
          <div className="mb-5 bg-red-950/60 border border-red-800 rounded-xl p-4">
            <p className="text-sm font-semibold text-red-300 mb-1">Remove this expense?</p>
            <p className="text-sm text-red-400 mb-3 truncate">{pendingDelete.description}</p>
            <div className="flex gap-3">
              <button onClick={() => setPendingDelete(null)}
                className="flex-1 py-2 border border-slate-700 text-slate-300 text-sm rounded-lg hover:bg-slate-900">
                Cancel
              </button>
              <button onClick={executeDelete}
                className="flex-1 py-2 bg-red-700 text-white text-sm rounded-lg hover:bg-red-800 font-semibold">
                Yes, remove
              </button>
            </div>
          </div>
        )}

        {/* ── Summary cards ── */}
        <div className="grid sm:grid-cols-3 gap-3 mb-2">
          {/* Platform income */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Platform income</p>
            <p className="text-xl font-bold text-sky-400">${(income?.platformNet ?? 0).toFixed(2)}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Gross ${(income?.platformGross ?? 0).toFixed(2)} · Commission −${(income?.platformCommission ?? 0).toFixed(2)}
            </p>
          </div>

          {/* Offline income */}
          <div className="bg-emerald-950/30 rounded-xl border border-emerald-900/40 p-4">
            <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide flex items-center gap-1">
              <Banknote className="h-3 w-3 text-emerald-500" /> Offline income
            </p>
            <p className="text-xl font-bold text-emerald-400">${(income?.offlineTotal ?? 0).toFixed(2)}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {income?.offlineCount ?? 0} cash/bank lesson{(income?.offlineCount ?? 0) !== 1 ? 's' : ''} · no commission
            </p>
          </div>

          {/* Expenses */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Expenses</p>
            <p className="text-xl font-bold text-rose-400">−${totalExpenses.toFixed(2)}</p>
            <p className="text-xs text-slate-400 mt-0.5">{expenses.length} record{expenses.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Income minus expenses card */}
        <div className="mb-5 bg-slate-900 rounded-xl border border-slate-800 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Total income minus expenses</p>
            <p className="text-xs text-slate-400 mt-0.5">For your records only — not a tax figure</p>
          </div>
          <p className={`text-2xl font-bold ${((income?.combinedTotal ?? 0) - totalExpenses) >= 0 ? 'text-slate-100' : 'text-rose-400'}`}>
            ${((income?.combinedTotal ?? 0) - totalExpenses).toFixed(2)}
          </p>
        </div>

        {/* ── Income detail — both streams ── */}
        {income && (
          <div className="mb-5 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800">
              <h2 className="text-sm font-semibold text-slate-100">
                Income breakdown — {month ? MONTHS.find(m => m.value === month)?.label + ' ' : ''}{year}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Read-only. Platform figures come from DriveBook transaction records.</p>
            </div>

            {/* Platform stream */}
            <div className="px-4 py-3 border-b border-slate-800">
              <p className="text-xs font-bold uppercase tracking-widest text-sky-600 mb-2">
                Platform income — via DriveBook
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-300">Gross lesson revenue</span>
                  <span className="font-medium text-slate-100">${income.platformGross.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">Platform commission</span>
                  <span className="text-red-400">−${income.platformCommission.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-700 pt-1.5">
                  <span className="font-semibold text-slate-100">Net received</span>
                  <span className="font-bold text-sky-400">${income.platformNet.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Offline stream */}
            <div className="px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-2 flex items-center gap-1">
                <Banknote className="h-3 w-3" /> Offline income — cash / bank transfer
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-300">
                    Self-reported ({income.offlineCount} lesson{income.offlineCount !== 1 ? 's' : ''})
                  </span>
                  <span className="font-medium text-emerald-400">${income.offlineTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">Commission deducted</span>
                  <span className="text-slate-400">$0.00 — full amount is yours</span>
                </div>
                <div className="flex justify-between border-t border-slate-700 pt-1.5">
                  <span className="font-semibold text-slate-100">Total offline</span>
                  <span className="font-bold text-emerald-400">${income.offlineTotal.toFixed(2)}</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                ⚠ Offline income is self-reported and cannot be verified by DriveBook.
                Keep your own receipts and records for these transactions.
              </p>
            </div>
          </div>
        )}

        {/* ── Expense breakdown by category ── */}
        {byCategory.length > 0 && (
          <div className="mb-5 bg-slate-900 rounded-xl border border-slate-800 p-4">
            <h2 className="text-sm font-semibold text-slate-100 mb-3">Expenses by category</h2>
            <div className="space-y-2">
              {byCategory.map(c => (
                <div key={c.key} className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.color}`}>{c.label}</span>
                  <span className="text-sm font-semibold text-rose-400">−${c.total.toFixed(2)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-slate-800 pt-2 mt-2">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Total</span>
                <span className="text-sm font-bold text-rose-400">−${totalExpenses.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Expense list ── */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">Expense records</h2>
            <span className="text-xs text-slate-300">{expenses.length} record{expenses.length !== 1 ? 's' : ''}</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <p className="text-sm">No expense records for this period.</p>
              <button onClick={() => setShowForm(true)}
                className="mt-3 text-sm text-sky-400 hover:underline">
                Add your first expense →
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {expenses.map(exp => (
                <div key={exp.id}
                  className={`flex items-center justify-between px-4 py-3 hover:bg-slate-950/50 transition-colors ${pendingDelete?.id === exp.id ? 'bg-red-950/20' : ''}`}>
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${CATEGORIES[exp.category]?.color || 'bg-slate-700 text-slate-100'}`}>
                          {CATEGORIES[exp.category]?.label || exp.category}
                        </span>
                        <span className="text-xs text-slate-300 shrink-0">
                          {formatLocalDate(exp.date, instructorTimezone)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-100 mt-0.5 truncate">{exp.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className="text-sm font-semibold text-rose-400">−${exp.amount.toFixed(2)}</span>
                    <button
                      onClick={() => confirmDelete(exp.id, exp.description)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-red-950 rounded-lg transition-colors"
                      aria-label={`Remove expense: ${exp.description}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="mt-5 bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 space-y-1">
          <p className="font-semibold text-slate-200">About this page</p>
          <p>• <span className="text-sky-400">Platform income</span> is sourced from DriveBook transaction records and cannot be edited here.</p>
          <p>• <span className="text-emerald-400">Offline income</span> is self-reported from your offline bookings. DriveBook cannot verify these amounts.</p>
          <p>• Expense records are self-entered by you. DriveBook does not verify them.</p>
          <p>• This tool is for record-keeping only. It does not determine tax liability or deductibility.</p>
          <p>• Export your records and share them with your accountant or registered tax agent.</p>
          <p>• ATO: <a href="https://www.ato.gov.au" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">ato.gov.au</a></p>
        </div>

      </div>
    </div>
  );
}
