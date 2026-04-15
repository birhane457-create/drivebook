'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Save } from 'lucide-react';

interface BookingEditData {
  id: string;
  status: string;
  startTime: string | null;
  pickupAddress: string | null;
  notes: string | null;
  duration: number | null;
  price: number;
  client: { name: string } | null;
}

export default function BookingEditPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const bookingId = params.id as string;

  const [booking, setBooking] = useState<BookingEditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pickupAddress, setPickupAddress] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (!session?.user?.instructorId || !bookingId) return;
    fetch(`/api/bookings/${bookingId}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: BookingEditData) => {
        setBooking(data);
        setPickupAddress(data.pickupAddress ?? '');
        setNotes(data.notes ?? '');
      })
      .catch(() => setError('Failed to load booking.'))
      .finally(() => setLoading(false));
  }, [session, bookingId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickupAddress: pickupAddress.trim() || null, notes: notes.trim() || null }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Failed to save changes.');
        return;
      }
      router.push(`/dashboard/bookings/${bookingId}`);
    } catch {
      setError('Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500 mb-4">{error}</p>
        <Link href="/dashboard/bookings" className="text-blue-600 underline">Back to bookings</Link>
      </div>
    );
  }

  if (!booking) return null;

  // Only allow editing upcoming confirmed bookings
  const startTime = booking.startTime ? new Date(booking.startTime) : null;
  const isPast = startTime ? startTime < new Date() : false;
  if (booking.status !== 'CONFIRMED' || isPast) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500 mb-4">This booking cannot be edited.</p>
        <Link href={`/dashboard/bookings/${bookingId}`} className="text-blue-600 underline">Back to booking</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={`/dashboard/bookings/${bookingId}`} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Edit Booking</h1>
            {booking.client && (
              <p className="text-xs text-gray-500">{booking.client.name}</p>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSave} className="space-y-5">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pickup Address
              </label>
              <input
                type="text"
                value={pickupAddress}
                onChange={e => setPickupAddress(e.target.value)}
                placeholder="e.g. 12 Smith St, Perth WA 6000"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={4}
                placeholder="Any notes for this lesson..."
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              />
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            To change the date, time, or duration — use <Link href={`/dashboard/bookings/${bookingId}/reschedule`} className="underline font-medium">Reschedule</Link> instead.
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
          )}

          <div className="flex gap-3">
            <Link
              href={`/dashboard/bookings/${bookingId}`}
              className="flex-1 py-3 text-center border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
