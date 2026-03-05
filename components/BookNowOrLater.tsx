'use client';

import React, { useState } from 'react';
import { useBooking } from '@/lib/contexts/BookingContext';

export default function BookNowOrLater() {
  const { bookingState, updateBooking } = useBooking();
  const [tooltip, setTooltip] = useState<string | null>(null);

  const handleSelection = (type: 'now' | 'later') => {
    updateBooking({ bookingType: type });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1">When would you like to schedule?</h2>
        <p className="text-gray-600 text-sm">Choose now for immediate slots or later to schedule from your dashboard.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 max-w-3xl mx-auto">
        <div className={`flex-1 p-4 rounded-lg border ${bookingState.bookingType === 'now' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Book Now</h3>
              <p className="text-sm text-gray-600 mt-1">See available time slots and confirm instantly.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onMouseEnter={() => setTooltip('now')}
                onMouseLeave={() => setTooltip(null)}
                onClick={() => setTooltip(tooltip === 'now' ? null : 'now')}
                aria-label="info"
                className="w-7 h-7 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center text-sm"
              >
                i
              </button>
            </div>
          </div>

          {tooltip === 'now' && (
            <div className="mt-3 p-2 text-sm bg-white border rounded shadow-sm">Choose immediate slots from instructor availability.</div>
          )}

          <div className="mt-4 flex items-center justify-end">
            <button
              onClick={() => handleSelection('now')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm"
            >
              Book Now
            </button>
          </div>
        </div>

        <div className={`flex-1 p-4 rounded-lg border ${bookingState.bookingType === 'later' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Book Later</h3>
              <p className="text-sm text-gray-600 mt-1">Pay now and schedule lessons later from your dashboard.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onMouseEnter={() => setTooltip('later')}
                onMouseLeave={() => setTooltip(null)}
                onClick={() => setTooltip(tooltip === 'later' ? null : 'later')}
                aria-label="info"
                className="w-7 h-7 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center text-sm"
              >
                i
              </button>
            </div>
          </div>

          {tooltip === 'later' && (
            <div className="mt-3 p-2 text-sm bg-white border rounded shadow-sm">Purchase now and manage scheduling later in your account.</div>
          )}

          <div className="mt-4 flex items-center justify-end">
            <button
              onClick={() => handleSelection('later')}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm"
            >
              Book Later
            </button>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 rounded-lg p-3 max-w-3xl mx-auto mt-4 text-center text-sm text-blue-900">
        <span className="font-semibold">Note:</span> Your hours are valid for 12 months from purchase date
      </div>
    </div>
  );
}
