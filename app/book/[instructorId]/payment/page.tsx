'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useBooking } from '@/lib/contexts/BookingContext';
import MultiStepBookingLayout from '@/components/MultiStepBookingLayout';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Initialize Stripe
const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

if (!stripePublishableKey) {
  console.error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set');
}

const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

function PaymentForm({ setIsRedirecting, slotSecondsLeft }: { setIsRedirecting: (value: boolean) => void; slotSecondsLeft: number | null }) {
  const router = useRouter();
  const { bookingState } = useBooking();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      setError('Payment system is not ready. Please refresh the page.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Validate slots first
      if (bookingState.scheduledBookings.length > 0) {
        const slotsToValidate = bookingState.scheduledBookings.map(booking => ({
          date: booking.date,
          time: booking.time,
          duration: booking.duration
        }));

        const validateResponse = await fetch('/api/availability/validate-slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instructorId: bookingState.instructor!.id,
            slots: slotsToValidate,
            sessionId: bookingState.sessionId || 'unknown'
          })
        });

        if (!validateResponse.ok) {
          const errorData = await validateResponse.json();
          throw new Error(errorData.message || 'Some slots are no longer available. Please select different times.');
        }
      }

      // Step 1: Create the booking and get payment intent
      const bookingData = {
        instructorId: bookingState.instructor!.id,
        packageType: bookingState.packageType,
        hours: bookingState.hours,
        includeTestPackage: bookingState.includeTestPackage,
        bookingType: bookingState.bookingType,
        scheduledBookings: bookingState.scheduledBookings,
        registrationType: bookingState.registrationType,
        accountHolderName: bookingState.accountHolderName,
        accountHolderEmail: bookingState.accountHolderEmail,
        accountHolderPhone: bookingState.accountHolderPhone,
        accountHolderPassword: bookingState.accountHolderPassword,
        learnerName: bookingState.learnerName,
        learnerPhone: bookingState.learnerPhone,
        learnerRelationship: bookingState.learnerRelationship,
        pricing: bookingState.pricing
      };

      const bookingResponse = await fetch('/api/public/bookings/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData)
      });

      if (!bookingResponse.ok) {
        const errorData = await bookingResponse.json();
        
        setError(errorData.error || 'Failed to create booking');
        return; // Stop processing
      }

      const bookingResult = await bookingResponse.json();

      // ── Book Later: the bulk API creates a Stripe Checkout Session ──────────
      // Book Later never creates a Booking row immediately. It creates a hosted
      // Stripe Checkout page. Redirect directly — no PaymentIntent needed.
      if (bookingState.bookingType === 'later') {
        if (bookingResult.checkoutUrl) {
          setIsRedirecting(true);
          window.location.href = bookingResult.checkoutUrl;
          return;
        }
        // Fallback: if no checkoutUrl, the bulk API may have returned an error
        throw new Error(bookingResult.error || 'Could not create payment session for Book Later. Please try again.');
      }

      // ── Book Now: create a PaymentIntent for the primary booking ─────────────
      // Step 2: Create payment intent
      const paymentPayload: {
        bookingId?: string;
        amount: number;
      } = {
        amount: bookingState.pricing.total
      };

      let primaryBookingId: string | null = null;

      // For "book now" we get an array of booking IDs – use the first as the
      // canonical one for payment metadata and confirmation routing.
      if (Array.isArray(bookingResult.bookingIds) && bookingResult.bookingIds.length > 0) {
        primaryBookingId = bookingResult.bookingIds[0];
      } else if (bookingResult.bookingId) {
        // Fallback for any legacy responses that still return bookingId
        primaryBookingId = bookingResult.bookingId;
      }

      if (!primaryBookingId) {
        throw new Error('Missing bookingId from booking response');
      }

      paymentPayload.bookingId = primaryBookingId;

      const paymentResponse = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentPayload)
      });

      if (!paymentResponse.ok) {
        throw new Error('Failed to create payment intent');
      }

      const { clientSecret } = await paymentResponse.json();

      // Step 3: Confirm payment with Stripe
      const cardElement = elements.getElement(CardNumberElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: bookingState.accountHolderName,
            email: bookingState.accountHolderEmail,
            phone: bookingState.accountHolderPhone
          }
        }
      });

      if (stripeError) {
        throw new Error(stripeError.message || 'Payment failed');
      }

      // Build the confirmation URL — used by both succeeded and processing paths
      const buildConfirmationUrl = (paymentStatus: string) => {
        const confirmationBase = `/booking/${primaryBookingId || bookingResult.bookingId}/confirmation`;
        const confirmParams = new URLSearchParams({ payment: paymentStatus });
        if (bookingState.instructor?.displayName || bookingState.instructor?.name) confirmParams.set('instructor', bookingState.instructor.displayName || bookingState.instructor.name);
        if (bookingState.hours)           confirmParams.set('hours', String(bookingState.hours));
        if (bookingState.pricing?.total)  confirmParams.set('total', bookingState.pricing.total.toFixed(2));
        if (bookingState.scheduledBookings?.[0]?.date) confirmParams.set('date', bookingState.scheduledBookings[0].date);
        if (bookingState.scheduledBookings?.[0]?.time) confirmParams.set('time', bookingState.scheduledBookings[0].time);
        return bookingState.bookingType === 'later'
          ? `/client-dashboard?payment=${paymentStatus}&bookingType=later`
          : `${confirmationBase}?${confirmParams.toString()}`;
      };

      // Handle different payment intent statuses
      if (paymentIntent.status === 'succeeded') {
        setSuccess(true);
        setError(null);
        setIsRedirecting(true);
        setTimeout(() => {
          // resetBooking is called on the confirmation page mount, not here,
          // to avoid wiping context while router.push is still in-flight.
          router.push(buildConfirmationUrl('success'));
        }, 1500);
      } else if (paymentIntent.status === 'requires_action') {
        // 3DS / SCA — must call handleNextAction to present the authentication challenge.
        // Simply showing an error message is wrong and will fail all 3DS-enrolled cards.
        const { error: actionError, paymentIntent: confirmedIntent } =
          await stripe.handleNextAction({ clientSecret });
        if (actionError) {
          throw new Error(actionError.message || '3D Secure authentication failed. Please try again.');
        }
        if (confirmedIntent?.status === 'succeeded') {
          setSuccess(true);
          setError(null);
          setIsRedirecting(true);
          setTimeout(() => {
            router.push(buildConfirmationUrl('success'));
          }, 1500);
        } else {
          throw new Error('Payment was not completed after authentication. Please try again.');
        }
      } else if (paymentIntent.status === 'processing') {
        setSuccess(true);
        setError(null);
        setIsRedirecting(true);
        setTimeout(() => {
          router.push(buildConfirmationUrl('processing'));
        }, 1500);
      } else {
        throw new Error(`Unexpected payment status: ${paymentIntent.status}. Please try again or contact support.`);
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-white">
      {/* Card Payment Form */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
        <h3 className="text-lg font-semibold text-white/95 mb-4">Payment Information</h3>
        
        {/* Card Number */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-white/80 mb-2">
            Card Number
          </label>
          <div className="border border-white/10 rounded-lg p-4 bg-slate-950/80">
            <CardNumberElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#f8fafc',
                    '::placeholder': {
                      color: '#94a3b8',
                    },
                  },
                  invalid: {
                    color: '#fca5a5',
                  },
                },
              }}
            />
          </div>
        </div>

        {/* Expiry and CVC - Side by side on desktop, stacked on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Expiry Date
            </label>
            <div className="border border-white/10 rounded-lg p-4 bg-slate-950/80">
              <CardExpiryElement
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#f8fafc',
                      '::placeholder': {
                        color: '#94a3b8',
                      },
                    },
                    invalid: {
                      color: '#fca5a5',
                    },
                  },
                }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              CVC
            </label>
            <div className="border border-white/10 rounded-lg p-4 bg-slate-950/80">
              <CardCvcElement
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#f8fafc',
                      '::placeholder': {
                        color: '#94a3b8',
                      },
                    },
                    invalid: {
                      color: '#fca5a5',
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-900/10 border border-green-500/20 rounded-lg p-4 text-white">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-green-200">Payment Successful!</p>
              <p className="text-sm text-green-100">Redirecting to confirmation page...</p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/10 border border-red-500/20 rounded-lg p-4 text-white">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-red-300 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-red-100 font-medium">{error}</p>
              {/* Link to login for account-related errors */}
              {(error.toLowerCase().includes('account') || error.toLowerCase().includes('email') || error.toLowerCase().includes('log in')) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href="/login"
                    className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500"
                  >
                    Log In
                  </a>
                  <a
                    href="/auth/forgot-password"
                    className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium bg-white/5 text-white border border-white/10 hover:bg-white/10"
                  >
                    Reset Password
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!stripe || loading || !elements}
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-lg font-semibold hover:from-purple-500 hover:to-pink-500 transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Processing Payment...
          </>
        ) : (
          `Pay $${bookingState.pricing.total.toFixed(2)}`
        )}
      </button>

      {/* Secure Payment Badge */}
      <div className="flex items-center justify-center gap-2 text-sm text-white/75">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
        <span>Secure payment powered by Stripe</span>
      </div>
    </form>
  );
}

