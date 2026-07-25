'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminNav from '@/components/admin/AdminNav';
import Link from 'next/link';
import { RefreshCw, ShieldOff, Zap, Link2, Trash2, AlertTriangle, CheckCircle, Loader2, X } from 'lucide-react';

interface InstructorData {
  id: string;
  name: string;
  phone: string;
  email?: string;
  bio: string | null;
  profileImage: string | null;
  approvalStatus: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  hourlyRate: number;
  abn: string | null;
  abnVerified: boolean;
  abnStatus: string | null;
  withholdingTaxRate: number;
  payoutMethod: string;
  licenseNumber: string | null;
  licenseExpiry: Date | null;
  insuranceNumber: string | null;
  insuranceExpiry: Date | null;
  policeCheckExpiry: Date | null;
  wwcCheckExpiry: Date | null;
  licenseImageFront: string | null;
  licenseImageBack: string | null;
  insurancePolicyDoc: string | null;
  policeCheckDoc: string | null;
  wwcCheckDoc: string | null;
  averageRating: number | null;
  totalReviews: number;
  isActive: boolean;
  createdAt: Date;
  user: { email: string; createdAt?: string | null; termsAcceptedAt?: string | null } | null;
  stripeAccountId?: string | null;
  stripeConnectStatus?: 'connected' | 'not_connected';
  _count: { bookings: number };
  bookings: any[];
}

interface SubData {
  instructor: {
    subscriptionTier: string;
    subscriptionStatus: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    trialEndsAt: string | null;
    email: string;
  };
  subscriptions: Array<{
    id: string;
    tier: string;
    status: string;
    monthlyAmount: number;
    billingCycle: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
    cancelAtPeriodEnd: boolean;
    cancelledAt: string | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    createdAt: string;
  }>;
  stripeData: {
    id: string;
    status: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    trialEnd: string | null;
    priceId: string;
    amount: number;
    interval: string;
    metadata: Record<string, string>;
    latestInvoice: { id: string; status: string; amountPaid: number; created: string; hostedUrl: string } | null;
  } | null;
  stripeError: string | null;
  drift: string[];
}

