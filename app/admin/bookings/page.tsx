'use client';
import { AdminPageLayout } from '@/components/ui'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminNav from '@/components/admin/AdminNav';
import { formatBookingId } from '@/lib/utils';
import {
  RefreshCw, AlertTriangle, Pencil, X, CheckCircle,
  XCircle, Ban, ExternalLink, Clock, Info, Package, User, UserX
} from 'lucide-react';
import { getStatusConfig } from '@/lib/config/booking-status';

interface Booking {
  id: string; startTime: string; endTime: string; status: string;
  bookingType?: string; price: number; platformFee: number; providerPayout: number;
  pickupAddress?: string; dropoffAddress?: string; notes?: string;
  isPaid: boolean; duration: number;
  isPackageBooking?: boolean; parentBookingId?: string;
  customerName?: string; clientPhone?: string;
  client?: { id: string; name: string; email: string; phone: string };
  provider: { id: string; name: string; phone: string };
}

interface Stats {
  total: number; confirmed: number; pending: number;
  completed: number; cancelled: number; noShow: number; endedConfirmed: number;
}

// Status styles now come from lib/config/booking-status.ts (getStatusConfig)

function getActionRules(b: any, now: Date) {
  const started = b.startTime ? new Date(b.startTime) <= now : false;
  const ended = b.endTime ? new Date(b.endTime) <= now : false;
  const isFinal = b.status === 'COMPLETED' || b.status === 'CANCELLED' || b.status === 'NO_SHOW';
  return {
    canComplete: (b.status === 'CONFIRMED' || b.status === 'PENDING') && ended,
    completeBlockReason: !ended && b.endTime
      ? `Lesson ends ${new Date(b.endTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })} on ${new Date(b.endTime).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
      : null,
    canNoShow: b.status === 'CONFIRMED' && started,
    noShowBlockReason: !started ? `Lesson hasn't started yet` : null,
    canCancel: !isFinal,
    canConfirm: b.status === 'PENDING',
    isFinal, ended, started,
  };
}