export default function PaymentPage() {
  const router = useRouter();
  const { bookingState } = useBooking();
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Slot countdown: 10 minutes from page mount.
  // Slots are held by the server for 10 min — this warns students before expiry.
  const [slotSecondsLeft, setSlotSecondsLeft] = useState<number | null>(
    bookingState.scheduledBookings.length > 0 ? 10 * 60 : null
  );

  useEffect(() => {
    if (slotSecondsLeft === null || slotSecondsLeft <= 0) return;
    const t = setTimeout(() => setSlotSecondsLeft(s => (s !== null ? s - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [slotSecondsLeft]);

  // Redirect if no instructor selected (but not if we're in the middle of payment success redirect)
  useEffect(() => {
    if (!bookingState.instructor && !isRedirecting) {
      router.push('/book');
    }
  }, [bookingState.instructor, router, isRedirecting]);

  if (!bookingState.instructor && !isRedirecting) {
    return null;
  }

  // Check if Stripe is configured
  if (!stripePublishableKey) {
    return (
      <MultiStepBookingLayout currentStep={bookingState.bookingType === 'now' ? 6 : 5}>
        <div className="bg-red-900/10 border border-red-500/20 rounded-lg p-6 text-white">
          <h3 className="text-lg font-semibold text-red-100 mb-2">Payment System Not Configured</h3>
          <p className="text-red-100">
            The payment system is not properly configured. Please contact support.
          </p>
          <p className="text-sm text-red-200 mt-2">
            Error: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing
          </p>
        </div>
      </MultiStepBookingLayout>
    );
  }

  const stepNumber = bookingState.bookingType === 'now' ? 6 : 5;

  return (
    <MultiStepBookingLayout currentStep={stepNumber}>
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white/95 mb-2">
            Complete Payment
          </h2>
          <p className="text-white/85">
            Secure payment to confirm your booking
          </p>
        </div>

        {/* Registration Summary (if needed) */}
        {bookingState.accountHolderName && (
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-white">
            <h4 className="font-semibold text-white/90 text-sm mb-2">Account Details</h4>
            <div className="space-y-1 text-sm text-white/80">
              <p><span className="font-medium">Name:</span> {bookingState.accountHolderName}</p>
              <p><span className="font-medium">Email:</span> {bookingState.accountHolderEmail}</p>
              {bookingState.registrationType === 'someone-else' && (
                <p><span className="font-medium">Learner:</span> {bookingState.learnerName} ({bookingState.learnerRelationship})</p>
              )}
            </div>
          </div>
        )}

        {/* Scheduled Bookings (if any) */}
        {bookingState.scheduledBookings.length > 0 && (
          <div className="bg-green-900/10 border border-green-500/20 rounded-lg p-4 text-white">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-green-200 text-sm">
                Scheduled Lessons ({bookingState.scheduledBookings.length})
              </h4>
              {slotSecondsLeft !== null && (
                <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-full ${
                  slotSecondsLeft <= 60
                    ? 'bg-red-900/40 text-red-300 border border-red-700/50'
                    : slotSecondsLeft <= 180
                      ? 'bg-amber-900/40 text-amber-300 border border-amber-700/50'
                      : 'bg-green-900/40 text-green-300 border border-green-700/50'
                }`}>
                  ⏱ {Math.floor(slotSecondsLeft / 60)}:{String(slotSecondsLeft % 60).padStart(2, '0')} left
                </span>
              )}
            </div>
            <div className="space-y-2">
              {bookingState.scheduledBookings.slice(0, 3).map((booking, index) => (
                <p key={index} className="text-sm text-green-200">
                  {new Date(booking.date + 'T00:00:00').toLocaleDateString('en-AU', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric' 
                  })} at {booking.time} ({booking.duration / 60}h)
                </p>
              ))}
              {bookingState.scheduledBookings.length > 3 && (
                <p className="text-xs text-green-200">
                  +{bookingState.scheduledBookings.length - 3} more
                </p>
              )}
            </div>
            {bookingState.remainingHours > 0 && (
              <p className="text-xs text-green-200 mt-2">
                Extra hours to schedule later: {bookingState.remainingHours.toFixed(1)}h (available from dashboard)
              </p>
            )}
          </div>
        )}

        {/* Booking Type Info */}
        {bookingState.bookingType === 'later' && (
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-white">
            <p className="text-sm text-white/80">
              <span className="font-semibold">Book Later:</span> You can schedule all {bookingState.hours} hours from your dashboard after payment
            </p>
          </div>
        )}

        {/* Payment Form */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white/95">Payment Information</h3>
          <Elements stripe={stripePromise}>
            <PaymentForm setIsRedirecting={setIsRedirecting} slotSecondsLeft={slotSecondsLeft} />
          </Elements>
        </div>

        {/* Back Button */}
        <div className="pt-6 border-t border-white/10">
          <button
            onClick={() => router.back()}
            type="button"
            className="text-white/70 hover:text-white text-sm font-medium"
          >
            ← Back to Registration
          </button>
        </div>
      </div>
    </MultiStepBookingLayout>
  );
}
