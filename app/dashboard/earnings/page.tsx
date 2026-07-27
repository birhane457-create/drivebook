'use client';

import { useEffect, useState } from 'react';
import {
  DollarSign, Calendar, ChevronDown, ChevronRight,
  Clock, FileText, Receipt, Banknote, Info,
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/useToast';
import Toast from '@/components/ui/Toast';

// -- API response shapes -------------------------------------------------------

interface PlatformStats {
  totalEarnings: number;
  totalGross: number;
  totalFees: number;
  completedCount: number;
  thisMonthEarnings: number;
  thisMonthGross: number;
  thisMonthFees: number;
  thisMonthCount: number;
  pendingPayouts: number;
  pendingCount: number;
  scheduledTotal: number;
  scheduledCount: number;
}

interface OfflineStats {
  totalLogged: number;
  completedCount: number;
  thisMonthLogged: number;
  thisMonthCount: number;
  scheduledTotal: number;
  scheduledCount: number;
}

interface ScheduledPlatformBooking {
  id: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  clientName: string;
  instructorPayout: number;
  price: number;
  isFromPackage: boolean;
}

interface ScheduledOfflineBooking {
  id: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  clientName: string;
  offlineAmountPaid: number;
  offlinePaymentMethod: string;
}

interface Transaction {
  id: string;
  amount: number;
  platformFee: number;
  instructorPayout: number;
  status: string;
  createdAt: string;
  description: string;
  booking?: {
    id: string;
    isPackageBooking?: boolean;
    parentBookingId?: string;
    source?: string;
    client: { name: string } | null;
    startTime: string;
    endTime: string;
  };
}

interface EarningsData {
  platform: PlatformStats;
  offline: OfflineStats;
  totalEarnings: number;
  thisMonthEarnings: number;
  lastMonthEarnings: number;
  transactions: Transaction[];
  scheduledBookings: ScheduledPlatformBooking[];
  scheduledTotal: number;
  scheduledCount: number;
  scheduledOffline: ScheduledOfflineBooking[];
}

// -- Grouping helpers ----------------------------------------------------------

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

interface ScheduledDayGroup<T> {
  label: string;
  dateKey: string;
  items: T[];
}


// -- Component -----------------------------------------------------------------

export default function EarningsPage() {
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [scheduledOpen, setScheduledOpen] = useState(false);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [weeksToShow, setWeeksToShow] = useState(2);
  const { toast, showToast, clearToast } = useToast();

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

  function groupByDay<T>(items: T[], getDate: (item: T) => string): ScheduledDayGroup<T>[] {
    const map = new Map<string, T[]>();
    items.forEach(item => {
      const key = new Date(getDate(item)).toISOString().split('T')[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, its]) => {
        const d = new Date(key + 'T00:00:00');
        return {
          label: d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }),
          dateKey: key,
          items: its,
        };
      });
  }

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
        weekLabel: `${weekStart.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })} � ${weekEnd.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}`,
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

  if (loading) return <div className="flex items-center justify-center py-12 text-slate-400">Loading earnings�</div>;
  if (!earnings) return <div className="flex items-center justify-center py-12 text-red-400">Failed to load earnings data</div>;

  const p = earnings.platform;
  const o = earnings.offline;
  const weeklyEarnings = groupTransactionsByWeek(earnings.transactions);
  const visibleWeeks = weeklyEarnings.slice(0, showAllHistory ? weeksToShow : 2);
  const hasMoreWeeks = weeklyEarnings.length > visibleWeeks.length;
  const thisWeek = weeklyEarnings.find(w => w.isCurrentWeek);
  const lastWeek = weeklyEarnings.find(w => w.isLastWeek);

  const scheduledPlatformDays = groupByDay(earnings.scheduledBookings || [], b => b.startTime);
  const scheduledOfflineDays  = groupByDay(earnings.scheduledOffline || [], b => b.startTime);

  const hasAnyScheduled = (earnings.scheduledBookings?.length || 0) + (earnings.scheduledOffline?.length || 0) > 0;
  const hasOffline = o.completedCount > 0 || o.thisMonthCount > 0 || (earnings.scheduledOffline?.length || 0) > 0;

  const paymentMethodLabel: Record<string, string> = {
    cash: 'Cash',
    bank_transfer: 'Bank transfer',
    other: 'Other',
  };

  return (
    <div>
      <Toast toast={toast} onClose={clearToast} />
      <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-sm px-1 py-1">

        {/* -- Header -- */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Earnings</h1>
            <p className="text-sm text-slate-300 mt-0.5">Platform income + offline business records</p>
          </div>
          <Link href="/dashboard/packages" className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors">
            ?? Packages
          </Link>
        </div>

        {/* -- Platform stats (DriveBook-processed) -- */}
        <div className="mb-2 px-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Platform income <span className="normal-case font-normal text-slate-400">� paid via DriveBook, after commission</span>
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            {
              label: 'This Week',
              value: thisWeek?.totalNet || 0,
              sub: `${thisWeek?.totalBookings || 0} lessons`,
              icon: <DollarSign className="h-4 w-4 text-green-500" />,
              color: 'text-green-400',
            },
            {
              label: 'Last Week',
              value: lastWeek?.totalNet || 0,
              sub: `${lastWeek?.totalBookings || 0} lessons`,
              icon: <Calendar className="h-4 w-4 text-slate-400" />,
              color: 'text-slate-100',
            },
            {
              label: 'This Month',
              value: p.thisMonthEarnings,
              sub: `${p.thisMonthCount} lessons`,
              icon: <Calendar className="h-4 w-4 text-purple-400" />,
              color: 'text-slate-100',
            },
            {
              label: 'Pending payout',
              value: p.pendingPayouts,
              sub: `${p.pendingCount} transactions`,
              icon: <Clock className="h-4 w-4 text-amber-400" />,
              color: 'text-amber-400',
            },
          ].map(({ label, value, sub, icon, color }) => (
            <div key={label} className="bg-slate-950 rounded-2xl p-4 border border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-slate-300">{label}</p>
                {icon}
              </div>
              <p className={`text-xl font-bold ${color}`}>${value.toFixed(2)}</p>
              <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* -- Offline stats (cash / side income) -- */}
        {hasOffline && (
          <>
            <div className="mb-2 px-1 flex items-center gap-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Offline income <span className="normal-case font-normal text-slate-400">� cash / bank transfer, no platform fee</span>
              </p>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Info className="h-3 w-3" />
                not mixed with platform income
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
              {[
                {
                  label: 'This Month',
                  value: o.thisMonthLogged,
                  sub: `${o.thisMonthCount} offline lessons`,
                  icon: <Banknote className="h-4 w-4 text-emerald-500" />,
                  color: 'text-emerald-400',
                },
                {
                  label: 'Total Logged',
                  value: o.totalLogged,
                  sub: `${o.completedCount} completed`,
                  icon: <Banknote className="h-4 w-4 text-slate-400" />,
                  color: 'text-slate-100',
                },
                {
                  label: 'Scheduled',
                  value: o.scheduledTotal,
                  sub: `${o.scheduledCount} upcoming`,
                  icon: <Clock className="h-4 w-4 text-emerald-400" />,
                  color: 'text-emerald-400',
                },
              ].map(({ label, value, sub, icon, color }) => (
                <div key={label} className="bg-emerald-950/20 rounded-2xl p-4 border border-emerald-900/40">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-slate-300">{label}</p>
                    {icon}
                  </div>
                  <p className={`text-xl font-bold ${color}`}>${value.toFixed(2)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* -- Scheduled upcoming lessons (platform + offline combined) -- */}
        {hasAnyScheduled && (
          <div className="mb-4 bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
            <button
              onClick={() => setScheduledOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-900 hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center gap-2">
                {scheduledOpen ? <ChevronDown className="h-4 w-4 text-sky-400" /> : <ChevronRight className="h-4 w-4 text-sky-400" />}
                <Calendar className="h-4 w-4 text-sky-400" />
                <span className="font-semibold text-slate-100 text-sm">Upcoming Scheduled Lessons</span>
                <span className="text-xs text-slate-400">(platform + offline)</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-sky-400 text-sm">
                  ${((earnings.scheduledTotal || 0) + (o.scheduledTotal || 0)).toFixed(2)}
                </span>
                <span className="text-xs text-slate-500 ml-2">
                  {(earnings.scheduledCount || 0) + (o.scheduledCount || 0)} lessons
                </span>
              </div>
            </button>

            {scheduledOpen && (
              <div className="divide-y divide-slate-800">

                {/* Platform scheduled */}
                {scheduledPlatformDays.length > 0 && (
                  <>
                    <div className="px-4 py-1.5 bg-slate-900/50">
                      <p className="text-xs font-bold uppercase tracking-widest text-sky-600">Platform bookings</p>
                    </div>
                    {scheduledPlatformDays.map(day => (
                      <div key={day.dateKey}>
                        <div className="flex items-center justify-between px-4 py-2 bg-slate-900">
                          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">{day.label}</span>
                          <span className="text-xs text-slate-500">
                            ${day.items.reduce((s, b) => s + b.instructorPayout, 0).toFixed(2)} net
                          </span>
                        </div>
                        {day.items.map(b => (
                          <div key={b.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-900">
                            <div>
                              <p className="text-sm font-medium text-slate-100">
                                {new Date(b.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                                {' � '}{b.clientName}
                              </p>
                              <p className="text-xs text-slate-400">
                                {b.duration ? `${b.duration / 60}h` : ''}
                                {b.isFromPackage && <span className="ml-1 text-purple-400 font-semibold">pkg</span>}
                              </p>
                            </div>
                            <p className="text-sm font-semibold text-sky-400">${b.instructorPayout.toFixed(2)}</p>
                          </div>
                        ))}
                      </div>
                    ))}
                  </>
                )}

                {/* Offline scheduled */}
                {scheduledOfflineDays.length > 0 && (
                  <>
                    <div className="px-4 py-1.5 bg-emerald-900/10">
                      <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Offline / cash bookings</p>
                    </div>
                    {scheduledOfflineDays.map(day => (
                      <div key={day.dateKey}>
                        <div className="flex items-center justify-between px-4 py-2 bg-slate-900">
                          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">{day.label}</span>
                          <span className="text-xs text-slate-500">
                            ${day.items.reduce((s, b) => s + b.offlineAmountPaid, 0).toFixed(2)}
                          </span>
                        </div>
                        {day.items.map(b => (
                          <div key={b.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-900">
                            <div>
                              <p className="text-sm font-medium text-slate-100">
                                {new Date(b.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                                {' � '}{b.clientName}
                              </p>
                              <p className="text-xs text-slate-400">
                                {b.duration ? `${b.duration / 60}h � ` : ''}
                                <span className="text-emerald-500 font-medium">
                                  {paymentMethodLabel[b.offlinePaymentMethod] || b.offlinePaymentMethod}
                                </span>
                                {' � no commission'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-emerald-400">${b.offlineAmountPaid.toFixed(2)}</p>
                              <p className="text-xs text-emerald-500/70">offline</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}


        {/* -- Offline completed history -- */}
        {o.completedCount > 0 && (
          <div className="mb-4 bg-emerald-950/10 rounded-2xl border border-emerald-900/30 overflow-hidden">
            <button
              onClick={() => setOfflineOpen(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-emerald-900/10 transition-colors"
            >
              <div className="flex items-center gap-2">
                {offlineOpen ? <ChevronDown className="h-4 w-4 text-emerald-400" /> : <ChevronRight className="h-4 w-4 text-emerald-400" />}
                <Banknote className="h-4 w-4 text-emerald-400" />
                <span className="font-semibold text-slate-100 text-sm">Offline Income Log</span>
                <span className="text-xs text-slate-300">cash � bank transfer</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-emerald-400 text-sm">${o.totalLogged.toFixed(2)}</span>
                <span className="text-xs text-slate-400 ml-2">{o.completedCount} completed</span>
              </div>
            </button>
            {offlineOpen && (
              <div className="px-4 py-3 border-t border-emerald-900/30">
                <p className="text-xs text-slate-300 text-center">
                  Offline lesson history is recorded in your bookings.{' '}
                  <Link href="/dashboard/bookings" className="text-emerald-400 hover:underline">
                    View in Bookings ?
                  </Link>
                </p>
              </div>
            )}
          </div>
        )}

        {/* -- Platform earnings history -- */}
        <p className="text-xs text-slate-400 mb-3 px-1">
          ?? Platform earnings history � DriveBook-processed lessons only
        </p>

        <div className="space-y-3">
          {visibleWeeks.map(week => {
            const isExpanded = expandedWeeks.has(week.weekLabel);
            const title = week.isCurrentWeek ? 'This Week' : week.isLastWeek ? 'Last Week' : week.weekLabel;

            return (
              <div key={week.weekLabel} className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800">

                {/* Week header */}
                <button
                  onClick={() => toggleWeek(week.weekLabel)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-950 hover:bg-slate-900 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-green-500" /> : <ChevronRight className="h-4 w-4 text-green-500" />}
                    <div className="text-left">
                      <p className="font-semibold text-slate-100 text-sm">{title}</p>
                      <p className="text-xs text-slate-400">
                        {week.weekLabel} � {week.totalBookings} lesson{week.totalBookings !== 1 ? 's' : ''} � {week.totalWorkingHours.toFixed(1)}h
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-400 text-base">${week.totalNet.toFixed(2)}</p>
                    <p className="text-xs text-slate-400">net earned</p>
                  </div>
                </button>

                {isExpanded && (
                  <div>
                    {/* Week summary strip */}
                    <div className="grid grid-cols-4 divide-x divide-slate-800 border-y border-slate-800 bg-slate-900">
                      {[
                        { label: 'Hours',      val: `${week.totalWorkingHours.toFixed(1)}h` },
                        { label: 'Lessons',    val: week.totalBookings },
                        { label: 'Gross',      val: `$${week.totalGross.toFixed(2)}` },
                        { label: 'Commission', val: `-$${(week.totalGross - week.totalNet).toFixed(2)}`, red: true },
                      ].map(({ label, val, red }) => (
                        <div key={label} className="px-3 py-2 text-center">
                          <p className="text-xs text-slate-400">{label}</p>
                          <p className={`text-sm font-semibold ${red ? 'text-red-400' : 'text-slate-100'}`}>{val}</p>
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
                            <button
                              onClick={() => toggleDay(dayKey)}
                              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-900 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                {dayExpanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-500" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-500" />}
                                <span className="text-sm font-medium text-slate-100">{day.label}</span>
                                <span className="text-xs text-slate-400">
                                  {day.transactions.length} lesson{day.transactions.length !== 1 ? 's' : ''} � {day.totalHours.toFixed(1)}h
                                </span>
                              </div>
                              <span className="text-sm font-semibold text-green-400">${day.totalNet.toFixed(2)}</span>
                            </button>

                            {dayExpanded && day.transactions.map(t => {
                              const isFromPackage = t.booking?.isPackageBooking && t.booking?.parentBookingId;
                              return (
                                <div key={t.id} className="flex items-start justify-between px-6 py-2 bg-slate-950 border-t border-slate-800">
                                  <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {t.booking?.id ? (
                                        <Link
                                          href={`/dashboard/bookings?highlight=${t.booking.id}`}
                                          className="text-sm text-sky-400 hover:underline"
                                        >
                                          {t.description}
                                        </Link>
                                      ) : (
                                        <span className="text-sm text-slate-100">{t.description}</span>
                                      )}
                                      {isFromPackage && (
                                        <span className="text-xs px-1.5 py-0.5 bg-purple-900/40 text-purple-300 border border-purple-700/40 rounded font-medium">
                                          pkg
                                        </span>
                                      )}
                                    </div>
                                    {t.booking && (
                                      <p className="text-xs text-slate-400 mt-0.5">
                                        {t.booking.client?.name ?? 'Guest'} � {new Date(t.booking.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                                      </p>
                                    )}
                                    <p className="text-xs text-slate-500">
                                      Gross ${t.amount.toFixed(2)} � Commission -${t.platformFee.toFixed(2)}
                                    </p>
                                    <Link
                                      href={`/dashboard/invoice/${t.id}`}
                                      className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-sky-400 mt-0.5 transition-colors"
                                    >
                                      <Receipt className="h-3 w-3" />
                                      View invoice
                                    </Link>
                                  </div>
                                  <div className="text-right ml-4 shrink-0">
                                    <p className="text-sm font-semibold text-green-400">${t.instructorPayout.toFixed(2)}</p>
                                    <p className="text-xs text-slate-400">net</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>

                    {/* Download receipt */}
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
                              a.href = url;
                              a.download = `receipt-${weekStartISO}.txt`;
                              document.body.appendChild(a); a.click();
                              window.URL.revokeObjectURL(url); document.body.removeChild(a);
                            } else {
                              showToast('error', 'Failed to generate receipt.');
                            }
                          } catch {
                            showToast('error', 'Failed to download receipt.');
                          }
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
                onClick={() => { setShowAllHistory(true); setWeeksToShow(prev => prev + 4); }}
                className="px-5 py-2 bg-slate-950 text-slate-300 text-sm rounded-xl border border-slate-800 hover:bg-slate-900 transition-colors"
              >
                Load more weeks
              </button>
            </div>
          )}

          {weeklyEarnings.length === 0 && (
            <div className="bg-slate-950 rounded-xl border border-slate-800 p-10 text-center">
              <p className="text-slate-500 text-sm">No platform earnings yet. Completed lessons will appear here.</p>
            </div>
          )}
        </div>

        {/* -- Footer info -- */}
        <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-sky-400 mb-1">Platform income</p>
            <ul className="text-xs text-slate-400 space-y-0.5">
              <li>� Recorded when lessons are completed and checked out</li>
              <li>� Payouts processed automatically every Tuesday (AWST)</li>
              <li>� Commission deducted before payout � varies by subscription tier</li>
              <li>� For package hours not yet scheduled, see <Link href="/dashboard/packages" className="text-sky-400 hover:underline">Packages</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-emerald-400 mb-1">Offline income</p>
            <ul className="text-xs text-slate-400 space-y-0.5">
              <li>� Self-reported cash / bank transfer lessons (PRO+)</li>
              <li>� No platform commission � full amount is yours</li>
              <li>� Kept separate from platform income � not included in payout calculations</li>
              <li>� Log offline bookings from <Link href="/dashboard/bookings" className="text-emerald-400 hover:underline">Bookings ? New Offline</Link></li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}
