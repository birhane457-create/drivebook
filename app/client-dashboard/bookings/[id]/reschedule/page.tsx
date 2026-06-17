'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, Clock, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

interface BookingInfo {
  id: string;
  date: string;
  time: string;
  duration: number;
  price: number;
  pickupAddress: string | null;
  instructor: { id: string; name: string; hourlyRate: number };
}

interface Slot { time: string; available: boolean; reason?: string }

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ClientReschedulePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const bookingId = params.id as string;

  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calendar state
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Slots state
  const [slots, setSlotsData] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (!session?.user?.email || !bookingId) return;
    fetch(`/api/client/bookings/${bookingId}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        setBooking({
          id: data.id,
          date: data.date,
          time: data.time,
          duration: data.duration ?? 60,
          price: data.price,
          pickupAddress: data.pickupAddress,
          instructor: data.instructor,
        });
      })
      .catch(() => setError('Failed to load booking.'))
      .finally(() => setLoading(false));
  }, [session, bookingId]);

  useEffect(() => {
    if (!selectedDate || !booking) return;
    setSlotsLoading(true);
    setSelectedTime(null);
    const durationMins = booking.duration >= 1 && booking.duration <= 12
      ? booking.duration * 60  // stored as hours
      : booking.duration;       // stored as minutes
    fetch(`/api/availability/slots?instructorId=${booking.instructor.id}&date=${selectedDate}&duration=${durationMins}&excludeBookingId=${bookingId}&bypassDurationCheck=true`)
      .then(r => r.ok ? r.json() : { slots: [] })
      .then(data => setSlotsData(data.slots ?? []))
      .catch(() => setSlotsData([]))
      .finally(() => setSlotsLoading(false));
  }, [selectedDate, booking, bookingId]);

  const handleConfirm = async () => {
    if (!selectedDate || !selectedTime || !booking) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/client/bookings/${bookingId}/reschedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, time: selectedTime }),
      });
      if (!res.ok) {
        const d = await res.json();
        setSubmitError(d.error || 'Failed to reschedule.');
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push(`/client-dashboard/bookings/${bookingId}`), 2000);
    } catch {
      setSubmitError('Failed to reschedule. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Calendar helpers
  const firstDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const minDate = new Date(today);
  minDate.setHours(minDate.getHours() + 12); // 12h minimum notice

  const isSelectable = (d: Date) => d >= minDate;

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-gray-700 mb-4">{error || 'Booking not found.'}</p>
          <Link href="/client-dashboard/bookings" className="text-blue-600 hover:underline text-sm">← Back to bookings</Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4">
        <div className="text-center">
          <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-900 mb-1">Lesson Rescheduled</h2>
          <p className="text-gray-500 text-sm">Redirecting to your booking...</p>
        </div>
      </div>
    );
  }

  const durationMins = booking.duration >= 1 && booking.duration <= 12
    ? booking.duration * 60 : booking.duration;
  const newPrice = selectedTime
    ? (booking.instructor.hourlyRate * durationMins / 60)
    : null;
  const priceDiff = newPrice !== null ? newPrice - booking.price : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-24">
      {/* Header */}
      <header className="bg-white/95 border-b border-gray-200 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={`/client-dashboard/bookings/${bookingId}`} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Reschedule Lesson</h1>
            <p className="text-xs text-gray-500">{booking.instructor.name}</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Current booking info */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold mb-0.5">Current booking</p>
          <p>{booking.date ? new Date(booking.date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }) : '—'} at {booking.time}</p>
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-600"
            >
              ‹
            </button>
            <h2 className="font-semibold text-gray-900">
              {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
            </h2>
            <button
              onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-600"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i + 1);
              const dateStr = formatDate(d);
              const selectable = isSelectable(d);
              const isSelected = selectedDate === dateStr;
              return (
                <button
                  key={dateStr}
                  disabled={!selectable}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`aspect-square rounded-lg text-sm font-medium transition ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : selectable
                      ? 'hover:bg-blue-50 text-gray-900'
                      : 'text-gray-300 cursor-not-allowed'
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Slots */}
        {selectedDate && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              Available times — {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h2>

            {slotsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : slots.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No available slots on this day.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {slots.map(slot => (
                  <button
                    key={slot.time}
                    onClick={() => setSelectedTime(slot.time)}
                    className={`py-2.5 rounded-lg text-sm font-medium border transition ${
                      selectedTime === slot.time
                        ? 'bg-blue-600 text-white border-blue-600'
                        : slot.reason === 'short_notice'
                        ? 'border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100'
                        : 'border-gray-200 text-gray-700 hover:border-blue-400 hover:bg-blue-50'
                    }`}
                  >
                    {slot.time}
                    {slot.reason === 'short_notice' && (
                      <span className="block text-xs opacity-70">Short notice</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Price diff notice */}
        {selectedTime && priceDiff !== 0 && (
          <div className={`px-4 py-3 rounded-xl border text-sm ${
            priceDiff > 0
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-green-50 border-green-200 text-green-800'
          }`}>
            {priceDiff > 0
              ? `$${priceDiff.toFixed(2)} will be deducted from your wallet for the duration change.`
              : `$${Math.abs(priceDiff).toFixed(2)} will be refunded to your wallet.`
            }
          </div>
        )}

        {/* Error */}
        {submitError && (
          <div className="px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700">
            {submitError}
          </div>
        )}

        {/* Confirm button */}
        {selectedDate && selectedTime && (
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition disabled:opacity-60"
          >
            {submitting
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : <Calendar className="w-5 h-5" />
            }
            Confirm Reschedule — {selectedDate && new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} at {selectedTime}
          </button>
        )}

        <p className="text-xs text-gray-400 text-center">
          Minimum 12 hours notice required. Cancellation policy applies to the original booking date.
        </p>
      </div>
    </div>
  );
}
