'use client';

import { useRouter, useParams } from 'next/navigation';
import { useBooking } from '@/lib/contexts/BookingContext';
import MultiStepBookingLayout from '@/components/MultiStepBookingLayout';
import BookNowOrLater from '@/components/BookNowOrLater';

export default function BookTypePage() {
  const router = useRouter();
  const params = useParams();
  const { bookingState } = useBooking();
  const { instructor } = bookingState;

  if (!instructor) {
    router.push('/book');
    return null;
  }

  const handleContinue = () => {
    if (!bookingState.bookingType) {
      alert('Please select when you would like to schedule your lessons');
      return;
    }

    if (bookingState.bookingType === 'now') {
      router.push(`/book/${params.instructorId}/booking-details`);
    } else {
      router.push(`/book/${params.instructorId}/registration`);
    }
  };

  return (
    <MultiStepBookingLayout currentStep={4}>
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Book Now or Later?
          </h2>
          <p className="text-gray-600">
            Choose when you'd like to schedule your lessons
          </p>
        </div>

        {/* Book Now/Later Selection */}
        <BookNowOrLater />

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200">
          <button
            onClick={() => router.back()}
            type="button"
            className="flex-1 bg-white text-gray-700 px-8 py-4 rounded-lg font-semibold hover:bg-gray-50 transition-colors border-2 border-gray-300"
          >
            ← Back
          </button>
          <button
            onClick={handleContinue}
            type="button"
            disabled={!bookingState.bookingType}
            className="flex-1 bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Continue →
          </button>
        </div>
      </div>
    </MultiStepBookingLayout>
  );
}
