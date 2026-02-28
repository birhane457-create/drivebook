'use client';

import { useEffect, useState } from 'react';
import { DollarSign, Calendar, ChevronDown, ChevronRight, Clock, FileText } from 'lucide-react';
import Link from 'next/link';

interface EarningsData {
  totalEarnings: number;
  pendingPayouts: number;
  thisWeekEarnings: number;
  lastWeekEarnings: number;
  thisMonthEarnings: number;
  transactions: Transaction[];
  scheduledBookings: ScheduledBooking[];
  scheduledTotal: number;
  scheduledCount: number;
}

interface ScheduledBooking {
  id: string;
  startTime: string;
  duration: number;
  clientName: string;
  instructorPayout: number;
  isFromPackage: boolean;
}

interface Transaction {
  id: string;
  amount: number;
  platformFee: number;
  instructorPayout: number;
  status: string;
  createdAt: string;
  booking?: {
    id: string;
    isPackageBooking?: boolean;
    parentBookingId?: string;
    client: { name: string };
    startTime: string;
    endTime: string;
  };
  description: string;
}

interface WeeklyEarnings {
  weekStart: Date;
  weekEnd: Date;
  weekLabel: string;
  isCurrentWeek: boolean;
  isLastWeek: boolean;
  totalNet: number;
  totalGross: number;
  totalWorkingHours: number;
  totalBookings: number;
  transactions: Transaction[];
}

