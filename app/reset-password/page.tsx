'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, Loader2 } from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Invalid reset link. Please request a new password reset.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => router.push('/login'), 3000);
      } else {
        setError(data.error || 'Failed to reset password');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 focus:bg-white/15 transition-all backdrop-blur-sm'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center py-8 sm:py-12 px-4">
      <div className="max-w-md w-full">

        {/* Icon + title — same pattern as login */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-600/30 border border-purple-500/40 mb-4">
            <Lock className="w-7 h-7 text-purple-300" aria-hidden="true" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-violet-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">
            Set New Password
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Enter your new password below.
          </p>
        </div>

        {/* Card */}
        <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-2xl shadow-2xl shadow-purple-900/50 border border-white/20 p-6 sm:p-8 backdrop-blur-xl">
          {success ? (
            <div className="flex flex-col items-center text-center gap-4 py-6">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                <svg className="h-7 w-7 text-emerald-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Password reset successful</h3>
                <p className="text-sm text-white/60 mt-1">Redirecting you to login...</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-500/20 text-red-300 p-3 rounded-lg border border-red-500/50 backdrop-blur-sm text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-2 text-white/90">
                  New password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2 text-white/90">
                  Confirm new password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className={inputCls}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !token}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold shadow-lg shadow-purple-900/50 hover:from-purple-500 hover:to-pink-500 hover:shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  'Reset password'
                )}
              </button>

              <div className="text-center">
                <Link href="/forgot-password" className="text-sm text-purple-400 hover:text-purple-300 transition-colors">
                  Request a new reset link
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
