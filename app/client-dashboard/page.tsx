"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Calendar, 
  Clock, 
  CreditCard, 
  Eye, 
  AlertCircle,
  BookOpen,
  Loader2,
  Star,
  Edit2,
  Check,
  ChevronDown,
  Phone,
  MessageCircle,
  ChevronUp,
  Wallet,
} from 'lucide-react';
import AddCreditsModal from '../../components/AddCreditsModal';
import StripeProvider from '../../components/StripeProvider';
import RescheduleModal from '../../components/RescheduleModal';
import CancelDialog from '../../components/CancelDialog';
import ReviewModal from '../../components/ReviewModal';

interface Booking {
  id: string;
  date: string;
  time: string;
  duration: number;
  price: number;
  status: string;
  instructor: {
    id: string;
    name: string;
    avatar?: string;
    hourlyRate: number;
    phone?: string | null;
    whatsapp?: string | null;
  };
}

interface WalletData {
  totalPaid: number;
  totalSpent: number;
  creditsRemaining: number;
  totalBookedHours: number;
  packages?: Record<string, any>;
  transactions?: Array<{
    id: string;
    date: string;
    amount: number;
    description: string;
    status: string;
    type?: string;
    createdAt?: string;
  }>;
}

interface ProfileData {
  user: { name: string; email: string; pickupLocation?: string };
  bookings: Booking[];
  upcomingCount: number;
  pastCount: number;
  wallet: WalletData;
}

interface InstructorData {
  id: string;
  name: string;
  profileImage?: string;
  carImage?: string;
  carMake?: string;
  carModel?: string;
  carYear?: string;
  phone: string;
  email: string;
  baseAddress: string;
  hourlyRate: number;
  bio?: string;
  averageRating: number;
  totalReviews: number;
  offersTestPackage: boolean;
  services: string[];
  lessonPackages?: Array<{ id: string; name: string; durationMinutes: number; price: number; description: string; isActive: boolean }>;
}

interface CurrentInstructorData {
  currentInstructor: InstructorData | null;
  packageInfo?: {
    totalHours: number;
    usedHours: number;
    remainingHours: number;
    expiryDate: string;
    status: string;
  };
  latestBookingId: string;
  latestBookingStatus: string;
}

