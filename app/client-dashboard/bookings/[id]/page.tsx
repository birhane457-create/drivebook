'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Calendar, Clock, MapPin, DollarSign, Phone,
  MessageCircle, AlertCircle, CheckCircle, XCircle, Loader2,
  CreditCard, RefreshCw, FileText, Star, User, Car, BookOpen,
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
  isReviewed: boolean;
  performanceScore: number | null;
  instructorNotes: string | null;
  lessonFeedback: Array<string | number>;
  studentStrengths: Array<string | number>;
  focusAreas: Array<string | number>;
  whiteboardSketchUrl: string | null;
  provider: {
    id: string;
    name: string;
    hourlyRate: number;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
  };
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof CheckCircle }> = {
  upcoming: { label: 'Upcoming', className: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: CheckCircle },
  completed: { label: 'Completed', className: 'bg-slate-100 text-slate-700 border-slate-200', icon: CheckCircle },
  awaiting_payment: { label: 'Awaiting payment', className: 'bg-amber-50 text-amber-800 border-amber-200', icon: CreditCard },
  awaiting_confirmation: { label: 'Awaiting confirmation', className: 'bg-yellow-50 text-yellow-800 border-yellow-200', icon: RefreshCw },
  cancelled: { label: 'Cancelled', className: 'bg-red-50 text-red-800 border-red-200', icon: XCircle },
  expired: { label: 'Expired', className: 'bg-slate-100 text-slate-600 border-slate-200', icon: XCircle },
};

function formatDateTime(value: string | null, options: Intl.DateTimeFormatOptions) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en-AU', options).format(date);
}

function formatDuration(minutes: number | null) {
  if (!minutes || minutes <= 0) return 'Not specified';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours && remainder) return `${hours}h ${remainder}m`;
  if (hours) return `${hours} hour${hours === 1 ? '' : 's'}`;
  return `${remainder} minutes`;
}

function DetailRow({ icon: Icon, label, children }: {
  icon: typeof Calendar;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 rounded-lg bg-slate-100 p-2 text-slate-600"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <div className="mt-1 break-words text-sm font-medium text-slate-900">{children}</div>
      </div>
    </div>
  );
}

