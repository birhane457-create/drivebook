'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useBooking } from '@/lib/contexts/BookingContext';
import { AlertCircle } from 'lucide-react';

export default function RegistrationForm() {
  const { data: session } = useSession();
  const { bookingState, updateBooking } = useBooking();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [emailCheckStatus, setEmailCheckStatus] = useState<'idle' | 'checking' | 'exists' | 'available'>('idle');
  const [showEmailWarning, setShowEmailWarning] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);

  // Auto-fill for logged-in clients
  useEffect(() => {
    if (session?.user?.email) {
      setIsLoggedIn(true);
      // Fetch client data and pre-fill
      fetch('/api/client/profile')
        .then(res => res.json())
        .then(data => {
          if (data.user) {
            updateBooking({
              accountHolderName: data.user.name || '',
              accountHolderEmail: data.user.email || '',
              accountHolderPhone: data.user.phone || '',
              // Skip password fields for logged-in users
              accountHolderPassword: 'existing-account',
              accountHolderConfirmPassword: 'existing-account'
            });
          }
        })
        .catch(err => console.error('Error loading profile:', err));
    }
  }, [session]);

  // Check if email already exists (debounced)
  useEffect(() => {
    if (isLoggedIn) return; // Skip check for logged-in users
    
    const email = bookingState.accountHolderEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailCheckStatus('idle');
      return;
    }

    setCheckingEmail(true);
    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-email?email=${encodeURIComponent(email)}`);
        const data = await res.json();
        
        if (data.exists) {
          setEmailCheckStatus('exists');
          setShowEmailWarning(true);
        } else {
          setEmailCheckStatus('available');
          setShowEmailWarning(false);
        }
      } catch (err) {
        console.error('Error checking email:', err);
        setEmailCheckStatus('idle');
      } finally {
        setCheckingEmail(false);
      }
    }, 800); // Debounce 800ms

    return () => {
      clearTimeout(timeoutId);
      setCheckingEmail(false);
    };
  }, [bookingState.accountHolderEmail, isLoggedIn]);

  const handleRegistrationTypeChange = (type: 'myself' | 'someone-else') => {
    updateBooking({ registrationType: type });
    setErrors({});
  };

  const handleAccountHolderChange = (field: string, value: string) => {
    updateBooking({ [field]: value });
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    
    // Reset email warning when user changes email
    if (field === 'accountHolderEmail') {
      setShowEmailWarning(false);
      setEmailCheckStatus('idle');
    }
  };

  const handleLearnerChange = (field: string, value: string) => {
    updateBooking({ [field]: value });
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Account holder validation
    if (!bookingState.accountHolderName.trim()) {
      newErrors.accountHolderName = 'Name is required';
    }
    if (!bookingState.accountHolderEmail.trim()) {
      newErrors.accountHolderEmail = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bookingState.accountHolderEmail)) {
      newErrors.accountHolderEmail = 'Invalid email format';
    }
    if (!bookingState.accountHolderPhone.trim()) {
      newErrors.accountHolderPhone = 'Phone is required';
    }
    
    // Skip password validation for logged-in users
    if (!isLoggedIn) {
      if (!bookingState.accountHolderPassword) {
        newErrors.accountHolderPassword = 'Password is required';
      } else if (bookingState.accountHolderPassword.length < 6) {
        newErrors.accountHolderPassword = 'Password must be at least 6 characters';
      }
      if (bookingState.accountHolderPassword !== bookingState.accountHolderConfirmPassword) {
        newErrors.accountHolderConfirmPassword = 'Passwords do not match';
      }
    }

    // Learner validation (if someone else)
    if (bookingState.registrationType === 'someone-else') {
      if (!bookingState.learnerName.trim()) {
        newErrors.learnerName = 'Learner name is required';
      }
      if (!bookingState.learnerRelationship) {
        newErrors.learnerRelationship = 'Relationship is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {isLoggedIn ? 'Confirm Your Details' : 'Create Your Account'}
        </h2>
        <p className="text-gray-600">
          {isLoggedIn 
            ? 'Your information has been pre-filled from your account'
            : 'Register to manage your bookings and track your progress'
          }
        </p>
      </div>

      {isLoggedIn && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-800">
            ✓ You're logged in! Your details are pre-filled. You can edit them if needed.
          </p>
        </div>
      )}

      {/* Who is this for? */}
      <div className="space-y-4">
        <label className="block text-lg font-semibold text-gray-900">
          Who are you registering for?
        </label>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => handleRegistrationTypeChange('myself')}
            className={`
              w-full flex items-start gap-4 p-5 border-2 rounded-xl text-left transition-all
              ${bookingState.registrationType === 'myself'
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
              }
            `}
          >
            <div className={`
              w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5
              ${bookingState.registrationType === 'myself' ? 'border-blue-600' : 'border-gray-300'}
            `}>
              {bookingState.registrationType === 'myself' && (
                <div className="w-3.5 h-3.5 rounded-full bg-blue-600" />
              )}
            </div>
            <div>
              <div className="font-semibold text-gray-900 mb-1">Myself</div>
              <div className="text-sm text-gray-600">I am the learner</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleRegistrationTypeChange('someone-else')}
            className={`
              w-full flex items-start gap-4 p-5 border-2 rounded-xl text-left transition-all
              ${bookingState.registrationType === 'someone-else'
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
              }
            `}
          >
            <div className={`
              w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5
              ${bookingState.registrationType === 'someone-else' ? 'border-blue-600' : 'border-gray-300'}
            `}>
              {bookingState.registrationType === 'someone-else' && (
                <div className="w-3.5 h-3.5 rounded-full bg-blue-600" />
              )}
            </div>
            <div>
              <div className="font-semibold text-gray-900 mb-1">Someone else</div>
              <div className="text-sm text-gray-600">
                e.g., child, partner, grandchild, parent, friend
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Account Holder Details */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {bookingState.registrationType === 'myself' ? 'Your Details' : 'Your Details (Account Holder)'}
        </h3>

        <div>
          <label htmlFor="accountHolderName" className="block text-sm font-medium text-gray-700 mb-1">
            Full Name *
          </label>
          <input
            type="text"
            id="accountHolderName"
            value={bookingState.accountHolderName}
            onChange={(e) => handleAccountHolderChange('accountHolderName', e.target.value)}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.accountHolderName ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter your full name"
          />
          {errors.accountHolderName && (
            <p className="mt-1 text-sm text-red-600">{errors.accountHolderName}</p>
          )}
        </div>

        <div>
          <label htmlFor="accountHolderEmail" className="block text-sm font-medium text-gray-700 mb-1">
            Email *
          </label>
          <input
            type="email"
            id="accountHolderEmail"
            value={bookingState.accountHolderEmail}
            onChange={(e) => handleAccountHolderChange('accountHolderEmail', e.target.value)}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.accountHolderEmail ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="your.email@example.com"
            disabled={isLoggedIn}
          />
          {checkingEmail && (
            <p className="mt-1 text-sm text-gray-500">Checking email...</p>
          )}
          {emailCheckStatus === 'available' && !checkingEmail && (
            <p className="mt-1 text-sm text-green-600">✓ Email is available</p>
          )}
          {errors.accountHolderEmail && (
            <p className="mt-1 text-sm text-red-600">{errors.accountHolderEmail}</p>
          )}
        </div>

        {/* Email Already Exists Warning */}
        {showEmailWarning && emailCheckStatus === 'exists' && !isLoggedIn && (
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-yellow-900 mb-2">
                  This email already has an account
                </h4>
                <p className="text-sm text-yellow-800 mb-3">
                  An account with <strong>{bookingState.accountHolderEmail}</strong> already exists in our system.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <a
                    href="/login"
                    className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-semibold text-center transition-colors"
                  >
                    Login to Existing Account
                  </a>
                  <button
                    type="button"
                    onClick={() => setShowEmailWarning(false)}
                    className="flex-1 bg-white hover:bg-gray-50 text-yellow-900 px-4 py-2 rounded-lg font-semibold border-2 border-yellow-400 transition-colors"
                  >
                    Continue Anyway
                  </button>
                </div>
                <p className="text-xs text-yellow-700 mt-2">
                  ⚠️ If you continue, you won't be able to create a new account with this email. Please use a different email or login to your existing account.
                </p>
              </div>
            </div>
          </div>
        )}

        <div>
          <label htmlFor="accountHolderPhone" className="block text-sm font-medium text-gray-700 mb-1">
            Phone *
          </label>
          <input
            type="tel"
            id="accountHolderPhone"
            value={bookingState.accountHolderPhone}
            onChange={(e) => handleAccountHolderChange('accountHolderPhone', e.target.value)}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.accountHolderPhone ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="0400 000 000"
          />
          {errors.accountHolderPhone && (
            <p className="mt-1 text-sm text-red-600">{errors.accountHolderPhone}</p>
          )}
        </div>

        <div>
          <label htmlFor="accountHolderPassword" className="block text-sm font-medium text-gray-700 mb-1">
            Password *
          </label>
          <input
            type="password"
            id="accountHolderPassword"
            value={bookingState.accountHolderPassword}
            onChange={(e) => handleAccountHolderChange('accountHolderPassword', e.target.value)}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.accountHolderPassword ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="At least 6 characters"
          />
          {errors.accountHolderPassword && (
            <p className="mt-1 text-sm text-red-600">{errors.accountHolderPassword}</p>
          )}
        </div>

        <div>
          <label htmlFor="accountHolderConfirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
            Confirm Password *
          </label>
          <input
            type="password"
            id="accountHolderConfirmPassword"
            value={bookingState.accountHolderConfirmPassword}
            onChange={(e) => handleAccountHolderChange('accountHolderConfirmPassword', e.target.value)}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.accountHolderConfirmPassword ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Re-enter your password"
          />
          {errors.accountHolderConfirmPassword && (
            <p className="mt-1 text-sm text-red-600">{errors.accountHolderConfirmPassword}</p>
          )}
        </div>
      </div>

      {/* Learner Details (if someone else) */}
      {bookingState.registrationType === 'someone-else' && (
        <div className="space-y-4 border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-900">Learner's Details</h3>

          <div>
            <label htmlFor="learnerName" className="block text-sm font-medium text-gray-700 mb-1">
              Learner's Full Name *
            </label>
            <input
              type="text"
              id="learnerName"
              value={bookingState.learnerName}
              onChange={(e) => handleLearnerChange('learnerName', e.target.value)}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.learnerName ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter learner's full name"
            />
            {errors.learnerName && (
              <p className="mt-1 text-sm text-red-600">{errors.learnerName}</p>
            )}
          </div>

          <div>
            <label htmlFor="learnerPhone" className="block text-sm font-medium text-gray-700 mb-1">
              Learner's Phone (Optional)
            </label>
            <input
              type="tel"
              id="learnerPhone"
              value={bookingState.learnerPhone}
              onChange={(e) => handleLearnerChange('learnerPhone', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0400 000 000"
            />
          </div>

          <div>
            <label htmlFor="learnerRelationship" className="block text-sm font-medium text-gray-700 mb-1">
              Relationship *
            </label>
            <select
              id="learnerRelationship"
              value={bookingState.learnerRelationship}
              onChange={(e) => handleLearnerChange('learnerRelationship', e.target.value)}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.learnerRelationship ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select relationship</option>
              <option value="child">Child</option>
              <option value="partner">Partner</option>
              <option value="grandchild">Grandchild</option>
              <option value="parent">Parent</option>
              <option value="friend">Friend</option>
              <option value="other">Other</option>
            </select>
            {errors.learnerRelationship && (
              <p className="mt-1 text-sm text-red-600">{errors.learnerRelationship}</p>
            )}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 rounded-lg p-4">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Account Access</p>
            <p>
              {bookingState.registrationType === 'myself'
                ? 'You will be able to login and manage your bookings anytime from your dashboard.'
                : 'As the account holder, you will manage all bookings and payments. The learner does not need login credentials.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
