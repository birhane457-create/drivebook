'use client';

import React, { useState } from 'react';
import { useBooking } from '@/lib/contexts/BookingContext';
import { HOUR_PACKAGES, PackageType } from '@/lib/config/packages';

export default function PackageSelector() {
  const { bookingState, setPackage } = useBooking();
  const [customHours, setCustomHours] = useState(bookingState.hours);

  const hourlyRate = bookingState.instructor?.hourlyRate || 0;
  const s = bookingState.platformSettings;

  const getDiscountForHours = (hours: number): number => {
    if (hours >= 15) return s.package15Discount;
    if (hours >= 10) return s.package10Discount;
    if (hours >= 6) return s.package6Discount;
    return 0;
  };

  const handlePackageSelect = (type: PackageType) => {
    // Selecting a standard package clears any instructor custom package selection
    if (type === 'CUSTOM') {
      setPackage(type, customHours);
    } else {
      setPackage(type, HOUR_PACKAGES[type].hours);
    }
  };

  const handleCustomHoursChange = (hours: number) => {
    setCustomHours(hours);
    setPackage('CUSTOM', hours);
  };

  const predefinedPackages: Array<{ type: PackageType; hours: number; discount: number }> = [
    { type: 'PACKAGE_6', hours: 6, discount: s.package6Discount },
    { type: 'PACKAGE_10', hours: 10, discount: s.package10Discount },
    { type: 'PACKAGE_15', hours: 15, discount: s.package15Discount },
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-black text-gray-900 dark:text-white bg-gradient-to-r from-gray-50 to-transparent dark:from-gray-900 dark:to-transparent px-2 py-1 rounded">Select Your Package</h3>

      {/* Standard hour packages — radio select */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {predefinedPackages.map(({ type, hours, discount }) => {
          const isSelected = bookingState.packageType === type;
          const basePrice = hourlyRate * hours;
          const finalPrice = basePrice * (1 - discount / 100);
          const savings = basePrice - finalPrice;

          return (
            <button
              key={type}
              onClick={() => handlePackageSelect(type)}
              className={`relative p-4 rounded-lg border-2 text-left transition-all flex flex-col justify-between
                ${isSelected ? 'border-blue-600 bg-blue-50 shadow-md dark:bg-blue-900 dark:border-blue-300' : 'border-gray-300 hover:border-blue-400 dark:border-gray-500 dark:hover:border-blue-400 dark:bg-gray-800'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'border-blue-600 dark:border-blue-300' : 'border-gray-400 dark:border-gray-500'}`}>
                    {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-300" />}
                  </div>
                  <h4 className={`font-bold text-base ${isSelected ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-100'}`}>{hours} hrs</h4>
                </div>
                <div className="text-right">
                  <div className={`text-sm line-through ${isSelected ? 'text-gray-500 dark:text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>${basePrice.toFixed(0)}</div>
                  <div className={`font-bold text-lg ${isSelected ? 'text-blue-600 dark:text-blue-300' : 'text-blue-600 dark:text-blue-400'}`}>${finalPrice.toFixed(0)}</div>
                </div>
              </div>
              <div className={`mt-3 text-sm flex justify-between ${isSelected ? 'text-gray-600 dark:text-gray-300' : 'text-gray-600 dark:text-gray-300'}`}>
                <span className="font-medium">${(finalPrice / hours).toFixed(2)}/hr</span>
                <span className={`font-semibold ${isSelected ? 'text-green-600 dark:text-green-400' : 'text-green-600 dark:text-green-400'}`}>Save ${savings.toFixed(0)}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="max-w-sm">
        <label htmlFor="customHours" className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2 uppercase tracking-wide">
          Or choose custom hours
        </label>
        <select
          id="customHours"
          value={customHours}
          onChange={(e) => handleCustomHoursChange(parseInt(e.target.value))}
          onClick={() => { if (bookingState.packageType !== 'CUSTOM') handlePackageSelect('CUSTOM'); }}
          className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium"
        >
          <option value="">Choose hours...</option>
          {Array.from({ length: 50 }, (_, i) => i + 1).map(i => {
            const discount = getDiscountForHours(i);
            const price = hourlyRate * i * (1 - discount / 100);
            return (
              <option key={i} value={i} className="text-gray-900">
                {i} hr{i > 1 ? 's' : ''} — ${price.toFixed(0)}{discount > 0 ? ` (${discount}% off)` : ''}
              </option>
            );
          })}
        </select>
      </div>


      {/* Package Benefits */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-100 dark:border-blue-900">
        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 text-sm">Package Benefits</h4>
        <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
            Flexible scheduling — book lessons at your convenience
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
            Bigger packages = bigger savings (up to {s.package15Discount}% off)
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-yellow-500 dark:text-yellow-400 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
            Rate &amp; discount locked at purchase
          </li>
        </ul>
      </div>
    </div>
  );
}
