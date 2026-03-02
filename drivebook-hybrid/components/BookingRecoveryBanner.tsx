'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBooking } from '@/lib/contexts/BookingContext';
import Link from 'next/link';

export default function BookingRecoveryBanner() {
  const router = useRouter();
  const { hasRecoverableBooking, loadFromLocalStorage, bookingState } = useBooking();
  const [showRecovery, setShowRecovery] = useState(false);
  const [loadedBooking, setLoadedBooking] = useState<any>(null);

  useEffect(() => {
    // Check if there's a recoverable booking
    if (hasRecoverableBooking()) {
      setShowRecovery(true);
      
      // Try to load it to show preview
      try {
        const saved = localStorage.getItem('bookingState');
        if (saved) {
          const parsed = JSON.parse(saved);
          setLoadedBooking(parsed);
        }
      } catch (error) {
        console.error('Failed to load booking:', error);
      }
    }
  }, [hasRecoverableBooking]);

  const handleContinue = () => {
    if (loadFromLocalStorage() && bookingState.instructor) {
      // Navigate to the appropriate step based on booking progress
      router.push(`/book/${bookingState.instructor.id}/package`);
    }
  };

  const handleDiscard = () => {
    try {
      localStorage.removeItem('bookingState');
      setShowRecovery(false);
    } catch (error) {
      console.error('Failed to clear booking:', error);
    }
  };

  if (!showRecovery || !loadedBooking?.instructor) {
    return null;
  }

  return (
    <div className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-600 rounded-lg p-6 shadow-sm">
      <div className="max-w-4xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            {/* Recovery Icon */}
            <div className="flex-shrink-0 mt-1">
              <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4V5h12v10z" />
                <path d="M10 7a1 1 0 000 2 1 1 0 000-2zM7 10a1 1 0 100-2 1 1 0 000 2zm6 0a1 1 0 100-2 1 1 0 000 2z" />
              </svg>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Continue Your Booking
              </h3>
              <p className="text-sm text-gray-700 mb-3">
                We found your incomplete booking with <span className="font-medium">{loadedBooking.instructor?.name || 'your instructor'}</span>. 
                Pick up where you left off or start fresh.
              </p>

              {/* Booking Summary */}
              <div className="text-sm text-gray-600 bg-white/50 rounded p-3 mb-4">
                <div className="flex justify-between mb-2">
                  <span>Package:</span>
                  <span className="font-medium text-gray-900">
                    {loadedBooking.hours} hours
                  </span>
                </div>
                {loadedBooking.includeTestPackage && (
                  <div className="flex justify-between mb-2">
                    <span>Test Package:</span>
                    <span className="font-medium text-green-700">✓ Included</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                  <span>Total:</span>
                  <span className="font-semibold text-blue-600">
                    ${loadedBooking.pricing?.total?.toFixed(2) || '0.00'}
                  </span>
                </div>
              </div>

              {/* Expired Warning */}
              {loadedBooking.slotReservations?.length > 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-4">
                  ⚠️ Note: Reserved time slots expire after 10 minutes of inactivity
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
            <button
              onClick={handleContinue}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              Continue →
            </button>
            <button
              onClick={handleDiscard}
              className="px-4 py-2 bg-white text-gray-700 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap"
            >
              Start Fresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