export default function ClientDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [currentInstructor, setCurrentInstructor] = useState<CurrentInstructorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('bookings');
  const [showAddCredits, setShowAddCredits] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);
  const [rescheduleModal, setRescheduleModal] = useState<{
    isOpen: boolean;
    bookingId: string;
    instructorId: string;
    date: string;
    time: string;
    duration: number;
    price: number;
    instructor: string;
    hourlyRate: number;
  } | null>(null);
  const [cancelDialog, setCancelDialog] = useState<{
    isOpen: boolean;
    bookingId: string;
    date: string;
    instructor: string;
    price: number;
  } | null>(null);
  const [reviewModal, setReviewModal] = useState<{
    isOpen: boolean;
    bookingId: string;
    instructorName: string;
  } | null>(null);

  useEffect(() => {
    if (searchParams?.get('bookingSuccess')) {
      setShowSuccessBanner(true);
      // Force a hard refresh of all data
      const refreshData = async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        await loadData();
      };
      refreshData();
      const timer = setTimeout(() => setShowSuccessBanner(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      loadData();
    }
  }, [session]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [profileRes, walletRes, instructorRes] = await Promise.all([
        fetch('/api/client/profile'),
        fetch('/api/client/wallet'),
        fetch('/api/client/current-instructor')
      ]);

      if (profileRes.ok && walletRes.ok) {
        const profileData = await profileRes.json();
        const walletData = await walletRes.json();
        
        setProfile({
          ...profileData,
          wallet: walletData
        });
      }

      if (instructorRes.ok) {
        const instructorData = await instructorRes.json();
        setCurrentInstructor(instructorData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">Failed to load dashboard</p>
        </div>
      </div>
    );
  }

  const upcomingBookings = profile.bookings.filter(b => b.status === 'upcoming');
  const pastBookings = profile.bookings.filter(b => b.status === 'completed');
  const usagePercent = profile.wallet.totalPaid > 0 
    ? (profile.wallet.totalSpent / profile.wallet.totalPaid) * 100 
    : 0;

  const tabs = [
    { id: 'bookings', label: 'My Bookings', icon: Calendar },
    { id: 'wallet', label: 'Wallet & Credits', icon: CreditCard },
    { id: 'history', label: 'Payment History', icon: Eye }
  ];

  // Format date safely
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'N/A';
      return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return 'N/A';
    }
  };

  // Format transaction sign and amount
  const formatTransactionAmount = (amount: number, type?: string) => {
    // CHARGE/DEBIT = money out (negative, show as -)
    // CREDIT/REFUND = money in (positive, show as +)
    if (type?.toUpperCase() === 'CHARGE' || type?.toUpperCase() === 'DEBIT') {
      return `- $${Math.abs(amount).toFixed(2)}`;
    }
    // Default: credit/refund shows as positive
    return `+ $${Math.abs(amount).toFixed(2)}`;
  };

  // Format transaction type label
  const formatTransactionType = (type?: string) => {
    if (!type) return 'Transaction';
    return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-20">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Welcome back, {profile.user.name}!</h1>
              <p className="text-blue-100 mt-2">Manage your bookings and credits</p>
            </div>

          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        {/* Success Banner */}
        {showSuccessBanner && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-900">Booking confirmed!</p>
              <p className="text-sm text-green-700">Your lesson(s) have been booked successfully. Check your email for confirmation.</p>
            </div>
          </div>
        )}

        {/* Pickup Location */}
        {profile?.user?.pickupLocation && (
          <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
            <p className="text-sm font-semibold text-indigo-900 mb-1">📍 Your Pickup Location</p>
            <p className="text-indigo-700">{profile.user.pickupLocation}</p>
          </div>
        )}

        {/* Current Instructor Card */}
        {currentInstructor?.currentInstructor && (
          <div className="mb-8 bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
            {/* Card header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-5 py-3">
              <p className="text-white text-sm font-semibold">👨‍🏫 Your Current Instructor</p>
            </div>

            <div className="p-5">
              <div className="flex gap-4 items-start">
                {/* Profile image */}
                <div className="shrink-0">
                  {currentInstructor.currentInstructor.profileImage ? (
                    <img
                      src={currentInstructor.currentInstructor.profileImage}
                      alt={currentInstructor.currentInstructor.name}
                      className="w-20 h-20 rounded-full object-cover border-2 border-blue-200"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center border-2 border-blue-200">
                      <span className="text-3xl font-bold text-blue-600">
                        {currentInstructor.currentInstructor.name.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Name + rating + bio */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-gray-900 leading-tight">
                    {currentInstructor.currentInstructor.name}
                  </h3>
                  <div className="flex items-center gap-1 mt-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-3.5 h-3.5 ${i < Math.round(currentInstructor.currentInstructor!.averageRating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                    ))}
                    <span className="text-xs text-gray-500 ml-1">
                      {currentInstructor.currentInstructor.averageRating.toFixed(1)}
                      {currentInstructor.currentInstructor.totalReviews > 0 && ` (${currentInstructor.currentInstructor.totalReviews})`}
                    </span>
                  </div>
                  {currentInstructor.currentInstructor.bio && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                      {currentInstructor.currentInstructor.bio}
                    </p>
                  )}
                </div>

                {/* Car image */}
                {currentInstructor.currentInstructor.carImage && (
                  <div className="shrink-0 hidden sm:block">
                    <img
                      src={currentInstructor.currentInstructor.carImage}
                      alt="Training vehicle"
                      className="w-28 h-20 object-cover rounded-lg border border-gray-200"
                    />
                    {(currentInstructor.currentInstructor.carMake || currentInstructor.currentInstructor.carModel) && (
                      <p className="text-xs text-gray-400 text-center mt-1">
                        {[currentInstructor.currentInstructor.carMake, currentInstructor.currentInstructor.carModel, currentInstructor.currentInstructor.carYear].filter(Boolean).join(' ')}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Pricing section */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Standard lesson */}
                <div className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-xs font-semibold text-gray-700">Standard Lesson</p>
                    <p className="text-xs text-gray-500">per hour</p>
                  </div>
                  <p className="text-base font-bold text-blue-700">${currentInstructor.currentInstructor.hourlyRate.toFixed(2)}</p>
                </div>

                {/* Lesson packages (PDA, mock test, etc.) */}
                {currentInstructor.currentInstructor.lessonPackages?.map(pkg => (
                  <div key={pkg.id} className="flex items-center justify-between bg-indigo-50 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-xs font-semibold text-gray-700">{pkg.name}</p>
                      <p className="text-xs text-gray-500">{pkg.durationMinutes}min</p>
                    </div>
                    <p className="text-base font-bold text-indigo-700">${pkg.price.toFixed(2)}</p>
                  </div>
                ))}
              </div>

              {/* Car info on mobile (below pricing) */}
              {currentInstructor.currentInstructor.carImage && (
                <div className="mt-3 sm:hidden">
                  <img
                    src={currentInstructor.currentInstructor.carImage}
                    alt="Training vehicle"
                    className="w-full h-32 object-cover rounded-lg border border-gray-200"
                  />
                  {(currentInstructor.currentInstructor.carMake || currentInstructor.currentInstructor.carModel) && (
                    <p className="text-xs text-gray-400 text-center mt-1">
                      {[currentInstructor.currentInstructor.carMake, currentInstructor.currentInstructor.carModel, currentInstructor.currentInstructor.carYear].filter(Boolean).join(' ')}
                    </p>
                  )}
                </div>
              )}

              {/* Package Info — moved to standalone section below */}

              {/* Action buttons */}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => router.push(`/client-dashboard/book-lesson?instructorId=${currentInstructor.currentInstructor!.id}`)}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 text-sm"
                >
                  <Calendar className="w-4 h-4" />
                  Book a Lesson
                </button>
                <button
                  onClick={() => {
                    if (profile?.wallet.creditsRemaining && profile.wallet.creditsRemaining > 0) {
                      if (!confirm(`You have $${profile.wallet.creditsRemaining.toFixed(2)} remaining in your wallet. Your credits are not locked to this instructor — you can use them with any instructor. Switch anyway?`)) return;
                    }
                    router.push('/client-dashboard/book-lesson?newInstructor=true');
                  }}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition text-sm"
                >
                  Switch
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Standalone package + wallet credits card */}
        {currentInstructor?.packageInfo && (
          <div className="mb-6 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-purple-800 px-5 py-3 flex items-center justify-between">
              <p className="text-white text-sm font-semibold">📦 Your Package & Credits</p>
              <span className="text-purple-200 text-xs">Wallet balance: <span className="text-white font-bold">${profile?.wallet.creditsRemaining?.toFixed(2) ?? '0.00'}</span></span>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-3 gap-4 text-center mb-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Total</p>
                  <p className="text-xl font-bold text-gray-900">{currentInstructor.packageInfo.totalHours}h</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Used</p>
                  <p className="text-xl font-bold text-orange-600">{currentInstructor.packageInfo.usedHours}h</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Remaining</p>
                  <p className="text-xl font-bold text-green-600">{currentInstructor.packageInfo.remainingHours}h</p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${currentInstructor.packageInfo.totalHours > 0 ? (currentInstructor.packageInfo.usedHours / currentInstructor.packageInfo.totalHours) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 text-center">
                Credits are instructor-agnostic — your wallet balance can be used with any instructor.
                {currentInstructor.packageInfo.expiryDate && ` Expires ${new Date(currentInstructor.packageInfo.expiryDate).toLocaleDateString('en-AU')}.`}
              </p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {/* Total Credits Added */}
          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-t-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold">Total Credits Added</p>
                <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-2">
                  ${profile.wallet.totalPaid?.toFixed(2) || '0.00'}
                </p>
              </div>
              <div className="text-4xl">💳</div>
            </div>
          </div>

          {/* Net Booking Costs */}
          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-t-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold">Net Booking Costs</p>
                <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-2">
                  ${profile.wallet.totalSpent?.toFixed(2) || '0.00'}
                </p>
              </div>
              <div className="text-4xl">📊</div>
            </div>
          </div>

          {/* Current Balance */}
          <div className={`rounded-xl shadow-md p-4 md:p-6 border-t-4 ${
            profile.wallet.creditsRemaining > 0 
              ? 'bg-white border-green-500' 
              : 'bg-red-50 border-red-500'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold">Current Balance</p>
                <p className={`text-2xl md:text-3xl font-bold mt-2 ${
                  profile.wallet.creditsRemaining > 0 
                    ? 'text-gray-900' 
                    : 'text-red-600'
                }`}>
                  ${profile.wallet.creditsRemaining?.toFixed(2) || '0.00'}
                </p>
              </div>
              <div className="text-4xl">✨</div>
            </div>
          </div>

          {/* Total Hours Booked */}
          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-t-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold">Total Hours Booked</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {profile.wallet.totalBookedHours || 0}h
                </p>
              </div>
              <div className="text-4xl">⏱️</div>
            </div>
          </div>
        </div>

        {/* Credit Exhaustion Warning — only show if no active bookings */}
        {profile.wallet.creditsRemaining <= 0 && upcomingBookings.length === 0 && (
          <div className="mb-8 bg-amber-50 border-l-4 border-amber-500 p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900">Credits Exhausted</h3>
                <p className="text-amber-800 text-sm mt-1">
                  You've used all your credits. Add more to continue booking lessons.
                </p>
                <button
                  onClick={() => setShowAddCredits(true)}
                  className="mt-3 px-4 py-2 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700 transition"
                >
                  Add Credits Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-md mb-6 overflow-hidden">
          <div className="flex border-b border-gray-200">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-6 py-4 font-semibold flex items-center justify-center gap-2 transition ${
                    isActive
                      ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="p-4 md:p-6">
            {/* Bookings Tab */}
            {activeTab === 'bookings' && (
              <div className="space-y-6">
                {/* Upcoming Bookings */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="inline-block w-3 h-3 bg-green-500 rounded-full"></span>
                    Upcoming Lessons
                  </h3>
                  {upcomingBookings.length > 0 ? (
                    <div className="space-y-3">
                      {upcomingBookings.map((booking) => (
                        <div key={booking.id} className="border border-gray-200 rounded-lg overflow-hidden">
                          <div className="flex items-center justify-between p-3 md:p-4 hover:bg-gray-50 transition">
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900">{booking.instructor.name}</h4>
                              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  {new Date(booking.date).toLocaleDateString()}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  {booking.time}
                                </span>
                                <span className="flex items-center gap-1">
                                  <BookOpen className="w-4 h-4" />
                                  {booking.duration}h
                                </span>
                                <span className="font-semibold text-gray-900">${booking.price.toFixed(2)}</span>
                              </div>
                            </div>
                            <div className="flex gap-2 ml-4 items-center">
                              {/* Expand contact */}
                              <button
                                onClick={() => setExpandedBookingId(expandedBookingId === booking.id ? null : booking.id)}
                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                title="Contact instructor"
                              >
                                {expandedBookingId === booking.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => setRescheduleModal({
                                  isOpen: true,
                                  bookingId: booking.id,
                                  instructorId: booking.instructor.id,
                                  date: booking.date,
                                  time: booking.time,
                                  duration: booking.duration * 60,
                                  price: booking.price,
                                  instructor: booking.instructor.name,
                                  hourlyRate: booking.instructor.hourlyRate
                                })}
                                className="px-2 py-1 md:px-3 md:py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition text-sm font-semibold flex items-center gap-1"
                              >
                                <Edit2 className="w-4 h-4" />
                                Reschedule
                              </button>
                              <button
                                onClick={() => setCancelDialog({
                                  isOpen: true,
                                  bookingId: booking.id,
                                  date: booking.date,
                                  instructor: booking.instructor.name,
                                  price: booking.price
                                })}
                                className="px-2 py-1 md:px-3 md:py-2 text-red-600 border border-red-600 rounded-lg hover:bg-red-50 transition text-sm font-semibold"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                          {/* Expandable contact panel */}
                          {expandedBookingId === booking.id && (
                            <div className="border-t border-gray-100 bg-blue-50 px-4 py-3 flex flex-wrap gap-4 items-center">
                              <p className="text-xs font-semibold text-blue-900 w-full">Contact {booking.instructor.name}</p>
                              {booking.instructor.phone && (
                                <a
                                  href={`tel:${booking.instructor.phone}`}
                                  className="flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900 bg-white px-3 py-1.5 rounded-lg border border-blue-200 hover:border-blue-400 transition"
                                >
                                  <Phone className="w-4 h-4" />
                                  {booking.instructor.phone}
                                </a>
                              )}
                              {booking.instructor.whatsapp && (
                                <a
                                  href={`https://wa.me/${booking.instructor.whatsapp.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-sm text-green-700 hover:text-green-900 bg-white px-3 py-1.5 rounded-lg border border-green-200 hover:border-green-400 transition"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                  WhatsApp
                                </a>
                              )}
                              {!booking.instructor.phone && !booking.instructor.whatsapp && (
                                <p className="text-xs text-blue-700">Contact details will be shared by your instructor directly.</p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No upcoming lessons. Book one now!</p>
                  )}
                </div>

                {/* Past Bookings */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="inline-block w-3 h-3 bg-gray-400 rounded-full"></span>
                    Completed Lessons
                  </h3>
                  {pastBookings.length > 0 ? (
                    <div className="space-y-3">
                      {pastBookings.map((booking) => (
                        <div
                          key={booking.id}
                          className="flex items-center justify-between p-3 md:p-4 border border-gray-200 rounded-lg bg-gray-50"
                        >
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">
                              {booking.instructor.name}
                            </h4>
                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {new Date(booking.date).toLocaleDateString()}
                              </span>
                              <span className="font-semibold text-gray-900">
                                ${booking.price.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => setReviewModal({
                              isOpen: true,
                              bookingId: booking.id,
                              instructorName: booking.instructor.name
                            })}
                            className="px-3 py-1 md:px-4 md:py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition font-semibold flex items-center gap-1"
                          >
                            <Star className="w-4 h-4" />
                            Leave Review
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No completed lessons yet.</p>
                  )}
                </div>
              </div>
            )}

            {/* Wallet Tab */}
            {activeTab === 'wallet' && (
              <div className="space-y-6">
                {/* Usage Overview */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 sm:p-6 border border-blue-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Credit Usage</h3>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Total Balance</span>
                      <span className="text-2xl font-bold text-gray-900">
                        ${profile.wallet.totalPaid?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="mt-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600">Used</span>
                        <span className="text-sm font-semibold text-gray-900">
                          ${profile.wallet.totalSpent?.toFixed(2) || '0.00'} ({usagePercent.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            usagePercent > 80
                              ? 'bg-red-500'
                              : usagePercent > 50
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(usagePercent, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-blue-200">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Available Balance</span>
                        <span className={`text-2xl font-bold ${
                          profile.wallet.creditsRemaining > 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}>
                          ${profile.wallet.creditsRemaining?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Instructor Breakdown */}
                {profile.wallet.packages && Object.keys(profile.wallet.packages).length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Spending by Instructor</h3>
                    <div className="space-y-2">
                      {Object.entries(profile.wallet.packages).map(([instructor, data]: any) => (
                        <div key={instructor} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-semibold text-gray-900">{instructor}</p>
                            <p className="text-sm text-gray-500">{data.bookingCount} bookings</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900">${data.totalSpent.toFixed(2)}</p>
                            <p className="text-sm text-gray-500">{data.totalHours}h</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transaction History - Collapsible */}
                {profile.wallet.transactions && profile.wallet.transactions.length > 0 && (
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <button
                      onClick={() => setShowTransactionHistory(!showTransactionHistory)}
                      className="w-full flex items-center justify-between text-lg font-bold text-gray-900 hover:text-gray-700 transition"
                    >
                      <span>📋 Transaction History ({profile.wallet.transactions.length})</span>
                      <ChevronDown className={`w-5 h-5 transition-transform ${showTransactionHistory ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {showTransactionHistory && (
                      <div className="mt-4 space-y-3 border-t border-gray-200 pt-4 max-h-96 overflow-y-auto">
                        {profile.wallet.transactions.map((tx, idx) => (
                          <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-gray-900">
                                    {formatTransactionType(tx.type)}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{tx.description || 'N/A'}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {formatDate(tx.createdAt || tx.date)}
                                </p>
                              </div>
                              <span className={`text-lg font-bold ${
                                tx.type?.toUpperCase() === 'CHARGE' || tx.type?.toUpperCase() === 'DEBIT' 
                                  ? 'text-red-600' 
                                  : 'text-green-600'
                              }`}>
                                {formatTransactionAmount(tx.amount, tx.type)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-3"></div>
                <button
                  onClick={() => setShowAddCredits(true)}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-lg hover:shadow-lg transition flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-5 h-5" />
                  Add More Credits
                </button>
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Transactions</h3>
                {profile.wallet.transactions && profile.wallet.transactions.length > 0 ? (
                  <div className="space-y-2">
                    {profile.wallet.transactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition"
                      >
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{transaction.description}</p>
                          <p className="text-sm text-gray-500">
                            {formatDate(transaction.createdAt || transaction.date)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${
                            transaction.type?.toUpperCase() === 'CHARGE' || transaction.type?.toUpperCase() === 'DEBIT' 
                              ? 'text-red-600' 
                              : 'text-green-600'
                          }`}>
                            {formatTransactionAmount(transaction.amount, transaction.type)}
                          </p>
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                            transaction.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {transaction.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No transactions yet.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Credits Modal */}
      {showAddCredits && (
        <StripeProvider>
          <AddCreditsModal
            isOpen={showAddCredits}
            onClose={() => setShowAddCredits(false)}
            onSuccess={() => {
              loadData();
            }}
          />
        </StripeProvider>
      )}

      {/* Reschedule Modal */}
      {rescheduleModal && (
        <RescheduleModal
          isOpen={rescheduleModal.isOpen}
          onClose={() => setRescheduleModal(null)}
          bookingId={rescheduleModal.bookingId}
          instructorId={rescheduleModal.instructorId}
          currentDate={rescheduleModal.date}
          currentTime={rescheduleModal.time}
          currentDuration={rescheduleModal.duration}
          currentPrice={rescheduleModal.price}
          instructorName={rescheduleModal.instructor}
          instructorHourlyRate={rescheduleModal.hourlyRate}
          onSuccess={async () => {
            // Refresh data and close modal
            await loadData();
            setRescheduleModal(null);
          }}
        />
      )}

      {/* Cancel Dialog */}
      {cancelDialog && (
        <CancelDialog
          isOpen={cancelDialog.isOpen}
          onClose={() => setCancelDialog(null)}
          bookingId={cancelDialog.bookingId}
          instructorName={cancelDialog.instructor}
          bookingDate={cancelDialog.date}
          bookingPrice={cancelDialog.price}
          onSuccess={loadData}
        />
      )}

      {/* Review Modal */}
      {reviewModal && (
        <ReviewModal
          isOpen={reviewModal.isOpen}
          onClose={() => setReviewModal(null)}
          bookingId={reviewModal.bookingId}
          instructorName={reviewModal.instructorName}
          onSuccess={loadData}
        />
      )}
    </div>
  );
}