export default function EarningsPage() {
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [weeksToShow, setWeeksToShow] = useState(2);

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

  const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0); // Reset time to start of day
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(d.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  };

  const groupTransactionsByWeek = (transactions: Transaction[]): WeeklyEarnings[] => {
    const weekMap = new Map<string, Transaction[]>();
    const completedTransactions = transactions.filter(t => t.status === 'COMPLETED');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const currentWeekStart = getWeekStart(now);
    const lastWeekStart = new Date(currentWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    lastWeekStart.setHours(0, 0, 0, 0);

    completedTransactions.forEach(t => {
      const date = new Date(t.createdAt);
      date.setHours(0, 0, 0, 0); // Normalize to start of day
      const weekStart = getWeekStart(date);
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, []);
      }
      weekMap.get(weekKey)!.push(t);
    });

    const weeks: WeeklyEarnings[] = [];
    weekMap.forEach((transactions, weekKey) => {
      // Parse date string correctly to avoid timezone shifts
      const [year, month, day] = weekKey.split('-').map(Number);
      const weekStart = new Date(year, month - 1, day);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const totalGross = transactions.reduce((sum, t) => sum + t.amount, 0);
      const totalPlatformFee = transactions.reduce((sum, t) => sum + t.platformFee, 0);
      const totalNet = transactions.reduce((sum, t) => sum + t.instructorPayout, 0);
      
      const totalWorkingHours = transactions.reduce((sum, t) => {
        if (t.booking) {
          const start = new Date(t.booking.startTime);
          const end = new Date(t.booking.endTime);
          const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          return sum + hours;
        }
        return sum;
      }, 0);

      // Compare week keys directly (they're already ISO date strings)
      const currentWeekKey = currentWeekStart.toISOString().split('T')[0];
      const lastWeekKey = lastWeekStart.toISOString().split('T')[0];
      
      const isCurrentWeek = weekKey === currentWeekKey;
      const isLastWeek = weekKey === lastWeekKey;

      weeks.push({
        weekStart,
        weekEnd,
        weekLabel: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        isCurrentWeek,
        isLastWeek,
        totalNet,
        totalGross,
        totalWorkingHours,
        totalBookings: transactions.filter(t => t.booking).length,
        transactions
      });
    });

    return weeks.sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());
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
  const visibleWeeks = showAllHistory ? weeklyEarnings.slice(0, weeksToShow) : weeklyEarnings.slice(0, 2);
  const hasMoreWeeks = weeklyEarnings.length > visibleWeeks.length;

  // Calculate this week and last week earnings
  const thisWeek = weeklyEarnings.find(w => w.isCurrentWeek);
  const lastWeek = weeklyEarnings.find(w => w.isLastWeek);
  const thisWeekEarnings = thisWeek?.totalNet || 0;
  const lastWeekEarnings = lastWeek?.totalNet || 0;

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
              <p className="text-sm text-gray-600">This Week</p>
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">${thisWeekEarnings.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">{thisWeek?.totalBookings || 0} lessons</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Last Week</p>
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">${lastWeekEarnings.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">{lastWeek?.totalBookings || 0} lessons</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">This Month</p>
              <Calendar className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">${earnings.thisMonthEarnings.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">Month to date</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Scheduled</p>
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-blue-600">${earnings.scheduledTotal.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">{earnings.scheduledCount} confirmed</p>
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
                {earnings.scheduledCount} confirmed • ${earnings.scheduledTotal.toFixed(2)} total
              </p>
            </div>
            <div className="p-4">
              <div className="space-y-2">
                {earnings.scheduledBookings.slice(0, 5).map((booking) => (
                  <div key={booking.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
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
                        {booking.isFromPackage && <span className="ml-2 text-purple-600">📦</span>}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-blue-600">${booking.instructorPayout.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">will earn</p>
                    </div>
                  </div>
                ))}
              </div>
              {earnings.scheduledBookings.length > 5 && (
                <p className="text-sm text-gray-600 mt-3 text-center">
                  + {earnings.scheduledBookings.length - 5} more scheduled
                </p>
              )}
            </div>
          </div>
        )}

        {/* Weekly Earnings History */}
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-900">
            <span className="font-semibold">📊 Earnings History:</span> Only completed lessons are shown below.
          </p>
        </div>

        <div className="space-y-4">
          {visibleWeeks.map((week) => {
            const isExpanded = expandedWeeks.has(week.weekLabel);
            const weekTitle = week.isCurrentWeek ? 'THIS WEEK' : week.isLastWeek ? 'LAST WEEK' : week.weekLabel.toUpperCase();
            
            return (
              <div key={week.weekLabel} className="bg-white rounded-lg shadow overflow-hidden">
                {/* Week Header */}
                <div 
                  className="p-4 bg-gradient-to-r from-green-50 to-green-100 border-b cursor-pointer hover:from-green-100 hover:to-green-200 transition-colors"
                  onClick={() => toggleWeek(week.weekLabel)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-green-600" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-green-600" />
                      )}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{weekTitle}</h3>
                        <p className="text-sm text-gray-600">
                          {week.weekLabel} • {week.totalBookings} lessons • {week.totalWorkingHours.toFixed(1)}h
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">${week.totalNet.toFixed(2)}</p>
                      <p className="text-sm text-gray-500">Net Earned</p>
                    </div>
                  </div>
                </div>

                {/* Expanded Week Details */}
                {isExpanded && (
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

                    {/* Individual Lessons */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Individual Lessons</h4>
                      <div className="space-y-2">
                        {week.transactions.map((transaction) => {
                          const isFromPackage = transaction.booking?.isPackageBooking && transaction.booking?.parentBookingId;
                          const bookingId = transaction.booking?.id;
                          return (
                            <div key={transaction.id} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    {bookingId ? (
                                      <Link 
                                        href={`/dashboard/bookings?highlight=${bookingId}`}
                                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                        title="View booking details"
                                      >
                                        {transaction.description}
                                      </Link>
                                    ) : (
                                      <p className="font-medium text-gray-900">{transaction.description}</p>
                                    )}
                                    {isFromPackage && (
                                      <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                                        📦 Package
                                      </span>
                                    )}
                                  </div>
                                  {transaction.booking && (
                                    <p className="text-xs text-gray-600">
                                      {transaction.booking.client.name} • {new Date(transaction.booking.startTime).toLocaleDateString('en-US', { 
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </p>
                                  )}
                                  <div className="text-xs text-gray-500 mt-1">
                                    Gross: ${transaction.amount.toFixed(2)} • Commission: -${transaction.platformFee.toFixed(2)}
                                  </div>
                                </div>
                                <div className="text-right ml-4">
                                  <p className="font-semibold text-green-600">${transaction.instructorPayout.toFixed(2)}</p>
                                  <p className="text-xs text-gray-500">net</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Weekly Receipt Button */}
                    <div className="border-t pt-4">
                      <button 
                        onClick={async () => {
                          try {
                            const weekStartISO = week.weekStart.toISOString().split('T')[0];
                            const response = await fetch(`/api/instructor/receipts/weekly?weekStart=${weekStartISO}`);
                            
                            if (response.ok) {
                              const blob = await response.blob();
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `weekly-receipt-${weekStartISO}.txt`;
                              document.body.appendChild(a);
                              a.click();
                              window.URL.revokeObjectURL(url);
                              document.body.removeChild(a);
                            } else {
                              alert('Failed to generate receipt. Please try again.');
                            }
                          } catch (error) {
                            console.error('Receipt download error:', error);
                            alert('Failed to download receipt. Please try again.');
                          }
                        }}
                        className="w-full px-4 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 font-medium"
                      >
                        <FileText className="h-5 w-5" />
                        Download Weekly Receipt
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* See More / Load More Button */}
          {hasMoreWeeks && (
            <div className="text-center">
              <button
                onClick={() => {
                  if (!showAllHistory) {
                    setShowAllHistory(true);
                    setWeeksToShow(6);
                  } else {
                    setWeeksToShow(prev => prev + 4);
                  }
                }}
                className="px-6 py-3 bg-white text-gray-700 rounded-lg shadow hover:bg-gray-50 transition-colors font-medium"
              >
                {!showAllHistory ? '📄 See More History' : 'Load More Weeks'}
              </button>
            </div>
          )}

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
            <li>• Earnings are recorded when lessons are completed</li>
            <li>• Payouts are processed weekly on Fridays</li>
            <li>• Download weekly receipts for your records</li>
            <li>• Monthly summaries available for tax purposes</li>
            <li>• For package hours not yet scheduled, see <Link href="/dashboard/packages" className="underline font-semibold">Packages page</Link></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
