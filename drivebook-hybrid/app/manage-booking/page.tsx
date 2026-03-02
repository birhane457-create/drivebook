'use client'

import { useState } from 'react'
import { Search, Calendar, Clock, MapPin, DollarSign, User, Mail, Phone } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ManageBookingPage() {
  const router = useRouter()
  const [bookingId, setBookingId] = useState('')
  const [loading, setLoading] = useState(false)
  const [booking, setBooking] = useState<any>(null)
  const [error, setError] = useState('')

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setBooking(null)

    try {
      const response = await fetch(`/api/public/bookings/${bookingId}`)
      
      if (response.ok) {
        const data = await response.json()
        setBooking(data)
      } else {
        setError('Booking not found. Please check your Booking ID.')
      }
    } catch (err) {
      setError('Failed to fetch booking. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED': return 'bg-green-100 text-green-800'
      case 'PENDING': return 'bg-yellow-100 text-yellow-800'
      case 'COMPLETED': return 'bg-blue-100 text-blue-800'
      case 'CANCELLED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Manage Your Booking</h1>
          <p className="text-gray-600">Enter your Booking ID to view or modify your lesson</p>
        </div>

        <form onSubmit={handleSearch} className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <label className="block text-sm font-medium mb-2">
            <Search className="inline h-4 w-4 mr-1" />
            Booking ID
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              required
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              placeholder="Enter your booking ID (e.g., 65a1b2c3d4e5f6g7h8i9j0k1)"
              className="flex-1 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-600 font-mono text-sm"
            />
            <button
              type="submit"
              disabled={loading || !bookingId}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
          {error && (
            <p className="text-red-600 text-sm mt-2">{error}</p>
          )}
        </form>

        {booking && (
          <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold mb-2">Booking Details</h2>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(booking.status)}`}>
                  {booking.status}
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Booking ID</p>
                <p className="font-mono text-xs text-gray-700">{booking.id}</p>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="font-semibold mb-4">Lesson Information</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Date</p>
                    <p className="font-medium">{formatDate(booking.startTime)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Time</p>
                    <p className="font-medium">
                      {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                    </p>
                  </div>
                </div>

                {booking.pickupAddress && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Pickup Location</p>
                      <p className="font-medium">{booking.pickupAddress}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <DollarSign className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Price</p>
                    <p className="font-medium text-lg">${booking.price.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="font-semibold mb-4">Your Details</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="font-medium">{booking.client.name}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{booking.client.email}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="font-medium">{booking.client.phone}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="font-semibold mb-4">Instructor Details</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="font-medium">{booking.instructor.name}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="font-medium">{booking.instructor.phone}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{booking.instructor.email}</p>
                  </div>
                </div>
              </div>
            </div>

            {booking.notes && (
              <div className="border-t pt-6">
                <h3 className="font-semibold mb-2">Notes</h3>
                <p className="text-gray-700">{booking.notes}</p>
              </div>
            )}

            {booking.status !== 'CANCELLED' && booking.status !== 'COMPLETED' && (
              <div className="border-t pt-6 space-y-3">
                <button
                  onClick={() => router.push(`/cancel-booking/${booking.id}`)}
                  className="w-full bg-red-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-red-700"
                >
                  Cancel Booking
                </button>
                <p className="text-xs text-gray-500 text-center">
                  Cancellation policy applies: 48+ hours (100% refund) • 24-48 hours (50% refund) • Less than 24 hours (No refund)
                </p>
              </div>
            )}

            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
              <p className="font-medium mb-1">Need to make changes?</p>
              <p>Contact your instructor directly at {booking.instructor.phone} or {booking.instructor.email}</p>
            </div>
          </div>
        )}

        {!booking && !error && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
            <p className="text-blue-800">
              Your Booking ID was sent to your email when you made the booking.
              <br />
              Check your inbox for the confirmation email.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
