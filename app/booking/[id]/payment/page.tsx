'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface PaymentSummary {
  bookingId: string
  status: string
  isPaid: boolean
  date: string | null
  time: string | null
  startTime: string | null
  endTime: string | null
  duration: number | null
  pickupLocation: string | null
  isPackageBooking: boolean
  packageHours: number | null
  total: number
  currency: string
  hourlyRate: number | null
  discountPct: number | null
  instructor: {
    name: string
    profileImage: string | null
    rating: number | null
    reviews: number
  }
  expiresAt: string
  reservationExpired: boolean
}

// ── Countdown ─────────────────────────────────────────────────────────────────
function SlotCountdown({ expiresAt, onExpired }: { expiresAt: string; onExpired: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  )

  useEffect(() => {
    if (secondsLeft <= 0) { onExpired(); return }
    const t = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { clearInterval(t); onExpired(); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const urgent = secondsLeft < 120

  return (
    <div className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium ${
      urgent
        ? 'bg-red-50 border border-red-200 text-red-700'
        : 'bg-amber-50 border border-amber-200 text-amber-700'
    }`}>
      <span role="img" aria-label="timer">⏱️</span>
      <span>
        Slot reserved — expires in{' '}
        <span className="font-bold tabular-nums">
          {mins}:{secs.toString().padStart(2, '0')}
        </span>
      </span>
    </div>
  )
}

// ── Stripe payment form ───────────────────────────────────────────────────────
function StripePayForm({ bookingId, clientSecret, total, token }: {
  bookingId: string
  clientSecret: string
  total: number
  token: string
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setProcessing(true)
    setError(null)

    const returnUrl = token
      ? `${window.location.origin}/booking/${bookingId}/confirmation?token=${encodeURIComponent(token)}`
      : `${window.location.origin}/booking/${bookingId}/confirmation`

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    })

    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed — please try again.')
      setProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement options={{ layout: 'tabs' }} />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300 text-white font-semibold py-3.5 rounded-xl text-base transition-colors"
        aria-label={`Pay ${total.toFixed(2)} AUD`}
      >
        {processing ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Processing payment...
          </span>
        ) : (
          `Pay $${total.toFixed(2)} AUD`
        )}
      </button>

      <p className="text-center text-xs text-gray-400">
        🔒 Secured by Stripe — DriveBook never stores your card details
      </p>
    </form>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PaymentPage() {
  const params = useParams()
  const router = useRouter()
  const bookingId = params.id as string

  // paymentToken comes from the SMS link: /booking/{id}/payment?token=...
  // It is required by the payment-summary and payment-status endpoints.
  // Without it, the API returns 401 — this prevents anyone who didn't receive the SMS
  // from viewing booking details even if they know the booking ID.
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    // Read token from URL on mount — works for both fresh visits and returning users
    const urlToken = new URLSearchParams(window.location.search).get('token')
    setToken(urlToken)
  }, [])

  const [summary, setSummary] = useState<PaymentSummary | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<'EXPIRED' | 'CANCELLED' | 'ALREADY_PAID' | 'ERROR' | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [slotExpiredLive, setSlotExpiredLive] = useState(false)

  useEffect(() => {
    if (token === null) return // wait for token to be read from URL
    async function load() {
      try {
        if (!token) {
          // No token in URL — SMS link is malformed or was tampered with
          setPageError('ERROR')
          setLoading(false)
          return
        }

        // Load lean payment summary — validates both bookingId + token
        const sumRes = await fetch(
          `/api/public/bookings/${bookingId}/payment-summary?token=${encodeURIComponent(token)}`
        )
        if (sumRes.status === 401) { setPageError('ERROR'); setLoading(false); return }
        if (!sumRes.ok) { setPageError('ERROR'); return }
        const data: PaymentSummary = await sumRes.json()

        if (data.isPaid) { router.replace(`/booking/${bookingId}/confirmation`); return }
        if (data.status === 'CANCELLED') { setPageError('CANCELLED'); return }
        if (data.status === 'EXPIRED' || data.reservationExpired) { setPageError('EXPIRED'); return }

        setSummary(data)

        // Initialise Stripe payment intent (reuses existing if present — resume payment)
        const piRes = await fetch('/api/payments/create-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId, amount: data.total, paymentToken: token }),
        })
        if (piRes.status === 410) { setPageError('EXPIRED'); return }
        if (!piRes.ok) throw new Error('Could not initialise payment')
        const piData = await piRes.json()
        setClientSecret(piData.clientSecret)
      } catch {
        setPageError('ERROR')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [bookingId, router, token])

  const handleCancel = useCallback(async () => {
    if (!window.confirm("Cancel this booking?\n\nYour slot will be released and you'll need to book again.")) return
    setCancelling(true)
    try {
      await fetch(`/api/public/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Client cancelled before payment' }),
      })
      router.push('/')
    } catch {
      setCancelling(false)
    }
  }, [bookingId, router])

  // ── Slot expired live (countdown hit zero) ────────────────────────────────
  if (slotExpiredLive || pageError === 'EXPIRED') {
    return (
      <FullScreenState
        icon="⏱️"
        title="Slot Expired"
        body="Your reserved slot wasn't held — the 10-minute payment window closed before payment was completed."
        sub="Slots expire automatically to keep availability fair. Book again to get a new slot."
        action={{ label: 'Book a New Lesson', href: '/' }}
      />
    )
  }

  if (pageError === 'CANCELLED') {
    return (
      <FullScreenState
        icon="✖️"
        title="Booking Cancelled"
        body="This booking has been cancelled."
        action={{ label: 'Book a New Lesson', href: '/' }}
      />
    )
  }

  if (pageError === 'ALREADY_PAID') {
    return (
      <FullScreenState
        icon="✅"
        title="Already Paid"
        body="This booking is already confirmed."
        action={{ label: 'View Booking', href: `/booking/${bookingId}/confirmation` }}
      />
    )
  }

  if (pageError === 'ERROR') {
    return (
      <FullScreenState
        icon="⚠️"
        title="Something went wrong"
        body="We couldn't load your booking details. The link may be invalid or expired."
        action={{ label: 'Go Home', href: '/' }}
        secondaryAction={{ label: 'Try Again', onClick: () => window.location.reload() }}
      />
    )
  }

  if (loading || token === null || !summary || !clientSecret) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
          <p className="text-gray-500 text-sm">Loading your booking...</p>
        </div>
      </div>
    )
  }

  // ── Pricing breakdown ─────────────────────────────────────────────────────
  const isPackage = summary.isPackageBooking && (summary.packageHours ?? 0) > 1
  const hourlyRate = summary.hourlyRate ?? 0
  const discountPct = summary.discountPct ?? 0
  const subtotal = isPackage ? hourlyRate * (summary.packageHours ?? 0) : summary.total
  const discount = isPackage ? (subtotal * discountPct) / 100 : 0
  const afterDiscount = subtotal - discount
  const platformFee = isPackage ? Math.max(0, summary.total - afterDiscount) : 0

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Page title */}
        <div className="text-center pt-2">
          <h1 className="text-2xl font-bold text-gray-900">Complete Your Booking</h1>
          <p className="text-gray-500 text-sm mt-1">Pay now to confirm your slot</p>
        </div>

        {/* Countdown */}
        <SlotCountdown
          expiresAt={summary.expiresAt}
          onExpired={() => setSlotExpiredLive(true)}
        />

        {/* Booking summary card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Booking Summary</h2>
            <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2.5 py-1 rounded-full">
              Slot Reserved
            </span>
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* Instructor */}
            <div className="flex items-center gap-3">
              {summary.instructor.profileImage ? (
                <img
                  src={summary.instructor.profileImage}
                  alt={summary.instructor.name}
                  className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-bold text-lg" aria-hidden="true">
                    {summary.instructor.name.charAt(0)}
                  </span>
                </div>
              )}
              <div>
                <p className="font-semibold text-gray-900">{summary.instructor.name}</p>
                <p className="text-xs text-gray-500">Driving Instructor</p>
                {summary.instructor.rating && (
                  <p className="text-xs text-amber-500 mt-0.5" aria-label={`Rating: ${summary.instructor.rating}`}>
                    ★ {summary.instructor.rating.toFixed(1)}
                    {summary.instructor.reviews > 0 && (
                      <span className="text-gray-400"> ({summary.instructor.reviews} reviews)</span>
                    )}
                  </p>
                )}
              </div>
            </div>

            {/* Lesson details */}
            <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-xl p-4 text-sm">
              {isPackage ? (
                <div className="col-span-2">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Package</p>
                  <p className="font-semibold text-gray-900">{summary.packageHours}-Hour Package</p>
                </div>
              ) : null}

              {summary.date && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Date</p>
                  <p className="font-medium text-gray-900">
                    {new Date(summary.startTime!).toLocaleDateString('en-AU', {
                      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>
              )}

              {summary.time && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Time</p>
                  <p className="font-medium text-gray-900">
                    {summary.time}
                    {summary.endTime && (
                      <span className="text-gray-500">
                        {' – '}
                        {new Date(summary.endTime).toLocaleTimeString('en-AU', {
                          hour: '2-digit', minute: '2-digit', hour12: true,
                        })}
                      </span>
                    )}
                  </p>
                </div>
              )}

              {summary.duration && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Duration</p>
                  <p className="font-medium text-gray-900">{summary.duration} min</p>
                </div>
              )}

              {summary.pickupLocation && (
                <div className={summary.duration ? '' : 'col-span-2'}>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Pickup</p>
                  <p className="font-medium text-gray-900 leading-snug">{summary.pickupLocation}</p>
                </div>
              )}
            </div>

            {/* Price breakdown */}
            <div className="space-y-2 text-sm">
              {isPackage ? (
                <>
                  <div className="flex justify-between text-gray-600">
                    <span>{summary.packageHours} hrs × ${hourlyRate.toFixed(2)}/hr</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Package discount ({discountPct}% off)</span>
                      <span>−${discount.toFixed(2)}</span>
                    </div>
                  )}
                  {platformFee > 0 && (
                    <div className="flex justify-between text-gray-400 text-xs">
                      <span>Platform fee</span>
                      <span>${platformFee.toFixed(2)}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex justify-between text-gray-600">
                  <span>1-hour lesson</span>
                  <span>${summary.total.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t border-gray-200">
                <span>Total</span>
                <span>${summary.total.toFixed(2)} AUD</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment form card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Payment Details</h2>
            <p className="text-xs text-gray-400 mt-0.5">One-time charge — no recurring fees</p>
          </div>
          <div className="px-5 py-5">
            <Elements
              stripe={stripePromise}
              options={{ clientSecret, appearance: { theme: 'stripe' } }}
            >
              <StripePayForm
                bookingId={bookingId}
                clientSecret={clientSecret}
                total={summary.total}
                token={token ?? ''}
              />
            </Elements>
          </div>
        </div>

        {/* Cancel escape hatch */}
        <div className="text-center pb-2">
          <p className="text-xs text-gray-400 mb-1">Need to make changes?</p>
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="text-xs text-gray-500 hover:text-red-600 underline transition-colors disabled:opacity-50"
          >
            {cancelling ? 'Cancelling...' : 'Cancel this booking'}
          </button>
          <p className="text-xs text-gray-400 mt-1">
            Your slot will be released — you can book again any time.
          </p>
        </div>

        {/* Trust footer */}
        <div className="flex items-center justify-center gap-5 text-xs text-gray-400 pb-4">
          <span>🔒 256-bit SSL</span>
          <span>💳 Powered by Stripe</span>
          <span>🇦🇺 AUD</span>
        </div>
      </div>
    </div>
  )
}

// ── Reusable full-screen error/state screen ───────────────────────────────────
function FullScreenState({
  icon,
  title,
  body,
  sub,
  action,
  secondaryAction,
}: {
  icon: string
  title: string
  body: string
  sub?: string
  action: { label: string; href?: string; onClick?: () => void }
  secondaryAction?: { label: string; href?: string; onClick?: () => void }
}) {
  const router = useRouter()
  const go = (a: typeof action) => {
    if (a.onClick) a.onClick()
    else if (a.href) router.push(a.href)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center space-y-4">
        <div className="text-5xl" role="img" aria-label={title}>{icon}</div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        <p className="text-gray-600 text-sm">{body}</p>
        {sub && <p className="text-gray-400 text-xs">{sub}</p>}
        <button
          onClick={() => go(action)}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
        >
          {action.label}
        </button>
        {secondaryAction && (
          <button
            onClick={() => go(secondaryAction)}
            className="w-full text-gray-500 text-sm underline"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  )
}