// ─── No-show party picker step ───────────────────────────────────────────────
function NoShowPartyStep({
  booking,
  onSelect,
  onBack,
}: {
  booking: any;
  onSelect: (party: 'provider' | 'customer' | 'both') => void;
  onBack: () => void;
}) {
  const customerName = booking.customerName || booking.customer?.name || 'Client';
  const isPackage = booking.isPackageBooking;

  const options: { party: 'provider' | 'customer' | 'both'; label: string; sub: string; icon: React.ReactNode; resolution: string }[] = [
    {
      party: 'provider',
      label: `${booking.provider?.name || 'provider'} didn't show`,
      sub: 'Instructor failed to attend',
      icon: <UserX className="h-5 w-5 text-red-500" />,
      resolution: isPackage
        ? 'Lesson credit returned to package · Instructor charged penalty'
        : 'Client wallet refunded · Instructor charged penalty',
    },
    {
      party: 'customer',
      label: `${customerName} didn't show`,
      sub: 'Client failed to attend',
      icon: <User className="h-5 w-5 text-orange-500" />,
      resolution: 'Instructor gets paid · Client forfeits lesson',
    },
    {
      party: 'both',
      label: 'Both / Disputed',
      sub: 'Unclear or contested — needs review',
      icon: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
      resolution: 'Moves to Disputes tab for manual resolution',
    },
  ];

  return (
    <div className="px-5 py-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <button onClick={onBack} className="text-xs text-muted-foreground/60 hover:text-muted-foreground">← Back</button>
        <p className="text-sm font-semibold text-foreground">Who didn't show up?</p>
      </div>
      <p className="text-xs text-muted-foreground/60 -mt-1">This determines the resolution path in Payouts.</p>
      {options.map(o => (
        <button
          key={o.party}
          onClick={() => onSelect(o.party)}
          className="w-full text-left rounded-lg border border-border px-4 py-3 hover:bg-secondary transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5">{o.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{o.label}</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">{o.sub}</p>
              <p className="text-xs text-primary mt-1 font-medium">→ {o.resolution}</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Completed confirmation screen ───────────────────────────────────────────
function CompletedScreen({ booking, onClose }: { booking: any; onClose: () => void }) {
  const router = useRouter();
  const customerName = booking.customerName || booking.customer?.name || 'Client';
  return (
    <div className="px-5 py-6 flex flex-col items-center text-center gap-4">
      <div className="w-14 h-14 rounded-full bg-blue-900/40 flex items-center justify-center">
        <CheckCircle className="h-7 w-7 text-primary" />
      </div>
      <div>
        <p className="text-lg font-semibold text-foreground">Marked Complete</p>
        <p className="text-sm text-muted-foreground/60 mt-1">
          {customerName}'s lesson with {booking.provider?.name} is complete.
        </p>
      </div>
      <div className="w-full bg-primary/10 border border-blue-700/50 rounded-lg p-4 text-left">
        <p className="text-sm font-medium text-primary flex items-center gap-2">
          <Info className="h-4 w-4 shrink-0" />
          Instructor payout now eligible
        </p>
        <p className="text-xs text-primary mt-1">
          ${(booking.providerPayout || 0).toFixed(2)} for {booking.provider?.name} is ready to process.
        </p>
        {booking.isPackageBooking && (
          <p className="text-xs text-primary mt-1 flex items-center gap-1">
            <Package className="h-3 w-3" /> Package lesson — drawn from client's package balance.
          </p>
        )}
        <button onClick={() => router.push('/admin/payouts')}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary hover:text-blue-200 underline">
          Go to Payout Management <ExternalLink className="h-3 w-3" />
        </button>
      </div>
      <div className="flex gap-3 w-full">
        <button onClick={onClose} className="flex-1 px-4 py-2 bg-secondary text-foreground rounded-lg text-sm hover:bg-secondary/70">Close</button>
        <button onClick={() => router.push('/admin/payouts')} className="flex-1 px-4 py-2 bg-primary text-foreground rounded-lg text-sm hover:bg-primary/90">View Payouts</button>
      </div>
    </div>
  );
}

// ─── No-show confirmation screen ─────────────────────────────────────────────
function NoShowScreen({
  booking, party, onClose,
}: { booking: any; party: 'provider' | 'provider' | 'customer' | 'both'; onClose: () => void }) {
  const router = useRouter();
  const isPackage = booking.isPackageBooking;
  // Normalise: legacy 'provider' maps to 'provider'
  const normalizedParty: 'provider' | 'customer' | 'both' =
    party === 'provider' ? 'provider' : (party as 'provider' | 'customer' | 'both');

  const info = {
    provider: {
      title: 'Instructor No-Show Recorded',
      color: 'red',
      steps: isPackage
        ? ['Lesson marked NO_SHOW', 'Goes to Withheld in Payouts', 'Resolve → "Refund Client" returns credit to package', 'Resolve → "Charge Instructor" applies penalty']
        : ['Lesson marked NO_SHOW', 'Goes to Withheld in Payouts', 'Resolve → "Refund Client" credits wallet back', 'Resolve → "Charge Instructor" applies penalty'],
    },
    customer: {
      title: 'Client No-Show Recorded',
      color: 'orange',
      steps: ['Lesson marked NO_SHOW', 'Goes to Withheld in Payouts', 'Resolve → "Pay Instructor" releases their payout', 'Client forfeits the lesson (no refund)'],
    },
    both: {
      title: 'Dispute Flagged',
      color: 'yellow',
      steps: ['Lesson marked NO_SHOW', 'Goes to Disputes tab in Payouts', 'Admin reviews and resolves manually', 'Choose: refund client, pay instructor, charge penalty, or void'],
    },
  }[normalizedParty]!;

  const colorMap: Record<string, string> = {
    red: 'bg-red-900/20 border-red-700/50 text-destructive',
    orange: 'bg-orange-900/20 border-orange-700/50 text-orange-300',
    yellow: 'bg-yellow-900/20 border-yellow-700/50 text-yellow-300',
  };

  return (
    <div className="px-5 py-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${party === 'provider' ? 'bg-red-900/40' : party === 'customer' ? 'bg-orange-100' : 'bg-yellow-900/40'}`}>
          <XCircle className={`h-5 w-5 ${party === 'provider' ? 'text-destructive' : party === 'customer' ? 'text-orange-600' : 'text-yellow-600'}`} />
        </div>
        <p className="font-semibold text-foreground">{info.title}</p>
      </div>
      <div className={`rounded-lg border p-4 ${colorMap[info.color]}`}>
        <p className="text-xs font-semibold mb-2 uppercase tracking-wide opacity-70">Resolution steps</p>
        <ol className="space-y-1">
          {info.steps.map((s, i) => (
            <li key={i} className="text-xs flex items-start gap-2">
              <span className="font-bold shrink-0">{i + 1}.</span> {s}
            </li>
          ))}
        </ol>
      </div>
      {isPackage && (
        <div className="flex items-center gap-2 text-xs text-purple-700 bg-violet-900/20 border border-violet-700/50 rounded-lg px-3 py-2">
          <Package className="h-3.5 w-3.5 shrink-0" />
          Package lesson — refund returns credit to wallet, not a card refund.
        </div>
      )}
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 px-4 py-2 bg-secondary text-foreground rounded-lg text-sm hover:bg-secondary/70">Close</button>
        <button onClick={() => router.push('/admin/payouts')} className="flex-1 px-4 py-2 bg-orange-600 text-foreground rounded-lg text-sm hover:bg-orange-700">
          Go to Payouts
        </button>
      </div>
    </div>
  );
}

// ─── Main edit drawer ─────────────────────────────────────────────────────────
function BookingEditDrawer({
  booking, onClose, onUpdated,
}: { booking: any; onClose: () => void; onUpdated: () => void }) {
  const [step, setStep] = useState<'actions' | 'noshow-party' | 'done-complete' | 'done-noshow'>('actions');
  const [noShowParty, setNoShowParty] = useState<'provider' | 'customer' | 'both' | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const now = new Date();
  const rules = getActionRules(booking, now);
  const customerName = booking.customerName || booking.customer?.name || 'Unknown';
  const isPackage = booking.isPackageBooking;

  const updateStatus = async (status: string, noShowPartyValue?: string) => {
    setUpdating(status);
    try {
      const res = await fetch('/api/admin/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id, status, noShowParty: noShowPartyValue }),
      });
      const d = await res.json();
      if (res.ok) {
        onUpdated();
        if (status === 'COMPLETED') setStep('done-complete');
        else if (status === 'NO_SHOW') setStep('done-noshow');
        else onClose();
      } else {
        setToast(d.error || 'Failed to update.');
      }
    } catch { setToast('Failed to update booking.'); }
    finally { setUpdating(null); }
  };

  const handleNoShowPartySelect = (party: 'provider' | 'customer' | 'both') => {
    setNoShowParty(party);
    updateStatus('NO_SHOW', party);
  };

  const cancelBooking = async () => {
    setUpdating('CANCELLED');
    try {
      const res = await fetch(`/api/bookings/${booking.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelled by admin' }),
      });
      if (res.ok) { onUpdated(); onClose(); }
      else { const d = await res.json(); setToast(d.error || 'Failed.'); }
    } catch { setToast('Failed to cancel.'); }
    finally { setUpdating(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-card rounded-t-2xl md:rounded-2xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div>
              <p className="font-semibold text-foreground flex items-center gap-2">
                {customerName}
                {isPackage && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-violet-900/40 text-violet-300 text-xs rounded-full font-medium">
                    <Package className="h-3 w-3" /> Package
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground/60">
                #{formatBookingId(booking.id)} · {new Date(booking.startTime).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground/60">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Booking summary strip */}
        {step === 'actions' && (
          <div className="px-5 py-3 bg-secondary border-b border-border grid grid-cols-3 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground/60">Instructor</p>
              <p className="font-medium text-foreground">{booking.provider?.name || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground/60">Time</p>
              <p className="font-medium text-foreground">
                {new Date(booking.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                {' – '}
                {booking.endTime ? new Date(booking.endTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : '?'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground/60">Price</p>
              <p className="font-medium text-foreground">${booking.price.toFixed(2)}</p>
            </div>
          </div>
        )}

        {/* Package info banner */}
        {step === 'actions' && isPackage && (
          <div className="px-5 py-2 bg-violet-900/20 border-b border-purple-100 flex items-center gap-2 text-xs text-purple-700">
            <Package className="h-3.5 w-3.5 shrink-0" />
            Package lesson — refunds return as wallet credit, not a card refund.
          </div>
        )}

        {/* Status strip */}
        {step === 'actions' && (
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <span className="text-xs text-muted-foreground/60">Status:</span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusConfig(booking.status).badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${getStatusConfig(booking.status).dot}`} />
              {getStatusConfig(booking.status).label}
            </span>
            {rules.ended && booking.status === 'CONFIRMED' && (
              <span className="text-xs text-purple-400 font-medium flex items-center gap-1">
                <Clock className="h-3 w-3" /> Lesson ended
              </span>
            )}
          </div>
        )}

        {/* Step content */}
        {step === 'actions' && (
          <div className="px-5 py-4 space-y-2">
            {rules.isFinal ? (
              <p className="text-sm text-muted-foreground/60 text-center py-4">
                This booking is <span className="font-medium text-muted-foreground">{booking.status}</span> — no further actions available.
              </p>
            ) : (
              <>
                {/* Complete */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <button
                    disabled={!rules.canComplete || !!updating}
                    onClick={() => rules.canComplete && updateStatus('COMPLETED')}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${rules.canComplete ? 'hover:bg-primary/10 cursor-pointer' : 'opacity-50 cursor-not-allowed bg-secondary'}`}
                  >
                    <CheckCircle className={`h-5 w-5 shrink-0 ${rules.canComplete ? 'text-primary' : 'text-muted-foreground/60'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${rules.canComplete ? 'text-primary' : 'text-muted-foreground/60'}`}>Mark as Completed</p>
                      {rules.completeBlockReason
                        ? <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5"><Clock className="h-3 w-3 shrink-0" /> {rules.completeBlockReason}</p>
                        : <p className="text-xs text-muted-foreground/60 mt-0.5">Releases instructor payout of ${(booking.providerPayout || 0).toFixed(2)}</p>
                      }
                    </div>
                    {updating === 'COMPLETED' && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />}
                  </button>
                </div>

                {/* No-Show */}
                {booking.status === 'CONFIRMED' && (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <button
                      disabled={!rules.canNoShow || !!updating}
                      onClick={() => rules.canNoShow && setStep('noshow-party')}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${rules.canNoShow ? 'hover:bg-orange-900/20 cursor-pointer' : 'opacity-50 cursor-not-allowed bg-secondary'}`}
                    >
                      <XCircle className={`h-5 w-5 shrink-0 ${rules.canNoShow ? 'text-orange-500' : 'text-muted-foreground/60'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${rules.canNoShow ? 'text-amber-400' : 'text-muted-foreground/60'}`}>Mark as No-Show</p>
                        {rules.noShowBlockReason
                          ? <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5"><Clock className="h-3 w-3 shrink-0" /> {rules.noShowBlockReason}</p>
                          : <p className="text-xs text-muted-foreground/60 mt-0.5">You'll be asked who didn't show — determines resolution</p>
                        }
                      </div>
                    </button>
                  </div>
                )}

                {/* Confirm pending */}
                {booking.status === 'PENDING' && (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <button disabled={!!updating} onClick={() => updateStatus('CONFIRMED')}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-green-900/20 transition-colors">
                      <CheckCircle className="h-5 w-5 shrink-0 text-emerald-400" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-emerald-400">Confirm Booking</p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">Approve this pending booking</p>
                      </div>
                      {updating === 'CONFIRMED' && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600" />}
                    </button>
                  </div>
                )}

                {/* Cancel */}
                <div className="rounded-lg border border-red-100 overflow-hidden">
                  <button disabled={!!updating} onClick={cancelBooking}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-900/20 transition-colors">
                    <Ban className="h-5 w-5 shrink-0 text-red-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-destructive">Cancel Booking</p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        {isPackage ? 'Lesson credit returned to package · Notifies both parties' : 'Notifies client and instructor'}
                      </p>
                    </div>
                    {updating === 'CANCELLED' && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500" />}
                  </button>
                </div>
              </>
            )}
            {toast && <div className="px-3 py-2 bg-red-900/20 border border-red-700/50 rounded-lg text-xs text-destructive">{toast}</div>}
          </div>
        )}

        {step === 'noshow-party' && (
          <NoShowPartyStep
            booking={booking}
            onSelect={handleNoShowPartySelect}
            onBack={() => setStep('actions')}
          />
        )}

        {step === 'done-complete' && (
          <CompletedScreen booking={booking} onClose={onClose} />
        )}

        {step === 'done-noshow' && noShowParty && (
          <NoShowScreen booking={booking} party={noShowParty} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
    hasMore: false,
  });

  useEffect(() => { fetchBookings(1); }, []);

  // C-14 fix: debounced search re-fetches from API instead of filtering client-side.
  // The old approach filtered the 50-row page slice, missing bookings on other pages.
  useEffect(() => {
    const t = setTimeout(() => { fetchBookings(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchBookings = async (page: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/bookings?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setBookings(data.bookings || data);
        setStats(data.stats || null);
        if (data.pagination) {
          setPagination(data.pagination);
        }
      } else showToast('error', 'Failed to load bookings.');
    } catch { showToast('error', 'Failed to load bookings.'); }
    finally { setLoading(false); }
  };

  // Search is now server-side (C-14 fix) — bookings from API are already filtered.
  // statusFilter still applied client-side since it filters the current page view only;
  // for exact status counts, the stats object (from DB) is used in the stats bar.
  const now = new Date();
  const filtered = bookings.filter((b: any) => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    return true;
  });

  const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtTime = (s: string) => new Date(s).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });

  if (loading) return (
    <div className="min-h-screen bg-background text-foreground"><AdminNav />
      <div className="max-w-7xl mx-auto px-4 py-8 flex items-center gap-3 text-muted-foreground/60">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" /> Loading bookings...
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdminPageLayout title="All Bookings" breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'S' }]}>
      <div className="max-w-7xl mx-auto px-4 py-8">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">All Bookings</h1>
            <p className="text-sm text-muted-foreground/60 mt-1">Click Manage to update a booking's status</p>
          </div>
          <button onClick={() => fetchBookings(pagination.page)} className="p-2 text-muted-foreground/60 hover:text-muted-foreground rounded-lg hover:bg-secondary">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 md:grid-cols-7 gap-3 mb-6">
            {[
              { label: 'Total', value: pagination.total, color: 'text-foreground' },
              { label: 'Confirmed', value: stats.confirmed, color: 'text-emerald-400' },
              { label: 'Pending', value: stats.pending, color: 'text-yellow-600' },
              { label: 'Completed', value: stats.completed, color: 'text-primary' },
              { label: 'Cancelled', value: stats.cancelled, color: 'text-destructive' },
              { label: 'No-Show', value: stats.noShow, color: 'text-orange-600' },
              { label: 'Ended (unpaid)', value: stats.endedConfirmed, color: 'text-purple-600' },
            ].map(s => (
              <div key={s.label} className="bg-card rounded-lg border border-border p-3 text-center">
                <p className="text-xs text-muted-foreground/60">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {stats && stats.endedConfirmed > 0 && (
          <div className="mb-4 bg-violet-900/20 border border-violet-700/50 rounded-lg px-4 py-3 flex items-center gap-3 text-sm text-violet-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              {stats.endedConfirmed} lesson{stats.endedConfirmed !== 1 ? 's have' : ' has'} ended but {stats.endedConfirmed !== 1 ? 'are' : 'is'} still <strong>CONFIRMED</strong> — click Manage to mark complete and release payouts.
            </span>
          </div>
        )}

        {/* Filters */}
        <div className="bg-card rounded-lg border border-border p-4 mb-4 flex flex-col md:flex-row gap-3">
          <input type="text" placeholder="Search client, instructor, booking ID..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <div className="flex gap-2 flex-wrap">
            {['all', 'CONFIRMED', 'PENDING', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? 'bg-background text-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/70'}`}>
                {s === 'all' ? 'All' : s.replace('_', '-')}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-background text-muted-foreground/60 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-left">Instructor</th>
                <th className="px-4 py-3 text-left">Date / Time</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-center">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((b: any) => {
                const rules = getActionRules(b, now);
                const customerName = b.customerName || b.customer?.name || 'Unknown';
                const hasAlert = rules.ended && b.status === 'CONFIRMED';
                return (
                  <tr key={b.id} className={`hover:bg-secondary ${hasAlert ? 'bg-violet-900/20 hover:bg-violet-900/40' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-foreground">{customerName}</p>
                        {b.isPackageBooking && (
                          <span title="Package lesson" className="inline-flex items-center px-1.5 py-0.5 bg-violet-900/40 text-purple-600 text-xs rounded-full">
                            <Package className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground/60">{b.customer?.email || b.customerPhone || ''}</p>
                    </td>
                    <td className="px-4 py-3 text-foreground">{b.provider?.name || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground/60">
                      <p>{fmtDate(b.startTime)}</p>
                      <p className="text-xs">{fmtTime(b.startTime)} – {b.endTime ? fmtTime(b.endTime) : '?'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusConfig(b.status).badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${getStatusConfig(b.status).dot}`} />
                        {getStatusConfig(b.status).label}
                      </span>
                      {hasAlert && (
                        <span className="ml-1.5 text-xs text-purple-400 font-medium flex items-center gap-0.5 mt-0.5">
                          <Clock className="h-3 w-3" /> ended
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">${b.price.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      {!rules.isFinal ? (
                        <button onClick={() => setEditBooking(b)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            hasAlert ? 'bg-purple-600 text-foreground hover:bg-purple-700' : 'bg-secondary text-muted-foreground hover:bg-secondary/70'
                          }`}>
                          <Pencil className="h-3 w-3" />
                          {hasAlert ? 'Action needed' : 'Manage'}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground/60 italic">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground/60">No bookings found.</div>}
        </div>

        {/* Pagination Controls */}
        {pagination.pages > 1 && (
          <div className="mt-6 flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.pages} ({pagination.total} total)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fetchBookings(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-4 py-2 border border-border rounded-lg text-foreground hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => fetchBookings(pagination.page + 1)}
                disabled={!pagination.hasMore}
                className="px-4 py-2 border border-border rounded-lg text-foreground hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {editBooking && (
        <BookingEditDrawer
          booking={editBooking}
          onClose={() => setEditBooking(null)}
          onUpdated={() => { fetchBookings(pagination.page); }}
        />
      )}

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
