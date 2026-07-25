'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useBooking } from '@/lib/contexts/BookingContext';
import MultiStepBookingLayout from '@/components/MultiStepBookingLayout';
import RegistrationForm from '@/components/RegistrationForm';

export default function RegistrationPage() {
  const router = useRouter();
  const params = useParams();
  const { bookingState } = useBooking();
  const { instructor } = bookingState;
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!instructor) {
      router.push('/book');
    }
  }, [instructor, router]);

  if (!instructor) {
    return null;
  }

  const validateForm = (): boolean => {
    setValidationError(null);
    const {
      accountHolderName,
      accountHolderEmail,
      accountHolderPhone,
      accountHolderPassword,
      accountHolderConfirmPassword,
      registrationType,
      learnerName,
      learnerRelationship
    } = bookingState;

    // Account holder validation
    if (!accountHolderName.trim()) {
      setValidationError('Please enter your name');
      return false;
    }
    if (!accountHolderEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountHolderEmail)) {
      setValidationError('Please enter a valid email address');
      return false;
    }
    if (!accountHolderPhone.trim()) {
      setValidationError('Please enter your phone number');
      return false;
    }
    if (!accountHolderPassword || accountHolderPassword.length < 6) {
      setValidationError('Password must be at least 6 characters');
      return false;
    }
    if (accountHolderPassword !== accountHolderConfirmPassword) {
      setValidationError('Passwords do not match');
      return false;
    }

    // Learner validation (if booking for someone else)
    if (registrationType === 'someone-else') {
      if (!learnerName.trim()) {
        setValidationError("Please enter the learner's name");
        return false;
      }
      if (!learnerRelationship) {
        setValidationError('Please select your relationship to the learner');
        return false;
      }
    }

    return true;
  };

  const handleContinue = () => {
    if (validateForm()) {
      router.push(`/book/${params.instructorId}/payment`);
    }
  };

  return (
    <MultiStepBookingLayout currentStep={bookingState.bookingType === 'now' ? 5 : 4}>
      <div className="space-y-6 text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white/95 mb-2">
            Create Your Account
          </h2>
          <p className="text-white/85">
            Register to manage your bookings and track your progress
          </p>
        </div>

        {/* Registration Form */}
        <RegistrationForm />

        {/* Inline validation error */}
        {validationError && (
          <div className="flex items-start gap-3 bg-red-900/20 border border-red-500/30 rounded-xl px-4 py-3">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-red-200">{validationError}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-white/15">
          <button
            onClick={() => router.back()}
            type="button"
            className="flex-1 bg-white/8 text-white px-8 py-4 rounded-lg font-semibold hover:bg-white/10 transition-colors border border-white/20"
          >
            ← Back
          </button>
          <button
            onClick={handleContinue}
            type="button"
            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-lg font-semibold hover:from-purple-500 hover:to-pink-500 transition-colors"
          >
            Continue to Payment →
          </button>
        </div>
      </div>
    </MultiStepBookingLayout>
  );
}
