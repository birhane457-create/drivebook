'use client'

import { useState, useEffect } from 'react'
import { Save, DollarSign, Clock, MapPin, Plus, X } from 'lucide-react'
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
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState<{
    hourlyRate: number
    serviceRadiusKm: number
    vehicleTypes: string[]
    workingHours: WorkingHours
    allowedDurations: number[]
    bookingBufferMinutes: number
    enableTravelTime: boolean
    travelTimeMinutes: number
  }>({
    hourlyRate: 60,
    serviceRadiusKm: 20,
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

  // Load settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/instructor/settings')
        if (res.ok) {
          const data = await res.json()
          setFormData({
            hourlyRate: data.hourlyRate || 60,
            serviceRadiusKm: data.serviceRadiusKm || 20,
            vehicleTypes: data.vehicleTypes || ['AUTO'],
            workingHours: data.workingHours || {
              monday: [{ start: '09:00', end: '17:00' }],
              tuesday: [{ start: '09:00', end: '17:00' }],
              wednesday: [{ start: '09:00', end: '17:00' }],
              thursday: [{ start: '09:00', end: '17:00' }],
              friday: [{ start: '09:00', end: '17:00' }],
              saturday: [{ start: '09:00', end: '13:00' }],
              sunday: []
            },
            allowedDurations: data.allowedDurations || [60, 120],
            bookingBufferMinutes: data.bookingBufferMinutes || 15,
            enableTravelTime: data.enableTravelTime || false,
            travelTimeMinutes: data.travelTimeMinutes || 10
          })
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate at least one duration is selected
    if (formData.allowedDurations.length === 0) {
      alert('Please select at least one lesson duration')
      return
    }
    
    console.log('📤 Submitting settings:', JSON.stringify(formData, null, 2))
    
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
        console.error('❌ Settings save error:', error)
        alert(`Failed to save: ${error.details || error.error || 'Unknown error'}`)
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

        {loading ? (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-600">Loading settings...</p>
          </div>
        ) : (
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
            
            <p className="text-sm text-gray-600 mb-4">
              Set your availability for each day. You can add multiple time slots per day (e.g., 8:00-12:00 and 14:00-18:00 for split shifts).
            </p>
            
            <div className="space-y-4">
              {days.map((day) => (
                <div key={day} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-medium capitalize">{day}</div>
                    <button
                      type="button"
                      onClick={() => {
                        const newHours = { ...formData.workingHours }
                        const dayKey = day as keyof typeof formData.workingHours
                        newHours[dayKey] = [...(newHours[dayKey] || []), { start: '09:00', end: '17:00' }]
                        setFormData(prev => ({ ...prev, workingHours: newHours }))
                      }}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                    >
                      <Plus className="h-4 w-4" />
                      Add Time Slot
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {(formData.workingHours[day as keyof typeof formData.workingHours] || []).length === 0 ? (
                      <div className="text-sm text-gray-500 italic">Not working this day</div>
                    ) : (
                      formData.workingHours[day as keyof typeof formData.workingHours].map((slot, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="time"
                            value={slot.start}
                            onChange={(e) => {
                              const newHours = { ...formData.workingHours }
                              const dayKey = day as keyof typeof newHours
                              newHours[dayKey][index].start = e.target.value
                              setFormData(prev => ({ ...prev, workingHours: newHours }))
                            }}
                            className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                          />
                          <span className="text-gray-500">to</span>
                          <input
                            type="time"
                            value={slot.end}
                            onChange={(e) => {
                              const newHours = { ...formData.workingHours }
                              const dayKey = day as keyof typeof newHours
                              newHours[dayKey][index].end = e.target.value
                              setFormData(prev => ({ ...prev, workingHours: newHours }))
                            }}
                            className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newHours = { ...formData.workingHours }
                              const dayKey = day as keyof typeof newHours
                              newHours[dayKey] = newHours[dayKey].filter((_, i) => i !== index)
                              setFormData(prev => ({ ...prev, workingHours: newHours }))
                            }}
                            className="text-red-600 hover:text-red-700 p-2"
                            title="Remove time slot"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                      ))
                    )}
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
        )}
      </div>
    </div>
  )
}
