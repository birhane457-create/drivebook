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

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasMore: boolean;
}

export default function ClientBookingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
    hasMore: false,
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      loadData(1);
    }
  }, [session]);

  const loadData = async (page: number) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/client/profile?page=${page}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        if (data.pagination) {
          setPagination(data.pagination);
        }
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-400">Loading your bookings...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-slate-400">Failed to load bookings</p>
        </div>
      </div>
    );
  }

  const upcomingBookings = profile?.bookings.filter(b =>
    b.status === 'upcoming' || b.status === 'awaiting_payment' || b.status === 'awaiting_confirmation'
  ) ?? [];
  const pastBookings = profile?.bookings.filter(b =>
    b.status === 'completed' || b.status === 'cancelled' || b.status === 'expired'
  ) ?? [];
  const filteredBookings = filter === 'upcoming' ? upcomingBookings :
    filter === 'past' ? pastBookings :
    profile?.bookings ?? [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      {/* Header */}
      <header className="bg-slate-900/60 backdrop-blur border-b border-white/10 shadow-lg shadow-slate-950/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">My Bookings</h1>
              <p className="text-blue-200 mt-2">
                {profile.upcomingCount} upcoming • {profile.pastCount} completed
              </p>
            </div>
            <Link
              href="/client-dashboard/book-lesson"
              className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition flex items-center gap-2"
            >
              <BookOpen className="w-5 h-5" />
              Book New Lesson
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filter Tabs */}
        <div className="bg-slate-900/60 backdrop-blur rounded-3xl border border-white/10 mb-6 overflow-hidden shadow-lg shadow-slate-950/20">
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 px-6 py-4 font-semibold transition-all ${
                filter === 'all'
                  ? 'border-b-2 border-blue-500 text-blue-300 bg-blue-600/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              All Bookings ({pagination.total})
            </button>
            <button
              onClick={() => setFilter('upcoming')}
              className={`flex-1 px-6 py-4 font-semibold transition-all ${
                filter === 'upcoming'
                  ? 'border-b-2 border-blue-500 text-blue-300 bg-blue-600/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              Upcoming ({profile?.bookings.filter(b =>
                b.status === 'upcoming' || b.status === 'awaiting_payment' || b.status === 'awaiting_confirmation'
              ).length})
            </button>
            <button
              onClick={() => setFilter('past')}
              className={`flex-1 px-6 py-4 font-semibold transition-all ${
                filter === 'past'
                  ? 'border-b-2 border-blue-500 text-blue-300 bg-blue-600/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              Past ({profile?.bookings.filter(b =>
                b.status === 'completed' || b.status === 'cancelled' || b.status === 'expired'
              ).length})
            </button>
          </div>
        </div>

        {/* Bookings List */}
        {filteredBookings.length > 0 ? (
          <div className="space-y-4">
            {filteredBookings.map((booking) => {
              const statusMap: Record<string, { label: string; cls: string }> = {
                upcoming:               { label: 'Upcoming',             cls: 'bg-green-900/40 text-green-300' },
                completed:              { label: 'Completed',            cls: 'bg-slate-700 text-slate-300' },
                awaiting_payment:       { label: 'Awaiting Payment',     cls: 'bg-yellow-900/40 text-yellow-300' },
                awaiting_confirmation:  { label: 'Awaiting Confirmation',cls: 'bg-amber-900/40 text-amber-300' },
                cancelled:              { label: 'Cancelled',            cls: 'bg-red-900/40 text-red-300' },
                expired:                { label: 'Expired',              cls: 'bg-slate-700 text-slate-400' },
              };
              const s = statusMap[booking.status] ?? statusMap.upcoming;

              return (
                <Link
                  key={booking.id}
                  href={`/client-dashboard/bookings/${booking.id}`}
                  className={`block bg-slate-900/60 rounded-3xl border border-white/10 p-6 hover:bg-slate-900/80 hover:shadow-lg hover:shadow-blue-600/10 transition-all ${
                    booking.status === 'completed' || booking.status === 'cancelled' || booking.status === 'expired'
                      ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center shrink-0 border border-blue-500/30">
                        <User className="w-6 h-6 text-blue-300" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-slate-50 truncate">
                          {booking.instructor.name}
                        </h3>
                        <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded mt-0.5 ${s.cls}`}>
                          {s.label}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-slate-50">${booking.price.toFixed(2)}</p>
                      {booking.date && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(booking.date).toLocaleDateString('en-AU', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 mt-4 text-sm text-slate-400">
                    {booking.time && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-blue-400" />
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
                    <div className="mt-3 text-xs text-yellow-300 bg-yellow-900/20 border border-yellow-700/50 rounded-lg px-3 py-2">
                      Payment required to confirm your slot. Tap to complete payment.
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="bg-slate-900/60 rounded-3xl border border-white/10 p-12 text-center shadow-lg shadow-slate-950/20">
            <Calendar className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-100 mb-2">
              No {filter !== 'all' ? filter : ''} bookings
            </h3>
            <p className="text-slate-400 mb-6">
              {filter === 'upcoming' 
                ? "You don't have any upcoming lessons scheduled."
                : filter === 'past'
                ? "You haven't completed any lessons yet."
                : "You haven't made any bookings yet."
              }
            </p>
            <Link
              href="/client-dashboard/book-lesson"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-blue-600/50 transition-all"
            >
              <BookOpen className="w-5 h-5 mr-2" />
              Book Your First Lesson
            </Link>
          </div>
        )}

        {/* Pagination Controls */}
        {pagination.pages > 1 && (
          <div className="mt-6 flex items-center justify-between gap-4">
            <div className="text-sm text-slate-400">
              Page {pagination.page} of {pagination.pages} ({pagination.total} total)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => loadData(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-4 py-2 border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => loadData(pagination.page + 1)}
                disabled={!pagination.hasMore}
                className="px-4 py-2 border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}