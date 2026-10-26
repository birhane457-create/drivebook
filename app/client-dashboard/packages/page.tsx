'use client';

// PB-UI-03 FIX: Display wallet dollar balance as the primary entitlement metric.
// Approved policy (docs/audit/PACKAGE-ACCOUNTING-POLICY.md §5, 2026-10-18):
//   - Dollar credit balance is the authoritative entitlement (from getWalletBalance)
//   - Estimated remaining hours are secondary information, qualified by the
//     applicable lesson rate ("Approx. X hrs at $Y/hr")
//   - Estimate uses CURRENT instructor rate (not locked purchase rate)
//   - Estimate is informational only — no hours are reserved or guaranteed

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Package, Clock, AlertTriangle, TrendingUp, Loader2, CalendarDays, BookOpen, DollarSign, Wallet } from 'lucide-react';
import { estimateHours } from '@/lib/utils/estimate-hours';

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
  lockedHourlyRate: number;
  // PB-UI-03 FIX: current instructor rate for new-booking estimate (not lockedHourlyRate)
  currentHourlyRate: number;
  status: string;
  provider: { id: string; name: string; hourlyRate: number };
  canScheduleMore: boolean;
  bookings: ChildBooking[];
}

interface WalletInfo {
  balance: number;
  totalPaid: number;
  totalSpent: number;
}

interface PackagesResponse {
  packages: PackageData[];
  wallet: WalletInfo;
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
      <div className="min-h-screen bg-background text-foreground pb-24 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your packages...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background text-foreground pb-24">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Your Packages</h1>
          <p className="text-muted-foreground mb-8">Manage your lesson packages and credit balance</p>

          <div className="bg-card/60 backdrop-blur rounded-2xl border border-border shadow-lg shadow-slate-950/20 p-12 text-center">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Error Loading Packages</h3>
            <p className="text-muted-foreground text-sm">Please try refreshing the page.</p>
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
    return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const isExpiringSoon = (pkg: PackageData) => {
    const d = getDaysUntilExpiry(pkg.expiryDate);
    return d <= 7 && d >= 0;
  };

  const isExpired = (pkg: PackageData) => getDaysUntilExpiry(pkg.expiryDate) < 0;

  // PB-UI-03 FIX: use shared estimateHours utility (lib/utils/estimate-hours.ts)
  // Uses CURRENT instructor rate (currentHourlyRate from provider.hourlyRate).
  // Informational only — does not reserve or guarantee hours.

  const walletBalance = data.wallet?.balance ?? 0;

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3 mb-2">
            <Package className="h-8 w-8 text-violet-400" />
            Your Packages
          </h1>
          <p className="text-muted-foreground">Manage your lesson packages and credit balance</p>
        </div>

