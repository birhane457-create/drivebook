'use client';

/**
 * UpcomingScheduledSection
 *
 * Combined upcoming lesson list for the earnings page.
 * Shows platform bookings and offline/cash bookings grouped by day.
 * Label adapts: "platform", "offline", or "platform + offline" based on what's present.
 *
 * Used by: app/dashboard/earnings/page.tsx
 */

import { useState } from 'react';
import { Calendar, ChevronDown, ChevronRight } from 'lucide-react';
import { resolveTimezone, DEFAULT_TIMEZONE } from '@/lib/utils/timezone';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScheduledPlatformBooking {
  id: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  clientName: string;
  instructorPayout: number;
  price: number;
  isFromPackage: boolean;
}

export interface ScheduledOfflineBooking {
  id: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  clientName: string;
  offlineAmountPaid: number;
  offlinePaymentMethod: string;
}

export interface UpcomingScheduledData {
  platformBookings: ScheduledPlatformBooking[];
  offlineBookings: ScheduledOfflineBooking[];
  platformScheduledTotal: number;
  platformScheduledCount: number;
  offlineScheduledTotal: number;
  offlineScheduledCount: number;
}

interface DayGroup<T> {
  label: string;
  dateKey: string;
  items: T[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByDay<T>(items: T[], getDate: (item: T) => string): DayGroup<T>[] {
  const map = new Map<string, T[]>();
  items.forEach(item => {
    const key = new Date(getDate(item)).toISOString().split('T')[0];
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, its]) => ({
      label: new Date(key + 'T12:00:00Z').toLocaleDateString('en-AU', {
        weekday: 'short', day: 'numeric', month: 'short',
      }),
      dateKey: key,
      items: its,
    }));
}

function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '';
  if (minutes < 60) return `${minutes}min`;
  const h = minutes / 60;
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`;
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  credit_card: 'Card',
  debit_card: 'Card',
  other: 'Other',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function UpcomingScheduledSection({ data, timezone }: { data: UpcomingScheduledData; timezone?: string }) {
  const [open, setOpen] = useState(false);

  const tz = resolveTimezone(timezone) || DEFAULT_TIMEZONE;
  const tzOpts = { timeZone: tz };

  const totalAmount = data.platformScheduledTotal + data.offlineScheduledTotal;
  const totalCount  = data.platformScheduledCount + data.offlineScheduledCount;
  const hasPlatform = data.platformScheduledCount > 0;
  const hasOffline  = data.offlineScheduledCount > 0;

  if (totalCount === 0) return null;

  const platformDays = groupByDay(data.platformBookings, b => b.startTime);
  const offlineDays  = groupByDay(data.offlineBookings,  b => b.startTime);

  const streamLabel = hasPlatform && hasOffline
    ? '(platform + offline)'
    : hasPlatform
      ? '(platform)'
      : '(offline)';

  return (
    <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">

      {/* Header toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-900 hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          {open
            ? <ChevronDown className="h-4 w-4 text-sky-400" />
            : <ChevronRight className="h-4 w-4 text-sky-400" />}
          <Calendar className="h-4 w-4 text-sky-400" />
          <span className="font-semibold text-slate-100 text-sm">Upcoming Scheduled Lessons</span>
          <span className="text-xs text-slate-400">{streamLabel}</span>
        </div>
        <div className="text-right">
          <span className="font-bold text-sky-400 text-sm">${totalAmount.toFixed(2)}</span>
          <span className="text-xs text-slate-500 ml-2">
            {totalCount} lesson{totalCount !== 1 ? 's' : ''}
          </span>
        </div>
      </button>

      {open && (
        <div className="divide-y divide-slate-800">

          {/* Platform bookings */}
          {platformDays.length > 0 && (
            <>
              {hasOffline && (
                <div className="px-4 py-1.5 bg-slate-900/50">
                  <p className="text-xs font-bold uppercase tracking-widest text-sky-600">Platform bookings</p>
                </div>
              )}
              {platformDays.map(day => (
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
                          {new Date(b.startTime).toLocaleTimeString('en-AU', {
                            hour: '2-digit', minute: '2-digit', ...tzOpts,
                          })}
                          {' · '}{b.clientName}
                        </p>
                        <p className="text-xs text-slate-400">
                          {b.duration ? formatDuration(b.duration) : ''}
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

          {/* Offline bookings */}
          {offlineDays.length > 0 && (
            <>
              <div className="px-4 py-1.5 bg-emerald-900/10">
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
                  Offline / cash bookings
                </p>
              </div>
              {offlineDays.map(day => (
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
                          {new Date(b.startTime).toLocaleTimeString('en-AU', {
                            hour: '2-digit', minute: '2-digit', ...tzOpts,
                          })}
                          {' · '}{b.clientName}
                        </p>
                        <p className="text-xs text-slate-400">
                          {b.duration ? `${formatDuration(b.duration)} · ` : ''}
                          <span className="text-emerald-500 font-medium">
                            {PAYMENT_METHOD_LABEL[b.offlinePaymentMethod] || b.offlinePaymentMethod}
                          </span>
                          {' · no commission'}
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
  );
}
