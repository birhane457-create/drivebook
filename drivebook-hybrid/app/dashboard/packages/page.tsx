'use client';

import { useEffect, useState } from 'react';
import { Package, Clock, Calendar, AlertTriangle, TrendingUp, User } from 'lucide-react';
import Link from 'next/link';

interface PackageData {
  id: string;
  client: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
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

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const res = await fetch('/api/instructor/packages');
      if (res.ok) {
        const packagesData = await res.json();
        setData(packagesData);
      }
    } catch (error) {
      console.error('Failed to fetch packages:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <p>Loading packages...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <p>Failed to load packages data</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Package className="h-8 w-8 text-purple-600" />
            Client Packages
          </h1>
          <p className="text-gray-600 mt-1">Hours your clients have purchased but not yet scheduled</p>
        </div>

        {/* Info Banner */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">ℹ️ Important:</span> These are hours your clients have purchased but not yet scheduled.
            You'll earn this money when lessons are booked and completed. Currently, your clients have{' '}
            <span className="font-bold">{data.summary.totalHoursRemaining.toFixed(1)} hours</span> available to book.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Active Packages</p>
              <Package className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{data.summary.totalPackages}</p>
            <p className="text-xs text-gray-500 mt-1">Clients with hours</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Hours Available</p>
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{data.summary.totalHoursRemaining.toFixed(1)}h</p>
            <p className="text-xs text-gray-500 mt-1">Ready to schedule</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Potential Earnings</p>
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-600">${data.summary.totalPotentialNet.toFixed(0)}</p>
            <p className="text-xs text-gray-500 mt-1">When lessons taught</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Expiring Soon</p>
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <p className="text-3xl font-bold text-orange-600">{data.summary.expiringPackagesCount}</p>
            <p className="text-xs text-gray-500 mt-1">Within 30 days</p>
          </div>
        </div>

        {/* Packages List */}
        {data.packages.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Packages</h3>
            <p className="text-gray-600">Your clients haven't purchased any packages yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {data.packages.map((pkg) => (
              <div
                key={pkg.id}
                className={`bg-white rounded-lg shadow overflow-hidden ${
                  pkg.isExpiringSoon ? 'border-2 border-orange-400' : ''
                }`}
              >
                {/* Package Header */}
                <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 border-b">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <User className="h-5 w-5 text-purple-600" />
                        <h3 className="text-lg font-bold text-gray-900">{pkg.client.name}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          pkg.packageStatus === 'active' ? 'bg-green-100 text-green-700' :
                          pkg.packageStatus === 'completed' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {pkg.packageStatus.toUpperCase()}
                        </span>
                        {pkg.isExpiringSoon && (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-700 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            EXPIRES IN {pkg.daysUntilExpiry} DAYS
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{pkg.client.email} • {pkg.client.phone}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Potential Earnings</p>
                      <p className="text-2xl font-bold text-green-600">${pkg.potentialNet.toFixed(0)}</p>
                      <p className="text-xs text-gray-500">when taught</p>
                    </div>
                  </div>
                </div>

                {/* Package Details */}
                <div className="p-4">
                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        {pkg.packageHoursRemaining.toFixed(1)}h remaining (of {pkg.packageHours}h)
                      </span>
                      <span className="text-sm text-gray-600">{pkg.usagePercentage}% used</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-purple-600 h-3 rounded-full transition-all"
                        style={{ width: `${pkg.usagePercentage}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500">Total Hours</p>
                      <p className="text-lg font-semibold text-gray-900">{pkg.packageHours}h</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Hours Used</p>
                      <p className="text-lg font-semibold text-blue-600">{pkg.packageHoursUsed.toFixed(1)}h</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Hours Remaining</p>
                      <p className="text-lg font-semibold text-green-600">{pkg.packageHoursRemaining.toFixed(1)}h</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Hourly Rate</p>
                      <p className="text-lg font-semibold text-gray-900">${pkg.hourlyRate.toFixed(0)}/h</p>
                    </div>
                  </div>

                  {/* Upcoming Bookings */}
                  {pkg.upcomingBookings.length > 0 && (
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-blue-600" />
                        Upcoming Bookings from This Package ({pkg.upcomingBookingsCount})
                      </h4>
                      <div className="space-y-2">
                        {pkg.upcomingBookings.map((booking) => (
                          <div key={booking.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                            <div>
                              <p className="font-medium text-gray-900">
                                {new Date(booking.startTime).toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                              <p className="text-sm text-gray-600">{booking.duration}h lesson</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-blue-600">${booking.instructorPayout.toFixed(2)}</p>
                              <p className="text-xs text-gray-500">will earn</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 p-3 bg-green-50 rounded-lg">
                        <p className="text-sm text-green-800">
                          <span className="font-semibold">Total scheduled:</span> ${pkg.upcomingBookingsValue.toFixed(2)} from {pkg.upcomingBookingsCount} lesson{pkg.upcomingBookingsCount > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Package Info */}
                  <div className="border-t pt-4 mt-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Purchased</p>
                        <p className="font-medium text-gray-900">
                          {new Date(pkg.purchaseDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Expires</p>
                        <p className={`font-medium ${pkg.isExpiringSoon ? 'text-orange-600' : 'text-gray-900'}`}>
                          {new Date(pkg.packageExpiryDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action Hint */}
                  {pkg.packageHoursRemaining > 0 && pkg.upcomingBookingsCount === 0 && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
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
        <div className="mt-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h3 className="font-semibold text-purple-900 mb-2">📦 About Packages</h3>
          <ul className="text-sm text-purple-800 space-y-1">
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
