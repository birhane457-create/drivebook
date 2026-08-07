'use client';

/**
 * /dashboard/schedule
 *
 * Instructor scheduling workspace — Sprints 2 + 3 complete.
 * Three views over the same booking data:
 *   Today   — today's lessons as a timeline (reuses TodayWorkspace component)
 *   Week    — 7-column time grid with booking blocks, current time indicator
 *   Agenda  — chronological date-grouped list with range + status + search filters
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ChevronLeft, ChevronRight, CalendarDays, List, Clock,
  Plus, Search, X,
} from 'lucide-react';
import { getStatusConfig } from '@/lib/config/booking-status';
import TodayWorkspace, { type TodayBooking } from '@/components/instructor/TodayWorkspace';
import { formatLocalDate, formatLocalTime, DEFAULT_TIMEZONE } from '@/lib/utils/timezone';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ScheduleBooking {
  id:            string;
  startTime:     string;
  endTime:       string | null;
  duration:      number | null;
  status:        string;
  clientName:    string | null;
  clientPhone:   string | null;
  pickupAddress: string | null;
  price:         number;
}

type ViewMode    = 'today' | 'week' | 'agenda';
type AgendaRange = 'today' | 'week' | 'month' | 'past';

// Buffer settings fetched from /api/instructor/settings
interface BufferSettings {
  bookingBufferMinutes: number;
  enableTravelTime: boolean;
  travelTimeMinutes: number;
  timezone: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

// Convert a UTC date to the instructor's local wall-clock time as a Date object.
// The returned Date has UTC fields equal to local wall-clock values
// (e.g. for Sydney UTC+10, a 1am UTC input returns a Date whose .getUTCHours() === 11).
// This approach avoids toLocaleString() parsing which is unreliable on Windows.
function toLocal(dt: Date | string, tz: string): Date {
  const d = typeof dt === 'string' ? new Date(dt) : dt;
  // Get the local time components for the given timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(d)
      .filter(p => p.type !== 'literal')
      .map(p => [p.type, p.value])
  );
  // Build a UTC date whose UTC getters return the local time values
  return new Date(Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    parts.hour === '24' ? 0 : Number(parts.hour),
    Number(parts.minute), Number(parts.second)
  ));
}

function formatTime(dt: Date | string, tz: string): string {
  return formatLocalTime(dt as any, tz, { hour: '2-digit', minute: '2-digit', hour12: true } as any);
}

function formatDay(dt: Date, tz: string): string {
  return formatLocalDate(dt as any, tz, { weekday: 'short', day: 'numeric', month: 'short' } as any);
}

function formatDateLabel(dt: Date, tz: string): string {
  return formatLocalDate(dt as any, tz, { weekday: 'long', day: 'numeric', month: 'long' } as any);
}

function addDays(d: Date, n: number): Date {
  // Use UTC to avoid DST drift — add n×86400 seconds
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
}

function isSameLocalDay(a: Date | string, b: Date, tz: string): boolean {
  const pa = toLocal(a, tz), pb = toLocal(b, tz);
  return pa.getUTCFullYear() === pb.getUTCFullYear()
    && pa.getUTCMonth()     === pb.getUTCMonth()
    && pa.getUTCDate()      === pb.getUTCDate();
}

function extractSuburb(address: string | null): string | null {
  if (!address) return null;
  const m = address.match(/,\s*([A-Za-z][A-Za-z\s'-]+?)\s+(?:WA|NSW|VIC|QLD|SA|TAS|NT|ACT)\s+\d{4}/i);
  if (m) return m[1].trim();
  const parts = address.split(',');
  if (parts.length >= 2) return parts[parts.length - 1].trim();
  return null;
}

function matchesSearch(b: ScheduleBooking, q: string): boolean {
  if (!q) return true;
  const lq = q.toLowerCase();
  return (
    (b.clientName ?? '').toLowerCase().includes(lq) ||
    (b.clientPhone ?? '').replace(/\s/g, '').includes(q.replace(/\s/g, '')) ||
    (b.pickupAddress ?? '').toLowerCase().includes(lq) ||
    b.id.toLowerCase().includes(lq)
  );
}

// ── Booking card ───────────────────────────────────────────────────────────────

function BookingCard({ booking, compact = false, tz = DEFAULT_TIMEZONE }: { booking: ScheduleBooking; compact?: boolean; tz?: string }) {
  const cfg    = getStatusConfig(booking.status);
  const suburb = extractSuburb(booking.pickupAddress);
  return (
    <Link
      href={`/dashboard/bookings/${booking.id}`}
      className={`block rounded-xl border-l-4 ${cfg.border} bg-slate-800/60 hover:bg-slate-800 transition-colors no-underline`}
    >
      <div className={`px-3 ${compact ? 'py-1.5' : 'py-2.5'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={`font-semibold text-slate-100 truncate ${compact ? 'text-xs' : 'text-sm'}`}>
              {booking.clientName ?? 'Student'}
            </p>
            <p className={`text-slate-400 ${compact ? 'text-[10px]' : 'text-xs'} mt-0.5`}>
              {formatTime(booking.startTime, tz)}
              {booking.endTime ? ` – ${formatTime(booking.endTime, tz)}` : ''}
              {suburb ? ` · ${suburb}` : ''}
            </p>
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${cfg.badge} shrink-0`}>
            <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ── Week view ──────────────────────────────────────────────────────────────────

const HOUR_HEIGHT    = 64;
const DAY_START_HOUR = 6;
const DAY_END_HOUR   = 21;
const VISIBLE_HOURS  = DAY_END_HOUR - DAY_START_HOUR;

function WeekView({ bookings, weekStart, search, statusFilter, bufferSettings }: {
  bookings: ScheduleBooking[];
  weekStart: Date;
  search: string;
  statusFilter: string;
  bufferSettings: BufferSettings;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [nowPct, setNowPct] = useState<number | null>(null);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Effective buffer gap in minutes
  const effectiveBufferMins = bufferSettings.enableTravelTime
    ? Math.max(bufferSettings.bookingBufferMinutes, bufferSettings.travelTimeMinutes)
    : bufferSettings.bookingBufferMinutes;
  const tz = bufferSettings.timezone ?? DEFAULT_TIMEZONE;

  useEffect(() => {
    function update() {
      const p = toLocal(new Date(), tz);
      const h = p.getUTCHours() + p.getUTCMinutes() / 60;
      setNowPct(h >= DAY_START_HOUR && h <= DAY_END_HOUR
        ? ((h - DAY_START_HOUR) / VISIBLE_HOURS) * 100
        : null);
    }
    update();
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, [tz]);

  useEffect(() => {
    if (!scrollRef.current) return;
    const p = toLocal(new Date(), tz);
    const h = p.getUTCHours() + p.getUTCMinutes() / 60;
    scrollRef.current.scrollTop = Math.max(
      0, ((h - DAY_START_HOUR) / VISIBLE_HOURS) * (VISIBLE_HOURS * HOUR_HEIGHT) - 80
    );
  }, []);

  function bookingStyle(b: ScheduleBooking) {
    const p = toLocal(b.startTime, tz);
    const startH = p.getUTCHours() + p.getUTCMinutes() / 60;
    const dur    = b.duration ? b.duration / 60 : 1;
    return {
      top:    `${((startH - DAY_START_HOUR) / VISIBLE_HOURS) * 100}%`,
      height: `${Math.max((dur / VISIBLE_HOURS) * 100, 3)}%`,
    };
  }

  // Buffer stripe rendered immediately after a lesson ends
  function bufferStyle(b: ScheduleBooking) {
    if (effectiveBufferMins <= 0) return null;
    const end = b.endTime
      ? toLocal(b.endTime, tz)
      : toLocal(new Date(new Date(b.startTime).getTime() + (b.duration ?? 60) * 60 * 1000), tz);
    const endH = end.getUTCHours() + end.getUTCMinutes() / 60;
    if (endH >= DAY_END_HOUR) return null;
    return {
      top:    `${((endH - DAY_START_HOUR) / VISIBLE_HOURS) * 100}%`,
      height: `${((effectiveBufferMins / 60) / VISIBLE_HOURS) * 100}%`,
    };
  }

  const filtered = bookings
    .filter(b => matchesSearch(b, search))
    .filter(b => !statusFilter || b.status === statusFilter);

  const today = new Date();

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 overflow-hidden">
      <div className="flex border-b border-white/10">
        <div className="w-12 shrink-0" />
        {weekDays.map((day, i) => {
          const isToday = isSameLocalDay(today, day, tz);
          return (
            <div key={i} className={`flex-1 px-1 py-2 text-center text-xs font-medium border-l border-white/5 ${
              isToday ? 'bg-sky-950/30 text-sky-300' : 'text-slate-400'
            }`}>
              {formatDay(day, tz)}
            </div>
          );
        })}
      </div>
      <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: '70vh' }}>
        <div className="relative flex" style={{ height: `${VISIBLE_HOURS * HOUR_HEIGHT}px` }}>
          <div className="w-12 shrink-0 border-r border-white/5">
            {Array.from({ length: VISIBLE_HOURS }, (_, i) => {
              const h = DAY_START_HOUR + i;
              return (
                <div key={h} className="flex items-start justify-end pr-2 text-[10px] text-slate-600 select-none"
                  style={{ height: `${HOUR_HEIGHT}px` }}>
                  {h === 12 ? '12pm' : h < 12 ? `${h}am` : `${h - 12}pm`}
                </div>
              );
            })}
          </div>
          {weekDays.map((day, di) => {
            const isToday = isSameLocalDay(today, day, tz);
            const dayBookings = filtered.filter(b => isSameLocalDay(b.startTime, day, tz));
            return (
              <div key={di} className={`relative flex-1 border-l border-white/5 ${isToday ? 'bg-sky-950/10' : ''}`}>
                {Array.from({ length: VISIBLE_HOURS }, (_, i) => (
                  <div key={i} className="absolute w-full border-t border-white/5"
                    style={{ top: `${(i / VISIBLE_HOURS) * 100}%` }} />
                ))}
                {isToday && nowPct !== null && (
                  <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: `${nowPct}%` }}>
                    <div className="relative flex items-center">
                      <div className="w-2 h-2 rounded-full bg-red-400 shrink-0 -ml-1 z-10" />
                      <div className="h-px flex-1 bg-red-400/70" />
                    </div>
                  </div>
                )}
                {dayBookings.map(b => (
                  <>
                    {/* Lesson block */}
                    <div key={b.id} className="absolute left-0.5 right-0.5 z-20" style={bookingStyle(b)}>
                      <BookingCard booking={b} compact tz={tz} />
                    </div>
                    {/* Buffer stripe — shows the blocked gap after the lesson */}
                    {bufferStyle(b) && (
                      <div
                        key={`buf-${b.id}`}
                        className="absolute left-0.5 right-0.5 z-10 rounded-b border border-dashed border-amber-500/30 bg-amber-500/8 pointer-events-none"
                        style={bufferStyle(b)!}
                        title={`${effectiveBufferMins}min buffer`}
                      >
                        <span className="text-[9px] text-amber-400/60 px-1 leading-none select-none">
                          {effectiveBufferMins}m buffer
                        </span>
                      </div>
                    )}
                  </>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Agenda view ────────────────────────────────────────────────────────────────

