'use client';

import { useEffect, useState } from 'react';
import { Calendar, Plus, Trash2, Clock, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';

interface RateChange {
  id: string;
  tier: string;
  field: string;
  currentRate: number;
  newRate: number;
  effectiveDate: string;
  reason: string;
  status: string;
  notifiedAt: string | null;
  appliedAt: string | null;
  createdAt: string;
}

const FIELD_OPTIONS = [
  { value: 'basicCommissionRate',    label: 'Basic — commission rate' },
  { value: 'proCommissionRate',      label: 'Pro & Studio — commission rate' },
  { value: 'businessCommissionRate', label: 'Business — commission rate' },
];

const STATUS_STYLE: Record<string, string> = {
  PENDING:   'bg-amber-100 text-amber-700',
  APPLIED:   'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  PENDING:   <Clock className="w-3.5 h-3.5" />,
  APPLIED:   <CheckCircle className="w-3.5 h-3.5" />,
  CANCELLED: <XCircle className="w-3.5 h-3.5" />,
};

export default function RateChangeScheduler() {
  const [changes, setChanges] = useState<RateChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    field: 'basicCommissionRate',
    newRate: '',
    effectiveDate: '',
    reason: '',
  });

  const loadChanges = async () => {
    try {
      const res = await fetch('/api/admin/rate-changes');
      if (res.ok) {
        const d = await res.json();
        setChanges(d.changes || []);
      }
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { loadChanges(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!form.newRate || !form.effectiveDate || !form.reason) {
      setError('All fields are required');
      return;
    }
    if (form.reason.length < 10) {
      setError('Reason must be at least 10 characters — instructors will see this');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/rate-changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field: form.field,
          newRate: parseFloat(form.newRate),
          effectiveDate: new Date(form.effectiveDate).toISOString(),
          reason: form.reason.trim(),
        }),
      });
      const d = await res.json();
      if (res.ok) {
        setSuccess('Rate change scheduled. Instructors will be notified on the effective date.');
        setForm({ field: 'basicCommissionRate', newRate: '', effectiveDate: '', reason: '' });
        setShowForm(false);
        loadChanges();
      } else {
        setError(d.error || 'Failed to schedule rate change');
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const cancelChange = async (id: string) => {
    if (!confirm('Cancel this scheduled rate change?')) return;
    try {
      const res = await fetch(`/api/admin/rate-changes/${id}`, { method: 'DELETE' });
      if (res.ok) loadChanges();
    } catch {}
  };

  const pendingChanges = changes.filter(c => c.status === 'PENDING');
  const pastChanges = changes.filter(c => c.status !== 'PENDING');

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-gray-900">Scheduled Rate Changes</h2>
          {pendingChanges.length > 0 && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
              {pendingChanges.length} pending
            </span>
          )}
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setError(''); setSuccess(''); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Schedule Change
        </button>
      </div>

      {/* How it works */}
      <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 text-xs text-blue-800">
        <strong>How it works:</strong> Schedule a rate change with a future effective date. On that date, the cron job automatically applies the new rate and sends an email + in-app notification to all affected instructors. Existing confirmed bookings are never affected — only new bookings from the effective date.
      </div>

      {/* Schedule form */}
      {showForm && (
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-900 mb-4">Schedule a new rate change</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Which rate</label>
                <select value={form.field} onChange={e => setForm(f => ({ ...f, field: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                  {FIELD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">New rate (%)</label>
                <input type="number" min="0" max="50" step="0.5" required
                  placeholder="e.g. 14"
                  value={form.newRate} onChange={e => setForm(f => ({ ...f, newRate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Effective date</label>
                <input type="date" required
                  min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                  value={form.effectiveDate} onChange={e => setForm(f => ({ ...f, effectiveDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                <p className="text-xs text-gray-400 mt-1">Must be at least 1 day in the future</p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Reason <span className="text-gray-400">(shown to instructors in the notification)</span>
              </label>
              <textarea required rows={3} minLength={10} maxLength={500}
                placeholder="e.g. Annual rate review — aligning with updated platform operating costs and market rates."
                value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
              <p className="text-xs text-gray-400 mt-1">{form.reason.length}/500 — min 10 characters</p>
            </div>

            {/* Warning box */}
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                Scheduling this will cancel any existing pending change for the same rate field. 
                Instructors will receive an email and in-app notification on the effective date.
              </p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}

            <div className="flex gap-3">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                Schedule Rate Change
              </button>
            </div>
          </form>
        </div>
      )}

      {success && !showForm && (
        <div className="px-6 py-3 bg-green-50 border-b border-green-100 text-sm text-green-700">{success}</div>
      )}

      {/* Pending changes */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : pendingChanges.length === 0 && pastChanges.length === 0 ? (
        <div className="px-6 py-10 text-center text-gray-400 text-sm">
          No scheduled rate changes. Use the button above to schedule one.
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {[...pendingChanges, ...pastChanges].map(change => (
            <div key={change.id} className="px-6 py-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[change.status] || STATUS_STYLE.PENDING}`}>
                    {STATUS_ICON[change.status]}
                    {change.status}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {FIELD_OPTIONS.find(o => o.value === change.field)?.label || change.field}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500">{change.currentRate}%</span>
                  <span className="text-gray-400">→</span>
                  <span className={`font-bold ${change.newRate > change.currentRate ? 'text-red-600' : 'text-green-600'}`}>
                    {change.newRate}%
                  </span>
                  <span className="text-gray-400 text-xs">
                    effective {new Date(change.effectiveDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1 italic truncate">{change.reason}</p>
                {change.appliedAt && (
                  <p className="text-xs text-green-600 mt-0.5">
                    Applied {new Date(change.appliedAt).toLocaleDateString('en-AU')}
                    {change.notifiedAt && ` · Instructors notified`}
                  </p>
                )}
              </div>
              {change.status === 'PENDING' && (
                <button onClick={() => cancelChange(change.id)}
                  className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
