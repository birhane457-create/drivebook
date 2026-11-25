'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Calendar, Clock, MapPin, DollarSign, User, Phone,
  MessageCircle, AlertCircle, CheckCircle, XCircle, Loader2,
  Star, CreditCard, RefreshCw, TrendingUp, FileText
} from 'lucide-react';
import ReviewModal from '@/components/ReviewModal';

interface BookingDetail {
  id: string;
  bookingType: string | null;
  date: string | null;
  time: string | null;
  startTime: string | null;
  endTime: string | null;
  duration: number | null;
  status: string;
  dbStatus: string;
  price: number;
  isPaid: boolean;
  pickupAddress: string | null;
  notes: string | null;
  isPackageBooking: boolean;
  packageHours: number | null;
  packageHoursRemaining: number | null;
  packageTotalPaid: number | null;
  isReviewed: boolean;
  performanceScore: number | null;
  instructorNotes: string | null;
  providerNotes: string | null;
  lessonFeedback: string[];
  studentStrengths: string[];
  focusAreas: string[];
  whiteboardSketchUrl: string | null;
  cancellationStatus: string | null;
  provider: {
    id: string;
    name: string;
    hourlyRate: number;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
  };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  upcoming: {
    label: 'Upcoming',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: <CheckCircle className="w-4 h-4" />,
  },
  completed: {
    label: 'Completed',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: <CheckCircle className="w-4 h-4" />,
  },
  awaiting_payment: {
    label: 'Awaiting Payment',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: <CreditCard className="w-4 h-4" />,
  },
  awaiting_confirmation: {
    label: 'Awaiting Confirmation',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: <RefreshCw className="w-4 h-4" />,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: <XCircle className="w-4 h-4" />,
  },
  expired: {
    label: 'Expired',
    color: 'bg-gray-100 text-muted-foreground/60 border-gray-200',
    icon: <XCircle className="w-4 h-4" />,
  },
};

