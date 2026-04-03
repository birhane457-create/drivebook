'use client';

import { useState, useEffect } from 'react';
import { useBooking } from '@/lib/contexts/BookingContext';
import PackageSelector from '@/components/PackageSelector';
import BookNowOrLater from '@/components/BookNowOrLater';
import BookingDetailsForm from '@/components/BookingDetailsForm';
import RegistrationForm from '@/components/RegistrationForm';
import BookingSummary from '@/components/BookingSummary';

type Step = 'package' | 'test-package' | 'book-type' | 'schedule' | 'register' | 'confirm';

interface SubdomainBookingWizardProps {
  instructor: {
    id: string;
    name: string;
    profileImage: string | null;
    hourlyRate: number;
    averageRating: number | null;
    totalReviews: number;
    offersTestPackage: boolean;
    testPackagePrice: number | null;
    testPackageDuration: number | null;
    testPackageIncludes: string[];
    lessonPackages?: Array<{
      id: string;
      name: string;
      durationMinutes: number;
      price: number;
      description: string;
      isActive: boolean;
    }>;
  };
  primary: string;
}

const STEP_LABELS: Record<Step, string> = {
  'package': 'Package',
  'test-package': 'Test Package',
  'book-type': 'When to Book',
  'schedule': 'Schedule',
  'register': 'Your Details',
  'confirm': 'Payment',
};