function FeedbackList({ title, items }: { title: string; items: Array<string | number> }) {
  if (!items?.length) return null;
  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {items.map((item, index) => (
          <li key={`${String(item)}-${index}`} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700">
            {String(item)}
          </li>
        ))}
      </ul>
    </section>
  );
}

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

  const loadBooking = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/client/bookings/${encodeURIComponent(bookingId)}`, { cache: 'no-store' });
      if (res.status === 404) {
        setError('Booking not found.');
        setBooking(null);
        return;
      }
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (!res.ok) throw new Error('Failed to load booking');
      setBooking(await res.json());
    } catch {
      setError('Failed to load booking details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [bookingId, router]);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated' && bookingId) void loadBooking();
  }, [status, bookingId, loadBooking]);

  const handleCancel = async () => {
    if (!booking) return;
    setCancelError(null);
    try {
      setCancelling(true);
      const res = await fetch(`/api/bookings/${encodeURIComponent(booking.id)}/cancel`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
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

  const startTime = useMemo(() => booking?.startTime ? new Date(booking.startTime) : null, [booking?.startTime]);
  const hoursUntil = startTime && !Number.isNaN(startTime.getTime())
    ? (startTime.getTime() - Date.now()) / 3600000
    : null;

  if (status === 'loading' || (loading && !booking && !error)) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="flex items-center gap-3 text-slate-600"><Loader2 className="h-6 w-6 animate-spin text-blue-600" />Loading booking details…</div>
      </main>
    );
  }

  if (error || !booking) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
          <h1 className="mt-4 text-lg font-semibold text-slate-900">Unable to show this booking</h1>
          <p className="mt-2 text-sm text-slate-600">{error || 'Booking not found.'}</p>
          <div className="mt-6 flex justify-center gap-3">
            <button onClick={() => void loadBooking()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Try again</button>
            <Link href="/client-dashboard/bookings" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">All bookings</Link>
          </div>
        </div>
      </main>
    );
  }

  const statusCfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.upcoming;
  const StatusIcon = statusCfg.icon;
  const canReschedule = booking.status === 'upcoming' && hoursUntil !== null && hoursUntil > 12;
  const canCancel = ['upcoming', 'awaiting_confirmation', 'awaiting_payment'].includes(booking.status);
  const canReview = booking.status === 'completed' && !booking.isReviewed;
  const hasFeedback = booking.performanceScore !== null ||
    booking.lessonFeedback.length > 0 || booking.studentStrengths.length > 0 ||
    booking.focusAreas.length > 0 || Boolean(booking.instructorNotes);
  const phoneHref = booking.provider.phone ? `tel:${booking.provider.phone.replace(/[^+\d]/g, '')}` : null;
  const whatsappNumber = booking.provider.whatsapp?.replace(/\D/g, '') || booking.provider.phone?.replace(/\D/g, '');
  const whatsappHref = whatsappNumber ? `https://wa.me/${whatsappNumber}` : null;

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/client-dashboard/bookings" aria-label="Back to bookings" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="text-xs text-slate-500">Your bookings</p>
            <h1 className="text-lg font-bold text-slate-900">Booking details</h1>
          </div>
          <span className={`ml-auto inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusCfg.className}`}>
            <StatusIcon className="h-4 w-4" />{statusCfg.label}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        {booking.status === 'awaiting_payment' && (
          <section className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="font-semibold text-amber-900">Payment is required</h2><p className="mt-1 text-sm text-amber-800">Your booking is not confirmed until payment is completed.</p></div>
            <Link href={`/booking/${booking.id}/payment`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-800"><CreditCard className="h-4 w-4" />Complete payment</Link>
          </section>
        )}

        {booking.cancellationStatus && ['PENDING', 'APPROVED', 'REJECTED'].includes(booking.cancellationStatus) && (
          <section className={`flex items-center gap-3 rounded-xl border p-4 text-sm font-medium ${
            booking.cancellationStatus === 'PENDING' ? 'border-amber-200 bg-amber-50 text-amber-900' :
            booking.cancellationStatus === 'APPROVED' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' :
            'border-red-200 bg-red-50 text-red-900'
          }`}>
            {booking.cancellationStatus === 'PENDING' ? <Clock className="h-5 w-5" /> : booking.cancellationStatus === 'APPROVED' ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            {booking.cancellationStatus === 'PENDING' ? 'Cancellation request under review' : booking.cancellationStatus === 'APPROVED' ? 'Cancellation approved' : 'Cancellation request declined'}
          </section>
        )}

        {booking.bookingType === 'PDA_TEST' && (
          <section className="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm font-semibold text-violet-900">
            <Car className="h-5 w-5" />Practical Driving Assessment booking
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lesson appointment</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{formatDateTime(booking.startTime, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2>
                <p className="mt-1 text-sm text-slate-600">{formatDateTime(booking.startTime, { hour: 'numeric', minute: '2-digit' })}{booking.endTime ? ` – ${formatDateTime(booking.endTime, { hour: 'numeric', minute: '2-digit' })}` : ''}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-4 py-3 text-right">
                <p className="text-xs text-slate-500">Booking price</p>
                <p className="text-2xl font-bold text-slate-900">${Number(booking.price || 0).toFixed(2)}</p>
                <p className="text-xs text-slate-500">{booking.isPaid ? 'Paid' : 'Payment outstanding'}</p>
              </div>
            </div>
          </div>
          <div className="grid gap-x-8 px-5 py-2 sm:grid-cols-2 sm:px-6">
            <DetailRow icon={Calendar} label="Date">{formatDateTime(booking.startTime, { day: 'numeric', month: 'long', year: 'numeric' })}</DetailRow>
            <DetailRow icon={Clock} label="Time and duration">{formatDateTime(booking.startTime, { hour: 'numeric', minute: '2-digit' })} · {formatDuration(booking.duration)}</DetailRow>
            <DetailRow icon={MapPin} label="Pickup location">{booking.pickupAddress || 'No pickup address provided'}</DetailRow>
            <DetailRow icon={DollarSign} label="Payment">{booking.isPaid ? 'Paid' : booking.status === 'awaiting_payment' ? 'Awaiting payment' : 'Not marked as paid'}</DetailRow>
            {booking.bookingType && <DetailRow icon={Car} label="Booking type">{booking.bookingType.replace(/_/g, ' ')}</DetailRow>}
            {booking.isPackageBooking && <DetailRow icon={BookOpen} label="Package booking">{booking.packageHours ? `${booking.packageHours} hours package` : 'Package lesson'}</DetailRow>}
          </div>
          {booking.notes && <div className="border-t border-slate-100 px-5 py-4 sm:px-6"><h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><FileText className="h-4 w-4 text-slate-500" />Your booking notes</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{booking.notes}</p></div>}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-800"><User className="h-6 w-6" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Your instructor</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">{booking.provider.name}</h2>
              <p className="mt-1 text-sm text-slate-600">Hourly rate: ${Number(booking.provider.hourlyRate || 0).toFixed(2)}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {phoneHref && <a href={phoneHref} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Phone className="h-4 w-4" />Call instructor</a>}
                {whatsappHref && <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"><MessageCircle className="h-4 w-4" />WhatsApp</a>}
              </div>
            </div>
          </div>
        </section>

        {hasFeedback && (
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lesson review</p><h2 className="mt-1 text-lg font-bold text-slate-900">Instructor feedback</h2></div>
            {booking.performanceScore !== null && <div className="rounded-xl bg-blue-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Performance score</p><p className="mt-1 text-3xl font-bold text-blue-900">{booking.performanceScore}<span className="text-base font-medium">/100</span></p></div>}
            <FeedbackList title="Lesson feedback" items={booking.lessonFeedback} />
            <FeedbackList title="Strengths" items={booking.studentStrengths} />
            <FeedbackList title="Focus areas" items={booking.focusAreas} />
            {booking.instructorNotes && <div><h3 className="text-sm font-semibold text-slate-900">Instructor notes</h3><p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{booking.instructorNotes}</p></div>}
            {booking.whiteboardSketchUrl && <div><h3 className="text-sm font-semibold text-slate-900">Lesson whiteboard</h3><a href={booking.whiteboardSketchUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold text-blue-700 underline">View instructor sketch</a></div>}
          </section>
        )}

        {canReview && (
          <section className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="font-semibold text-amber-950">How was your lesson?</h2><p className="mt-1 text-sm text-amber-800">Share feedback to help other learners.</p></div>
            <button onClick={() => setReviewModal(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-800"><Star className="h-4 w-4" />Leave a review</button>
          </section>
        )}

        {(canReschedule || canCancel) && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="font-semibold text-slate-900">Manage this booking</h2>
            <p className="mt-1 text-sm text-slate-600">Changes are subject to the booking and cancellation rules.</p>
            {cancelError && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{cancelError}</p>}
            {cancelConfirm ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-900">Cancel this booking?</p>
                <p className="mt-1 text-sm text-red-800">The applicable refund, if any, will be determined by the cancellation service.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => void handleCancel()} disabled={cancelling} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{cancelling ? 'Cancelling…' : 'Confirm cancellation'}</button>
                  <button onClick={() => setCancelConfirm(false)} disabled={cancelling} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Keep booking</button>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                {canReschedule && <Link href={`/client-dashboard/bookings/${booking.id}/reschedule`} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"><Calendar className="h-4 w-4" />Reschedule</Link>}
                {canCancel && booking.cancellationStatus !== 'PENDING' && <button onClick={() => setCancelConfirm(true)} className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"><XCircle className="h-4 w-4" />Cancel booking</button>}
              </div>
            )}
          </section>
        )}

        <div className="flex justify-start"><Link href="/client-dashboard/bookings" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900"><ArrowLeft className="h-4 w-4" />Back to all bookings</Link></div>
      </div>

      <ReviewModal
        isOpen={reviewModal}
        onClose={() => setReviewModal(false)}
        bookingId={booking.id}
        instructorName={booking.provider.name}
        onSuccess={() => { setBooking(current => current ? { ...current, isReviewed: true } : current); }}
      />
    </main>
  );
}
