'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useBooking } from '@/lib/contexts/BookingContext';
import { HOUR_PACKAGES } from '@/lib/config/packages';
import { useRouter } from 'next/navigation';

interface BookingSummaryProps {
  showButtons?: boolean;
  onContinue?: () => void;
  onBack?: () => void;
  continueText?: string;
  backText?: string;
  loading?: boolean;
  currentStep?: number;
}

export default function BookingSummary({ 
  showButtons = false,
  onContinue,
  onBack,
  continueText = 'Continue →',
  backText = '← Back',
  loading = false,
  currentStep = 1
}: BookingSummaryProps) {
  const router = useRouter();
  const { bookingState } = useBooking();
  const [showPackageInfo, setShowPackageInfo] = useState(false);
  const { instructor, packageType, hours, includeTestPackage, pricing } = bookingState;

  if (!instructor) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
        <h3 className="text-lg font-semibold mb-4">Booking Summary</h3>
        <p className="text-gray-500 text-sm">Select an instructor to begin</p>
      </div>
    );
  }

  const packageInfo = packageType === 'CUSTOM' 
    ? { name: 'Custom Package', hours } 
    : HOUR_PACKAGES[packageType];

  return (
    <>
      <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
        <h3 className="text-lg font-semibold mb-4">Booking Summary</h3>

        {/* Instructor Info */}
        <div className="flex items-center gap-3 mb-6 pb-6 border-b">
          <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
            {instructor.profileImage ? (
              <Image
                src={instructor.profileImage}
                alt={instructor.name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl font-bold">
                {instructor.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-900 truncate">{instructor.name}</h4>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-yellow-500">★</span>
              <span className="text-gray-600">
                {instructor.averageRating?.toFixed(1) || 'New'}
              </span>
              <span className="text-gray-400">
                ({instructor.totalReviews})
              </span>
            </div>
          </div>
        </div>

        {/* COMPACT Package Details - 2 LINES */}
        <div className="bg-blue-50 rounded-lg p-3 mb-6 pb-6 border-b">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-xs font-semibold text-blue-900 mb-1">{packageInfo.name}</p>
              <p className="text-sm text-blue-800">{hours}h • ${instructor.hourlyRate}/h</p>
            </div>
            <button
              onClick={() => setShowPackageInfo(true)}
              className="text-blue-600 hover:text-blue-800 p-1 flex-shrink-0"
              title="Click for details"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Price Breakdown */}
        <div className="space-y-2 mb-6 pb-6 border-b">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal</span>
            <span className="text-gray-900">${pricing.subtotal.toFixed(2)}</span>
          </div>
          
          {pricing.discount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-green-600">
                Discount ({pricing.discountPercentage}%)
              </span>
              <span className="text-green-600">-${pricing.discount.toFixed(2)}</span>
            </div>
          )}

          {includeTestPackage && pricing.testPackage > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Test Package</span>
              <span className="text-gray-900">${pricing.testPackage.toFixed(2)}</span>
            </div>
          )}

          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Platform Fee</span>
            <span className="text-gray-900">${pricing.platformFee.toFixed(2)}</span>
          </div>
        </div>

        {/* Total */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-900">Total</span>
            <span className="text-2xl font-bold text-blue-600">
              ${pricing.total.toFixed(2)}
            </span>
          </div>

          {/* Scheduled Bookings (if any) */}
          {bookingState.scheduledBookings.length > 0 && (
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-xs text-green-800 font-semibold mb-1">
                Scheduled: {bookingState.scheduledBookings.length}
              </p>
              <p className="text-xs text-green-700">
                Remaining: {bookingState.remainingHours.toFixed(1)}h
              </p>
            </div>
          )}

          {/* Buttons at Bottom - Left Aligned */}
          {showButtons && (
            <div className="mt-6 pt-6 border-t border-gray-200 flex flex-col sm:flex-row gap-3">
              <button
                onClick={onBack}
                disabled={loading}
                className="flex-1 sm:flex-initial px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                {backText}
              </button>
              <button
                onClick={onContinue}
                disabled={loading}
                className="flex-1 sm:flex-initial px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </>
                ) : (
                  continueText
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Package Details Modal */}
      {showPackageInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 animate-in fade-in">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Package Details</h3>
              <button
                onClick={() => setShowPackageInfo(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Package Type</p>
                <p className="font-semibold text-gray-900">{packageInfo.name}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Total Hours</p>
                <p className="font-semibold text-gray-900">{hours} hours</p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Instructor Rate</p>
                <p className="font-semibold text-gray-900">${instructor.hourlyRate}/hour</p>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm text-gray-600 mb-2">Pricing</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Base Price</span>
                    <span className="text-gray-900">${pricing.subtotal.toFixed(2)}</span>
                  </div>
                  {pricing.discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount ({pricing.discountPercentage}%)</span>
                      <span>-${pricing.discount.toFixed(2)}</span>
                    </div>
                  )}
                  {includeTestPackage && pricing.testPackage > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Test Package Add-on</span>
                      <span className="text-gray-900">${pricing.testPackage.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Platform Fee</span>
                    <span className="text-gray-900">${pricing.platformFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                    <span className="text-gray-900">Total Cost</span>
                    <span className="text-blue-600">${pricing.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {includeTestPackage && instructor.offersTestPackage && (
                <div className="bg-green-50 p-3 rounded border border-green-200">
                  <p className="text-xs font-semibold text-green-900 mb-1">✓ Test Package Included</p>
                  <p className="text-xs text-green-800">{instructor.testPackageDuration || 2} hour PDA test preparation</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowPackageInfo(false)}
              className="w-full mt-6 bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
