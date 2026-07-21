'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useBooking } from '@/lib/contexts/BookingContext';
import MultiStepBookingLayout from '@/components/MultiStepBookingLayout';
import PackageSelector from '@/components/PackageSelector';

export default function PackageSelectionPage() {
  const router = useRouter();
  const { bookingState } = useBooking();
  const { instructor } = bookingState;

  useEffect(() => {
    // Only redirect if instructor is definitely missing AND we've waited for recovery
    // The layout loads instructor from localStorage, so give it time
    const timer = setTimeout(() => {
      if (!instructor) {
        router.push('/book');
      }
    }, 500); // Wait 500ms for localStorage recovery
    
    return () => clearTimeout(timer);
  }, [instructor, router]);

  // While instructor is loading, show the layout (loading state)
  if (!instructor) {
    return (
      <MultiStepBookingLayout currentStep={2}>
        <div className="space-y-6 text-white flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
            <p className="text-white/85">Loading package options...</p>
          </div>
        </div>
      </MultiStepBookingLayout>
    );
  }

  const handleBack = () => {
    router.back();
  };

  const handleContinue = () => {
    // Continue to book type selection before scheduling
    router.push(`/book/${instructor.id}/book-type`);
  };

  return (
    <MultiStepBookingLayout currentStep={2}>
      <div className="space-y-6 text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white/95 mb-2">
            Select Your Package
          </h2>
          <p className="text-white/85">
            Choose the package that works best for you
          </p>
        </div>

        {/* Package Selection */}
        <PackageSelector />

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-white/15">
          <button
            onClick={handleBack}
            type="button"
            className="flex-1 bg-white/8 text-white px-8 py-4 rounded-lg font-semibold hover:bg-white/10 transition-colors border border-white/20"
          >
            ← Back
          </button>
          <button
            onClick={handleContinue}
            type="button"
            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-lg font-semibold hover:from-purple-500 hover:to-pink-500 transition-colors"
          >
            Continue →
          </button>
        </div>
      </div>
    </MultiStepBookingLayout>
  );
}
