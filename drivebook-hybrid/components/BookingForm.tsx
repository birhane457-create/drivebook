'use client'

import { useState } from 'react'
import { Calendar, Clock, User, Mail, Phone, MapPin, DollarSign } from 'lucide-react'

interface BookingFormProps {
  instructorId: string
  hourlyRate: number
}

export default function BookingForm({ instructorId, hourlyRate }: BookingFormProps) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    date: '',
    time: '',
    duration: 60,
    notes: ''
  })

  const calculatePrice = () => {
    const hours = formData.duration / 60
    return (hourlyRate * hours).toFixed(2)
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
        setSuccess(true)
        setFormData({
          name: '',
          email: '',
          phone: '',
          address: '',
          date: '',
          time: '',
          duration: 60,
          notes: ''
        })
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
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold mb-2">Booking Request Sent!</h3>
        <p className="text-gray-600 mb-6">
          Your instructor will review your request and confirm via email.
        </p>
        <button
          onClick={() => setSuccess(false)}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
        >
          Book Another Lesson
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Personal Info */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            <User className="inline h-4 w-4 mr-1" />
            Full Name
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            <Phone className="inline h-4 w-4 mr-1" />
            Phone
          </label>
          <input
            type="tel"
            required
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          <Mail className="inline h-4 w-4 mr-1" />
          Email
        </label>
        <input
          type="email"
          required
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          <MapPin className="inline h-4 w-4 mr-1" />
          Pickup Address
        </label>
        <input
          type="text"
          required
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          placeholder="Enter your address"
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
        />
      </div>

      {/* Date & Time */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            <Calendar className="inline h-4 w-4 mr-1" />
            Preferred Date
          </label>
          <input
            type="date"
            required
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            <Clock className="inline h-4 w-4 mr-1" />
            Preferred Time
          </label>
          <input
            type="time"
            required
            value={formData.time}
            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Duration</label>
        <select
          value={formData.duration}
          onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
        >
          <option value="30">30 minutes</option>
          <option value="60">1 hour</option>
          <option value="90">1.5 hours</option>
          <option value="120">2 hours</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Additional Notes (Optional)</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          placeholder="Any special requirements or questions..."
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
        />
      </div>

      {/* Price */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="text-lg font-semibold">Total Price:</span>
          <span className="text-3xl font-bold text-blue-600">
            <DollarSign className="inline h-6 w-6" />
            {calculatePrice()}
          </span>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Sending Request...' : 'Request Booking'}
      </button>

      <p className="text-sm text-gray-500 text-center">
        Your booking request will be reviewed by the instructor. You'll receive a confirmation email once approved.
      </p>
    </form>
  )
}
