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
  provider: {
    id: string;
    name: string;
    displayName?: string;
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

export default function SubdomainBookingWizard({ provider: instructor, primary, initialPackage }: SubdomainBookingWizardProps) {
  const { setInstructor, setPackage, bookingState, updateBooking } = useBooking();
  // If a package was pre-selected from a pricing row, start after the package step
  const firstStep: Step = initialPackage
    ? (instructor.offersTestPackage ? 'test-package' : 'book-type')
    : 'package';
  const [step, setStep] = useState<Step>(firstStep);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceUpdated, setPriceUpdated] = useState(false);

  // Pre-populate instructor in context on mount.
  // If a package was pre-selected from a pricing row, apply it immediately
  // so the wizard's BookingSummary and pricing reflect the right values.
  useEffect(() => {
    setInstructor({
      id: instructor.id,
      name: instructor.name,
      displayName: instructor.displayName ?? instructor.name,
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
          providerId: instructor.id,
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
          // PB-SEC-01: include pre-verified ownership token when email belongs to existing account
          ...(bookingState.emailOwnershipToken ? { emailOwnershipToken: bookingState.emailOwnershipToken } : {}),
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

        // Use checkoutUrl from bulk response — it already contains the paymentToken.
        // Fall back to building the URL only for wallet/transaction flows.
        const url = data.transactionId
          ? `${baseUrl}/payment/wallet/${data.transactionId}${fromParam}&hrs=${bookingState.hours}&rate=${bookingState.provider?.hourlyRate ?? 0}&disc=${bookingState.pricing.discountPercentage}&total=${bookingState.pricing.total}`
          : data.checkoutUrl
            ? `${window.location.protocol}//${mainHost}${new URL(data.checkoutUrl).pathname}${new URL(data.checkoutUrl).search}`
            : `${baseUrl}/booking/${data.bookingId}/payment${fromParam}`;

        // Navigate in the same tab — PB-SEC-04 fix.
        // Do not use target="_blank"; the user must stay in the same window.
        window.location.href = url;
      } else {
        setError(data.error || 'Booking failed. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };
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
            className="w-full py-3 rounded-xl text-foreground font-bold transition-all hover:opacity-90"
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
            <h3 className="text-xl font-bold text-foreground">Add a PDA Test Pack?</h3>
            <p className="text-sm text-foreground/70">Optional add-on configured by your instructor</p>
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
                <p className="font-semibold text-foreground text-base">PDA Test Pack</p>
                {instructor.testPackageDuration && (
                  <p className="text-sm text-foreground/70">{instructor.testPackageDuration} min session</p>
                )}
                {instructor.testPackageIncludes && instructor.testPackageIncludes.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {instructor.testPackageIncludes.map((item, i) => (
                      <li key={i} className="flex items-center gap-1.5 text-sm text-foreground/85">
                        <span className="text-emerald-400">✓</span> {item}
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
              className="py-3 rounded-xl border border-white/20 text-foreground/70 font-semibold text-sm hover:border-white/40 hover:text-foreground transition-all"
            >
              Skip for now
            </button>
            <button
              type="button"
              onClick={() => { updateBooking({ includeTestPackage: true }); handleNext(); }}
              className="py-3 rounded-xl text-foreground font-bold text-sm transition-all hover:opacity-90"
              style={{ backgroundColor: primary }}
            >
              Yes, add it →
            </button>
          </div>

          <button
            type="button"
            onClick={handleBack}
            className="w-full text-sm text-foreground/60 hover:text-foreground/90 underline"
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
              className="flex-1 py-3 rounded-xl border border-white/30 text-foreground/85 font-semibold hover:border-white/60 hover:text-foreground"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleBookTypeContinue}
              disabled={!bookingState.bookingType}
              className="flex-1 py-3 rounded-xl text-foreground font-bold disabled:opacity-40"
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
              className="flex-1 py-3 rounded-xl border border-white/30 text-foreground/85 font-semibold hover:border-white/60 hover:text-foreground"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleScheduleContinue}
              disabled={bookingState.scheduledBookings.length === 0}
              className="flex-1 py-3 rounded-xl text-foreground font-bold disabled:opacity-40"
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
              className="flex-1 py-3 rounded-xl border border-white/30 text-foreground/85 font-semibold hover:border-white/60 hover:text-foreground"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || bookingState.emailVerificationRequired}
              title={bookingState.emailVerificationRequired ? 'Please verify your email ownership to continue' : undefined}
              className="flex-1 py-3 rounded-xl text-foreground font-bold disabled:opacity-40"
              style={{ backgroundColor: primary }}
            >
              {loading ? 'Processing...' : 'Continue to Payment →'}
            </button>
          </div>
        </div>
      )}

      {/* Compact booking summary — visible from step 2 onwards */}
      {step !== 'package' && (
        <div className="border-t border-border pt-4">
          <BookingSummary />
        </div>
      )}
    </div>

  );
}
