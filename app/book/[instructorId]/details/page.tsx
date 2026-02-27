'use client';

import { useRouter } from 'next/navigation';
import { useBooking } from '@/lib/contexts/BookingContext';
import MultiStepBookingLayout from '@/components/MultiStepBookingLayout';
import ClientDetailsForm from '@/components/ClientDetailsForm';

export default function ClientDetailsPage() {
  const router = useRouter();
  const { bookingState } = useBooking();

  // Redirect if no instructor selected
  if (!bookingState.instructor) {
    router.push('/book');
    return null;
  }

  const handleBack = () => {
    router.back();
  };

  const validateForm = (): boolean => {
    const { clientName, clientEmail, clientPhone, pickupAddress, createAccount, password, confirmPassword } = bookingState;

    // Basic validation
    if (!clientName.trim() || clientName.trim().length < 2) {
      alert('Please enter a valid name');
      return false;
    }

    if (!clientEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
      alert('Please enter a valid email address');
      return false;
    }

    if (!clientPhone.trim() || !/^[\d\s\-\+\(\)]+$/.test(clientPhone)) {
      alert('Please enter a valid phone number');
      return false;
    }

    if (!pickupAddress.trim()) {
      alert('Please enter a pickup address');
      return false;
    }

    // Account creation validation
    if (createAccount) {
      if (!password || password.length < 8) {
        alert('Password must be at least 8 characters');
        return false;
      }

      if (password !== confirmPassword) {
        alert('Passwords do not match');
        return false;
      }
    }

    return true;
  };

  const handleContinue = () => {
    if (validateForm()) {
      router.push(`/book/${bookingState.instructor!.id}/payment`);
    }
  };

  return (
    <MultiStepBookingLayout currentStep={3}>
      <div className="space-y-8">
        {/* Client Details Form */}
        <ClientDetailsForm />

        {/* Navigation Buttons */}
        <div className="flex gap-4 pt-6 border-t">
          <button
            onClick={handleBack}
            className="flex-1 px-6 py-3 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            ← Back
          </button>
          <button
            onClick={handleContinue}
            className="flex-1 px-6 py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Continue to Payment →
          </button>
        </div>
      </div>
    </MultiStepBookingLayout>
  );
}
