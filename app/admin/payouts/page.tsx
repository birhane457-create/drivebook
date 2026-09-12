'use client';
import { AdminPageLayout } from '@/components/ui'

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
  providerPayout: number; commissionRate: number; createdAt: string;
  bookingDate: string; bookingEndDate?: string; duration: number;
  customerName: string; pickupAddress: string; description: string;
}
interface providerPayout {
  providerId: string; instructorName: string; instructorPhone: string;
  totalAmount: number; transactionCount: number; transactions: Transaction[];
}
interface ManualPayout {
  id: string; payoutRef: string; providerId: string; instructorName: string;
  instructorPhone: string | null; bankBsb: string | null; bankAccount: string | null;
  bankAccountName: string | null; grossAmount: number; taxWithheld: number;
  netAmount: number; payoutMethod: string; transactionCount: number; createdAt: string;
  bankReference?: string; sentAt?: string; sentBy?: string;
}
interface WithheldTxn {
  id: string; bookingId: string; bookingStatus: string;
  amount: number; platformFee: number; providerPayout: number;
  bookingDate: string; bookingEndDate?: string; duration?: number;
  customerName: string; customerPhone?: string; customerEmail?: string;
  instructorPhone?: string; pickupAddress?: string; notes?: string;
  isPackageBooking?: boolean; description: string;
}
interface WithheldGroup {
  providerId: string; instructorName: string; totalWithheld: number;
  transactions: WithheldTxn[];
}
interface Dispute {
  id: string; bookingId: string; providerId: string;
  instructorName: string; instructorPhone?: string;
  customerName: string; customerPhone?: string; customerEmail?: string;
  amount: number; platformFee: number; providerPayout: number;
  description: string; bookingDate: string; bookingEndDate?: string;
  duration?: number; bookingStatus: string;
  pickupAddress?: string; notes?: string; isPackageBooking?: boolean;
}
interface PayoutData {
  pendingPayouts: providerPayout[]; totalPending: number; completedThisMonth: number;
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
type NoShowParty = 'provider' | 'customer' | 'both';

function parseNoShowParty(description?: string, noShowParty?: string | null): NoShowParty | null {
  // Prefer the proper field if available
  if (noShowParty === 'provider') return 'provider';
  if (noShowParty === 'customer') return 'customer';
  if (noShowParty === 'both') return 'both';
  // Fall back to description string for legacy records
  if (!description) return null;
  if (description.includes('INSTRUCTOR_NO_SHOW')) return 'provider';
  if (description.includes('CLIENT_NO_SHOW')) return 'customer';
  if (description.includes('DISPUTED')) return 'both';
  return null;
}

const PARTY_CONFIG: Record<NoShowParty, {
  label: string; color: string; bgColor: string; borderColor: string;
  icon: React.ReactNode; suggested: ResolveAction; tip: string; consequence: string;
}> = {
  provider: {
    label: 'Instructor no-show', color: 'text-destructive', bgColor: 'bg-red-900/20', borderColor: 'border-red-700/50',
    icon: <UserX className="h-4 w-4 text-destructive" />, suggested: 'refund_client',
    tip: 'Instructor failed to attend. Client is owed a refund.',
    consequence: 'Refund client wallet · Consider charging instructor penalty',
  },
  customer: {
    label: 'Client no-show', color: 'text-amber-400', bgColor: 'bg-orange-900/20', borderColor: 'border-orange-700/50',
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
  amount: number; platformFee: number; providerPayout: number;
  customerName: string; instructorName: string;
  bookingDate: string; bookingEndDate?: string; duration?: number;
  customerPhone?: string; customerEmail?: string; instructorPhone?: string;
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
    <div className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border-2xl w-full max-w-md">
        <div className="p-5 border-b">
          <h2 className="text-lg font-bold text-foreground">Mark Transfer Sent</h2>
          <p className="text-sm text-muted-foreground/60 mt-0.5">{payout.payoutRef}</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3 text-sm text-yellow-300">
            <p className="font-semibold mb-1">Before marking sent, confirm you have:</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              <li>Transferred {fmt(payout.netAmount)} to {payout.bankAccountName || 'provider'}</li>
              <li>BSB: {payout.bankBsb || 'N/A'} · Account: {payout.bankAccount || 'N/A'}</li>
            </ul>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Bank transaction reference</label>
            <input
              type="text"
              value={bankReference}
              onChange={e => setBankReference(e.target.value)}
              placeholder="e.g. NAB ref 123456789"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="text-xs text-muted-foreground/60 mt-1">This is stored as evidence of the transfer.</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="p-5 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={submit} disabled={loading}
            className="px-5 py-2 bg-primary text-foreground text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50">
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
    <div className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border-2xl w-full max-w-md">
        <div className="p-5 border-b">
          <h2 className="text-lg font-bold text-foreground">Confirm Payment Received</h2>
          <p className="text-sm text-muted-foreground/60 mt-0.5">{payout.payoutRef}</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-3 text-sm text-emerald-400">
            <p className="font-semibold">This will mark the payout as PAID and update the ledger.</p>
            <p className="text-xs mt-1">Only confirm if the instructor has received {fmt(payout.netAmount)}.</p>
          </div>
          <div className="bg-background rounded-lg p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground/60">Bank ref</span><span className="font-medium">{payout.bankReference || 'N/A'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground/60">Net amount</span><span className="font-semibold text-emerald-400">{fmt(payout.netAmount)}</span></div>
            {payout.taxWithheld > 0 && <div className="flex justify-between"><span className="text-muted-foreground/60">Tax withheld</span><span className="text-orange-600">{fmt(payout.taxWithheld)}</span></div>}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="p-5 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={submit} disabled={loading}
            className="px-5 py-2 bg-emerald-600 text-foreground text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">
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
  const [splitPayout, setSplitPayout] = useState(parseFloat((target.providerPayout / 2).toFixed(2)));

  const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const fmtTime = (s?: string) => s ? new Date(s).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : '—';
  const fmt = (n: number) => `$${(n || 0).toFixed(2)}`;

  const actions: { key: ResolveAction; label: string; desc: string; who: string; consequence: string; style: string }[] = [
    { key: 'refund_client', label: 'Refund Client', desc: `${fmt(target.amount)} returned to client wallet`, who: target.customerName, consequence: target.isPackageBooking ? 'Credit added back to package balance' : 'Wallet balance restored', style: 'border-blue-300 bg-primary/10' },
    { key: 'approve_for_payout', label: 'Approve for Payout', desc: `${fmt(target.providerPayout)} approved — sent during next payout run`, who: target.instructorName, consequence: 'Marks instructor as payable. Funds sent during payout processing.', style: 'border-green-300 bg-green-900/20' },
    { key: 'split', label: 'Split Resolution', desc: 'Partial refund to client + partial payout to instructor', who: 'Both parties', consequence: 'Atomic — both legs commit together or neither does.', style: 'border-purple-300 bg-violet-900/20' },
    { key: 'charge_instructor', label: 'Charge Instructor Penalty', desc: `${fmt(target.providerPayout)} deducted from next payout`, who: target.instructorName, consequence: "Penalty applied. Deducted from instructor's future earnings.", style: 'border-orange-300 bg-orange-900/20' },
    { key: 'void', label: 'Void Transaction', desc: 'No money moves — write off', who: 'Neither party', consequence: 'Transaction closed. No refund, no payout.', style: 'border-border bg-secondary' },
  ];

  const submit = async () => {
    if (!action) { setError('Select an action'); return; }
    setLoading(true); setError('');
    try {
      if (action === 'split') {
        if (splitRefund <= 0 && splitPayout <= 0) { setError('Enter at least one amount > 0'); setLoading(false); return; }
        if (splitRefund > target.amount + 0.001) { setError(`Refund cannot exceed ${fmt(target.amount)}`); setLoading(false); return; }
        if (splitPayout > target.providerPayout + 0.001) { setError(`Payout cannot exceed ${fmt(target.providerPayout)}`); setLoading(false); return; }
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
    <div className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card rounded-xl border border-border-2xl w-full max-w-lg my-4">
        <div className="p-5 border-b">
          <h2 className="text-lg font-bold text-foreground">Resolve Transaction</h2>
          <p className="text-sm text-muted-foreground/60 mt-0.5">Booking #{target.bookingId?.slice(-6)} · {fmtDate(target.bookingDate)}</p>
        </div>
        <div className="p-5 border-b space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-background rounded-lg p-3">
              <p className="text-xs text-muted-foreground/60 mb-1">Client</p>
              <p className="text-sm font-semibold text-foreground">{target.customerName}</p>
              {target.customerPhone && <p className="text-xs text-muted-foreground/60 flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{target.customerPhone}</p>}
              {target.customerEmail && <p className="text-xs text-muted-foreground/60 flex items-center gap-1 mt-0.5"><Mail className="h-3 w-3" />{target.customerEmail}</p>}
            </div>
            <div className="bg-background rounded-lg p-3">
              <p className="text-xs text-muted-foreground/60 mb-1">Instructor</p>
              <p className="text-sm font-semibold text-foreground">{target.instructorName}</p>
              {target.instructorPhone && <p className="text-xs text-muted-foreground/60 flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{target.instructorPhone}</p>}
            </div>
          </div>
          <div className="bg-background rounded-lg p-3 space-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" /><span>{fmtDate(target.bookingDate)} · {fmtTime(target.bookingDate)} – {fmtTime(target.bookingEndDate)}</span>{target.duration && <span className="text-muted-foreground/60">({Math.round(target.duration)} min)</span>}</div>
            {target.pickupAddress && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" /><span>{target.pickupAddress}</span></div>}
            {target.notes && <div className="flex items-start gap-2"><FileText className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 mt-0.5" /><span className="italic">{target.notes}</span></div>}
            {target.isPackageBooking && <div className="flex items-center gap-2 text-purple-600"><Package className="h-3.5 w-3.5 shrink-0" /><span>Package lesson — refund returns as wallet credit</span></div>}
          </div>
          <div className="bg-background rounded-lg p-3">
            <p className="text-xs text-muted-foreground/60 mb-2">Money breakdown</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Lesson price</span><span className="font-semibold text-foreground">{fmt(target.amount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Platform fee</span><span className="text-red-500">-{fmt(target.platformFee)}</span></div>
              <div className="flex justify-between border-t border-border pt-1 mt-1"><span className="text-muted-foreground">Instructor payout</span><span className="font-semibold text-emerald-400">{fmt(target.providerPayout)}</span></div>
            </div>
          </div>
          {partyConfig && (
            <div className={`rounded-lg border p-3 ${partyConfig.bgColor} ${partyConfig.borderColor}`}>
              <div className="flex items-center gap-2 mb-1">{partyConfig.icon}<span className={`text-sm font-semibold ${partyConfig.color}`}>{partyConfig.label}</span></div>
              <p className={`text-xs ${partyConfig.color}`}>{partyConfig.tip}</p>
              <p className={`text-xs font-medium mt-1 ${partyConfig.color}`}>→ {partyConfig.consequence}</p>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
            <span>Booking status:</span>
            <span className={`px-2 py-0.5 rounded-full font-medium ${target.bookingStatus === 'NO_SHOW' ? 'bg-orange-900/40 text-orange-300' : target.bookingStatus === 'CANCELLED' ? 'bg-red-900/40 text-destructive' : 'bg-secondary text-muted-foreground'}`}>{target.bookingStatus}</span>
          </div>
        </div>
        <div className="p-5 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide mb-3">Choose resolution</p>
          {actions.map(a => (
            <button key={a.key} onClick={() => setAction(a.key)}
              className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${action === a.key ? `${a.style} border-opacity-100` : 'border-border hover:border-border bg-card'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground text-sm">{a.label}</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">{a.desc}</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5 italic">{a.consequence}</p>
                </div>
                {action === a.key && <CheckCircle className="h-4 w-4 text-foreground shrink-0 mt-0.5" />}
              </div>
            </button>
          ))}
          <div className="pt-1">
            {action === 'split' && (
              <div className="mb-3 p-3 bg-violet-900/20 border border-violet-700/50 rounded-lg space-y-2">
                <p className="text-xs font-semibold text-purple-700 mb-2">Split amounts</p>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground w-32 shrink-0">Refund to client ($)</label>
                  <input type="number" min={0} max={target.amount} step={0.01} value={splitRefund} onChange={e => setSplitRefund(parseFloat(e.target.value) || 0)} className="flex-1 border border-border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                  <span className="text-xs text-muted-foreground/60">max {fmt(target.amount)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground w-32 shrink-0">Payout to instructor ($)</label>
                  <input type="number" min={0} max={target.providerPayout} step={0.01} value={splitPayout} onChange={e => setSplitPayout(parseFloat(e.target.value) || 0)} className="flex-1 border border-border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                  <span className="text-xs text-muted-foreground/60">max {fmt(target.providerPayout)}</span>
                </div>
              </div>
            )}
            <label className="block text-xs font-medium text-muted-foreground mb-1">Admin note (optional)</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="e.g. Instructor confirmed via phone they didn't attend" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="p-5 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={submit} disabled={!action || loading}
            className="px-5 py-2 bg-background text-foreground text-sm rounded-lg hover:bg-card disabled:opacity-50">
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
            <span className={`text-sm font-bold ${isDispute ? 'text-destructive' : isNoShow ? 'text-amber-400' : 'text-yellow-700'}`}>{isDispute ? 'Dispute' : isNoShow ? 'No-Show' : 'Cancelled'}</span>
            {partyConfig && <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${partyConfig.bgColor} ${partyConfig.borderColor} ${partyConfig.color}`}>{partyConfig.icon} {partyConfig.label}</span>}
            {txn.isPackageBooking && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-900/40 text-violet-300 border border-violet-700/50"><Package className="h-3 w-3" /> Package</span>}
          </div>
          <p className="text-sm text-foreground"><span className="font-medium">{txn.customerName || '—'}</span><span className="text-muted-foreground/60 mx-1">→</span><span className="font-medium">{instructorName}</span></p>
          <p className="text-xs text-muted-foreground/60 mt-0.5 flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDate(txn.bookingDate)} · {fmtTime(txn.bookingDate)} – {fmtTime(txn.bookingEndDate)}{txn.duration && <span className="text-muted-foreground/60">({Math.round(txn.duration)} min)</span>}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <p className="text-sm font-bold text-foreground">{fmt(txn.amount)}</p>
            <p className="text-xs text-muted-foreground/60">→ {fmt(txn.providerPayout)} instructor</p>
          </div>
          <button onClick={() => setOpen(v => !v)} className="p-1.5 rounded-lg hover:bg-card/60 text-muted-foreground/60">{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
        </div>
      </div>
      {open && (
        <div className="px-4 py-4 bg-card border-t border-border space-y-3">
          {partyConfig && (
            <div className={`rounded-lg border p-3 ${partyConfig.bgColor} ${partyConfig.borderColor}`}>
              <p className={`text-xs font-semibold ${partyConfig.color} mb-0.5`}>What this means</p>
              <p className={`text-xs ${partyConfig.color}`}>{partyConfig.tip}</p>
              <p className={`text-xs font-medium mt-1 ${partyConfig.color}`}>Recommended: {partyConfig.consequence}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground/60 font-medium mb-1">Client</p>
              <p className="text-foreground font-medium">{txn.customerName || '—'}</p>
              {txn.customerPhone && <p className="text-muted-foreground/60 flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{txn.customerPhone}</p>}
              {txn.customerEmail && <p className="text-muted-foreground/60 flex items-center gap-1 mt-0.5"><Mail className="h-3 w-3" />{txn.customerEmail}</p>}
            </div>
            <div>
              <p className="text-muted-foreground/60 font-medium mb-1">Instructor</p>
              <p className="text-foreground font-medium">{instructorName}</p>
              {txn.instructorPhone && <p className="text-muted-foreground/60 flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{txn.instructorPhone}</p>}
            </div>
          </div>
          {(txn.pickupAddress || txn.notes) && (
            <div className="text-xs space-y-1 text-muted-foreground/60">
              {txn.pickupAddress && <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3 shrink-0 text-muted-foreground/60" />{txn.pickupAddress}</p>}
              {txn.notes && <p className="flex items-start gap-1.5"><FileText className="h-3 w-3 shrink-0 text-muted-foreground/60 mt-0.5" /><span className="italic">{txn.notes}</span></p>}
            </div>
          )}
          <div className="bg-background rounded-lg p-3 text-xs space-y-1">
            <p className="text-muted-foreground/60 font-medium mb-1.5">Money breakdown</p>
            <div className="flex justify-between"><span className="text-muted-foreground">Paid by client</span><span className="font-semibold">{fmt(txn.amount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Platform fee</span><span className="text-red-500">-{fmt(txn.platformFee)}</span></div>
            <div className="flex justify-between border-t border-border pt-1 mt-1"><span className="text-muted-foreground">Instructor payout</span><span className="font-semibold text-emerald-400">{fmt(txn.providerPayout)}</span></div>
          </div>
          <button onClick={onResolve} className={`w-full py-2.5 rounded-lg text-sm font-semibold text-foreground transition-colors ${isDispute ? 'bg-destructive hover:bg-destructive/90' : isNoShow ? 'bg-orange-600 hover:bg-orange-700' : 'bg-yellow-600 hover:bg-yellow-700'}`}>Resolve this case</button>
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

  const processPayout = async (providerId: string) => {
    setProcessing(providerId);
    try {
      const res = await fetch('/api/admin/payouts/process', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId }),
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

  const openResolve = (t: WithheldTxn | Dispute, providerId: string, instructorName: string) =>
    setResolveTarget({
      transactionId: t.id, bookingId: t.bookingId,
      amount: t.amount, platformFee: t.platformFee, providerPayout: t.providerPayout,
      customerName: t.customerName || '—', instructorName,
      bookingDate: t.bookingDate, bookingEndDate: t.bookingEndDate, duration: t.duration,
      customerPhone: t.customerPhone, customerEmail: t.customerEmail, instructorPhone: t.instructorPhone,
      pickupAddress: t.pickupAddress, notes: t.notes, isPackageBooking: t.isPackageBooking,
      bookingStatus: t.bookingStatus, description: t.description,
      noShowParty: parseNoShowParty(t.description, (t as any).noShowParty),
    });

  const fmt = (n: number) => `$${(n || 0).toFixed(2)}`;
  const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const manualCount = (data?.stats.pendingTransferCount ?? 0) + (data?.stats.sentCount ?? 0);

  if (loading) return <div className="min-h-screen bg-background text-foreground"><AdminNav /><div className="max-w-7xl mx-auto px-4 py-8 text-muted-foreground/60">Loading payout data...</div></div>;
  if (!data) return <div className="min-h-screen bg-background text-foreground"><AdminNav /><div className="max-w-7xl mx-auto px-4 py-8 text-red-500">Failed to load payout data.</div></div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdminPageLayout title="Payout Management" breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'S' }]}>

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
            <h1 className="text-3xl font-bold text-foreground">Payout Management</h1>
            <p className="text-muted-foreground/60 mt-1">Review and process instructor payouts</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchPayouts} className="p-2 text-muted-foreground/60 hover:text-muted-foreground rounded-lg hover:bg-secondary"><RefreshCw className="h-4 w-4" /></button>
            <button onClick={processAll} disabled={processing !== null || data.pendingPayouts.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-foreground rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 text-sm">
              <DollarSign className="h-4 w-4" /> Process All Eligible ({fmt(data.totalPending)})
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Pending Payout', value: fmt(data.totalPending), sub: `${data.stats.eligibleCount} txns`, color: 'text-primary' },
            { label: 'Paid This Month', value: fmt(data.completedThisMonth), sub: 'completed', color: 'text-emerald-400' },
            { label: 'Manual Queue', value: String(manualCount), sub: `${data.stats.pendingTransferCount} pending · ${data.stats.sentCount} sent`, color: 'text-yellow-600' },
            { label: 'No-Shows', value: String(data.stats.noShowCount), sub: 'total', color: 'text-orange-600' },
            { label: 'Disputes', value: String(data.stats.disputeCount), sub: 'flagged', color: 'text-destructive' },
          ].map(s => (
            <div key={s.label} className="bg-card rounded-lg border border-border p-4">
              <p className="text-xs text-muted-foreground/60 mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-card rounded-lg border border-border p-1 w-fit flex-wrap">
          {([
            { key: 'eligible' as Tab, label: `Eligible (${data.pendingPayouts.length})` },
            { key: 'manual' as Tab, label: `Manual Transfers (${manualCount})`, alert: manualCount > 0 },
            { key: 'withheld' as Tab, label: `Withheld (${data.withheld.reduce((s: any, w: any) => s + w.transactions.length, 0)})` },
            { key: 'disputes' as Tab, label: `Disputes (${data.disputes.length})` },
          ]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === t.key ? 'bg-primary text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
              {t.label}
              {t.alert && tab !== t.key && <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />}
            </button>
          ))}
        </div>

        {/* ELIGIBLE */}
        {tab === 'eligible' && (
          <div className="bg-card rounded-lg border border-border divide-y divide-border">
            {data.pendingPayouts.length === 0 ? (
              <div className="p-12 text-center"><CheckCircle className="h-14 w-14 text-emerald-400 mx-auto mb-3" /><p className="text-lg font-semibold text-foreground">All caught up — no pending payouts</p></div>
            ) : data.pendingPayouts.map(p => (
              <div key={p.providerId} className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <Link href={`/admin/instructors/${p.providerId}`} className="text-base font-semibold text-foreground hover:text-primary">{p.instructorName}</Link>
                    <p className="text-sm text-muted-foreground/60">{p.transactionCount} lesson{p.transactionCount !== 1 ? 's' : ''} · {p.instructorPhone || 'no phone'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-emerald-400">{fmt(p.totalAmount)}</span>
                    <button onClick={() => processPayout(p.providerId)} disabled={processing !== null}
                      className="px-3 py-1.5 bg-primary text-foreground text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50">
                      {processing === p.providerId ? 'Processing...' : 'Pay'}
                    </button>
                    <button onClick={() => toggle(p.providerId)} className="text-muted-foreground/60 hover:text-muted-foreground">
                      {expanded.has(p.providerId) ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                {expanded.has(p.providerId) && (
                  <div className="mt-4 bg-secondary rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-secondary text-muted-foreground text-left">
                        <tr><th className="px-4 py-2">Client</th><th className="px-4 py-2">Date</th><th className="px-4 py-2 text-right">Total</th><th className="px-4 py-2 text-right">Fee</th><th className="px-4 py-2 text-right">Instructor</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {p.transactions.map(t => (
                          <tr key={t.id} className="hover:bg-secondary">
                            <td className="px-4 py-2 text-foreground">{t.customerName || '—'}</td>
                            <td className="px-4 py-2 text-muted-foreground/60">{fmtDate(t.bookingDate)}</td>
                            <td className="px-4 py-2 text-right text-foreground">{fmt(t.amount)}</td>
                            <td className="px-4 py-2 text-right text-red-500">-{fmt(t.platformFee)}</td>
                            <td className="px-4 py-2 text-right font-semibold text-emerald-400">{fmt(t.providerPayout)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-secondary font-semibold">
                        <tr><td colSpan={4} className="px-4 py-2 text-foreground">Total</td><td className="px-4 py-2 text-right text-emerald-400">{fmt(p.totalAmount)}</td></tr>
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
                <h2 className="text-base font-semibold text-foreground">Pending Transfer ({data.pendingTransferPayouts.length})</h2>
                <span className="text-xs text-muted-foreground/60">— approved, awaiting bank transfer</span>
              </div>
              {data.pendingTransferPayouts.length === 0 ? (
                <div className="bg-card rounded-lg border border-border p-8 text-center text-muted-foreground/60 text-sm">No payouts awaiting transfer</div>
              ) : (
                <div className="bg-card rounded-lg border border-border divide-y divide-border">
                  {data.pendingTransferPayouts.map(p => (
                    <div key={p.id} className="p-5 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-900/40 text-yellow-300">Pending Transfer</span>
                          <span className="text-xs text-muted-foreground/60">{p.payoutRef}</span>
                        </div>
                        <Link href={`/admin/instructors/${p.providerId}`} className="text-sm font-semibold text-foreground hover:text-primary">{p.instructorName}</Link>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">{p.transactionCount} lesson{p.transactionCount !== 1 ? 's' : ''} · {p.instructorPhone || 'no phone'}</p>
                        <div className="mt-2 text-xs text-muted-foreground/60 space-y-0.5">
                          <p>BSB: <span className="font-mono font-medium text-foreground">{p.bankBsb ? `•••-${p.bankBsb.slice(-3)}` : 'N/A'}</span> · Account: <span className="font-mono font-medium text-foreground">{p.bankAccount || 'N/A'}</span></p>
                          <p>Account name: <span className="font-medium text-foreground">{p.bankAccountName || 'N/A'}</span></p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-bold text-emerald-400">{fmt(p.netAmount)}</p>
                        {p.taxWithheld > 0 && <p className="text-xs text-orange-500">withheld {fmt(p.taxWithheld)}</p>}
                        <button onClick={() => setMarkSentTarget(p)}
                          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-primary text-foreground text-xs rounded-lg hover:bg-primary/90">
                          <Send className="h-3.5 w-3.5" /> Mark Sent
                        </button>
                        <button onClick={() => handleHoldPayout(p.id)}
                          disabled={processing === p.id}
                          className="mt-1 flex items-center gap-1.5 px-3 py-1.5 bg-amber-900/200 text-foreground text-xs rounded-lg hover:bg-amber-600 disabled:opacity-50">
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
                <Send className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Sent — Awaiting Confirmation ({data.sentPayouts.length})</h2>
                <span className="text-xs text-muted-foreground/60">— bank ref recorded, confirm when instructor receives</span>
              </div>
              {data.sentPayouts.length === 0 ? (
                <div className="bg-card rounded-lg border border-border p-8 text-center text-muted-foreground/60 text-sm">No payouts awaiting confirmation</div>
              ) : (
                <div className="bg-card rounded-lg border border-border divide-y divide-border">
                  {data.sentPayouts.map(p => (
                    <div key={p.id} className="p-5 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-900/40 text-primary">Sent</span>
                          <span className="text-xs text-muted-foreground/60">{p.payoutRef}</span>
                        </div>
                        <Link href={`/admin/instructors/${p.providerId}`} className="text-sm font-semibold text-foreground hover:text-primary">{p.instructorName}</Link>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">{p.transactionCount} lesson{p.transactionCount !== 1 ? 's' : ''}</p>
                        <div className="mt-2 text-xs text-muted-foreground/60 space-y-0.5">
                          <p>Bank ref: <span className="font-mono font-medium text-foreground">{p.bankReference || 'N/A'}</span></p>
                          {p.sentAt && <p>Sent: <span className="font-medium text-foreground">{fmtDate(p.sentAt)}</span></p>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-bold text-emerald-400">{fmt(p.netAmount)}</p>
                        {p.taxWithheld > 0 && <p className="text-xs text-orange-500">withheld {fmt(p.taxWithheld)}</p>}
                        <button onClick={() => setConfirmTarget(p)}
                          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-foreground text-xs rounded-lg hover:bg-green-700">
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
              <div className="bg-card rounded-lg border border-border p-12 text-center"><CheckCircle className="h-14 w-14 text-emerald-400 mx-auto mb-3" /><p className="text-lg font-semibold text-foreground">No withheld transactions</p></div>
            ) : data.withheld.map(w => (
              <div key={w.providerId}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <Link href={`/admin/instructors/${w.providerId}`} className="text-sm font-semibold text-foreground hover:text-primary">{w.instructorName}</Link>
                  <span className="text-xs text-muted-foreground/60">· {w.transactions.length} case{w.transactions.length !== 1 ? 's' : ''} · withheld {fmt(w.totalWithheld)}</span>
                </div>
                <div className="space-y-3">
                  {w.transactions.map(t => (
                    <CaseCard key={t.id} txn={t} instructorName={w.instructorName}
                      onResolve={() => openResolve(t, w.providerId, w.instructorName)} />
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
              <div className="bg-card rounded-lg border border-border p-12 text-center"><CheckCircle className="h-14 w-14 text-emerald-400 mx-auto mb-3" /><p className="text-lg font-semibold text-foreground">No flagged disputes</p></div>
            ) : data.disputes.map(d => (
              <CaseCard key={d.id} txn={d} instructorName={d.instructorName || '—'}
                onResolve={() => openResolve(d, d.providerId, d.instructorName || '—')} />
            ))}
          </div>
        )}

        <div className="mt-6 bg-primary/10 border border-blue-700/50 rounded-lg p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm text-primary space-y-1">
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
          <div className={`rounded-lg shadow-lg px-4 py-3 text-sm text-foreground ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-destructive'}`}>
            {toast.message}
          </div>
        </div>
      )}
 
      </AdminPageLayout>
    </div>
  )
}
