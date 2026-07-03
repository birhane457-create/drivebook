'use client';

import { useState, useEffect, useCallback } from 'react';
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
    allowedDurations?: number[];
  };
  primary: string;
  /** Pre-selected package from clicking a pricing row — skips the package selection step */
  initialPackage?: { packageType: string; hours: number; label: string };
}

const STEP_LABELS: Record<Step, string> = {
  'package': 'Package',
  'test-package': 'Test Pack',
  'book-type': 'When to Book',
  'schedule': 'Schedule',
  'register': 'Your Details',
  'confirm': 'Payment',
};

export default function SubdomainBookingWizard({ instructor, primary, initialPackage }: SubdomainBookingWizardProps) {
  const { setInstructor, setPackage, bookingState, updateBooking } = useBooking();
  // If a package was pre-selected from a pricing row, start after the package step
  const firstStep: Step = initialPackage
    ? (instructor.offersTestPackage ? 'test-package' : 'book-type')
    : 'package';
  const [step, setStep] = useState<Step>(firstStep);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceUpdated, setPriceUpdated] = useState(false);
  const [paymentOpened, setPaymentOpened] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  // Pre-populate instructor in context on mount.
  // If a package was pre-selected from a pricing row, apply it immediately
  // so the wizard's BookingSummary and pricing reflect the right values.
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
      allowedDurations: instructor.allowedDurations,
    });
    if (initialPackage) {
      // Map hours to a PackageType — mirrors getPackageByHours in packages.ts
      const pkgType = initialPackage.packageType as any;
      setPackage(pkgType, initialPackage.hours);
    }
  }, [instructor.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build the ordered step list. Depends on instructor config + bookingType choice.
  const getSteps = useCallback((): Step[] => {
    const steps: Step[] = [];
    // Only show package selector if no package was pre-selected
    if (!initialPackage) steps.push('package');
    // Test pack step shown whenever instructor has it configured
    if (instructor.offersTestPackage) steps.push('test-package');
    steps.push('book-type');
    if (bookingState.bookingType === 'now') steps.push('schedule');
    steps.push('register');
    return steps;
  }, [instructor.offersTestPackage, bookingState.bookingType, initialPackage]);

  // When bookingType changes and the current step is no longer in the list
  // (e.g. user was on 'schedule' then switched back to 'later'), snap back to 'book-type'.
  useEffect(() => {
    const validSteps = getSteps();
    if (!validSteps.includes(step)) {
      setStep('book-type');
    }
  }, [bookingState.bookingType]); // eslint-disable-line react-hooks/exhaustive-deps

  const steps = getSteps();
  const currentIndex = steps.indexOf(step);

  const handleNext = () => {
    setError(null);
    const currentSteps = getSteps();
    const idx = currentSteps.indexOf(step);
    if (idx < currentSteps.length - 1) {
      setStep(currentSteps[idx + 1]);
    }
  };

  const handleBack = () => {
    setError(null);
    const currentSteps = getSteps();
    const idx = currentSteps.indexOf(step);
    if (idx > 0) {
      setStep(currentSteps[idx - 1]);
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
    setPriceUpdated(false);

    try {
      const res = await fetch('/api/public/bookings/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructorId: instructor.id,
          packageType: bookingState.packageType,
          hours: bookingState.hours,
          includeTestPackage: bookingState.includeTestPackage,
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

      if (res.status === 409 && data.error?.toLowerCase().includes('pric')) {
        try {
          const pricingRes = await fetch('/api/public/pricing');
          if (pricingRes.ok) {
            const freshSettings = await pricingRes.json();
            updateBooking({ platformSettings: freshSettings });
          }
        } catch {
          // ignore — defaults still apply
        }
        setPriceUpdated(true);
        setError('Prices have been updated — please review the new totals and try again.');
        return;
      }

      if (res.ok) {
        const host = window.location.host;
        const parts = host.split('.');
        const mainHost = parts.length > 1 && !parts[0].includes(':') ? parts.slice(1).join('.') : host;
        const baseUrl = `${window.location.protocol}//${mainHost}`;
        const fromParam = `?from=${encodeURIComponent(host)}`;

        const url = data.transactionId
          ? `${baseUrl}/payment/wallet/${data.transactionId}${fromParam}&hrs=${bookingState.hours}&rate=${bookingState.instructor?.hourlyRate ?? 0}&disc=${bookingState.pricing.discountPercentage}&total=${bookingState.pricing.total}`
          : `${baseUrl}/booking/${data.bookingId}/payment${fromParam}`;

        setPaymentOpened(true);
        setPaymentUrl(url);
      } else {
        setError(data.error || 'Booking failed. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Progress bar ─────────────────────────────────────────────────────────
  const ProgressBar = () => (
    <div className="flex items-center gap-1 mb-6">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center flex-1">
          <div className="flex flex-col items-center flex-1">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all"
              style={
                i <= currentIndex
                  ? { backgroundColor: primary, borderColor: primary, color: '#fff' }
                  : { borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.05)' }
              }
            >
              {i < currentIndex ? '✓' : i + 1}
            </div>
            <span
              className="text-xs mt-1 hidden sm:block"
              style={{ color: i === currentIndex ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: i === currentIndex ? 600 : 400 }}
            >
              {STEP_LABELS[s]}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className="h-0.5 flex-1 mx-1 rounded"
              style={{ backgroundColor: i < currentIndex ? primary : 'rgba(255,255,255,0.1)' }}
            />
          )}
        </div>
      ))}
    </div>
  );

  // ── Payment confirmation screen ───────────────────────────────────────────
  if (paymentOpened && paymentUrl) {
    const isBookLater = bookingState.bookingType === 'later';
    const p = bookingState.pricing;
    const hrs = bookingState.hours;
    const rate = bookingState.instructor?.hourlyRate ?? 0;

    return (
      <div className="space-y-5 py-4">
        <div className="text-center space-y-2">
          <div className="text-4xl">{isBookLater ? '💳' : '✅'}</div>
          <h3 className="text-xl font-bold text-white">
            {isBookLater ? 'Almost there!' : 'Slot reserved!'}
          </h3>
          <p className="text-white/60 text-sm">
            {isBookLater
              ? 'Complete payment to load your wallet. Book lessons from your dashboard anytime.'
              : 'Your slot is held for 10 minutes. Complete payment to confirm.'}
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2 text-sm">
          <p className="font-semibold text-white/80 mb-3">Order Summary</p>
          <div className="flex justify-between text-white/70">
            <span>{hrs} hrs × ${rate}/hr</span>
            <span>${(hrs * rate).toFixed(2)}</span>
          </div>
          {p.testPackage > 0 && (
            <div className="flex justify-between text-white/70">
              <span>PDA test pack</span>
              <span>${p.testPackage.toFixed(2)}</span>
            </div>
          )}
          {p.discount > 0 && (
            <div className="flex justify-between text-green-400">
              <span>Discount ({p.discountPercentage}%)</span>
              <span>-${p.discount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-white/40">
            <span>Platform fee</span>
            <span>${p.platformFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-white border-t border-white/10 pt-2 text-base">
            <span>Total</span>
            <span>${p.total.toFixed(2)}</span>
          </div>
        </div>

        <a
          href={paymentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block w-full py-4 rounded-xl text-white font-bold text-lg text-center transition-all hover:opacity-90"
          style={{ backgroundColor: primary }}
        >
          Complete Payment →
        </a>
        <button
          type="button"
          onClick={() => { setPaymentOpened(false); setPaymentUrl(null); setStep(initialPackage ? (instructor.offersTestPackage ? 'test-package' : 'book-type') : 'package'); }}
          className="w-full text-sm text-white/40 underline hover:text-white/70"
        >
          Start a new booking
        </button>
      </div>
    );
  }

  // ── Wizard steps ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <ProgressBar />

      {error && (
        <div className={`p-3 border rounded-lg text-sm ${priceUpdated ? 'bg-amber-900/40 border-amber-500/40 text-amber-200' : 'bg-red-900/40 border-red-500/40 text-red-200'}`}>
          {priceUpdated && <span className="font-semibold">Prices updated — </span>}
          {error}
        </div>
      )}

      {/* 1 — Package */}
      {step === 'package' && (
        <div className="space-y-4">
          <PackageSelector />
          <button
            type="button"
            onClick={handlePackageContinue}
            className="w-full py-3 rounded-xl text-white font-bold transition-all hover:opacity-90"
            style={{ backgroundColor: primary }}
          >
            Continue →
          </button>
        </div>
      )}

      {/* 2 — Test pack (only when instructor.offersTestPackage = true) */}
      {step === 'test-package' && (
        <div className="space-y-4">
          <div className="text-center space-y-1 mb-2">
            <h3 className="text-xl font-bold text-white">Add a PDA Test Pack?</h3>
            <p className="text-sm text-white/50">Optional add-on configured by your instructor</p>
          </div>

          {/* Card — highlights when selected */}
          <div
            className="rounded-xl border-2 p-5"
            style={{
              borderColor: bookingState.includeTestPackage ? primary : 'rgba(255,255,255,0.12)',
              backgroundColor: bookingState.includeTestPackage ? `${primary}22` : 'rgba(255,255,255,0.04)',
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 flex-1">
                <p className="font-semibold text-white text-base">PDA Test Pack</p>
                {instructor.testPackageDuration && (
                  <p className="text-sm text-white/50">{instructor.testPackageDuration} min session</p>
                )}
                {instructor.testPackageIncludes && instructor.testPackageIncludes.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {instructor.testPackageIncludes.map((item, i) => (
                      <li key={i} className="flex items-center gap-1.5 text-sm text-white/70">
                        <span className="text-green-400">✓</span> {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {instructor.testPackagePrice != null && (
                <p className="font-bold text-lg shrink-0" style={{ color: primary }}>
                  ${instructor.testPackagePrice.toFixed(2)}
                </p>
              )}
            </div>
          </div>

          {/* Skip / Add */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => { updateBooking({ includeTestPackage: false }); handleNext(); }}
              className="py-3 rounded-xl border border-white/20 text-white/70 font-semibold text-sm hover:border-white/40 hover:text-white transition-all"
            >
              Skip for now
            </button>
            <button
              type="button"
              onClick={() => { updateBooking({ includeTestPackage: true }); handleNext(); }}
              className="py-3 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90"
              style={{ backgroundColor: primary }}
            >
              Yes, add it →
            </button>
          </div>

          <button
            type="button"
            onClick={handleBack}
            className="w-full text-sm text-white/30 hover:text-white/60 underline"
          >
            ← Back
          </button>
        </div>
      )}

      {/* 3 — When to Book */}
      {step === 'book-type' && (
        <div className="space-y-4">
          <BookNowOrLater />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 py-3 rounded-xl border border-white/20 text-white/70 font-semibold hover:border-white/40 hover:text-white"
            >
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

      {/* 4 — Schedule (Book Now only) */}
      {step === 'schedule' && (
        <div className="space-y-4">
          <BookingDetailsForm />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 py-3 rounded-xl border border-white/20 text-white/70 font-semibold hover:border-white/40 hover:text-white"
            >
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

      {/* 5 — Your Details */}
      {step === 'register' && (
        <div className="space-y-4">
          <RegistrationForm />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 py-3 rounded-xl border border-white/20 text-white/70 font-semibold hover:border-white/40 hover:text-white"
            >
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

      {/* Compact booking summary — visible from step 2 onwards */}
      {step !== 'package' && (
        <div className="border-t border-white/10 pt-4">
          <BookingSummary />
        </div>
      )}
    </div>
  );
}