'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface CheckInOutButtonProps {
  bookingId: string
  type: 'check-in' | 'check-out'
  isCheckedIn?: boolean
  isCheckedOut?: boolean
  bookingStartTime?: string
}

export default function CheckInOutButton({ 
  bookingId, 
  type, 
  isCheckedIn = false,
  isCheckedOut = false,
  bookingStartTime
}: CheckInOutButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [showLateCheckInDialog, setShowLateCheckInDialog] = useState(false)
  const [lateCheckInReason, setLateCheckInReason] = useState('')
  const [acknowledgeLateCheckIn, setAcknowledgeLateCheckIn] = useState(false)
  const [minutesLate, setMinutesLate] = useState(0)

  const getLocation = () => {
    return new Promise<{ lat: number; lng: number }>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'))
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
        },
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 10000 }
      )
    })
  }

  const handleCheckInOut = async () => {
    try {
      setLoading(true)
      setError('')

      // Get current location
      const loc = await getLocation()
      setLocation(loc)

      // Call API
      const endpoint = type === 'check-in' 
        ? `/api/bookings/${bookingId}/check-in`
        : `/api/bookings/${bookingId}/check-out`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: `${loc.lat},${loc.lng}`,
          photo: null,
          lateCheckInReason: lateCheckInReason || undefined,
          acknowledgeLateCheckIn: acknowledgeLateCheckIn || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Handle late check-in requirement
        if (data.requiresLateCheckInAcknowledgment || data.requiresLateCheckInReason) {
          setMinutesLate(data.minutesLate || 0)
          setShowLateCheckInDialog(true)
          setLoading(false)
          return
        }

        // Handle premature check-in
        if (data.canCheckIn === false) {
          setError(data.error)
          setLoading(false)
          return
        }

        // Handle >24 hour block (requires support)
        if (data.requiresSupport) {
          setError(data.error + '\n\nThis is a fraud prevention measure. Contact support@yourplatform.com to complete this booking.')
          setLoading(false)
          return
        }

        throw new Error(data.error || 'Failed to process')
      }

      // Success - refresh page
      setShowLateCheckInDialog(false)
      router.refresh()
      alert(data.message || `${type === 'check-in' ? 'Checked in' : 'Checked out'} successfully!`)
    } catch (err: any) {
      setError(err.message || 'Failed to get location')
      console.error('Check-in/out error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Don't show check-in if already checked in
  if (type === 'check-in' && isCheckedIn) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
        <span className="text-green-700 font-medium">✓ Checked In</span>
      </div>
    )
  }

  // Don't show check-out if not checked in or already checked out
  if (type === 'check-out' && (!isCheckedIn || isCheckedOut)) {
    return null
  }

  return (
    <div className="space-y-2">
      {/* Late Check-In Dialog */}
      {showLateCheckInDialog && (
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 space-y-3">
          <div className="flex items-start space-x-2">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <h3 className="font-bold text-yellow-900">Late Check-In</h3>
              <p className="text-sm text-yellow-800 mt-1">
                You are checking in {minutesLate} minutes late. Please provide a reason and acknowledge the late check-in.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Late Check-In *
            </label>
            <textarea
              value={lateCheckInReason}
              onChange={(e) => setLateCheckInReason(e.target.value)}
              placeholder="e.g., Traffic delay, client was late, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              rows={3}
              required
            />
          </div>

          <div className="flex items-start space-x-2">
            <input
              type="checkbox"
              id="acknowledgeLate"
              checked={acknowledgeLateCheckIn}
              onChange={(e) => setAcknowledgeLateCheckIn(e.target.checked)}
              className="mt-1 h-4 w-4 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded"
            />
            <label htmlFor="acknowledgeLate" className="text-sm text-gray-700">
              I acknowledge that this lesson started {minutesLate} minutes late and understand this may affect the lesson duration.
            </label>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={handleCheckInOut}
              disabled={!lateCheckInReason.trim() || !acknowledgeLateCheckIn || loading}
              className="flex-1 py-2 px-4 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-300 text-white font-semibold rounded-lg transition-colors"
            >
              {loading ? 'Processing...' : 'Confirm Late Check-In'}
            </button>
            <button
              onClick={() => {
                setShowLateCheckInDialog(false)
                setLateCheckInReason('')
                setAcknowledgeLateCheckIn(false)
              }}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Normal Check-In/Out Button */}
      {!showLateCheckInDialog && (
        <>
          <button
            onClick={handleCheckInOut}
            disabled={loading}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${
              type === 'check-in'
                ? 'bg-green-600 hover:bg-green-700 disabled:bg-green-300'
                : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </span>
            ) : (
              <>
                {type === 'check-in' ? '📍 Check In - Start Lesson' : '✓ Check Out - End Lesson'}
              </>
            )}
          </button>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
              <p className="text-xs text-red-600 mt-1">
                {error.includes('Cannot check in yet') 
                  ? 'You can check in up to 15 minutes before the scheduled time.'
                  : 'Please enable location services and try again'
                }
              </p>
            </div>
          )}

          {location && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
              <p className="text-xs text-blue-700">
                Location captured: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
              </p>
            </div>
          )}

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-xs text-gray-600">
              {type === 'check-in' 
                ? '📍 Your location will be recorded when you check in. You can check in up to 15 minutes before the scheduled time.'
                : '✓ Checking out will mark the lesson as complete and record the actual duration.'
              }
            </p>
          </div>
        </>
      )}
    </div>
  )
}
