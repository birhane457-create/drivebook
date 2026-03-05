'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import AdminNav from '@/components/admin/AdminNav'
import BookingFormNew from '@/components/BookingFormNew'

interface Client {
  id: string
  name: string
  phone: string
  email: string
}

interface Booking {
  id: string
  startTime: string
  endTime: string
  pickupAddress?: string
  pickupLatitude?: number
  pickupLongitude?: number
  notes?: string
  price: number
  status: string
  bookingType: string
  client: Client
}

export default function AdminEditBookingPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState<Booking | null>(null)

  useEffect(() => {
    fetchBooking()
  }, [params.id])

  const fetchBooking = async () => {
    try {
      const res = await fetch(`/api/bookings/${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setBooking(data)
      } else {
        alert('Booking not found')
        router.push('/admin/bookings')
      }
    } catch (error) {
      console.error('Failed to fetch booking:', error)
      alert('Failed to load booking')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this booking? The client and instructor will be notified.')) return

    try {
      const response = await fetch(`/api/bookings/${params.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelled by admin' })
      })

      if (response.ok) {
        alert('Booking cancelled successfully!')
        router.push('/admin/bookings')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to cancel booking')
      }
    } catch (error) {
      console.error('Cancel error:', error)
      alert('Failed to cancel booking')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    )
  }

  if (!booking) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => router.push('/admin/bookings')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Admin Bookings
        </button>

        <h1 className="text-3xl font-bold mb-6">Edit Booking (Admin)</h1>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Admin Editing:</p>
              <p>You are editing this booking as an administrator. Changes will be saved and notifications will be sent to the client and instructor.</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Client Information</h2>
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">Name:</span> {booking.client.name}</p>
            <p><span className="font-medium">Phone:</span> {booking.client.phone}</p>
            <p><span className="font-medium">Email:</span> {booking.client.email}</p>
          </div>
        </div>

        {/* Use the same booking form with availability calendar */}
        <BookingFormNew
          preselectedClient={{
            id: booking.client.id,
            name: booking.client.name,
            email: booking.client.email,
            phone: booking.client.phone
          }}
          isInstructorBooking={true}
          existingBooking={{
            id: booking.id,
            startTime: booking.startTime,
            endTime: booking.endTime,
            pickupAddress: booking.pickupAddress,
            pickupLatitude: booking.pickupLatitude,
            pickupLongitude: booking.pickupLongitude,
            notes: booking.notes,
            bookingType: booking.bookingType,
            status: booking.status
          }}
          redirectAfterUpdate="/admin/bookings"
        />

        <div className="mt-6">
          <button
            onClick={handleCancel}
            className="w-full bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 font-medium"
          >
            Cancel Booking (Admin Action)
          </button>
        </div>
      </div>
    </div>
  )
}
