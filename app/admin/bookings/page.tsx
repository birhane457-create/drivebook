'use client';

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
  bookingType?: string; price: number; platformFee: number; instructorPayout: number;
  pickupAddress?: string; dropoffAddress?: string; notes?: string;
  isPaid: boolean; duration: number;
  isPackageBooking?: boolean; parentBookingId?: string;
  clientName?: string; clientPhone?: string;
  client?: { id: string; name: string; email: string; phone: string };
  instructor: { id: string; name: string; phone: string };
}

interface Stats {
  total: number; confirmed: number; pending: number;
  completed: number; cancelled: number; noShow: number; endedConfirmed: number;
}

// Status styles now come from lib/config/booking-status.ts (getStatusConfig)

function getActionRules(b: Booking, now: Date) {
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
  booking: Booking;
  onSelect: (party: 'instructor' | 'client' | 'both') => void;
  onBack: () => void;
}) {
  const clientName = booking.clientName || booking.client?.name || 'Client';
  const isPackage = booking.isPackageBooking;

  const options: { party: 'instructor' | 'client' | 'both'; label: string; sub: string; icon: React.ReactNode; resolution: string }[] = [
    {
      party: 'instructor',
      label: `${booking.instructor?.name || 'Instructor'} didn't show`,
      sub: 'Instructor failed to attend',
      icon: <UserX className="h-5 w-5 text-red-500" />,
      resolution: isPackage
        ? 'Lesson credit returned to package · Instructor charged penalty'
        : 'Client wallet refunded · Instructor charged penalty',
    },
    {
      party: 'client',
      label: `${clientName} didn't show`,
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
        <button onClick={onBack} className="text-xs text-slate-500 hover:text-slate-400">← Back</button>
        <p className="text-sm font-semibold text-slate-200">Who didn't show up?</p>
      </div>
      <p className="text-xs text-slate-500 -mt-1">This determines the resolution path in Payouts.</p>
      {options.map(o => (
        <button
          key={o.party}
          onClick={() => onSelect(o.party)}
          className="w-full text-left rounded-lg border border-slate-700 px-4 py-3 hover:bg-slate-800 transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5">{o.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200">{o.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{o.sub}</p>
              <p className="text-xs text-blue-600 mt-1 font-medium">→ {o.resolution}</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Completed confirmation screen ───────────────────────────────────────────
function CompletedScreen({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const router = useRouter();
  const clientName = booking.clientName || booking.client?.name || 'Client';
  return (
    <div className="px-5 py-6 flex flex-col items-center text-center gap-4">
      <div className="w-14 h-14 rounded-full bg-blue-900/40 flex items-center justify-center">
        <CheckCircle className="h-7 w-7 text-blue-600" />
      </div>
      <div>
        <p className="text-lg font-semibold text-slate-100">Marked Complete</p>
        <p className="text-sm text-slate-500 mt-1">
          {clientName}'s lesson with {booking.instructor?.name} is complete.
        </p>
      </div>
      <div className="w-full bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 text-left">
        <p className="text-sm font-medium text-blue-300 flex items-center gap-2">
          <Info className="h-4 w-4 shrink-0" />
          Instructor payout now eligible
        </p>
        <p className="text-xs text-blue-700 mt-1">
          ${(booking.instructorPayout || 0).toFixed(2)} for {booking.instructor?.name} is ready to process.
        </p>
        {booking.isPackageBooking && (
          <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
            <Package className="h-3 w-3" /> Package lesson — drawn from client's package balance.
          </p>
        )}
        <button onClick={() => router.push('/admin/payouts')}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-200 underline">
          Go to Payout Management <ExternalLink className="h-3 w-3" />
        </button>
      </div>
      <div className="flex gap-3 w-full">
        <button onClick={onClose} className="flex-1 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm hover:bg-slate-700">Close</button>
        <button onClick={() => router.push('/admin/payouts')} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">View Payouts</button>
      </div>
    </div>
  );
}

// ─── No-show confirmation screen ─────────────────────────────────────────────
function NoShowScreen({
  booking, party, onClose,
}: { booking: Booking; party: 'instructor' | 'client' | 'both'; onClose: () => void }) {
  const router = useRouter();
  const isPackage = booking.isPackageBooking;

  const info = {
    instructor: {
      title: 'Instructor No-Show Recorded',
      color: 'red',
      steps: isPackage
        ? ['Lesson marked NO_SHOW', 'Goes to Withheld in Payouts', 'Resolve → "Refund Client" returns credit to package', 'Resolve → "Charge Instructor" applies penalty']
        : ['Lesson marked NO_SHOW', 'Goes to Withheld in Payouts', 'Resolve → "Refund Client" credits wallet back', 'Resolve → "Charge Instructor" applies penalty'],
    },
    client: {
      title: 'Client No-Show Recorded',
      color: 'orange',
      steps: ['Lesson marked NO_SHOW', 'Goes to Withheld in Payouts', 'Resolve → "Pay Instructor" releases their payout', 'Client forfeits the lesson (no refund)'],
    },
    both: {
      title: 'Dispute Flagged',
      color: 'yellow',
      steps: ['Lesson marked NO_SHOW', 'Goes to Disputes tab in Payouts', 'Admin reviews and resolves manually', 'Choose: refund client, pay instructor, charge penalty, or void'],
    },
  }[party];

  const colorMap: Record<string, string> = {
    red: 'bg-red-900/20 border-red-700/50 text-red-300',
    orange: 'bg-orange-900/20 border-orange-700/50 text-orange-300',
    yellow: 'bg-yellow-900/20 border-yellow-700/50 text-yellow-300',
  };

  return (
    <div className="px-5 py-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${party === 'instructor' ? 'bg-red-900/40' : party === 'client' ? 'bg-orange-100' : 'bg-yellow-900/40'}`}>
          <XCircle className={`h-5 w-5 ${party === 'instructor' ? 'text-red-600' : party === 'client' ? 'text-orange-600' : 'text-yellow-600'}`} />
        </div>
        <p className="font-semibold text-slate-100">{info.title}</p>
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
        <button onClick={onClose} className="flex-1 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm hover:bg-slate-700">Close</button>
        <button onClick={() => router.push('/admin/payouts')} className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700">
          Go to Payouts
        </button>
      </div>
    </div>
  );
}

// ─── Main edit drawer ─────────────────────────────────────────────────────────
function BookingEditDrawer({
  booking, onClose, onUpdated,
}: { booking: Booking; onClose: () => void; onUpdated: () => void }) {
  const [step, setStep] = useState<'actions' | 'noshow-party' | 'done-complete' | 'done-noshow'>('actions');
  const [noShowParty, setNoShowParty] = useState<'instructor' | 'client' | 'both' | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const now = new Date();
  const rules = getActionRules(booking, now);
  const clientName = booking.clientName || booking.client?.name || 'Unknown';
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

  const handleNoShowPartySelect = (party: 'instructor' | 'client' | 'both') => {
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
      <div className="bg-slate-900 rounded-t-2xl md:rounded-2xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div>
              <p className="font-semibold text-slate-100 flex items-center gap-2">
                {clientName}
                {isPackage && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-violet-900/40 text-violet-300 text-xs rounded-full font-medium">
                    <Package className="h-3 w-3" /> Package
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500">
                #{formatBookingId(booking.id)} · {new Date(booking.startTime).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Booking summary strip */}
        {step === 'actions' && (
          <div className="px-5 py-3 bg-slate-800 border-b border-slate-800 grid grid-cols-3 gap-3 text-xs">
            <div>
              <p className="text-slate-500">Instructor</p>
              <p className="font-medium text-slate-300">{booking.instructor?.name || '—'}</p>
            </div>
            <div>
              <p className="text-slate-500">Time</p>
              <p className="font-medium text-slate-300">
                {new Date(booking.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                {' – '}
                {booking.endTime ? new Date(booking.endTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : '?'}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Price</p>
              <p className="font-medium text-slate-300">${booking.price.toFixed(2)}</p>
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
          <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-2">
            <span className="text-xs text-slate-500">Status:</span>
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
              <p className="text-sm text-slate-500 text-center py-4">
                This booking is <span className="font-medium text-slate-400">{booking.status}</span> — no further actions available.
              </p>
            ) : (
              <>
                {/* Complete */}
                <div className="rounded-lg border border-slate-700 overflow-hidden">
                  <button
                    disabled={!rules.canComplete || !!updating}
                    onClick={() => rules.canComplete && updateStatus('COMPLETED')}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${rules.canComplete ? 'hover:bg-blue-900/20 cursor-pointer' : 'opacity-50 cursor-not-allowed bg-slate-800'}`}
                  >
                    <CheckCircle className={`h-5 w-5 shrink-0 ${rules.canComplete ? 'text-blue-600' : 'text-slate-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${rules.canComplete ? 'text-blue-700' : 'text-slate-500'}`}>Mark as Completed</p>
                      {rules.completeBlockReason
                        ? <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5"><Clock className="h-3 w-3 shrink-0" /> {rules.completeBlockReason}</p>
                        : <p className="text-xs text-slate-500 mt-0.5">Releases instructor payout of ${(booking.instructorPayout || 0).toFixed(2)}</p>
                      }
                    </div>
                    {updating === 'COMPLETED' && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />}
                  </button>
                </div>

                {/* No-Show */}
                {booking.status === 'CONFIRMED' && (
                  <div className="rounded-lg border border-slate-700 overflow-hidden">
                    <button
                      disabled={!rules.canNoShow || !!updating}
                      onClick={() => rules.canNoShow && setStep('noshow-party')}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${rules.canNoShow ? 'hover:bg-orange-900/20 cursor-pointer' : 'opacity-50 cursor-not-allowed bg-slate-800'}`}
                    >
                      <XCircle className={`h-5 w-5 shrink-0 ${rules.canNoShow ? 'text-orange-500' : 'text-slate-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${rules.canNoShow ? 'text-orange-700' : 'text-slate-500'}`}>Mark as No-Show</p>
                        {rules.noShowBlockReason
                          ? <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5"><Clock className="h-3 w-3 shrink-0" /> {rules.noShowBlockReason}</p>
                          : <p className="text-xs text-slate-500 mt-0.5">You'll be asked who didn't show — determines resolution</p>
                        }
                      </div>
                    </button>
                  </div>
                )}

                {/* Confirm pending */}
                {booking.status === 'PENDING' && (
                  <div className="rounded-lg border border-slate-700 overflow-hidden">
                    <button disabled={!!updating} onClick={() => updateStatus('CONFIRMED')}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-green-900/20 transition-colors">
                      <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-green-700">Confirm Booking</p>
                        <p className="text-xs text-slate-500 mt-0.5">Approve this pending booking</p>
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
                      <p className="text-sm font-medium text-red-700">Cancel Booking</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {isPackage ? 'Lesson credit returned to package · Notifies both parties' : 'Notifies client and instructor'}
                      </p>
                    </div>
                    {updating === 'CANCELLED' && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500" />}
                  </button>
                </div>
              </>
            )}
            {toast && <div className="px-3 py-2 bg-red-900/20 border border-red-700/50 rounded-lg text-xs text-red-700">{toast}</div>}
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
  const [bookings, setBookings] = useState<Booking[]>([]);
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
  const filtered = bookings.filter(b => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    return true;
  });

  const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtTime = (s: string) => new Date(s).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });

  if (loading) return (
    <div className="min-h-screen bg-slate-950 text-slate-100"><AdminNav />
      <div className="max-w-7xl mx-auto px-4 py-8 flex items-center gap-3 text-slate-500">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" /> Loading bookings...
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 py-8">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-100">All Bookings</h1>
            <p className="text-sm text-slate-500 mt-1">Click Manage to update a booking's status</p>
          </div>
          <button onClick={() => fetchBookings(pagination.page)} className="p-2 text-slate-500 hover:text-slate-400 rounded-lg hover:bg-slate-800">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 md:grid-cols-7 gap-3 mb-6">
            {[
              { label: 'Total', value: pagination.total, color: 'text-slate-100' },
              { label: 'Confirmed', value: stats.confirmed, color: 'text-green-600' },
              { label: 'Pending', value: stats.pending, color: 'text-yellow-600' },
              { label: 'Completed', value: stats.completed, color: 'text-blue-600' },
              { label: 'Cancelled', value: stats.cancelled, color: 'text-red-600' },
              { label: 'No-Show', value: stats.noShow, color: 'text-orange-600' },
              { label: 'Ended (unpaid)', value: stats.endedConfirmed, color: 'text-purple-600' },
            ].map(s => (
              <div key={s.label} className="bg-slate-900 rounded-lg border border-slate-800 p-3 text-center">
                <p className="text-xs text-slate-500">{s.label}</p>
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
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 mb-4 flex flex-col md:flex-row gap-3">
          <input type="text" placeholder="Search client, instructor, booking ID..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <div className="flex gap-2 flex-wrap">
            {['all', 'CONFIRMED', 'PENDING', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? 'bg-slate-950 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                {s === 'all' ? 'All' : s.replace('_', '-')}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-950 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-left">Instructor</th>
                <th className="px-4 py-3 text-left">Date / Time</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-center">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map(b => {
                const rules = getActionRules(b, now);
                const clientName = b.clientName || b.client?.name || 'Unknown';
                const hasAlert = rules.ended && b.status === 'CONFIRMED';
                return (
                  <tr key={b.id} className={`hover:bg-slate-800 ${hasAlert ? 'bg-violet-900/20 hover:bg-violet-900/40' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-slate-100">{clientName}</p>
                        {b.isPackageBooking && (
                          <span title="Package lesson" className="inline-flex items-center px-1.5 py-0.5 bg-violet-900/40 text-purple-600 text-xs rounded-full">
                            <Package className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{b.client?.email || b.clientPhone || ''}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{b.instructor?.name || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">
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
                    <td className="px-4 py-3 text-right font-medium text-slate-100">${b.price.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      {!rules.isFinal ? (
                        <button onClick={() => setEditBooking(b)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            hasAlert ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                          }`}>
                          <Pencil className="h-3 w-3" />
                          {hasAlert ? 'Action needed' : 'Manage'}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500 italic">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-12 text-slate-500">No bookings found.</div>}
        </div>

        {/* Pagination Controls */}
        {pagination.pages > 1 && (
          <div className="mt-6 flex items-center justify-between gap-4">
            <div className="text-sm text-slate-400">
              Page {pagination.page} of {pagination.pages} ({pagination.total} total)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fetchBookings(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-4 py-2 border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => fetchBookings(pagination.page + 1)}
                disabled={!pagination.hasMore}
                className="px-4 py-2 border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className={`rounded-lg shadow-lg px-4 py-3 text-sm text-white ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
