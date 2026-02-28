'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface BookingDetails {
  id: string
  startTime: string
  endTime: string
  price: number
  pickupAddress: string
  instructor: {
    name: string
    profileImage?: string
  }
  client: {
    name: string
    email: string
  }
}

function PaymentForm({ bookingId, clientSecret, booking }: { 
  bookingId: string
  clientSecret: string
  booking: BookingDetails 
}) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setProcessing(true)
    setError(null)

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/booking/${bookingId}/confirmation`,
      },
    })

    if (submitError) {
      setError(submitError.message || 'Payment failed')
      setProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
      >
        {processing ? 'Processing...' : `Pay $${booking.price.toFixed(2)}`}
      </button>

      <p className="text-sm text-gray-500 text-center">
        Your payment is secure and encrypted
      </p>
    </form>
  )
}

export default function PaymentPage() {
  const params = useParams()
  const router = useRouter()
  const bookingId = params.id as string
  
  const [booking, setBooking] = useState<BookingDetails | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadBookingAndPayment() {
      try {
        // Fetch booking details
        const bookingRes = await fetch(`/api/public/bookings/${bookingId}`)
        if (!bookingRes.ok) throw new Error('Booking not found')
        
        const bookingData = await bookingRes.json()
        setBooking(bookingData)

        // Check if already paid
        if (bookingData.isPaid) {
          router.push(`/booking/${bookingId}`)
          return
        }

        // Create payment intent
        const paymentRes = await fetch('/api/payments/create-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId,
            clientEmail: bookingData.client.email,
          }),
        })

        if (!paymentRes.ok) throw new Error('Failed to create payment')
        
        const paymentData = await paymentRes.json()
        setClientSecret(paymentData.clientSecret)
      } catch (err: any) {
        setError(err.message || 'Failed to load payment')
      } finally {
        setLoading(false)
      }
    }

    loadBookingAndPayment()
  }, [bookingId, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading payment...</p>
        </div>
      </div>
    )
  }

  if (error || !booking || !clientSecret) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Error</h1>
          <p className="text-gray-600 mb-6">{error || 'Unable to load payment'}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  const startDate = new Date(booking.startTime)
  const endDate = new Date(booking.endTime)
  const duration = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60))

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-blue-600 text-white px-6 py-4">
            <h1 className="text-2xl font-bold">Complete Your Payment</h1>
            <p className="text-blue-100 mt-1">Secure payment powered by Stripe</p>
          </div>

          <div className="p-6 md:p-8">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Booking Summary */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Booking Summary</h2>
                
                <div className="space-y-4">
                  {/* Instructor */}
                  <div className="flex items-center space-x-3">
                    {booking.instructor.profileImage ? (
                      <img
                        src={booking.instructor.profileImage}
                        alt={booking.instructor.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 font-semibold text-lg">
                          {booking.instructor.name.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">{booking.instructor.name}</p>
                      <p className="text-sm text-gray-500">Your Instructor</p>
                    </div>
                  </div>

                  {/* Date & Time */}
                  <div className="border-t pt-4">
                    <div className="flex items-start space-x-3">
                      <span className="text-2xl">📅</span>
                      <div>
                        <p className="font-medium text-gray-900">
                          {startDate.toLocaleDateString('en-AU', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </p>
                        <p className="text-sm text-gray-600">
                          {startDate.toLocaleTimeString('en-AU', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })} - {endDate.toLocaleTimeString('en-AU', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                        <p className="text-sm text-gray-500">{duration} minutes</p>
                      </div>
                    </div>
                  </div>

                  {/* Location */}
                  <div className="border-t pt-4">
                    <div className="flex items-start space-x-3">
                      <span className="text-2xl">📍</span>
                      <div>
                        <p className="font-medium text-gray-900">Pickup Location</p>
                        <p className="text-sm text-gray-600">{booking.pickupAddress}</p>
                      </div>
                    </div>
                  </div>

                  {/* Price Breakdown */}
                  <div className="border-t pt-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-gray-600">
                        <span>Lesson ({duration} min)</span>
                        <span>${booking.price.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-gray-900 text-lg pt-2 border-t">
                        <span>Total</span>
                        <span>${booking.price.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Form */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Details</h2>
                
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <PaymentForm 
                    bookingId={bookingId} 
                    clientSecret={clientSecret}
                    booking={booking}
                  />
                </Elements>

                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600">
                    <strong>Cancellation Policy:</strong> Free cancellation up to 24 hours before the lesson. 
                    Cancellations within 24 hours may incur a fee.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
