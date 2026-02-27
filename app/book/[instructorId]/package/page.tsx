'use client';

import { useRouter } from 'next/navigation';
import { useBooking } from '@/lib/contexts/BookingContext';
import MultiStepBookingLayout from '@/components/MultiStepBookingLayout';
import PackageSelector from '@/components/PackageSelector';

export default function PackageSelectionPage() {
  const router = useRouter();
  const { bookingState } = useBooking();
  const { instructor } = bookingState;

  // Redirect if no instructor selected
  if (!instructor) {
    router.push('/book');
    return null;
  }

  const handleBack = () => {
    router.back();
  };

  const handleContinue = () => {
    // Navigate to test-package step (will auto-skip if instructor doesn't offer it)
    router.push(`/book/${instructor.id}/test-package`);
  };

  return (
    <MultiStepBookingLayout currentStep={2}>
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Select Your Package
          </h2>
          <p className="text-gray-600">
            Choose the package that works best for you
          </p>
        </div>

        {/* Package Selection */}
        <PackageSelector />

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200">
          <button
            onClick={handleBack}
            type="button"
            className="flex-1 bg-white text-gray-700 px-8 py-4 rounded-lg font-semibold hover:bg-gray-50 transition-colors border-2 border-gray-300"
          >
            ← Back
          </button>
          <button
            onClick={handleContinue}
            type="button"
            className="flex-1 bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Continue →
          </button>
        </div>
      </div>
    </MultiStepBookingLayout>
  );
}
