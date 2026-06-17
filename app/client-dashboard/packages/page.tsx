'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Package, Clock, AlertTriangle, TrendingUp, Loader2, CalendarDays, BookOpen } from 'lucide-react';

interface ChildBooking {
  id: string;
  date: string;
  instructor: string;
  duration: number;
  status: string;
  price: number;
}

interface PackageData {
  id: string;
  purchaseDate: string;
  expiryDate: string;
  hoursTotal: number;
  hoursUsed: number;
  hoursRemaining: number;
  status: string;
  instructor: { id: string; name: string };
  canScheduleMore: boolean;
  bookings: ChildBooking[];
}

interface PackagesResponse {
  packages: PackageData[];
  summary: {
    total: number;
    used: number;
    remaining: number;
    activeCount: number;
    expiring_soon: number;
  };
}

export default function ClientPackagesPage() {
  const [data, setData] = useState<PackagesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const res = await fetch('/api/client/packages');
      if (res.ok) {
        setData(await res.json());
      }
    } catch (error) {
      console.error('Failed to fetch packages:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 pb-24 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-400">Loading your packages...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Your Packages</h1>
          <p className="text-slate-400 mb-8">Manage your lesson packages and remaining hours</p>

          <div className="bg-slate-900/60 backdrop-blur rounded-3xl border border-white/10 shadow-lg shadow-slate-950/20 p-12 text-center">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-100 mb-2">Error Loading Packages</h3>
            <p className="text-slate-400 text-sm">Please try refreshing the page.</p>
          </div>
        </div>
      </div>
    );
  }

  const calculateUsagePercent = (pkg: PackageData) => {
    if (pkg.hoursTotal === 0) return 0;
    return Math.round((pkg.hoursUsed / pkg.hoursTotal) * 100);
  };

  const getDaysUntilExpiry = (expiryDate: string) => {
    const now = new Date();
    const expiry = new Date(expiryDate);
    const daysRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysRemaining;
  };

  const isExpiringSoon = (pkg: PackageData) => {
    const daysRemaining = getDaysUntilExpiry(pkg.expiryDate);
    return daysRemaining <= 7 && daysRemaining >= 0;
  };

  const isExpired = (pkg: PackageData) => {
    const daysRemaining = getDaysUntilExpiry(pkg.expiryDate);
    return daysRemaining < 0;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3 mb-2">
            <Package className="h-8 w-8 text-violet-400" />
            Your Packages
          </h1>
          <p className="text-slate-400">Manage your lesson packages and schedule remaining hours</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Active Packages */}
          <div className="bg-slate-900/60 backdrop-blur rounded-3xl border border-white/10 p-4 md:p-6 border-t-4 border-blue-500 shadow-lg shadow-slate-950/20 hover:bg-slate-900/80 transition-all">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs md:text-sm text-slate-400 font-semibold">Active Packages</p>
              <Package className="h-5 w-5 text-blue-400" />
            </div>
            <p className="text-2xl md:text-3xl font-bold text-slate-100">{data.summary.activeCount}</p>
            <p className="text-xs text-slate-500 mt-1">Ready to use</p>
          </div>

          {/* Total Hours Remaining */}
          <div className="bg-slate-900/60 backdrop-blur rounded-3xl border border-white/10 p-4 md:p-6 border-t-4 border-green-500 shadow-lg shadow-slate-950/20 hover:bg-slate-900/80 transition-all">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs md:text-sm text-slate-400 font-semibold">Hours Remaining</p>
              <Clock className="h-5 w-5 text-green-400" />
            </div>
            <p className="text-2xl md:text-3xl font-bold text-green-400">{data.summary.remaining.toFixed(1)}h</p>
            <p className="text-xs text-slate-500 mt-1">Out of {data.summary.total.toFixed(1)}h</p>
          </div>

          {/* Hours Used */}
          <div className="bg-slate-900/60 backdrop-blur rounded-3xl border border-white/10 p-4 md:p-6 border-t-4 border-orange-500 shadow-lg shadow-slate-950/20 hover:bg-slate-900/80 transition-all">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs md:text-sm text-slate-400 font-semibold">Hours Used</p>
              <TrendingUp className="h-5 w-5 text-orange-400" />
            </div>
            <p className="text-2xl md:text-3xl font-bold text-orange-400">{data.summary.used.toFixed(1)}h</p>
            <p className="text-xs text-slate-500 mt-1">{Math.round((data.summary.used / data.summary.total) * 100 || 0)}% of total</p>
          </div>

          {/* Expiring Soon */}
          <div className="bg-slate-900/60 backdrop-blur rounded-3xl border border-white/10 p-4 md:p-6 border-t-4 border-amber-500 shadow-lg shadow-slate-950/20 hover:bg-slate-900/80 transition-all">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs md:text-sm text-slate-400 font-semibold">Expiring Soon</p>
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <p className="text-2xl md:text-3xl font-bold text-amber-400">{data.summary.expiring_soon}</p>
            <p className="text-xs text-slate-500 mt-1">Within 7 days</p>
          </div>
        </div>

        {/* Packages List */}
        {data.packages.length === 0 ? (
          <div className="bg-slate-900/60 backdrop-blur rounded-3xl border border-white/10 shadow-lg shadow-slate-950/20 p-12 text-center">
            <Package className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-100 mb-2">No Active Packages</h3>
            <p className="text-slate-400 mb-6">You haven't purchased any lesson packages yet.</p>
            <Link
              href="/client-dashboard/book-lesson?newInstructor=true"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
            >
              <BookOpen className="h-4 w-4" />
              Browse Packages
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {data.packages.map((pkg) => {
              const usagePercent = calculateUsagePercent(pkg);
              const daysUntilExpiry = getDaysUntilExpiry(pkg.expiryDate);
              const expiringSoon = isExpiringSoon(pkg);
              const expired = isExpired(pkg);

              return (
                <div
                  key={pkg.id}
                  className={`bg-slate-900/60 backdrop-blur rounded-3xl border overflow-hidden shadow-lg shadow-slate-950/20 transition-all ${
                    expiringSoon && !expired
                      ? 'border-amber-500/50'
                      : expired
                      ? 'border-red-500/50'
                      : 'border-white/10'
                  }`}
                >
                  {/* Package Header */}
                  <div className="bg-slate-800/50 p-4 md:p-6 border-b border-white/10">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="text-lg font-bold text-slate-100">{pkg.instructor.name}</h3>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                              expired
                                ? 'bg-red-900/40 text-red-300 border border-red-700/50'
                                : pkg.status === 'completed'
                                ? 'bg-sky-900/40 text-sky-300 border border-sky-700/50'
                                : pkg.status === 'active'
                                ? 'bg-green-900/40 text-green-300 border border-green-700/50'
                                : 'bg-slate-700/40 text-slate-300 border border-slate-600/50'
                            }`}
                          >
                            {expired ? 'EXPIRED' : pkg.status.toUpperCase()}
                          </span>
                          {expiringSoon && !expired && (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-amber-900/40 text-amber-300 border border-amber-700/50 flex items-center gap-1 whitespace-nowrap">
                              <AlertTriangle className="h-3 w-3" />
                              EXPIRES IN {daysUntilExpiry} {daysUntilExpiry === 1 ? 'DAY' : 'DAYS'}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-400">
                          Purchased {new Date(pkg.purchaseDate).toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>

                      {/* Expiry Info */}
                      <div className="text-right">
                        <p className="text-xs text-slate-400 mb-1">Expires</p>
                        <p
                          className={`font-semibold ${
                            expiringSoon && !expired ? 'text-amber-400' : expired ? 'text-red-400' : 'text-slate-100'
                          }`}
                        >
                          {new Date(pkg.expiryDate).toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Package Details */}
                  <div className="p-4 md:p-6 space-y-4">
                    {/* Progress Bar */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-200">
                          {pkg.hoursRemaining.toFixed(1)}h remaining (of {pkg.hoursTotal}h)
                        </span>
                        <span className="text-sm text-slate-400">{usagePercent}% used</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-3 rounded-full transition-all ${
                            usagePercent >= 80
                              ? 'bg-red-500'
                              : usagePercent >= 50
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(usagePercent, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-white/5">
                        <p className="text-xs text-slate-400 mb-1">Total</p>
                        <p className="text-lg font-semibold text-slate-100">{pkg.hoursTotal}h</p>
                      </div>
                      <div className="bg-orange-900/20 rounded-lg p-3 text-center border border-orange-700/30">
                        <p className="text-xs text-slate-400 mb-1">Used</p>
                        <p className="text-lg font-semibold text-orange-400">{pkg.hoursUsed.toFixed(1)}h</p>
                      </div>
                      <div className="bg-green-900/20 rounded-lg p-3 text-center border border-green-700/30">
                        <p className="text-xs text-slate-400 mb-1">Remaining</p>
                        <p className="text-lg font-semibold text-green-400">{pkg.hoursRemaining.toFixed(1)}h</p>
                      </div>
                    </div>

                    {/* Scheduled Lessons */}
                    {pkg.bookings.length > 0 && (
                      <div className="border-t border-white/5 pt-4">
                        <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-blue-400" />
                          Scheduled Lessons ({pkg.bookings.length})
                        </h4>
                        <div className="space-y-2">
                          {pkg.bookings.slice(0, 3).map((booking) => (
                            <div
                              key={booking.id}
                              className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-white/5 text-sm"
                            >
                              <div>
                                <p className="font-medium text-slate-100">
                                  {new Date(booking.date).toLocaleDateString('en-AU', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </p>
                                <p className="text-xs text-slate-400">{booking.duration}h lesson</p>
                              </div>
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  booking.status === 'COMPLETED'
                                    ? 'bg-green-900/30 text-green-300'
                                    : booking.status === 'CONFIRMED'
                                    ? 'bg-blue-900/30 text-blue-300'
                                    : 'bg-slate-700/30 text-slate-400'
                                }`}
                              >
                                {booking.status}
                              </span>
                            </div>
                          ))}
                          {pkg.bookings.length > 3 && (
                            <p className="text-xs text-slate-500 text-center pt-2">
                              +{pkg.bookings.length - 3} more lesson{pkg.bookings.length - 3 > 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Section */}
                    <div className="border-t border-white/5 pt-4 flex gap-3">
                      {pkg.canScheduleMore && (
                        <Link
                          href={`/client-dashboard/book-lesson?instructorId=${pkg.instructor.id}`}
                          className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 text-sm"
                        >
                          <BookOpen className="w-4 h-4" />
                          Schedule Lesson
                        </Link>
                      )}
                      {expired && (
                        <div className="flex-1 px-4 py-2.5 bg-red-900/30 text-red-300 font-semibold rounded-lg border border-red-700/50 text-center text-sm">
                          This package has expired
                        </div>
                      )}
                      {pkg.status === 'completed' && !expired && (
                        <div className="flex-1 px-4 py-2.5 bg-green-900/30 text-green-300 font-semibold rounded-lg border border-green-700/50 text-center text-sm">
                          All hours used
                        </div>
                      )}
                    </div>

                    {/* Alert for expiring packages */}
                    {expiringSoon && !expired && pkg.hoursRemaining > 0 && (
                      <div className="p-3 bg-amber-900/20 border border-amber-700/50 rounded-lg">
                        <p className="text-sm text-amber-300">
                          ⚠️ <span className="font-semibold">Hurry!</span> You have {pkg.hoursRemaining.toFixed(1)} hours left before this package expires.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Info Section */}
        <div className="mt-8 bg-slate-900/60 backdrop-blur rounded-3xl border border-white/10 shadow-lg shadow-slate-950/20 p-5">
          <h3 className="font-semibold text-slate-100 mb-3">📦 How Packages Work</h3>
          <ul className="text-sm text-slate-300 space-y-2">
            <li className="flex gap-3">
              <span className="text-blue-400 font-bold">•</span>
              <span>Packages give you a set number of hours to schedule lessons at your preferred pace</span>
            </li>
            <li className="flex gap-3">
              <span className="text-blue-400 font-bold">•</span>
              <span>Hours are only deducted after lessons are completed, not when you book</span>
            </li>
            <li className="flex gap-3">
              <span className="text-blue-400 font-bold">•</span>
              <span>Packages expire 1 year from purchase — use remaining hours before expiry</span>
            </li>
            <li className="flex gap-3">
              <span className="text-blue-400 font-bold">•</span>
              <span>You can purchase new packages or renew existing ones anytime</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
