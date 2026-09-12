'use client';
import { AdminPageLayout } from '@/components/ui'

import { useEffect, useState } from 'react';
import AdminNav from '@/components/admin/AdminNav';
import Link from 'next/link';
import { RefreshCw, Loader2, AlertTriangle, CheckCircle, Search } from 'lucide-react';

interface SubRow {
  id: string;
  name: string;
  email: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  trialEndsAt: string | null;
  bookingCount: number;
  monthlyAmount: number | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

const TIER_BADGE: Record<string, string> = {
  BASIC:    'bg-secondary/70 text-foreground',
  PRO:      'bg-blue-900/40 text-primary',
  STUDIO:   'bg-indigo-900/40 text-indigo-300',
  PREMIUM:  'bg-violet-900/40 text-violet-300',
  };
const STATUS_COLOR: Record<string, string> = {
  ACTIVE:    'text-emerald-400',
  TRIAL:     'text-amber-400',
  PAST_DUE:  'text-destructive',
  CANCELLED: 'text-muted-foreground/60',
  SUSPENDED: 'text-orange-400',
};

const TIERS   = ['ALL', 'BASIC', 'PRO', 'STUDIO', 'PREMIUM'];
const STATUSES = ['ALL', 'ACTIVE', 'TRIAL', 'PAST_DUE', 'CANCELLED'];

export default function AdminSubscriptionsPage() {
  const [rows, setRows] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [flash, setFlash] = useState('');

  const showFlash = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(''), 3000); };

  const fetchData = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/subscriptions');
      if (r.ok) setRows(await r.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const doSync = async (providerId: string) => {
    setSyncingId(providerId);
    try {
      const r = await fetch(`/api/admin/instructors/${providerId}/subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync', reason: 'Admin force sync from subscriptions list' }),
      });
      const d = await r.json();
      if (r.ok) { showFlash(d.message || 'Synced'); await fetchData(); }
      else showFlash(d.error || 'Sync failed');
    } finally { setSyncingId(null); }
  };

  const filtered = rows.filter(r => {
    if (tierFilter !== 'ALL' && r.subscriptionTier !== tierFilter) return false;
    if (statusFilter !== 'ALL' && r.subscriptionStatus !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.name.toLowerCase().includes(q) && !r.email.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Summary counts
  const counts: Record<string, number> = {};
  rows.forEach(r => { counts[r.subscriptionStatus] = (counts[r.subscriptionStatus] || 0) + 1; });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdminPageLayout title="Subscriptions" breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'S' }]}>

      {flash && (
        <div className="fixed top-4 right-4 z-50 bg-secondary text-foreground text-sm px-4 py-2 rounded-xl shadow-lg border border-border">
          {flash}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Subscriptions</h1>
            <p className="text-sm text-muted-foreground/60 mt-1">All instructor subscription tiers and Stripe status</p>
          </div>
          <button onClick={fetchData} disabled={loading} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-secondary transition disabled:opacity-40">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Active',   key: 'ACTIVE',   color: 'text-emerald-400',  bg: 'bg-green-900/20 border-green-800' },
            { label: 'Trial',    key: 'TRIAL',    color: 'text-amber-400',  bg: 'bg-amber-900/20 border-amber-800' },
            { label: 'Past Due', key: 'PAST_DUE', color: 'text-destructive',    bg: 'bg-red-900/20 border-red-800' },
            { label: 'Cancelled',key: 'CANCELLED',color: 'text-muted-foreground/60',  bg: 'bg-secondary border-border' },
            { label: 'Total',    key: 'ALL',      color: 'text-foreground',  bg: 'bg-secondary border-border' },
          ].map(({ label, key, color, bg }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`border rounded-xl p-3 text-left transition hover:opacity-90 ${bg} ${statusFilter === key ? 'ring-2 ring-blue-500' : ''}`}
            >
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>
                {key === 'ALL' ? rows.length : (counts[key] || 0)}
              </p>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name or email…"
              className="w-full pl-9 pr-3 py-2 bg-secondary border border-border rounded-xl text-sm text-foreground placeholder-slate-500 focus:ring-2 focus:ring-primary/50" />
          </div>
          <div className="flex gap-1">
            {TIERS.map(t => (
              <button key={t} onClick={() => setTierFilter(t)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${tierFilter === t ? 'bg-primary text-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/70'}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {STATUSES.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${statusFilter === s ? 'bg-primary text-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/70'}`}>
                {s === 'PAST_DUE' ? 'PAST DUE' : s}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground/60 text-sm">No subscriptions match your filters</div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Instructor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Tier</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Period End / Trial End</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Stripe</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(row => (
                    <tr key={row.id} className="hover:bg-secondary/40 transition">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{row.name}</p>
                        <p className="text-xs text-muted-foreground">{row.email}</p>
                        <p className="text-xs text-muted-foreground">{row.bookingCount} bookings</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${TIER_BADGE[row.subscriptionTier] || 'bg-secondary/70 text-foreground'}`}>
                          {row.subscriptionTier || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${STATUS_COLOR[row.subscriptionStatus] || 'text-foreground'}`}>
                          {row.subscriptionStatus || '—'}
                        </span>
                        {row.cancelAtPeriodEnd && (
                          <p className="text-xs text-destructive mt-0.5">Cancels at period end</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {row.monthlyAmount ? `$${row.monthlyAmount}/mo` : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {row.currentPeriodEnd
                          ? new Date(row.currentPeriodEnd).toLocaleDateString('en-AU')
                          : row.trialEndsAt
                            ? <span className="text-amber-400">Trial ends {new Date(row.trialEndsAt).toLocaleDateString('en-AU')}</span>
                            : '—'
                        }
                      </td>
                      <td className="px-4 py-3">
                        {row.stripeSubscriptionId ? (
                          <div className="flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                            <span className="text-xs text-muted-foreground truncate max-w-[100px]">{row.stripeSubscriptionId}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="text-xs text-amber-400">Not linked</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/instructors/${row.id}`}
                            className="text-xs text-primary hover:text-primary hover:underline"
                          >
                            Profile →
                          </Link>
                          {row.stripeSubscriptionId && (
                            <button
                              onClick={() => doSync(row.id)}
                              disabled={syncingId === row.id}
                              title="Force sync from Stripe"
                              className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 flex items-center gap-1"
                            >
                              {syncingId === row.id
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <RefreshCw className="w-3 h-3" />
                              }
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground/60">
              Showing {filtered.length} of {rows.length} instructors
            </div>
          </div>
        )}
      </div>
    </AdminPageLayout>
    </div>
  )
}
