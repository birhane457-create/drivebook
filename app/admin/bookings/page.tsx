'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminNav from '@/components/admin/AdminNav';
import { formatBookingId } from '@/lib/utils';

interface Booking {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  bookingType: string;
  price: number;
  pickupAddress?: string;
  dropoffAddress?: string;
  notes?: string;
  checkInTime?: string;
  checkOutTime?: string;
  client: {
    name: string;
    email: string;
    phone: string;
  };
  instructor: {
    id: string;
    name: string;
    phone: string;
  };
}

export default function AdminBookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const res = await fetch('/api/admin/bookings');
      if (res.ok) {
        const data = await res.json();
        setBookings(data);
      }
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (bookingId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(bookingId)) {
      newExpanded.delete(bookingId);
    } else {
      newExpanded.add(bookingId);
    }
    setExpandedRows(newExpanded);
  };

  const handleEditBooking = (bookingId: string) => {
    router.push(`/dashboard/bookings/${bookingId}/edit`);
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking? The client and instructor will be notified.')) {
      return;
    }

    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelled by admin' })
      });

      if (res.ok) {
        alert('Booking cancelled successfully');
        fetchBookings(); // Refresh the list
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to cancel booking');
      }
    } catch (error) {
      console.error('Cancel error:', error);
      alert('Failed to cancel booking');
    }
  };

  const handleViewDetails = (bookingId: string) => {
    router.push(`/booking/${bookingId}`);
  };

  const handleViewInstructorProfile = (instructorId: string) => {
    router.push(`/admin/instructors/${instructorId}`);
  };

  const filteredBookings = bookings.filter(booking => {
    // Filter by status
    if (statusFilter !== 'all' && booking.status !== statusFilter) return false;
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        booking.client.name.toLowerCase().includes(query) ||
        booking.client.email.toLowerCase().includes(query) ||
        booking.instructor.name.toLowerCase().includes(query) ||
        booking.id.toLowerCase().includes(query)
      );
    }
    
    return true;
  });

  const stats = {
    total: bookings.length,
    confirmed: bookings.filter(b => b.status === 'CONFIRMED').length,
    pending: bookings.filter(b => b.status === 'PENDING').length,
    cancelled: bookings.filter(b => b.status === 'CANCELLED').length,
    completed: bookings.filter(b => b.status === 'COMPLETED').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <p>Loading bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">All Bookings</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-sm text-gray-600">Total</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-sm text-gray-600">Confirmed</p>
            <p className="text-2xl font-bold text-green-600">{stats.confirmed}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-sm text-gray-600">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-sm text-gray-600">Completed</p>
            <p className="text-2xl font-bold text-blue-600">{stats.completed}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-sm text-gray-600">Cancelled</p>
            <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              placeholder="Search by client, instructor, or booking ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-4 py-2 rounded ${statusFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-200'}`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('CONFIRMED')}
                className={`px-4 py-2 rounded ${statusFilter === 'CONFIRMED' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
              >
                Confirmed
              </button>
              <button
                onClick={() => setStatusFilter('PENDING')}
                className={`px-4 py-2 rounded ${statusFilter === 'PENDING' ? 'bg-yellow-600 text-white' : 'bg-gray-200'}`}
              >
                Pending
              </button>
              <button
                onClick={() => setStatusFilter('COMPLETED')}
                className={`px-4 py-2 rounded ${statusFilter === 'COMPLETED' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              >
                Completed
              </button>
              <button
                onClick={() => setStatusFilter('CANCELLED')}
                className={`px-4 py-2 rounded ${statusFilter === 'CANCELLED' ? 'bg-red-600 text-white' : 'bg-gray-200'}`}
              >
                Cancelled
              </button>
            </div>
          </div>
        </div>

        {/* Compact Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8"></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Instructor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date/Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredBookings.map((booking) => {
                const isExpanded = expandedRows.has(booking.id);
                return (
                  <>
                    <tr key={booking.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleRow(booking.id)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{booking.client.name}</div>
                        <div className="text-xs text-gray-500">{booking.client.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900">{booking.instructor.name}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(booking.startTime).toLocaleDateString()}
                        <div className="text-xs">{new Date(booking.startTime).toLocaleTimeString()}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {booking.bookingType}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                          booking.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                          booking.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                          booking.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {booking.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        ${booking.price.toFixed(2)}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
                            <div>
                              <p className="font-semibold text-gray-700 mb-2">Client Details</p>
                              <p className="text-gray-600">Name: {booking.client.name}</p>
                              <p className="text-gray-600">Email: {booking.client.email}</p>
                              <p className="text-gray-600">Phone: {booking.client.phone}</p>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-700 mb-2">Instructor Details</p>
                              <p className="text-gray-600">Name: {booking.instructor.name}</p>
                              <p className="text-gray-600">Phone: {booking.instructor.phone}</p>
                              <button
                                onClick={() => handleViewInstructorProfile(booking.instructor.id)}
                                className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                              >
                                View Instructor Profile →
                              </button>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-700 mb-2">Booking Details</p>
                              <p className="text-gray-600">ID: #{formatBookingId(booking.id)}</p>
                              <p className="text-gray-600">Type: {booking.bookingType}</p>
                              <p className="text-gray-600">Duration: {Math.round((new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime()) / 60000)} mins</p>
                              {booking.checkInTime && (
                                <p className="text-gray-600">Check-in: {new Date(booking.checkInTime).toLocaleTimeString()}</p>
                              )}
                              {booking.checkOutTime && (
                                <p className="text-gray-600">Check-out: {new Date(booking.checkOutTime).toLocaleTimeString()}</p>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                            <div>
                              <p className="font-semibold text-gray-700 mb-2">Addresses</p>
                              {booking.pickupAddress && (
                                <p className="text-gray-600">Pickup: {booking.pickupAddress}</p>
                              )}
                              {booking.dropoffAddress && (
                                <p className="text-gray-600">Dropoff: {booking.dropoffAddress}</p>
                              )}
                            </div>
                            {booking.notes && (
                              <div>
                                <p className="font-semibold text-gray-700 mb-2">Notes:</p>
                                <p className="text-gray-600">{booking.notes}</p>
                              </div>
                            )}
                          </div>
                          {/* Admin Actions */}
                          <div className="flex gap-3 pt-3 border-t border-gray-200">
                            <button
                              onClick={() => handleEditBooking(booking.id)}
                              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                            >
                              Edit Booking
                            </button>
                            {booking.status !== 'CANCELLED' && booking.status !== 'COMPLETED' && (
                              <button
                                onClick={() => handleCancelBooking(booking.id)}
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                              >
                                Cancel Booking
                              </button>
                            )}
                            <button
                              onClick={() => handleViewDetails(booking.id)}
                              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                            >
                              View Full Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>

          {filteredBookings.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No bookings found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
