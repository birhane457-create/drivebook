'use client'

import { useState, useEffect } from 'react'
import { Calendar, Clock, User, Mail, Phone, MapPin, DollarSign, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'

interface TimeSlot {
  time: string
  available: boolean
  reason?: string
}

interface BookingFormProps {
  instructorId: string
  hourlyRate: number
  instructorName: string
}

export default function BookingFormOptimized({ instructorId, hourlyRate, instructorName }: BookingFormProps) {
  const [step, setStep] = useState(1) // 1: Date, 2: Time, 3: Details, 4: Confirm
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [bookingId, setBookingId] = useState('')
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [formData, setFormData] = useState({
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

  // Fetch available time slots when date or duration changes
  useEffect(() => {
    if (formData.date && formData.duration) {
      fetchTimeSlots()
    }
  }, [formData.date, formData.duration])

  const fetchTimeSlots = async () => {
    setLoadingSlots(true)
    setTimeSlots([])
    try {
      const response = await fetch(
        `/api/availability/slots?instructorId=${instructorId}&date=${formData.date}&duration=${formData.duration}`
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
    const hours = formData.duration / 60
    return (hourlyRate * hours).toFixed(2)
  }

  const handleDateSelect = () => {
    if (!formData.date) {
      alert('Please select a date')
      return
    }
    setStep(2)
  }

  const handleTimeSelect = (time: string) => {
    setFormData(prev => ({ ...prev, time }))
    setStep(3)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const [hours, minutes] = formData.time.split(':')
      const startTime = new Date(formData.date)
      startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0)
      
      const endTime = new Date(startTime)
      endTime.setMinutes(endTime.getMinutes() + formData.duration)

      // Only now we send the address (Maps API will be called server-side if needed)
      const response = await fetch('/api/public/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructorId,
          clientName: formData.name,
          clientEmail: formData.email,
          clientPhone: formData.phone,
          pickupAddress: formData.address,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          notes: formData.notes,
          price: parseFloat(calculatePrice())
        })
      })

      if (response.ok) {
        const data = await response.json()
        
        // Redirect to payment page
        if (data.redirectTo) {
          window.location.href = data.redirectTo
          return
        }
        
        setBookingId(data.booking.id)
        setSuccess(true)

        // If they want to join waiting list
        if (formData.joinWaitingList) {
          await fetch('/api/waiting-list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instructorId,
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
              Save this ID to manage your booking at /manage-booking
            </p>
          </div>

          <div className="space-y-2 text-sm text-left bg-gray-50 rounded-lg p-4 mb-4">
            <p><span className="font-medium">Instructor:</span> {instructorName}</p>
            <p><span className="font-medium">Date:</span> {new Date(formData.date).toLocaleDateString()}</p>
            <p><span className="font-medium">Time:</span> {formData.time}</p>
            <p><span className="font-medium">Duration:</span> {formData.duration} minutes</p>
            <p><span className="font-medium">Price:</span> ${calculatePrice()}</p>
          </div>

          <button
            onClick={() => window.location.href = '/instructors'}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Instructors
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {s}
              </div>
              {s < 3 && (
                <div className={`flex-1 h-1 mx-2 ${
                  step > s ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-600">
          <span>Select Date</span>
          <span>Choose Time</span>
          <span>Your Details</span>
        </div>
      </div>

      {/* Step 1: Select Date & Duration */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-bold mb-4">When would you like your lesson?</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Select Date</label>
                <input
                  type="date"
                  value={formData.date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-600 text-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Lesson Duration</label>
                <select
                  value={formData.duration}
                  onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-600 text-lg"
                >
                  <option value={30}>30 minutes - ${(hourlyRate * 0.5).toFixed(2)}</option>
                  <option value={60}>1 hour - ${hourlyRate.toFixed(2)}</option>
                  <option value={90}>1.5 hours - ${(hourlyRate * 1.5).toFixed(2)}</option>
                  <option value={120}>2 hours - ${(hourlyRate * 2).toFixed(2)}</option>
                </select>
              </div>
            </div>
          </div>

          <button
            onClick={handleDateSelect}
            disabled={!formData.date}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue to Time Selection
          </button>
        </div>
      )}

      {/* Step 2: Select Time */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-bold mb-2">Choose Your Time</h3>
            <p className="text-sm text-gray-600 mb-4">
              {new Date(formData.date).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })} • {formData.duration} minutes
            </p>

            {loadingSlots ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : timeSlots.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No available times for this date</p>
                <button
                  onClick={() => setStep(1)}
                  className="mt-4 text-blue-600 hover:text-blue-800"
                >
                  Choose a different date
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {timeSlots.map((slot) => (
                  <button
                    key={slot.time}
                    onClick={() => slot.available && handleTimeSelect(slot.time)}
                    disabled={!slot.available}
                    className={`py-3 px-2 rounded-lg text-sm font-medium transition ${
                      slot.available
                        ? 'bg-green-50 text-green-700 border-2 border-green-200 hover:bg-green-100 hover:border-green-300'
                        : 'bg-gray-100 text-gray-400 border-2 border-gray-200 cursor-not-allowed'
                    }`}
                    title={slot.available ? 'Available' : slot.reason}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep(1)}
              className="flex-1 border border-gray-300 py-3 rounded-lg font-semibold hover:bg-gray-50"
            >
              Back
            </button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
            <p className="text-blue-900">
              <span className="font-medium">💡 Tip:</span> Green times are available. Gray times are already booked or outside working hours.
            </p>
          </div>
        </div>
      )}

      {/* Step 3: Enter Details */}
      {step === 3 && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h3 className="text-xl font-bold mb-2">Your Details</h3>
            <p className="text-sm text-gray-600 mb-4">
              {new Date(formData.date).toLocaleDateString()} at {formData.time} • {formData.duration} min
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  <User className="inline h-4 w-4 mr-1" />
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-600"
                  placeholder="John Doe"
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
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-600"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  <Phone className="inline h-4 w-4 mr-1" />
                  Phone
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-600"
                  placeholder="0412 345 678"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  <MapPin className="inline h-4 w-4 mr-1" />
                  Pickup Address
                </label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-600"
                  placeholder="123 Main St, Perth WA 6000"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter your full address including suburb and postcode
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-600"
                  placeholder="Any special requirements or notes..."
                />
              </div>

              <div className="bg-gray-50 border rounded-lg p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.joinWaitingList}
                    onChange={(e) => setFormData(prev => ({ ...prev, joinWaitingList: e.target.checked }))}
                    className="mt-1"
                  />
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">Join Waiting List</div>
                    <div className="text-gray-600">
                      Get notified if an earlier time becomes available due to cancellations
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-blue-900">Total Price:</span>
              <span className="text-2xl font-bold text-blue-600">${calculatePrice()}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex-1 border border-gray-300 py-3 rounded-lg font-semibold hover:bg-gray-50"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Booking...
                </>
              ) : (
                <>
                  <DollarSign className="h-5 w-5" />
                  Confirm Booking
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
