'use client';

/**
 * SlotPicker
 *
 * Shared slot picker used across all booking surfaces:
 *   - BookingDetailsForm  (public student flow)
 *   - New booking page    (instructor offline + platform)
 *   - Any future surfaces
 *
 * Fetches available slots from /api/availability/slots, renders them as
 * a responsive pill grid. Falls back to a time input when no slots are
 * available (offline/cash bookings where the instructor records a past lesson).
 *
 * Props
 * ─────
 * instructorId   string            required
 * date           string            YYYY-MM-DD — required, fetch skipped if empty
 * duration       number            lesson duration in minutes (default 60)
 * value          string            selected HH:MM value
 * onChange       (time: string) => void
 * variant        'dark' | 'light'  dark = student booking (slate bg), light = instructor form
 * allowFallback  boolean           show manual time input when no slots exist (offline form)
 * scheduledTimes string[]          times already scheduled this session — shown as booked
 */

import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, Clock } from 'lucide-react';

export interface Slot {
  time: string;
  available: boolean;
}

interface Props {
  instructorId: string;
  date:          string;
  duration?:     number;
  value:         string;
  onChange:      (time: string) => void;
  variant?:      'dark' | 'light';
  allowFallback?: boolean;
  scheduledTimes?: string[];
}

export default function SlotPicker({
  instructorId,
  date,
  duration = 60,
  value,
  onChange,
  variant = 'dark',
  allowFallback = false,
  scheduledTimes = [],
}: Props) {
  const [slots,   setSlots]   = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const fetchSlots = useCallback(async () => {
    if (!instructorId || !date) return;
    setLoading(true);
    setError(null);
    setSlots([]);
    onChange(''); // clear selection when date/duration changes
    try {
      const res = await fetch(
        `/api/availability/slots?instructorId=${instructorId}&date=${date}&duration=${duration}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load times');
        return;
      }
      const raw: Slot[] = data.slots || [];
      // Mark any times already scheduled in this booking session as unavailable
      setSlots(raw.map(s => ({
        ...s,
        available: s.available && !scheduledTimes.includes(s.time),
      })));
    } catch {
      setError('Could not load availability. Check your connection.');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instructorId, date, duration]);

  useEffect(() => {
    if (date) fetchSlots();
  }, [fetchSlots, date]);

  // ── No date selected ──────────────────────────────────────────────────────
  if (!date) {
    return (
      <p className={`text-sm px-4 py-3 rounded-xl border ${
        variant === 'dark'
          ? 'text-amber-400 bg-amber-950/40 border-amber-900 font-bold shadow-[0_4px_0_0_#451a03]'
          : 'text-amber-600 bg-amber-50 border-amber-200'
      }`}>
        ⚠️ Select a date first
      </p>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${
        variant === 'dark'
          ? 'text-sky-400 bg-sky-950/40 border-sky-900 font-bold shadow-[0_4px_0_0_#0c4a6e]'
          : 'text-sky-600 bg-sky-50 border-sky-200'
      }`}>
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        <span className="text-sm">Loading available times…</span>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className={`px-4 py-3 rounded-xl border ${
        variant === 'dark'
          ? 'bg-red-950/40 border-2 border-red-900 shadow-[0_4px_0_0_#450a0a]'
          : 'bg-red-50 border border-red-200'
      }`}>
        <p className={`text-sm font-bold mb-2 ${variant === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
          ⚠️ {error}
        </p>
        <button
          type="button"
          onClick={fetchSlots}
          className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
            variant === 'dark' ? 'text-sky-400 hover:text-white' : 'text-sky-600 hover:text-sky-800'
          }`}
        >
          <RefreshCw className="w-3 h-3" /> Try again
        </button>
      </div>
    );
  }

  const available = slots.filter(s => s.available);

  // ── No slots — fallback to manual time input (offline form) ───────────────
  if (available.length === 0 && allowFallback) {
    return (
      <div className="space-y-1.5">
        <input
          type="time"
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`w-full rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none ${
            variant === 'dark'
              ? 'bg-amber-500/10 border border-amber-500/40 text-white'
              : 'bg-white border border-amber-300 text-gray-900'
          }`}
        />
        <p className={`text-xs ${variant === 'dark' ? 'text-amber-300' : 'text-amber-600'}`}>
          <Clock className="w-3 h-3 inline mr-1" />
          No configured slots for this day — enter time manually
        </p>
      </div>
    );
  }

  // ── No slots, no fallback ─────────────────────────────────────────────────
  if (available.length === 0) {
    return (
      <p className={`text-sm px-4 py-3 rounded-xl border ${
        variant === 'dark'
          ? 'text-slate-400 bg-slate-900/60 border-slate-700'
          : 'text-gray-500 bg-gray-50 border-gray-200'
      }`}>
        No available times on this day
      </p>
    );
  }

  // ── Pill grid ─────────────────────────────────────────────────────────────
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(5.5rem, 1fr))' }}
      role="group"
      aria-label="Select a time"
    >
      {slots.map(slot => {
        const isSelected   = value === slot.time;
        const isUnavailable = !slot.available;

        if (isUnavailable) {
          return (
            <div
              key={slot.time}
              className={`flex items-center justify-center rounded-xl px-2 py-2.5 text-xs font-semibold select-none ${
                variant === 'dark'
                  ? 'bg-slate-800/40 text-slate-600 line-through'
                  : 'bg-gray-100 text-gray-400 line-through'
              }`}
              aria-disabled="true"
              title="Unavailable"
            >
              {slot.time}
            </div>
          );
        }

        return (
          <button
            key={slot.time}
            type="button"
            onClick={() => onChange(isSelected ? '' : slot.time)}
            aria-pressed={isSelected}
            className={[
              'flex items-center justify-center rounded-xl px-2 py-2.5 text-xs font-bold transition-all duration-100',
              variant === 'dark'
                ? isSelected
                  ? 'bg-sky-600 text-white shadow-[0_4px_0_0_#0369a1] translate-y-px border-2 border-sky-400'
                  : 'bg-slate-800 text-slate-200 border-2 border-slate-600 hover:border-sky-400 hover:text-white active:translate-y-px active:shadow-none shadow-[0_3px_0_0_#334155]'
                : isSelected
                  ? 'bg-sky-600 text-white shadow-sm ring-2 ring-sky-400'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-sky-400 hover:text-sky-700 shadow-sm',
            ].join(' ')}
          >
            {slot.time}
          </button>
        );
      })}
    </div>
  );
}
