'use client';

/**
 * TodayWorkspace
 *
 * The instructor's home screen. Shows today's lessons as a time-ordered
 * schedule — not a list, not a calendar grid. Time on the left, content on
 * the right, separated visually so the instructor can scan instantly.
 *
 * Sprint 1 acceptance criteria covered here:
 * ✅ Bookings sorted chronologically
 * ✅ Every booking shows time, student name, pickup suburb, status badge
 * ✅ Status colours consistent (from lib/config/booking-status.ts)
 * ✅ Next upcoming lesson clearly highlighted
 * ✅ Progress indicator (completed N of total)
 * ✅ Summary cards: Lessons Today, Next Lesson
 * ✅ Tapping a booking navigates to existing booking detail page
 * ✅ No backend schema changes, no new API endpoints
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getStatusConfig, isDoneStatus, isActiveStatus } from '@/lib/config/booking-status';
import { resolveTimezone, formatLocalTime, DEFAULT_TIMEZONE } from '@/lib/utils/timezone';
import { MapPin, Phone, ChevronRight } from 'lucide-react';

export interface TodayBooking {
  id:           string;
  startTime:    Date | string;
  endTime:      Date | string | null;
  duration:     number | null;
  status:       string;
  clientName:   string | null;
  clientPhone:  string | null;
  pickupAddress: string | null;
  price:        number;
}

interface Props {
  bookings:        TodayBooking[];
  instructorName:  string;
  timezone?:       string;  // instructor's stored timezone — defaults to Perth
}

// ── Helpers ───────────────────────────────────────────────────────────────────


function extractSuburb(address: string | null): string | null {
  if (!address) return null;
  // "81 King William St, Bayswater WA 6053" → "Bayswater"
  const match = address.match(/,\s*([A-Za-z][A-Za-z\s'-]+?)\s+(?:WA|NSW|VIC|QLD|SA|TAS|NT|ACT)\s+\d{4}/i);
  if (match) return match[1].trim();
  // Fallback: last comma-separated part before a state code
  const parts = address.split(',');
  if (parts.length >= 2) return parts[parts.length - 1].trim();
  return null;
}

function greetingFor(name: string, tz: string): string {
  const t = new Date();
  const hourStr = formatLocalTime(t, tz, { hour: 'numeric', hour12: false } as any);
  const hour = parseInt(String(hourStr), 10);
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return `${greeting}, ${name.split(' ')[0]}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TodayWorkspace({ bookings, instructorName, timezone = DEFAULT_TIMEZONE }: Props) {
  const now = new Date();
  const resolvedTz = resolveTimezone(timezone);
  const tzOpts = { timeZone: resolvedTz };

  const [greeting, setGreeting] = useState('');
  useEffect(() => {
    setGreeting(greetingFor(instructorName, resolvedTz));
  }, [instructorName, resolvedTz]);

  // Sort chronologically
  const sorted = [...bookings].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  // Stats
  const total      = sorted.length;
  const completed  = sorted.filter(b => isDoneStatus(b.status)).length;
  const active     = sorted.filter(b => isActiveStatus(b.status)).length;
  const revenueToday = sorted
    .filter(b => b.status === 'COMPLETED')
    .reduce((s, b) => s + b.price, 0);

  // Next upcoming: first booking that starts after now and is CONFIRMED
  const nextBooking = sorted.find(
    b => isActiveStatus(b.status) && new Date(b.startTime) > now
  );

  // In-progress: started but not ended yet
  const inProgress = sorted.find(b => {
    const start = new Date(b.startTime);
    const end   = b.endTime ? new Date(b.endTime) : null;
    return start <= now && (!end || end > now) && isActiveStatus(b.status);
  });

  const highlighted = inProgress ?? nextBooking;

  // Today's date label
  const todayLabel = now.toLocaleDateString('en-AU', {
    ...tzOpts,
    weekday: 'long',
    day:     'numeric',
    month:   'long',
  });

  // Progress bar width
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-5 mb-6">

      {/* Greeting + date */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-sky-400/80 mb-1">
          Today · {todayLabel}
        </p>
        <h2 className="text-2xl font-bold text-white">{greeting || `Hi, ${instructorName.split(' ')[0]}`}</h2>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Lessons today */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Lessons Today</p>
          <p className="text-2xl font-bold text-white">{total}</p>
          {total > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">
              {completed} done · {active} remaining
            </p>
          )}
        </div>

        {/* Next lesson */}
        <div className="rounded-2xl border border-sky-500/20 bg-sky-950/20 px-4 py-3">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Next Lesson</p>
          {nextBooking ? (
            <>
              <p className="text-lg font-bold text-white">{formatLocalTime(nextBooking.startTime, resolvedTz, { hour: 'numeric', minute: '2-digit', hour12: true } as any)}</p>
              <p className="text-xs text-sky-300 truncate mt-0.5">
                {nextBooking.clientName ?? 'Student'}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500 mt-1">None scheduled</p>
          )}
        </div>

        {/* Progress */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 col-span-2 sm:col-span-1">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Progress</p>
          <p className="text-sm font-semibold text-white mb-2">
            {completed} <span className="text-slate-500 font-normal">/ {total} completed</span>
          </p>
          <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-sky-500 transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Revenue today */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Revenue Today</p>
          <p className="text-2xl font-bold text-white">
            ${revenueToday.toFixed(0)}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">completed lessons</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Today's Schedule</h3>
          <Link
            href="/dashboard/bookings"
            className="text-xs text-sky-400 hover:text-white transition-colors"
          >
            All bookings →
          </Link>
        </div>

        {total === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-slate-300 font-medium mb-1">Nothing scheduled today.</p>
            <p className="text-sm text-slate-500 mb-4">Enjoy the day off — or create a booking to fill it.</p>
            <Link
              href="/dashboard/bookings/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold transition-colors no-underline"
            >
              + New Booking
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {sorted.map((booking) => {
              const cfg         = getStatusConfig(booking.status);
              const isNext      = booking.id === highlighted?.id;
              const isCompleted = isDoneStatus(booking.status);
              const suburb      = extractSuburb(booking.pickupAddress);
              const startFmt    = formatLocalTime(booking.startTime, resolvedTz, { hour: '2-digit', minute: '2-digit', hour12: true } as any);
              const endFmt      = booking.endTime ? formatLocalTime(booking.endTime, resolvedTz, { hour: '2-digit', minute: '2-digit', hour12: true } as any) : null;
              const durationH   = booking.duration ? `${booking.duration} min` : null;

              return (
                <Link
                  key={booking.id}
                  href={`/dashboard/bookings/${booking.id}`}
                  className={`flex items-stretch gap-0 no-underline group transition-colors ${
                    isNext
                      ? 'bg-sky-950/30 hover:bg-sky-950/50'
                      : 'hover:bg-slate-800/40'
                  } ${isCompleted ? 'opacity-60' : ''}`}
                >
                  {/* Time column */}
                  <div className="w-20 shrink-0 flex flex-col items-end justify-center px-4 py-4">
                    <span className={`text-sm font-semibold tabular-nums ${
                      isNext ? 'text-sky-300' : 'text-slate-300'
                    }`}>
                      {startFmt}
                    </span>
                    {endFmt && (
                      <span className="text-xs text-slate-600 tabular-nums">{endFmt}</span>
                    )}
                  </div>

                  {/* Status accent bar */}
                  <div className={`w-0.5 shrink-0 self-stretch my-3 rounded-full ${cfg.dot}`} />

                  {/* Content */}
                  <div className="flex-1 min-w-0 px-4 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {/* Next badge */}
                        {isNext && !inProgress && (
                          <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-sky-400 mb-1">
                            Next
                          </span>
                        )}
                        {inProgress && booking.id === inProgress.id && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            In Progress
                          </span>
                        )}
                        <p className={`font-semibold truncate ${
                          isNext ? 'text-white' : 'text-slate-200'
                        }`}>
                          {booking.clientName ?? 'Student'}
                        </p>
                        {(suburb || booking.pickupAddress) && (
                          <p className="flex items-center gap-1 text-xs text-slate-500 mt-0.5 truncate">
                            <MapPin className="w-3 h-3 shrink-0" />
                            {suburb ?? booking.pickupAddress}
                          </p>
                        )}
                        {durationH && (
                          <p className="text-xs text-slate-600 mt-0.5">{durationH}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Status badge */}
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                        {/* Call link */}
                        {booking.clientPhone && (
                          <a
                            href={`tel:${booking.clientPhone}`}
                            onClick={e => e.stopPropagation()}
                            className="p-1.5 rounded-full text-slate-500 hover:text-sky-400 hover:bg-sky-900/30 transition-colors"
                            title={`Call ${booking.clientName ?? 'student'}`}
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-slate-400 transition-colors" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
