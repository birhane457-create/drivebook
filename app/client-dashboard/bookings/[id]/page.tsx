'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Calendar, Clock, MapPin, DollarSign, User, Phone,
  MessageCircle, AlertCircle, CheckCircle, XCircle, Loader2,
  Star, CreditCard, RefreshCw, TrendingUp, FileText
} from 'lucide-react';
import ReviewModal from '@/components/ReviewModal';
import PackageCancellationModal from '@/components/client/PackageCancellationModal';

interface BookingDetail {
  id: string;
  bookingType: string | null;
  date: string | null;
  time: string | null;
  startTime: string | null;
  endTime: string | null;
  duration: number | null;
  status: string;
  dbStatus: string;
  price: number;
  isPaid: boolean;
  pickupAddress: string | null;
  notes: string | null;
  isPackageBooking: boolean;
  packageHours: number | null;
  packageHoursRemaining: number | null;
  packageTotalPaid: number | null;
  isReviewed: boolean;
  performanceScore: number | null;
  instructorNotes: string | null;
  providerNotes: string | null;
  lessonFeedback: string[];
  studentStrengths: string[];
  focusAreas: string[];
  whiteboardSketchUrl: string | null;
  cancellationStatus: string | null;
  provider: {
    id: string;
    name: string;
    hourlyRate: number;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
  };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  upcoming: {
    label: 'Upcoming',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: <CheckCircle className="w-4 h-4" />,
  },
  completed: {
    label: 'Completed',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: <CheckCircle className="w-4 h-4" />,
  },
  awaiting_payment: {
    label: 'Awaiting Payment',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: <CreditCard className="w-4 h-4" />,
  },
  awaiting_confirmation: {
    label: 'Awaiting Confirmation',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: <RefreshCw className="w-4 h-4" />,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: <XCircle className="w-4 h-4" />,
  },
  expired: {
    label: 'Expired',
    color: 'bg-gray-100 text-muted-foreground/60 border-gray-200',
    icon: <XCircle className="w-4 h-4" />,
  },
};

export default function ClientBookingDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const bookingId = params.id as string;

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewModal, setReviewModal] = useState(false);
  const [showPackageCancelModal, setShowPackageCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email && bookingId) loadBooking();
  }, [session, bookingId]);

  const loadBooking = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/client/bookings/${bookingId}`);
      if (res.status === 404) {
        setError('Booking not found.');
        return;
      }
      if (!res.ok) throw new Error('Failed to load booking');
      setBooking(await res.json());
    } catch {
      setError('Failed to load booking details.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!booking) return;
    setCancelError(null);
    try {
      setCancelling(true);
      const res = await fetch(`/api/bookings/${booking.id}/cancel`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        setCancelError(data.error || 'Failed to cancel booking.');
        return;
      }
      setCancelConfirm(false);
      await loadBooking();
    } catch {
      setCancelError('Failed to cancel booking. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
          <p className="text-gray-700 mb-4">{error || 'Booking not found.'}</p>
          <Link href="/client-dashboard/bookings" className="text-blue-600 hover:underline text-sm">
            ← Back to bookings
          </Link>
        </div>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.upcoming;
  const now = new Date();
  const startTime = booking.startTime ? new Date(booking.startTime) : null;
  const hoursUntil = startTime ? (startTime.getTime() - now.getTime()) / 3600000 : null;
  const canReschedule = booking.status === 'upcoming' && hoursUntil !== null && hoursUntil > 12;
  const canCancel = (booking.status === 'upcoming' || booking.status === 'awaiting_confirmation') 
    && booking.cancellationStatus !== 'PENDING';
  const canReview = booking.status === 'completed' && !booking.isReviewed;
  const hasFeedback = booking?.performanceScore !== null || (booking.lessonFeedback?.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-24">
      <header className="bg-white/95 border-b border-gray-200 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/client-dashboard/bookings" className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <h1 className="text-lg font-bold text-gray-900">Booking Details</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold ${statusCfg.color}`}>
          {statusCfg.icon}
          {statusCfg.label}
          {booking.status === 'awaiting_payment' && (
            <Link
              href={`/booking/${booking.id}/payment`}
              className="ml-auto underline text-yellow-800 hover:text-yellow-900"
            >
              Complete Payment →
            </Link>
          )}
        </div>

        {booking.cancellationStatus === 'PENDING' && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-yellow-200 bg-yellow-50 text-sm font-semibold text-yellow-800">
            <Clock className="w-4 h-4" />
            Cancellation Request Under Review
          </div>
        )}

        {booking.cancellationStatus === 'APPROVED' && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-green-200 bg-green-50 text-sm font-semibold text-green-800">
            <CheckCircle className="w-4 h-4" />
            Cancellation Approved - Refund Issued to Card
          </div>
        )}

        {booking.cancellationStatus === 'REJECTED' && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-sm font-semibold text-red-800">
            <XCircle className="w-4 h-4" />
            Cancellation Request Denied
          </div>
        )}

        {booking.bookingType === 'PDA_TEST' && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-purple-200 bg-purple-50 text-sm font-semibold text-purple-800">
            🚗 Test Day — Practical Driving Assessment (2h 45min)
          </div>
        )}
      </div>
    </div>
  );
}