// ── Subscription Tab ──────────────────────────────────────────────────────────
function SubscriptionTab({ instructorId }: { instructorId: string }) {
  const [data, setData] = useState<SubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Override form
  const [overrideTier, setOverrideTier] = useState('');
  const [overrideStatus, setOverrideStatus] = useState('ACTIVE');
  const [overrideReason, setOverrideReason] = useState('');

  // Link Stripe sub form
  const [linkSubId, setLinkSubId] = useState('');
  const [linkRowId, setLinkRowId] = useState('');

  // Cancel confirm
  const [cancelConfirm, setCancelConfirm] = useState<null | 'period_end' | 'immediately'>(null);
  const [cancelReason, setCancelReason] = useState('');

  // C-08 fix: inline confirm for subscription row deletion — replaces window.confirm()
  const [deleteRowConfirm, setDeleteRowConfirm] = useState<string | null>(null);

  const fetchSub = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/instructors/${instructorId}/subscription`);
      if (r.ok) setData(await r.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchSub(); }, [instructorId]);

  const doAction = async (action: string, extra: Record<string, any> = {}, reason?: string) => {
    setActionLoading(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/instructors/${instructorId}/subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: reason || overrideReason || 'Admin action', ...extra }),
      });
      const d = await r.json();
      if (r.ok) {
        setMsg({ type: 'ok', text: d.message || 'Done' });
        await fetchSub();
      } else {
        setMsg({ type: 'err', text: d.error || 'Action failed' });
      }
    } catch { setMsg({ type: 'err', text: 'Network error' }); }
    finally { setActionLoading(false); setCancelConfirm(null); }
  };

  const tierColor: Record<string, string> = {
    BASIC: 'bg-slate-700 text-slate-200',
    PRO: 'bg-blue-900/40 text-blue-300',
    STUDIO: 'bg-indigo-900/40 text-indigo-300',
    BUSINESS: 'bg-violet-900/40 text-violet-300',
  };
  const statusColor: Record<string, string> = {
    ACTIVE: 'text-green-400',
    TRIAL: 'text-amber-400',
    PAST_DUE: 'text-red-400',
    CANCELLED: 'text-slate-500',
    SUSPENDED: 'text-orange-400',
  };

  if (loading) return <div className="flex items-center gap-2 py-8 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading subscription data…</div>;
  if (!data) return <p className="text-red-400 py-4">Failed to load subscription data.</p>;

  const { instructor: sub, subscriptions, stripeData, stripeError, drift } = data;

  return (
    <div className="space-y-5">
      {msg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${msg.type === 'ok' ? 'bg-green-900/30 border border-green-700 text-green-300' : 'bg-red-900/30 border border-red-700 text-red-300'}`}>
          {msg.type === 'ok' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {msg.text}
          <button onClick={() => setMsg(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* ── Current state ───────────────────────────────── */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* DB state */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-3">Database State</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Tier</span>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${tierColor[sub.subscriptionTier] || 'bg-slate-700 text-slate-200'}`}>
                {sub.subscriptionTier || '—'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Status</span>
              <span className={`font-semibold ${statusColor[sub.subscriptionStatus] || 'text-slate-300'}`}>
                {sub.subscriptionStatus || '—'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Trial ends</span>
              <span className="text-slate-300">{sub.trialEndsAt ? new Date(sub.trialEndsAt).toLocaleDateString('en-AU') : '—'}</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-slate-400">Stripe Customer</span>
              <span className="text-slate-300 text-xs break-all text-right max-w-[55%]">{sub.stripeCustomerId || <span className="text-amber-400">Not linked</span>}</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-slate-400">Stripe Sub ID</span>
              <span className="text-slate-300 text-xs break-all text-right max-w-[55%]">{sub.stripeSubscriptionId || <span className="text-amber-400">Not linked</span>}</span>
            </div>
          </div>
        </div>

        {/* Live Stripe state */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Live Stripe State</p>
            <button onClick={fetchSub} className="text-blue-400 hover:text-blue-300">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          {stripeError ? (
            <p className="text-amber-400 text-sm">{stripeError}</p>
          ) : stripeData ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Status</span><span className={`font-semibold ${stripeData.status === 'active' ? 'text-green-400' : 'text-amber-400'}`}>{stripeData.status}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Amount</span><span className="text-slate-300">${stripeData.amount}/{stripeData.interval}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Period ends</span><span className="text-slate-300">{new Date(stripeData.currentPeriodEnd).toLocaleDateString('en-AU')}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Cancel at end</span><span className={stripeData.cancelAtPeriodEnd ? 'text-red-400' : 'text-slate-400'}>{stripeData.cancelAtPeriodEnd ? 'Yes' : 'No'}</span></div>
              {stripeData.latestInvoice && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Last invoice</span>
                  <a href={stripeData.latestInvoice.hostedUrl} target="_blank" rel="noopener noreferrer"
                    className="text-blue-400 hover:underline text-xs">
                    ${stripeData.latestInvoice.amountPaid} ({stripeData.latestInvoice.status}) →
                  </a>
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">No Stripe subscription linked</p>
          )}
        </div>
      </div>

      {/* Drift warning */}
      {drift.length > 0 && (
        <div className="bg-amber-900/20 border border-amber-700 rounded-xl px-4 py-3 text-sm">
          <p className="text-amber-300 font-semibold mb-1">⚠ DB / Stripe Drift Detected</p>
          {drift.map((d, i) => <p key={i} className="text-amber-400 text-xs">{d}</p>)}
          <button onClick={() => doAction('sync')} disabled={actionLoading}
            className="mt-2 flex items-center gap-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg">
            {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Fix now — Force Sync
          </button>
        </div>
      )}

      {/* ── Actions ─────────────────────────────────────── */}
      <div className="grid sm:grid-cols-3 gap-4">
        {/* Force sync */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p className="text-sm font-semibold text-slate-100 mb-1 flex items-center gap-1.5"><RefreshCw className="w-4 h-4 text-blue-400" /> Force Sync</p>
          <p className="text-xs text-slate-400 mb-3">Pull live Stripe state into DB. Fixes drift after portal changes.</p>
          <button onClick={() => doAction('sync')} disabled={actionLoading || !sub.stripeSubscriptionId}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg disabled:opacity-40 flex items-center justify-center gap-1.5">
            {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Sync from Stripe
          </button>
          {!sub.stripeSubscriptionId && <p className="text-xs text-amber-400 mt-1.5">Requires linked Stripe subscription ID</p>}
        </div>

        {/* Cancel at period end */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p className="text-sm font-semibold text-slate-100 mb-1 flex items-center gap-1.5"><ShieldOff className="w-4 h-4 text-amber-400" /> Cancel Subscription</p>
          <p className="text-xs text-slate-400 mb-3">Set to cancel at end of current billing period, or cancel immediately.</p>
          <div className="flex gap-1.5">
            <button onClick={() => setCancelConfirm('period_end')} disabled={actionLoading || !sub.stripeSubscriptionId}
              className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded-lg disabled:opacity-40">
              At period end
            </button>
            <button onClick={() => setCancelConfirm('immediately')} disabled={actionLoading || !sub.stripeSubscriptionId}
              className="flex-1 py-2 bg-red-700 hover:bg-red-800 text-white text-xs rounded-lg disabled:opacity-40">
              Immediately
            </button>
          </div>
        </div>

        {/* Link Stripe sub */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p className="text-sm font-semibold text-slate-100 mb-1 flex items-center gap-1.5"><Link2 className="w-4 h-4 text-purple-400" /> Link Stripe Sub</p>
          <p className="text-xs text-slate-400 mb-3">Manually link a Stripe subscription ID (fixes missing stripeSubscriptionId).</p>
          <input value={linkSubId} onChange={e => setLinkSubId(e.target.value.trim())}
            placeholder="sub_1Xxx…"
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-slate-100 mb-1.5 placeholder-slate-500" />
          <button onClick={() => doAction('link_stripe_sub', { stripeSubscriptionId: linkSubId, subscriptionRowId: linkRowId || undefined })}
            disabled={actionLoading || !linkSubId}
            className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded-lg disabled:opacity-40 flex items-center justify-center gap-1.5">
            {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Link
          </button>
        </div>
      </div>

      {/* Override tier */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <p className="text-sm font-semibold text-slate-100 mb-1 flex items-center gap-1.5"><Zap className="w-4 h-4 text-yellow-400" /> Override Tier / Status</p>
        <p className="text-xs text-slate-400 mb-3">Manually set the instructor's subscription tier and status. Does not touch Stripe — use for trial extensions, promotional access, or data correction.</p>
        <div className="grid sm:grid-cols-4 gap-2 items-end">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Tier</label>
            <select value={overrideTier} onChange={e => setOverrideTier(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-slate-100">
              <option value="">— select —</option>
              <option value="BASIC">BASIC</option>
              <option value="PRO">PRO</option>
              <option value="STUDIO">STUDIO</option>
              <option value="BUSINESS">BUSINESS</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Status</label>
            <select value={overrideStatus} onChange={e => setOverrideStatus(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-slate-100">
              <option value="ACTIVE">ACTIVE</option>
              <option value="TRIAL">TRIAL</option>
              <option value="PAST_DUE">PAST_DUE</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="SUSPENDED">SUSPENDED</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-400 mb-1">Reason (required)</label>
            <input value={overrideReason} onChange={e => setOverrideReason(e.target.value)}
              placeholder="e.g. trial extension, data correction…"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-slate-100 placeholder-slate-500" />
          </div>
        </div>
        <button
          onClick={() => doAction('override_tier', { tier: overrideTier, status: overrideStatus }, overrideReason)}
          disabled={actionLoading || !overrideTier || overrideReason.length < 5}
          className="mt-3 flex items-center gap-1.5 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded-lg disabled:opacity-40">
          {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />} Apply Override
        </button>
        <p className="text-xs text-slate-500 mt-1.5">⚠ This bypasses Stripe — use only for operational corrections. All overrides are audit-logged.</p>
      </div>

      {/* Subscription history rows */}
      <div className="bg-slate-800 rounded-xl border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-wide px-4 py-3 border-b border-slate-700 font-semibold">Subscription Rows ({subscriptions.length})</p>
        {subscriptions.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-6">No subscription rows</p>
        ) : (
          <div className="divide-y divide-slate-700">
            {subscriptions.map(row => (
              <div key={row.id} className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="text-xs space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-1.5 py-0.5 rounded font-bold ${tierColor[row.tier] || 'bg-slate-700 text-slate-200'}`}>{row.tier}</span>
                    <span className={`font-semibold ${statusColor[row.status] || 'text-slate-300'}`}>{row.status}</span>
                    <span className="text-slate-400">${row.monthlyAmount}/{row.billingCycle}</span>
                    {row.cancelAtPeriodEnd && <span className="text-red-400 font-medium">Cancels at period end</span>}
                  </div>
                  <p className="text-slate-500">
                    {row.currentPeriodEnd ? `Period ends ${new Date(row.currentPeriodEnd).toLocaleDateString('en-AU')}` : 'No period date'}
                    {' · '}Created {new Date(row.createdAt).toLocaleDateString('en-AU')}
                  </p>
                  <p className="text-slate-500 break-all">
                    {row.stripeSubscriptionId
                      ? <span className="text-slate-400">{row.stripeSubscriptionId}</span>
                      : <span className="text-amber-400">No Stripe sub ID</span>
                    }
                  </p>
                </div>
                {subscriptions.length > 1 && (
                  <button
                    onClick={() => setDeleteRowConfirm(row.id)}
                    disabled={actionLoading}
                    title="Delete duplicate row"
                    className="shrink-0 p-1.5 text-red-500 hover:bg-red-900/30 rounded-lg disabled:opacity-40">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete subscription row inline confirm — replaces window.confirm() */}
      {deleteRowConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-slate-100 mb-2">Delete subscription row?</h3>
            <p className="text-sm text-slate-400 mb-4">
              Row <span className="font-mono text-slate-300 text-xs">{deleteRowConfirm.slice(-8)}</span> will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteRowConfirm(null)}
                className="flex-1 py-2 border border-slate-700 text-sm rounded-lg hover:bg-slate-800 text-slate-300">
                Cancel
              </button>
              <button
                onClick={() => {
                  doAction('delete_subscription_row', { subscriptionRowId: deleteRowConfirm });
                  setDeleteRowConfirm(null);
                }}
                disabled={actionLoading}
                className="flex-1 py-2 bg-red-700 hover:bg-red-800 text-white text-sm rounded-lg font-semibold disabled:opacity-40">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel confirm modal */}
      {cancelConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-slate-100 mb-2">
              {cancelConfirm === 'immediately' ? 'Cancel Immediately?' : 'Cancel at Period End?'}
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              {cancelConfirm === 'immediately'
                ? 'This will cancel the Stripe subscription right now. The instructor loses access immediately. This cannot be undone.'
                : 'The instructor keeps access until end of current billing period, then it cancels.'
              }
            </p>
            <input value={cancelReason} onChange={e => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation (required)…"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 mb-4 placeholder-slate-500" />
            <div className="flex gap-2">
              <button onClick={() => setCancelConfirm(null)} className="flex-1 py-2 border border-slate-700 text-sm rounded-lg hover:bg-slate-800 text-slate-300">
                Cancel
              </button>
              <button
                onClick={() => doAction(cancelConfirm === 'immediately' ? 'cancel_immediately' : 'cancel', {}, cancelReason)}
                disabled={actionLoading || cancelReason.length < 5}
                className={`flex-1 py-2 text-sm rounded-lg text-white font-semibold disabled:opacity-40 flex items-center justify-center gap-1.5
                  ${cancelConfirm === 'immediately' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminInstructorProfilePage() {
  const router = useRouter();
  const params = useParams();
  const instructorId = params.id as string;
  
  const [instructor, setInstructor] = useState<InstructorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'subscription' | 'bookings' | 'documents'>('overview');

  useEffect(() => {
    fetchInstructor();
  }, [instructorId]);

  const fetchInstructor = async () => {
    try {
      const res = await fetch(`/api/admin/instructors/${instructorId}`);
      if (res.ok) {
        const data = await res.json();
        setInstructor(data);
      } else if (res.status === 401 || res.status === 403) {
        router.push('/login');
      } else {
        router.push('/admin/instructors');
      }
    } catch (error) {
      console.error('Failed to fetch instructor:', error);
      router.push('/admin/instructors');
    } finally {
      setLoading(false);
    }
  };

  const getDocStatus = (expiry: Date | null, docUrl: string | null) => {
    if (!expiry || !docUrl) return { status: 'expired', label: 'Missing', color: 'text-red-600', icon: '🔴' };
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiryDate = new Date(expiry);
    if (expiryDate < now) return { status: 'expired', label: 'Expired', color: 'text-red-600', icon: '🔴' };
    if (expiryDate < thirtyDaysFromNow) return { status: 'expiring', label: 'Expiring Soon', color: 'text-yellow-600', icon: '🟡' };
    return { status: 'valid', label: 'Valid', color: 'text-green-600', icon: '🟢' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <AdminNav />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <p>Loading instructor profile...</p>
        </div>
      </div>
    );
  }

  if (!instructor) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <AdminNav />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-6 text-center">
            <h1 className="text-2xl font-bold text-slate-100 mb-4">Instructor Not Found</h1>
            <Link href="/admin/instructors" className="text-blue-600 hover:text-blue-300">
              Back to Instructors
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const licenseStatus = getDocStatus(instructor.licenseExpiry, instructor.licenseImageFront);
  const insuranceStatus = getDocStatus(instructor.insuranceExpiry, instructor.insurancePolicyDoc);
  const policeStatus = getDocStatus(instructor.policeCheckExpiry, instructor.policeCheckDoc);
  const wwcStatus = getDocStatus(instructor.wwcCheckExpiry, instructor.wwcCheckDoc);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Back Button */}
        <Link 
          href="/admin/instructors"
          className="inline-flex items-center text-blue-600 hover:text-blue-300 mb-4"
        >
          ← Back to Instructors
        </Link>

        {/* Profile Header */}
        <div className="bg-slate-900 rounded-lg border border-slate-800 mb-6">
          <div className="p-6">
            <div className="flex items-start gap-6">
              {instructor.profileImage ? (
                <img
                  src={instructor.profileImage}
                  alt={instructor.name}
                  className="h-24 w-24 rounded-full object-cover"
                />
              ) : (
                <div className="h-24 w-24 rounded-full bg-slate-800 flex items-center justify-center">
                  <span className="text-slate-400 text-3xl font-medium">
                    {instructor.name.charAt(0)}
                  </span>
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h1 className="text-3xl font-bold text-slate-100">{instructor.name}</h1>
                  <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                    instructor.approvalStatus === 'APPROVED' ? 'bg-green-900/40 text-green-300' :
                    instructor.approvalStatus === 'PENDING' ? 'bg-yellow-900/40 text-yellow-300' :
                    instructor.approvalStatus === 'REJECTED' ? 'bg-red-900/40 text-red-300' :
                    'bg-slate-900 text-slate-200'
                  }`}>
                    {instructor.approvalStatus}
                  </span>
                </div>
                <div className="space-y-1 text-slate-400">
                  <p>📧 {instructor.user?.email || instructor.email || 'No email'}</p>
                  <p>📞 {instructor.phone}</p>
                  <p>🆔 License: {instructor.licenseNumber || 'Not provided'}</p>
                  <p>📅 Joined: {instructor.user?.createdAt
                    ? new Date(instructor.user.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
                    : new Date(instructor.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
                  }</p>
                  <p>📋 Terms: {instructor.user?.termsAcceptedAt
                    ? <span className="text-green-600 font-medium">Accepted {new Date(instructor.user.termsAcceptedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    : <span className="text-amber-600">Not recorded</span>
                  }</p>
                </div>
              </div>
            </div>
            {instructor.bio && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-slate-300">{instructor.bio}</p>
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <p className="text-sm text-slate-400">Total Bookings</p>
            <p className="text-2xl font-bold text-slate-100">{instructor._count.bookings}</p>
          </div>
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <p className="text-sm text-slate-400">Reviews</p>
            <p className="text-2xl font-bold text-slate-100">{instructor.totalReviews || 0}</p>
          </div>
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <p className="text-sm text-slate-400">Average Rating</p>
            <p className="text-2xl font-bold text-slate-100">
              {instructor.averageRating ? instructor.averageRating.toFixed(1) : 'N/A'}
            </p>
          </div>
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <p className="text-sm text-slate-400">Account Status</p>
            <p className={`text-lg font-bold ${instructor.isActive ? 'text-green-600' : 'text-red-600'}`}>
              {instructor.isActive ? 'Active' : 'Inactive'}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-900 rounded-lg border border-slate-800 mb-6">
          <div className="border-b border-slate-700">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-700'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('subscription')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'subscription'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-700'
                }`}
              >
                Subscription
              </button>
              <button
                onClick={() => setActiveTab('bookings')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'bookings'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-700'
                }`}
              >
                Bookings ({instructor.bookings?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('documents')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'documents'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-700'
                }`}
              >
                Documents
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100 mb-3">Quick Stats</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="border rounded-lg p-3">
                      <p className="text-xs text-slate-400">Completed</p>
                      <p className="text-xl font-bold text-green-600">
                        {instructor.bookings.filter((b: any) => b.status === 'COMPLETED').length}
                      </p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <p className="text-xs text-slate-400">Upcoming</p>
                      <p className="text-xl font-bold text-blue-600">
                        {instructor.bookings.filter((b: any) => b.status === 'CONFIRMED' && new Date(b.startTime) > new Date()).length}
                      </p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <p className="text-xs text-slate-400">Cancelled</p>
                      <p className="text-xl font-bold text-red-600">
                        {instructor.bookings.filter((b: any) => b.status === 'CANCELLED').length}
                      </p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <p className="text-xs text-slate-400">Pending</p>
                      <p className="text-xl font-bold text-yellow-600">
                        {instructor.bookings.filter((b: any) => b.status === 'PENDING').length}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-100 mb-3">Document Status</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="border rounded-lg p-4">
                      <p className="text-sm font-medium text-slate-300 mb-2">License</p>
                      <p className={`text-lg font-bold ${licenseStatus.color}`}>
                        {licenseStatus.icon} {licenseStatus.label}
                      </p>
                      {instructor.licenseExpiry && (
                        <p className="text-xs text-slate-400 mt-1">
                          Expires: {new Date(instructor.licenseExpiry).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="border rounded-lg p-4">
                      <p className="text-sm font-medium text-slate-300 mb-2">Insurance</p>
                      <p className={`text-lg font-bold ${insuranceStatus.color}`}>
                        {insuranceStatus.icon} {insuranceStatus.label}
                      </p>
                      {instructor.insuranceExpiry && (
                        <p className="text-xs text-slate-400 mt-1">
                          Expires: {new Date(instructor.insuranceExpiry).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="border rounded-lg p-4">
                      <p className="text-sm font-medium text-slate-300 mb-2">Police Check</p>
                      <p className={`text-lg font-bold ${policeStatus.color}`}>
                        {policeStatus.icon} {policeStatus.label}
                      </p>
                      {instructor.policeCheckExpiry && (
                        <p className="text-xs text-slate-400 mt-1">
                          Expires: {new Date(instructor.policeCheckExpiry).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="border rounded-lg p-4">
                      <p className="text-sm font-medium text-slate-300 mb-2">WWC Check</p>
                      <p className={`text-lg font-bold ${wwcStatus.color}`}>
                        {wwcStatus.icon} {wwcStatus.label}
                      </p>
                      {instructor.wwcCheckExpiry && (
                        <p className="text-xs text-slate-400 mt-1">
                          Expires: {new Date(instructor.wwcCheckExpiry).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-200 mb-3">Subscription & Tax</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-400">Tier</p>
                      <p className="font-semibold text-slate-100">{instructor.subscriptionTier || 'BASIC'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Status</p>
                      <p className={`font-semibold ${instructor.subscriptionStatus === 'ACTIVE' ? 'text-green-600' : 'text-amber-600'}`}>
                        {instructor.subscriptionStatus || 'TRIAL'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Hourly Rate</p>
                      <p className="font-semibold text-slate-100">${instructor.hourlyRate}/hr</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Payout Method</p>
                      <p className="font-semibold text-slate-100">{instructor.payoutMethod?.replace('_', ' ') || 'Not set'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Stripe Connect</p>
                      {instructor.stripeConnectStatus === 'connected' ? (
                        <p className="font-semibold text-green-600">✓ Connected</p>
                      ) : (
                        <p className="font-semibold text-amber-600">⚠ Not connected</p>
                      )}
                      {instructor.stripeConnectStatus !== 'connected' && instructor.payoutMethod === 'bank_transfer' && (
                        <p className="text-xs text-slate-500 mt-0.5">Using manual bank transfer</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">ABN</p>
                      <p className="font-semibold text-slate-100">{instructor.abn || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">ABN Status</p>
                      <p className={`font-semibold ${instructor.abnVerified ? 'text-green-600' : 'text-red-600'}`}>
                        {instructor.abnVerified ? '✓ Verified' : '✗ Unverified'} — {instructor.withholdingTaxRate}% withholding
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Link href={`/admin/instructors/${instructor.id}/verify-abn`}
                      className="text-xs text-blue-600 hover:underline">
                      Manage ABN →
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Subscription Tab */}
            {activeTab === 'subscription' && (
              <SubscriptionTab instructorId={instructor.id} />
            )}

            {/* Bookings Tab */}
            {activeTab === 'bookings' && (
              <div>
                {instructor.bookings && instructor.bookings.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-700">
                      <thead className="bg-slate-950">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">ID</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Client</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Date/Time</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Price</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-slate-900 divide-y divide-slate-700">
                        {instructor.bookings.map((booking: any) => (
                          <tr key={booking.id} className="hover:bg-slate-800/50">
                            <td className="px-4 py-3 text-sm text-slate-100">#{booking.id.slice(-6).toUpperCase()}</td>
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium text-slate-100">
                                {booking.client?.name || booking.clientName || 'N/A'}
                              </div>
                              <div className="text-xs text-slate-400">
                                {booking.client?.email || booking.clientEmail || 'N/A'}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-400">
                              {new Date(booking.startTime).toLocaleDateString()}
                              <div className="text-xs">{new Date(booking.startTime).toLocaleTimeString()}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-100">{booking.bookingType}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                booking.status === 'CONFIRMED' ? 'bg-green-900/40 text-green-300' :
                                booking.status === 'PENDING' ? 'bg-yellow-900/40 text-yellow-300' :
                                booking.status === 'CANCELLED' ? 'bg-red-900/40 text-red-300' :
                                'bg-blue-900/40 text-blue-300'
                              }`}>
                                {booking.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-slate-100">${booking.price.toFixed(2)}</td>
                            <td className="px-4 py-3">
                              <Link
                                href={`/admin/bookings`}
                                className="text-sm text-blue-600 hover:text-blue-200"
                              >
                                View
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-400 text-center py-8">No bookings yet</p>
                )}
              </div>
            )}

            {/* Documents Tab */}
            {activeTab === 'documents' && (
              <div>
                <div className="flex justify-end mb-4">
                  <Link
                    href={`/admin/documents/review/${instructor.id}`}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Review & Manage Documents
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold text-slate-100 mb-3">License</h4>
                    <p className={`font-bold mb-2 ${licenseStatus.color}`}>
                      {licenseStatus.icon} {licenseStatus.label}
                    </p>
                    <p className="text-sm text-slate-400">Number: {instructor.licenseNumber || 'Not provided'}</p>
                    {instructor.licenseExpiry && (
                      <p className="text-sm text-slate-400">Expires: {new Date(instructor.licenseExpiry).toLocaleDateString()}</p>
                    )}
                    <div className="mt-2 space-y-1">
                      {instructor.licenseImageFront && (
                        <a href={instructor.licenseImageFront} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline block">
                          View Front Image →
                        </a>
                      )}
                      {instructor.licenseImageBack && (
                        <a href={instructor.licenseImageBack} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline block">
                          View Back Image →
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold text-slate-100 mb-3">Insurance</h4>
                    <p className={`font-bold mb-2 ${insuranceStatus.color}`}>
                      {insuranceStatus.icon} {insuranceStatus.label}
                    </p>
                    <p className="text-sm text-slate-400">Number: {instructor.insuranceNumber || 'Not provided'}</p>
                    {instructor.insuranceExpiry && (
                      <p className="text-sm text-slate-400">Expires: {new Date(instructor.insuranceExpiry).toLocaleDateString()}</p>
                    )}
                    {instructor.insurancePolicyDoc && (
                      <a href={instructor.insurancePolicyDoc} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline block mt-2">
                        View Document →
                      </a>
                    )}
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold text-slate-100 mb-3">Police Check</h4>
                    <p className={`font-bold mb-2 ${policeStatus.color}`}>
                      {policeStatus.icon} {policeStatus.label}
                    </p>
                    {instructor.policeCheckExpiry && (
                      <p className="text-sm text-slate-400">Expires: {new Date(instructor.policeCheckExpiry).toLocaleDateString()}</p>
                    )}
                    {instructor.policeCheckDoc && (
                      <a href={instructor.policeCheckDoc} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline block mt-2">
                        View Document →
                      </a>
                    )}
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold text-slate-100 mb-3">WWC Check</h4>
                    <p className={`font-bold mb-2 ${wwcStatus.color}`}>
                      {wwcStatus.icon} {wwcStatus.label}
                    </p>
                    {instructor.wwcCheckExpiry && (
                      <p className="text-sm text-slate-400">Expires: {new Date(instructor.wwcCheckExpiry).toLocaleDateString()}</p>
                    )}
                    {instructor.wwcCheckDoc && (
                      <a href={instructor.wwcCheckDoc} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline block mt-2">
                        View Document →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
