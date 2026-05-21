'use client'

import { useState, useEffect } from 'react'
import { Calendar, Clock, User, Mail, Phone, MapPin, DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react'
import SlotPicker from '@/components/SlotPicker'

interface BookingFormProps {
  instructorId?: string
  hourlyRate?: number
  preselectedClient?: {
    id: string
    name: string
    email: string
    phone: string
    addressText?: string
  }
  isInstructorBooking?: boolean
  existingBooking?: {
    id: string
    startTime: string
    endTime: string
    pickupAddress?: string
    pickupLatitude?: number
    pickupLongitude?: number
    notes?: string
    bookingType: string
    status: string
  }
  redirectAfterUpdate?: string // URL to redirect to after successful update
}

export default function BookingForm({ 
  instructorId, 
  hourlyRate,
  preselectedClient,
  isInstructorBooking = false,
  existingBooking,
  redirectAfterUpdate
}: BookingFormProps) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [pendingPayment, setPendingPayment] = useState(false)
  const [pendingMessage, setPendingMessage] = useState('')
  const [bookingId, setBookingId] = useState('')
  const [instructorData, setInstructorData] = useState<{ id: string; hourlyRate: number } | null>(null)
  const [insufficientBalance, setInsufficientBalance] = useState<{
    clientName: string
    clientEmail: string
    clientId: string
    currentBalance: number
    required: number
    shortfall: number
    topUpAmount: number
  } | null>(null)
  const [sendingLink, setSendingLink] = useState(false)
  const [linkSent, setLinkSent] = useState(false)
  
  // Initialize form data with existing booking if editing
  const [formData, setFormData] = useState(() => {
    if (existingBooking) {
      const start = new Date(existingBooking.startTime)
      const end = new Date(existingBooking.endTime)
      const duration = (end.getTime() - start.getTime()) / (1000 * 60)
      
      return {
        name: preselectedClient?.name || '',
        email: preselectedClient?.email || '',
        phone: preselectedClient?.phone || '',
        address: existingBooking.pickupAddress || preselectedClient?.addressText || '',
        dropoffAddress: (existingBooking as any).dropoffAddress || '',
        sameAsPickup: !(existingBooking as any).dropoffAddress,
        date: start.toISOString().split('T')[0],
        time: start.toTimeString().slice(0, 5),
        duration,
        notes: existingBooking.notes || '',
        joinWaitingList: false,
        ageDeclaration: false,
        termsAccepted: false,
      }
    }
    
    return {
      name: preselectedClient?.name || '',
      email: preselectedClient?.email || '',
      phone: preselectedClient?.phone || '',
      address: preselectedClient?.addressText || '',
      dropoffAddress: '',
      sameAsPickup: true,
      date: '',
      time: '',
      duration: 60,
      notes: '',
      joinWaitingList: false,
      ageDeclaration: false,
      termsAccepted: false,
    }
  })

  // Fetch instructor data if not provided (for instructor booking)
  useEffect(() => {
    if (isInstructorBooking && !instructorId) {
      fetchInstructorData()
    } else if (instructorId && hourlyRate) {
      setInstructorData({ id: instructorId, hourlyRate })
    }
  }, [isInstructorBooking, instructorId, hourlyRate])

  const fetchInstructorData = async () => {
    try {
      const res = await fetch('/api/instructor/profile')
      if (res.ok) {
        const data = await res.json()
        setInstructorData({ id: data.id, hourlyRate: data.hourlyRate })
      }
    } catch (error) {
      console.error('Failed to fetch instructor data:', error)
    }
  }

  const calculatePrice = () => {
    if (!instructorData) return '0.00'
    const hours = formData.duration / 60
    return (instructorData.hourlyRate * hours).toFixed(2)
  }

  const sendPaymentLink = async () => {
    if (!insufficientBalance) return
    setSendingLink(true)
    try {
      const lessonDate = formData.date
        ? new Date(formData.date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })
        : undefined
      const res = await fetch('/api/bookings/send-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: insufficientBalance.clientId,
          topUpAmount: insufficientBalance.topUpAmount,
          lessonPrice: insufficientBalance.required,
          shortfall: insufficientBalance.shortfall,
          platformFeeRate: 0.036,
          lessonDate,
        })
      })
      if (res.ok) {
        setLinkSent(true)
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to send payment link')
      }
    } catch {
      alert('Failed to send payment link')
    } finally {
      setSendingLink(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!instructorData) return
    
    setLoading(true)

    try {
      const [hours, minutes] = formData.time.split(':')
      const startTime = new Date(formData.date)
      startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0)
      
      const endTime = new Date(startTime)
      endTime.setMinutes(endTime.getMinutes() + formData.duration)

      // If editing existing booking, use PATCH
      if (existingBooking) {
        const response = await fetch(`/api/bookings/${existingBooking.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            pickupAddress: formData.address,
            dropoffAddress: formData.sameAsPickup ? undefined : formData.dropoffAddress || undefined,
            notes: formData.notes,
            price: parseFloat(calculatePrice())
          })
        })

        if (response.ok) {
          alert('Booking updated successfully!')
          window.location.href = redirectAfterUpdate || '/dashboard/bookings'
        } else {
          const error = await response.json()
          alert(error.error || 'Failed to update booking')
        }
        return
      }

      // Use different API endpoint for instructor bookings
      const apiEndpoint = isInstructorBooking ? '/api/bookings' : '/api/public/bookings'
      
      const bookingData = isInstructorBooking && preselectedClient ? {
        clientId: preselectedClient.id,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        pickupAddress: formData.address,
        dropoffAddress: formData.sameAsPickup ? undefined : formData.dropoffAddress || undefined,
        notes: formData.notes,
        price: parseFloat(calculatePrice()),
        bookingType: 'LESSON',
        createdBy: 'instructor'
      } : {
        instructorId: instructorData.id,
        clientName: formData.name,
        clientEmail: formData.email,
        clientPhone: formData.phone,
        pickupAddress: formData.address,
        dropoffAddress: formData.sameAsPickup ? undefined : formData.dropoffAddress || undefined,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        notes: formData.notes,
        price: parseFloat(calculatePrice()),
        termsAccepted: formData.termsAccepted,
        ageDeclaration: formData.ageDeclaration,
        termsVersion: '1.0',
      }

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData)
      })

      if (response.ok) {
        const data = await response.json()
        
        // Redirect to payment page if required
        if (data.redirectTo) {
          window.location.href = data.redirectTo
          return
        }
        
        setBookingId(data.booking.id)

        // Pending payment — client has no account or insufficient funds
        // Show a clear informational screen, do NOT auto-redirect
        if (data.pendingPayment) {
          setPendingMessage(data.message || 'Booking created. The client needs to top up their wallet to confirm.')
          setPendingPayment(true)
          setSuccess(true)
          return
        }

        setSuccess(true)

        // Redirect to bookings page for instructor bookings (confirmed only)
        if (isInstructorBooking) {
          setTimeout(() => {
            window.location.href = '/dashboard/bookings'
          }, 2000)
        }
      } else {
        const error = await response.json()
        if (error.insufficientBalance) {
          setInsufficientBalance({
            clientName: error.clientName,
            clientEmail: error.clientEmail,
            clientId: error.clientId,
            currentBalance: error.currentBalance,
            required: error.required,
            shortfall: error.shortfall,
            topUpAmount: error.topUpAmount,
          })
        } else {
          alert(error.error || 'Failed to create booking')
        }
      }
    } catch (error) {
      console.error('Booking error:', error)
      alert('Failed to create booking')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    // ── Pending payment — client needs to top up ──────────────────────────
    if (pendingPayment) {
      return (
        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-amber-100 mb-4">
              <AlertCircle className="h-7 w-7 text-amber-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Booking Created — Awaiting Payment</h3>
            <p className="text-sm text-gray-500">
              The booking slot is reserved. The client needs to top up their wallet to confirm it.
            </p>
          </div>

          {/* Booking summary */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-5 space-y-2 text-sm">
            <p className="font-semibold text-amber-900">📋 Booking Details</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-700">
              <span className="font-medium">Booking ID:</span>
              <span className="font-mono text-xs">{bookingId}</span>
              <span className="font-medium">Date:</span>
              <span>{new Date(formData.date).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <span className="font-medium">Time:</span>
              <span>{formData.time}</span>
              <span className="font-medium">Duration:</span>
              <span>{formData.duration} min</span>
              <span className="font-medium">Price:</span>
              <span className="font-semibold text-amber-800">${calculatePrice()}</span>
              <span className="font-medium">Status:</span>
              <span className="text-amber-700 font-semibold">⏳ Awaiting Payment</span>
            </div>
          </div>

          {/* What happens next */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-5 text-sm">
            <p className="font-semibold text-blue-900 mb-2">What happens next?</p>
            <ol className="space-y-1.5 text-blue-800 list-decimal list-inside">
              <li>An email has been sent to the client with a payment link</li>
              <li>Once they top up their wallet, the booking confirms automatically</li>
              <li>You'll receive a notification when payment is received</li>
              <li>If they don't pay, the booking expires after 2 hours</li>
            </ol>
          </div>

          {/* Message from API */}
          {pendingMessage && (
            <p className="text-xs text-gray-500 text-center mb-5 italic">{pendingMessage}</p>
          )}

          {/* Actions */}
          <div className="space-y-2">
            <a
              href={`/dashboard/bookings/${bookingId}`}
              className="block w-full text-center bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 font-semibold text-sm"
            >
              View Booking
            </a>
            <a
              href="/dashboard/bookings"
              className="block w-full text-center bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-200 text-sm"
            >
              Back to Bookings
            </a>
          </div>
        </div>
      )
    }

    // ── Confirmed booking ─────────────────────────────────────────────────
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Booking Confirmed!</h3>
          <p className="text-sm text-gray-500 mb-4">
            {isInstructorBooking
              ? 'Booking created and payment deducted from client wallet.'
              : `We've sent a confirmation email to ${formData.email}`}
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm font-medium text-blue-900 mb-2">Your Booking ID:</p>
            <p className="text-2xl font-bold text-blue-600 font-mono">{bookingId}</p>
            <p className="text-xs text-blue-700 mt-2">
              Save this ID to manage your booking
            </p>
          </div>

          <div className="space-y-2 text-sm text-left bg-gray-50 rounded-lg p-4 mb-4">
            <p><span className="font-medium">Date:</span> {new Date(formData.date).toLocaleDateString()}</p>
            <p><span className="font-medium">Time:</span> {formData.time}</p>
            <p><span className="font-medium">Duration:</span> {formData.duration} minutes</p>
            <p><span className="font-medium">Pickup:</span> {formData.address}</p>
            <p><span className="font-medium">Price:</span> ${calculatePrice()}</p>
          </div>

          <div className="space-y-2">
            {isInstructorBooking ? (
              <>
                <a
                  href={`/dashboard/bookings/${bookingId}`}
                  className="block w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold"
                >
                  View Booking
                </a>
                <a
                  href="/dashboard/bookings"
                  className="block w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 text-sm"
                >
                  Back to Bookings
                </a>
              </>
            ) : (
              <>
                <a
                  href={`/cancel-booking/${bookingId}`}
                  className="block w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
                >
                  Manage Booking
                </a>
                <button
                  onClick={() => {
                    setSuccess(false)
                    setPendingPayment(false)
                    setFormData({
                      name: '', email: '', phone: '', address: '', dropoffAddress: '',
                      sameAsPickup: true, date: '', time: '', duration: 60, notes: '',
                      joinWaitingList: false, ageDeclaration: false, termsAccepted: false,
                    })
                  }}
                  className="block w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Book Another Lesson
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-6 sm:p-8 space-y-6">
      <h2 className="text-2xl font-bold mb-6">
        {existingBooking ? 'Update Booking' : 'Book a Lesson'}
      </h2>

      {/* Only show client fields if not preselected */}
      {!preselectedClient && (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                <User className="inline h-4 w-4 mr-1" />
                Full Name
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                placeholder="John Smith"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                <Mail className="inline h-4 w-4 mr-1" />
                Email
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                placeholder="john@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              <Phone className="inline h-4 w-4 mr-1" />
              Phone Number
            </label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
              placeholder="0412 345 678"
            />
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-medium mb-2">
          <MapPin className="inline h-4 w-4 mr-1" />
          Pickup Address
        </label>
        <input
          type="text"
          required
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
          placeholder="123 Main St, Perth WA 6000"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium">
            <MapPin className="inline h-4 w-4 mr-1 text-red-500" />
            Dropoff Address
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={formData.sameAsPickup}
              onChange={(e) => setFormData({ ...formData, sameAsPickup: e.target.checked, dropoffAddress: '' })}
              className="rounded"
            />
            Same as pickup
          </label>
        </div>
        {!formData.sameAsPickup && (
          <input
            type="text"
            value={formData.dropoffAddress}
            onChange={(e) => setFormData({ ...formData, dropoffAddress: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
            placeholder="456 End St, Perth WA 6000"
          />
        )}
        {formData.sameAsPickup && (
          <p className="text-sm text-gray-400 italic">Dropoff at same location as pickup</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          <Clock className="inline h-4 w-4 mr-1" />
          Duration
        </label>
        <select
          value={formData.duration}
          onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value), time: '' })}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
        >
          <option value="30">30 minutes</option>
          <option value="60">1 hour</option>
          <option value="90">1.5 hours</option>
          <option value="120">2 hours</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          <Calendar className="inline h-4 w-4 mr-1" />
          Date &amp; Time
        </label>
        <SlotPicker
          instructorId={instructorData?.id || instructorId || ''}
          duration={formData.duration}
          selected={formData.date && formData.time ? { date: formData.date, time: formData.time } : null}
          onSelect={(date, time) => setFormData({ ...formData, date, time })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
          placeholder="Any special requirements or notes..."
        />
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.joinWaitingList}
            onChange={(e) => setFormData({ ...formData, joinWaitingList: e.target.checked })}
            className="mt-1"
          />
          <div className="text-sm">
            <p className="font-medium text-yellow-900">Join Waiting List</p>
            <p className="text-yellow-700">
              Get notified if an earlier slot becomes available due to cancellations
            </p>
          </div>
        </label>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-lg font-semibold">Total Price:</span>
          <span className="text-3xl font-bold text-blue-600">
            <DollarSign className="inline h-6 w-6" />
            {calculatePrice()}
          </span>
        </div>
        {instructorData && (
          <p className="text-xs text-blue-700 mt-2">
            ${instructorData.hourlyRate}/hour × {formData.duration / 60} hour(s)
          </p>
        )}
      </div>

      {!existingBooking && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-600">
            <AlertCircle className="inline h-3 w-3 mr-1" />
            Cancellation Policy: 48+ hours (100% refund) • 24-48 hours (50% refund) • Less than 24 hours (No refund)
          </p>
        </div>
      )}

      {/* Age + Terms declarations — only for public (learner) bookings */}
      {!isInstructorBooking && !existingBooking && (
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              required
              checked={formData.ageDeclaration}
              onChange={(e) => setFormData({ ...formData, ageDeclaration: e.target.checked })}
              className="mt-0.5 rounded"
            />
            <span className="text-sm text-gray-700">
              I confirm that I am at least 16 years old and hold a valid learner's permit or driver's licence that allows me to undertake driving lessons.
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              required
              checked={formData.termsAccepted}
              onChange={(e) => setFormData({ ...formData, termsAccepted: e.target.checked })}
              className="mt-0.5 rounded"
            />
            <span className="text-sm text-gray-700">
              I have read and agree to the{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                Learner Terms and Conditions
              </a>{' '}
              and{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                Privacy Policy
              </a>.
            </span>
          </label>
        </div>
      )}

      {/* Insufficient balance panel */}
      {insufficientBalance && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">Insufficient wallet balance</p>
              <p className="text-sm text-red-700 mt-1">
                {insufficientBalance.clientName} has <strong>${insufficientBalance.currentBalance.toFixed(2)}</strong> but needs <strong>${insufficientBalance.required.toFixed(2)}</strong> for this lesson.
              </p>
              <p className="text-sm text-red-700">
                They need to top up <strong>${insufficientBalance.topUpAmount.toFixed(2)}</strong> (includes 3.6% platform fee).
              </p>
            </div>
          </div>
          {linkSent ? (
            <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Payment link sent to {insufficientBalance.clientEmail}
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={sendPaymentLink}
                disabled={sendingLink}
                className="flex-1 min-w-[200px] bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
              >
                {sendingLink ? 'Sending...' : `Send Payment Link — $${insufficientBalance.topUpAmount.toFixed(2)}`}
              </button>
              <button
                type="button"
                onClick={() => { setInsufficientBalance(null); setLinkSent(false) }}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                Dismiss
              </button>
            </div>
          )}
          {linkSent && (
            <p className="text-xs text-gray-500">Once the client tops up, retry the booking.</p>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !formData.time || !instructorData || (!isInstructorBooking && !existingBooking && (!formData.ageDeclaration || !formData.termsAccepted))}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Processing...' : existingBooking ? 'Update Booking' : 'Confirm Booking'}
      </button>
    </form>
  )
}
