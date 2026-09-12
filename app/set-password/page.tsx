'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function SetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setVerifying(false); return; }
    fetch(`/api/auth/verify-setup-token?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.email) { setAccountEmail(d.email); }
        else setError('This link is invalid or has expired. Please contact support.');
        setVerifying(false);
      })
      .catch(() => { setError('Failed to verify link.'); setVerifying(false); });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    setError('');
    try {
      // Only token + password are sent — email changes are not allowed via this route.
      // If the email was misheard during booking, it can be corrected in account settings
      // after logging in with this password.
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Failed to set password.'); setLoading(false); return; }
      setDone(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="light min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <p className="text-foreground">Verifying your link...</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="light min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Account ready!</h1>
          <p className="text-gray-600">Redirecting you to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="light min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50 px-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🔐</div>
          <h1 className="text-2xl font-bold text-gray-900">Set up your DriveBook account</h1>
          <p className="text-muted-foreground/60 text-sm mt-2">
            Your account was created when you booked over the phone. Set your password to access it.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-700 text-sm">{error}</div>
        )}

        {/* Show the account email as read-only — email cannot be changed here for security.
            If the AI misheard the email, the user can update it in account settings after login. */}
        {accountEmail && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-4">
            <p className="text-xs text-muted-foreground/60 mb-0.5">Account email</p>
            <p className="text-sm font-medium text-slate-800">{accountEmail}</p>
            <p className="text-xs text-muted-foreground mt-1">
              If this is incorrect, you can update it in account settings after logging in.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 text-foreground font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Setting up...' : 'Set Password & Access Account'}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Link expires in 24 hours.{' '}
          <a href="/contact" className="text-blue-500 hover:underline">Contact support</a>
          {' '}if you need help.
        </p>
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="light min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50">
          <p className="text-foreground">Loading...</p>
        </div>
      }
    >
      <SetPasswordForm />
    </Suspense>
  );
}
