'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect } from 'react';
import { useBooking } from '@/lib/contexts/BookingContext';
import MultiStepBookingLayout from '@/components/MultiStepBookingLayout';
import RegistrationForm from '@/components/RegistrationForm';

export default function RegistrationPage() {
  const router = useRouter();
  const params = useParams();
  const { bookingState } = useBooking();
  const { instructor } = bookingState;

  useEffect(() => {
    if (!instructor) {
      router.push('/book');
    }
  }, [instructor, router]);

  if (!instructor) {
    return null;
  }

  const validateForm = (): boolean => {
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
      alert('Please enter your name');
      return false;
    }
    if (!accountHolderEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountHolderEmail)) {
      alert('Please enter a valid email');
      return false;
    }
    if (!accountHolderPhone.trim()) {
      alert('Please enter your phone number');
      return false;
    }
    if (!accountHolderPassword || accountHolderPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return false;
    }
    if (accountHolderPassword !== accountHolderConfirmPassword) {
      alert('Passwords do not match');
      return false;
    }

    // Learner validation (if someone else)
    if (registrationType === 'someone-else') {
      if (!learnerName.trim()) {
        alert('Please enter the learner\'s name');
        return false;
      }
      if (!learnerRelationship) {
        alert('Please select your relationship to the learner');
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
    <MultiStepBookingLayout currentStep={bookingState.bookingType === 'now' ? 6 : 5}>
      <div className="space-y-6 text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white/95 mb-2">
            Create Your Account
          </h2>
          <p className="text-white/70">
            Register to manage your bookings and track your progress
          </p>
        </div>

        {/* Registration Form */}
        <RegistrationForm />

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-white/6">
          <button
            onClick={() => router.back()}
            type="button"
            className="flex-1 bg-white/5 text-white/90 px-8 py-4 rounded-lg font-semibold hover:bg-white/6 transition-colors border border-white/8"
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
