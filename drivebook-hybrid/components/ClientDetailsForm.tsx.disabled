'use client';

import React, { useState } from 'react';
import { useBooking } from '@/lib/contexts/BookingContext';

interface ValidationErrors {
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  pickupAddress?: string;
  password?: string;
  confirmPassword?: string;
}

export default function ClientDetailsForm() {
  const { bookingState, setClientDetails } = useBooking();
  const [errors, setErrors] = useState<ValidationErrors>({});

  const validateField = (field: string, value: string): string | undefined => {
    switch (field) {
      case 'clientName':
        if (!value.trim()) return 'Name is required';
        if (value.trim().length < 2) return 'Name must be at least 2 characters';
        break;
      case 'clientEmail':
        if (!value.trim()) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email format';
        break;
      case 'clientPhone':
        if (!value.trim()) return 'Phone number is required';
        if (!/^[\d\s\-\+\(\)]+$/.test(value)) return 'Invalid phone number format';
        break;
      case 'pickupAddress':
        if (!value.trim()) return 'Pickup address is required';
        break;
      case 'password':
        if (bookingState.createAccount && !value) return 'Password is required';
        if (bookingState.createAccount && value.length < 8) return 'Password must be at least 8 characters';
        break;
      case 'confirmPassword':
        if (bookingState.createAccount && value !== bookingState.password) return 'Passwords do not match';
        break;
    }
    return undefined;
  };

  const handleChange = (field: keyof typeof bookingState, value: string | boolean) => {
    setClientDetails({ [field]: value });
    
    // Clear error for this field
    if (typeof value === 'string') {
      const error = validateField(field, value);
      setErrors(prev => ({ ...prev, [field]: error }));
    }
  };

  const handleBlur = (field: string) => {
    const value = bookingState[field as keyof typeof bookingState];
    if (typeof value === 'string') {
      const error = validateField(field, value);
      setErrors(prev => ({ ...prev, [field]: error }));
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Your Details</h3>

      {/* Name */}
      <div>
        <label htmlFor="clientName" className="block text-sm font-medium text-gray-700 mb-1">
          Full Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="clientName"
          value={bookingState.clientName}
          onChange={(e) => handleChange('clientName', e.target.value)}
          onBlur={() => handleBlur('clientName')}
          className={`
            w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            ${errors.clientName ? 'border-red-500' : 'border-gray-300'}
          `}
          placeholder="John Smith"
        />
        {errors.clientName && (
          <p className="mt-1 text-sm text-red-600">{errors.clientName}</p>
        )}
      </div>

      {/* Email */}
      <div>
        <label htmlFor="clientEmail" className="block text-sm font-medium text-gray-700 mb-1">
          Email Address <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          id="clientEmail"
          value={bookingState.clientEmail}
          onChange={(e) => handleChange('clientEmail', e.target.value)}
          onBlur={() => handleBlur('clientEmail')}
          className={`
            w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            ${errors.clientEmail ? 'border-red-500' : 'border-gray-300'}
          `}
          placeholder="john@example.com"
        />
        {errors.clientEmail && (
          <p className="mt-1 text-sm text-red-600">{errors.clientEmail}</p>
        )}
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="clientPhone" className="block text-sm font-medium text-gray-700 mb-1">
          Phone Number <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          id="clientPhone"
          value={bookingState.clientPhone}
          onChange={(e) => handleChange('clientPhone', e.target.value)}
          onBlur={() => handleBlur('clientPhone')}
          className={`
            w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            ${errors.clientPhone ? 'border-red-500' : 'border-gray-300'}
          `}
          placeholder="+61 400 000 000"
        />
        {errors.clientPhone && (
          <p className="mt-1 text-sm text-red-600">{errors.clientPhone}</p>
        )}
      </div>

      {/* Pickup Address */}
      <div>
        <label htmlFor="pickupAddress" className="block text-sm font-medium text-gray-700 mb-1">
          Pickup Address <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="pickupAddress"
          value={bookingState.pickupAddress}
          onChange={(e) => handleChange('pickupAddress', e.target.value)}
          onBlur={() => handleBlur('pickupAddress')}
          className={`
            w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            ${errors.pickupAddress ? 'border-red-500' : 'border-gray-300'}
          `}
          placeholder="123 Main St, Suburb, State, Postcode"
        />
        {errors.pickupAddress && (
          <p className="mt-1 text-sm text-red-600">{errors.pickupAddress}</p>
        )}
        <p className="mt-1 text-sm text-gray-500">
          Where should your instructor pick you up for lessons?
        </p>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
          Additional Notes (Optional)
        </label>
        <textarea
          id="notes"
          value={bookingState.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Any special requirements or preferences..."
        />
      </div>

      {/* Create Account */}
      <div className="border-t pt-6">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="createAccount"
            checked={bookingState.createAccount}
            onChange={(e) => handleChange('createAccount', e.target.checked)}
            className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5"
          />
          <div className="flex-1">
            <label htmlFor="createAccount" className="block text-sm font-medium text-gray-900 cursor-pointer">
              Create an account to manage your bookings
            </label>
            <p className="text-sm text-gray-500 mt-1">
              Track your lessons, view history, and manage your schedule easily
            </p>
          </div>
        </div>

        {/* Password Fields (Conditional) */}
        {bookingState.createAccount && (
          <div className="mt-4 space-y-4 pl-8">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                id="password"
                value={bookingState.password}
                onChange={(e) => handleChange('password', e.target.value)}
                onBlur={() => handleBlur('password')}
                className={`
                  w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  ${errors.password ? 'border-red-500' : 'border-gray-300'}
                `}
                placeholder="Minimum 8 characters"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={bookingState.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                onBlur={() => handleBlur('confirmPassword')}
                className={`
                  w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  ${errors.confirmPassword ? 'border-red-500' : 'border-gray-300'}
                `}
                placeholder="Re-enter your password"
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { type ValidationErrors };
