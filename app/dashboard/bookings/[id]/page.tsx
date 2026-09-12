'use client';
import { DashboardPageLayout } from '@/components/ui'

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, Clock, MapPin, User, DollarSign, ClipboardList, CheckCircle, Send, Loader2 } from 'lucide-react';
import LessonFeedbackForm from '@/components/instructor/LessonFeedbackForm';
import QuoteResponseForm from '@/components/instructor/QuoteResponseForm';
import { resolveTimezone, timezoneFromState, formatLocalDate, formatLocalTime } from '@/lib/utils/timezone'
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
  providerNotes: string | null;
  performanceScore: number | null;
  feedbackGivenAt: string | null;
  lessonFeedback: number[];
  customerId: string | null;
  customer: {
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
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  // C-04: inline error for payment link — persists near the button until dismissed
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.providerId && bookingId) {
      fetch(`/api/bookings/${bookingId}`)
        .then(r => {
          if (!r.ok) throw new Error('failed');
          return r.json();
        })
        .then(data => { setBooking(data); setLoading(false); })
        .catch(() => { setFetchError('Failed to load booking'); setLoading(false); });
    }
  }, [session, bookingId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (fetchError || !booking) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-muted-foreground/60">{fetchError || 'Booking not found.'}</p>
        <Link href="/dashboard/bookings" className="text-primary underline mt-4 inline-block">Back to bookings</Link>
      </div>
    );
  }

  const startTime = booking.startTime ? new Date(booking.startTime) : null;
  const instructorTz = resolveTimezone((booking as any)?.provider?.timezone) || timezoneFromState((booking as any)?.provider?.state ?? '')
  const isPast = startTime ? startTime < new Date() : false;
  const isCompleted = booking.status === 'COMPLETED' || (booking.status === 'CONFIRMED' && isPast);
  const hasFeedback = ((booking as any).lessonFeedback?.length ?? 0) > 0 || !!(booking as any).feedbackGivenAt;

  const handleSendPaymentLink = async () => {
    if (!(booking as any)?.customer) return;
    setSendingLink(true);
    setLinkError(null);
    try {
      const res = await fetch('/api/bookings/send-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: (booking as any).customer?.id,
          topUpAmount: booking.price,
          lessonPrice: booking.price,
          lessonDate: startTime ? formatLocalDate(startTime, instructorTz, { weekday: 'long', day: 'numeric', month: 'long' }) : null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setLinkError(d.error || 'Failed to send payment link. Please try again.');
        return;
      }
      setLinkSent(true);
      setTimeout(() => setLinkSent(false), 4000);
    } catch {
      setLinkError('Failed to send payment link. Please try again.');
    } finally {
      setSendingLink(false);
    }
  };

  const statusColors: Record<string, string> = {
    CONFIRMED: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
    PENDING: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
    PENDING_PAYMENT: 'bg-orange-500/15 text-orange-400 border border-orange-500/25',
    COMPLETED: 'bg-primary/15 text-primary border border-primary/25',
    CANCELLED: 'bg-destructive/15 text-destructive border border-destructive/25',
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 text-foreground">
      {/* Back */}
      <Link href="/dashboard/bookings" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to bookings
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Booking Detail</h1>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusColors[booking.status] ?? 'bg-secondary text-muted-foreground'}`}>
          {booking.status.replace('_', ' ')}
        </span>
      </div>

      {/* Details card */}
      <div className="bg-card rounded-xl border border-border divide-y divide-border">
        {booking.customer && (
          <div className="flex items-center gap-3 p-5">
            <User className="h-5 w-5 text-blue-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Client</p>
              <p className="font-semibold text-foreground">{booking.customer.name}</p>
              <p className="text-sm text-muted-foreground">{booking.customer.phone} · {booking.customer.email}</p>
            </div>
          </div>
        )}

        {startTime && (
          <div className="flex items-center gap-3 p-5">
            <Calendar className="h-5 w-5 text-blue-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Date & Time</p>
              <p className="font-semibold text-foreground">
                {formatLocalDate(startTime, instructorTz, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatLocalTime(startTime, instructorTz, { hour: '2-digit', minute: '2-digit' })}
                {booking.duration ? ` · ${booking.duration >= 60 ? `${booking.duration / 60}h` : `${booking.duration}min`}` : ''}
              </p>
            </div>
          </div>
        )}

        {booking.pickupAddress && (
          <div className="flex items-center gap-3 p-5">
            <MapPin className="h-5 w-5 text-blue-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Pickup</p>
              <p className="font-semibold text-foreground">{booking.pickupAddress}</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 p-5">
          <DollarSign className="h-5 w-5 text-blue-500 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Price</p>
            <p className="font-semibold text-foreground">${(booking.price ?? 0).toFixed(2)}</p>
          </div>
        </div>

        {booking.notes && (
          <div className="flex items-start gap-3 p-5">
            <ClipboardList className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Notes</p>
              <p className="text-foreground text-sm">{booking.notes}</p>
            </div>
          </div>
        )}
      </div>

      {/* Feedback section — only for past/completed lessons */}
      {isCompleted && (
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-purple-600" />
              <h2 className="font-semibold text-foreground">Lesson Feedback</h2>
            </div>
            {hasFeedback && (
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                <CheckCircle className="h-4 w-4" />
                Submitted
                {booking.performanceScore != null && (
                  <span className="ml-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full text-xs font-bold">
                    Score: {(booking as any).performanceScore}/100
                  </span>
                )}
              </div>
            )}
          </div>

          {hasFeedback && !showFeedback ? (
            <div className="space-y-2">
              {booking.providerNotes && (
                <p className="text-sm text-foreground whitespace-pre-line">{booking.providerNotes}</p>
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
              <p className="text-sm text-muted-foreground mb-3">No feedback submitted yet for this lesson.</p>
              <button
                onClick={() => setShowFeedback(true)}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-foreground rounded-lg text-sm font-medium transition-colors"
              >
                Add Lesson Feedback
              </button>
            </div>
          ) : null}

          {showFeedback && booking.customer && (
            <LessonFeedbackForm
              bookingId={booking.id}
              providerId={session!.user.providerId!}
              customerId={booking.customer.id}
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

      {/* Quote Response — for REQUEST_PENDING bookings in SaaS payment model */}
      {booking.status === 'REQUEST_PENDING' && session?.user?.paymentModel === 'saas' && (
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-foreground mb-1">Quote Request</h2>
              <p className="text-sm text-muted-foreground">
                Customer is waiting for your quote to proceed with this booking.
              </p>
            </div>
          </div>

          {!showQuoteForm ? (
            <div className="flex gap-3">
              <button
                onClick={() => setShowQuoteForm(true)}
                className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-foreground rounded-lg text-sm font-medium transition-colors"
              >
                Create Quote
              </button>
            </div>
          ) : (
            <QuoteResponseForm
              bookingId={booking.id}
              onSuccess={() => {
                setShowQuoteForm(false);
                // Refresh booking data
                fetch(`/api/bookings/${bookingId}`)
                  .then(r => r.json())
                  .then(setBooking);
              }}
              onCancel={() => setShowQuoteForm(false)}
            />
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        {booking.status === 'PENDING_PAYMENT' && booking.customer && (
          <div className="flex-1 space-y-2">
            <button
              onClick={handleSendPaymentLink}
              disabled={sendingLink || linkSent}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60"
            >
              {linkSent
                ? <><CheckCircle className="h-4 w-4" /> Link Sent</>
                : sendingLink
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <><Send className="h-4 w-4" /> Send Payment Link</>
              }
            </button>
            {/* C-04: inline error stays visible near the button — important for payment actions */}
            {linkError && (
              <p role="alert" className="text-sm text-destructive bg-destructive/10 border border-destructive/25 rounded-lg px-3 py-2 flex items-center gap-2">
                <span className="shrink-0">❌</span>
                {linkError}
              </p>
            )}
          </div>
        )}
        {booking.status === 'CONFIRMED' && !isPast && (
          <>
            <Link
              href={`/dashboard/bookings/${bookingId}/reschedule`}
              className="flex-1 py-2.5 text-center border border-sky-500 text-primary rounded-lg text-sm font-medium hover:bg-sky-900/20 transition-colors"
            >
              Reschedule
            </Link>
            <Link
              href={`/dashboard/bookings/${bookingId}/edit`}
              className="flex-1 py-2.5 text-center border border-border text-foreground rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
            >
              Edit
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
