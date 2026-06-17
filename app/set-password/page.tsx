'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface SetPasswordResponse {
  success: boolean;
  error?: string;
  message?: string;
}

export default function SetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No setup link provided. Please check your email for the correct link.');
    }
  }, [token]);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/[A-Z]/.test(pwd)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[0-9]/.test(pwd)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!token) {
      setStatus('error');
      setMessage('Invalid or missing setup link');
      return;
    }

    if (!password || !confirmPassword) {
      setStatus('error');
      setMessage('Please fill in both password fields');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setStatus('error');
      setMessage(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setStatus('error');
      setMessage('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setStatus('loading');

    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
      });

      const data: SetPasswordResponse = await res.json();

      if (res.ok) {
        setStatus('success');
        setMessage('✅ Password set successfully! Redirecting to login...');
        
        // Redirect after 2 seconds
        setTimeout(() => {
          router.push('/login?passwordSet=true');
        }, 2000);
      } else {
        setStatus('error');
        setMessage(
          data.error ||
          'Failed to set password. Link may have expired. Please request a new setup link.'
        );
      }
    } catch (error) {
      setStatus('error');
      setMessage('An error occurred. Please try again.');
      console.error('Set password error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Setup Error</h1>
            <p className="text-gray-600 mb-4">
              No setup link provided. Please check your email for the correct link.
            </p>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-700">
              If you didn't receive an email, please contact your instructor or support.
            </p>
          </div>

          <Link
            href="/login"
            className="block text-center bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-2xl">🔐</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Set Your Password</h1>
          <p className="text-gray-600">
            Create a secure password to access your DriveBook account
          </p>
        </div>

        {status === 'success' ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800 font-medium text-center">{message}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 hover:text-gray-900"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Must be at least 8 characters, include uppercase letter and number
              </p>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
            </div>

            {/* Status Messages */}
            {status === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 text-sm">{message}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-2 px-4 rounded-lg font-medium text-white transition ${
                isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
              }`}
            >
              {isLoading ? 'Setting Password...' : 'Set Password'}
            </button>
          </form>
        )}

        {/* Help Section */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-600 text-center mb-3">
            🔒 This link expires in 24 hours
          </p>
          <div className="flex flex-col space-y-2">
            <Link
              href="/login"
              className="text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Already have an account? Login
            </Link>
            <Link
              href="/forgot-password"
              className="text-center text-sm text-gray-600 hover:text-gray-700"
            >
              Forgot password? Reset here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
