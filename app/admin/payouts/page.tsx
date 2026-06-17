'use client';

import { useEffect, useState } from 'react';
import AdminNav from '@/components/admin/AdminNav';
import {
  DollarSign, CheckCircle, AlertCircle, ChevronDown, ChevronUp,
  Flag, RefreshCw, UserX, User, Package, Clock, Phone, Mail,
  MapPin, FileText, AlertTriangle, Info, Send, BadgeCheck, Banknote,
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
interface ManualPayout {
  id: string; payoutRef: string; instructorId: string; instructorName: string;
  instructorPhone: string | null; bankBsb: string | null; bankAccount: string | null;
  bankAccountName: string | null; grossAmount: number; taxWithheld: number;
  netAmount: number; payoutMethod: string; transactionCount: number; createdAt: string;
  bankReference?: string; sentAt?: string; sentBy?: string;
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
  pendingTransferPayouts: ManualPayout[]; sentPayouts: ManualPayout[];
  withheld: WithheldGroup[]; totalWithheld: number; disputes: Dispute[];
  stats: {
    noShowCount: number; cancelledCount: number; eligibleCount: number;
    withheldCount: number; disputeCount: number;
    pendingTransferCount: number; sentCount: number;
  };
}
type Tab = 'eligible' | 'manual' | 'withheld' | 'disputes';
type ResolveAction = 'refund_client' | 'approve_for_payout' | 'charge_instructor' | 'void' | 'split';
type NoShowParty = 'instructor' | 'client' | 'both';

function parseNoShowParty(description?: string, noShowParty?: string | null): NoShowParty | null {
  // Prefer the proper field if available
  if (noShowParty === 'instructor') return 'instructor';
  if (noShowParty === 'client') return 'client';
  if (noShowParty === 'both') return 'both';
  // Fall back to description string for legacy records
  if (!description) return null;
  if (description.includes('INSTRUCTOR_NO_SHOW')) return 'instructor';
  if (description.includes('CLIENT_NO_SHOW')) return 'client';
  if (description.includes('DISPUTED')) return 'both';
  return null;
}

const PARTY_CONFIG: Record<NoShowParty, {
  label: string; color: string; bgColor: string; borderColor: string;
  icon: React.ReactNode; suggested: ResolveAction; tip: string; consequence: string;
}> = {
  instructor: {
    label: 'Instructor no-show', color: 'text-red-700', bgColor: 'bg-red-900/20', borderColor: 'border-red-700/50',
    icon: <UserX className="h-4 w-4 text-red-600" />, suggested: 'refund_client',
    tip: 'Instructor failed to attend. Client is owed a refund.',
    consequence: 'Refund client wallet · Consider charging instructor penalty',
  },
  client: {
    label: 'Client no-show', color: 'text-orange-700', bgColor: 'bg-orange-900/20', borderColor: 'border-orange-700/50',
    icon: <User className="h-4 w-4 text-orange-600" />, suggested: 'approve_for_payout',
    tip: 'Client failed to attend. Instructor showed up and should be paid.',
    consequence: 'Pay instructor · Client forfeits lesson (no refund)',
  },
  both: {
    label: 'Disputed — both parties', color: 'text-yellow-700', bgColor: 'bg-yellow-900/20', borderColor: 'border-yellow-700/50',
    icon: <AlertTriangle className="h-4 w-4 text-yellow-600" />, suggested: 'void',
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
  bookingStatus: string; description?: string; noShowParty?: NoShowParty | null;
}

// Mark Sent Modal
function MarkSentModal({ payout, onClose, onDone }: {
  payout: ManualPayout; onClose: () => void; onDone: (msg: string) => void;
}) {
  const [bankReference, setBankReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fmt = (n: number) => `$${(n || 0).toFixed(2)}`;

  const submit = async () => {
    if (!bankReference.trim()) { setError('Bank reference is required'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/admin/payouts/${payout.id}/mark-sent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sent', bankReference: bankReference.trim() }),
      });
      const d = await res.json();
      if (res.ok) onDone(d.message || 'Marked as sent');
      else setError(d.error || 'Failed');
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-800-2xl w-full max-w-md">
        <div className="p-5 border-b">
          <h2 className="text-lg font-bold text-slate-100">Mark Transfer Sent</h2>
          <p className="text-sm text-slate-500 mt-0.5">{payout.payoutRef}</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3 text-sm text-yellow-300">
            <p className="font-semibold mb-1">Before marking sent, confirm you have:</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              <li>Transferred {fmt(payout.netAmount)} to {payout.bankAccountName || 'instructor'}</li>
              <li>BSB: {payout.bankBsb || 'N/A'} · Account: {payout.bankAccount || 'N/A'}</li>
            </ul>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Bank transaction reference</label>
            <input
              type="text"
              value={bankReference}
              onChange={e => setBankReference(e.target.value)}
              placeholder="e.g. NAB ref 123456789"
              className="w-full border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">This is stored as evidence of the transfer.</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="p-5 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-100">Cancel</button>
          <button onClick={submit} disabled={loading}
            className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Saving...' : 'Confirm Sent'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Confirm Received Modal
function ConfirmReceivedModal({ payout, onClose, onDone }: {
  payout: ManualPayout; onClose: () => void; onDone: (msg: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fmt = (n: number) => `$${(n || 0).toFixed(2)}`;

  const submit = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/admin/payouts/${payout.id}/mark-sent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm' }),
      });
      const d = await res.json();
      if (res.ok) onDone(d.message || 'Payout confirmed — ledger updated');
      else setError(d.error || 'Failed');
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-800-2xl w-full max-w-md">
        <div className="p-5 border-b">
          <h2 className="text-lg font-bold text-slate-100">Confirm Payment Received</h2>
          <p className="text-sm text-slate-500 mt-0.5">{payout.payoutRef}</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-3 text-sm text-green-300">
            <p className="font-semibold">This will mark the payout as PAID and update the ledger.</p>
            <p className="text-xs mt-1">Only confirm if the instructor has received {fmt(payout.netAmount)}.</p>
          </div>
          <div className="bg-slate-950 rounded-lg p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Bank ref</span><span className="font-medium">{payout.bankReference || 'N/A'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Net amount</span><span className="font-semibold text-green-700">{fmt(payout.netAmount)}</span></div>
            {payout.taxWithheld > 0 && <div className="flex justify-between"><span className="text-slate-500">Tax withheld</span><span className="text-orange-600">{fmt(payout.taxWithheld)}</span></div>}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="p-5 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-100">Cancel</button>
          <button onClick={submit} disabled={loading}
            className="px-5 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">
            {loading ? 'Confirming...' : 'Confirm Received'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Resolve Modal
function ResolveModal({ target, onClose, onDone }: {
  target: ResolveTarget; onClose: () => void; onDone: (msg: string, pendingPayout?: boolean) => void;
}) {
  const party = target.noShowParty;
  const partyConfig = party ? PARTY_CONFIG[party] : null;
  const [action, setAction] = useState<ResolveAction | ''>(partyConfig?.suggested ?? '');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [splitRefund, setSplitRefund] = useState(parseFloat((target.amount / 2).toFixed(2)));
  const [splitPayout, setSplitPayout] = useState(parseFloat((target.instructorPayout / 2).toFixed(2)));

  const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const fmtTime = (s?: string) => s ? new Date(s).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : '—';
  const fmt = (n: number) => `$${(n || 0).toFixed(2)}`;

  const actions: { key: ResolveAction; label: string; desc: string; who: string; consequence: string; style: string }[] = [
    { key: 'refund_client', label: 'Refund Client', desc: `${fmt(target.amount)} returned to client wallet`, who: target.clientName, consequence: target.isPackageBooking ? 'Credit added back to package balance' : 'Wallet balance restored', style: 'border-blue-300 bg-blue-900/20' },
    { key: 'approve_for_payout', label: 'Approve for Payout', desc: `${fmt(target.instructorPayout)} approved — sent during next payout run`, who: target.instructorName, consequence: 'Marks instructor as payable. Funds sent during payout processing.', style: 'border-green-300 bg-green-900/20' },
    { key: 'split', label: 'Split Resolution', desc: 'Partial refund to client + partial payout to instructor', who: 'Both parties', consequence: 'Atomic — both legs commit together or neither does.', style: 'border-purple-300 bg-violet-900/20' },
    { key: 'charge_instructor', label: 'Charge Instructor Penalty', desc: `${fmt(target.instructorPayout)} deducted from next payout`, who: target.instructorName, consequence: "Penalty applied. Deducted from instructor's future earnings.", style: 'border-orange-300 bg-orange-900/20' },
    { key: 'void', label: 'Void Transaction', desc: 'No money moves — write off', who: 'Neither party', consequence: 'Transaction closed. No refund, no payout.', style: 'border-slate-600 bg-slate-800' },
  ];

  const submit = async () => {
    if (!action) { setError('Select an action'); return; }
    setLoading(true); setError('');
    try {
      if (action === 'split') {
        if (splitRefund <= 0 && splitPayout <= 0) { setError('Enter at least one amount > 0'); setLoading(false); return; }
        if (splitRefund > target.amount + 0.001) { setError(`Refund cannot exceed ${fmt(target.amount)}`); setLoading(false); return; }
        if (splitPayout > target.instructorPayout + 0.001) { setError(`Payout cannot exceed ${fmt(target.instructorPayout)}`); setLoading(false); return; }
        const res = await fetch('/api/admin/payouts/resolve-split', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionId: target.transactionId, refundAmount: splitRefund, payoutAmount: splitPayout, reason }),
        });
        const d = await res.json();
        if (res.ok) onDone(d.message || 'Split resolved', d.pendingPayout === true);
        else setError(d.error || 'Failed');
      } else {
        const res = await fetch('/api/admin/payouts/resolve', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionId: target.transactionId, action, reason }),
        });
        const d = await res.json();
        if (res.ok) onDone(d.message || 'Resolved', d.pendingPayout === true);
        else setError(d.error || 'Failed');
      }
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 rounded-xl border border-slate-800-2xl w-full max-w-lg my-4">
        <div className="p-5 border-b">
          <h2 className="text-lg font-bold text-slate-100">Resolve Transaction</h2>
          <p className="text-sm text-slate-500 mt-0.5">Booking #{target.bookingId?.slice(-6)} · {fmtDate(target.bookingDate)}</p>
        </div>
        <div className="p-5 border-b space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-950 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">Client</p>
              <p className="text-sm font-semibold text-slate-200">{target.clientName}</p>
              {target.clientPhone && <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{target.clientPhone}</p>}
              {target.clientEmail && <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Mail className="h-3 w-3" />{target.clientEmail}</p>}
            </div>
            <div className="bg-slate-950 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">Instructor</p>
              <p className="text-sm font-semibold text-slate-200">{target.instructorName}</p>
              {target.instructorPhone && <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{target.instructorPhone}</p>}
            </div>
          </div>
          <div className="bg-slate-950 rounded-lg p-3 space-y-1.5 text-xs text-slate-400">
            <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-slate-500 shrink-0" /><span>{fmtDate(target.bookingDate)} · {fmtTime(target.bookingDate)} – {fmtTime(target.bookingEndDate)}</span>{target.duration && <span className="text-slate-500">({Math.round(target.duration)} min)</span>}</div>
            {target.pickupAddress && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" /><span>{target.pickupAddress}</span></div>}
            {target.notes && <div className="flex items-start gap-2"><FileText className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" /><span className="italic">{target.notes}</span></div>}
            {target.isPackageBooking && <div className="flex items-center gap-2 text-purple-600"><Package className="h-3.5 w-3.5 shrink-0" /><span>Package lesson — refund returns as wallet credit</span></div>}
          </div>
          <div className="bg-slate-950 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-2">Money breakdown</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-slate-400">Lesson price</span><span className="font-semibold text-slate-200">{fmt(target.amount)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Platform fee</span><span className="text-red-500">-{fmt(target.platformFee)}</span></div>
              <div className="flex justify-between border-t border-slate-700 pt-1 mt-1"><span className="text-slate-400">Instructor payout</span><span className="font-semibold text-green-700">{fmt(target.instructorPayout)}</span></div>
            </div>
          </div>
          {partyConfig && (
            <div className={`rounded-lg border p-3 ${partyConfig.bgColor} ${partyConfig.borderColor}`}>
              <div className="flex items-center gap-2 mb-1">{partyConfig.icon}<span className={`text-sm font-semibold ${partyConfig.color}`}>{partyConfig.label}</span></div>
              <p className={`text-xs ${partyConfig.color}`}>{partyConfig.tip}</p>
              <p className={`text-xs font-medium mt-1 ${partyConfig.color}`}>→ {partyConfig.consequence}</p>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Booking status:</span>
            <span className={`px-2 py-0.5 rounded-full font-medium ${target.bookingStatus === 'NO_SHOW' ? 'bg-orange-900/40 text-orange-300' : target.bookingStatus === 'CANCELLED' ? 'bg-red-900/40 text-red-300' : 'bg-slate-800 text-slate-400'}`}>{target.bookingStatus}</span>
          </div>
        </div>
        <div className="p-5 space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Choose resolution</p>
          {actions.map(a => (
            <button key={a.key} onClick={() => setAction(a.key)}
              className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${action === a.key ? `${a.style} border-opacity-100` : 'border-slate-700 hover:border-slate-600 bg-slate-900'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-100 text-sm">{a.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{a.desc}</p>
                  <p className="text-xs text-slate-500 mt-0.5 italic">{a.consequence}</p>
                </div>
                {action === a.key && <CheckCircle className="h-4 w-4 text-slate-300 shrink-0 mt-0.5" />}
              </div>
            </button>
          ))}
          <div className="pt-1">
            {action === 'split' && (
              <div className="mb-3 p-3 bg-violet-900/20 border border-violet-700/50 rounded-lg space-y-2">
                <p className="text-xs font-semibold text-purple-700 mb-2">Split amounts</p>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400 w-32 shrink-0">Refund to client ($)</label>
                  <input type="number" min={0} max={target.amount} step={0.01} value={splitRefund} onChange={e => setSplitRefund(parseFloat(e.target.value) || 0)} className="flex-1 border border-slate-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                  <span className="text-xs text-slate-500">max {fmt(target.amount)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400 w-32 shrink-0">Payout to instructor ($)</label>
                  <input type="number" min={0} max={target.instructorPayout} step={0.01} value={splitPayout} onChange={e => setSplitPayout(parseFloat(e.target.value) || 0)} className="flex-1 border border-slate-700 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                  <span className="text-xs text-slate-500">max {fmt(target.instructorPayout)}</span>
                </div>
              </div>
            )}
            <label className="block text-xs font-medium text-slate-400 mb-1">Admin note (optional)</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
              className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Instructor confirmed via phone they didn't attend" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="p-5 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-100">Cancel</button>
          <button onClick={submit} disabled={!action || loading}
            className="px-5 py-2 bg-slate-950 text-white text-sm rounded-lg hover:bg-slate-900 disabled:opacity-50">
            {loading ? 'Processing...' : 'Confirm Resolution'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Case Card (withheld / disputes)
function CaseCard({ txn, instructorName, onResolve }: { txn: WithheldTxn | Dispute; instructorName: string; onResolve: () => void; }) {
  const [open, setOpen] = useState(false);
  const party = parseNoShowParty(txn.description, (txn as any).noShowParty);
  const partyConfig = party ? PARTY_CONFIG[party] : null;
  const fmt = (n: number) => `$${(n || 0).toFixed(2)}`;
  const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const fmtTime = (s?: string) => s ? new Date(s).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : '—';
  const isNoShow = txn.bookingStatus === 'NO_SHOW';
  const isDispute = txn.description?.includes('DISPUTED');

  return (
    <div className={`rounded-xl border-2 overflow-hidden ${isDispute ? 'border-red-700/50' : isNoShow ? 'border-orange-700/50' : 'border-yellow-700/50'}`}>
      <div className={`px-4 py-3 flex items-start justify-between gap-3 ${isDispute ? 'bg-red-900/20' : isNoShow ? 'bg-orange-900/20' : 'bg-yellow-900/20'}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {isDispute ? <Flag className="h-4 w-4 text-red-500 shrink-0" /> : isNoShow ? <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" /> : <Info className="h-4 w-4 text-yellow-600 shrink-0" />}
            <span className={`text-sm font-bold ${isDispute ? 'text-red-700' : isNoShow ? 'text-orange-700' : 'text-yellow-700'}`}>{isDispute ? 'Dispute' : isNoShow ? 'No-Show' : 'Cancelled'}</span>
            {partyConfig && <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${partyConfig.bgColor} ${partyConfig.borderColor} ${partyConfig.color}`}>{partyConfig.icon} {partyConfig.label}</span>}
            {txn.isPackageBooking && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-900/40 text-violet-300 border border-violet-700/50"><Package className="h-3 w-3" /> Package</span>}
          </div>
          <p className="text-sm text-slate-300"><span className="font-medium">{txn.clientName || '—'}</span><span className="text-slate-500 mx-1">→</span><span className="font-medium">{instructorName}</span></p>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDate(txn.bookingDate)} · {fmtTime(txn.bookingDate)} – {fmtTime(txn.bookingEndDate)}{txn.duration && <span className="text-slate-500">({Math.round(txn.duration)} min)</span>}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <p className="text-sm font-bold text-slate-200">{fmt(txn.amount)}</p>
            <p className="text-xs text-slate-500">→ {fmt(txn.instructorPayout)} instructor</p>
          </div>
          <button onClick={() => setOpen(v => !v)} className="p-1.5 rounded-lg hover:bg-slate-900/60 text-slate-500">{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
        </div>
      </div>
      {open && (
        <div className="px-4 py-4 bg-slate-900 border-t border-slate-800 space-y-3">
          {partyConfig && (
            <div className={`rounded-lg border p-3 ${partyConfig.bgColor} ${partyConfig.borderColor}`}>
              <p className={`text-xs font-semibold ${partyConfig.color} mb-0.5`}>What this means</p>
              <p className={`text-xs ${partyConfig.color}`}>{partyConfig.tip}</p>
              <p className={`text-xs font-medium mt-1 ${partyConfig.color}`}>Recommended: {partyConfig.consequence}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-slate-500 font-medium mb-1">Client</p>
              <p className="text-slate-300 font-medium">{txn.clientName || '—'}</p>
              {txn.clientPhone && <p className="text-slate-500 flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{txn.clientPhone}</p>}
              {txn.clientEmail && <p className="text-slate-500 flex items-center gap-1 mt-0.5"><Mail className="h-3 w-3" />{txn.clientEmail}</p>}
            </div>
            <div>
              <p className="text-slate-500 font-medium mb-1">Instructor</p>
              <p className="text-slate-300 font-medium">{instructorName}</p>
              {txn.instructorPhone && <p className="text-slate-500 flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{txn.instructorPhone}</p>}
            </div>
          </div>
          {(txn.pickupAddress || txn.notes) && (
            <div className="text-xs space-y-1 text-slate-500">
              {txn.pickupAddress && <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3 shrink-0 text-slate-500" />{txn.pickupAddress}</p>}
              {txn.notes && <p className="flex items-start gap-1.5"><FileText className="h-3 w-3 shrink-0 text-slate-500 mt-0.5" /><span className="italic">{txn.notes}</span></p>}
            </div>
          )}
          <div className="bg-slate-950 rounded-lg p-3 text-xs space-y-1">
            <p className="text-slate-500 font-medium mb-1.5">Money breakdown</p>
            <div className="flex justify-between"><span className="text-slate-400">Paid by client</span><span className="font-semibold">{fmt(txn.amount)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Platform fee</span><span className="text-red-500">-{fmt(txn.platformFee)}</span></div>
            <div className="flex justify-between border-t border-slate-700 pt-1 mt-1"><span className="text-slate-400">Instructor payout</span><span className="font-semibold text-green-700">{fmt(txn.instructorPayout)}</span></div>
          </div>
          <button onClick={onResolve} className={`w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-colors ${isDispute ? 'bg-red-600 hover:bg-red-700' : isNoShow ? 'bg-orange-600 hover:bg-orange-700' : 'bg-yellow-600 hover:bg-yellow-700'}`}>Resolve this case</button>
        </div>
      )}
    </div>
  );
}

// Page
export default function AdminPayoutsPage() {
  const [data, setData] = useState<PayoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('eligible');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState<string | null>(null);
  const [resolveTarget, setResolveTarget] = useState<ResolveTarget | null>(null);
  const [markSentTarget, setMarkSentTarget] = useState<ManualPayout | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ManualPayout | null>(null);
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
      if (res.ok) {
        const msg = d.status === 'PENDING_TRANSFER'
          ? `Payout queued for manual bank transfer — go to Manual Transfers tab.`
          : d.message || 'Payout processed.';
        showToast('success', msg);
        fetchPayouts();
        if (d.status === 'PENDING_TRANSFER') setTab('manual');
      } else showToast('error', d.error || 'Failed.');
    } catch { showToast('error', 'Failed to process payout.'); }
    finally { setProcessing(null); }
  };

  const handleHoldPayout = async (payoutId: string) => {
    if (!confirm('Put this payout on hold? It will not be transferred until released.')) return;
    setProcessing(payoutId);
    try {
      const res = await fetch(`/api/admin/payouts/${payoutId}/hold`, { method: 'POST' });
      const d = await res.json();
      if (res.ok) { showToast('success', d.message || 'Payout placed on hold.'); fetchPayouts(); }
      else showToast('error', d.error || 'Failed to hold payout.');
    } catch { showToast('error', 'Network error.'); }
    finally { setProcessing(null); }
  };

  const processAll = async () => {
    setProcessing('all');
    try {
      const res = await fetch('/api/admin/payouts/process-all', { method: 'POST' });
      const d = await res.json();
      if (res.ok) {
        showToast('success', d.message || `${d.count} payouts processed.`);
        fetchPayouts();
      } else showToast('error', d.error || 'Failed.');
    } catch { showToast('error', 'Failed to process all payouts.'); }
    finally { setProcessing(null); }
  };

  const openResolve = (t: WithheldTxn | Dispute, instructorId: string, instructorName: string) =>
    setResolveTarget({
      transactionId: t.id, bookingId: t.bookingId,
      amount: t.amount, platformFee: t.platformFee, instructorPayout: t.instructorPayout,
      clientName: t.clientName || '—', instructorName,
      bookingDate: t.bookingDate, bookingEndDate: t.bookingEndDate, duration: t.duration,
      clientPhone: t.clientPhone, clientEmail: t.clientEmail, instructorPhone: t.instructorPhone,
      pickupAddress: t.pickupAddress, notes: t.notes, isPackageBooking: t.isPackageBooking,
      bookingStatus: t.bookingStatus, description: t.description,
      noShowParty: parseNoShowParty(t.description, (t as any).noShowParty),
    });

  const fmt = (n: number) => `$${(n || 0).toFixed(2)}`;
  const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const manualCount = (data?.stats.pendingTransferCount ?? 0) + (data?.stats.sentCount ?? 0);

  if (loading) return <div className="min-h-screen bg-slate-950 text-slate-100"><AdminNav /><div className="max-w-7xl mx-auto px-4 py-8 text-slate-500">Loading payout data...</div></div>;
  if (!data) return <div className="min-h-screen bg-slate-950 text-slate-100"><AdminNav /><div className="max-w-7xl mx-auto px-4 py-8 text-red-500">Failed to load payout data.</div></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminNav />

      {resolveTarget && (
        <ResolveModal target={resolveTarget} onClose={() => setResolveTarget(null)}
          onDone={(msg, pendingPayout) => {
            setResolveTarget(null);
            showToast('success', pendingPayout ? `${msg} — go to Eligible tab to process the payout.` : msg);
            fetchPayouts();
          }} />
      )}
      {markSentTarget && (
        <MarkSentModal payout={markSentTarget} onClose={() => setMarkSentTarget(null)}
          onDone={(msg) => { setMarkSentTarget(null); showToast('success', msg); fetchPayouts(); }} />
      )}
      {confirmTarget && (
        <ConfirmReceivedModal payout={confirmTarget} onClose={() => setConfirmTarget(null)}
          onDone={(msg) => { setConfirmTarget(null); showToast('success', msg); fetchPayouts(); }} />
      )}

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-100">Payout Management</h1>
            <p className="text-slate-500 mt-1">Review and process instructor payouts</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchPayouts} className="p-2 text-slate-500 hover:text-slate-400 rounded-lg hover:bg-slate-800"><RefreshCw className="h-4 w-4" /></button>
            <button onClick={processAll} disabled={processing !== null || data.pendingPayouts.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 text-sm">
              <DollarSign className="h-4 w-4" /> Process All Eligible ({fmt(data.totalPending)})
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Pending Payout', value: fmt(data.totalPending), sub: `${data.stats.eligibleCount} txns`, color: 'text-blue-600' },
            { label: 'Paid This Month', value: fmt(data.completedThisMonth), sub: 'completed', color: 'text-green-600' },
            { label: 'Manual Queue', value: String(manualCount), sub: `${data.stats.pendingTransferCount} pending · ${data.stats.sentCount} sent`, color: 'text-yellow-600' },
            { label: 'No-Shows', value: String(data.stats.noShowCount), sub: 'total', color: 'text-orange-600' },
            { label: 'Disputes', value: String(data.stats.disputeCount), sub: 'flagged', color: 'text-red-600' },
          ].map(s => (
            <div key={s.label} className="bg-slate-900 rounded-lg border border-slate-800 p-4">
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-slate-900 rounded-lg border border-slate-800 p-1 w-fit flex-wrap">
          {([
            { key: 'eligible' as Tab, label: `Eligible (${data.pendingPayouts.length})` },
            { key: 'manual' as Tab, label: `Manual Transfers (${manualCount})`, alert: manualCount > 0 },
            { key: 'withheld' as Tab, label: `Withheld (${data.withheld.reduce((s, w) => s + w.transactions.length, 0)})` },
            { key: 'disputes' as Tab, label: `Disputes (${data.disputes.length})` },
          ]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === t.key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
              {t.label}
              {t.alert && tab !== t.key && <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />}
            </button>
          ))}
        </div>

        {/* ELIGIBLE */}
        {tab === 'eligible' && (
          <div className="bg-slate-900 rounded-lg border border-slate-800 divide-y divide-slate-800">
            {data.pendingPayouts.length === 0 ? (
              <div className="p-12 text-center"><CheckCircle className="h-14 w-14 text-green-400 mx-auto mb-3" /><p className="text-lg font-semibold text-slate-300">All caught up — no pending payouts</p></div>
            ) : data.pendingPayouts.map(p => (
              <div key={p.instructorId} className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <Link href={`/admin/instructors/${p.instructorId}`} className="text-base font-semibold text-slate-100 hover:text-blue-600">{p.instructorName}</Link>
                    <p className="text-sm text-slate-500">{p.transactionCount} lesson{p.transactionCount !== 1 ? 's' : ''} · {p.instructorPhone || 'no phone'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-green-600">{fmt(p.totalAmount)}</span>
                    <button onClick={() => processPayout(p.instructorId)} disabled={processing !== null}
                      className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                      {processing === p.instructorId ? 'Processing...' : 'Pay'}
                    </button>
                    <button onClick={() => toggle(p.instructorId)} className="text-slate-500 hover:text-slate-400">
                      {expanded.has(p.instructorId) ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                {expanded.has(p.instructorId) && (
                  <div className="mt-4 bg-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-800 text-slate-400 text-left">
                        <tr><th className="px-4 py-2">Client</th><th className="px-4 py-2">Date</th><th className="px-4 py-2 text-right">Total</th><th className="px-4 py-2 text-right">Fee</th><th className="px-4 py-2 text-right">Instructor</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {p.transactions.map(t => (
                          <tr key={t.id} className="hover:bg-slate-800">
                            <td className="px-4 py-2 text-slate-300">{t.clientName || '—'}</td>
                            <td className="px-4 py-2 text-slate-500">{fmtDate(t.bookingDate)}</td>
                            <td className="px-4 py-2 text-right text-slate-300">{fmt(t.amount)}</td>
                            <td className="px-4 py-2 text-right text-red-500">-{fmt(t.platformFee)}</td>
                            <td className="px-4 py-2 text-right font-semibold text-green-600">{fmt(t.instructorPayout)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-800 font-semibold">
                        <tr><td colSpan={4} className="px-4 py-2 text-slate-300">Total</td><td className="px-4 py-2 text-right text-green-600">{fmt(p.totalAmount)}</td></tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* MANUAL TRANSFERS */}
        {tab === 'manual' && (
          <div className="space-y-6">
            {/* Pending Transfer */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Banknote className="h-5 w-5 text-yellow-600" />
                <h2 className="text-base font-semibold text-slate-200">Pending Transfer ({data.pendingTransferPayouts.length})</h2>
                <span className="text-xs text-slate-500">— approved, awaiting bank transfer</span>
              </div>
              {data.pendingTransferPayouts.length === 0 ? (
                <div className="bg-slate-900 rounded-lg border border-slate-800 p-8 text-center text-slate-500 text-sm">No payouts awaiting transfer</div>
              ) : (
                <div className="bg-slate-900 rounded-lg border border-slate-800 divide-y divide-slate-800">
                  {data.pendingTransferPayouts.map(p => (
                    <div key={p.id} className="p-5 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-900/40 text-yellow-300">Pending Transfer</span>
                          <span className="text-xs text-slate-500">{p.payoutRef}</span>
                        </div>
                        <Link href={`/admin/instructors/${p.instructorId}`} className="text-sm font-semibold text-slate-100 hover:text-blue-600">{p.instructorName}</Link>
                        <p className="text-xs text-slate-500 mt-0.5">{p.transactionCount} lesson{p.transactionCount !== 1 ? 's' : ''} · {p.instructorPhone || 'no phone'}</p>
                        <div className="mt-2 text-xs text-slate-500 space-y-0.5">
                          <p>BSB: <span className="font-mono font-medium text-slate-300">{p.bankBsb || 'N/A'}</span> · Account: <span className="font-mono font-medium text-slate-300">{p.bankAccount || 'N/A'}</span></p>
                          <p>Account name: <span className="font-medium text-slate-300">{p.bankAccountName || 'N/A'}</span></p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-bold text-green-600">{fmt(p.netAmount)}</p>
                        {p.taxWithheld > 0 && <p className="text-xs text-orange-500">withheld {fmt(p.taxWithheld)}</p>}
                        <button onClick={() => setMarkSentTarget(p)}
                          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">
                          <Send className="h-3.5 w-3.5" /> Mark Sent
                        </button>
                        <button onClick={() => handleHoldPayout(p.id)}
                          disabled={processing === p.id}
                          className="mt-1 flex items-center gap-1.5 px-3 py-1.5 bg-amber-900/200 text-white text-xs rounded-lg hover:bg-amber-600 disabled:opacity-50">
                          Hold
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sent — awaiting confirmation */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Send className="h-5 w-5 text-blue-600" />
                <h2 className="text-base font-semibold text-slate-200">Sent — Awaiting Confirmation ({data.sentPayouts.length})</h2>
                <span className="text-xs text-slate-500">— bank ref recorded, confirm when instructor receives</span>
              </div>
              {data.sentPayouts.length === 0 ? (
                <div className="bg-slate-900 rounded-lg border border-slate-800 p-8 text-center text-slate-500 text-sm">No payouts awaiting confirmation</div>
              ) : (
                <div className="bg-slate-900 rounded-lg border border-slate-800 divide-y divide-slate-800">
                  {data.sentPayouts.map(p => (
                    <div key={p.id} className="p-5 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-900/40 text-blue-300">Sent</span>
                          <span className="text-xs text-slate-500">{p.payoutRef}</span>
                        </div>
                        <Link href={`/admin/instructors/${p.instructorId}`} className="text-sm font-semibold text-slate-100 hover:text-blue-600">{p.instructorName}</Link>
                        <p className="text-xs text-slate-500 mt-0.5">{p.transactionCount} lesson{p.transactionCount !== 1 ? 's' : ''}</p>
                        <div className="mt-2 text-xs text-slate-500 space-y-0.5">
                          <p>Bank ref: <span className="font-mono font-medium text-slate-300">{p.bankReference || 'N/A'}</span></p>
                          {p.sentAt && <p>Sent: <span className="font-medium text-slate-300">{fmtDate(p.sentAt)}</span></p>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-bold text-green-600">{fmt(p.netAmount)}</p>
                        {p.taxWithheld > 0 && <p className="text-xs text-orange-500">withheld {fmt(p.taxWithheld)}</p>}
                        <button onClick={() => setConfirmTarget(p)}
                          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700">
                          <BadgeCheck className="h-3.5 w-3.5" /> Confirm Received
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
              <div className="text-sm text-yellow-300 space-y-1">
                <p className="font-semibold text-yellow-200">Manual Transfer Guide</p>
                <p>1. Log into your bank and transfer the exact net amount to the instructor's BSB/account.</p>
                <p>2. Click "Mark Sent" and enter the bank transaction reference number.</p>
                <p>3. Once the instructor confirms receipt, click "Confirm Received" — this updates the ledger and marks the payout as PAID.</p>
                <p className="font-medium">Never mark as confirmed unless money has actually moved.</p>
              </div>
            </div>
          </div>
        )}

        {/* WITHHELD */}
        {tab === 'withheld' && (
          <div className="space-y-4">
            {data.withheld.length === 0 ? (
              <div className="bg-slate-900 rounded-lg border border-slate-800 p-12 text-center"><CheckCircle className="h-14 w-14 text-green-400 mx-auto mb-3" /><p className="text-lg font-semibold text-slate-300">No withheld transactions</p></div>
            ) : data.withheld.map(w => (
              <div key={w.instructorId}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <Link href={`/admin/instructors/${w.instructorId}`} className="text-sm font-semibold text-slate-300 hover:text-blue-600">{w.instructorName}</Link>
                  <span className="text-xs text-slate-500">· {w.transactions.length} case{w.transactions.length !== 1 ? 's' : ''} · withheld {fmt(w.totalWithheld)}</span>
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
              <div className="bg-slate-900 rounded-lg border border-slate-800 p-12 text-center"><CheckCircle className="h-14 w-14 text-green-400 mx-auto mb-3" /><p className="text-lg font-semibold text-slate-300">No flagged disputes</p></div>
            ) : data.disputes.map(d => (
              <CaseCard key={d.id} txn={d} instructorName={d.instructorName || '—'}
                onResolve={() => openResolve(d, d.instructorId, d.instructorName || '—')} />
            ))}
          </div>
        )}

        <div className="mt-6 bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-300 space-y-1">
            <p className="font-semibold text-blue-200">Resolution Guide</p>
            <p>Eligible: lesson ended, booking confirmed/completed — safe to pay out. Stripe Connect pays immediately; bank transfer queues in Manual Transfers tab.</p>
            <p>Manual Transfers: admin must physically transfer funds, then mark sent + confirm received before ledger updates.</p>
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
