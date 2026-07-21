'use client';

import { useEffect, useState } from 'react';

interface Dispute {
  id: string;
  stripeDisputeId: string;
  stripeChargeId: string;
  bookingId: string | null;
  instructorId: string | null;
  amount: number;
  reason: string;
  status: string;
  payoutFrozen: boolean;
  adjustmentCreated: boolean;
  resolvedAt: string | null;
  createdAt: string;
  booking: {
    id: string;
    status: string;
    startTime: string | null;
    price: number;
    clientName: string | null;
    clientPhone: string | null;
  } | null;
  instructor: {
    id: string;
    name: string;
    phone: string;
    payoutHold: boolean;
  } | null;
}

const STATUS_STYLES: Record<string, string> = {
  needs_response: 'bg-red-900/40 text-red-300',
  warning_needs_response: 'bg-orange-900/40 text-orange-300',
  under_review: 'bg-yellow-900/40 text-yellow-300',
  charge_refunded: 'bg-blue-900/40 text-blue-300',
  won: 'bg-green-900/40 text-green-300',
  lost: 'bg-slate-800 text-slate-300',
};

const OPEN_STATUSES = new Set([
  'needs_response',
  'warning_needs_response',
  'under_review',
  'charge_refunded',
]);

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [filter, setFilter] = useState<'open' | 'won' | 'lost' | 'all'>('open');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/disputes?status=${filter}`);
      if (!res.ok) throw new Error('Failed to load disputes');
      const data = await res.json();
      setDisputes(data.disputes);
      setOpenCount(data.openCount);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filter]);

  async function releaseHold(stripeDisputeId: string) {
    setActionLoading(stripeDisputeId);
    try {
      const res = await fetch('/api/admin/disputes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stripeDisputeId, action: 'release-hold' }),
      });
      if (!res.ok) throw new Error('Failed to release hold');
      await load();
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setActionLoading(null);
    }
  }

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const formatAUD = (n: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Disputes</h1>
          <p className="text-sm text-slate-500 mt-1">Stripe chargebacks and their resolution status</p>
        </div>
        {openCount > 0 && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-red-900/40 text-red-300">
            {openCount} open
          </span>
        )}
      </div>

      {actionError && (
        <div role="alert" className="mb-4 rounded-lg bg-red-900/20 border border-red-700/50 px-4 py-3 text-sm text-red-300 flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="ml-3 text-red-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Filter tabs */}      <div className="flex gap-2 mb-6">
        {(['open', 'won', 'lost', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-slate-900 text-slate-400 border border-slate-700 hover:border-slate-600'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg bg-red-900/20 border border-red-700/50 p-4 mb-6 text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-500">Loading disputes…</div>
      ) : disputes.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          {filter === 'open' ? 'No open disputes — great sign.' : 'No disputes found.'}
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((d) => (
            <div
              key={d.id}
              className="bg-slate-900 rounded-xl border border-slate-800 border border-slate-700 shadow-sm p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Header row */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${STATUS_STYLES[d.status] ?? 'bg-slate-800 text-slate-400'}`}
                    >
                      {d.status.replace(/_/g, ' ')}
                    </span>
                    {d.payoutFrozen && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-900/40 text-orange-300">
                        Payout frozen
                      </span>
                    )}
                    <span className="text-xs text-slate-500">
                      Opened {formatDate(d.createdAt)}
                    </span>
                    {d.resolvedAt && (
                      <span className="text-xs text-slate-500">
                        · Resolved {formatDate(d.resolvedAt)}
                      </span>
                    )}
                  </div>

                  {/* Amount + reason */}
                  <div className="flex flex-wrap gap-6 mb-3">
                    <div>
                      <p className="text-xs text-slate-500">Amount at risk</p>
                      <p className="text-lg font-bold text-slate-100">{formatAUD(d.amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Reason</p>
                      <p className="text-sm font-medium text-slate-200 capitalize">
                        {d.reason.replace(/_/g, ' ')}
                      </p>
                    </div>
                    {d.instructor && (
                      <div>
                        <p className="text-xs text-slate-500">Instructor</p>
                        <p className="text-sm font-medium text-slate-200">{d.instructor.name}</p>
                      </div>
                    )}
                    {d.booking && (
                      <div>
                        <p className="text-xs text-slate-500">Booking</p>
                        <p className="text-sm font-medium text-slate-200">
                          {d.booking.clientName ?? '—'}
                          {d.booking.startTime
                            ? ` · ${formatDate(d.booking.startTime)}`
                            : ''}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Stripe IDs */}
                  <div className="flex flex-wrap gap-4 text-xs text-slate-500 font-mono">
                    <span>Dispute: {d.stripeDisputeId}</span>
                    <span>Charge: {d.stripeChargeId}</span>
                    {d.bookingId && <span>Booking: {d.bookingId}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 shrink-0">
                  <a
                    href={`https://dashboard.stripe.com/disputes/${d.stripeDisputeId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700 text-slate-300 hover:border-slate-600 transition-colors"
                  >
                    View in Stripe ↗
                  </a>

                  {d.bookingId && (
                    <a
                      href={`/admin/bookings?id=${d.bookingId}`}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700 text-slate-300 hover:border-slate-600 transition-colors"
                    >
                      View booking
                    </a>
                  )}

                  {/* Release hold — only show when dispute won but hold still active */}
                  {d.status === 'won' && d.payoutFrozen && d.instructor && (
                    <button
                      onClick={() => releaseHold(d.stripeDisputeId)}
                      disabled={actionLoading === d.stripeDisputeId}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {actionLoading === d.stripeDisputeId ? 'Releasing…' : 'Release payout hold'}
                    </button>
                  )}
                </div>
              </div>

              {/* Lost dispute — adjustment notice */}
              {d.status === 'lost' && (
                <div className="mt-3 rounded-lg bg-slate-800 border border-slate-700 p-3 text-xs text-slate-400">
                  {d.adjustmentCreated
                    ? '✓ Recovery adjustment created — will be deducted from instructor\'s next payout.'
                    : '⚠ No recovery adjustment found — check if instructor was already paid out for this booking.'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
