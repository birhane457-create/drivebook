'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBooking } from '@/lib/contexts/BookingContext';
import MultiStepBookingLayout from '@/components/MultiStepBookingLayout';
import Link from 'next/link';

export default function ConfirmationPage({ params }: { params: { instructorId: string } }) {
  const router = useRouter();
  const { bookingState } = useBooking();
  const [loading, setLoading] = useState(false);

  // Redirect if no booking started
  if (!bookingState.instructor) {
    router.push('/book');
    return null;
  }

  const handleConfirmAndPay = async () => {
    setLoading(true);

    try {
      if (!bookingState.instructor) {
        throw new Error('Instructor information is missing. Please start over.');
      }

      // Validate all slots are still available
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
            instructorId: bookingState.instructor.id,
            slots: slotsToValidate,
            sessionId: bookingState.sessionId
          })
        });

        if (!validateResponse.ok) {
          const errorData = await validateResponse.json();
          throw new Error(errorData.message || 'Some slots are no longer available. Please go back and select different times.');
        }
      }

      // If validation passes, proceed to payment
      router.push(`/book/${bookingState.instructor.id}/payment`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to validate booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MultiStepBookingLayout currentStep={4}>
      <div className="space-y-8 max-w-2xl">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Review Your Booking</h2>
          <p className="text-gray-600">Please review all details before proceeding to payment</p>
        </div>

        {/* Instructor Section */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Instructor</h3>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-300 flex-shrink-0 flex items-center justify-center text-white text-2xl font-bold">
              {bookingState.instructor.name.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{bookingState.instructor.name}</p>
              <p className="text-sm text-gray-600">
                ⭐ {bookingState.instructor.averageRating?.toFixed(1) || 'New'} ({bookingState.instructor.totalReviews} reviews)
              </p>
              <p className="text-sm text-gray-600">${bookingState.instructor.hourlyRate}/hour</p>
            </div>
          </div>
        </div>

        {/* Package Selection */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Package & Pricing</h3>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Lesson Package</span>
              <span className="font-medium text-gray-900">
                {bookingState.packageType === 'CUSTOM' 
                  ? `Custom ${bookingState.hours} hours` 
                  : `${bookingState.hours} hour package`}
              </span>
            </div>

            {bookingState.includeTestPackage && bookingState.instructor.offersTestPackage && (
              <div className="flex justify-between bg-green-50 p-3 rounded border border-green-200">
                <span className="text-green-700">PDA Test Package</span>
                <span className="font-medium text-green-700">✓ Included</span>
              </div>
            )}

            <div className="border-t pt-3">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Subtotal</span>
                <span>${bookingState.pricing.subtotal.toFixed(2)}</span>
              </div>

              {bookingState.pricing.discount > 0 && (
                <div className="flex justify-between text-sm mb-2 text-green-600">
                  <span>Discount ({bookingState.pricing.discountPercentage}%)</span>
                  <span>-${bookingState.pricing.discount.toFixed(2)}</span>
                </div>
              )}

              {bookingState.includeTestPackage && bookingState.pricing.testPackage > 0 && (
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Test Package</span>
                  <span>${bookingState.pricing.testPackage.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Platform Fee</span>
                <span>${bookingState.pricing.platformFee.toFixed(2)}</span>
              </div>

              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Total Amount</span>
                <span className="text-blue-600 text-lg">${bookingState.pricing.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scheduled Lessons */}
        {bookingState.scheduledBookings.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Scheduled Lessons</h3>
            
            <div className="space-y-3">
              {bookingState.scheduledBookings.map((booking, index) => (
                <div key={index} className="flex items-start gap-4 bg-gray-50 p-4 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex gap-4 mb-2">
                      <div>
                        <p className="text-sm text-gray-600">Date</p>
                        <p className="font-medium text-gray-900">{booking.date}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Time</p>
                        <p className="font-medium text-gray-900">{booking.time}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Duration</p>
                        <p className="font-medium text-gray-900">{booking.duration} mins</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Pickup Location</p>
                      <p className="font-medium text-gray-900 break-words">{booking.pickupLocation}</p>
                    </div>
                    {booking.notes && (
                      <div className="mt-2">
                        <p className="text-sm text-gray-600">Notes</p>
                        <p className="text-sm text-gray-700 italic">{booking.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {bookingState.remainingHours > 0 && (
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded p-3">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> You have {bookingState.remainingHours.toFixed(1)} hours remaining to schedule later
                </p>
              </div>
            )}
          </div>
        )}

        {/* Client Details */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Client Information</h3>
          
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Account Holder Name</p>
              <p className="font-medium text-gray-900">{bookingState.accountHolderName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="font-medium text-gray-900">{bookingState.accountHolderEmail}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Phone</p>
              <p className="font-medium text-gray-900">{bookingState.accountHolderPhone}</p>
            </div>

            {bookingState.registrationType === 'someone-else' && (
              <>
                <div className="border-t pt-3">
                  <p className="text-sm text-gray-600">Learner Name</p>
                  <p className="font-medium text-gray-900">{bookingState.learnerName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Relationship</p>
                  <p className="font-medium text-gray-900">{bookingState.learnerRelationship}</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Payment Info */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-semibold text-amber-900">Please Review Carefully</p>
              <p className="text-sm text-amber-800 mt-1">
                By clicking "Proceed to Payment", the selected time slots will be held for 10 minutes. If you don't complete payment within this time, the slots will be released.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => router.back()}
            disabled={loading}
            className="flex-1 bg-white border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            ← Back
          </button>
          <button
            onClick={handleConfirmAndPay}
            disabled={loading}
            className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Validating...
              </>
            ) : (
              <>
                Proceed to Payment →
              </>
            )}
          </button>
        </div>

        {/* Security Info */}
        <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          <span>Your booking information is secure. You can change your mind anytime.</span>
        </div>
      </div>
    </MultiStepBookingLayout>
  );
}
