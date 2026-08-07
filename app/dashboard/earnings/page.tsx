'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/hooks/useToast';
import Toast from '@/components/ui/Toast';
import { getLocalDateKey, resolveTimezone, DEFAULT_TIMEZONE } from '@/lib/utils/timezone';
import PlatformEarningsSection from '@/components/instructor/PlatformEarningsSection';
import OfflineEarningsSection from '@/components/instructor/OfflineEarningsSection';
import UpcomingScheduledSection from '@/components/instructor/UpcomingScheduledSection';

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return d;
}

function groupTransactionsByWeek(transactions: Transaction[], tz: string): WeeklyEarnings[] {
  const weekMap = new Map<string, Transaction[]>();
  const completed = transactions.filter(t => t.status === 'COMPLETED');
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const currentWeekStart = getWeekStart(now);
  const lastWeekStart = new Date(currentWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  completed.forEach(t => {
    // Group by lesson date (booking startTime), not transaction createdAt
    const lessonDate = t.booking?.startTime ? new Date(t.booking.startTime) : new Date(t.createdAt);
    const localKey = getLocalDateKey(lessonDate, tz); // YYYY-MM-DD in instructor's TZ
    const ws = getWeekStart(new Date(localKey + 'T12:00:00Z'));
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
    // Use booking start/end times for working hours — only count when both exist
    const totalWorkingHours = txns.reduce((s, t) => {
      if (t.booking?.startTime && t.booking?.endTime) {
        const h = (new Date(t.booking.endTime).getTime() - new Date(t.booking.startTime).getTime()) / 3600000;
        return s + (h > 0 ? h : 0);
      }
      return s;
    }, 0);

    const dayMap = new Map<string, Transaction[]>();
    txns.forEach(t => {
      // Group days by lesson date in instructor's TZ
      const lessonDate = t.booking?.startTime ? new Date(t.booking.startTime) : new Date(t.createdAt);
      const dk = getLocalDateKey(lessonDate, tz);
      if (!dayMap.has(dk)) dayMap.set(dk, []);
      dayMap.get(dk)!.push(t);
    });

    const byDay: DayGroup[] = Array.from(dayMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dk, dt]) => {
        const dayDate = new Date(dk + 'T12:00:00Z');
        return {
          label: dayDate.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }),
          dateKey: dk,
          transactions: dt.sort((a, b) => {
            const ta = a.booking?.startTime ? new Date(a.booking.startTime).getTime() : new Date(a.createdAt).getTime();
            const tb = b.booking?.startTime ? new Date(b.booking.startTime).getTime() : new Date(b.createdAt).getTime();
            return tb - ta;
          }),
          totalNet: dt.reduce((s, t) => s + t.instructorPayout, 0),
          totalHours: dt.reduce((s, t) => {
            if (t.booking?.startTime && t.booking?.endTime) {
              const h = (new Date(t.booking.endTime).getTime() - new Date(t.booking.startTime).getTime()) / 3600000;
              return s + (h > 0 ? h : 0);
            }
            return s;
          }, 0),
        };
      });

    const cwk = currentWeekStart.toISOString().split('T')[0];
    const lwk = lastWeekStart.toISOString().split('T')[0];

    weeks.push({
      weekStart, weekEnd,
      weekLabel: `${weekStart.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })} \u2013 ${weekEnd.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}`,
      isCurrentWeek: weekKey === cwk,
      isLastWeek: weekKey === lwk,
      totalNet, totalGross, totalWorkingHours,
      totalBookings: txns.filter(t => t.booking).length,
      transactions: txns,
      byDay,
    });
  });

  return weeks.sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EarningsPage() {
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [instructorTz, setInstructorTz] = useState(DEFAULT_TIMEZONE);
  const { toast, clearToast } = useToast();

  useEffect(() => {
    // Fetch timezone alongside earnings so weekly grouping is timezone-aware
    Promise.all([
      fetch('/api/instructor/earnings'),
      fetch('/api/instructor/settings'),
    ]).then(async ([earningsRes, settingsRes]) => {
      if (earningsRes.ok) setEarnings(await earningsRes.json());
      else console.error('Earnings API error:', earningsRes.status);
      if (settingsRes.ok) {
        const s = await settingsRes.json();
        if (s.timezone) setInstructorTz(resolveTimezone(s.timezone));
      }
    }).catch(e => {
      console.error('Failed to fetch earnings:', e);
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-12 text-slate-400">Loading earnings\u2026</div>
  );
  if (!earnings) return (
    <div className="flex items-center justify-center py-12 text-red-400">Failed to load earnings data</div>
  );

  const p = earnings.platform;
  const o = earnings.offline;
  const weeklyEarnings = groupTransactionsByWeek(earnings.transactions, instructorTz);

  const hasOffline = o.completedCount > 0 || o.thisMonthCount > 0 || (earnings.scheduledOffline?.length || 0) > 0;

  // Shape data for PlatformEarningsSection
  const thisWeek = weeklyEarnings.find(w => w.isCurrentWeek);
  const lastWeek = weeklyEarnings.find(w => w.isLastWeek);
  const platformData = {
    thisWeek:  thisWeek ? { totalNet: thisWeek.totalNet, totalGross: thisWeek.totalGross, bookings: thisWeek.totalBookings } : undefined,
    lastWeek:  lastWeek ? { totalNet: lastWeek.totalNet, totalGross: lastWeek.totalGross, bookings: lastWeek.totalBookings } : undefined,
    thisMonth: {
      totalNet:   p.thisMonthEarnings,
      totalGross: p.thisMonthGross,
      fees:       p.thisMonthFees,
      bookings:   p.thisMonthCount,
    },
    scheduled:       { total: p.scheduledTotal, count: p.scheduledCount },
    weeklyBreakdown: weeklyEarnings,
  };

  // Shape data for OfflineEarningsSection
  const offlineData = {
    thisMonth:   { logged: o.thisMonthLogged, bookings: o.thisMonthCount },
    scheduled:   { total: o.scheduledTotal,   count: o.scheduledCount },
    allBookings: (earnings.scheduledOffline || []).map(b => ({
      id:                   b.id,
      startTime:            b.startTime,
      endTime:              b.endTime ?? b.startTime,
      duration:             b.duration ?? 0,
      clientName:           b.clientName,
      offlineAmountPaid:    b.offlineAmountPaid,
      offlinePaymentMethod: b.offlinePaymentMethod,
    })),
  };

  // Shape data for UpcomingScheduledSection
  const scheduledData = {
    platformBookings:       earnings.scheduledBookings || [],
    offlineBookings:        earnings.scheduledOffline  || [],
    platformScheduledTotal: earnings.scheduledTotal    || 0,
    platformScheduledCount: earnings.scheduledCount    || 0,
    offlineScheduledTotal:  o.scheduledTotal,
    offlineScheduledCount:  o.scheduledCount,
  };

  return (
    <div>
      <Toast toast={toast} onClose={clearToast} />
      <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-sm p-4 sm:p-6 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Earnings</h1>
            <p className="text-sm text-slate-300 mt-0.5">Platform income + offline business records</p>
          </div>
          <Link
            href="/dashboard/packages"
            className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
          >
            Packages
          </Link>
        </div>

        {/* Platform earnings */}
        <PlatformEarningsSection data={platformData} timezone={instructorTz} />

        {/* Offline earnings — only shown when the instructor has offline activity */}
        {hasOffline && (
          <OfflineEarningsSection data={offlineData} timezone={instructorTz} />
        )}

        {/* Upcoming scheduled lessons — platform + offline combined */}
        <UpcomingScheduledSection data={scheduledData} timezone={instructorTz} />

        {/* Footer info */}
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-sky-400 mb-1">Platform income</p>
            <ul className="text-xs text-slate-400 space-y-0.5">
              <li>· Recorded when lessons are completed and checked out</li>
              <li>· Payouts processed automatically every Tuesday (AWST)</li>
              <li>· Commission deducted before payout — varies by subscription tier</li>
              <li>· For package hours not yet scheduled, see <Link href="/dashboard/packages" className="text-sky-400 hover:underline">Packages</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-emerald-400 mb-1">Offline income</p>
            <ul className="text-xs text-slate-400 space-y-0.5">
              <li>· Self-reported cash / bank transfer lessons (PRO+)</li>
              <li>· No platform commission — full amount is yours</li>
              <li>· Kept separate from platform income — not included in payout calculations</li>
              <li>· Log offline bookings from <Link href="/dashboard/bookings" className="text-emerald-400 hover:underline">Bookings → New Offline</Link></li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}
