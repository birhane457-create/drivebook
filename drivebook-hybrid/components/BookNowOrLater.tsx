'use client';

import React from 'react';
import { useBooking } from '@/lib/contexts/BookingContext';

export default function BookNowOrLater() {
  const { bookingState, updateBooking } = useBooking();

  const handleSelection = (type: 'now' | 'later') => {
    updateBooking({ bookingType: type });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          When would you like to schedule your lessons?
        </h2>
        <p className="text-gray-600">
          You can book specific times now or schedule them later from your dashboard
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* Book Now Option */}
        <button
          onClick={() => handleSelection('now')}
          className={`
            relative p-8 rounded-xl border-2 text-left transition-all
            ${bookingState.bookingType === 'now'
              ? 'border-blue-600 bg-blue-50 shadow-lg'
              : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
            }
          `}
        >
          {/* Radio Button */}
          <div className={`
            absolute top-6 right-6 w-6 h-6 rounded-full border-2 flex items-center justify-center
            ${bookingState.bookingType === 'now' ? 'border-blue-600' : 'border-gray-300'}
          `}>
            {bookingState.bookingType === 'now' && (
              <div className="w-3.5 h-3.5 rounded-full bg-blue-600" />
            )}
          </div>

          {/* Icon */}
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>

          <h3 className="text-xl font-semibold text-gray-900 mb-2">Book Now</h3>
          <p className="text-gray-600 mb-4">
            Schedule your lessons immediately with real-time availability
          </p>

          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>See available time slots</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Book multiple lessons at once</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Get instant confirmation</span>
            </li>
          </ul>
        </button>

        {/* Book Later Option */}
        <button
          onClick={() => handleSelection('later')}
          className={`
            relative p-8 rounded-xl border-2 text-left transition-all
            ${bookingState.bookingType === 'later'
              ? 'border-blue-600 bg-blue-50 shadow-lg'
              : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
            }
          `}
        >
          {/* Radio Button */}
          <div className={`
            absolute top-6 right-6 w-6 h-6 rounded-full border-2 flex items-center justify-center
            ${bookingState.bookingType === 'later' ? 'border-blue-600' : 'border-gray-300'}
          `}>
            {bookingState.bookingType === 'later' && (
              <div className="w-3.5 h-3.5 rounded-full bg-blue-600" />
            )}
          </div>

          {/* Icon */}
          <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h3 className="text-xl font-semibold text-gray-900 mb-2">Book Later</h3>
          <p className="text-gray-600 mb-4">
            Complete payment now, schedule lessons at your convenience
          </p>

          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Flexible scheduling</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Schedule from dashboard</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Coordinate with instructor</span>
            </li>
          </ul>
        </button>
      </div>

      <div className="bg-blue-50 rounded-lg p-4 max-w-4xl mx-auto mt-6">
        <p className="text-sm text-blue-900 text-center">
          <span className="font-semibold">Note:</span> Your hours are valid for 12 months from purchase date
        </p>
      </div>
    </div>
  );
}
