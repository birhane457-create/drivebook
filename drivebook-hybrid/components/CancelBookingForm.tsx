'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, DollarSign } from 'lucide-react'

interface CancelBookingFormProps {
  bookingId: string
  hoursUntilBooking: number
  refundPercentage: number
  price: number
}

export default function CancelBookingForm({ 
  bookingId, 
  hoursUntilBooking, 
  refundPercentage,
  price 
}: CancelBookingFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [reason, setReason] = useState('')

  const refundAmount = (price * refundPercentage) / 100

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this booking?')) return

    setLoading(true)
    try {
      const response = await fetch(`/api/public/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Booking cancelled! Refund: $${data.refund.amount.toFixed(2)} (${data.refund.percentage}%)`)
        router.push('/')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to cancel booking')
      }
    } catch (error) {
      console.error('Cancel error:', error)
      alert('Failed to cancel booking')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Cancellation Policy */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <p className="font-semibold mb-2">Cancellation Policy:</p>
            <ul className="space-y-1">
              <li>• Cancel 48+ hours before: 100% refund</li>
              <li>• Cancel 24-48 hours before: 50% refund</li>
              <li>• Cancel less than 24 hours: No refund</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Refund Calculation */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="font-semibold mb-4">Your Refund</h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600">Hours until booking:</span>
            <span className="font-semibold">{Math.floor(hoursUntilBooking)} hours</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Original price:</span>
            <span className="font-semibold">${price.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Refund percentage:</span>
            <span className="font-semibold">{refundPercentage}%</span>
          </div>
          <div className="border-t pt-3 flex justify-between items-center">
            <span className="text-lg font-semibold">Refund amount:</span>
            <span className="text-2xl font-bold text-green-600">
              <DollarSign className="inline h-5 w-5" />
              {refundAmount.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Reason */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Reason for cancellation (optional)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Let us know why you're cancelling..."
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 px-4 py-3 border rounded-lg hover:bg-gray-50"
        >
          Keep Booking
        </button>
        <button
          onClick={handleCancel}
          disabled={loading}
          className="flex-1 bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? 'Cancelling...' : 'Cancel Booking'}
        </button>
      </div>

      {hoursUntilBooking < 24 && (
        <p className="text-sm text-red-600 text-center">
          ⚠️ Cancelling now will result in no refund as it's less than 24 hours before your booking.
        </p>
      )}
    </div>
  )
}
