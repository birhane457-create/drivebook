'use client'

import { useState, useEffect } from 'react'
import { Calendar, Clock, User, Mail, Phone, MapPin, DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react'
import SlotPicker from '@/components/SlotPicker'
import SuburbAutocomplete from '@/components/AddressAutocomplete'

interface BookingFormProps {
  providerId?: string
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
  /** Pre-fill the date picker (YYYY-MM-DD) — used by Find Next Slot */
  initialDate?: string
  /** Pre-fill the time picker (HH:MM 24h) — used by Find Next Slot */
  initialTime?: string
  /** Pre-fill the duration (minutes) — used by Find Next Slot */
  initialDuration?: number
}

export default function BookingForm({ 
  providerId, 
  hourlyRate,
  preselectedClient,
  isInstructorBooking = false,
  existingBooking,
  redirectAfterUpdate,
  initialDate,
  initialTime,
  initialDuration,
}: BookingFormProps) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [pendingPayment, setPendingPayment] = useState(false)
  const [pendingMessage, setPendingMessage] = useState('')
  const [bookingId, setBookingId] = useState('')
  const [instructorData, setInstructorData] = useState<{ id: string; hourlyRate: number } | null>(null)
  const [insufficientBalance, setInsufficientBalance] = useState<{
    customerName: string
    customerEmail: string
    customerId: string
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
        pickupStreet: existingBooking.pickupAddress?.split(',')[0]?.trim() || '',
        pickupSuburb: existingBooking.pickupAddress?.split(',').slice(1).join(',').trim() || '',
        address: existingBooking.pickupAddress || preselectedClient?.addressText || '',
        dropoffStreet: (existingBooking as any).dropoffAddress?.split(',')[0]?.trim() || '',
        dropoffSuburb: (existingBooking as any).dropoffAddress?.split(',').slice(1).join(',').trim() || '',
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
      pickupStreet: '',
      pickupSuburb: '',
      address: preselectedClient?.addressText || '',
      dropoffStreet: '',
      dropoffSuburb: '',
      dropoffAddress: '',
      sameAsPickup: true,
      date: initialDate || '',
      time: initialTime || '',
      duration: initialDuration || 60,
      notes: '',
      joinWaitingList: false,
      ageDeclaration: false,
      termsAccepted: false,
    }
  })

  // Fetch instructor data if not provided (for instructor booking)
  useEffect(() => {
    if (isInstructorBooking && !providerId) {
      fetchInstructorData()
    } else if (providerId && hourlyRate) {
      setInstructorData({ id: providerId, hourlyRate })
    }
  }, [isInstructorBooking, providerId, hourlyRate])

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
          customerId: insufficientBalance.customerId,
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
    
    // Validate address fields are complete
    if (!formData.pickupStreet || !formData.pickupSuburb) {
      alert('Please enter both street address and suburb for pickup location')
      return
    }

    // Ensure combined address is set
    const fullPickupAddress = `${formData.pickupStreet}, ${formData.pickupSuburb}`
    const fullDropoffAddress = formData.sameAsPickup 
      ? undefined 
      : (formData.dropoffStreet && formData.dropoffSuburb 
          ? `${formData.dropoffStreet}, ${formData.dropoffSuburb}` 
          : undefined)
    
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
            pickupAddress: fullPickupAddress,
            dropoffAddress: fullDropoffAddress,
            notes: formData.notes,
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
        customerId: preselectedClient.id,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        pickupAddress: fullPickupAddress,
        dropoffAddress: fullDropoffAddress,
        notes: formData.notes,
        bookingType: 'LESSON' as const,
      } : {
        providerId: instructorData.id,
        customerName: formData.name,
        customerEmail: formData.email,
        customerPhone: formData.phone,
        pickupAddress: fullPickupAddress,
        dropoffAddress: fullDropoffAddress,
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
            customerName: error.customerName,
            customerEmail: error.customerEmail,
            customerId: error.customerId,
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
        <div className="bg-card/80 border border-border rounded-2xl shadow-lg p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-amber-500/20 mb-4">
              <AlertCircle className="h-7 w-7 text-amber-400" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">Booking Created — Awaiting Payment</h3>
            <p className="text-sm text-foreground">
              The booking slot is reserved. The client needs to top up their wallet to confirm it.
            </p>
          </div>

          {/* Booking summary */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-5 space-y-2 text-sm">
            <p className="font-semibold text-amber-200">📋 Booking Details</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-foreground">
              <span className="font-medium">Booking ID:</span>
              <span className="font-mono text-xs text-foreground">{bookingId}</span>
              <span className="font-medium">Date:</span>
              <span>{new Date(formData.date).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <span className="font-medium">Time:</span>
              <span>{formData.time}</span>
              <span className="font-medium">Duration:</span>
              <span>{formData.duration} min</span>
              <span className="font-medium">Price:</span>
              <span className="font-semibold text-amber-300">${calculatePrice()}</span>
              <span className="font-medium">Status:</span>
              <span className="text-amber-300 font-semibold">⏳ Awaiting Payment</span>
            </div>
          </div>

          {/* What happens next */}
          <div className="bg-sky-500/10 border border-sky-500/30 rounded-lg p-4 mb-5 text-sm">
            <p className="font-semibold text-sky-200 mb-2">What happens next?</p>
            <ol className="space-y-1.5 text-primary list-decimal list-inside">
              <li>An email has been sent to the client with a payment link</li>
              <li>Once they top up their wallet, the booking confirms automatically</li>
              <li>You'll receive a notification when payment is received</li>
              <li>If they don't pay, the booking expires after 2 hours</li>
            </ol>
          </div>

          {/* Message from API */}
          {pendingMessage && (
            <p className="text-xs text-muted-foreground text-center mb-5 italic">{pendingMessage}</p>
          )}

          {/* Actions */}
          <div className="space-y-2">
            <a
              href={`/dashboard/bookings/${bookingId}`}
              className="block w-full text-center bg-primary text-foreground px-4 py-2.5 rounded-lg hover:bg-primary/90 font-semibold text-sm transition-colors"
            >
              View Booking
            </a>
            <a
              href="/dashboard/bookings"
              className="block w-full text-center bg-secondary text-foreground px-4 py-2.5 rounded-lg hover:bg-white/20 text-sm transition-colors"
            >
              Back to Bookings
            </a>
          </div>
        </div>
      )
    }

    // ── Confirmed booking ─────────────────────────────────────────────────
    return (
      <div className="bg-card/80 border border-border rounded-2xl shadow-lg p-6 sm:p-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-emerald-500/20 mb-4">
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">Booking Confirmed!</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {isInstructorBooking
              ? 'Booking created and payment deducted from client wallet.'
              : `We've sent a confirmation email to ${formData.email}`}
          </p>
          
          <div className="bg-sky-500/10 border border-sky-500/30 rounded-lg p-4 mb-4">
            <p className="text-sm font-medium text-sky-200 mb-2">Your Booking ID:</p>
            <p className="text-2xl font-bold text-primary font-mono">{bookingId}</p>
            <p className="text-xs text-primary/90 mt-2">
              Save this ID to manage your booking
            </p>
          </div>

          <div className="space-y-2 text-sm text-left bg-secondary/50 border border-border rounded-lg p-4 mb-4">
            <p><span className="font-medium text-foreground">Date:</span> <span className="text-foreground">{new Date(formData.date).toLocaleDateString()}</span></p>
            <p><span className="font-medium text-foreground">Time:</span> <span className="text-foreground">{formData.time}</span></p>
            <p><span className="font-medium text-foreground">Duration:</span> <span className="text-foreground">{formData.duration} minutes</span></p>
            <p><span className="font-medium text-foreground">Pickup:</span> <span className="text-foreground">{formData.address}</span></p>
            <p><span className="font-medium text-foreground">Price:</span> <span className="text-primary font-semibold">${calculatePrice()}</span></p>
          </div>

          <div className="space-y-2">
            {isInstructorBooking ? (
              <>
                <a
                  href={`/dashboard/bookings/${bookingId}`}
                  className="block w-full bg-primary text-foreground px-4 py-2 rounded-lg hover:bg-primary/90 text-sm font-semibold transition-colors"
                >
                  View Booking
                </a>
                <a
                  href="/dashboard/bookings"
                  className="block w-full bg-secondary text-foreground px-4 py-2 rounded-lg hover:bg-white/20 text-sm transition-colors"
                >
                  Back to Bookings
                </a>
              </>
            ) : (
              <>
                <a
                  href={`/cancel-booking/${bookingId}`}
                  className="block w-full bg-secondary text-foreground px-4 py-2 rounded-lg hover:bg-white/20 transition-colors"
                >
                  Manage Booking
                </a>
                <button
                  onClick={() => {
                    setSuccess(false)
                    setPendingPayment(false)
                    setFormData({
                      name: '', email: '', phone: '', address: '',
                      pickupStreet: '', pickupSuburb: '',
                      dropoffStreet: '', dropoffSuburb: '',
                      dropoffAddress: '',
                      sameAsPickup: true, date: '', time: '', duration: 60, notes: '',
                      joinWaitingList: false, ageDeclaration: false, termsAccepted: false,
                    })
                  }}
                  className="block w-full bg-primary text-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
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
    <form onSubmit={handleSubmit} className="bg-card/80 border border-border rounded-2xl shadow-lg p-6 sm:p-8 space-y-6">
      <h2 className="text-2xl font-bold text-foreground mb-6">
        {existingBooking ? 'Update Booking' : 'Book a Lesson'}
      </h2>

      {/* Only show client fields if not preselected */}
      {!preselectedClient && (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <User className="inline h-4 w-4 mr-1" />
                Full Name
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-white/30 bg-secondary/70 rounded-lg text-foreground placeholder-slate-400 transition-all duration-200 hover:border-white/50 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.15)] focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.15)]"
                placeholder="John Smith"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <Mail className="inline h-4 w-4 mr-1" />
                Email
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-white/30 bg-secondary/70 rounded-lg text-foreground placeholder-slate-400 transition-all duration-200 hover:border-white/50 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.15)] focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.15)]"
                placeholder="john@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              <Phone className="inline h-4 w-4 mr-1" />
              Phone Number
            </label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-white/30 bg-secondary/70 rounded-lg text-foreground placeholder-slate-400 transition-all duration-200 hover:border-white/50 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.15)] focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.15)]"
              placeholder="0412 345 678"
            />
          </div>
        </>
      )}

      <div className="space-y-3">
        <label className="block text-sm font-medium text-foreground">
          <MapPin className="inline h-4 w-4 mr-1" />
          Pickup Address
        </label>
        
        {/* Street Address */}
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">
            Street Address / Building
          </label>
          <input
            type="text"
            required
            value={formData.pickupStreet}
            onChange={(e) => {
              const newStreet = e.target.value
              setFormData({ 
                ...formData, 
                pickupStreet: newStreet,
                address: formData.pickupSuburb ? `${newStreet}, ${formData.pickupSuburb}` : newStreet
              })
            }}
            className="w-full px-3 py-2 border border-white/30 bg-secondary/70 rounded-lg text-foreground placeholder-slate-400 transition-all duration-200 hover:border-white/50 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.15)] focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.15)]"
            placeholder="e.g., 123 Main Street, Unit 5"
          />
        </div>

        {/* Suburb Autocomplete */}
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">
            Suburb / Locality
          </label>
          <SuburbAutocomplete
            value={formData.pickupSuburb}
            onChange={(suburb) => {
              setFormData({ 
                ...formData, 
                pickupSuburb: suburb,
                address: formData.pickupStreet ? `${formData.pickupStreet}, ${suburb}` : suburb
              })
            }}
            placeholder="Start typing suburb..."
            required
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-foreground">
            <MapPin className="inline h-4 w-4 mr-1 text-destructive" />
            Dropoff Address
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none hover:text-foreground">
            <input
              type="checkbox"
              checked={formData.sameAsPickup}
              onChange={(e) => setFormData({ 
                ...formData, 
                sameAsPickup: e.target.checked, 
                dropoffStreet: '',
                dropoffSuburb: '',
                dropoffAddress: '' 
              })}
              className="rounded bg-background/60 border border-border accent-sky-500"
            />
            Same as pickup
          </label>
        </div>
        
        {!formData.sameAsPickup && (
          <div className="space-y-3">
            {/* Dropoff Street Address */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">
                Street Address / Building
              </label>
              <input
                type="text"
                value={formData.dropoffStreet}
                onChange={(e) => {
                  const newStreet = e.target.value
                  setFormData({ 
                    ...formData, 
                    dropoffStreet: newStreet,
                    dropoffAddress: formData.dropoffSuburb ? `${newStreet}, ${formData.dropoffSuburb}` : newStreet
                  })
                }}
                className="w-full px-3 py-2 border border-white/30 bg-secondary/70 rounded-lg text-foreground placeholder-slate-400 transition-all duration-200 hover:border-white/50 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.15)] focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.15)]"
                placeholder="e.g., 456 High Street"
              />
            </div>

            {/* Dropoff Suburb Autocomplete */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">
                Suburb / Locality
              </label>
              <SuburbAutocomplete
                value={formData.dropoffSuburb}
                onChange={(suburb) => {
                  setFormData({ 
                    ...formData, 
                    dropoffSuburb: suburb,
                    dropoffAddress: formData.dropoffStreet ? `${formData.dropoffStreet}, ${suburb}` : suburb
                  })
                }}
                placeholder="Start typing suburb..."
              />
            </div>
          </div>
        )}
        
        {formData.sameAsPickup && (
          <p className="text-sm text-muted-foreground/60 italic">Dropoff at same location as pickup</p>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            <Calendar className="inline h-4 w-4 mr-1" />
            Date
          </label>
          <input
            type="date"
            required
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value, time: '' })}
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-3 py-2 border border-white/30 bg-secondary/70 rounded-lg text-foreground placeholder-slate-400 transition-all duration-200 hover:border-white/50 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.15)] focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.15)]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            <Clock className="inline h-4 w-4 mr-1" />
            Duration
          </label>
          <select
            value={formData.duration}
            onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value), time: '' })}
            className="w-full px-3 py-2 border border-white/30 bg-secondary/70 rounded-lg text-foreground placeholder-slate-400 transition-all duration-200 hover:border-white/50 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.15)] focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.15)]"
          >
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
            <option value="90">1.5 hours</option>
            <option value="120">2 hours</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          <Clock className="inline h-4 w-4 mr-1" />
          Available Times
        </label>
        <SlotPicker
          providerId={instructorData?.id || providerId || ''}
          date={formData.date}
          duration={formData.duration}
          value={formData.time}
          onChange={(time) => setFormData({ ...formData, time })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Notes (Optional)</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-white/30 bg-secondary/70 rounded-lg text-foreground placeholder-slate-400 transition-all duration-200 hover:border-white/50 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.15)] focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.15)] resize-none"
          placeholder="Any special requirements or notes..."
        />
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.joinWaitingList}
            onChange={(e) => setFormData({ ...formData, joinWaitingList: e.target.checked })}
            className="mt-1 bg-background/60 border border-border rounded accent-sky-500"
          />
          <div className="text-sm">
            <p className="font-medium text-amber-200">Join Waiting List</p>
            <p className="text-amber-300/80">
              Get notified if an earlier slot becomes available due to cancellations
            </p>
          </div>
        </label>
      </div>

      <div className="bg-sky-500/10 border border-sky-500/30 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-lg font-semibold text-foreground">Total Price:</span>
          <span className="text-3xl font-bold text-primary">
            <DollarSign className="inline h-6 w-6" />
            {calculatePrice()}
          </span>
        </div>
        {instructorData && (
          <p className="text-xs text-primary/90 mt-2">
            ${instructorData.hourlyRate}/hour × {formData.duration / 60} hour(s)
          </p>
        )}
      </div>

      {!existingBooking && (
        <div className="bg-secondary/50 border border-border rounded-lg p-3">
          <p className="text-xs text-foreground">
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
              className="mt-0.5 rounded bg-background/60 border border-border accent-sky-500"
            />
            <span className="text-sm text-foreground">
              I confirm that I am at least 16 years old and hold a valid learner's permit or driver's licence that allows me to undertake driving lessons.
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              required
              checked={formData.termsAccepted}
              onChange={(e) => setFormData({ ...formData, termsAccepted: e.target.checked })}
              className="mt-0.5 rounded bg-background/60 border border-border accent-sky-500"
            />
            <span className="text-sm text-foreground">
              I have read and agree to the{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-sky-200">
                Learner Terms and Conditions
              </a>{' '}
              and{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-sky-200">
                Privacy Policy
              </a>.
            </span>
          </label>
        </div>
      )}

      {/* Insufficient balance panel */}
      {insufficientBalance && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-200">Insufficient wallet balance</p>
              <p className="text-sm text-destructive mt-1">
                {insufficientBalance.customerName} has <strong>${insufficientBalance.currentBalance.toFixed(2)}</strong> but needs <strong>${insufficientBalance.required.toFixed(2)}</strong> for this lesson.
              </p>
              <p className="text-sm text-destructive">
                They need to top up <strong>${insufficientBalance.topUpAmount.toFixed(2)}</strong> (includes 3.6% platform fee).
              </p>
            </div>
          </div>
          {linkSent ? (
            <div className="flex items-center gap-2 text-emerald-300 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Payment link sent to {insufficientBalance.customerEmail}
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={sendPaymentLink}
                disabled={sendingLink}
                className="flex-1 min-w-[200px] bg-primary text-foreground px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {sendingLink ? 'Sending...' : `Send Payment Link — $${insufficientBalance.topUpAmount.toFixed(2)}`}
              </button>
              <button
                type="button"
                onClick={() => { setInsufficientBalance(null); setLinkSent(false) }}
                className="px-3 py-2 border border-border bg-secondary/50 text-foreground rounded-lg hover:bg-secondary text-sm transition-colors"
              >
                Dismiss
              </button>
            </div>
          )}
          {linkSent && (
            <p className="text-xs text-foreground">Once the client tops up, retry the booking.</p>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !formData.time || !instructorData || (!isInstructorBooking && !existingBooking && (!formData.ageDeclaration || !formData.termsAccepted))}
        className="w-full bg-primary text-foreground py-3 rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Processing...' : existingBooking ? 'Update Booking' : 'Confirm Booking'}
      </button>
    </form>
  )
}
