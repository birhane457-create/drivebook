'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useBooking } from '@/lib/contexts/BookingContext';
import MultiStepBookingLayout from '@/components/MultiStepBookingLayout';
import BookNowOrLater from '@/components/BookNowOrLater';

export default function BookTypePage() {
  const router = useRouter();
  const params = useParams();
  const { bookingState } = useBooking();
  const { instructor } = bookingState;
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    // Wait for instructor to load from localStorage before redirecting
    const timer = setTimeout(() => {
      if (!instructor) {
        router.push('/book');
      }
    }, 500); // Wait 500ms for localStorage recovery
    
    return () => clearTimeout(timer);
  }, [instructor, router]);

  // While instructor is loading, show loading state
  if (!instructor) {
    return (
      <MultiStepBookingLayout currentStep={3}>
        <div className="space-y-6 flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
            <p className="text-white/85">Loading booking options...</p>
          </div>
        </div>
      </MultiStepBookingLayout>
    );
  }

  const handleContinue = () => {
    if (!bookingState.bookingType) {
      setValidationError('Please select when you would like to schedule your lessons');
      return;
    }
    setValidationError(null);

    if (bookingState.bookingType === 'now') {
      router.push(`/book/${params.instructorId}/booking-details`);
    } else {
      router.push(`/book/${params.instructorId}/registration`);
    }
  };

  return (
    <MultiStepBookingLayout currentStep={3}>
      <div className="space-y-6 text-white">
        {/* Book Now/Later Selection */}
        <BookNowOrLater />

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-white/15">
          {/* C-01 fix: inline validation error replaces alert() */}
          {validationError && (
            <p role="alert" className="w-full text-sm font-semibold text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
              ⚠️ {validationError}
            </p>
          )}
          <button
            onClick={() => router.back()}
            type="button"
            className="flex-1 bg-white/8 text-white px-8 py-4 rounded-lg font-semibold hover:bg-white/10 transition-colors border border-white/20"
          >
            ← Back
          </button>
          <button
            onClick={handleContinue}
            type="button"
            disabled={!bookingState.bookingType}
            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-lg font-semibold hover:from-purple-500 hover:to-pink-500 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Continue →
          </button>
        </div>
      </div>
    </MultiStepBookingLayout>
  );
}
