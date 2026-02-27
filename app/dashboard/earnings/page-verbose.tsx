'use client';

import { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, Calendar, Download, ChevronDown, ChevronRight, Clock, Info } from 'lucide-react';
import Link from 'next/link';

interface EarningsData {
  totalEarnings: number;
  pendingPayouts: number;
  completedPayouts: number;
  thisMonthEarnings: number;
  lastMonthEarnings: number;
  transactions: Transaction[];
  scheduledBookings: ScheduledBooking[];
  scheduledTotal: number;
  scheduledCount: number;
}

interface ScheduledBooking {
  id: string;
  startTime: string;
  endTime: string;
  duration: number;
  clientName: string;
  instructorPayout: number;
  price: number;
  isFromPackage: boolean;
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
    parentBookingId?: string;
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
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

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
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const groupTransactionsByWeek = (transactions: Transaction[]): WeeklyEarnings[] => {
    const weekMap = new Map<string, Transaction[]>();
    const completedTransactions = transactions.filter(t => t.status === 'COMPLETED');

    completedTransactions.forEach(t => {
      const date = new Date(t.createdAt);
      const weekStart = getWeekStart(date);
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, []);
      }
      weekMap.get(weekKey)!.push(t);
    });

    const weeks: WeeklyEarnings[] = [];
    weekMap.forEach((transactions, weekKey) => {
      const weekStart = new Date(weekKey);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const dayMap = new Map<string, Transaction[]>();
      transactions.forEach(t => {
        const date = new Date(t.createdAt);
        const dayKey = date.toISOString().split('T')[0];
        if (!dayMap.has(dayKey)) {
          dayMap.set(dayKey, []);
        }
        dayMap.get(dayKey)!.push(t);
      });

      const days: DailyEarnings[] = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + i);
        const dayKey = date.toISOString().split('T')[0];
        const dayTransactions = dayMap.get(dayKey) || [];

        const totalGross = dayTransactions.reduce((sum, t) => sum + t.amount, 0);
        const totalPlatformFee = dayTransactions.reduce((sum, t) => sum + t.platformFee, 0);
        const totalNet = dayTransactions.reduce((sum, t) => sum + t.instructorPayout, 0);
        
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

  const weeklyEarnings = groupTransactionsByWeek(earnings.transactions);
  const growthRate = earnings.lastMonthEarnings > 0
    ? ((earnings.thisMonthEarnings - earnings.lastMonthEarnings) / earnings.lastMonthEarnings) * 100
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Earnings</h1>
            <p className="text-gray-600 mt-1">Money from lessons you've taught</p>
          </div>
          <Link
            href="/dashboard/packages"
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            📦 View Packages
          </Link>
        </div>

        {/* Info Banner */}
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-900">
            <span className="font-semibold">💰 Earnings:</span> This page shows money from lessons you've already taught.
            For hours clients have purchased but not scheduled, see the{' '}
            <Link href="/dashboard/packages" className="underline font-semibold">Packages page</Link>.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Total Earned</p>
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">${earnings.totalEarnings.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              All time
              <span className="group relative">
                <Info className="h-3 w-3 text-gray-400 cursor-help" />
                <span className="invisible group-hover:visible absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded whitespace-nowrap">
                  From completed lessons
                </span>
              </span>
            </p>
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
              <p className="text-sm text-gray-600">Pending Payout</p>
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">${earnings.pendingPayouts.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">Awaiting processing</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Scheduled</p>
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-blue-600">${earnings.scheduledTotal.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              {earnings.scheduledCount} confirmed lesson{earnings.scheduledCount !== 1 ? 's' : ''}
              <span className="group relative">
                <Info className="h-3 w-3 text-gray-400 cursor-help" />
                <span className="invisible group-hover:visible absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-10">
                  Will earn when taught
                </span>
              </span>
            </p>
          </div>
        </div>

        {/* Scheduled Lessons Section */}
        {earnings.scheduledBookings && earnings.scheduledBookings.length > 0 && (
          <div className="mb-6 bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 border-b">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Scheduled Lessons (Will Earn When Taught)
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {earnings.scheduledCount} confirmed lesson{earnings.scheduledCount !== 1 ? 's' : ''} • ${earnings.scheduledTotal.toFixed(2)} total
              </p>
            </div>
            <div className="p-4">
              <div className="space-y-2">
                {earnings.scheduledBookings.slice(0, 10).map((booking) => (
                  <div key={booking.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {new Date(booking.startTime).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      <p className="text-sm text-gray-600">
                        {booking.clientName} • {booking.duration}h
                        {booking.isFromPackage && <span className="ml-2 text-purple-600">📦 From package</span>}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-blue-600">${booking.instructorPayout.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">will earn</p>
                    </div>
                  </div>
                ))}
              </div>
              {earnings.scheduledBookings.length > 10 && (
                <p className="text-sm text-gray-600 mt-3 text-center">
                  + {earnings.scheduledBookings.length - 10} more scheduled lesson{earnings.scheduledBookings.length - 10 !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Weekly Earnings Breakdown */}
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-900">
            <span className="font-semibold">📊 Earnings History:</span> Only completed lessons with processed payouts are shown below. Scheduled lessons appear above.
          </p>
        </div>

        <div className="space-y-4">
          {weeklyEarnings.map((week) => {
            const isWeekExpanded = expandedWeeks.has(week.weekLabel);
            
            return (
              <div key={week.weekLabel} className="bg-white rounded-lg shadow overflow-hidden">
                {/* Week Header */}
                <div 
                  className="p-4 bg-gradient-to-r from-green-50 to-green-100 border-b cursor-pointer hover:from-green-100 hover:to-green-200 transition-colors"
                  onClick={() => toggleWeek(week.weekLabel)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isWeekExpanded ? (
                        <ChevronDown className="h-5 w-5 text-green-600" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-green-600" />
                      )}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{week.weekLabel}</h3>
                        <p className="text-sm text-gray-600">
                          {week.totalBookings} lesson{week.totalBookings !== 1 ? 's' : ''} • {week.totalWorkingHours.toFixed(1)} hours
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">${week.totalNet.toFixed(2)}</p>
                      <p className="text-sm text-gray-500">Net Earned</p>
                    </div>
                  </div>
                </div>

                {/* Daily Chart */}
                <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 border-b">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span>📅</span> Daily Breakdown
                  </h4>
                  <div className="grid grid-cols-7 gap-2">
                    {week.days.map((day, idx) => {
                      const hasEarnings = day.totalNet > 0;
                      const dayKey = `${week.weekLabel}-${day.date.toISOString()}`;
                      return (
                        <div 
                          key={idx} 
                          className={`text-center ${hasEarnings ? 'cursor-pointer transform hover:scale-105 transition-transform' : ''}`}
                          onClick={() => hasEarnings && toggleDay(dayKey)}
                        >
                          <div className="text-xs font-medium text-gray-600 mb-1">{day.dayName}</div>
                          <div className="text-xs text-gray-500 mb-1">
                            {day.date.toLocaleDateString('en-US', { day: 'numeric' })}
                          </div>
                          <div className={`p-3 rounded-lg transition-all ${
                            hasEarnings 
                              ? 'bg-gradient-to-br from-green-100 to-green-200 border-2 border-green-400 shadow-md hover:shadow-lg' 
                              : 'bg-white border border-gray-200'
                          }`}>
                            <div className={`text-lg font-bold ${hasEarnings ? 'text-green-700' : 'text-gray-300'}`}>
                              {hasEarnings ? `$${day.totalNet.toFixed(0)}` : '-'}
                            </div>
                            {day.bookingCount > 0 && (
                              <div className="text-xs text-green-700 font-semibold mt-1">
                                {day.bookingCount} lesson{day.bookingCount > 1 ? 's' : ''}
                              </div>
                            )}
                            {day.workingHours > 0 && (
                              <div className="text-xs text-gray-600 mt-0.5">
                                {day.workingHours.toFixed(1)}h
                              </div>
                            )}
                          </div>
                          {hasEarnings && (
                            <div className="text-xs text-blue-600 mt-1 font-medium">
                              ▼ Details
                            </div>
                          )}
                        </div>
                      );
                    })}
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
                        <p className="text-xs text-gray-500">Total Lessons</p>
                        <p className="text-lg font-semibold text-gray-900">{week.totalBookings}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Gross Earnings</p>
                        <p className="text-lg font-semibold text-gray-900">${week.totalGross.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Commission</p>
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
                                    {day.workingHours.toFixed(1)}h • {day.bookingCount} lesson{day.bookingCount > 1 ? 's' : ''}
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
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                                <div>
                                  <p className="text-xs text-gray-500">Gross Earnings</p>
                                  <p className="font-semibold text-gray-900">${day.totalGross.toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Commission</p>
                                  <p className="font-semibold text-red-600">-${day.totalPlatformFee.toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Your Net</p>
                                  <p className="font-bold text-green-600">${day.totalNet.toFixed(2)}</p>
                                </div>
                              </div>

                              {/* Individual Lessons */}
                              <div className="border-t pt-3">
                                <p className="text-sm font-medium text-gray-700 mb-2">Individual Lessons</p>
                                <div className="space-y-2">
                                  {day.transactions.map((transaction) => {
                                    const isFromPackage = transaction.booking?.isPackageBooking && transaction.booking?.parentBookingId;
                                    return (
                                      <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            <p className="font-medium text-gray-900">{transaction.description}</p>
                                            {isFromPackage && (
                                              <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                                                📦 Package
                                              </span>
                                            )}
                                          </div>
                                          {transaction.booking && (
                                            <p className="text-xs text-gray-600 mt-1">
                                              {transaction.booking.client.name} • {new Date(transaction.booking.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                          )}
                                          <div className="text-xs text-gray-500 mt-1">
                                            Gross: ${transaction.amount.toFixed(2)} • Commission: -${transaction.platformFee.toFixed(2)}
                                          </div>
                                        </div>
                                        <div className="text-right ml-4">
                                          <p className="font-semibold text-green-600">${transaction.instructorPayout.toFixed(2)}</p>
                                          <button
                                            onClick={() => downloadInvoice(transaction.id)}
                                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1"
                                          >
                                            <Download className="h-3 w-3" />
                                            Invoice
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
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
              <p className="text-gray-500">No earnings history yet. Start teaching lessons to see your earnings here!</p>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-semibold text-green-900 mb-2">💰 About Earnings</h3>
          <ul className="text-sm text-green-800 space-y-1">
            <li>• Earnings are recorded only when lessons are completed and transactions are processed</li>
            <li>• Scheduled lessons will appear in earnings once taught</li>
            <li>• Payouts are processed weekly on Fridays</li>
            <li>• Platform commission varies by subscription tier (12% PRO, 7% BUSINESS)</li>
            <li>• For hours clients have purchased but not scheduled, see the <Link href="/dashboard/packages" className="underline font-semibold">Packages page</Link></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
