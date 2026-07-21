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
  isReviewed: boolean;
  performanceScore: number | null;
  instructorNotes: string | null;
  lessonFeedback: string[];
  studentStrengths: string[];
  focusAreas: string[];
  whiteboardSketchUrl: string | null;
  instructor: {
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
    color: 'bg-gray-100 text-gray-500 border-gray-200',
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
      const res = await fetch(`/api/bookings/${booking.id}/cancel`, { method: 'POST' });
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
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
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
  const canCancel = booking.status === 'upcoming' || booking.status === 'awaiting_confirmation';
  const canReview = booking.status === 'completed' && !booking.isReviewed;
  const hasFeedback = booking.performanceScore !== null || (booking.lessonFeedback?.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-24">
      {/* Header */}
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
            <Link
              href={`/booking/${booking.id}/payment`}
              className="ml-auto underline text-yellow-800 hover:text-yellow-900"
            >
              Complete Payment →
            </Link>
          )}
        </div>

        {/* PDA Test Day badge */}
        {booking.bookingType === 'PDA_TEST' && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-purple-200 bg-purple-50 text-sm font-semibold text-purple-800">
            🚗 Test Day — Practical Driving Assessment (2h 45min)
          </div>
        )}

        {/* Lesson info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Lesson Details</h2>

          {booking.date && (
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Date</p>
                <p className="font-medium text-gray-900">
                  {new Date(booking.date).toLocaleDateString('en-AU', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </p>
              </div>
            </div>
          )}

          {booking.time && (
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Time & Duration</p>
                <p className="font-medium text-gray-900">
                  {booking.time}
                  {booking.duration ? ` · ${booking.duration >= 60
                    ? `${booking.duration / 60}h`
                    : `${booking.duration}min`}` : ''}
                </p>
              </div>
            </div>
          )}

          {booking.pickupAddress && (
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">
                  {booking.bookingType === 'PDA_TEST' ? 'Test Centre' : 'Pickup Address'}
                </p>
                {/* PDA tests store "CentreName|CentreAddress" in notes */}
                {booking.bookingType === 'PDA_TEST' && booking.notes?.includes('|') ? (
                  <>
                    <p className="font-medium text-gray-900">{booking.notes.split('|')[0]}</p>
                    <p className="text-sm text-gray-500">{booking.notes.split('|')[1]}</p>
                  </>
                ) : (
                  <p className="font-medium text-gray-900">{booking.pickupAddress}</p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-start gap-3">
            <DollarSign className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Price</p>
              <p className="font-medium text-gray-900">
                ${booking.price.toFixed(2)}
                {booking.isPackageBooking && (
                  <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                    Package lesson
                  </span>
                )}
              </p>
            </div>
          </div>

          {booking.notes && booking.bookingType !== 'PDA_TEST' && (
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Notes</p>
                <p className="text-gray-700 text-sm">{booking.notes}</p>
              </div>
            </div>
          )}
        </div>

        {/* Instructor info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
          <h2 className="font-semibold text-gray-900">Your Instructor</h2>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{booking.instructor.name}</p>
              <p className="text-sm text-gray-500">${booking.instructor.hourlyRate}/hr</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {booking.instructor.phone && (
              <a
                href={`tel:${booking.instructor.phone}`}
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition"
              >
                <Phone className="w-4 h-4" /> Call
              </a>
            )}
            {booking.instructor.whatsapp && (
              <a
                href={`https://wa.me/${booking.instructor.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 hover:bg-green-100 transition"
              >
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
            )}
          </div>
        </div>

        {/* Lesson feedback (completed lessons) */}
        {hasFeedback && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              <h2 className="font-semibold text-gray-900">Lesson Feedback</h2>
            </div>

            {booking.performanceScore !== null && (
              <div className="flex items-center gap-3">
                <div className="text-3xl font-bold text-blue-600">{booking.performanceScore}%</div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Performance Score</p>
                  <p className="text-xs text-gray-500">
                    {booking.performanceScore >= 85
                      ? 'Test ready range'
                      : booking.performanceScore >= 70
                      ? 'Good progress'
                      : 'Keep practising'}
                  </p>
                </div>
              </div>
            )}

            {booking.studentStrengths?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Strengths</p>
                <div className="flex flex-wrap gap-1.5">
                  {booking.studentStrengths.map((s, i) => (
                    <span key={i} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {booking.focusAreas?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-1">Focus Areas</p>
                <div className="flex flex-wrap gap-1.5">
                  {booking.focusAreas.map((a, i) => (
                    <span key={i} className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">{a}</span>
                  ))}
                </div>
              </div>
            )}

            {booking.instructorNotes && (
              <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
                <span className="font-semibold">Note: </span>{booking.instructorNotes}
              </div>
            )}

            {/* Lesson sketch — drawn by instructor during/after the lesson */}
            {booking.whiteboardSketchUrl && (
              <div>
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Lesson Sketch</p>
                <div className="rounded-xl overflow-hidden border border-slate-200">
                  <img
                    src={booking.whiteboardSketchUrl}
                    alt="Lesson sketch from instructor"
                    className="w-full object-contain bg-white"
                    style={{ maxHeight: 320 }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Diagram drawn by your instructor during this lesson</p>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {canReview && (
            <button
              onClick={() => setReviewModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-yellow-500 text-white font-semibold rounded-xl hover:bg-yellow-600 transition"
            >
              <Star className="w-5 h-5" /> Leave a Review
            </button>
          )}

          {canReschedule && (
            <Link
              href={`/client-dashboard/bookings/${booking.id}/reschedule`}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition"
            >
              <Calendar className="w-5 h-5" /> Reschedule
            </Link>
          )}

          {canCancel && (
            <>
              {cancelError && (
                <div role="alert" className="flex items-start gap-2 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700">
                  <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {cancelError}
                </div>
              )}
              {!cancelConfirm ? (
                <button
                  onClick={() => setCancelConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-red-300 text-red-600 font-semibold rounded-xl hover:bg-red-50 transition"
                >
                  <XCircle className="w-5 h-5" />
                  Cancel Booking
                </button>
              ) : (
                <div className="border border-red-200 rounded-xl p-4 bg-red-50 space-y-3">
                  <p className="text-sm font-semibold text-red-800">Cancel this booking? Cancellation policy applies.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancel}
                      disabled={cancelling}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition disabled:opacity-50 text-sm"
                    >
                      {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      {cancelling ? 'Cancelling...' : 'Yes, cancel'}
                    </button>
                    <button
                      onClick={() => { setCancelConfirm(false); setCancelError(null); }}
                      className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition text-sm"
                    >
                      Keep booking
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {canCancel && (
            <p className="text-xs text-gray-400 text-center">
              Cancellation policy: 48h+ notice = 100% refund · 24–48h = 50% · &lt;24h = no refund
            </p>
          )}
        </div>
      </div>

      {reviewModal && (
        <ReviewModal
          isOpen={reviewModal}
          onClose={() => setReviewModal(false)}
          bookingId={booking.id}
          instructorName={booking.instructor.name}
          onSuccess={loadBooking}
        />
      )}
    </div>
  );
}
