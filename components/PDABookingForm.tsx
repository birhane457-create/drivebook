'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, Calendar, Clock, MapPin, AlertCircle, CheckCircle } from 'lucide-react'

interface PDAConfig {
  id: string
  name: string
  durationMinutes: number
  price: number
  discountPercent?: number | null
  testCentres: Array<{ id: string; name: string; address: string }>
  includes?: {
    pickup?: boolean
    dropoff?: boolean
    debriefing?: boolean
  }
}

interface AvailableSlot {
  date: string
  time: string
}

interface PDABookingFormProps {
  config: PDAConfig
  instructorId: string
  onSubmit: (data: {
    testCentreId: string
    testDate: string
    testTime: string
  }) => void
  isLoading?: boolean
}

export default function PDABookingForm({
  config,
  instructorId,
  onSubmit,
  isLoading = false
}: PDABookingFormProps) {
  const [testCentreId, setTestCentreId] = useState<string>('')
  const [testDate, setTestDate] = useState<string>('')
  const [testTime, setTestTime] = useState<string>('')
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize first test centre
  useEffect(() => {
    if (config.testCentres.length > 0 && !testCentreId) {
      setTestCentreId(config.testCentres[0].id)
    }
  }, [config, testCentreId])

  // Fetch available slots when test centre or date changes
  useEffect(() => {
    if (!testCentreId || !testDate || !instructorId) return

    const fetchSlots = async () => {
      setSlotsLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/availability/pda-tests?` +
          `instructorId=${instructorId}&` +
          `configId=${config.id}&` +
          `testCentreId=${testCentreId}&` +
          `date=${testDate}`
        )
        if (!res.ok) throw new Error('Failed to fetch available slots')
        const data = await res.json()
        // The endpoint returns slots as [{ time: string, available: boolean }]
        const availableTimeSlots = (data.slots || [])
          .filter((s: any) => s.available !== false)
          .map((s: any) => ({ time: s.time, date: testDate }))
        setAvailableSlots(availableTimeSlots)
        setTestTime('') // Reset time when slots change
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading available slots')
        setAvailableSlots([])
      } finally {
        setSlotsLoading(false)
      }
    }

    fetchSlots()
  }, [testCentreId, testDate, config.id, instructorId, config.durationMinutes])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!testCentreId || !testDate || !testTime) {
      setError('Please select test centre, date, and time')
      return
    }

    onSubmit({
      testCentreId,
      testDate,
      testTime
    })
  }

  const selectedCentre = config.testCentres.find(c => c.id === testCentreId)
  const finalPrice = config.discountPercent
    ? config.price * (1 - config.discountPercent / 100)
    : config.price

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (mins === 0) return `${hours}h`
    return `${hours}h ${mins}m`
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header with config info */}
      <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">{config.name}</h3>
            <p className="text-sm text-slate-400 mt-1">
              {formatDuration(config.durationMinutes)} Test
            </p>
          </div>
          <div className="text-right">
            {config.discountPercent && config.discountPercent > 0 ? (
              <div>
                <div className="text-sm line-through text-slate-500">
                  ${config.price.toFixed(2)}
                </div>
                <div className="text-2xl font-bold text-green-500">
                  ${finalPrice.toFixed(2)}
                </div>
              </div>
            ) : (
              <div className="text-2xl font-bold text-slate-100">
                ${finalPrice.toFixed(2)}
              </div>
            )}
          </div>
        </div>

        {/* What's included */}
        {config.includes && (
          <div className="mt-3 pt-3 border-t border-slate-700 space-y-1">
            {config.includes.pickup && (
              <div className="text-sm text-slate-300 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Pickup from home
              </div>
            )}
            {config.includes.dropoff && (
              <div className="text-sm text-slate-300 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Dropoff at test centre
              </div>
            )}
            {config.includes.debriefing && (
              <div className="text-sm text-slate-300 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Debriefing call
              </div>
            )}
          </div>
        )}
      </div>

      {/* Test Centre Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-200 mb-2">
          <MapPin className="inline h-4 w-4 mr-1" />
          Test Centre
        </label>
        <select
          value={testCentreId}
          onChange={(e) => setTestCentreId(e.target.value)}
          className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a test centre...</option>
          {config.testCentres.map(centre => (
            <option key={centre.id} value={centre.id}>
              {centre.name} - {centre.address}
            </option>
          ))}
        </select>
      </div>

      {/* Date Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-200 mb-2">
          <Calendar className="inline h-4 w-4 mr-1" />
          Test Date
        </label>
        <input
          type="date"
          value={testDate}
          onChange={(e) => setTestDate(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Time Selection */}
      {testDate && (
        <div>
          <label className="block text-sm font-medium text-slate-200 mb-2">
            <Clock className="inline h-4 w-4 mr-1" />
            Test Time
          </label>
          
          {slotsLoading ? (
            <div className="text-slate-400 text-sm py-4 text-center">
              Loading available times...
            </div>
          ) : availableSlots.length === 0 ? (
            <div className="bg-slate-950 border border-slate-700 rounded-lg p-4 text-center">
              <AlertCircle className="h-8 w-8 mx-auto text-amber-500 mb-2" />
              <p className="text-slate-300 text-sm">No available times for this date</p>
              <p className="text-slate-400 text-xs mt-1">Try selecting a different date</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {availableSlots.map(slot => (
                <button
                  key={slot.time}
                  type="button"
                  onClick={() => setTestTime(slot.time)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    testTime === slot.time
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-950 border border-slate-700 text-slate-100 hover:border-slate-600'
                  }`}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-950 border border-red-700 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-200 text-sm">{error}</p>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!testCentreId || !testDate || !testTime || isLoading}
        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {isLoading ? 'Confirming PDA Test...' : 'Confirm PDA Test'}
      </button>
    </form>
  )
}
