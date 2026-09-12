'use client';
import { AdminPageLayout } from '@/components/ui'

import { useEffect, useState } from 'react';

interface Dispute {
  id: string;
  stripeDisputeId: string;
  stripeChargeId: string;
  bookingId: string | null;
  providerId: string | null;
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
    customerName: string | null;
    customerPhone: string | null;
  } | null;
  provider: {
    id: string;
    name: string;
    phone: string;
    payoutHold: boolean;
  } | null;
}

const STATUS_STYLES: Record<string, string> = {
  needs_response: 'bg-red-900/40 text-destructive',
  warning_needs_response: 'bg-orange-900/40 text-orange-300',
  under_review: 'bg-yellow-900/40 text-yellow-300',
  charge_refunded: 'bg-blue-900/40 text-primary',
  won: 'bg-green-900/40 text-emerald-400',
  lost: 'bg-secondary text-foreground',
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
    <div className="min-h-screen bg-background text-foreground">
      <AdminPageLayout title="Disputes" breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'S' }]}>
      <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Disputes</h1>
          <p className="text-sm text-muted-foreground/60 mt-1">Stripe chargebacks and their resolution status</p>
        </div>
        {openCount > 0 && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-red-900/40 text-destructive">
            {openCount} open
          </span>
        )}
      </div>

      {actionError && (
        <div role="alert" className="mb-4 rounded-lg bg-red-900/20 border border-red-700/50 px-4 py-3 text-sm text-destructive flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="ml-3 text-destructive hover:text-foreground">✕</button>
        </div>
      )}

      {/* Filter tabs */}      <div className="flex gap-2 mb-6">
        {(['open', 'won', 'lost', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              filter === f
                ? 'bg-primary text-foreground'
                : 'bg-card text-muted-foreground border border-border hover:border-border'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg bg-red-900/20 border border-red-700/50 p-4 mb-6 text-destructive text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-muted-foreground/60">Loading disputes…</div>
      ) : disputes.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground/60">
          {filter === 'open' ? 'No open disputes — great sign.' : 'No disputes found.'}
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((d) => (
            <div
              key={d.id}
              className="bg-card rounded-xl border border-border border border-border shadow-sm p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Header row */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${STATUS_STYLES[d.status] ?? 'bg-secondary text-muted-foreground'}`}
                    >
                      {d.status.replace(/_/g, ' ')}
                    </span>
                    {d.payoutFrozen && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-900/40 text-orange-300">
                        Payout frozen
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground/60">
                      Opened {formatDate(d.createdAt)}
                    </span>
                    {d.resolvedAt && (
                      <span className="text-xs text-muted-foreground/60">
                        · Resolved {formatDate(d.resolvedAt)}
                      </span>
                    )}
                  </div>

                  {/* Amount + reason */}
                  <div className="flex flex-wrap gap-6 mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground/60">Amount at risk</p>
                      <p className="text-lg font-bold text-foreground">{formatAUD(d.amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground/60">Reason</p>
                      <p className="text-sm font-medium text-foreground capitalize">
                        {d.reason.replace(/_/g, ' ')}
                      </p>
                    </div>
                    {d.provider && (
                      <div>
                        <p className="text-xs text-muted-foreground/60">Instructor</p>
                        <p className="text-sm font-medium text-foreground">{(d as any).provider?.name}</p>
                      </div>
                    )}
                    {d.booking && (
                      <div>
                        <p className="text-xs text-muted-foreground/60">Booking</p>
                        <p className="text-sm font-medium text-foreground">
                          {d.booking.customerName ?? '—'}
                          {d.booking.startTime
                            ? ` · ${formatDate(d.booking.startTime)}`
                            : ''}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Stripe IDs */}
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground/60 font-mono">
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
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-foreground hover:border-border transition-colors"
                  >
                    View in Stripe ↗
                  </a>

                  {d.bookingId && (
                    <a
                      href={`/admin/bookings?id=${d.bookingId}`}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-foreground hover:border-border transition-colors"
                    >
                      View booking
                    </a>
                  )}

                  {/* Release hold — only show when dispute won but hold still active */}
                  {d.status === 'won' && d.payoutFrozen && d.provider && (
                    <button
                      onClick={() => releaseHold(d.stripeDisputeId)}
                      disabled={actionLoading === d.stripeDisputeId}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-foreground hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {actionLoading === d.stripeDisputeId ? 'Releasing…' : 'Release payout hold'}
                    </button>
                  )}
                </div>
              </div>

              {/* Lost dispute — adjustment notice */}
              {d.status === 'lost' && (
                <div className="mt-3 rounded-lg bg-secondary border border-border p-3 text-xs text-muted-foreground">
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
      </AdminPageLayout>
    </div>
  )
}
