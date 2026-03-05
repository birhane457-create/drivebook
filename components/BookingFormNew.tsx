'use client'

import { useState, useEffect } from 'react'
import { Calendar, Clock, User, Mail, Phone, MapPin, DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react'

interface TimeSlot {
  time: string
  available: boolean
  reason?: string
}

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
  const [bookingId, setBookingId] = useState('')
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [instructorData, setInstructorData] = useState<{ id: string; hourlyRate: number } | null>(null)
  
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
        date: start.toISOString().split('T')[0],
        time: start.toTimeString().slice(0, 5),
        duration,
        notes: existingBooking.notes || '',
        joinWaitingList: false
      }
    }
    
    return {
      name: preselectedClient?.name || '',
      email: preselectedClient?.email || '',
      phone: preselectedClient?.phone || '',
      address: preselectedClient?.addressText || '',
      date: '',
      time: '',
      duration: 60,
      notes: '',
      joinWaitingList: false
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

  // Fetch available time slots when date or duration changes
  useEffect(() => {
    if (formData.date && formData.duration && instructorData) {
      fetchTimeSlots()
    }
  }, [formData.date, formData.duration])

  const fetchTimeSlots = async () => {
    if (!instructorData) return
    
    setLoadingSlots(true)
    try {
      // Exclude current booking from availability check when editing
      const excludeParam = existingBooking ? `&excludeBookingId=${existingBooking.id}` : ''
      const response = await fetch(
        `/api/availability/slots?instructorId=${instructorData.id}&date=${formData.date}&duration=${formData.duration}${excludeParam}`
      )
      if (response.ok) {
        const data = await response.json()
        setTimeSlots(data.slots || [])
      }
    } catch (error) {
      console.error('Failed to fetch time slots:', error)
    } finally {
      setLoadingSlots(false)
    }
  }

  const calculatePrice = () => {
    if (!instructorData) return '0.00'
    const hours = formData.duration / 60
    return (instructorData.hourlyRate * hours).toFixed(2)
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
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        notes: formData.notes,
        price: parseFloat(calculatePrice())
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
        setSuccess(true)

        // If they want to join waiting list (only for public bookings)
        if (!isInstructorBooking && formData.joinWaitingList) {
          await fetch('/api/waiting-list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instructorId: instructorData.id,
              clientName: formData.name,
              clientEmail: formData.email,
              clientPhone: formData.phone,
              originalBookingDate: startTime.toISOString(),
              originalBookingTime: formData.time,
              earliestDate: new Date().toISOString(),
              preferredDuration: formData.duration,
              pickupAddress: formData.address,
              notes: 'Willing to take earlier cancellation slots'
            })
          })
        }

        // Redirect to bookings page for instructor bookings
        if (isInstructorBooking) {
          setTimeout(() => {
            window.location.href = '/dashboard/bookings'
          }, 2000)
        }
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create booking')
      }
    } catch (error) {
      console.error('Booking error:', error)
      alert('Failed to create booking')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Booking Confirmed!</h3>
          <p className="text-sm text-gray-500 mb-4">
            We've sent a confirmation email to {formData.email}
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

          {formData.joinWaitingList && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800">
                ✓ You're on the waiting list for earlier slots!
              </p>
            </div>
          )}

          <div className="space-y-2">
            <a
              href={`/cancel-booking/${bookingId}`}
              className="block w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
            >
              Manage Booking
            </a>
            <button
              onClick={() => {
                setSuccess(false)
                setFormData({
                  name: '',
                  email: '',
                  phone: '',
                  address: '',
                  date: '',
                  time: '',
                  duration: 60,
                  notes: '',
                  joinWaitingList: false
                })
              }}
              className="block w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Book Another Lesson
            </button>
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

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            <Calendar className="inline h-4 w-4 mr-1" />
            Date
          </label>
          <input
            type="date"
            required
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value, time: '' })}
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
          />
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
      </div>

      {formData.date && (
        <div>
          <label className="block text-sm font-medium mb-2">
            <Clock className="inline h-4 w-4 mr-1" />
            Select Time
          </label>
          
          {loadingSlots ? (
            <div className="text-center py-4 text-gray-500">Loading available times...</div>
          ) : timeSlots.length === 0 ? (
            <div className="text-center py-4 text-gray-500">No available times for this date</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-64 overflow-y-auto p-2 border rounded-lg">
              {timeSlots.map((slot) => (
                <button
                  key={slot.time}
                  type="button"
                  disabled={!slot.available}
                  onClick={() => setFormData({ ...formData, time: slot.time })}
                  className={`
                    px-3 py-2 rounded text-sm font-medium transition-colors
                    ${formData.time === slot.time
                      ? 'bg-blue-600 text-white ring-2 ring-blue-600'
                      : slot.available
                      ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }
                  `}
                  title={slot.reason || (slot.available ? 'Available' : 'Unavailable')}
                >
                  {slot.time}
                  {!slot.available && <span className="block text-xs">✗</span>}
                </button>
              ))}
            </div>
          )}
          
          {formData.time && (
            <p className="text-sm text-green-600 mt-2">
              ✓ Selected: {formData.time}
            </p>
          )}
        </div>
      )}

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

      <button
        type="submit"
        disabled={loading || !formData.time || !instructorData}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Processing...' : existingBooking ? 'Update Booking' : 'Confirm Booking'}
      </button>
    </form>
  )
}
