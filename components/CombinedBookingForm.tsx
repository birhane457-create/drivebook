'use client'

import { useState } from 'react'
import { BookOpen, Zap, AlertCircle, CheckCircle, Loader } from 'lucide-react'
import PDABookingForm from './PDABookingForm'

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

interface CombinedBookingFormProps {
  customerId: string
  providerId: string
  
  // Lesson details (optional)
  lessonData?: {
    startTime: Date
    duration: number
    pickupAddress?: string
    pickupLatitude?: number
    pickupLongitude?: number
    notes?: string
  }
  
  // PDA config (optional)
  pdaConfig?: PDAConfig
  
  onSuccess?: (response: any) => void
  onError?: (error: string) => void
}

export default function CombinedBookingForm({
  customerId,
  providerId,
  lessonData,
  pdaConfig,
  onSuccess,
  onError
}: CombinedBookingFormProps) {
  const [pdaFormData, setPdaFormData] = useState<{
    testCentreId: string
    testDate: string
    testTime: string
  } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!lessonData && !pdaConfig) {
    return (
      <div className="bg-background border border-border rounded-lg p-4">
        <p className="text-muted-foreground text-sm">No booking details provided</p>
      </div>
    )
  }

  const handlePdaSubmit = (data: {
    testCentreId: string
    testDate: string
    testTime: string
  }) => {
    setPdaFormData(data)
  }

  const handleConfirmBooking = async () => {
    if (!lessonData && !pdaFormData) {
      setError('Please provide booking details')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const bookingPayload: any = {
        customerId,
        providerId
      }

      if (lessonData) {
        bookingPayload.lesson = {
          startTime: lessonData.startTime.toISOString(),
          duration: lessonData.duration,
          pickupAddress: lessonData.pickupAddress,
          pickupLatitude: lessonData.pickupLatitude,
          pickupLongitude: lessonData.pickupLongitude,
          notes: lessonData.notes
        }
      }

      if (pdaFormData && pdaConfig) {
        bookingPayload.pdaTest = {
          configId: pdaConfig.id,
          testCentreId: pdaFormData.testCentreId,
          testDate: pdaFormData.testDate,
          testTime: pdaFormData.testTime
        }
      }

      const res = await fetch('/api/bookings/combined', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingPayload)
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create booking')
      }

      const data = await res.json()
      setSuccess(true)
      onSuccess?.(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Booking failed'
      setError(message)
      onError?.(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="bg-green-950 border border-green-700 rounded-lg p-6 text-center">
        <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
        <h3 className="text-lg font-semibold text-green-100 mb-1">Booking Confirmed!</h3>
        <p className="text-green-200 text-sm">Your lesson and PDA test have been booked successfully.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Lesson Section */}
        {lessonData && (
          <div className="bg-card rounded-lg p-4 border border-border">
            <h3 className="font-semibold text-foreground flex items-center gap-2 mb-3">
              <BookOpen className="h-5 w-5 text-blue-500" />
              Lesson Booking
            </h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Date & Time:</span>
                <p className="text-foreground font-medium">
                  {lessonData.startTime.toLocaleDateString()} at {lessonData.startTime.toLocaleTimeString()}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Duration:</span>
                <p className="text-foreground font-medium">{lessonData.duration} minutes</p>
              </div>
              {lessonData.pickupAddress && (
                <div>
                  <span className="text-muted-foreground">Pickup:</span>
                  <p className="text-foreground font-medium">{lessonData.pickupAddress}</p>
                </div>
              )}
              {lessonData.notes && (
                <div>
                  <span className="text-muted-foreground">Notes:</span>
                  <p className="text-foreground font-medium">{lessonData.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PDA Section */}
        {pdaConfig && (
          <div className="bg-card rounded-lg p-4 border border-border">
            <h3 className="font-semibold text-foreground flex items-center gap-2 mb-3">
              <Zap className="h-5 w-5 text-amber-500" />
              PDA Test Booking
            </h3>
            {pdaFormData ? (
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Config:</span>
                  <p className="text-foreground font-medium">{pdaConfig.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Date & Time:</span>
                  <p className="text-foreground font-medium">
                    {pdaFormData.testDate} at {pdaFormData.testTime}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Test Centre:</span>
                  <p className="text-foreground font-medium">
                    {pdaConfig.testCentres.find(c => c.id === pdaFormData.testCentreId)?.name}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Price:</span>
                  <p className="text-foreground font-medium">
                    ${(pdaConfig.discountPercent
                      ? pdaConfig.price * (1 - pdaConfig.discountPercent / 100)
                      : pdaConfig.price
                    ).toFixed(2)}
                  </p>
                </div>
              </div>
            ) : (
              <PDABookingForm
                providerId={providerId}
                config={pdaConfig}
                onSubmit={handlePdaSubmit}
                isLoading={isSubmitting}
              />
            )}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-950 border border-red-700 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {/* Confirm Button */}
      {(!pdaConfig || pdaFormData) && (
        <button
          onClick={handleConfirmBooking}
          disabled={isSubmitting || (pdaConfig && !pdaFormData)}
          className="w-full px-4 py-3 bg-primary text-foreground rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
        >
          {isSubmitting ? (
            <>
              <Loader className="h-4 w-4 animate-spin" />
              Confirming Booking...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4" />
              Confirm Booking
            </>
          )}
        </button>
      )}
    </div>
  )
}
