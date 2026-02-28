'use client';

import React from 'react';
import { useBooking } from '@/lib/contexts/BookingContext';

export default function TestPackageOption() {
  const { bookingState, toggleTestPackage } = useBooking();
  const { instructor, includeTestPackage } = bookingState;

  // Don't render if instructor doesn't offer test package
  if (!instructor?.offersTestPackage) {
    return null;
  }

  const price = instructor.testPackagePrice || 0;
  const duration = instructor.testPackageDuration || 0;
  const includes = instructor.testPackageIncludes || [];

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Test Package</h3>
      
      <button
        onClick={toggleTestPackage}
        className={`
          w-full p-6 rounded-lg border-2 text-left transition-all
          ${includeTestPackage 
            ? 'border-blue-600 bg-blue-50 shadow-md' 
            : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
          }
        `}
      >
        <div className="flex items-start gap-4">
          {/* Checkbox */}
          <div className={`
            w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5
            ${includeTestPackage ? 'border-blue-600 bg-blue-600' : 'border-gray-300'}
          `}>
            {includeTestPackage && (
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-gray-900">Driving Test Package</h4>
              <span className="text-xl font-bold text-blue-600">${price.toFixed(2)}</span>
            </div>

            <p className="text-sm text-gray-600 mb-3">
              {duration} minutes • Includes test day support
            </p>

            {/* What's Included */}
            {includes.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">What's included:</p>
                <ul className="space-y-1">
                  {includes.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </button>

      {/* Info Box */}
      <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-sm font-medium text-yellow-900 mb-1">Test Package Information</p>
            <p className="text-sm text-yellow-800">
              The test package is optional and can be added to any lesson package. 
              It provides dedicated support on your test day to help you feel confident and prepared.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
