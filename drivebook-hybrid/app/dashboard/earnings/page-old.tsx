'use client';

import { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, Calendar, Download, ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface EarningsData {
  totalEarnings: number;
  pendingPayouts: number;
  completedPayouts: number;
  thisMonthEarnings: number;
  lastMonthEarnings: number;
  transactions: Transaction[];
  packagePurchases: PackagePurchase[];
  upcomingBookings: {
    count: number;
    totalValue: number;
  };
}

interface PackagePurchase {
  id: string;
  clientName: string;
  clientEmail: string;
  packageHours: number;
  packageHoursUsed: number;
  packageHoursRemaining: number;
  packageStatus: string;
  packageExpiryDate: string;
  price: number;
  instructorPayout: number;
  status: string;
  createdAt: string;
  isPaid: boolean;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  platformFee: number;
  instructorPayout: number;
  status: string;
  createdAt: string;
  booking?: {
    id: string;
    isPackageBooking?: boolean;
    packageHours?: number;
    client: {
      name: string;
    };
    startTime: string;
    endTime: string;
  };
  description: string;
}

interface DailyEarnings {
  date: Date;
  dayName: string;
  transactions: Transaction[];
  totalGross: number;
  totalPlatformFee: number;
  totalServiceFee: number;
  totalDeductions: number;
  totalNet: number;
  workingHours: number;
  bookingCount: number;
}

interface WeeklyEarnings {
  weekStart: Date;
  weekEnd: Date;
  weekLabel: string;
  days: DailyEarnings[];
  totalNet: number;
  totalGross: number;
  totalWorkingHours: number;
  totalBookings: number;
}

export default function EarningsPage() {
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [showPackages, setShowPackages] = useState(false);

  useEffect(() => {
    fetchEarnings();
  }, []);

  const fetchEarnings = async () => {
    try {
      const res = await fetch('/api/instructor/earnings');
      if (res.ok) {
        const data = await res.json();
        setEarnings(data);
      }
    } catch (error) {
      console.error('Failed to fetch earnings:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleWeek = (weekLabel: string) => {
    const newExpanded = new Set(expandedWeeks);
    if (newExpanded.has(weekLabel)) {
      newExpanded.delete(weekLabel);
    } else {
      newExpanded.add(weekLabel);
    }
    setExpandedWeeks(newExpanded);
  };

  const toggleDay = (dayKey: string) => {
    const newExpanded = new Set(expandedDays);
    if (newExpanded.has(dayKey)) {
      newExpanded.delete(dayKey);
    } else {
      newExpanded.add(dayKey);
    }
    setExpandedDays(newExpanded);
  };

  const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    return new Date(d.setDate(diff));
  };

  const groupTransactionsByWeek = (transactions: Transaction[]): WeeklyEarnings[] => {
    const weekMap = new Map<string, Transaction[]>();

    // Only include COMPLETED transactions as earnings
    const completedTransactions = transactions.filter(t => t.status === 'COMPLETED');

    // Group transactions by week
    completedTransactions.forEach(t => {
      const date = new Date(t.createdAt);
      const weekStart = getWeekStart(date);
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, []);
      }
      weekMap.get(weekKey)!.push(t);
    });

    // Convert to WeeklyEarnings array
    const weeks: WeeklyEarnings[] = [];
    weekMap.forEach((transactions, weekKey) => {
      const weekStart = new Date(weekKey);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      // Group by day
      const dayMap = new Map<string, Transaction[]>();
      transactions.forEach(t => {
        const date = new Date(t.createdAt);
        const dayKey = date.toISOString().split('T')[0];
        if (!dayMap.has(dayKey)) {
          dayMap.set(dayKey, []);
        }
        dayMap.get(dayKey)!.push(t);
      });

      // Create daily earnings
      const days: DailyEarnings[] = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + i);
        const dayKey = date.toISOString().split('T')[0];
        const dayTransactions = dayMap.get(dayKey) || [];

        const totalGross = dayTransactions.reduce((sum, t) => sum + t.amount, 0);
        const totalPlatformFee = dayTransactions.reduce((sum, t) => sum + t.platformFee, 0);
        const totalNet = dayTransactions.reduce((sum, t) => sum + t.instructorPayout, 0);
        
        // Calculate working hours from bookings
        const workingHours = dayTransactions.reduce((sum, t) => {
          if (t.booking) {
            const start = new Date(t.booking.startTime);
            const end = new Date(t.booking.endTime);
            const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            return sum + hours;
          }
          return sum;
        }, 0);

        days.push({
          date,
          dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
          transactions: dayTransactions,
          totalGross,
          totalPlatformFee,
          totalServiceFee: 0, // Can add if needed
          totalDeductions: totalPlatformFee,
          totalNet,
          workingHours,
          bookingCount: dayTransactions.filter(t => t.booking).length,
        });
      }

      const totalNet = days.reduce((sum, d) => sum + d.totalNet, 0);
      const totalGross = days.reduce((sum, d) => sum + d.totalGross, 0);
      const totalWorkingHours = days.reduce((sum, d) => sum + d.workingHours, 0);
      const totalBookings = days.reduce((sum, d) => sum + d.bookingCount, 0);

      weeks.push({
        weekStart,
        weekEnd,
        weekLabel: `${weekStart.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} - ${weekEnd.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}`,
        days,
        totalNet,
        totalGross,
        totalWorkingHours,
        totalBookings,
      });
    });

    // Sort by most recent first
    return weeks.sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());
  };

  const downloadInvoice = async (transactionId: string) => {
    try {
      const res = await fetch(`/api/instructor/invoices/${transactionId}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${transactionId}.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to download invoice:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <p>Loading earnings...</p>
      </div>
    );
  }

  if (!earnings) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <p>Failed to load earnings data</p>
      </div>
    );
  }

  const filteredTransactions = earnings.transactions.filter(t => {
    if (filter === 'all') return true;
    if (filter === 'completed') return t.status === 'COMPLETED';
    if (filter === 'pending') return t.status === 'PENDING';
    return true;
  });

  // For weekly earnings view, always show only COMPLETED transactions
  const weeklyEarnings = groupTransactionsByWeek(earnings.transactions);

  const growthRate = earnings.lastMonthEarnings > 0
    ? ((earnings.thisMonthEarnings - earnings.lastMonthEarnings) / earnings.lastMonthEarnings) * 100
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Earnings & Payments</h1>
          <p className="text-gray-600 mt-1">Track your income and payment history</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Total Earnings</p>
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">${earnings.totalEarnings.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">All time</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">This Month</p>
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">${earnings.thisMonthEarnings.toFixed(2)}</p>
            <div className="flex items-center mt-1">
              <TrendingUp className={`h-4 w-4 ${growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              <p className={`text-xs ml-1 ${growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {growthRate >= 0 ? '+' : ''}{growthRate.toFixed(1)}% from last month
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Pending Payouts</p>
              <DollarSign className="h-5 w-5 text-yellow-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">${earnings.pendingPayouts.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">Awaiting processing</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Upcoming Value</p>
              <Calendar className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">${earnings.upcomingBookings.totalValue.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">{earnings.upcomingBookings.count} confirmed bookings</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              All Transactions
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-4 py-2 rounded ${filter === 'completed' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              Completed
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded ${filter === 'pending' ? 'bg-yellow-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              Pending
            </button>
            <div className="flex-1"></div>
            <button
              onClick={() => setShowPackages(!showPackages)}
              className={`px-4 py-2 rounded flex items-center gap-2 ${showPackages ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-700'}`}
            >
              📦 Package Purchases ({earnings?.packagePurchases?.length || 0})
            </button>
          </div>
        </div>

        {/* Package Purchases Section */}
        {showPackages && earnings?.packagePurchases && earnings.packagePurchases.length > 0 && (
          <div className="mb-6 bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 border-b">
              <h2 className="text-xl font-bold text-gray-900">📦 Package Purchases</h2>
              <p className="text-sm text-gray-600">Multi-hour packages purchased by clients</p>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                {earnings.packagePurchases.map((pkg) => (
                  <div key={pkg.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-gray-900">{pkg.clientName}</h3>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            pkg.packageStatus === 'active' ? 'bg-green-100 text-green-700' :
                            pkg.packageStatus === 'completed' ? 'bg-blue-100 text-blue-700' :
                            pkg.packageStatus === 'expired' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {pkg.packageStatus?.toUpperCase()}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            pkg.isPaid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {pkg.isPaid ? 'PAID' : 'PENDING'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-gray-500">Total Hours</p>
                            <p className="font-semibold text-gray-900">{pkg.packageHours}h</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Hours Used</p>
                            <p className="font-semibold text-blue-600">{pkg.packageHoursUsed}h</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Hours Remaining</p>
                            <p className="font-semibold text-green-600">{pkg.packageHoursRemaining}h</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Expires</p>
                            <p className="font-semibold text-gray-900">
                              {new Date(pkg.packageExpiryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Purchased: {new Date(pkg.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-xs text-gray-500">Your Earnings</p>
                        <p className="text-2xl font-bold text-green-600">${pkg.instructorPayout.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">from ${pkg.price.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Weekly Earnings Breakdown */}
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">📊 Weekly Breakdown:</span> Only completed bookings with processed payouts are shown as earnings. Pending transactions appear in the stats above.
          </p>
        </div>

        <div className="space-y-4">
          {weeklyEarnings.map((week) => {
            const isWeekExpanded = expandedWeeks.has(week.weekLabel);
            
            return (
              <div key={week.weekLabel} className="bg-white rounded-lg shadow overflow-hidden">
                {/* Week Header */}
                <div 
                  className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 border-b cursor-pointer hover:from-blue-100 hover:to-blue-200 transition-colors"
                  onClick={() => toggleWeek(week.weekLabel)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isWeekExpanded ? (
                        <ChevronDown className="h-5 w-5 text-blue-600" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-blue-600" />
                      )}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{week.weekLabel}</h3>
                        <p className="text-sm text-gray-600">
                          {week.totalBookings} bookings • {week.totalWorkingHours.toFixed(1)} hours
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">${week.totalNet.toFixed(2)}</p>
                      <p className="text-sm text-gray-500">Net Earnings</p>
                    </div>
                  </div>
                </div>

                {/* Daily Chart - Always Visible */}
                <div className="p-4 bg-gray-50 border-b">
                  <div className="grid grid-cols-7 gap-2">
                    {week.days.map((day, idx) => (
                      <div key={idx} className="text-center">
                        <div className="text-xs font-medium text-gray-600 mb-1">{day.dayName}</div>
                        <div className={`p-2 rounded ${day.totalNet > 0 ? 'bg-green-100 border border-green-300' : 'bg-gray-100'}`}>
                          <div className="text-sm font-semibold text-gray-900">
                            {day.totalNet > 0 ? `$${day.totalNet.toFixed(0)}` : '-'}
                          </div>
                          {day.bookingCount > 0 && (
                            <div className="text-xs text-gray-600">{day.bookingCount} booking{day.bookingCount > 1 ? 's' : ''}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Expanded Week Details */}
                {isWeekExpanded && (
                  <div className="p-4 space-y-4">
                    {/* Week Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-4 border-b">
                      <div>
                        <p className="text-xs text-gray-500">Working Hours</p>
                        <p className="text-lg font-semibold text-gray-900">{week.totalWorkingHours.toFixed(1)}h</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Total Bookings</p>
                        <p className="text-lg font-semibold text-gray-900">{week.totalBookings}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Gross Fare</p>
                        <p className="text-lg font-semibold text-gray-900">${week.totalGross.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Platform Fee</p>
                        <p className="text-lg font-semibold text-red-600">-${(week.totalGross - week.totalNet).toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Daily Breakdown */}
                    {week.days.filter(d => d.transactions.length > 0).map((day) => {
                      const dayKey = `${week.weekLabel}-${day.date.toISOString()}`;
                      const isDayExpanded = expandedDays.has(dayKey);

                      return (
                        <div key={dayKey} className="border rounded-lg overflow-hidden">
                          {/* Day Header */}
                          <div 
                            className="p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                            onClick={() => toggleDay(dayKey)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {isDayExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-gray-600" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-gray-600" />
                                )}
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {day.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                  </p>
                                  <p className="text-xs text-gray-600">
                                    {day.workingHours.toFixed(1)}h • {day.bookingCount} booking{day.bookingCount > 1 ? 's' : ''}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-green-600">${day.totalNet.toFixed(2)}</p>
                                <p className="text-xs text-gray-500">Net</p>
                              </div>
                            </div>
                          </div>

                          {/* Expanded Day Details */}
                          {isDayExpanded && (
                            <div className="p-3 bg-white space-y-3">
                              {/* Earnings Breakdown */}
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                                <div>
                                  <p className="text-xs text-gray-500">Gross Fare</p>
                                  <p className="font-semibold text-gray-900">${day.totalGross.toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Platform Fee</p>
                                  <p className="font-semibold text-red-600">-${day.totalPlatformFee.toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Service Fee</p>
                                  <p className="font-semibold text-gray-600">${day.totalServiceFee.toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Deductions</p>
                                  <p className="font-semibold text-red-600">-${day.totalDeductions.toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Net Earnings</p>
                                  <p className="font-bold text-green-600">${day.totalNet.toFixed(2)}</p>
                                </div>
                              </div>

                              {/* Earning Activities */}
                              <div className="border-t pt-3">
                                <p className="text-sm font-medium text-gray-700 mb-2">Earning Activities</p>
                                <div className="space-y-2">
                                  {day.transactions.map((transaction) => (
                                    <div key={transaction.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                                      <div className="flex-1">
                                        <p className="font-medium text-gray-900">{transaction.description}</p>
                                        {transaction.booking && (
                                          <p className="text-xs text-gray-600">
                                            {transaction.booking.client.name} • {new Date(transaction.booking.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                          </p>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <p className="font-semibold text-green-600">${transaction.instructorPayout.toFixed(2)}</p>
                                        <button
                                          onClick={() => downloadInvoice(transaction.id)}
                                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                        >
                                          <Download className="h-3 w-3" />
                                          Invoice
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {weeklyEarnings.length === 0 && (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <p className="text-gray-500">No earnings data available for the selected filter</p>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">💰 Payment Information</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Earnings are recorded only when bookings are completed and transactions are processed</li>
            <li>• Payouts are processed weekly on Fridays</li>
            <li>• Platform commission varies by subscription tier (12% PRO, 7% BUSINESS)</li>
            <li>• First booking with new clients includes 8% bonus commission (20% total for PRO)</li>
            <li>• Download invoices for your tax records</li>
            <li>• Pending transactions will appear in earnings once completed</li>
            <li>• Contact support for payment inquiries</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