export default function SubdomainBookingWizard({ instructor, primary }: SubdomainBookingWizardProps) {
  const { setInstructor, bookingState, toggleTestPackage, updateBooking } = useBooking();
  const [step, setStep] = useState<Step>('package');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentOpened, setPaymentOpened] = useState(false);

  // Pre-populate instructor in context on mount
  useEffect(() => {
    setInstructor({
      id: instructor.id,
      name: instructor.name,
      profileImage: instructor.profileImage,
      hourlyRate: instructor.hourlyRate,
      averageRating: instructor.averageRating,
      totalReviews: instructor.totalReviews,
      offersTestPackage: instructor.offersTestPackage,
      testPackagePrice: instructor.testPackagePrice,
      testPackageDuration: instructor.testPackageDuration,
      testPackageIncludes: instructor.testPackageIncludes,
      lessonPackages: instructor.lessonPackages,
    });
  }, [instructor.id]);

  // Build visible steps based on instructor and booking type
  const getSteps = (): Step[] => {
    const steps: Step[] = ['package'];
    if (instructor.offersTestPackage) steps.push('test-package');
    steps.push('book-type');
    if (bookingState.bookingType === 'now') steps.push('schedule');
    steps.push('register');
    return steps;
  };

  const steps = getSteps();
  const currentIndex = steps.indexOf(step);
  const isLastStep = step === 'register';

  const handleNext = () => {
    setError(null);
    const idx = steps.indexOf(step);
    if (idx < steps.length - 1) {
      setStep(steps[idx + 1]);
    }
  };

  const handleBack = () => {
    setError(null);
    const idx = steps.indexOf(step);
    if (idx > 0) {
      setStep(steps[idx - 1]);
    }
  };

  const handlePackageContinue = () => {
    if (!bookingState.hours || bookingState.hours < 1) {
      setError('Please select a package');
      return;
    }
    handleNext();
  };

  const handleBookTypeContinue = () => {
    if (!bookingState.bookingType) {
      setError('Please select when you want to book');
      return;
    }
    // If bookingType changed, recalculate steps
    handleNext();
  };

  const handleScheduleContinue = () => {
    if (bookingState.scheduledBookings.length === 0) {
      setError('Please schedule at least one lesson');
      return;
    }
    handleNext();
  };

  const validateRegistration = (): boolean => {
    const { accountHolderName, accountHolderEmail, accountHolderPhone, accountHolderPassword, accountHolderConfirmPassword } = bookingState;
    if (!accountHolderName.trim()) { setError('Please enter your name'); return false; }
    if (!accountHolderEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountHolderEmail)) { setError('Please enter a valid email'); return false; }
    if (!accountHolderPhone.trim()) { setError('Please enter your phone number'); return false; }
    if (!accountHolderPassword || accountHolderPassword.length < 6) { setError('Password must be at least 6 characters'); return false; }
    if (accountHolderPassword !== accountHolderConfirmPassword) { setError('Passwords do not match'); return false; }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateRegistration()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/public/bookings/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructorId: instructor.id,
          packageType: bookingState.packageType,
          hours: bookingState.hours,
          includeTestPackage: bookingState.includeTestPackage,
          customPackageId: bookingState.customPackageId ?? undefined,
          bookingType: bookingState.bookingType || 'later',
          registrationType: bookingState.registrationType,
          accountHolderName: bookingState.accountHolderName,
          accountHolderEmail: bookingState.accountHolderEmail,
          accountHolderPhone: bookingState.accountHolderPhone,
          accountHolderPassword: bookingState.accountHolderPassword,
          learnerName: bookingState.learnerName,
          learnerPhone: bookingState.learnerPhone,
          learnerRelationship: bookingState.learnerRelationship,
          pricing: bookingState.pricing,
          scheduledBookings: bookingState.bookingType === 'now' ? bookingState.scheduledBookings : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        // Open payment in a new blank tab — subdomain page stays open underneath
        const host = window.location.host;
        const parts = host.split('.');
        const mainHost = parts.length > 1 && !parts[0].includes(':') ? parts.slice(1).join('.') : host;
        const baseUrl = `${window.location.protocol}//${mainHost}`;
        const fromParam = `?from=${encodeURIComponent(host)}`;

        const paymentUrl = data.transactionId
          ? `${baseUrl}/payment/wallet/${data.transactionId}${fromParam}`
          : `${baseUrl}/booking/${data.bookingId}/payment${fromParam}`;

        window.open(paymentUrl, '_blank', 'noopener');
        setPaymentOpened(true);
      } else {
        setError(data.error || 'Booking failed. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step progress indicator
  const ProgressBar = () => (
    <div className="flex items-center gap-1 mb-6">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center flex-1">
          <div className="flex flex-col items-center flex-1">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all"
              style={i <= currentIndex
                ? { backgroundColor: primary, borderColor: primary, color: '#fff' }
                : { borderColor: '#e5e7eb', color: '#9ca3af', backgroundColor: '#fff' }}
            >
              {i < currentIndex ? '✓' : i + 1}
            </div>
            <span className={`text-xs mt-1 hidden sm:block ${i === currentIndex ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>
              {STEP_LABELS[s]}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className="h-0.5 flex-1 mx-1 rounded" style={{ backgroundColor: i < currentIndex ? primary : '#e5e7eb' }} />
          )}
        </div>
      ))}
    </div>
  );

  // Payment opened in new tab — show a waiting screen
  if (paymentOpened) {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="text-5xl">🎉</div>
        <h3 className="text-xl font-bold text-gray-900">Payment page opened!</h3>
        <p className="text-gray-600 text-sm max-w-xs mx-auto">
          Complete your payment in the new tab. This page will stay open — you can come back here anytime.
        </p>
        <button
          type="button"
          onClick={() => { setPaymentOpened(false); setStep('package'); }}
          className="text-sm text-gray-500 underline hover:text-gray-700"
        >
          Start a new booking
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ProgressBar />

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Package step */}
      {step === 'package' && (
        <div className="space-y-4">
          <PackageSelector />
          <button
            type="button"
            onClick={handlePackageContinue}
            className="w-full py-3 rounded-xl text-white font-bold transition-all"
            style={{ backgroundColor: primary }}
          >
            Continue →
          </button>
        </div>
      )}

      {/* Test package step */}
      {step === 'test-package' && instructor.offersTestPackage && instructor.testPackagePrice && (
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-bold text-gray-900">Add Test Package?</h3>
            <p className="text-sm text-gray-500 mt-1">Prepare for your driving test with a specialised package</p>
          </div>

          <div className="border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-900">Test Package</p>
                <p className="text-sm text-gray-500">
                  {instructor.testPackageDuration
                    ? `${instructor.testPackageDuration >= 60 ? `${instructor.testPackageDuration / 60}hr` : `${instructor.testPackageDuration}min`} package`
                    : ''}
                </p>
              </div>
              <p className="text-2xl font-bold text-blue-600">${instructor.testPackagePrice}</p>
            </div>
            {instructor.testPackageIncludes.length > 0 && (
              <ul className="space-y-1">
                {instructor.testPackageIncludes.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="text-green-600">✓</span> {item}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-blue-700 bg-blue-50 rounded p-2">
              You can add the test package later from your dashboard if you change your mind
            </p>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={handleBack} className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold">
              ← Back
            </button>
            <button
              type="button"
              onClick={() => { if (bookingState.includeTestPackage) toggleTestPackage(); handleNext(); }}
              className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => { if (!bookingState.includeTestPackage) toggleTestPackage(); handleNext(); }}
              className="flex-1 py-3 rounded-xl text-white font-bold"
              style={{ backgroundColor: primary }}
            >
              Add →
            </button>
          </div>
        </div>
      )}

      {/* Book type step */}
      {step === 'book-type' && (
        <div className="space-y-4">
          <BookNowOrLater />
          <div className="flex gap-3">
            <button type="button" onClick={handleBack} className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold">
              ← Back
            </button>
            <button
              type="button"
              onClick={handleBookTypeContinue}
              disabled={!bookingState.bookingType}
              className="flex-1 py-3 rounded-xl text-white font-bold disabled:opacity-40"
              style={{ backgroundColor: primary }}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Schedule step */}
      {step === 'schedule' && (
        <div className="space-y-4">
          <BookingDetailsForm />
          <div className="flex gap-3">
            <button type="button" onClick={handleBack} className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold">
              ← Back
            </button>
            <button
              type="button"
              onClick={handleScheduleContinue}
              disabled={bookingState.scheduledBookings.length === 0}
              className="flex-1 py-3 rounded-xl text-white font-bold disabled:opacity-40"
              style={{ backgroundColor: primary }}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Register step */}
      {step === 'register' && (
        <div className="space-y-4">
          <RegistrationForm />
          <div className="flex gap-3">
            <button type="button" onClick={handleBack} className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold">
              ← Back
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-3 rounded-xl text-white font-bold disabled:opacity-40"
              style={{ backgroundColor: primary }}
            >
              {loading ? 'Processing...' : 'Continue to Payment →'}
            </button>
          </div>
        </div>
      )}

      {/* Booking summary sidebar (compact, always visible) */}
      {step !== 'package' && (
        <div className="border-t pt-4">
          <BookingSummary />
        </div>
      )}
    </div>
  );
}
