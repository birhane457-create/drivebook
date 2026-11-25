'use client';

import React, { useState, useEffect, useCallback } from 'react';
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

// Client-side display status ? consistent badge styles
// These are the API-transformed display statuses (not raw DB statuses)
const CLIENT_STATUS_STYLE: Record<string, { label: string; badge: string; dot: string }> = {
  upcoming:               { label: 'Confirmed',             badge: 'bg-emerald-950/40 text-emerald-300 border border-emerald-700/50', dot: 'bg-emerald-400' },
  completed:              { label: 'Completed',             badge: 'bg-sky-950/40 text-primary border border-sky-700/50',             dot: 'bg-sky-400' },
  awaiting_payment:       { label: 'Awaiting Payment',      badge: 'bg-violet-950/40 text-violet-300 border border-violet-700/50',    dot: 'bg-violet-400' },
  awaiting_confirmation:  { label: 'Pending Approval',      badge: 'bg-amber-950/40 text-amber-300 border border-amber-700/50',       dot: 'bg-amber-400' },
  cancelled:              { label: 'Cancelled',             badge: 'bg-rose-950/40 text-rose-300 border border-rose-700/50',          dot: 'bg-rose-400' },
  expired:                { label: 'Expired',               badge: 'bg-secondary/60 text-muted-foreground border border-border/50',       dot: 'bg-slate-500' },
};

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
  provider: {
    id: string;
    name: string;
    avatar?: string;
    hourlyRate: number;
  };
}

interface ProfileData {
  bookings: any[];
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
  const [loadError, setLoadError] = useState<string | null>(null);
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

  // One effect owns initial loading and filter changes. Separate session and
  // filter effects caused duplicate requests on the first authenticated render.
  const loadData = useCallback(async (page: number, currentFilter: 'all' | 'upcoming' | 'past' = filter) => {
    try {
      setLoading(true);
      setLoadError(null);
      const statusParam = currentFilter === 'upcoming'
        ? '&status=upcoming,awaiting_payment,awaiting_confirmation'
        : currentFilter === 'past'
        ? '&status=completed,cancelled,expired'
        : '';
      const res = await fetch(`/api/client/profile?page=${page}&limit=10${statusParam}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error(`Booking request failed (${res.status})`);
      }
      const data = await res.json();
      setProfile(data);
      if (data.pagination) {
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
      setProfile(null);
      setLoadError('We could not load your bookings. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (session?.user?.email) {
      void loadData(1, filter);
    }
  }, [session?.user?.email, filter, loadData]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your bookings...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-foreground font-semibold">Bookings unavailable</p>
          <p className="text-muted-foreground mt-2">{loadError ?? 'We could not load your bookings.'}</p>
          <button
            type="button"
            onClick={() => void loadData(1, filter)}
            className="mt-5 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Bookings are now filtered server-side via ?status= param
  const filteredBookings = profile?.bookings ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Header */}
      <header className="bg-card/60 backdrop-blur border-b border-border shadow-lg shadow-slate-950/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">My Bookings</h1>
              <p className="text-primary mt-2">
                {profile.upcomingCount} upcoming • {profile.pastCount} completed
              </p>
            </div>
            <Link
              href="/client-dashboard/book-lesson"
              className="px-4 py-2 bg-primary text-foreground font-semibold rounded-xl hover:bg-primary/90 transition flex items-center gap-2"
            >
              <BookOpen className="w-5 h-5" />
              Book New Lesson
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filter Tabs */}
        <div className="bg-card/60 backdrop-blur rounded-2xl border border-border mb-6 overflow-hidden shadow-lg shadow-slate-950/20">
          <div className="flex border-b border-border">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 px-6 py-4 font-semibold transition-all ${
                filter === 'all'
                  ? 'border-b-2 border-blue-500 text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              All Bookings ({pagination.total})
            </button>
            <button
              onClick={() => setFilter('upcoming')}
              className={`flex-1 px-6 py-4 font-semibold transition-all ${
                filter === 'upcoming'
                  ? 'border-b-2 border-blue-500 text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              {/* NF-04: use upcomingCount/pastCount from API — not a slice of the current page */}
              Upcoming ({profile?.upcomingCount ?? 0})
            </button>
            <button
              onClick={() => setFilter('past')}
              className={`flex-1 px-6 py-4 font-semibold transition-all ${
                filter === 'past'
                  ? 'border-b-2 border-blue-500 text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              Past ({profile?.pastCount ?? 0})
            </button>
          </div>
        </div>

        {/* Bookings List */}
        {filteredBookings.length > 0 ? (
          <div className="space-y-4">
            {filteredBookings.map((booking: any) => {
              const s = CLIENT_STATUS_STYLE[booking.status] ?? CLIENT_STATUS_STYLE.upcoming;

              return (
                <Link
                  key={booking.id}
                  href={`/client-dashboard/bookings/${booking.id}`}
                  className={`block bg-card/60 rounded-2xl border border-border p-6 hover:bg-card/80 hover:shadow-lg hover:shadow-blue-600/10 transition-all ${
                    booking.status === 'completed' || booking.status === 'cancelled' || booking.status === 'expired'
                      ? 'opacity-100' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center shrink-0 border border-blue-500/30">
                        <User className="w-6 h-6 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-foreground truncate">
                          {booking.provider?.name ?? 'Unknown'}
                        </h3>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full mt-0.5 ${s.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          {s.label}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-foreground">${Number(booking.price || 0).toFixed(2)}</p>
                      {booking.date && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(booking.date).toLocaleDateString('en-AU', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
                    {booking.time && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-primary" />
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
          <div className="bg-card/60 rounded-2xl border border-border p-12 text-center shadow-lg shadow-slate-950/20">
            <Calendar className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-foreground mb-2">
              No {filter !== 'all' ? filter : ''} bookings
            </h3>
            <p className="text-muted-foreground mb-6">
              {filter === 'upcoming' 
                ? "You don't have any upcoming lessons scheduled."
                : filter === 'past'
                ? "You haven't completed any lessons yet."
                : "You haven't made any bookings yet."
              }
            </p>
            <Link
              href="/client-dashboard/book-lesson"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-foreground font-semibold rounded-xl hover:shadow-lg hover:shadow-blue-600/50 transition-all"
            >
              <BookOpen className="w-5 h-5 mr-2" />
              Book Your First Lesson
            </Link>
          </div>
        )}

        {/* Pagination Controls */}
        {pagination.pages > 1 && (
          <div className="mt-6 flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.pages} ({pagination.total} total)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => loadData(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-4 py-2 border border-border rounded-lg text-foreground hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => loadData(pagination.page + 1)}
                disabled={!pagination.hasMore}
                className="px-4 py-2 border border-border rounded-lg text-foreground hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
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