        {/* Summary Cards — PB-UI-03: dollar balance is primary */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">

          {/* PRIMARY: Wallet Credit Balance */}
          <div className="bg-card/60 backdrop-blur rounded-2xl border border-border p-4 md:p-6 border-t-4 border-green-500 shadow-lg shadow-slate-950/20 hover:bg-card/80 transition-all md:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs md:text-sm text-muted-foreground font-semibold">Credit Balance</p>
              <Wallet className="h-5 w-5 text-emerald-400" />
            </div>
            <p className="text-2xl md:text-3xl font-bold text-emerald-400">
              ${walletBalance.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Credit valid for 12 months from last account activity
            </p>
          </div>

          {/* Active Packages */}
          <div className="bg-card/60 backdrop-blur rounded-2xl border border-border p-4 md:p-6 border-t-4 border-blue-500 shadow-lg shadow-slate-950/20 hover:bg-card/80 transition-all">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs md:text-sm text-muted-foreground font-semibold">Active Packages</p>
              <Package className="h-5 w-5 text-primary" />
            </div>
            <p className="text-2xl md:text-3xl font-bold text-foreground">{data.summary.activeCount}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Ready to use</p>
          </div>

          {/* SECONDARY: Estimated Hours (qualified) */}
          <div className="bg-card/60 backdrop-blur rounded-2xl border border-border p-4 md:p-6 border-t-4 border-violet-500 shadow-lg shadow-slate-950/20 hover:bg-card/80 transition-all">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs md:text-sm text-muted-foreground font-semibold">Lessons Used</p>
              <TrendingUp className="h-5 w-5 text-orange-400" />
            </div>
            <p className="text-2xl md:text-3xl font-bold text-orange-400">{data.summary.used.toFixed(1)}h</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Across all packages</p>
          </div>

          {/* Expiring Soon */}
          <div className="bg-card/60 backdrop-blur rounded-2xl border border-border p-4 md:p-6 border-t-4 border-amber-500 shadow-lg shadow-slate-950/20 hover:bg-card/80 transition-all">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs md:text-sm text-muted-foreground font-semibold">Expiring Soon</p>
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <p className="text-2xl md:text-3xl font-bold text-amber-400">{data.summary.expiring_soon}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Within 7 days</p>
          </div>
        </div>

        {/* Packages List */}
        {data.packages.length === 0 ? (
          <div className="bg-card/60 backdrop-blur rounded-2xl border border-border shadow-lg shadow-slate-950/20 p-12 text-center">
            <Package className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Active Packages</h3>
            <p className="text-muted-foreground mb-6">You haven&apos;t purchased any lesson packages yet.</p>
            <Link
              href="/client-dashboard/book-lesson?newInstructor=true"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition"
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
              // PB-UI-03 FIX: call shared estimateHours utility with CURRENT instructor rate
              const estHours = estimateHours(walletBalance, pkg.currentHourlyRate || pkg.provider.hourlyRate);

              return (
                <div
                  key={pkg.id}
                  className={`bg-card/60 backdrop-blur rounded-2xl border overflow-hidden shadow-lg shadow-slate-950/20 transition-all ${
                    expiringSoon && !expired
                      ? 'border-amber-500/50'
                      : expired
                      ? 'border-destructive/40'
                      : 'border-border'
                  }`}
                >
                  {/* Package Header */}
                  <div className="bg-secondary/50 p-4 md:p-6 border-b border-border">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="text-lg font-bold text-foreground">{pkg.provider.name}</h3>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                              expired
                                ? 'bg-red-900/40 text-destructive border border-red-700/50'
                                : pkg.status === 'completed'
                                ? 'bg-sky-900/40 text-primary border border-sky-700/50'
                                : pkg.status === 'active'
                                ? 'bg-green-900/40 text-emerald-400 border border-green-700/50'
                                : 'bg-secondary/70/40 text-foreground border border-border/50'
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
                        <p className="text-sm text-muted-foreground">
                          Purchased {new Date(pkg.purchaseDate).toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>

                      {/* Expiry Info */}
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground mb-1">Expires</p>
                        <p
                          className={`font-semibold ${
                            expiringSoon && !expired ? 'text-amber-400' : expired ? 'text-destructive' : 'text-foreground'
                          }`}
                        >
                          {new Date(pkg.expiryDate).toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Package Details */}
                  <div className="p-4 md:p-6 space-y-4">

                    {/* PB-UI-03: PRIMARY — Credit Balance; SECONDARY — Estimated hours (qualified) */}
                    <div className="grid grid-cols-3 gap-3">
                      {/* PB-UI-03 FIX: No per-package balance duplicate.
                          Show only the rate-qualified estimate (what this balance
                          might buy at THIS instructor's current rate). */}
                      <div className="bg-green-900/20 rounded-lg p-3 text-center border border-green-700/30 col-span-1">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Est. Lessons</p>
                        </div>
                        {estHours ? (
                          <p className="text-xs text-emerald-400 font-medium leading-tight">{estHours}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground/60">Rate unavailable</p>
                        )}
                        <p className="text-xs text-muted-foreground/50 mt-1">from your balance</p>
                      </div>
                      {/* Secondary: lessons consumed */}
                      <div className="bg-orange-900/20 rounded-lg p-3 text-center border border-orange-700/30">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Lessons Used</p>
                        </div>
                        <p className="text-lg font-semibold text-orange-400">{pkg.hoursUsed.toFixed(1)}h</p>
                      </div>
                      {/* Secondary: package total for reference */}
                      <div className="bg-secondary/50 rounded-lg p-3 text-center border border-white/5">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Package className="h-3 w-3 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Package Size</p>
                        </div>
                        <p className="text-lg font-semibold text-foreground">{pkg.hoursTotal}h</p>
                      </div>
                    </div>

                    {/* Progress Bar (lesson consumption, not balance) */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-foreground">
                          {pkg.hoursUsed.toFixed(1)}h of {pkg.hoursTotal}h lesson hours consumed
                        </span>
                        <span className="text-sm text-muted-foreground">{usagePercent}% used</span>
                      </div>
                      <div className="w-full bg-secondary/70 rounded-full h-3 overflow-hidden">
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

                    {/* Scheduled Lessons */}
                    {pkg.bookings.length > 0 && (
                      <div className="border-t border-white/5 pt-4">
                        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-primary" />
                          Scheduled Lessons ({pkg.bookings.length})
                        </h4>
                        <div className="space-y-2">
                          {pkg.bookings.slice(0, 3).map((booking: ChildBooking) => (
                            <div
                              key={booking.id}
                              className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg border border-white/5 text-sm"
                            >
                              <div>
                                <p className="font-medium text-foreground">
                                  {new Date(booking.date).toLocaleDateString('en-AU', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </p>
                                <p className="text-xs text-muted-foreground">{booking.duration}h lesson</p>
                              </div>
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  booking.status === 'COMPLETED'
                                    ? 'bg-green-900/30 text-emerald-400'
                                    : booking.status === 'CONFIRMED'
                                    ? 'bg-blue-900/30 text-primary'
                                    : 'bg-secondary/70/30 text-muted-foreground'
                                }`}
                              >
                                {booking.status}
                              </span>
                            </div>
                          ))}
                          {pkg.bookings.length > 3 && (
                            <p className="text-xs text-muted-foreground/60 text-center pt-2">
                              +{pkg.bookings.length - 3} more lesson{pkg.bookings.length - 3 > 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Section */}
                    <div className="border-t border-white/5 pt-4 flex gap-3">
                      {pkg.canScheduleMore && walletBalance > 0 && (
                        <Link
                          href={`/client-dashboard/book-lesson?providerId=${pkg.provider.id}`}
                          className="flex-1 px-4 py-2.5 bg-primary text-foreground font-semibold rounded-lg hover:bg-primary/90 transition flex items-center justify-center gap-2 text-sm"
                        >
                          <BookOpen className="w-4 h-4" />
                          Schedule Lesson
                        </Link>
                      )}
                      {pkg.canScheduleMore && walletBalance <= 0 && (
                        <div className="flex-1 px-4 py-2.5 bg-secondary/50 text-muted-foreground font-semibold rounded-lg border border-border text-center text-sm">
                          No credit balance — top up to schedule
                        </div>
                      )}
                      {expired && (
                        <div className="flex-1 px-4 py-2.5 bg-red-900/30 text-destructive font-semibold rounded-lg border border-red-700/50 text-center text-sm">
                          This package has expired
                        </div>
                      )}
                      {pkg.status === 'completed' && !expired && (
                        <div className="flex-1 px-4 py-2.5 bg-green-900/30 text-emerald-400 font-semibold rounded-lg border border-green-700/50 text-center text-sm">
                          All lessons scheduled
                        </div>
                      )}
                    </div>

                    {/* Alert for expiring packages */}
                    {expiringSoon && !expired && walletBalance > 0 && (
                      <div className="p-3 bg-amber-900/20 border border-amber-700/50 rounded-lg">
                        <p className="text-sm text-amber-300">
                          ⚠️ <span className="font-semibold">Hurry!</span> You have ${walletBalance.toFixed(2)} in credit expiring soon.{estHours && ` That&apos;s ${estHours}.`}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* How Packages Work — PB-UI-03: updated to reflect dollar-wallet model */}
        <div className="mt-8 bg-card/60 backdrop-blur rounded-2xl border border-border shadow-lg shadow-slate-950/20 p-5">
          <h3 className="font-semibold text-foreground mb-3">📦 How Packages Work</h3>
          <ul className="text-sm text-foreground space-y-2">
            <li className="flex gap-3">
              <span className="text-primary font-bold">•</span>
              <span>When you buy a package, a dollar credit is added to your wallet — that credit is your entitlement</span>
            </li>
            <li className="flex gap-3">
              <span className="text-primary font-bold">•</span>
              <span>Each lesson is deducted from your credit balance at the instructor&apos;s rate at the time of booking</span>
            </li>
            <li className="flex gap-3">
              <span className="text-primary font-bold">•</span>
              <span>Estimated hours shown above are calculated from your balance ÷ rate — they may change if the rate changes</span>
            </li>
            <li className="flex gap-3">
              <span className="text-primary font-bold">•</span>
              <span>Credit is valid for 12 months from last account activity</span>
            </li>
            <li className="flex gap-3">
              <span className="text-primary font-bold">•</span>
              <span>You can purchase new packages or top up anytime</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
