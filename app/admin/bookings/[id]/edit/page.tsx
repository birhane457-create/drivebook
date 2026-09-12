'use client'
import { AdminPageLayout } from '@/components/ui'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowLeft, XCircle } from 'lucide-react'
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
  const [pageError, setPageError] = useState<string | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelSuccess, setCancelSuccess] = useState(false)

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
        setPageError('Booking not found')
      }
    } catch (error) {
      console.error('Failed to fetch booking:', error)
      setPageError('Failed to load booking')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    setCancelError(null)
    setCancelling(true)
    try {
      const response = await fetch(`/api/bookings/${params.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelled by admin' })
      })

      if (response.ok) {
        setCancelSuccess(true)
        setTimeout(() => router.push('/admin/bookings'), 1500)
      } else {
        const error = await response.json()
        setCancelError(error.error || 'Failed to cancel booking')
      }
    } catch (error) {
      console.error('Cancel error:', error)
      setCancelError('Failed to cancel booking')
    } finally {
      setCancelling(false)
      setCancelConfirm(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AdminPageLayout title="Edit Booking (Admin)" breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Edit' }]}>
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="text-center">Loading...</div>
          </div>
        </AdminPageLayout>
      </div>
    )
  }

  if (pageError || !booking) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AdminPageLayout title="Edit Booking (Admin)" breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Edit' }]}>
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex items-center gap-3 bg-red-900/20 border border-red-700/50 rounded-xl p-4">
              <XCircle className="h-5 w-5 text-destructive shrink-0" />
              <p className="text-destructive">{pageError || 'Booking not found'}</p>
            </div>
            <button onClick={() => router.push('/admin/bookings')} className="mt-4 text-sm text-muted-foreground hover:text-foreground">
              ← Back to bookings
            </button>
          </div>
        </AdminPageLayout>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdminPageLayout title="Edit Booking (Admin)" breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Edit' }]}>
        <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => router.push('/admin/bookings')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Admin Bookings
        </button>

        <h1 className="text-3xl font-bold mb-6">Edit Booking (Admin)</h1>

        <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm text-primary">
              <p className="font-semibold mb-1">Admin Editing:</p>
              <p>You are editing this booking as an administrator. Changes will be saved and notifications will be sent to the client and instructor.</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Client Information</h2>
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">Name:</span> {(booking as any).customer.name}</p>
            <p><span className="font-medium">Phone:</span> {(booking as any).customer.phone}</p>
            <p><span className="font-medium">Email:</span> {(booking as any).customer.email}</p>
          </div>
        </div>

        {/* Use the same booking form with availability calendar */}
        <BookingFormNew
          preselectedClient={{
            id: (booking as any).customer.id,
            name: (booking as any).customer.name,
            email: (booking as any).customer.email,
            phone: (booking as any).customer.phone
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

        {/* Cancel section with inline confirm — no browser dialog */}
        <div className="mt-6 space-y-3">
          {cancelError && (
            <div role="alert" className="flex items-center gap-2 bg-red-900/20 border border-red-700/50 rounded-xl px-4 py-3 text-sm text-destructive">
              <XCircle className="h-4 w-4 shrink-0" />
              {cancelError}
            </div>
          )}
          {cancelSuccess && (
            <div className="flex items-center gap-2 bg-green-900/20 border border-green-700/50 rounded-xl px-4 py-3 text-sm text-emerald-400">
              Booking cancelled. Redirecting…
            </div>
          )}
          {!cancelConfirm ? (
            <button
              onClick={() => setCancelConfirm(true)}
              className="w-full bg-destructive text-foreground px-4 py-3 rounded-lg hover:bg-destructive/90 font-medium"
            >
              Cancel Booking (Admin Action)
            </button>
          ) : (
            <div className="border-2 border-red-700/60 rounded-xl p-4 bg-red-900/10 space-y-3">
              <p className="text-sm font-semibold text-destructive">Cancel this booking? The client and instructor will be notified.</p>
              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex-1 bg-destructive text-foreground px-4 py-2.5 rounded-lg hover:bg-destructive/90 text-sm font-semibold disabled:opacity-50"
                >
                  {cancelling ? 'Cancelling…' : 'Yes, cancel booking'}
                </button>
                <button
                  onClick={() => { setCancelConfirm(false); setCancelError(null); }}
                  className="flex-1 border border-border text-foreground px-4 py-2.5 rounded-lg hover:bg-secondary text-sm"
                >
                  Keep booking
                </button>
              </div>
            </div>
          )}
        </div>
        </div>
      </AdminPageLayout>
    </div>
  )
}
