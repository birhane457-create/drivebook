'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useBooking } from '@/lib/contexts/BookingContext';
import MultiStepBookingLayout from '@/components/MultiStepBookingLayout';
import BookingDetailsForm from '@/components/BookingDetailsForm';

export default function BookingDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const { bookingState } = useBooking();
  const [continueError, setContinueError] = useState<string | null>(null);

  useEffect(() => {
    // Wait for instructor to load from localStorage before redirecting
    const timer = setTimeout(() => {
      if (!bookingState.instructor || bookingState.bookingType !== 'now') {
        router.push('/book');
      }
    }, 500); // Wait 500ms for localStorage recovery
    
    return () => clearTimeout(timer);
  }, [bookingState.instructor, bookingState.bookingType, router]);

  // While instructor is loading, show loading state
  if (!bookingState.instructor || bookingState.bookingType !== 'now') {
    return (
      <MultiStepBookingLayout currentStep={4}>
        <div className="space-y-6 flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
            <p className="text-white/85">Loading booking details...</p>
          </div>
        </div>
      </MultiStepBookingLayout>
    );
  }

  const handleContinue = () => {
    // Validate that at least one booking (lesson or PDA) is scheduled
    if (bookingState.scheduledBookings.length === 0 && !bookingState.pdaTestBooking) {
      setContinueError('Please schedule at least one lesson or PDA test to continue');
      return;
    }
    setContinueError(null);
    router.push(`/book/${params.instructorId}/registration`);
  };

  return (
    <MultiStepBookingLayout currentStep={4}>
      <div className="space-y-6 text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white/95 mb-2">
            Schedule Your Lessons & Tests
          </h2>
          <p className="text-white/85">
            Add lessons, PDA tests, or both. You can schedule lessons now and book more later from your dashboard.
          </p>
        </div>

        <BookingDetailsForm />

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-white/15">
          {continueError && (
            <p role="alert" className="w-full text-sm font-semibold text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
              ⚠️ {continueError}
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
            disabled={bookingState.scheduledBookings.length === 0 && !bookingState.pdaTestBooking}
            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-lg font-semibold hover:from-purple-500 hover:to-pink-500 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Continue to Registration →
          </button>
        </div>
      </div>
    </MultiStepBookingLayout>
  );
}
