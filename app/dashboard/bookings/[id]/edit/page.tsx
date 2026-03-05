'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { AlertCircle, ArrowLeft } from 'lucide-react'
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

export default function EditBookingPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState<Booking | null>(null)

  // Determine redirect URL based on user role
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'
  const redirectUrl = isAdmin ? '/admin/bookings' : '/dashboard/bookings'

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
        router.push(redirectUrl)
      }
    } catch (error) {
      console.error('Failed to fetch booking:', error)
      alert('Failed to load booking')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this booking?')) return

    try {
      const response = await fetch(`/api/bookings/${params.id}/cancel`, {
        method: 'POST'
      })

      if (response.ok) {
        alert('Booking cancelled successfully!')
        router.push(redirectUrl)
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  if (!booking) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-4 sm:py-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Bookings
        </button>

        <h1 className="text-2xl sm:text-3xl font-bold mb-6">Edit Booking</h1>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Cancellation Policy:</p>
              <ul className="space-y-1">
                <li>• Cancel 48+ hours before: Full refund</li>
                <li>• Cancel 24-48 hours before: 50% refund</li>
                <li>• Cancel less than 24 hours: No refund</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6">
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
          redirectAfterUpdate={redirectUrl}
        />

        <div className="mt-6">
          <button
            onClick={handleCancel}
            className="w-full bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700"
          >
            Cancel Booking
          </button>
        </div>
      </div>
    </div>
  )
}
