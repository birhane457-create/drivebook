'use client'

import { useState } from 'react'
import { Save, DollarSign, Clock, MapPin } from 'lucide-react'
import GoogleCalendarSettings from '@/components/GoogleCalendarSettings'

interface TimeSlot {
  start: string
  end: string
}

interface WorkingHours {
  monday: TimeSlot[]
  tuesday: TimeSlot[]
  wednesday: TimeSlot[]
  thursday: TimeSlot[]
  friday: TimeSlot[]
  saturday: TimeSlot[]
  sunday: TimeSlot[]
}

export default function SettingsPage() {
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<{
    hourlyRate: number
    serviceRadiusKm: number
    travelBufferMinutes: number
    vehicleTypes: string[]
    workingHours: WorkingHours
    allowedDurations: number[]
    bookingBufferMinutes: number
    enableTravelTime: boolean
    travelTimeMinutes: number
  }>({
    hourlyRate: 60,
    serviceRadiusKm: 20,
    travelBufferMinutes: 15,
    vehicleTypes: ['AUTO'],
    workingHours: {
      monday: [{ start: '09:00', end: '17:00' }],
      tuesday: [{ start: '09:00', end: '17:00' }],
      wednesday: [{ start: '09:00', end: '17:00' }],
      thursday: [{ start: '09:00', end: '17:00' }],
      friday: [{ start: '09:00', end: '17:00' }],
      saturday: [{ start: '09:00', end: '13:00' }],
      sunday: []
    },
    allowedDurations: [60, 120],
    bookingBufferMinutes: 15,
    enableTravelTime: false,
    travelTimeMinutes: 10
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate at least one duration is selected
    if (formData.allowedDurations.length === 0) {
      alert('Please select at least one lesson duration')
      return
    }
    
    setSaving(true)
    
    try {
      const res = await fetch('/api/instructor/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        alert('Settings saved successfully!')
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to save settings')
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
      alert('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-4 sm:py-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Settings</h1>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Pricing
            </h2>
            
            <div>
              <label className="block text-sm font-medium mb-2">Hourly Rate ($)</label>
              <input
                type="number"
                value={formData.hourlyRate}
                onChange={(e) => setFormData(prev => ({ ...prev, hourlyRate: parseFloat(e.target.value) }))}
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Service Area
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Service Radius (km)</label>
                <input
                  type="number"
                  value={formData.serviceRadiusKm}
                  onChange={(e) => setFormData(prev => ({ ...prev, serviceRadiusKm: parseInt(e.target.value) }))}
                  min="1"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
                <p className="text-xs text-gray-500 mt-1">Maximum distance you're willing to travel for pickups</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Travel Buffer Between Bookings</label>
                <select
                  value={formData.travelBufferMinutes}
                  onChange={(e) => setFormData(prev => ({ ...prev, travelBufferMinutes: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                >
                  <option value={10}>10 minutes</option>
                  <option value={15}>15 minutes (Recommended)</option>
                  <option value={20}>20 minutes</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Time blocked between bookings for travel to next student's location
                </p>
                <div className="mt-2 bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-800">
                  <strong>💡 Tip:</strong> This ensures students get their full lesson time. Choose based on your typical travel distances.
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Booking Preferences
            </h2>
            
            <div className="space-y-6">
              {/* Allowed Durations */}
              <div>
                <label className="block text-sm font-medium mb-3">Lesson Durations You Offer</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { value: 30, label: '30 minutes' },
                    { value: 60, label: '1 hour' },
                    { value: 90, label: '1.5 hours' },
                    { value: 120, label: '2 hours' }
                  ].map((duration) => (
                    <label key={duration.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.allowedDurations.includes(duration.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({
                              ...prev,
                              allowedDurations: [...prev.allowedDurations, duration.value].sort((a, b) => a - b)
                            }))
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              allowedDurations: prev.allowedDurations.filter(d => d !== duration.value)
                            }))
                          }
                        }}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-600"
                      />
                      <span className="text-sm">{duration.label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">Select at least one duration. Students can only book these lengths.</p>
                {formData.allowedDurations.length === 0 && (
                  <p className="text-xs text-red-600 mt-1">⚠️ Please select at least one duration</p>
                )}
              </div>

              {/* Buffer Time */}
              <div>
                <label className="block text-sm font-medium mb-3">Buffer Between Bookings</label>
                <div className="flex flex-col sm:flex-row gap-3">
                  {[10, 15, 20].map((minutes) => (
                    <label key={minutes} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="bookingBuffer"
                        value={minutes}
                        checked={formData.bookingBufferMinutes === minutes}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          bookingBufferMinutes: parseInt(e.target.value)
                        }))}
                        className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-600"
                      />
                      <span className="text-sm">{minutes} minutes</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Time for rest, paperwork, and preparation between students (always applied)
                </p>
              </div>

              {/* Optional Travel Time */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer mb-3">
                  <input
                    type="checkbox"
                    checked={formData.enableTravelTime}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      enableTravelTime: e.target.checked
                    }))}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-600"
                  />
                  <span className="text-sm font-medium">Add travel time between bookings</span>
                </label>
                
                {formData.enableTravelTime && (
                  <div className="ml-6 space-y-2">
                    <div className="flex items-center gap-3">
                      <label className="text-sm">Travel time (minutes):</label>
                      <input
                        type="number"
                        value={formData.travelTimeMinutes}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          travelTimeMinutes: parseInt(e.target.value) || 10
                        }))}
                        min="5"
                        max="60"
                        className="w-20 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                      />
                      <span className="text-sm text-gray-600">minutes</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Additional time on top of buffer for traveling to next student's location
                    </p>
                  </div>
                )}
                
                {!formData.enableTravelTime && (
                  <p className="text-xs text-gray-500 ml-6">
                    Only buffer time will be applied between bookings
                  </p>
                )}
              </div>

              {/* Example Preview */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">📅 Schedule Example:</h4>
                <div className="text-xs text-blue-800 space-y-1">
                  <p>
                    <strong>Lesson:</strong> 1 hour (9:00-10:00)
                  </p>
                  <p>
                    <strong>Buffer:</strong> {formData.bookingBufferMinutes} minutes (10:00-10:{formData.bookingBufferMinutes.toString().padStart(2, '0')})
                  </p>
                  {formData.enableTravelTime && (
                    <p>
                      <strong>Travel:</strong> {formData.travelTimeMinutes} minutes (10:{formData.bookingBufferMinutes.toString().padStart(2, '0')}-10:{(formData.bookingBufferMinutes + formData.travelTimeMinutes).toString().padStart(2, '0')})
                    </p>
                  )}
                  <p className="pt-2 border-t border-blue-300 mt-2">
                    <strong>Total blocked:</strong> {60 + formData.bookingBufferMinutes + (formData.enableTravelTime ? formData.travelTimeMinutes : 0)} minutes
                  </p>
                  <p>
                    <strong>Next available:</strong> {formData.enableTravelTime 
                      ? `10:${(formData.bookingBufferMinutes + formData.travelTimeMinutes).toString().padStart(2, '0')}`
                      : `10:${formData.bookingBufferMinutes.toString().padStart(2, '0')}`
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Working Hours
            </h2>
            
            <div className="space-y-4">
              {days.map((day) => (
                <div key={day} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <div className="w-full sm:w-32 font-medium capitalize">{day}</div>
                  <div className="flex-1 flex flex-col sm:flex-row gap-2">
                    <input
                      type="time"
                      value={formData.workingHours[day as keyof typeof formData.workingHours][0]?.start || ''}
                      onChange={(e) => {
                        const newHours = { ...formData.workingHours }
                        if (!newHours[day as keyof typeof newHours][0]) {
                          newHours[day as keyof typeof newHours] = [{ start: e.target.value, end: '17:00' }]
                        } else {
                          newHours[day as keyof typeof newHours][0].start = e.target.value
                        }
                        setFormData(prev => ({ ...prev, workingHours: newHours }))
                      }}
                      className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                    />
                    <span className="flex items-center justify-center sm:justify-start">to</span>
                    <input
                      type="time"
                      value={formData.workingHours[day as keyof typeof formData.workingHours][0]?.end || ''}
                      onChange={(e) => {
                        const newHours = { ...formData.workingHours }
                        if (!newHours[day as keyof typeof newHours][0]) {
                          newHours[day as keyof typeof newHours] = [{ start: '09:00', end: e.target.value }]
                        } else {
                          newHours[day as keyof typeof newHours][0].end = e.target.value
                        }
                        setFormData(prev => ({ ...prev, workingHours: newHours }))
                      }}
                      className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <GoogleCalendarSettings />

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="h-5 w-5" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>
    </div>
  )
}
