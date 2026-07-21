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

      <div className="flex flex-col sm:flex-row gap-6 max-w-2xl mx-auto pb-12">
        {/* Book Now Option */}
        <button
          onClick={() => handleSelection('now')}
          className={`flex-1 p-4 sm:p-5 rounded-xl border-2 text-left transition-all duration-100 ${
            bookingState.bookingType === 'now' 
              ? 'border-white bg-blue-600 text-white shadow-[0_5px_0_0_#1d4ed8,0_15px_30px_0_rgba(37,99,235,0.5)] translate-y-[4px]' 
              : 'border-slate-400 bg-slate-900 hover:border-slate-200 text-slate-100 shadow-[0_9px_0_0_#475569,0_20px_30px_0_rgba(0,0,0,0.6)] hover:translate-y-[-2px] hover:shadow-[0_11px_0_0_#475569,0_25px_35px_0_rgba(0,0,0,0.7)] active:translate-y-[4px] active:shadow-[0_5px_0_0_#475569,0_15px_20px_0_rgba(0,0,0,0.5)]'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="font-extrabold text-white text-base tracking-wide">Book Now</h3>
            <div className="relative z-20">
              <button
                onMouseEnter={() => setTooltip('now')}
                onMouseLeave={() => setTooltip(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  setTooltip(tooltip === 'now' ? null : 'now');
                }}
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black transition ${
                  bookingState.bookingType === 'now'
                    ? 'bg-blue-800 text-white hover:bg-blue-900'
                    : 'bg-slate-700 text-slate-100 hover:bg-slate-600'
                }`}
              >
                ?
              </button>
              {tooltip === 'now' && (
                <div className="absolute right-0 top-7 w-40 p-2 text-sm bg-slate-950 border-2 border-slate-500 rounded-md shadow-2xl text-white z-50">
                  See available time slots and confirm instantly.
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between">
            <span className={`font-bold text-xs uppercase tracking-wider transition ${
              bookingState.bookingType === 'now' ? 'text-blue-100' : 'text-blue-400'
            }`}>
              {bookingState.bookingType === 'now' ? '✓ Selected' : 'Immediate slots'}
            </span>
          </div>
        </button>

        {/* Book Later Option */}
        <button
          onClick={() => handleSelection('later')}
          className={`flex-1 p-4 sm:p-5 rounded-xl border-2 text-left transition-all duration-100 ${
            bookingState.bookingType === 'later' 
              ? 'border-white bg-cyan-600 text-white shadow-[0_5px_0_0_#0891b2,0_15px_30px_0_rgba(6,182,212,0.5)] translate-y-[4px]' 
              : 'border-slate-400 bg-slate-900 hover:border-slate-200 text-slate-100 shadow-[0_9px_0_0_#475569,0_20px_30px_0_rgba(0,0,0,0.6)] hover:translate-y-[-2px] hover:shadow-[0_11px_0_0_#475569,0_25px_35px_0_rgba(0,0,0,0.7)] active:translate-y-[4px] active:shadow-[0_5px_0_0_#475569,0_15px_20px_0_rgba(0,0,0,0.5)]'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="font-extrabold text-white text-base tracking-wide">Book Later</h3>
            <div className="relative z-20">
              <button
                onMouseEnter={() => setTooltip('later')}
                onMouseLeave={() => setTooltip(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  setTooltip(tooltip === 'later' ? null : 'later');
                }}
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black transition ${
                  bookingState.bookingType === 'later'
                    ? 'bg-cyan-800 text-white hover:bg-cyan-900'
                    : 'bg-slate-700 text-slate-100 hover:bg-slate-600'
                }`}
              >
                ?
              </button>
              {tooltip === 'later' && (
                <div className="absolute right-0 top-7 w-40 p-2 text-sm bg-slate-950 border-2 border-slate-500 rounded-md shadow-2xl text-white z-50">
                  Pay now and schedule lessons later from your dashboard.
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between">
            <span className={`font-bold text-xs uppercase tracking-wider transition ${
              bookingState.bookingType === 'later' ? 'text-cyan-100' : 'text-cyan-400'
            }`}>
              {bookingState.bookingType === 'later' ? '✓ Selected' : 'Schedule anytime'}
            </span>
          </div>
        </button>
      </div>

      {/* Info note at bottom with spacing */}
      <div className="bg-blue-900 border-2 border-blue-500 rounded-lg p-3 max-w-2xl mx-auto text-center text-sm text-blue-50 font-medium shadow-md">
        <span className="font-bold">Note:</span> Your hours are valid for 12 months from purchase date
      </div>
    </div>
  );
}
