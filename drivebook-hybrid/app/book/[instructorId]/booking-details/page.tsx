'use client';

import { useRouter, useParams } from 'next/navigation';
import { useBooking } from '@/lib/contexts/BookingContext';
import MultiStepBookingLayout from '@/components/MultiStepBookingLayout';
import BookingDetailsForm from '@/components/BookingDetailsForm';

export default function BookingDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const { bookingState } = useBooking();

  // Redirect if no instructor or booking type not selected
  if (!bookingState.instructor || bookingState.bookingType !== 'now') {
    router.push('/book');
    return null;
  }

  const handleContinue = () => {
    // Validate that at least one booking is scheduled
    if (bookingState.scheduledBookings.length === 0) {
      alert('Please schedule at least one lesson to continue');
      return;
    }

    router.push(`/book/${params.instructorId}/registration`);
  };

  return (
    <MultiStepBookingLayout currentStep={5}>
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Schedule Your Lessons
          </h2>
          <p className="text-gray-600">
            Book your lessons now or schedule some for later from your dashboard
          </p>
        </div>

        <BookingDetailsForm />

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
            disabled={bookingState.scheduledBookings.length === 0}
            className="flex-1 bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Continue to Registration →
          </button>
        </div>
      </div>
    </MultiStepBookingLayout>
  );
}
