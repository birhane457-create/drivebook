'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Download, AlertCircle, Loader2, ChevronDown } from 'lucide-react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
}

interface IncomeSummary {
  grossRevenue: number;
  commission: number;
  netEarnings: number;
}

const CATEGORIES: Record<string, { label: string; color: string }> = {
  FUEL_VEHICLE:  { label: 'Fuel & Vehicle',     color: 'bg-orange-100 text-orange-700' },
  INSURANCE:     { label: 'Insurance',           color: 'bg-blue-100 text-blue-700' },
  TRAINING:      { label: 'Training & Courses',  color: 'bg-purple-100 text-purple-700' },
  EQUIPMENT:     { label: 'Equipment & Supplies',color: 'bg-teal-100 text-teal-700' },
  SUBSCRIPTION:  { label: 'Subscriptions',       color: 'bg-indigo-100 text-indigo-700' },
  OTHER:         { label: 'Other',               color: 'bg-gray-100 text-gray-700' },
};

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];
const MONTHS = [
  { value: '', label: 'Full year' },
  { value: '1', label: 'January' }, { value: '2', label: 'February' },
  { value: '3', label: 'March' },   { value: '4', label: 'April' },
  { value: '5', label: 'May' },     { value: '6', label: 'June' },
  { value: '7', label: 'July' },    { value: '8', label: 'August' },
  { value: '9', label: 'September' },{ value: '10', label: 'October' },
  { value: '11', label: 'November' },{ value: '12', label: 'December' },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [income, setIncome] = useState<IncomeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [month, setMonth] = useState('');

  // New expense form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'FUEL_VEHICLE',
    description: '',
    amount: '',
  });

  useEffect(() => {
    loadData();
  }, [year, month]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch expenses and income in parallel
      const params = new URLSearchParams({ year });
      if (month) params.set('month', month);

      // Income: use analytics API with matching period
      const incomePeriod = month ? 'month' : 'year';
      const [expRes, incRes] = await Promise.all([
        fetch(`/api/instructor/expenses?${params}`),
        fetch(`/api/analytics?period=${incomePeriod}`),
      ]);

      if (expRes.ok) {
        const d = await expRes.json();
        setExpenses(d.expenses || []);
      }
      if (incRes.ok) {
        const d = await incRes.json();
        setIncome({
          grossRevenue: d.grossRevenue ?? 0,
          commission: d.commission ?? 0,
          netEarnings: d.netEarnings ?? 0,
        });
      }
    } catch (e) {
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

  const deleteExpense = async (id: string) => {
    if (!confirm('Remove this expense record?')) return;
    try {
      const res = await fetch(`/api/instructor/expenses/${id}`, { method: 'DELETE' });
      if (res.ok) setExpenses(prev => prev.filter(e => e.id !== id));
    } catch {
      setError('Failed to delete');
    }
  };

  const exportCSV = () => {
    const periodLabel = month
      ? `${MONTHS.find(m => m.value === month)?.label}-${year}`
      : year;

    // Income rows
    const incomeRows = income ? [
      ['INCOME', '', '', ''],
      ['Date range', 'Category', 'Description', 'Amount (AUD)'],
      [periodLabel, 'Lesson income (gross)', 'Gross lesson revenue from DriveBook', income.grossRevenue.toFixed(2)],
      [periodLabel, 'Platform commission', 'DriveBook commission deducted', (-income.commission).toFixed(2)],
      [periodLabel, 'Net lesson income', 'Net received after commission', income.netEarnings.toFixed(2)],
      ['', '', '', ''],
    ] : [];

    // Expense rows
    const expenseRows = [
      ['EXPENSES (self-entered)', '', '', ''],
      ['Date', 'Category', 'Description', 'Amount (AUD)'],
      ...expenses.map(exp => [
        new Date(exp.date).toLocaleDateString('en-AU'),
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
      ['Income figures are sourced from DriveBook platform records. Expense figures are self-entered by the instructor.'],
    ];

    const allRows = [...incomeRows, ...expenseRows, ...disclaimer];
    const csv = allRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drivebook-records-${periodLabel}.csv`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  const byCategory = Object.entries(CATEGORIES).map(([key, meta]) => ({
    key,
    label: meta.label,
    color: meta.color,
    total: expenses.filter(e => e.category === key).reduce((s, e) => s + e.amount, 0),
  })).filter(c => c.total > 0);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Business Records</h1>
            <p className="text-sm text-gray-500 mt-0.5">Track your income and expenses for record-keeping</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 shadow-sm">
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button onClick={() => setShowForm(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 shadow-sm">
              <Plus className="h-4 w-4" /> Add Expense
            </button>
          </div>
        </div>

        {/* Legal disclaimer — always visible */}
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold mb-1">Record-keeping tool only</p>
            <p>This page helps you keep records of your income and expenses. It does not provide tax advice, calculate tax liability, or determine what is deductible. Consult a registered tax agent or BAS agent for advice on your tax obligations.</p>
          </div>
        </div>

        {/* Period filter */}
        <div className="mb-5 flex gap-3 flex-wrap">
          <select value={year} onChange={e => setYear(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={month} onChange={e => setMonth(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
            {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          {loading && <Loader2 className="h-5 w-5 animate-spin text-gray-400 self-center" />}
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Add expense form */}
        {showForm && (
          <div className="mb-5 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Add Expense Record</h2>
            <form onSubmit={addExpense} className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                  <input type="date" required value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                    {Object.entries(CATEGORIES).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                  <input type="text" required maxLength={200} placeholder="e.g. Fuel for lessons — week of 12 May"
                    value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Amount (AUD)</label>
                  <input type="number" required min="0.01" step="0.01" max="100000" placeholder="0.00"
                    value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50">
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

        {/* Summary cards */}
        <div className="grid sm:grid-cols-3 gap-3 mb-5">
          {/* Income from DriveBook */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">Income (DriveBook)</p>
            <p className="text-xl font-bold text-green-600">${(income?.netEarnings ?? 0).toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Gross ${(income?.grossRevenue ?? 0).toFixed(2)} · Commission -${(income?.commission ?? 0).toFixed(2)}
            </p>
          </div>

          {/* Expenses */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">Expenses (self-entered)</p>
            <p className="text-xl font-bold text-red-500">-${totalExpenses.toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{expenses.length} record{expenses.length !== 1 ? 's' : ''}</p>
          </div>

          {/* Difference — labelled carefully, no "profit" or "tax" language */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">Income minus expenses</p>
            <p className={`text-xl font-bold ${(income?.netEarnings ?? 0) - totalExpenses >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
              ${((income?.netEarnings ?? 0) - totalExpenses).toFixed(2)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">For your records only</p>
          </div>
        </div>

        {/* Expense breakdown by category */}
        {byCategory.length > 0 && (
          <div className="mb-5 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Expenses by category</h2>
            <div className="space-y-2">
              {byCategory.map(c => (
                <div key={c.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.color}`}>{c.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">${c.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Income detail — read-only, from DriveBook */}
        {income && (
          <div className="mb-5 bg-green-50 border border-green-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-green-900 mb-2">Income from DriveBook — {month ? MONTHS.find(m => m.value === month)?.label + ' ' : ''}{year}</h2>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-green-800">Gross lesson revenue</span><span className="font-semibold text-green-900">${income.grossRevenue.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-green-800">Platform commission</span><span className="text-red-600">-${income.commission.toFixed(2)}</span></div>
              <div className="flex justify-between border-t border-green-200 pt-1 mt-1"><span className="font-semibold text-green-900">Net received</span><span className="font-bold text-green-700">${income.netEarnings.toFixed(2)}</span></div>
            </div>
            <p className="text-xs text-green-700 mt-2">
              Income figures are from DriveBook platform records only. If you have income from other sources, record those separately.
            </p>
          </div>
        )}

        {/* Expense list */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Expense records</h2>
            <span className="text-xs text-gray-400">{expenses.length} record{expenses.length !== 1 ? 's' : ''}</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <p className="text-sm">No expense records for this period.</p>
              <button onClick={() => setShowForm(true)}
                className="mt-3 text-sm text-blue-600 hover:underline">
                Add your first expense →
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {expenses.map(exp => (
                <div key={exp.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${CATEGORIES[exp.category]?.color || 'bg-gray-100 text-gray-700'}`}>
                          {CATEGORIES[exp.category]?.label || exp.category}
                        </span>
                        <span className="text-xs text-gray-400 shrink-0">
                          {new Date(exp.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 mt-0.5 truncate">{exp.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className="text-sm font-semibold text-red-500">-${exp.amount.toFixed(2)}</span>
                    <button onClick={() => deleteExpense(exp.id)}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer disclaimer */}
        <div className="mt-5 bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-500 space-y-1">
          <p className="font-semibold text-gray-600">About this page</p>
          <p>• Income figures are sourced directly from DriveBook platform records and cannot be edited here.</p>
          <p>• Expense records are self-entered by you. DriveBook does not verify them.</p>
          <p>• This tool is for your own record-keeping. It does not determine tax liability or deductibility.</p>
          <p>• Export your records and share them with your accountant or registered tax agent.</p>
          <p>• For tax advice, contact a registered tax agent or the ATO: <a href="https://www.ato.gov.au" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">ato.gov.au</a></p>
        </div>

      </div>
    </div>
  );
}