function AgendaView({ bookings, range, search, statusFilter, tz = DEFAULT_TIMEZONE }: {
  bookings: ScheduleBooking[];
  range: AgendaRange;
  search: string;
  statusFilter: string;
  tz?: string;
}) {
  const today = new Date();
  const days: Date[] = [];

  if (range === 'past') {
    for (let i = 30; i >= 1; i--) days.push(addDays(today, -i));
  } else if (range === 'today') {
    days.push(today);
  } else if (range === 'week') {
    for (let i = 0; i < 7; i++) days.push(addDays(today, i));
  } else {
    // 'month' — next 30 days
    for (let i = 0; i < 30; i++) days.push(addDays(today, i));
  }

  const filtered = bookings
    .filter(b => matchesSearch(b, search))
    .filter(b => !statusFilter || b.status === statusFilter);

  const groups = days.map(day => ({
    day,
    bookings: filtered
      .filter(b => isSameLocalDay(b.startTime, day, tz))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
  })).filter(g => g.bookings.length > 0);

  const totalShown = groups.reduce((s, g) => s + g.bookings.length, 0);

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-6 py-16 text-center">
        {search || statusFilter ? (
          <>
            <p className="text-slate-300 font-medium mb-1">No lessons match your filters.</p>
            <p className="text-sm text-slate-500 mb-4">Try clearing the search or changing the status filter.</p>
          </>
        ) : range === 'past' ? (
          <>
            <p className="text-slate-300 font-medium mb-1">No completed lessons in the past 30 days.</p>
            <p className="text-sm text-slate-500 mb-4">Your lesson history will appear here once you have completed bookings.</p>
          </>
        ) : range === 'today' ? (
          <>
            <p className="text-slate-300 font-medium mb-1">Nothing scheduled today.</p>
            <p className="text-sm text-slate-500 mb-4">Enjoy the day off — or fill it with a new booking.</p>
          </>
        ) : range === 'week' ? (
          <>
            <p className="text-slate-300 font-medium mb-1">No lessons this week.</p>
            <p className="text-sm text-slate-500 mb-4">A quiet week — or a good time to plan ahead.</p>
          </>
        ) : (
          <>
            <p className="text-slate-300 font-medium mb-1">No lessons scheduled this month.</p>
            <p className="text-sm text-slate-500 mb-4">Create a booking to fill your schedule.</p>
          </>
        )}
        {!search && !statusFilter && (
          <Link
            href="/dashboard/bookings/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold transition-colors no-underline"
          >
            + New Booking
          </Link>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-slate-500 mb-4">
        {totalShown} lesson{totalShown !== 1 ? 's' : ''}
        {search ? ` matching "${search}"` : ''}
        {statusFilter ? ` · ${getStatusConfig(statusFilter).label}` : ''}
      </p>
      <div className="space-y-6">
        {groups.map(({ day, bookings: dayBookings }) => {
          const isToday = isSameLocalDay(today, day, tz);
          return (
            <div key={day.toISOString()}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`h-px flex-1 ${isToday ? 'bg-sky-500/30' : 'bg-white/10'}`} />
                <span className={`text-xs font-semibold uppercase tracking-widest ${
                  isToday ? 'text-sky-400' : 'text-slate-500'
                }`}>
                  {isToday ? 'Today' : formatDateLabel(day, tz)}
                </span>
                <span className="text-xs text-slate-600">
                  {dayBookings.length} lesson{dayBookings.length !== 1 ? 's' : ''}
                </span>
                <div className={`h-px flex-1 ${isToday ? 'bg-sky-500/30' : 'bg-white/10'}`} />
              </div>
              <div className="space-y-2">
                {dayBookings.map(b => <BookingCard key={b.id} booking={b} tz={tz} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const { data: session }               = useSession();
  const [view, setView]                 = useState<ViewMode>('today');
  const [agendaRange, setAgendaRange]   = useState<AgendaRange>('week');
  const [weekStart, setWeekStart]       = useState<Date>(() => {
    // Default to the Monday of the current week (UTC-safe — timezone not yet loaded)
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday));
    return monday;
  });
  const [bookings, setBookings]         = useState<ScheduleBooking[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [bufferSettings, setBufferSettings] = useState<BufferSettings>({
    bookingBufferMinutes: 10,
    timezone: DEFAULT_TIMEZONE,
    enableTravelTime: false,
    travelTimeMinutes: 0,
  });

  const fetchBookings = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [bookingsRes, settingsRes] = await Promise.all([
        fetch(`/api/bookings?from=${addDays(new Date(), -60).toISOString()}&to=${addDays(new Date(), 60).toISOString()}&status=CONFIRMED,COMPLETED,PENDING,PENDING_PAYMENT,NO_SHOW,CANCELLED&limit=400`),
        fetch('/api/instructor/settings'),
      ]);
      if (!bookingsRes.ok) throw new Error(`HTTP ${bookingsRes.status}`);
      const data = await bookingsRes.json();
      setBookings(Array.isArray(data) ? data : (data.bookings ?? []));
      if (settingsRes.ok) {
        const s = await settingsRes.json();
        setBufferSettings({
          bookingBufferMinutes: s.bookingBufferMinutes ?? 10,
          enableTravelTime:     s.enableTravelTime     ?? false,
          travelTimeMinutes:    s.travelTimeMinutes     ?? 0,
          timezone:             s.timezone              ?? DEFAULT_TIMEZONE,
        });
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const prevWeek = () => setWeekStart(d => addDays(d, -7));
  const nextWeek = () => setWeekStart(d => addDays(d, 7));
  const goToday  = () => {
    const tz = bufferSettings.timezone;
    const p = toLocal(new Date(), tz);
    const dayOfWeek = p.getUTCDay();
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(p.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);
    monday.setUTCHours(0, 0, 0, 0);
    // Convert from tz-shifted back to UTC: subtract the local offset
    const offsetMs = toLocal(new Date(0), tz).getTime(); // offset from epoch
    setWeekStart(new Date(monday.getTime() - offsetMs));
  };

  const tz = bufferSettings.timezone;
  const weekEnd   = addDays(weekStart, 6);
  const weekLabel = `${formatLocalDate(weekStart, tz, { day: 'numeric', month: 'short' } as any)} – ${formatLocalDate(weekEnd, tz, { day: 'numeric', month: 'short' } as any)}`;

  const todayForWorkspace: TodayBooking[] = bookings
    .filter(b => isSameLocalDay(b.startTime, new Date(), tz))
    .map(b => ({ ...b, endTime: b.endTime ?? null }));

  const instructorName = (session?.user as any)?.name ?? '';
  const presentStatuses = Array.from(new Set(bookings.map(b => b.status)));
  const hasActiveFilters = !!(search || statusFilter);

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-4 sm:py-6">

      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Schedule</h1>
          <p className="text-sm text-slate-400 mt-0.5">Your lessons workspace</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View switcher */}
          <div className="flex items-center gap-1 bg-slate-900/80 border border-white/10 rounded-xl p-1">
            {([
              { key: 'today',  label: 'Today',  icon: Clock },
              { key: 'week',   label: 'Week',   icon: CalendarDays },
              { key: 'agenda', label: 'Agenda', icon: List },
            ] as { key: ViewMode; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setView(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  view === key ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
          {/* New booking CTA */}
          <Link
            href="/dashboard/bookings/new"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-sky-600 hover:bg-sky-500 text-white transition-colors no-underline"
          >
            <Plus className="w-4 h-4" />
            New
          </Link>
        </div>
      </div>

      {/* Search + status filter — shown for Week and Agenda */}
      {(view === 'week' || view === 'agenda') && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search student, phone, location…"
              className="w-full bg-slate-900/80 border border-white/10 rounded-xl pl-8 pr-8 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-500/50"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-900/80 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-sky-500/50"
          >
            <option value="">All statuses</option>
            {presentStatuses.map(s => (
              <option key={s} value={s}>{getStatusConfig(s).label}</option>
            ))}
          </select>
          {hasActiveFilters && (
            <button
              onClick={() => { setSearch(''); setStatusFilter(''); }}
              className="text-xs text-slate-500 hover:text-white transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Week navigation */}
      {view === 'week' && (
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <button onClick={prevWeek} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-slate-300 min-w-[140px] text-center">{weekLabel}</span>
            <button onClick={nextWeek} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button onClick={goToday} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 transition-colors">
            Today
          </button>
        </div>
      )}

      {/* Agenda range filter */}
      {view === 'agenda' && (
        <div className="flex items-center gap-1 mb-4 bg-slate-900/60 border border-white/10 rounded-xl p-1 w-fit">
          {([
            { key: 'today', label: 'Today' },
            { key: 'week',  label: 'This Week' },
            { key: 'month', label: 'This Month' },
            { key: 'past',  label: 'Past 30 Days' },
          ] as { key: AgendaRange; label: string }[]).map(({ key, label }) => (
            <button key={key} onClick={() => setAgendaRange(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                agendaRange === key ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          {/* Summary cards skeleton — matches TodayWorkspace grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 h-20">
                <div className="h-2.5 bg-slate-700 rounded w-16 mb-3" />
                <div className="h-6 bg-slate-700 rounded w-10" />
              </div>
            ))}
          </div>
          {/* Timeline skeleton */}
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <div className="h-3.5 bg-slate-700 rounded w-32" />
            </div>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-white/5 last:border-0">
                <div className="w-14 h-4 bg-slate-700 rounded shrink-0" />
                <div className="w-0.5 self-stretch bg-slate-700 rounded my-2" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-slate-700 rounded w-36" />
                  <div className="h-3 bg-slate-800 rounded w-24" />
                </div>
                <div className="h-5 w-20 bg-slate-700 rounded-full shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}
      {!loading && error && (
        <div className="rounded-2xl border border-rose-800/50 bg-rose-950/20 px-6 py-8 text-center text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* Views */}
      {!loading && !error && (
        <>
          {view === 'today' && (
            <TodayWorkspace
              bookings={todayForWorkspace}
              instructorName={instructorName}
            />
          )}
          {view === 'week' && (
            <WeekView bookings={bookings} weekStart={weekStart} search={search} statusFilter={statusFilter} bufferSettings={bufferSettings} />
          )}
          {view === 'agenda' && (
            <AgendaView bookings={bookings} range={agendaRange} search={search} statusFilter={statusFilter} tz={tz} />
          )}
        </>
      )}
    </div>
  );
}
