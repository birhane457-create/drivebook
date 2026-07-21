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
  byDay: DayGroup[];
}

interface DayGroup {
  label: string;
  dateKey: string;
  transactions: Transaction[];
  totalNet: number;
  totalHours: number;
}

interface ScheduledDayGroup {
  label: string;
  dateKey: string;
  bookings: ScheduledBooking[];
  totalPayout: number;
}

export default function EarningsPage() {
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [scheduledOpen, setScheduledOpen] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [weeksToShow, setWeeksToShow] = useState(2);

  useEffect(() => { fetchEarnings(); }, []);

  const fetchEarnings = async () => {
    try {
      const res = await fetch('/api/instructor/earnings');
      if (res.ok) setEarnings(await res.json());
    } catch (e) {
      console.error('Failed to fetch earnings:', e);
    } finally {
      setLoading(false);
    }
  };

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

  const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
    return d;
  };

  const groupScheduledByDay = (bookings: ScheduledBooking[]): ScheduledDayGroup[] => {
    const map = new Map<string, ScheduledBooking[]>();
    bookings.forEach(b => {
      const d = new Date(b.startTime);
      const key = d.toISOString().split('T')[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, bks]) => {
        const d = new Date(bks[0].startTime);
        return {
          label: d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }),
          dateKey: key,
          bookings: bks.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
          totalPayout: bks.reduce((s, b) => s + b.instructorPayout, 0),
        };
      });
  };

  const groupTransactionsByWeek = (transactions: Transaction[]): WeeklyEarnings[] => {
    const weekMap = new Map<string, Transaction[]>();
    const completed = transactions.filter(t => t.status === 'COMPLETED');
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const currentWeekStart = getWeekStart(now);
    const lastWeekStart = new Date(currentWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    completed.forEach(t => {
      const d = new Date(t.createdAt); d.setHours(0, 0, 0, 0);
      const ws = getWeekStart(d);
      const key = ws.toISOString().split('T')[0];
      if (!weekMap.has(key)) weekMap.set(key, []);
      weekMap.get(key)!.push(t);
    });

    const weeks: WeeklyEarnings[] = [];
    weekMap.forEach((txns, weekKey) => {
      const [y, m, d] = weekKey.split('-').map(Number);
      const weekStart = new Date(y, m - 1, d);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const totalGross = txns.reduce((s, t) => s + t.amount, 0);
      const totalNet = txns.reduce((s, t) => s + t.instructorPayout, 0);
      const totalWorkingHours = txns.reduce((s, t) => {
        if (t.booking) {
          const h = (new Date(t.booking.endTime).getTime() - new Date(t.booking.startTime).getTime()) / 3600000;
          return s + h;
        }
        return s;
      }, 0);

      // Group by day
      const dayMap = new Map<string, Transaction[]>();
      txns.forEach(t => {
        const dk = new Date(t.booking?.startTime || t.createdAt).toISOString().split('T')[0];
        if (!dayMap.has(dk)) dayMap.set(dk, []);
        dayMap.get(dk)!.push(t);
      });
      const byDay: DayGroup[] = Array.from(dayMap.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([dk, dt]) => {
          const dayDate = new Date(dk + 'T00:00:00');
          return {
            label: dayDate.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }),
            dateKey: dk,
            transactions: dt.sort((a, b) =>
              new Date(b.booking?.startTime || b.createdAt).getTime() -
              new Date(a.booking?.startTime || a.createdAt).getTime()
            ),
            totalNet: dt.reduce((s, t) => s + t.instructorPayout, 0),
            totalHours: dt.reduce((s, t) => {
              if (t.booking) return s + (new Date(t.booking.endTime).getTime() - new Date(t.booking.startTime).getTime()) / 3600000;
              return s;
            }, 0),
          };
        });

      const cwk = currentWeekStart.toISOString().split('T')[0];
      const lwk = lastWeekStart.toISOString().split('T')[0];

      weeks.push({
        weekStart, weekEnd,
        weekLabel: `${weekStart.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}`,
        isCurrentWeek: weekKey === cwk,
        isLastWeek: weekKey === lwk,
        totalNet, totalGross, totalWorkingHours,
        totalBookings: txns.filter(t => t.booking).length,
        transactions: txns,
        byDay,
      });
    });

    return weeks.sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());
  };

  if (loading) return <div className="flex items-center justify-center py-12 text-slate-400">Loading earnings...</div>;
  if (!earnings) return <div className="flex items-center justify-center py-12 text-red-400">Failed to load earnings data</div>;

  const weeklyEarnings = groupTransactionsByWeek(earnings.transactions);
  const visibleWeeks = weeklyEarnings.slice(0, showAllHistory ? weeksToShow : 2);
  const hasMoreWeeks = weeklyEarnings.length > visibleWeeks.length;
  const thisWeek = weeklyEarnings.find(w => w.isCurrentWeek);
  const lastWeek = weeklyEarnings.find(w => w.isLastWeek);
  const scheduledDays = groupScheduledByDay(earnings.scheduledBookings || []);

  return (
    <div>
      <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-sm px-1 py-1">

        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Earnings</h1>
            <p className="text-sm text-slate-400 mt-0.5">Money from lessons you've taught</p>
          </div>
          <Link href="/dashboard/packages" className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors">
            📦 Packages
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'This Week', value: thisWeek?.totalNet || 0, sub: `${thisWeek?.totalBookings || 0} lessons`, icon: <DollarSign className="h-4 w-4 text-green-600" /> },
            { label: 'Last Week', value: lastWeek?.totalNet || 0, sub: `${lastWeek?.totalBookings || 0} lessons`, icon: <Calendar className="h-4 w-4 text-sky-400" /> },
            { label: 'This Month', value: earnings.thisMonthEarnings, sub: 'Month to date', icon: <Calendar className="h-4 w-4 text-purple-600" /> },
            { label: 'Scheduled', value: earnings.scheduledTotal, sub: `${earnings.scheduledCount} confirmed`, icon: <Clock className="h-4 w-4 text-sky-400" />, blue: true },
          ].map(({ label, value, sub, icon, blue }) => (
            <div key={label} className="bg-slate-950 rounded-3xl shadow-sm p-4 border border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-slate-400">{label}</p>
                {icon}
              </div>
              <p className={`text-xl font-bold ${blue ? 'text-sky-400' : 'text-slate-100'}`}>${value.toFixed(2)}</p>
              <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* Scheduled Lessons — collapsible */}
        {earnings.scheduledBookings && earnings.scheduledBookings.length > 0 && (
          <div className="mb-4 bg-slate-950 rounded-3xl shadow-sm border border-slate-800 overflow-hidden">
            <button
              onClick={() => setScheduledOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-900 hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center gap-2">
                {scheduledOpen ? <ChevronDown className="h-4 w-4 text-sky-400" /> : <ChevronRight className="h-4 w-4 text-sky-400" />}
                <Calendar className="h-4 w-4 text-sky-400" />
                <span className="font-semibold text-slate-100 text-sm">Scheduled Lessons</span>
                <span className="text-xs text-slate-400">(will earn when taught)</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-sky-400 text-sm">${earnings.scheduledTotal.toFixed(2)}</span>
                <span className="text-xs text-slate-400 ml-2">{earnings.scheduledCount} confirmed</span>
              </div>
            </button>

            {scheduledOpen && (
              <div className="divide-y divide-slate-800">
                {scheduledDays.map(day => (
                  <div key={day.dateKey}>
                    {/* Day sub-header */}
                    <div className="flex items-center justify-between px-4 py-2 bg-slate-900">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{day.label}</span>
                      <span className="text-xs text-slate-400">Total <span className="font-semibold text-sky-400">${day.totalPayout.toFixed(2)}</span></span>
                    </div>
                    {day.bookings.map(b => (
                      <div key={b.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-900">
                        <div>
                          <p className="text-sm font-medium text-slate-100">
                            {new Date(b.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                            {' · '}{b.clientName}
                          </p>
                          <p className="text-xs text-slate-400">
                            {b.duration}h
                            {b.isFromPackage && <span className="ml-1 text-purple-400 font-semibold">pkg</span>}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-sky-400">${b.instructorPayout.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Earnings History note */}
        <p className="text-xs text-slate-400 mb-3 px-1">📊 Earnings history — completed lessons only</p>

        {/* Weekly groups */}
        <div className="space-y-3">
          {visibleWeeks.map(week => {
            const isExpanded = expandedWeeks.has(week.weekLabel);
            const title = week.isCurrentWeek ? 'This Week' : week.isLastWeek ? 'Last Week' : week.weekLabel;

            return (
              <div key={week.weekLabel} className="bg-slate-950 rounded-lg shadow-sm overflow-hidden">
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
                            {/* Day row — clickable */}
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
                            {dayExpanded && day.transactions.map(t => {
                              const isFromPackage = t.booking?.isPackageBooking && t.booking?.parentBookingId;
                              return (
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
                                      {isFromPackage && <span className="text-xs px-1.5 py-0.5 bg-purple-900/40 text-purple-300 border border-purple-700/40 rounded font-medium">pkg</span>}
                                    </div>
                                    {t.booking && (
                                      <p className="text-xs text-slate-400 mt-0.5">
                                        {t.booking.client?.name ?? (t.booking as any).clientName ?? 'Guest'} · {new Date(t.booking.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                                      </p>
                                    )}
                                    <p className="text-xs text-slate-400">Gross ${t.amount.toFixed(2)} · Commission -${t.platformFee.toFixed(2)}</p>
                                  </div>
                                  <div className="text-right ml-4 shrink-0">
                                    <p className="text-sm font-semibold text-green-600">${t.instructorPayout.toFixed(2)}</p>
                                    <p className="text-xs text-slate-400">net</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>

                    {/* Receipt */}
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
                className="px-5 py-2 bg-slate-950 text-slate-100 text-sm rounded-lg shadow-sm hover:bg-slate-900 transition-colors font-medium"
              >
                Load more weeks
              </button>
            </div>
          )}

          {weeklyEarnings.length === 0 && (
            <div className="bg-slate-950 rounded-lg shadow-sm p-10 text-center">
              <p className="text-slate-400 text-sm">No earnings yet. Complete lessons to see them here.</p>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-5 bg-slate-950 border border-slate-800 rounded-lg p-4">
          <p className="text-xs font-semibold text-green-300 mb-1">ℹ️ About Earnings</p>
          <ul className="text-xs text-green-300 space-y-1">
            <li>• Earnings recorded when lessons are completed</li>
            <li>• Payouts processed weekly on Fridays</li>
            <li>• Download weekly receipts for your records</li>
            <li>• For package hours not yet scheduled, see <Link href="/dashboard/packages" className="underline font-semibold">Packages</Link></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
