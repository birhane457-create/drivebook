'use client';

import { useEffect, useState } from 'react';
import AdminNav from '@/components/admin/AdminNav';
import {
  DollarSign, CheckCircle, AlertCircle, ChevronDown, ChevronUp,
  Flag, RefreshCw, UserX, User, Package, Clock, Phone, Mail,
  MapPin, FileText, AlertTriangle, Info
} from 'lucide-react';
import Link from 'next/link';

interface Transaction {
  id: string; bookingId: string; amount: number; platformFee: number;
  instructorPayout: number; commissionRate: number; createdAt: string;
  bookingDate: string; bookingEndDate?: string; duration: number;
  clientName: string; pickupAddress: string; description: string;
}
interface InstructorPayout {
  instructorId: string; instructorName: string; instructorPhone: string;
  totalAmount: number; transactionCount: number; transactions: Transaction[];
}
interface WithheldTxn {
  id: string; bookingId: string; bookingStatus: string;
  amount: number; platformFee: number; instructorPayout: number;
  bookingDate: string; bookingEndDate?: string; duration?: number;
  clientName: string; clientPhone?: string; clientEmail?: string;
  instructorPhone?: string; pickupAddress?: string; notes?: string;
  isPackageBooking?: boolean; description: string;
}
interface WithheldGroup {
  instructorId: string; instructorName: string; totalWithheld: number;
  transactions: WithheldTxn[];
}
interface Dispute {
  id: string; bookingId: string; instructorId: string;
  instructorName: string; instructorPhone?: string;
  clientName: string; clientPhone?: string; clientEmail?: string;
  amount: number; platformFee: number; instructorPayout: number;
  description: string; bookingDate: string; bookingEndDate?: string;
  duration?: number; bookingStatus: string;
  pickupAddress?: string; notes?: string; isPackageBooking?: boolean;
}
interface PayoutData {
  pendingPayouts: InstructorPayout[]; totalPending: number; completedThisMonth: number;
  withheld: WithheldGroup[]; totalWithheld: number; disputes: Dispute[];
  stats: { noShowCount: number; cancelledCount: number; eligibleCount: number; withheldCount: number; disputeCount: number };
}
type Tab = 'eligible' | 'withheld' | 'disputes';
type ResolveAction = 'refund_client' | 'pay_instructor' | 'charge_instructor' | 'void';
type NoShowParty = 'instructor' | 'client' | 'both';

function parseNoShowParty(description?: string): NoShowParty | null {
  if (!description) return null;
  if (description.includes('INSTRUCTOR_NO_SHOW')) return 'instructor';
  if (description.includes('CLIENT_NO_SHOW')) return 'client';
  if (description.includes('DISPUTED')) return 'both';
  return null;
}

const PARTY_CONFIG: Record<NoShowParty, {
  label: string; color: string; bgColor: string; borderColor: string;
  icon: React.ReactNode; suggested: ResolveAction; tip: string;
  consequence: string;
}> = {
  instructor: {
    label: 'Instructor no-show',
    color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200',
    icon: <UserX className="h-4 w-4 text-red-600" />,
    suggested: 'refund_client',
    tip: 'Instructor failed to attend. Client is owed a refund.',
    consequence: 'Refund client wallet · Consider charging instructor penalty',
  },
  client: {
    label: 'Client no-show',
    color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-200',
    icon: <User className="h-4 w-4 text-orange-600" />,
    suggested: 'pay_instructor',
    tip: 'Client failed to attend. Instructor showed up and should be paid.',
    consequence: 'Pay instructor · Client forfeits lesson (no refund)',
  },
  both: {
    label: 'Disputed — both parties',
    color: 'text-yellow-700', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200',
    icon: <AlertTriangle className="h-4 w-4 text-yellow-600" />,
    suggested: 'void',
    tip: 'Unclear or contested. Review before resolving.',
    consequence: 'Review evidence · Choose resolution manually',
  },
};

interface ResolveTarget {
  transactionId: string; bookingId: string;
  amount: number; platformFee: number; instructorPayout: number;
  clientName: string; instructorName: string;
  bookingDate: string; bookingEndDate?: string; duration?: number;
  clientPhone?: string; clientEmail?: string; instructorPhone?: string;
  pickupAddress?: string; notes?: string; isPackageBooking?: boolean;
  bookingStatus: string; description?: string;
  noShowParty?: NoShowParty | null;
}

