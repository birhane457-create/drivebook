'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, Clock, MapPin, User, DollarSign, ClipboardList, CheckCircle } from 'lucide-react';
import LessonFeedbackForm from '@/components/instructor/LessonFeedbackForm';

interface Booking {
  id: string;
  status: string;
  startTime: string | null;
  endTime: string | null;
  duration: number | null;
  price: number;
  pickupAddress: string | null;
  notes: string | null;
  instructorNotes: string | null;
  performanceScore: number | null;
  feedbackGivenAt: string | null;
  lessonFeedback: number[];
  clientId: string | null;
  client: {
    id: string;
    name: string;
    phone: string;
    email: string;
  } | null;
}

export default function BookingDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const bookingId = params.id as string;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.instructorId && bookingId) {
      fetch(`/api/bookings/${bookingId}`)
        .then(r => r.json())
        .then(data => { setBooking(data); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [session, bookingId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500">Booking not found.</p>
        <Link href="/dashboard/bookings" className="text-blue-600 underline mt-4 inline-block">Back to bookings</Link>
      </div>
    );
  }

  const startTime = booking.startTime ? new Date(booking.startTime) : null;
  const isPast = startTime ? startTime < new Date() : false;
  const isCompleted = booking.status === 'COMPLETED' || (booking.status === 'CONFIRMED' && isPast);
  const hasFeedback = (booking.lessonFeedback?.length ?? 0) > 0 || !!booking.feedbackGivenAt;

  const statusColors: Record<string, string> = {
    CONFIRMED: 'bg-green-100 text-green-700',
    PENDING: 'bg-yellow-100 text-yellow-700',
    PENDING_PAYMENT: 'bg-orange-100 text-orange-700',
    COMPLETED: 'bg-blue-100 text-blue-700',
    CANCELLED: 'bg-red-100 text-red-700',
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Back */}
      <Link href="/dashboard/bookings" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="h-4 w-4" /> Back to bookings
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Booking Detail</h1>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusColors[booking.status] ?? 'bg-gray-100 text-gray-700'}`}>
          {booking.status.replace('_', ' ')}
        </span>
      </div>

      {/* Details card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50">
        {booking.client && (
          <div className="flex items-center gap-3 p-5">
            <User className="h-5 w-5 text-blue-500 shrink-0" />
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Client</p>
              <p className="font-semibold text-gray-900">{booking.client.name}</p>
              <p className="text-sm text-gray-500">{booking.client.phone} · {booking.client.email}</p>
            </div>
          </div>
        )}

        {startTime && (
          <div className="flex items-center gap-3 p-5">
            <Calendar className="h-5 w-5 text-blue-500 shrink-0" />
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Date & Time</p>
              <p className="font-semibold text-gray-900">
                {startTime.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <p className="text-sm text-gray-500">
                {startTime.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                {booking.duration ? ` · ${booking.duration >= 60 ? `${booking.duration / 60}h` : `${booking.duration}min`}` : ''}
              </p>
            </div>
          </div>
        )}

        {booking.pickupAddress && (
          <div className="flex items-center gap-3 p-5">
            <MapPin className="h-5 w-5 text-blue-500 shrink-0" />
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Pickup</p>
              <p className="font-semibold text-gray-900">{booking.pickupAddress}</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 p-5">
          <DollarSign className="h-5 w-5 text-blue-500 shrink-0" />
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Price</p>
            <p className="font-semibold text-gray-900">${booking.price.toFixed(2)}</p>
          </div>
        </div>

        {booking.notes && (
          <div className="flex items-start gap-3 p-5">
            <ClipboardList className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Notes</p>
              <p className="text-gray-700 text-sm">{booking.notes}</p>
            </div>
          </div>
        )}
      </div>

      {/* Feedback section — only for past/completed lessons */}
      {isCompleted && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-purple-600" />
              <h2 className="font-semibold text-gray-900">Lesson Feedback</h2>
            </div>
            {hasFeedback && (
              <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                <CheckCircle className="h-4 w-4" />
                Submitted
                {booking.performanceScore != null && (
                  <span className="ml-1 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">
                    Score: {booking.performanceScore}/100
                  </span>
                )}
              </div>
            )}
          </div>

          {hasFeedback && !showFeedback ? (
            <div className="space-y-2">
              {booking.instructorNotes && (
                <p className="text-sm text-gray-600 whitespace-pre-line">{booking.instructorNotes}</p>
              )}
              <button
                onClick={() => setShowFeedback(true)}
                className="text-sm text-purple-600 underline hover:text-purple-700"
              >
                Edit feedback
              </button>
            </div>
          ) : !hasFeedback && !showFeedback ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mb-3">No feedback submitted yet for this lesson.</p>
              <button
                onClick={() => setShowFeedback(true)}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Add Lesson Feedback
              </button>
            </div>
          ) : null}

          {showFeedback && booking.client && (
            <LessonFeedbackForm
              bookingId={booking.id}
              instructorId={session!.user.instructorId!}
              clientId={booking.client.id}
              onSubmitSuccess={() => {
                setShowFeedback(false);
                // Refresh booking data
                fetch(`/api/bookings/${bookingId}`)
                  .then(r => r.json())
                  .then(setBooking);
              }}
            />
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {booking.status === 'CONFIRMED' && !isPast && (
          <>
            <Link
              href={`/dashboard/bookings/${bookingId}/reschedule`}
              className="flex-1 py-2.5 text-center border border-blue-600 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors"
            >
              Reschedule
            </Link>
            <Link
              href={`/dashboard/bookings/${bookingId}/edit`}
              className="flex-1 py-2.5 text-center border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Edit
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
