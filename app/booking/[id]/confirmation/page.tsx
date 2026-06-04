'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

interface BookingSummary {
  bookingId: string;
  status: string;
  isPaid: boolean;
  date: string | null;
  time: string | null;
  startTime: string | null;
  duration: number | null;
  pickupLocation: string | null;
  isPackageBooking: boolean;
  packageHours: number | null;
  total: number;
  currency: string;
  instructor: { name: string; profileImage: string | null; rating: number | null };
}

export default function BookingConfirmationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const bookingId = params.id as string;

  // Token comes from the return_url Stripe redirected to
  const token = searchParams.get('token') ?? '';
  const redirectStatus = searchParams.get('redirect_status');
  const pendingApproval = searchParams.get('status') === 'pending_approval';

  const [summary, setSummary] = useState<BookingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    if (!bookingId) return;

    const load = async () => {
      try {
        // Use payment-summary (token-secured) to get booking details
        const url = token
          ? `/api/public/bookings/${bookingId}/payment-summary?token=${encodeURIComponent(token)}`
          : `/api/public/bookings/${bookingId}/payment-summary`;

        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setSummary(data);

          // If payment just completed but webhook hasn't fired yet, poll for up to 10s
          if (redirectStatus === 'succeeded' && data.status === 'PENDING_PAYMENT' && pollCount < 5) {
            setTimeout(() => setPollCount(c => c + 1), 2000);
            return;
          }
        }
      } catch { /* non-fatal */ }
      setLoading(false);
    };

    load();
  }, [bookingId, token, pollCount]);

  // Stop loading once confirmed, failed, or max polls reached
  useEffect(() => {
    if (summary?.status === 'CONFIRMED' || summary?.isPaid || pollCount >= 5) {
      setLoading(false);
    }
  }, [summary, pollCount]);

  const isConfirmed = summary?.isPaid || summary?.status === 'CONFIRMED';
  const instructorName = summary?.instructor?.name ?? 'your instructor';

  if (loading && pollCount < 5) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="text-gray-600 font-medium">
            {redirectStatus === 'succeeded' ? 'Confirming your payment...' : 'Loading...'}
          </p>
          {pollCount > 0 && (
            <p className="text-gray-400 text-sm">This usually takes just a moment.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-lg mx-auto space-y-5">

        {/* Success / Pending header */}
        <div className="text-center">
          <div className={`inline-flex items-center justify-center w-18 h-18 rounded-full p-4 mb-3 ${
            pendingApproval ? 'bg-amber-100' : isConfirmed ? 'bg-green-100' : 'bg-blue-100'
          }`}>
            {pendingApproval ? (
              <span className="text-3xl">⚡</span>
            ) : isConfirmed ? (
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <span className="text-3xl">⏳</span>
            )}
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {pendingApproval
              ? 'Awaiting Approval'
              : isConfirmed
              ? 'Booking Confirmed'
              : 'Payment Received'}
          </h1>
          <p className="text-gray-500 text-sm">
            {pendingApproval
              ? 'Your instructor needs to approve this short-notice booking.'
              : isConfirmed
              ? 'A confirmation SMS and email have been sent.'
              : 'Your booking is being confirmed. Check your phone for SMS.'}
          </p>
        </div>

        {/* Booking summary card */}
        {summary && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Booking Summary</h2>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                isConfirmed ? 'bg-green-100 text-green-700' :
                pendingApproval ? 'bg-amber-100 text-amber-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {isConfirmed ? '✓ Confirmed' : pendingApproval ? 'Awaiting Approval' : 'Processing'}
              </span>
            </div>

            <div className="px-5 py-4 space-y-3 text-sm">
              {/* Instructor */}
              <div className="flex items-center gap-3">
                {summary.instructor.profileImage ? (
                  <img src={summary.instructor.profileImage} alt={instructorName}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-bold">{instructorName.charAt(0)}</span>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-gray-900">{instructorName}</p>
                  <p className="text-xs text-gray-400">Driving Instructor</p>
                </div>
              </div>

              {/* Details grid */}
              <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
                {summary.date && (
                  <div>
                    <p className="text-gray-400 uppercase tracking-wide mb-0.5">Date</p>
                    <p className="font-medium text-gray-900">
                      {new Date(summary.startTime!).toLocaleDateString('en-AU', {
                        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </p>
                  </div>
                )}
                {summary.time && (
                  <div>
                    <p className="text-gray-400 uppercase tracking-wide mb-0.5">Time</p>
                    <p className="font-medium text-gray-900">{summary.time}</p>
                  </div>
                )}
                {summary.duration && (
                  <div>
                    <p className="text-gray-400 uppercase tracking-wide mb-0.5">Duration</p>
                    <p className="font-medium text-gray-900">{summary.duration} min</p>
                  </div>
                )}
                {summary.isPackageBooking && summary.packageHours && (
                  <div>
                    <p className="text-gray-400 uppercase tracking-wide mb-0.5">Package</p>
                    <p className="font-medium text-gray-900">{summary.packageHours}-Hour Package</p>
                  </div>
                )}
                {summary.pickupLocation && (
                  <div className="col-span-2">
                    <p className="text-gray-400 uppercase tracking-wide mb-0.5">Pickup</p>
                    <p className="font-medium text-gray-900">{summary.pickupLocation}</p>
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="flex justify-between font-semibold text-gray-900 pt-1 border-t border-gray-100">
                <span>Total paid</span>
                <span>${summary.total.toFixed(2)} AUD</span>
              </div>

              {/* Booking reference */}
              <div className="text-xs text-gray-400 flex items-center gap-1">
                <span>Ref:</span>
                <code className="font-mono text-gray-500">{bookingId.slice(0, 12)}...</code>
              </div>
            </div>
          </div>
        )}

        {/* What's next */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4">
          <h3 className="font-semibold text-gray-900 mb-3">What&apos;s Next</h3>
          <div className="space-y-3 text-sm">
            {pendingApproval ? (
              <>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                  <p className="text-gray-600">Your instructor has been notified and must approve within 1 hour.</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                  <p className="text-gray-600">Once approved, you&apos;ll receive a payment link via SMS.</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
                  <p className="text-gray-600">No charge until the instructor approves.</p>
                </div>
              </>
            ) : (
              <>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                  <p className="text-gray-600">Check your phone — an SMS confirmation has been sent.</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                  <p className="text-gray-600">Check your email for your receipt and lesson details.</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
                  <p className="text-gray-600">Login to your dashboard to view and manage your bookings.</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-3">
          {session?.user ? (
            <Link href="/client-dashboard"
              className="block w-full bg-blue-600 text-white py-3.5 rounded-xl font-semibold text-center hover:bg-blue-700 transition-colors">
              Go to My Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login"
                className="block w-full bg-blue-600 text-white py-3.5 rounded-xl font-semibold text-center hover:bg-blue-700 transition-colors">
                Log in to View Booking
              </Link>
              <p className="text-center text-xs text-gray-400">
                Your DriveBook account was created automatically. Log in with the email you used to book.
              </p>
            </>
          )}
          <Link href="/"
            className="block w-full bg-white text-gray-700 py-3 rounded-xl font-medium text-center border border-gray-200 hover:bg-gray-50 transition-colors">
            Back to Home
          </Link>
        </div>

        {/* Support */}
        <p className="text-center text-xs text-gray-400 pb-4">
          Need help?{' '}
          <a href="mailto:support@drivebook.com.au" className="text-blue-500 hover:underline">
            support@drivebook.com.au
          </a>
        </p>
      </div>
    </div>
  );
}
