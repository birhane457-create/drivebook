'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect } from 'react';
import { useBooking } from '@/lib/contexts/BookingContext';
import MultiStepBookingLayout from '@/components/MultiStepBookingLayout';

export default function TestPackagePage() {
  const router = useRouter();
  const params = useParams();
  const { bookingState, toggleTestPackage } = useBooking();
  const { instructor } = bookingState;

  // If instructor doesn't offer test package, skip this step
  useEffect(() => {
    if (!instructor?.offersTestPackage) {
      router.push(`/book/${params.instructorId}/book-type`);
    }
  }, [instructor, params.instructorId, router]);

  if (!instructor?.offersTestPackage) {
    return null;
  }

  const handleAddTestPackage = () => {
    if (!bookingState.includeTestPackage) {
      toggleTestPackage();
    }
    router.push(`/book/${params.instructorId}/book-type`);
  };

  const handleSkip = () => {
    if (bookingState.includeTestPackage) {
      toggleTestPackage();
    }
    router.push(`/book/${params.instructorId}/book-type`);
  };

  return (
    <MultiStepBookingLayout currentStep={3}>
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Add Test Package?
          </h2>
          <p className="text-gray-600">
            Prepare for your driving test with a specialized package
          </p>
        </div>

        {/* Test Package Details */}
        <div className="flex items-start gap-6 mb-6">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Test Package
            </h3>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-3xl font-bold text-blue-600">
                ${instructor.testPackagePrice?.toFixed(2)}
              </span>
              <span className="text-gray-600">
                • {instructor.testPackageDuration} minutes
              </span>
            </div>
          </div>
        </div>

        {/* What's Included */}
        {instructor.testPackageIncludes && instructor.testPackageIncludes.length > 0 && (
          <div className="border-t pt-6">
            <h4 className="font-semibold text-gray-900 mb-3">What's Included:</h4>
            <ul className="space-y-2">
              {instructor.testPackageIncludes.map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-700">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Info */}
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">Note:</span> You can add the test package later from your dashboard if you change your mind
          </p>
        </div>

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
            onClick={handleSkip}
            type="button"
            className="flex-1 bg-gray-100 text-gray-700 px-8 py-4 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleAddTestPackage}
            type="button"
            className="flex-1 bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Add Test Package →
          </button>
        </div>
      </div>
    </MultiStepBookingLayout>
  );
}
