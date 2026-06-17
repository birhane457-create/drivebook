'use client';

import { useEffect, useState } from 'react';
import { Package, Clock, Calendar, AlertTriangle, TrendingUp, User } from 'lucide-react';

interface PackageData {
  id: string;
  client: { id: string; name: string; email: string; phone: string };
  packageHours: number;
  packageHoursUsed: number;
  packageHoursRemaining: number;
  usagePercentage: number;
  packageStatus: string;
  packageExpiryDate: string;
  daysUntilExpiry: number | null;
  isExpiringSoon: boolean;
  purchaseDate: string;
  totalPrice: number;
  instructorPayout: number;
  hourlyRate: number;
  potentialGross: number;
  potentialNet: number;
  upcomingBookings: Array<{
    id: string;
    startTime: string;
    endTime: string;
    duration: number;
    price: number;
    instructorPayout: number;
  }>;
  upcomingBookingsCount: number;
  upcomingBookingsValue: number;
}

interface PackagesResponse {
  packages: PackageData[];
  summary: {
    totalPackages: number;
    totalHoursRemaining: number;
    totalPotentialNet: number;
    totalUpcomingValue: number;
    expiringPackagesCount: number;
  };
}

export default function PackagesPage() {
  const [data, setData] = useState<PackagesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchPackages(); }, []);

  const fetchPackages = async () => {
    try {
      const res = await fetch('/api/instructor/packages');
      if (res.ok) setData(await res.json());
    } catch (error) {
      console.error('Failed to fetch packages:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4">
        <p>Loading packages...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4">
        <p>Failed to load packages data</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-sm p-6">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
            <Package className="h-8 w-8 text-violet-400" />
            Client Packages
          </h1>
          <p className="text-slate-400 mt-1">Hours your clients have purchased but not yet scheduled</p>
        </div>

        {/* Info Banner */}
        <div className="mb-6 bg-slate-950 border border-slate-800 rounded-3xl p-4">
          <p className="text-sm text-slate-300">
            <span className="font-semibold text-slate-100">ℹ️ Important:</span> These are hours your clients have purchased but not yet scheduled.
            You&apos;ll earn this money when lessons are booked and completed. Currently, your clients have{' '}
            <span className="font-bold text-slate-100">{data.summary.totalHoursRemaining.toFixed(1)} hours</span> available to book.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-950 rounded-3xl border border-slate-800 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-400">Active Packages</p>
              <Package className="h-5 w-5 text-violet-400" />
            </div>
            <p className="text-3xl font-bold text-slate-100">{data.summary.totalPackages}</p>
            <p className="text-xs text-slate-500 mt-1">Clients with hours</p>
          </div>
          <div className="bg-slate-950 rounded-3xl border border-slate-800 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-400">Hours Available</p>
              <Clock className="h-5 w-5 text-sky-400" />
            </div>
            <p className="text-3xl font-bold text-sky-400">{data.summary.totalHoursRemaining.toFixed(1)}h</p>
            <p className="text-xs text-slate-500 mt-1">Ready to schedule</p>
          </div>
          <div className="bg-slate-950 rounded-3xl border border-slate-800 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-400">Potential Earnings</p>
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-3xl font-bold text-green-500">${data.summary.totalPotentialNet.toFixed(0)}</p>
            <p className="text-xs text-slate-500 mt-1">When lessons taught</p>
          </div>
          <div className="bg-slate-950 rounded-3xl border border-slate-800 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-400">Expiring Soon</p>
              <AlertTriangle className="h-5 w-5 text-orange-400" />
            </div>
            <p className="text-3xl font-bold text-orange-400">{data.summary.expiringPackagesCount}</p>
            <p className="text-xs text-slate-500 mt-1">Within 30 days</p>
          </div>
        </div>

        {/* Packages List */}
        {data.packages.length === 0 ? (
          <div className="bg-slate-950 rounded-3xl border border-slate-800 p-12 text-center">
            <Package className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-100 mb-2">No Active Packages</h3>
            <p className="text-slate-400">Your clients haven&apos;t purchased any packages yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {data.packages.map((pkg) => (
              <div
                key={pkg.id}
                className={`bg-slate-950 rounded-3xl border overflow-hidden ${pkg.isExpiringSoon ? 'border-orange-500/50' : 'border-slate-800'}`}
              >
                {/* Package Header */}
                <div className="bg-slate-900 p-4 border-b border-slate-800">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <User className="h-5 w-5 text-violet-400" />
                        <h3 className="text-lg font-bold text-slate-100">{pkg.client.name}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          pkg.packageStatus === 'active' ? 'bg-green-900 text-green-300' :
                          pkg.packageStatus === 'completed' ? 'bg-sky-900 text-sky-300' :
                          'bg-slate-800 text-slate-300'
                        }`}>
                          {pkg.packageStatus.toUpperCase()}
                        </span>
                        {pkg.isExpiringSoon && (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-orange-900 text-orange-300 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            EXPIRES IN {pkg.daysUntilExpiry} DAYS
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400">{pkg.client.email} • {pkg.client.phone}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Potential Earnings</p>
                      <p className="text-2xl font-bold text-green-500">${pkg.potentialNet.toFixed(0)}</p>
                      <p className="text-xs text-slate-400">when taught</p>
                    </div>
                  </div>
                </div>

                {/* Package Details */}
                <div className="p-4">
                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-200">
                        {pkg.packageHoursRemaining.toFixed(1)}h remaining (of {pkg.packageHours}h)
                      </span>
                      <span className="text-sm text-slate-400">{pkg.usagePercentage}% used</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-violet-500 to-violet-600 h-3 rounded-full transition-all"
                        style={{ width: `${pkg.usagePercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div><p className="text-xs text-slate-400">Total Hours</p><p className="text-lg font-semibold text-slate-100">{pkg.packageHours}h</p></div>
                    <div><p className="text-xs text-slate-400">Hours Used</p><p className="text-lg font-semibold text-sky-400">{pkg.packageHoursUsed.toFixed(1)}h</p></div>
                    <div><p className="text-xs text-slate-400">Hours Remaining</p><p className="text-lg font-semibold text-green-500">{pkg.packageHoursRemaining.toFixed(1)}h</p></div>
                    <div><p className="text-xs text-slate-400">Hourly Rate</p><p className="text-lg font-semibold text-slate-100">${pkg.hourlyRate.toFixed(0)}/h</p></div>
                  </div>

                  {/* Upcoming Bookings */}
                  {pkg.upcomingBookings.length > 0 && (
                    <div className="border-t border-slate-800 pt-4">
                      <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-sky-400" />
                        Upcoming Bookings ({pkg.upcomingBookingsCount})
                      </h4>
                      <div className="space-y-2">
                        {pkg.upcomingBookings.map((booking) => (
                          <div key={booking.id} className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
                            <div>
                              <p className="font-medium text-slate-100">
                                {new Date(booking.startTime).toLocaleDateString('en-US', {
                                  weekday: 'short', month: 'short', day: 'numeric',
                                  hour: '2-digit', minute: '2-digit'
                                })}
                              </p>
                              <p className="text-sm text-slate-400">{booking.duration}h lesson</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-sky-400">${booking.instructorPayout.toFixed(2)}</p>
                              <p className="text-xs text-slate-500">will earn</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 p-3 bg-green-900/30 border border-green-800/50 rounded-lg">
                        <p className="text-sm text-green-300">
                          <span className="font-semibold">Total scheduled:</span> ${pkg.upcomingBookingsValue.toFixed(2)} from {pkg.upcomingBookingsCount} lesson{pkg.upcomingBookingsCount > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Package Info */}
                  <div className="border-t border-slate-800 pt-4 mt-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-400">Purchased</p>
                        <p className="font-medium text-slate-100">
                          {new Date(pkg.purchaseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">Expires</p>
                        <p className={`font-medium ${pkg.isExpiringSoon ? 'text-orange-400' : 'text-slate-100'}`}>
                          {new Date(pkg.packageExpiryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action Hint */}
                  {pkg.packageHoursRemaining > 0 && pkg.upcomingBookingsCount === 0 && (
                    <div className="mt-4 p-3 bg-amber-900/30 border border-amber-700/50 rounded-lg">
                      <p className="text-sm text-amber-300">
                        💡 <span className="font-semibold">Tip:</span> Reach out to {pkg.client.name.split(' ')[0]} to schedule their remaining {pkg.packageHoursRemaining.toFixed(1)} hours!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom Info */}
        <div className="mt-6 bg-slate-950 border border-violet-800/40 rounded-3xl p-4">
          <h3 className="font-semibold text-violet-300 mb-2">📦 About Packages</h3>
          <ul className="text-sm text-slate-300 space-y-1">
            <li>• Packages show hours clients have purchased but not yet scheduled</li>
            <li>• You earn money when lessons are taught, not when packages are purchased</li>
            <li>• Encourage clients to book their remaining hours before expiry</li>
            <li>• Potential earnings are calculated based on your commission rate</li>
            <li>• Packages expire 1 year (365 days) after purchase</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
