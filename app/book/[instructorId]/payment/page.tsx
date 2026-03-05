'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useBooking } from '@/lib/contexts/BookingContext';
import MultiStepBookingLayout from '@/components/MultiStepBookingLayout';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Initialize Stripe
const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

if (!stripePublishableKey) {
  console.error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set');
}

const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

function PaymentForm({ setIsRedirecting }: { setIsRedirecting: (value: boolean) => void }) {
  const router = useRouter();
  const { bookingState, resetBooking } = useBooking();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorData, setErrorData] = useState<any>(null);
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
        
        // Store error data for display
        setErrorData(errorData);
        
        // Handle email already exists error
        if (errorData.code === 'EMAIL_EXISTS') {
          setError(errorData.message);
        } else {
          setError(errorData.error || 'Failed to create booking');
        }
        
        return; // Stop processing
      }

      const bookingResult = await bookingResponse.json();

      // Step 2: Create payment intent
      const paymentResponse = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: bookingResult.bookingId,
          amount: bookingState.pricing.total
        })
      });

      if (!paymentResponse.ok) {
        throw new Error('Failed to create payment intent');
      }

      const { clientSecret } = await paymentResponse.json();
      
      console.log('Payment intent created, confirming with Stripe...');

      // Step 3: Confirm payment with Stripe
      const cardElement = elements.getElement(CardElement);
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
        console.error('Stripe payment error:', stripeError);
        throw new Error(stripeError.message || 'Payment failed');
      }

      console.log('Payment intent result:', paymentIntent);

      // Handle different payment intent statuses
      if (paymentIntent.status === 'succeeded') {
        console.log('Payment succeeded! Redirecting to confirmation...');
        setSuccess(true);
        setError(null);
        setIsRedirecting(true);
        
        setTimeout(() => {
          router.push(`/booking/${bookingResult.bookingId}/confirmation?payment=success`);
          setTimeout(() => resetBooking(), 500);
        }, 1500);
      } else if (paymentIntent.status === 'requires_action') {
        setError('Additional authentication required. Please complete the verification.');
      } else if (paymentIntent.status === 'processing') {
        console.log('Payment processing, redirecting to confirmation...');
        setSuccess(true);
        setError(null);
        setIsRedirecting(true);
        
        setTimeout(() => {
          router.push(`/booking/${bookingResult.bookingId}/confirmation?payment=processing`);
          setTimeout(() => resetBooking(), 500);
        }, 1500);
      } else {
        console.error('Payment intent status:', paymentIntent.status);
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Card Payment Form */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Card Details
          </label>
          <div className="border border-gray-300 rounded-lg p-4 bg-white">
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#424770',
                    '::placeholder': {
                      color: '#aab7c4',
                    },
                  },
                  invalid: {
                    color: '#9e2146',
                  },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-green-800">Payment Successful!</p>
              <p className="text-sm text-green-700">Redirecting to confirmation page...</p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-red-800 font-medium">{error}</p>
              
              {/* Show helpful actions for EMAIL_EXISTS error */}
              {errorData?.code === 'EMAIL_EXISTS' && (
                <div className="mt-3 space-y-2">
                  {errorData.help && (
                    <p className="text-sm text-red-700">{errorData.help}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {errorData.actions?.map((action: any, index: number) => (
                      action.url ? (
                        <a
                          key={index}
                          href={action.url}
                          className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                            action.primary
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {action.label}
                        </a>
                      ) : (
                        <button
                          key={index}
                          onClick={() => {
                            setError(null);
                            setErrorData(null);
                          }}
                          className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
                        >
                          {action.label}
                        </button>
                      )
                    ))}
                  </div>
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
        className="w-full bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
      <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
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
      <MultiStepBookingLayout currentStep={bookingState.bookingType === 'now' ? 7 : 6}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-900 mb-2">Payment System Not Configured</h3>
          <p className="text-red-800">
            The payment system is not properly configured. Please contact support.
          </p>
          <p className="text-sm text-red-700 mt-2">
            Error: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing
          </p>
        </div>
      </MultiStepBookingLayout>
    );
  }

  const stepNumber = bookingState.bookingType === 'now' ? 7 : 6;

  return (
    <MultiStepBookingLayout currentStep={stepNumber}>
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Complete Payment
          </h2>
          <p className="text-gray-600">
            Secure payment to confirm your booking
          </p>
        </div>

        {/* Registration Summary (if needed) */}
        {bookingState.accountHolderName && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 text-sm mb-2">Account Details</h4>
            <div className="space-y-1 text-sm text-blue-800">
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
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-900 text-sm mb-2">
              Scheduled Lessons ({bookingState.scheduledBookings.length})
            </h4>
            <div className="space-y-2">
              {bookingState.scheduledBookings.slice(0, 3).map((booking, index) => (
                <p key={index} className="text-sm text-green-800">
                  {new Date(booking.date + 'T00:00:00').toLocaleDateString('en-AU', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric' 
                  })} at {booking.time} ({booking.duration / 60}h)
                </p>
              ))}
              {bookingState.scheduledBookings.length > 3 && (
                <p className="text-xs text-green-700">
                  +{bookingState.scheduledBookings.length - 3} more
                </p>
              )}
            </div>
            {bookingState.remainingHours > 0 && (
              <p className="text-xs text-green-700 mt-2">
                Remaining: {bookingState.remainingHours.toFixed(1)} hours (schedule from dashboard)
              </p>
            )}
          </div>
        )}

        {/* Booking Type Info */}
        {bookingState.bookingType === 'later' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <span className="font-semibold">Book Later:</span> You can schedule all {bookingState.hours} hours from your dashboard after payment
            </p>
          </div>
        )}

        {/* Payment Form */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Payment Information</h3>
          <Elements stripe={stripePromise}>
            <PaymentForm setIsRedirecting={setIsRedirecting} />
          </Elements>
        </div>

        {/* Back Button */}
        <div className="pt-6 border-t border-gray-200">
          <button
            onClick={() => router.back()}
            type="button"
            className="text-gray-600 hover:text-gray-900 text-sm font-medium"
          >
            ← Back to Registration
          </button>
        </div>
      </div>
    </MultiStepBookingLayout>
  );
}
