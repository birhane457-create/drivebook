'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import AdminNav from '@/components/admin/AdminNav';
import { RefreshCw, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditLog {
  id: string;
  action: string;
  actorId: string;
  actorRole: string;
  targetType: string;
  targetId: string;
  success: boolean;
  errorMessage?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any> | null;
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  PAYOUT_CREATED:                       'Payout created',
  PAYOUT_PROCESSING:                    'Payout processing',
  PAYOUT_PAID:                          'Payout completed',
  PAYOUT_FAILED:                        'Payout failed',
  PAYOUT_HELD:                          'Payout held',
  PAYOUT_RELEASED:                      'Payout released',
  DISPUTE_RESOLVED_REFUND_CLIENT:       'Dispute — client refunded',
  DISPUTE_RESOLVED_APPROVE_FOR_PAYOUT:  'Dispute — approved for payout',
  DISPUTE_RESOLVED_CHARGE_INSTRUCTOR:   'Dispute — instructor charged',
  DISPUTE_RESOLVED_VOID:                'Dispute — voided',
  DISPUTE_RESOLVED_SPLIT:               'Dispute — split resolution',
  ABN_VERIFICATION_REVOKED:             'ABN revoked',
  ABN_VERIFIED:                         'ABN verified',
  INSTRUCTOR_APPROVED:                  'Instructor approved',
  INSTRUCTOR_SUSPENDED:                 'Instructor suspended',
};

const TARGET_TYPE_OPTIONS = ['PAYOUT', 'TRANSACTION', 'INSTRUCTOR', 'BOOKING'];

const ACTION_OPTIONS = Object.keys(ACTION_LABELS);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function exactTime(iso: string): string {
  // Display in browser's local timezone — admin may be anywhere in Australia
  return new Date(iso).toLocaleString('en-AU', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function entityLink(targetType: string, targetId: string): string | null {
  if (targetType === 'PAYOUT')      return '/admin/payouts';
  if (targetType === 'INSTRUCTOR')  return `/admin/instructors/${targetId}`;
  if (targetType === 'BOOKING')     return `/admin/bookings`;
  return null;
}

// ─── Row component ────────────────────────────────────────────────────────────

function LogRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const label = ACTION_LABELS[log.action] ?? log.action.replace(/_/g, ' ').toLowerCase();
  const link = entityLink(log.targetType, log.targetId);

  const statusColor = log.success
    ? 'bg-green-900/40 text-green-300'
    : 'bg-red-900/40 text-red-300';

  const actionColor =
    log.action.includes('FAILED') || log.action.includes('REVOKED') || log.action.includes('SUSPENDED')
      ? 'text-red-700'
      : log.action.includes('HELD') || log.action.includes('CHARGE')
      ? 'text-yellow-700'
      : log.action.includes('PAID') || log.action.includes('APPROVED') || log.action.includes('VERIFIED')
      ? 'text-green-700'
      : 'text-slate-200';

  const isCritical = !log.success ||
    ['PAYOUT_FAILED', 'ABN_VERIFICATION_REVOKED', 'INSTRUCTOR_SUSPENDED'].includes(log.action);

  return (
    <>
      <tr
        className={`hover:bg-slate-800 cursor-pointer transition-colors ${isCritical ? 'border-l-2 border-red-400' : ''}`}
        onClick={() => setExpanded(v => !v)}
      >
        {/* Time */}
        <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap" title={exactTime(log.createdAt)}>
          {relativeTime(log.createdAt)}
        </td>

        {/* Action */}
        <td className={`px-4 py-3 text-sm font-medium ${actionColor}`}>
          {label}
        </td>

        {/* Target */}
        <td className="px-4 py-3 text-sm text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded text-xs font-mono">
              {log.targetType}
            </span>
            <span className="font-mono text-xs text-slate-500 truncate max-w-[120px]" title={log.targetId}>
              {log.targetId.slice(-8)}
            </span>
            {link && (
              <Link
                href={link}
                onClick={e => e.stopPropagation()}
                className="text-blue-500 hover:text-blue-700"
              >
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
        </td>

        {/* Actor */}
        <td className="px-4 py-3 text-sm text-slate-500 font-mono text-xs truncate max-w-[120px]" title={log.actorId}>
          {log.actorId === 'SYSTEM' ? (
            <span className="px-1.5 py-0.5 bg-violet-900/40 text-violet-300 rounded text-xs">SYSTEM</span>
          ) : (
            log.actorId.slice(-8)
          )}
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
            {log.success ? '✓ OK' : '✗ Failed'}
          </span>
        </td>

        {/* Expand toggle */}
        <td className="px-4 py-3 text-slate-500">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </td>
      </tr>

      {/* Expanded metadata row */}
      {expanded && (
        <tr className="bg-slate-950 border-t border-slate-800">
          <td colSpan={6} className="px-4 py-3">
            <div className="text-xs space-y-1.5">
              <p className="text-slate-500 font-medium mb-2">
                {exactTime(log.createdAt)} · Actor: {log.actorId} ({log.actorRole})
              </p>
              {log.errorMessage && (
                <p className="text-red-600 font-medium">Error: {log.errorMessage}</p>
              )}
              {/* resolutionGroupId — highlight split dispute linkage */}
              {log.metadata?.resolutionGroupId && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-violet-900/40 text-violet-300 rounded text-xs font-mono font-semibold">
                    🧵 {String(log.metadata.resolutionGroupId as string)}
                  </span>
                  <span className="text-slate-500 text-xs">split resolution group</span>
                </div>
              )}
              {log.metadata && Object.keys(log.metadata).length > 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-300 overflow-x-auto">
                  {Object.entries(log.metadata).map(([k, v]) => (
                    <div key={k} className="flex gap-3">
                      <span className="text-slate-500 shrink-0 w-40">{k}</span>
                      <span className="text-slate-200">{JSON.stringify(v)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 italic">No metadata</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Quick filter presets ─────────────────────────────────────────────────────

const QUICK_FILTERS: { label: string; emoji: string; params: Record<string, string> }[] = [
  { label: 'Failed only',   emoji: '❌', params: { action: 'PAYOUT_FAILED' } },
  { label: 'Payouts',       emoji: '💸', params: { targetType: 'PAYOUT' } },
  { label: 'Disputes',      emoji: '⚖️', params: { targetType: 'TRANSACTION' } },
  { label: 'Instructors',   emoji: '👤', params: { targetType: 'INSTRUCTOR' } },
  { label: 'Last 7 days',   emoji: '📅', params: { from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16) } },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read filters from URL
  const [targetType, setTargetType] = useState(searchParams.get('targetType') ?? '');
  const [action,     setAction]     = useState(searchParams.get('action') ?? '');
  const [from,       setFrom]       = useState(searchParams.get('from') ?? '');
  const [to,         setTo]         = useState(searchParams.get('to') ?? '');

  const [logs,        setLogs]        = useState<AuditLog[]>([]);
  const [nextCursor,  setNextCursor]  = useState<string | undefined>();
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filtering,   setFiltering]   = useState(false); // quick-filter in-flight indicator

  // Sync filters → URL
  const pushParams = useCallback((overrides: Record<string, string>) => {
    const params = new URLSearchParams();
    const merged = { targetType, action, from, to, ...overrides };
    Object.entries(merged).forEach(([k, v]) => { if (v) params.set(k, v); });
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [targetType, action, from, to, pathname, router]);

  const fetchLogs = useCallback(async (cursor?: string, overrides?: Record<string, string>) => {
    cursor ? setLoadingMore(true) : setLoading(true);
    try {
      const params = new URLSearchParams();
      const tf  = overrides?.targetType  ?? targetType;
      const act = overrides?.action      ?? action;
      const fr  = overrides?.from        ?? from;
      const t   = overrides?.to          ?? to;
      if (tf)  params.set('targetType', tf);
      if (act) params.set('action', act);
      if (fr)  params.set('from', fr);
      if (t)   params.set('to', t);
      if (cursor) params.set('cursor', cursor);
      params.set('limit', '50');

      const res = await fetch(`/api/admin/audit-log?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();

      if (cursor) {
        setLogs(prev => [...prev, ...data.logs]);
      } else {
        setLogs(data.logs);
      }
      setNextCursor(data.nextCursor);
    } finally {
      cursor ? setLoadingMore(false) : setLoading(false);
    }
  }, [targetType, action, from, to]);

  // Initial load + filter changes
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Set default date range to last 24h on mount if no params
  useEffect(() => {
    if (!searchParams.get('from') && !searchParams.get('to')) {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
      setFrom(yesterday);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = () => {
    pushParams({ targetType, action, from, to });
    fetchLogs();
  };

  const applyQuickFilter = (params: Record<string, string>) => {
    const next = { targetType: '', action: '', from: '', to: '', ...params };
    setTargetType(next.targetType);
    setAction(next.action);
    setFrom(next.from);
    setTo(next.to);
    const urlParams = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => { if (v) urlParams.set(k, v); });
    router.replace(`${pathname}?${urlParams.toString()}`, { scroll: false });
    // Fetch immediately — show filtering indicator so user knows it responded
    setFiltering(true);
    fetchLogs(undefined, next).finally(() => setFiltering(false));
  };

  const clearFilters = () => {
    setTargetType(''); setAction(''); setFrom(''); setTo('');
    router.replace(pathname, { scroll: false });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-100">Audit Log</h1>
            <p className="text-slate-500 mt-1">Full history of financial and admin actions</p>
          </div>
          <button
            onClick={() => fetchLogs()}
            className="p-2 text-slate-500 hover:text-slate-400 rounded-lg hover:bg-slate-800"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Quick filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {QUICK_FILTERS.map(qf => (
            <button
              key={qf.label}
              onClick={() => applyQuickFilter(qf.params)}
              disabled={filtering}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-700 rounded-full bg-slate-900 hover:bg-slate-800 hover:border-slate-600 transition-colors text-slate-400 disabled:opacity-60"
            >
              <span>{qf.emoji}</span>
              {qf.label}
            </button>
          ))}
          {filtering && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Updating…
            </span>
          )}
        </div>

        {/* Filters */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 border border-slate-700 p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Target type */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Target type</label>
              <select
                value={targetType}
                onChange={e => setTargetType(e.target.value)}
                className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All types</option>
                {TARGET_TYPE_OPTIONS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Action */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Action</label>
              <select
                value={action}
                onChange={e => setAction(e.target.value)}
                className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All actions</option>
                {ACTION_OPTIONS.map(a => (
                  <option key={a} value={a}>{ACTION_LABELS[a]}</option>
                ))}
              </select>
            </div>

            {/* From */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
              <input
                type="datetime-local"
                value={from}
                onChange={e => setFrom(e.target.value)}
                className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* To */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
              <input
                type="datetime-local"
                value={to}
                onChange={e => setTo(e.target.value)}
                className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={applyFilters}
              className="px-4 py-2 bg-slate-950 text-white text-sm rounded-lg hover:bg-slate-900"
            >
              Apply filters
            </button>
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-sm text-slate-500 hover:text-slate-300"
            >
              Clear
            </button>
            {logs.length > 0 && (
              <span className="text-xs text-slate-500 ml-auto">{logs.length} entries loaded</span>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 border border-slate-700 overflow-hidden">
          {loading ? (
            <div className="px-4 py-12 text-center text-slate-500 text-sm">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="px-4 py-12 text-center text-slate-500 text-sm">
              No audit log entries found for the selected filters.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-800">
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Time</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Target</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actor</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {logs.map(log => (
                      <LogRow key={log.id} log={log} />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Load more */}
              {nextCursor && (
                <div className="px-4 py-4 border-t border-slate-800 text-center">
                  <button
                    onClick={() => fetchLogs(nextCursor)}
                    disabled={loadingMore}
                    className="px-5 py-2 text-sm text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-800 disabled:opacity-50"
                  >
                    {loadingMore ? 'Loading...' : 'Load more'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
