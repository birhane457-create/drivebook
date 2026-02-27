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
  Edit2,
  X as XIcon,
  MapPin,
  User
} from 'lucide-react';
import RescheduleModal from '@/components/RescheduleModal';
import CancelDialog from '@/components/CancelDialog';

interface Booking {
  id: string;
  date: string;
  time: string;
  startTime?: string;
  duration: number;
  price: number;
  status: string;
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
  const [rescheduleModal, setRescheduleModal] = useState<{
    isOpen: boolean;
    bookingId: string;
    instructorId: string;
    date: string;
    time: string;
    duration: number;
    price: number;
    instructor: string;
    hourlyRate: number;
  } | null>(null);
  const [cancelDialog, setCancelDialog] = useState<{
    isOpen: boolean;
    bookingId: string;
    date: string;
    instructor: string;
    price: number;
  } | null>(null);

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

  const upcomingBookings = profile.bookings.filter(b => b.status === 'upcoming');
  const pastBookings = profile.bookings.filter(b => b.status === 'completed');
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
            {filteredBookings.map((booking) => (
              <div
                key={booking.id}
                className={`bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition ${
                  booking.status === 'completed' ? 'opacity-75' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">
                          {booking.instructor.name}
                        </h3>
                        <span
                          className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                            booking.status === 'upcoming'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {booking.status === 'upcoming' ? 'Upcoming' : 'Completed'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        <div>
                          <p className="text-xs text-gray-500">Date</p>
                          <p className="font-semibold">
                            {new Date(booking.date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="w-5 h-5 text-blue-600" />
                        <div>
                          <p className="text-xs text-gray-500">Time & Duration</p>
                          <p className="font-semibold">{booking.time} • {booking.duration}h</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <BookOpen className="w-5 h-5 text-blue-600" />
                        <div>
                          <p className="text-xs text-gray-500">Price</p>
                          <p className="font-semibold text-gray-900">
                            ${booking.price.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {booking.status === 'upcoming' && (
                    <div className="flex flex-col gap-2 ml-4">
                      <button
                        onClick={() => setRescheduleModal({
                          isOpen: true,
                          bookingId: booking.id,
                          instructorId: booking.instructor.id,
                          date: booking.date,
                          time: booking.time,
                          duration: booking.duration * 60, // Convert hours to minutes
                          price: booking.price,
                          instructor: booking.instructor.name,
                          hourlyRate: booking.instructor.hourlyRate
                        })}
                        className="px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition text-sm font-semibold flex items-center gap-2"
                      >
                        <Edit2 className="w-4 h-4" />
                        Reschedule
                      </button>
                      <button
                        onClick={() => setCancelDialog({
                          isOpen: true,
                          bookingId: booking.id,
                          date: booking.date,
                          instructor: booking.instructor.name,
                          price: booking.price
                        })}
                        className="px-4 py-2 text-red-600 border border-red-600 rounded-lg hover:bg-red-50 transition text-sm font-semibold flex items-center gap-2"
                      >
                        <XIcon className="w-4 h-4" />
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
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

      {/* Reschedule Modal */}
      {rescheduleModal && (
        <RescheduleModal
          isOpen={rescheduleModal.isOpen}
          onClose={() => setRescheduleModal(null)}
          bookingId={rescheduleModal.bookingId}
          instructorId={rescheduleModal.instructorId}
          currentDate={rescheduleModal.date}
          currentTime={rescheduleModal.time}
          currentDuration={rescheduleModal.duration}
          currentPrice={rescheduleModal.price}
          instructorName={rescheduleModal.instructor}
          instructorHourlyRate={rescheduleModal.hourlyRate}
          onSuccess={loadData}
        />
      )}

      {/* Cancel Dialog */}
      {cancelDialog && (
        <CancelDialog
          isOpen={cancelDialog.isOpen}
          onClose={() => setCancelDialog(null)}
          bookingId={cancelDialog.bookingId}
          instructorName={cancelDialog.instructor}
          bookingDate={cancelDialog.date}
          bookingPrice={cancelDialog.price}
          onSuccess={loadData}
        />
      )}
    </div>
  );
}