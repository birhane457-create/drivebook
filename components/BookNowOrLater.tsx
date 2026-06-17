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
        <h2 className="text-xl font-bold text-slate-50 mb-1">When would you like to schedule?</h2>
        <p className="text-slate-300 text-sm">Choose now for immediate slots or later to schedule from your dashboard.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto pb-12">
        {/* Book Now Option */}
        <button
          onClick={() => handleSelection('now')}
          className={`flex-1 p-6 rounded-lg border transition-all ${
            bookingState.bookingType === 'now' 
              ? 'border-blue-500 bg-blue-950/40' 
              : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-100 text-lg">Book Now</h3>
            <div className="relative z-20">
              <button
                onMouseEnter={() => setTooltip('now')}
                onMouseLeave={() => setTooltip(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  setTooltip(tooltip === 'now' ? null : 'now');
                }}
                className="w-6 h-6 rounded-full bg-slate-700 text-slate-100 flex items-center justify-center text-xs hover:bg-slate-600 transition"
              >
                ?
              </button>
              {tooltip === 'now' && (
                <div className="absolute right-0 top-8 w-40 p-2 text-sm bg-slate-900 border border-slate-600 rounded shadow-lg text-slate-100 z-50">
                  See available time slots and confirm instantly.
                </div>
              )}
            </div>
          </div>
          <div className="h-12 flex items-center">
            {bookingState.bookingType !== 'now' && (
              <span className="text-blue-400 text-sm">→ Schedule immediately</span>
            )}
          </div>
        </button>

        {/* Book Later Option */}
        <button
          onClick={() => handleSelection('later')}
          className={`flex-1 p-6 rounded-lg border transition-all ${
            bookingState.bookingType === 'later' 
              ? 'border-blue-500 bg-blue-950/40' 
              : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-100 text-lg">Book Later</h3>
            <div className="relative z-20">
              <button
                onMouseEnter={() => setTooltip('later')}
                onMouseLeave={() => setTooltip(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  setTooltip(tooltip === 'later' ? null : 'later');
                }}
                className="w-6 h-6 rounded-full bg-slate-700 text-slate-100 flex items-center justify-center text-xs hover:bg-slate-600 transition"
              >
                ?
              </button>
              {tooltip === 'later' && (
                <div className="absolute right-0 top-8 w-40 p-2 text-sm bg-slate-900 border border-slate-600 rounded shadow-lg text-slate-100 z-50">
                  Pay now and schedule lessons later from your dashboard.
                </div>
              )}
            </div>
          </div>
          <div className="h-12 flex items-center">
            {bookingState.bookingType !== 'later' && (
              <span className="text-blue-400 text-sm">→ Schedule anytime</span>
            )}
          </div>
        </button>
      </div>

      {/* Info note at bottom with spacing */}
      <div className="bg-blue-900 border border-blue-700 rounded-lg p-3 max-w-2xl mx-auto text-center text-sm text-blue-100">
        <span className="font-semibold">Note:</span> Your hours are valid for 12 months from purchase date
      </div>
    </div>
  );
}
