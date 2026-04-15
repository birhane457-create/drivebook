'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Calendar, 
  Clock, 
  Loader2,
  AlertCircle,
  BookOpen,
  MapPin,
  User,
} from 'lucide-react';

interface Booking {
  id: string;
  date: string;
  time: string;
  startTime?: string;
  duration: number;
  price: number;
  status: string;
  dbStatus?: string;
  pickupAddress?: string | null;
  instructor: {
    id: string;
    name: string;
    avatar?: string;
    hourlyRate: number;
  };
}

interface ProfileData {
  bookings: Booking[];
  upcomingCount: number;
  pastCount: number;
}

export default function ClientBookingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      loadData();
    }
  }, [session]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/client/profile');
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading your bookings...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">Failed to load bookings</p>
        </div>
      </div>
    );
  }

  const upcomingBookings = profile.bookings.filter(b =>
    b.status === 'upcoming' || b.status === 'awaiting_payment' || b.status === 'awaiting_confirmation'
  );
  const pastBookings = profile.bookings.filter(b =>
    b.status === 'completed' || b.status === 'cancelled' || b.status === 'expired'
  );
  const filteredBookings = filter === 'upcoming' ? upcomingBookings :
    filter === 'past' ? pastBookings :
    profile.bookings;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-20">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">My Bookings</h1>
              <p className="text-blue-100 mt-2">
                {profile.upcomingCount} upcoming • {profile.pastCount} completed
              </p>
            </div>
            <Link
              href="/client-dashboard/book-lesson"
              className="px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition flex items-center gap-2"
            >
              <BookOpen className="w-5 h-5" />
              Book New Lesson
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filter Tabs */}
        <div className="bg-white rounded-xl shadow-md mb-6 overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 px-6 py-4 font-semibold transition ${
                filter === 'all'
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              All Bookings ({profile.bookings.length})
            </button>
            <button
              onClick={() => setFilter('upcoming')}
              className={`flex-1 px-6 py-4 font-semibold transition ${
                filter === 'upcoming'
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Upcoming ({upcomingBookings.length})
            </button>
            <button
              onClick={() => setFilter('past')}
              className={`flex-1 px-6 py-4 font-semibold transition ${
                filter === 'past'
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Past ({pastBookings.length})
            </button>
          </div>
        </div>

        {/* Bookings List */}
        {filteredBookings.length > 0 ? (
          <div className="space-y-4">
            {filteredBookings.map((booking) => {
              const statusMap: Record<string, { label: string; cls: string }> = {
                upcoming:               { label: 'Upcoming',             cls: 'bg-green-100 text-green-700' },
                completed:              { label: 'Completed',            cls: 'bg-gray-100 text-gray-600' },
                awaiting_payment:       { label: 'Awaiting Payment',     cls: 'bg-yellow-100 text-yellow-700' },
                awaiting_confirmation:  { label: 'Awaiting Confirmation',cls: 'bg-amber-100 text-amber-700' },
                cancelled:              { label: 'Cancelled',            cls: 'bg-red-100 text-red-600' },
                expired:                { label: 'Expired',              cls: 'bg-gray-100 text-gray-500' },
              };
              const s = statusMap[booking.status] ?? statusMap.upcoming;

              return (
                <Link
                  key={booking.id}
                  href={`/client-dashboard/bookings/${booking.id}`}
                  className={`block bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition ${
                    booking.status === 'completed' || booking.status === 'cancelled' || booking.status === 'expired'
                      ? 'opacity-75' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                        <User className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-gray-900 truncate">
                          {booking.instructor.name}
                        </h3>
                        <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded mt-0.5 ${s.cls}`}>
                          {s.label}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-gray-900">${booking.price.toFixed(2)}</p>
                      {booking.date && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(booking.date).toLocaleDateString('en-AU', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600">
                    {booking.time && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-blue-500" />
                        {booking.time}{booking.duration ? ` · ${booking.duration >= 60 ? `${booking.duration / 60}h` : `${booking.duration}min`}` : ''}
                      </div>
                    )}
                    {booking.pickupAddress && (
                      <div className="flex items-center gap-1.5 truncate max-w-xs">
                        <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
                        <span className="truncate">{booking.pickupAddress}</span>
                      </div>
                    )}
                  </div>

                  {booking.status === 'awaiting_payment' && (
                    <div className="mt-3 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                      Payment required to confirm your slot. Tap to complete payment.
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              No {filter !== 'all' ? filter : ''} bookings
            </h3>
            <p className="text-gray-600 mb-6">
              {filter === 'upcoming' 
                ? "You don't have any upcoming lessons scheduled."
                : filter === 'past'
                ? "You haven't completed any lessons yet."
                : "You haven't made any bookings yet."
              }
            </p>
            <Link
              href="/client-dashboard/book-lesson"
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
            >
              <BookOpen className="w-5 h-5 mr-2" />
              Book Your First Lesson
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}