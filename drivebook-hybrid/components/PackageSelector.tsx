'use client';

import React, { useState } from 'react';
import { useBooking } from '@/lib/contexts/BookingContext';
import { HOUR_PACKAGES, PackageType } from '@/lib/config/packages';

function getDiscountPercentage(hours: number): number {
  if (hours >= 15) return 12;
  if (hours >= 10) return 10;
  if (hours >= 6) return 5;
  return 0;
}

export default function PackageSelector() {
  const { bookingState, setPackage } = useBooking();
  const [customHours, setCustomHours] = useState(bookingState.hours);

  const hourlyRate = bookingState.instructor?.hourlyRate || 0;

  const handlePackageSelect = (type: PackageType) => {
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

  // Generate dropdown options (1-50 hours)
  const generateHourOptions = () => {
    const options = [];
    for (let i = 1; i <= 50; i++) {
      const discount = getDiscountPercentage(i);
      const basePrice = hourlyRate * i;
      const finalPrice = basePrice * (1 - discount / 100);
      const savings = basePrice - finalPrice;
      
      options.push({
        value: i,
        label: discount > 0 
          ? `${i} hour${i > 1 ? 's' : ''} - $${finalPrice.toFixed(0)} (${discount}% discount - Save $${savings.toFixed(0)})`
          : `${i} hour${i > 1 ? 's' : ''} - $${finalPrice.toFixed(0)} (No discount)`
      });
    }
    return options;
  };

  const predefinedPackages: Array<{ type: PackageType; hours: number; discount: number }> = [
    { type: 'PACKAGE_6', hours: 6, discount: 5 },
    { type: 'PACKAGE_10', hours: 10, discount: 10 },
    { type: 'PACKAGE_15', hours: 15, discount: 12 }
  ];

  return (
    <div className="space-y-8">
      <h3 className="text-lg font-semibold text-gray-900">Select Your Package</h3>
      
      {/* Predefined Package Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {predefinedPackages.map(({ type, hours, discount }) => {
          const isSelected = bookingState.packageType === type;
          const basePrice = hourlyRate * hours;
          const finalPrice = basePrice * (1 - discount / 100);
          const savings = basePrice - finalPrice;

          return (
            <button
              key={type}
              onClick={() => handlePackageSelect(type)}
              className={`
                relative p-6 rounded-lg border-2 text-left transition-all
                ${isSelected 
                  ? 'border-blue-600 bg-blue-50 shadow-md' 
                  : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
                }
              `}
            >
              {/* Discount Badge */}
              <div className="absolute top-3 right-3 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">
                Save {discount}%
              </div>

              {/* Radio Button */}
              <div className={`
                w-5 h-5 rounded-full border-2 flex items-center justify-center mb-3
                ${isSelected ? 'border-blue-600' : 'border-gray-300'}
              `}>
                {isSelected && (
                  <div className="w-3 h-3 rounded-full bg-blue-600" />
                )}
              </div>

              <h4 className="font-semibold text-gray-900 mb-2">{hours} Hour Package</h4>
              <p className="text-sm text-gray-600 mb-3">{hours} hours of lessons</p>
              
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm text-gray-400 line-through">
                    ${basePrice.toFixed(2)}
                  </span>
                  <span className="text-2xl font-bold text-blue-600">
                    ${finalPrice.toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Save ${savings.toFixed(2)} • ${(finalPrice / hours).toFixed(2)}/hour
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white text-gray-500">Or choose custom hours</span>
        </div>
      </div>

      {/* Custom Hours Dropdown */}
      <div className="max-w-md mx-auto">
        <label htmlFor="customHours" className="block text-sm font-medium text-gray-700 mb-2">
          Select Hours:
        </label>
        <select
          id="customHours"
          value={bookingState.packageType === 'CUSTOM' ? customHours : ''}
          onChange={(e) => handleCustomHoursChange(parseInt(e.target.value))}
          onClick={() => {
            if (bookingState.packageType !== 'CUSTOM') {
              handlePackageSelect('CUSTOM');
            }
          }}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
        >
          <option value="">Choose custom hours...</option>
          {generateHourOptions().map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        
        {bookingState.packageType === 'CUSTOM' && customHours > 0 && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-900">
              <span className="font-semibold">Selected:</span> {customHours} hour{customHours > 1 ? 's' : ''} for ${(hourlyRate * customHours * (1 - getDiscountPercentage(customHours) / 100)).toFixed(2)}
            </p>
          </div>
        )}
      </div>

      {/* Package Benefits */}
      <div className="bg-blue-50 rounded-lg p-4 mt-6">
        <h4 className="font-semibold text-blue-900 mb-2">Package Benefits</h4>
        <ul className="space-y-1 text-sm text-blue-800">
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Flexible scheduling - book lessons at your convenience
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Bigger packages = bigger savings (up to 12% off)
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            All hours paid upfront, schedule as you go
          </li>
        </ul>
      </div>
    </div>
  );
}