// ─── Resolve Modal ────────────────────────────────────────────────────────────
function ResolveModal({ target, onClose, onDone }: {
  target: ResolveTarget; onClose: () => void; onDone: (msg: string) => void;
}) {
  const party = target.noShowParty;
  const partyConfig = party ? PARTY_CONFIG[party] : null;
  const [action, setAction] = useState<ResolveAction | ''>(partyConfig?.suggested ?? '');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const fmtTime = (s?: string) => s ? new Date(s).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : '—';
  const fmt = (n: number) => `$${(n || 0).toFixed(2)}`;

  const actions: { key: ResolveAction; label: string; desc: string; who: string; consequence: string; style: string }[] = [
    {
      key: 'refund_client', label: 'Refund Client',
      desc: `${fmt(target.amount)} returned to client wallet`,
      who: target.clientName,
      consequence: target.isPackageBooking ? 'Credit added back to package balance' : 'Wallet balance restored',
      style: 'border-blue-300 bg-blue-50',
    },
    {
      key: 'pay_instructor', label: 'Pay Instructor',
      desc: `${fmt(target.instructorPayout)} released to instructor`,
      who: target.instructorName,
      consequence: 'Instructor receives payout. Client forfeits lesson.',
      style: 'border-green-300 bg-green-50',
    },
    {
      key: 'charge_instructor', label: 'Charge Instructor Penalty',
      desc: `${fmt(target.instructorPayout)} deducted from next payout`,
      who: target.instructorName,
      consequence: 'Penalty applied. Deducted from instructor\'s future earnings.',
      style: 'border-orange-300 bg-orange-50',
    },
    {
      key: 'void', label: 'Void Transaction',
      desc: 'No money moves — write off',
      who: 'Neither party',
      consequence: 'Transaction closed. No refund, no payout.',
      style: 'border-gray-300 bg-gray-50',
    },
  ];

  const submit = async () => {
    if (!action) { setError('Select an action'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/payouts/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: target.transactionId, action, reason }),
      });
      const d = await res.json();
      if (res.ok) onDone(d.message || 'Resolved');
      else setError(d.error || 'Failed');
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg my-4">

        {/* Header */}
        <div className="p-5 border-b">
          <h2 className="text-lg font-bold text-gray-900">Resolve Transaction</h2>
          <p className="text-sm text-gray-500 mt-0.5">Booking #{target.bookingId?.slice(-6)} · {fmtDate(target.bookingDate)}</p>
        </div>

        {/* Case summary */}
        <div className="p-5 border-b space-y-3">

          {/* Who */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">Client</p>
              <p className="text-sm font-semibold text-gray-800">{target.clientName}</p>
              {target.clientPhone && <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{target.clientPhone}</p>}
              {target.clientEmail && <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Mail className="h-3 w-3" />{target.clientEmail}</p>}
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">Instructor</p>
              <p className="text-sm font-semibold text-gray-800">{target.instructorName}</p>
              {target.instructorPhone && <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{target.instructorPhone}</p>}
            </div>
          </div>

          {/* What / When */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              <span>{fmtDate(target.bookingDate)} · {fmtTime(target.bookingDate)} – {fmtTime(target.bookingEndDate)}</span>
              {target.duration && <span className="text-gray-400">({Math.round(target.duration)} min)</span>}
            </div>
            {target.pickupAddress && (
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <span>{target.pickupAddress}</span>
              </div>
            )}
            {target.notes && (
              <div className="flex items-start gap-2">
                <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                <span className="italic">{target.notes}</span>
              </div>
            )}
            {target.isPackageBooking && (
              <div className="flex items-center gap-2 text-purple-600">
                <Package className="h-3.5 w-3.5 shrink-0" />
                <span>Package lesson — refund returns as wallet credit</span>
              </div>
            )}
          </div>

          {/* Money breakdown */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-2">Money breakdown</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-gray-600">Lesson price (paid by client)</span><span className="font-semibold text-gray-800">{fmt(target.amount)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Platform fee</span><span className="text-red-500">-{fmt(target.platformFee)}</span></div>
              <div className="flex justify-between border-t border-gray-200 pt-1 mt-1"><span className="text-gray-600">Instructor payout</span><span className="font-semibold text-green-700">{fmt(target.instructorPayout)}</span></div>
            </div>
          </div>

          {/* Why — no-show party */}
          {partyConfig && (
            <div className={`rounded-lg border p-3 ${partyConfig.bgColor} ${partyConfig.borderColor}`}>
              <div className="flex items-center gap-2 mb-1">
                {partyConfig.icon}
                <span className={`text-sm font-semibold ${partyConfig.color}`}>{partyConfig.label}</span>
              </div>
              <p className={`text-xs ${partyConfig.color}`}>{partyConfig.tip}</p>
              <p className={`text-xs font-medium mt-1 ${partyConfig.color}`}>→ {partyConfig.consequence}</p>
            </div>
          )}

          {/* Booking status */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Booking status:</span>
            <span className={`px-2 py-0.5 rounded-full font-medium ${
              target.bookingStatus === 'NO_SHOW' ? 'bg-orange-100 text-orange-700' :
              target.bookingStatus === 'CANCELLED' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-600'
            }`}>{target.bookingStatus}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="p-5 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Choose resolution</p>
          {actions.map(a => (
            <button key={a.key} onClick={() => setAction(a.key)}
              className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                action === a.key ? `${a.style} border-opacity-100` : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{a.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{a.desc}</p>
                  <p className="text-xs text-gray-400 mt-0.5 italic">{a.consequence}</p>
                </div>
                {action === a.key && <CheckCircle className="h-4 w-4 text-gray-700 shrink-0 mt-0.5" />}
              </div>
            </button>
          ))}

          <div className="pt-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Admin note (optional)</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Instructor confirmed via phone they didn't attend" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="p-5 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
          <button onClick={submit} disabled={!action || loading}
            className="px-5 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50">
            {loading ? 'Processing...' : 'Confirm Resolution'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Withheld / Dispute detail card ──────────────────────────────────────────
function CaseCard({
  txn, instructorName, onResolve,
}: {
  txn: WithheldTxn | Dispute;
  instructorName: string;
  onResolve: () => void;
}) {
  const [open, setOpen] = useState(false);
  const party = parseNoShowParty(txn.description);
  const partyConfig = party ? PARTY_CONFIG[party] : null;
  const fmt = (n: number) => `$${(n || 0).toFixed(2)}`;
  const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const fmtTime = (s?: string) => s ? new Date(s).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : '—';
  const isNoShow = txn.bookingStatus === 'NO_SHOW';
  const isDispute = txn.description?.includes('DISPUTED');

  return (
    <div className={`rounded-xl border-2 overflow-hidden ${
      isDispute ? 'border-red-200' : isNoShow ? 'border-orange-200' : 'border-yellow-200'
    }`}>
      {/* Card header — always visible */}
      <div className={`px-4 py-3 flex items-start justify-between gap-3 ${
        isDispute ? 'bg-red-50' : isNoShow ? 'bg-orange-50' : 'bg-yellow-50'
      }`}>
        <div className="flex-1 min-w-0">
          {/* What happened */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {isDispute ? <Flag className="h-4 w-4 text-red-500 shrink-0" /> :
             isNoShow ? <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" /> :
             <Info className="h-4 w-4 text-yellow-600 shrink-0" />}
            <span className={`text-sm font-bold ${isDispute ? 'text-red-700' : isNoShow ? 'text-orange-700' : 'text-yellow-700'}`}>
              {isDispute ? 'Dispute' : isNoShow ? 'No-Show' : 'Cancelled'}
            </span>
            {partyConfig && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${partyConfig.bgColor} ${partyConfig.borderColor} ${partyConfig.color}`}>
                {partyConfig.icon} {partyConfig.label}
              </span>
            )}
            {txn.isPackageBooking && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200">
                <Package className="h-3 w-3" /> Package
              </span>
            )}
          </div>

          {/* Who + when */}
          <p className="text-sm text-gray-700">
            <span className="font-medium">{txn.clientName || '—'}</span>
            <span className="text-gray-400 mx-1">→</span>
            <span className="font-medium">{instructorName}</span>
          </p>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {fmtDate(txn.bookingDate)} · {fmtTime(txn.bookingDate)} – {fmtTime(txn.bookingEndDate)}
            {txn.duration && <span className="text-gray-400">({Math.round(txn.duration)} min)</span>}
          </p>
        </div>

        {/* Money + actions */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <p className="text-sm font-bold text-gray-800">{fmt(txn.amount)}</p>
            <p className="text-xs text-gray-400">→ {fmt(txn.instructorPayout)} instructor</p>
          </div>
          <button onClick={() => setOpen(v => !v)}
            className="p-1.5 rounded-lg hover:bg-white/60 text-gray-500">
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="px-4 py-4 bg-white border-t border-gray-100 space-y-3">

          {/* Why / guidance */}
          {partyConfig && (
            <div className={`rounded-lg border p-3 ${partyConfig.bgColor} ${partyConfig.borderColor}`}>
              <p className={`text-xs font-semibold ${partyConfig.color} mb-0.5`}>What this means</p>
              <p className={`text-xs ${partyConfig.color}`}>{partyConfig.tip}</p>
              <p className={`text-xs font-medium mt-1 ${partyConfig.color}`}>Recommended: {partyConfig.consequence}</p>
            </div>
          )}

          {/* Contact details */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-gray-400 font-medium mb-1">Client</p>
              <p className="text-gray-700 font-medium">{txn.clientName || '—'}</p>
              {txn.clientPhone && <p className="text-gray-500 flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{txn.clientPhone}</p>}
              {txn.clientEmail && <p className="text-gray-500 flex items-center gap-1 mt-0.5"><Mail className="h-3 w-3" />{txn.clientEmail}</p>}
            </div>
            <div>
              <p className="text-gray-400 font-medium mb-1">Instructor</p>
              <p className="text-gray-700 font-medium">{instructorName}</p>
              {txn.instructorPhone && <p className="text-gray-500 flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{txn.instructorPhone}</p>}
            </div>
          </div>

          {/* Location / notes */}
          {(txn.pickupAddress || txn.notes) && (
            <div className="text-xs space-y-1 text-gray-500">
              {txn.pickupAddress && <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3 shrink-0 text-gray-400" />{txn.pickupAddress}</p>}
              {txn.notes && <p className="flex items-start gap-1.5"><FileText className="h-3 w-3 shrink-0 text-gray-400 mt-0.5" /><span className="italic">{txn.notes}</span></p>}
            </div>
          )}

          {/* Money breakdown */}
          <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
            <p className="text-gray-400 font-medium mb-1.5">Money breakdown</p>
            <div className="flex justify-between"><span className="text-gray-600">Paid by client</span><span className="font-semibold">{fmt(txn.amount)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Platform fee</span><span className="text-red-500">-{fmt(txn.platformFee)}</span></div>
            <div className="flex justify-between border-t border-gray-200 pt-1 mt-1"><span className="text-gray-600">Instructor payout</span><span className="font-semibold text-green-700">{fmt(txn.instructorPayout)}</span></div>
            {txn.isPackageBooking && <p className="text-purple-600 flex items-center gap-1 pt-1"><Package className="h-3 w-3" />Refund returns as wallet credit (package)</p>}
          </div>

          <button onClick={onResolve}
            className={`w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-colors ${
              isDispute ? 'bg-red-600 hover:bg-red-700' : isNoShow ? 'bg-orange-600 hover:bg-orange-700' : 'bg-yellow-600 hover:bg-yellow-700'
            }`}>
            Resolve this case
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AdminPayoutsPage() {
  const [data, setData] = useState<PayoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('eligible');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState<string | null>(null);
  const [resolveTarget, setResolveTarget] = useState<ResolveTarget | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => { fetchPayouts(); }, []);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchPayouts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/payouts');
      if (res.ok) setData(await res.json());
      else showToast('error', 'Failed to load payout data.');
    } catch { showToast('error', 'Failed to load payout data.'); }
    finally { setLoading(false); }
  };

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const processPayout = async (instructorId: string) => {
    if (!confirm('Process payout for this instructor?')) return;
    setProcessing(instructorId);
    try {
      const res = await fetch('/api/admin/payouts/process', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructorId }),
      });
      const d = await res.json();
      if (res.ok) { showToast('success', d.message || 'Payout processed.'); fetchPayouts(); }
      else showToast('error', d.error || 'Failed.');
    } catch { showToast('error', 'Failed to process payout.'); }
    finally { setProcessing(null); }
  };

  const processAll = async () => {
    if (!confirm('Process ALL eligible pending payouts? Withheld and disputed transactions are NOT included.')) return;
    setProcessing('all');
    try {
      const res = await fetch('/api/admin/payouts/process-all', { method: 'POST' });
      const d = await res.json();
      if (res.ok) { showToast('success', `${d.count} payouts processed.`); fetchPayouts(); }
      else showToast('error', d.error || 'Failed.');
    } catch { showToast('error', 'Failed to process all payouts.'); }
    finally { setProcessing(null); }
  };

  const openResolve = (t: WithheldTxn | Dispute, instructorId: string, instructorName: string) =>
    setResolveTarget({
      transactionId: t.id,
      bookingId: t.bookingId,
      amount: t.amount,
      platformFee: t.platformFee,
      instructorPayout: t.instructorPayout,
      clientName: t.clientName || '—',
      instructorName,
      bookingDate: t.bookingDate,
      bookingEndDate: t.bookingEndDate,
      duration: t.duration,
      clientPhone: t.clientPhone,
      clientEmail: t.clientEmail,
      instructorPhone: t.instructorPhone,
      pickupAddress: t.pickupAddress,
      notes: t.notes,
      isPackageBooking: t.isPackageBooking,
      bookingStatus: t.bookingStatus,
      description: t.description,
      noShowParty: parseNoShowParty(t.description),
    });

  const fmt = (n: number) => `$${(n || 0).toFixed(2)}`;
  const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  if (loading) return <div className="min-h-screen bg-gray-50"><AdminNav /><div className="max-w-7xl mx-auto px-4 py-8 text-gray-500">Loading payout data...</div></div>;
  if (!data) return <div className="min-h-screen bg-gray-50"><AdminNav /><div className="max-w-7xl mx-auto px-4 py-8 text-red-500">Failed to load payout data.</div></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      {resolveTarget && (
        <ResolveModal target={resolveTarget} onClose={() => setResolveTarget(null)}
          onDone={msg => { setResolveTarget(null); showToast('success', msg); fetchPayouts(); }} />
      )}

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Payout Management</h1>
            <p className="text-gray-500 mt-1">Review and process instructor payouts</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchPayouts} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><RefreshCw className="h-4 w-4" /></button>
            <button onClick={processAll} disabled={processing !== null || data.pendingPayouts.length === 0}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Process All Eligible ({fmt(data.totalPending)})
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Pending Payout', value: fmt(data.totalPending), sub: `${data.stats.eligibleCount} txns`, color: 'text-blue-600' },
            { label: 'Paid This Month', value: fmt(data.completedThisMonth), sub: 'completed', color: 'text-green-600' },
            { label: 'Withheld', value: fmt(data.totalWithheld), sub: `${data.stats.withheldCount} txns`, color: 'text-yellow-600' },
            { label: 'No-Shows', value: String(data.stats.noShowCount), sub: 'total', color: 'text-orange-600' },
            { label: 'Disputes', value: String(data.stats.disputeCount), sub: 'flagged', color: 'text-red-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-white rounded-lg shadow p-1 w-fit">
          {([
            { key: 'eligible' as Tab, label: `Eligible (${data.pendingPayouts.length})` },
            { key: 'withheld' as Tab, label: `Withheld (${data.withheld.reduce((s, w) => s + w.transactions.length, 0)})` },
            { key: 'disputes' as Tab, label: `Disputes (${data.disputes.length})` },
          ]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ELIGIBLE */}
        {tab === 'eligible' && (
          <div className="bg-white rounded-lg shadow divide-y divide-gray-100">
            {data.pendingPayouts.length === 0 ? (
              <div className="p-12 text-center"><CheckCircle className="h-14 w-14 text-green-400 mx-auto mb-3" /><p className="text-lg font-semibold text-gray-700">All caught up — no pending payouts</p></div>
            ) : data.pendingPayouts.map(p => (
              <div key={p.instructorId} className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <Link href={`/admin/instructors/${p.instructorId}`} className="text-base font-semibold text-gray-900 hover:text-blue-600">{p.instructorName}</Link>
                    <p className="text-sm text-gray-500">{p.transactionCount} lesson{p.transactionCount !== 1 ? 's' : ''} · {p.instructorPhone || 'no phone'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-green-600">{fmt(p.totalAmount)}</span>
                    <button onClick={() => processPayout(p.instructorId)} disabled={processing !== null}
                      className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                      {processing === p.instructorId ? 'Processing...' : 'Pay'}
                    </button>
                    <button onClick={() => toggle(p.instructorId)} className="text-gray-400 hover:text-gray-600">
                      {expanded.has(p.instructorId) ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                {expanded.has(p.instructorId) && (
                  <div className="mt-4 bg-gray-50 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 text-gray-600 text-left">
                        <tr>
                          <th className="px-4 py-2">Client</th><th className="px-4 py-2">Date</th>
                          <th className="px-4 py-2 text-right">Total</th><th className="px-4 py-2 text-right">Fee</th>
                          <th className="px-4 py-2 text-right">Instructor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {p.transactions.map(t => (
                          <tr key={t.id} className="hover:bg-white">
                            <td className="px-4 py-2 text-gray-700">{t.clientName || '—'}</td>
                            <td className="px-4 py-2 text-gray-500">{fmtDate(t.bookingDate)}</td>
                            <td className="px-4 py-2 text-right text-gray-700">{fmt(t.amount)}</td>
                            <td className="px-4 py-2 text-right text-red-500">-{fmt(t.platformFee)}</td>
                            <td className="px-4 py-2 text-right font-semibold text-green-600">{fmt(t.instructorPayout)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-100 font-semibold">
                        <tr>
                          <td colSpan={4} className="px-4 py-2 text-gray-700">Total</td>
                          <td className="px-4 py-2 text-right text-green-600">{fmt(p.totalAmount)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* WITHHELD */}
        {tab === 'withheld' && (
          <div className="space-y-4">
            {data.withheld.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center"><CheckCircle className="h-14 w-14 text-green-400 mx-auto mb-3" /><p className="text-lg font-semibold text-gray-700">No withheld transactions</p></div>
            ) : data.withheld.map(w => (
              <div key={w.instructorId}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <Link href={`/admin/instructors/${w.instructorId}`} className="text-sm font-semibold text-gray-700 hover:text-blue-600">{w.instructorName}</Link>
                  <span className="text-xs text-gray-400">· {w.transactions.length} case{w.transactions.length !== 1 ? 's' : ''} · withheld {fmt(w.totalWithheld)}</span>
                </div>
                <div className="space-y-3">
                  {w.transactions.map(t => (
                    <CaseCard key={t.id} txn={t} instructorName={w.instructorName}
                      onResolve={() => openResolve(t, w.instructorId, w.instructorName)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* DISPUTES */}
        {tab === 'disputes' && (
          <div className="space-y-3">
            {data.disputes.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center"><CheckCircle className="h-14 w-14 text-green-400 mx-auto mb-3" /><p className="text-lg font-semibold text-gray-700">No flagged disputes</p></div>
            ) : data.disputes.map(d => (
              <CaseCard key={d.id} txn={d} instructorName={d.instructorName || '—'}
                onResolve={() => openResolve(d, d.instructorId, d.instructorName || '—')} />
            ))}
          </div>
        )}

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-800 space-y-1">
            <p className="font-semibold text-blue-900">Resolution Guide</p>
            <p>Eligible: lesson ended, booking confirmed/completed — safe to pay out.</p>
            <p>Withheld: cancelled or no-show — expand each case to see who, what, why, and the recommended action.</p>
            <p>Disputes: both parties contested — review carefully. "Charge Instructor" deducts from their next payout.</p>
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