export default function ClientBookingDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const bookingId = params.id as string;

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewModal, setReviewModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email && bookingId) loadBooking();
  }, [session, bookingId]);

  const loadBooking = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/client/bookings/${bookingId}`);
      if (res.status === 404) {
        setError('Booking not found.');
        return;
      }
      if (!res.ok) throw new Error('Failed to load booking');
      setBooking(await res.json());
    } catch {
      setError('Failed to load booking details.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!booking) return;
    setCancelError(null);
    try {
      setCancelling(true);
      const endpoint = booking.isPackageBooking
        ? `/api/bookings/${booking.id}/request-cancellation`
        : `/api/bookings/${booking.id}/cancel`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: booking.isPackageBooking ? JSON.stringify({}) : undefined,
      });
      if (!res.ok) {
        const data = await res.json();
        setCancelError(data.error || 'Failed to cancel booking.');
        return;
      }
      setCancelConfirm(false);
      await loadBooking();
    } catch {
      setCancelError('Failed to cancel booking. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
          <p className="text-gray-700 mb-4">{error || 'Booking not found.'}</p>
          <Link href="/client-dashboard/bookings" className="text-blue-600 hover:underline text-sm">
            ← Back to bookings
          </Link>
        </div>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.upcoming;
  const now = new Date();
  const startTime = booking.startTime ? new Date(booking.startTime) : null;
  const hoursUntil = startTime ? (startTime.getTime() - now.getTime()) / 3600000 : null;
  const canReschedule = booking.status === 'upcoming' && hoursUntil !== null && hoursUntil > 12;
  const canCancel = (booking.status === 'upcoming' || booking.status === 'awaiting_confirmation') 
    && booking.cancellationStatus !== 'PENDING';
  const canReview = booking.status === 'completed' && !booking.isReviewed;
  const hasFeedback = booking?.performanceScore !== null || (booking.lessonFeedback?.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-24">
      <header className="bg-white/95 border-b border-gray-200 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/client-dashboard/bookings" className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <h1 className="text-lg font-bold text-gray-900">Booking Details</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Status banner */}
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold ${statusCfg.color}`}>
          {statusCfg.icon}
          {statusCfg.label}
          {booking.status === 'awaiting_payment' && (
            <Link href={`/booking/${booking.id}/payment`} className="ml-auto underline text-yellow-800 hover:text-yellow-900">
              Complete Payment →
            </Link>
          )}
        </div>

        {booking.cancellationStatus === 'PENDING' && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-yellow-200 bg-yellow-50 text-sm font-semibold text-yellow-800">
            <Clock className="w-4 h-4" />Cancellation Request Under Review
          </div>
        )}
        {booking.cancellationStatus === 'APPROVED' && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-green-200 bg-green-50 text-sm font-semibold text-green-800">
            <CheckCircle className="w-4 h-4" />Cancellation Approved — Check your wallet and cancellation record for refund details
          </div>
        )}
        {booking.cancellationStatus === 'REJECTED' && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-sm font-semibold text-red-800">
            <XCircle className="w-4 h-4" />Cancellation Request Denied
          </div>
        )}
        {booking.bookingType === 'PDA_TEST' && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-purple-200 bg-purple-50 text-sm font-semibold text-purple-800">
            🚗 Test Day — Practical Driving Assessment (2h 45min)
          </div>
        )}

        {/* Instructor card */}
        <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">{booking.provider.name}</p>
              <p className="text-xs text-muted-foreground">Your instructor</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {booking.provider.phone && (
              <a href={`tel:${booking.provider.phone}`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary rounded-lg text-xs font-medium text-foreground hover:bg-secondary/70 transition">
                <Phone className="w-3.5 h-3.5" />{booking.provider.phone}
              </a>
            )}
            {booking.provider.whatsapp && (
              <a href={`https://wa.me/${booking.provider.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-900/30 border border-green-700/40 rounded-lg text-xs font-medium text-green-300 hover:bg-green-900/50 transition">
                <MessageCircle className="w-3.5 h-3.5" />WhatsApp
              </a>
            )}
          </div>
        </div>

        {/* Booking details card */}
        <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />Lesson Details
          </h2>
          {booking.isPackageBooking && (
            <div className="rounded-lg border border-purple-700/40 bg-purple-900/20 p-3 text-sm text-foreground sm:col-span-2">
              <p className="font-semibold">Package booking</p>
              <p className="mt-1 text-muted-foreground">
                {booking.packageHours ?? '—'} package hours
                {booking.packageHoursRemaining !== null && booking.packageHoursRemaining !== undefined
                  ? ` · ${booking.packageHoursRemaining} hours remaining`
                  : ''}
              </p>
              {booking.packageTotalPaid !== null && booking.packageTotalPaid !== undefined && (
                <p className="mt-1 text-muted-foreground">Package amount paid: ${Number(booking.packageTotalPaid).toFixed(2)}</p>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {booking.date && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4 shrink-0" />
                <span className="text-foreground font-medium">
                  {new Date(booking.date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
            )}
            {booking.time && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4 shrink-0" />
                <span className="text-foreground font-medium">
                  {booking.time}{booking.duration ? ` · ${booking.duration >= 60 ? `${Math.floor(booking.duration / 60)}h${booking.duration % 60 ? ` ${booking.duration % 60}m` : ''}` : `${booking.duration}min`}` : ''}
                </span>
              </div>
            )}
            {booking.pickupAddress && (
              <div className="flex items-start gap-2 text-muted-foreground sm:col-span-2">
                <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="text-foreground">{booking.pickupAddress}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="w-4 h-4 shrink-0" />
              <span className="text-foreground font-medium">${Number(booking.price).toFixed(2)}</span>
              {booking.isPaid && <span className="text-xs bg-green-900/30 text-green-300 border border-green-700/40 px-2 py-0.5 rounded-full">Paid</span>}
              {booking.isPackageBooking && <span className="text-xs bg-purple-900/30 text-purple-300 border border-purple-700/40 px-2 py-0.5 rounded-full">Package</span>}
            </div>
          </div>
          {booking.notes && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <p className="text-sm text-foreground">{booking.notes}</p>
            </div>
          )}
        </div>

        {/* Lesson feedback / performance */}
        {hasFeedback && (
          <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />Lesson Feedback
            </h2>
            {booking.performanceScore !== null && (
              <div className="flex items-center gap-3">
                <div className={`text-3xl font-bold ${booking.performanceScore >= 80 ? 'text-emerald-400' : booking.performanceScore >= 65 ? 'text-yellow-400' : 'text-destructive'}`}>
                  {booking.performanceScore}%
                </div>
                <div className="flex-1 bg-secondary rounded-full h-2 overflow-hidden">
                  <div className={`h-full ${booking.performanceScore >= 80 ? 'bg-green-500' : booking.performanceScore >= 65 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${booking.performanceScore}%` }} />
                </div>
              </div>
            )}
            {booking.lessonFeedback.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Feedback points</p>
                <div className="flex flex-wrap gap-1.5">
                  {booking.lessonFeedback.map((f, i) => (
                    <span key={i} className="text-xs bg-secondary border border-border px-2 py-1 rounded-lg text-foreground">{f}</span>
                  ))}
                </div>
              </div>
            )}
            {booking.studentStrengths.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Strengths</p>
                <div className="flex flex-wrap gap-1.5">
                  {booking.studentStrengths.map((s, i) => (
                    <span key={i} className="text-xs bg-green-900/30 border border-green-700/40 text-green-300 px-2 py-1 rounded-lg">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {booking.focusAreas.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Focus areas</p>
                <div className="flex flex-wrap gap-1.5">
                  {booking.focusAreas.map((f, i) => (
                    <span key={i} className="text-xs bg-amber-900/30 border border-amber-700/40 text-amber-300 px-2 py-1 rounded-lg">{f}</span>
                  ))}
                </div>
              </div>
            )}
            {booking.instructorNotes && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-1">Instructor notes</p>
                <p className="text-sm text-foreground italic">&ldquo;{booking.instructorNotes}&rdquo;</p>
              </div>
            )}
            {booking.whiteboardSketchUrl && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Whiteboard sketch</p>
                <img src={booking.whiteboardSketchUrl} alt="Whiteboard sketch" className="rounded-xl max-w-full border border-border" />
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2 pb-4">
          {canReview && (
            <button onClick={() => setReviewModal(true)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-300 rounded-xl text-sm font-semibold transition">
              <Star className="w-4 h-4" />Leave a Review
            </button>
          )}
          {canReschedule && (
            <Link href={`/client-dashboard/book-lesson?reschedule=${booking.id}&provider=${booking.provider.id}`}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-secondary hover:bg-secondary/70 border border-border text-foreground rounded-xl text-sm font-semibold transition">
              <RefreshCw className="w-4 h-4" />Reschedule
            </Link>
          )}
          {canCancel && !cancelConfirm && (
            <button onClick={() => setCancelConfirm(true)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-destructive/10 hover:bg-destructive/20 border border-destructive/30 text-destructive rounded-xl text-sm font-semibold transition">
              <XCircle className="w-4 h-4" />Cancel Booking
            </button>
          )}
          {canCancel && cancelConfirm && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 space-y-3">
              <p className="text-sm text-destructive font-medium">{booking.isPackageBooking ? 'Submit this package cancellation request for admin review?' : 'Are you sure you want to cancel this booking?'}</p>
              {cancelError && <p className="text-xs text-destructive">{cancelError}</p>}
              <div className="flex gap-2">
                <button onClick={() => { setCancelConfirm(false); setCancelError(null); }}
                  className="flex-1 py-2 bg-secondary border border-border rounded-lg text-sm font-medium text-foreground hover:bg-secondary/70 transition">
                  Keep booking
                </button>
                <button onClick={handleCancel} disabled={cancelling}
                  className="flex-1 py-2 bg-destructive rounded-lg text-sm font-medium text-white hover:bg-destructive/90 disabled:opacity-50 transition">
                  {cancelling ? 'Submitting…' : booking.isPackageBooking ? 'Submit request' : 'Yes, cancel'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {reviewModal && booking && (
        <ReviewModal
          bookingId={booking.id}
          instructorName={booking.provider.name}
          onClose={() => setReviewModal(false)}
          onSubmit={() => { setReviewModal(false); loadBooking(); }}
        />
      )}
    </div>
  );
}
