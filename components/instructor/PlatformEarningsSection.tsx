'use client';

import { useState } from 'react';
import { DollarSign, Calendar, ChevronDown, ChevronRight, Clock, FileText, TrendingUp } from 'lucide-react';
import Link from 'next/link';

interface Transaction {
  id: string;
  amount: number;
  platformFee: number;
  instructorPayout: number;
  status: string;
  createdAt: string;
  booking?: {
    id: string;
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
  byDay: DayGroup[];
}

interface DayGroup {
  label: string;
  dateKey: string;
  transactions: Transaction[];
  totalNet: number;
  totalHours: number;
}

interface PlatformEarningsData {
  thisWeek?: { totalNet: number; totalGross: number; bookings: number };
  lastWeek?: { totalNet: number; totalGross: number; bookings: number };
  thisMonth?: { totalNet: number; totalGross: number; fees: number; bookings: number };
  scheduled?: { total: number; count: number };
  weeklyBreakdown?: WeeklyEarnings[];
}

export default function PlatformEarningsSection({ 
  data 
}: { 
  data: PlatformEarningsData 
}) {
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [weeksToShow, setWeeksToShow] = useState(2);

  const toggleWeek = (label: string) => {
    const s = new Set(expandedWeeks);
    s.has(label) ? s.delete(label) : s.add(label);
    setExpandedWeeks(s);
  };

  const toggleDay = (key: string) => {
    const s = new Set(expandedDays);
    s.has(key) ? s.delete(key) : s.add(key);
    setExpandedDays(s);
  };

  const weeklyEarnings = data.weeklyBreakdown || [];
  const visibleWeeks = weeklyEarnings.slice(0, showAllHistory ? weeksToShow : 2);
  const hasMoreWeeks = weeklyEarnings.length > visibleWeeks.length;
  const thisWeek = weeklyEarnings.find(w => w.isCurrentWeek);
  const lastWeek = weeklyEarnings.find(w => w.isLastWeek);

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 mb-3">
          <DollarSign className="h-5 w-5 text-green-600" />
          💳 Platform Earnings
        </h2>
        <p className="text-sm text-slate-400">Money from lessons paid through DriveBook — verified payments only</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { 
            label: 'This Week', 
            value: thisWeek?.totalNet || 0, 
            sub: `${thisWeek?.totalBookings || 0} lessons`, 
            icon: <DollarSign className="h-4 w-4 text-green-600" />,
            change: thisWeek && lastWeek ? ((thisWeek.totalNet - lastWeek.totalNet) / (lastWeek.totalNet || 1) * 100) : 0
          },
          { 
            label: 'Last Week', 
            value: lastWeek?.totalNet || 0, 
            sub: `${lastWeek?.totalBookings || 0} lessons`, 
            icon: <Calendar className="h-4 w-4 text-sky-400" /> 
          },
          { 
            label: 'This Month', 
            value: data.thisMonth?.totalNet || 0, 
            sub: `${data.thisMonth?.bookings || 0} lessons`, 
            icon: <Calendar className="h-4 w-4 text-purple-600" />,
            details: `Gross: $${(data.thisMonth?.totalGross || 0).toFixed(2)}`
          },
          { 
            label: 'Scheduled', 
            value: data.scheduled?.total || 0, 
            sub: `${data.scheduled?.count || 0} confirmed`, 
            icon: <Clock className="h-4 w-4 text-sky-400" />,
            blue: true 
          },
        ].map(({ label, value, sub, icon, blue, change, details }) => (
          <div key={label} className="bg-slate-950 rounded-lg shadow-sm p-4 border border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-slate-400">{label}</p>
              {icon}
            </div>
            <p className={`text-xl font-bold ${blue ? 'text-sky-400' : 'text-slate-100'}`}>${value.toFixed(2)}</p>
            <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
            {change !== undefined && change !== 0 && (
              <p className={`text-xs mt-1 ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(0)}% vs last week
              </p>
            )}
            {details && <p className="text-xs text-slate-400 mt-1">{details}</p>}
          </div>
        ))}
      </div>

      {/* Weekly Breakdown */}
      {weeklyEarnings.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400 px-1">📊 Earnings history — completed lessons only</p>
          
          {visibleWeeks.map(week => {
            const isExpanded = expandedWeeks.has(week.weekLabel);
            const title = week.isCurrentWeek ? 'This Week' : week.isLastWeek ? 'Last Week' : week.weekLabel;

            return (
              <div key={week.weekLabel} className="bg-slate-950 rounded-lg shadow-sm overflow-hidden border border-slate-800">
                {/* Week header */}
                <button
                  onClick={() => toggleWeek(week.weekLabel)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-950 hover:bg-slate-900 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-green-600" /> : <ChevronRight className="h-4 w-4 text-green-600" />}
                    <div className="text-left">
                      <p className="font-semibold text-slate-100 text-sm">{title}</p>
                      <p className="text-xs text-slate-400">{week.weekLabel} · {week.totalBookings} lessons · {week.totalWorkingHours.toFixed(1)}h</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600 text-base">${week.totalNet.toFixed(2)}</p>
                    <p className="text-xs text-slate-400">net earned</p>
                  </div>
                </button>

                {isExpanded && (
                  <div>
                    {/* Week summary strip */}
                    <div className="grid grid-cols-4 divide-x divide-slate-800 border-b border-slate-800 bg-slate-900">
                      {[
                        { label: 'Hours', val: `${week.totalWorkingHours.toFixed(1)}h` },
                        { label: 'Lessons', val: week.totalBookings },
                        { label: 'Gross', val: `$${week.totalGross.toFixed(2)}` },
                        { label: 'Commission', val: `-$${(week.totalGross - week.totalNet).toFixed(2)}`, red: true },
                      ].map(({ label, val, red }) => (
                        <div key={label} className="px-3 py-2 text-center">
                          <p className="text-xs text-slate-400">{label}</p>
                          <p className={`text-sm font-semibold ${red ? 'text-red-500' : 'text-slate-100'}`}>{val}</p>
                        </div>
                      ))}
                    </div>

                    {/* Days */}
                    <div className="divide-y divide-slate-800">
                      {week.byDay.map(day => {
                        const dayKey = `${week.weekLabel}:${day.dateKey}`;
                        const dayExpanded = expandedDays.has(dayKey);
                        return (
                          <div key={day.dateKey}>
                            {/* Day row */}
                            <button
                              onClick={() => toggleDay(dayKey)}
                              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-900 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                {dayExpanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                                <span className="text-sm font-medium text-slate-100">{day.label}</span>
                                <span className="text-xs text-slate-400">{day.transactions.length} lesson{day.transactions.length !== 1 ? 's' : ''} · {day.totalHours.toFixed(1)}h</span>
                              </div>
                              <span className="text-sm font-semibold text-green-600">${day.totalNet.toFixed(2)}</span>
                            </button>

                            {/* Individual lessons */}
                            {dayExpanded && day.transactions.map(t => (
                              <div key={t.id} className="flex items-start justify-between px-6 py-2 bg-slate-950 border-t border-slate-800">
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    {t.booking?.id ? (
                                      <Link href={`/dashboard/bookings?highlight=${t.booking.id}`} className="text-sm text-sky-400 hover:underline">
                                        {t.description}
                                      </Link>
                                    ) : (
                                      <span className="text-sm text-slate-100">{t.description}</span>
                                    )}
                                  </div>
                                  {t.booking && (
                                    <p className="text-xs text-slate-400 mt-0.5">
                                      {t.booking.client?.name ?? 'Guest'} · {new Date(t.booking.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  )}
                                  <p className="text-xs text-slate-400">Gross ${t.amount.toFixed(2)} · Commission -${t.platformFee.toFixed(2)}</p>
                                </div>
                                <div className="text-right ml-4 shrink-0">
                                  <p className="text-sm font-semibold text-green-600">${t.instructorPayout.toFixed(2)}</p>
                                  <p className="text-xs text-slate-400">net</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>

                    {/* Receipt button */}
                    <div className="px-4 py-3 border-t border-slate-800">
                      <button
                        onClick={async () => {
                          try {
                            const weekStartISO = week.weekStart.toISOString().split('T')[0];
                            const res = await fetch(`/api/instructor/receipts/weekly?weekStart=${weekStartISO}`);
                            if (res.ok) {
                              const blob = await res.blob();
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url; a.download = `receipt-${weekStartISO}.txt`;
                              document.body.appendChild(a); a.click();
                              window.URL.revokeObjectURL(url); document.body.removeChild(a);
                            } else { alert('Failed to generate receipt.'); }
                          } catch { alert('Failed to download receipt.'); }
                        }}
                        className="w-full px-3 py-2 bg-slate-900 text-sky-400 text-sm rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 font-medium"
                      >
                        <FileText className="h-4 w-4" />
                        Download Weekly Receipt
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {hasMoreWeeks && (
            <div className="text-center">
              <button
                onClick={() => { setShowAllHistory(true); setWeeksToShow(p => p + 4); }}
                className="px-5 py-2 bg-slate-950 text-slate-100 text-sm rounded-lg shadow-sm hover:bg-slate-900 transition-colors font-medium border border-slate-800"
              >
                Load more weeks
              </button>
            </div>
          )}

          {weeklyEarnings.length === 0 && (
            <div className="bg-slate-950 rounded-lg shadow-sm p-10 text-center border border-slate-800">
              <p className="text-slate-400 text-sm">No platform earnings yet. Complete lessons to see them here.</p>
            </div>
          )}
        </div>
      )}

      {/* Info box */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
        <p className="text-xs font-semibold text-green-300 mb-1">💳 About Platform Earnings</p>
        <ul className="text-xs text-green-300 space-y-1">
          <li>• Only lessons paid through DriveBook are included</li>
          <li>• Earnings recorded when lessons are completed</li>
          <li>• Platform fees are deducted from your payout</li>
          <li>• Payouts processed weekly on Fridays</li>
          <li>• Download weekly receipts for your records</li>
        </ul>
      </div>
    </div>
  );
}
