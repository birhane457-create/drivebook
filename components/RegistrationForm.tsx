'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useBooking } from '@/lib/contexts/BookingContext';
import { AlertCircle, CheckCircle } from 'lucide-react';

export default function RegistrationForm() {
  const { data: session } = useSession();
  const { bookingState, updateBooking } = useBooking();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [emailCheckStatus, setEmailCheckStatus] = useState<'idle' | 'checking' | 'exists' | 'available'>('idle');
  const [showEmailWarning, setShowEmailWarning] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);

  // PB-SEC-01: OTP inline verification state
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLastSent, setOtpLastSent] = useState(0); // unix ms

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
          updateBooking({ emailVerificationRequired: true } as any);
        } else {
          setEmailCheckStatus('available');
          setShowEmailWarning(false);
          updateBooking({ emailVerificationRequired: false } as any);
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
      // Reset OTP state when email changes
      setOtpSent(false);
      setOtpVerified(false);
      setOtpValue('');
      setOtpError(null);
      updateBooking({ emailOwnershipToken: null, emailVerificationRequired: false } as any);
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

  // PB-SEC-01: Send OTP to the existing account's email
  const handleSendOtp = async () => {
    if (Date.now() - otpLastSent < 60_000) {
      setOtpError('Please wait 60 seconds before requesting another code.');
      return;
    }
    setOtpSending(true);
    setOtpError(null);
    try {
      const res = await fetch('/api/auth/send-ownership-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: bookingState.accountHolderEmail }),
      });
      const data = await res.json();
      if (res.status === 429) {
        setOtpError(data.error || 'Please wait before requesting another code.');
        return;
      }
      setOtpSent(true);
      setOtpLastSent(Date.now());
      setOtpValue('');
    } catch {
      setOtpError('Failed to send code. Please try again.');
    } finally {
      setOtpSending(false);
    }
  };

  // PB-SEC-01: Verify the entered OTP and store the session token in context
  const handleVerifyOtp = async () => {
    if (otpValue.length !== 6) {
      setOtpError('Please enter the 6-digit code.');
      return;
    }
    setOtpVerifying(true);
    setOtpError(null);
    try {
      const res = await fetch('/api/auth/verify-ownership-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: bookingState.accountHolderEmail, otp: otpValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error || 'Incorrect code. Please try again.');
        return;
      }
      // Store verified token in booking context — bulk route will use it
      updateBooking({ emailOwnershipToken: data.token });
      setOtpVerified(true);
      setOtpError(null);
      setShowEmailWarning(false);
      updateBooking({ emailVerificationRequired: false } as any);
    } catch {
      setOtpError('Verification failed. Please try again.');
    } finally {
      setOtpVerifying(false);
    }
  };

  return (
    <div className="space-y-8 text-foreground">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground/95 mb-2">
          {isLoggedIn ? 'Confirm Your Details' : 'Create Your Account'}
        </h2>
        <p className="text-foreground/70">
          {isLoggedIn 
            ? 'Your information has been pre-filled from your account'
            : 'Register to manage your bookings and track your progress'
          }
        </p>
      </div>

      {isLoggedIn && (
        <div className="bg-green-600 border border-green-500 rounded-lg p-4">
          <p className="text-sm text-white font-medium">
            ? You're logged in! Your details are pre-filled. You can edit them if needed.
          </p>
        </div>
      )}

      {/* Who is this for? */}
      <div className="space-y-4">
        <label className="block text-lg font-semibold text-foreground/90">
          Who are you registering for?
        </label>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => handleRegistrationTypeChange('myself')}
            className={`
              w-full flex items-start gap-4 p-5 border-2 rounded-xl text-left transition-all
              ${bookingState.registrationType === 'myself'
                ? 'border-purple-500/50 bg-secondary/50'
                : 'border-white/20 hover:border-white/20 bg-secondary/50 hover:bg-secondary'
              }
            `}
          >
            <div className={`
              w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5
              ${bookingState.registrationType === 'myself' ? 'border-blue-600' : 'border-gray-300'}
            `}>
              {bookingState.registrationType === 'myself' && (
                <div className="w-3.5 h-3.5 rounded-full bg-primary" />
              )}
            </div>
            <div>
              <div className="font-semibold text-foreground/90 mb-1">Myself</div>
              <div className="text-sm text-foreground/70">I am the learner</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleRegistrationTypeChange('someone-else')}
            className={`
              w-full flex items-start gap-4 p-5 border-2 rounded-xl text-left transition-all
              ${bookingState.registrationType === 'someone-else'
                ? 'border-purple-500/50 bg-secondary/50'
                : 'border-white/20 hover:border-white/20 bg-secondary/50 hover:bg-secondary'
              }
            `}
          >
            <div className={`
              w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5
              ${bookingState.registrationType === 'someone-else' ? 'border-blue-600' : 'border-gray-300'}
            `}>
              {bookingState.registrationType === 'someone-else' && (
                <div className="w-3.5 h-3.5 rounded-full bg-primary" />
              )}
            </div>
            <div>
              <div className="font-semibold text-foreground/90 mb-1">Someone else</div>
              <div className="text-sm text-foreground/70">
                e.g., child, partner, grandchild, parent, friend
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Account Holder Details */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground/90">
          {bookingState.registrationType === 'myself' ? 'Your Details' : 'Your Details (Account Holder)'}
        </h3>

        <div>
          <label htmlFor="accountHolderName" className="block text-sm font-medium text-foreground/80 mb-1">
            Full Name *
          </label>
          <input
            type="text"
            id="accountHolderName"
            value={bookingState.accountHolderName}
            onChange={(e) => handleAccountHolderChange('accountHolderName', e.target.value)}
            className={`w-full px-4 py-3 border rounded-lg bg-secondary/70 text-foreground placeholder:text-muted-foreground transition-all duration-200 hover:border-white/50 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.15)] focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.15)] ${
              errors.accountHolderName ? 'border-red-500' : 'border-white/30'
            }`}
            placeholder="Enter your full name"
          />
          {errors.accountHolderName && (
            <p className="mt-1 text-sm text-red-600">{errors.accountHolderName}</p>
          )}
        </div>

        <div>
          <label htmlFor="accountHolderEmail" className="block text-sm font-medium text-foreground/80 mb-1">
            Email *
          </label>
          <input
            type="email"
            id="accountHolderEmail"
            value={bookingState.accountHolderEmail}
            onChange={(e) => handleAccountHolderChange('accountHolderEmail', e.target.value)}
            className={`w-full px-4 py-3 border rounded-lg bg-secondary/70 text-foreground placeholder:text-muted-foreground transition-all duration-200 hover:border-white/50 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.15)] focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.15)] ${
              errors.accountHolderEmail ? 'border-red-500' : 'border-white/30'
            }`}
            placeholder="your.email@example.com"
          />
          {checkingEmail && (
            <p className="mt-1 text-sm text-foreground/60">Checking email...</p>
          )}
          {emailCheckStatus === 'available' && !checkingEmail && (
            <p className="mt-1 text-sm text-emerald-400">? Email is available</p>
          )}
          {errors.accountHolderEmail && (
            <p className="mt-1 text-sm text-red-600">{errors.accountHolderEmail}</p>
          )}
        </div>

        {/* Email Already Exists — OTP verification notice (PB-SEC-01) */}
        {showEmailWarning && emailCheckStatus === 'exists' && !isLoggedIn && (
          <div className="bg-slate-800 border border-slate-600 rounded-xl p-4 space-y-4">
            <div className="flex items-start gap-3">
              {otpVerified
                ? <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                : <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
              }
              <div className="flex-1">
                {otpVerified ? (
                  <>
                    <h4 className="font-semibold text-green-300 mb-1">Email verified</h4>
                    <p className="text-sm text-slate-300">
                      Your email ownership is confirmed. You can continue with the booking.
                    </p>
                  </>
                ) : (
                  <>
                    <h4 className="font-semibold text-white mb-1">This email is already registered</h4>
                    <p className="text-sm text-slate-300 mb-3">
                      An existing DriveBook account is associated with{' '}
                      <strong className="text-white">{bookingState.accountHolderEmail}</strong>.
                      Verify you own this email to connect this booking to your account.
                    </p>

                    {!otpSent ? (
                      /* Step 1 — send the code */
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={otpSending}
                          className="flex-1 bg-white text-slate-900 hover:bg-slate-100 px-4 py-2 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50"
                        >
                          {otpSending ? 'Sending…' : 'Send verification code'}
                        </button>
                        <a
                          href="/login"
                          className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-semibold text-sm border border-slate-500 transition-colors text-center"
                        >
                          Sign in instead
                        </a>
                      </div>
                    ) : (
                      /* Step 2 — enter the code */
                      <div className="space-y-3">
                        <p className="text-sm text-slate-300">
                          We sent a 6-digit code to{' '}
                          <strong className="text-white">{bookingState.accountHolderEmail}</strong>.
                          Enter it below.
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={otpValue}
                            onChange={e => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="6-digit code"
                            className="flex-1 text-center text-xl font-mono tracking-widest py-3 rounded-lg border border-slate-500 bg-slate-700 text-white placeholder-slate-400 focus:outline-none focus:border-white"
                          />
                          <button
                            type="button"
                            onClick={handleVerifyOtp}
                            disabled={otpVerifying || otpValue.length !== 6}
                            className="px-5 py-3 rounded-lg bg-white text-slate-900 font-semibold text-sm hover:bg-slate-100 disabled:opacity-50 transition-colors"
                          >
                            {otpVerifying ? 'Checking…' : 'Verify'}
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <button
                            type="button"
                            onClick={handleSendOtp}
                            disabled={otpSending || Date.now() - otpLastSent < 60_000}
                            className="underline hover:text-slate-200 disabled:opacity-40"
                          >
                            {otpSending ? 'Sending…' : 'Send a new code'}
                          </button>
                          <a href="/login" className="underline hover:text-slate-200">
                            Sign in instead
                          </a>
                        </div>
                      </div>
                    )}

                    {otpError && (
                      <p className="text-sm text-red-400 mt-2">{otpError}</p>
                    )}

                    <p className="text-xs text-slate-500 mt-3">
                      Can't access this email? Use a different address or contact DriveBook support.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <div>
          <label htmlFor="accountHolderPhone" className="block text-sm font-medium text-foreground/80 mb-1">
            Phone *
          </label>
          <input
            type="tel"
            id="accountHolderPhone"
            value={bookingState.accountHolderPhone}
            onChange={(e) => handleAccountHolderChange('accountHolderPhone', e.target.value)}
            className={`w-full px-4 py-3 border rounded-lg bg-secondary/70 text-foreground placeholder:text-muted-foreground transition-all duration-200 hover:border-white/50 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.15)] focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.15)] ${
              errors.accountHolderPhone ? 'border-red-500' : 'border-white/30'
            }`}
            placeholder="0400 000 000"
          />
          {errors.accountHolderPhone && (
            <p className="mt-1 text-sm text-red-600">{errors.accountHolderPhone}</p>
          )}
        </div>

        <div>
          <label htmlFor="accountHolderPassword" className="block text-sm font-medium text-foreground/80 mb-1">
            Password *
          </label>
          <input
            type="password"
            id="accountHolderPassword"
            value={bookingState.accountHolderPassword}
            onChange={(e) => handleAccountHolderChange('accountHolderPassword', e.target.value)}
            className={`w-full px-4 py-3 border rounded-lg bg-secondary/70 text-foreground placeholder:text-muted-foreground transition-all duration-200 hover:border-white/50 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.15)] focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.15)] ${
              errors.accountHolderPassword ? 'border-red-500' : 'border-white/30'
            }`}
            placeholder="At least 6 characters"
          />
          {errors.accountHolderPassword && (
            <p className="mt-1 text-sm text-red-600">{errors.accountHolderPassword}</p>
          )}
        </div>

        <div>
          <label htmlFor="accountHolderConfirmPassword" className="block text-sm font-medium text-foreground/80 mb-1">
            Confirm Password *
          </label>
          <input
            type="password"
            id="accountHolderConfirmPassword"
            value={bookingState.accountHolderConfirmPassword}
            onChange={(e) => handleAccountHolderChange('accountHolderConfirmPassword', e.target.value)}
            className={`w-full px-4 py-3 border rounded-lg bg-secondary/70 text-foreground placeholder:text-muted-foreground transition-all duration-200 hover:border-white/50 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.15)] focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.15)] ${
              errors.accountHolderConfirmPassword ? 'border-red-500' : 'border-white/30'
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
        <div className="space-y-4 border-t border-white/20 pt-6">
          <h3 className="text-lg font-semibold text-foreground/90">Learner's Details</h3>

          <div>
            <label htmlFor="learnerName" className="block text-sm font-medium text-foreground/80 mb-1">
              Learner's Full Name *
            </label>
            <input
              type="text"
              id="learnerName"
              value={bookingState.learnerName}
              onChange={(e) => handleLearnerChange('learnerName', e.target.value)}
              className={`w-full px-4 py-3 border rounded-lg bg-secondary/70 text-foreground placeholder:text-muted-foreground transition-all duration-200 hover:border-white/50 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.15)] focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.15)] ${
                errors.learnerName ? 'border-red-500' : 'border-white/30'
              }`}
              placeholder="Enter learner's full name"
            />
            {errors.learnerName && (
              <p className="mt-1 text-sm text-red-600">{errors.learnerName}</p>
            )}
          </div>

          <div>
            <label htmlFor="learnerPhone" className="block text-sm font-medium text-foreground/80 mb-1">
              Learner's Phone (Optional)
            </label>
            <input
              type="tel"
              id="learnerPhone"
              value={bookingState.learnerPhone}
              onChange={(e) => handleLearnerChange('learnerPhone', e.target.value)}
              className="w-full px-4 py-3 border border-white/30 rounded-lg bg-secondary/70 text-foreground placeholder:text-muted-foreground transition-all duration-200 hover:border-white/50 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.15)] focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.15)]"
              placeholder="0400 000 000"
            />
          </div>

          <div>
            <label htmlFor="learnerRelationship" className="block text-sm font-medium text-foreground/80 mb-1">
              Relationship *
            </label>
            <select
              id="learnerRelationship"
              value={bookingState.learnerRelationship}
              onChange={(e) => handleLearnerChange('learnerRelationship', e.target.value)}
              className={`w-full px-4 py-3 border rounded-lg bg-secondary/70 text-foreground placeholder:text-muted-foreground transition-all duration-200 hover:border-white/50 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.15)] focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.15)] ${
                errors.learnerRelationship ? 'border-red-500' : 'border-white/30'
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
      <div className="bg-secondary/50 rounded-lg border border-white/20 p-4">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-purple-300 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-foreground/80">
            <p className="font-semibold mb-1 text-foreground/90">Account Access</p>
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
