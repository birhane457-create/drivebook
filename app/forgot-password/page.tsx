'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(data.message);
        setEmail('');
      } else {
        setError(data.error || 'Failed to send reset email');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center py-8 sm:py-12 px-4">
      <div className="max-w-md w-full">

        {/* Icon + title — same pattern as login */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-600/30 border border-purple-500/40 mb-4">
            <Mail className="w-7 h-7 text-purple-300" aria-hidden="true" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-violet-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">
            Forgot Password?
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        {/* Card */}
        <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-2xl shadow-2xl shadow-purple-900/50 border border-white/20 p-6 sm:p-8 backdrop-blur-xl">
          {message && (
            <div className="mb-6 p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-lg backdrop-blur-sm">
              <p className="text-emerald-300 text-sm font-medium">{message}</p>
              <p className="text-emerald-300/70 text-xs mt-1">
                Check your inbox and spam folder for the reset link.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-500/20 text-red-300 p-3 rounded-lg mb-4 border border-red-500/50 backdrop-blur-sm text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2 text-white/90">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                placeholder="you@example.com"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 focus:bg-white/15 transition-all backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold shadow-lg shadow-purple-900/50 hover:from-purple-500 hover:to-pink-500 hover:shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Reset Link'
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-between text-sm">
            <Link
              href="/login"
              className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </Link>
            <Link href="/register" className="text-white/50 hover:text-white/80 transition-colors">
              Create account
            </Link>
          </div>
        </div>

        <p className="text-center mt-6 text-xs text-white/40">
          Need help? Contact{' '}
          <a href="mailto:support@drivebook.com" className="text-white/60 hover:text-white/80 transition-colors">
            support@drivebook.com
          </a>
        </p>
      </div>
    </div>
  );
}
