'use client';

/**
 * FindNextSlot
 *
 * Queries the availability API forward from now and surfaces up to 3
 * upcoming slots across different durations (60 / 90 / 120 min).
 *
 * When an instructor taps a suggestion, onSelect(date, time, duration)
 * fires — the parent pre-fills the booking form.
 *
 * Sprint 4 — "Find Next Available" feature.
 */

import { useState } from 'react';
import { Zap, ChevronDown, ChevronUp } from 'lucide-react';

interface Suggestion {
  date:         string;  // YYYY-MM-DD
  time:         string;  // HH:MM 24h
  displayDate:  string;  // "Today", "Tomorrow", "Mon 21 Jul"
  displayTime:  string;  // "9:00 AM"
  duration:     number;  // minutes
  gapMinutes:   number;  // minutes from now until this slot
}

interface Props {
  instructorId: string;
  onSelect: (date: string, time: string, duration: number) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatTimeDisplay(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

function minutesUntil(dateStr: string, timeStr: string): number {
  const dt = new Date(`${dateStr}T${timeStr}:00`);
  return Math.round((dt.getTime() - Date.now()) / 60000);
}

function formatGap(minutes: number): string {
  if (minutes < 60) return `in ${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `in ${h}h ${m}m` : `in ${h}h`;
}

// ── API call ──────────────────────────────────────────────────────────────────

async function fetchSlotsForDate(
  instructorId: string,
  date: string,
  duration: number
): Promise<string[]> {
  const res = await fetch(
    `/api/availability/slots?instructorId=${instructorId}&date=${date}&duration=${duration}&bypassDurationCheck=true`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.slots as Array<{ time: string; available: boolean }> | undefined)
    ?.filter(s => s.available)
    .map(s => s.time) ?? [];
}

/**
 * Sequential-day, parallel-duration search.
 *
 * Strategy: process days one at a time (sequential outer loop) but fire all 3
 * duration fetches for each day simultaneously (parallel inner batch). Break as
 * soon as we have `count` suggestions — avoids fetching later days when the
 * instructor already has open slots early in the week.
 *
 * Why not fully parallel (all 21 at once)?
 *   - The slots API has no rate limit, but each request hits an in-process
 *     30s TTL cache keyed by instructorId:date:duration. Different durations on
 *     the same date are separate cache keys, so 21 concurrent requests = up to
 *     21 DB queries in a burst, which can overwhelm the connection pool.
 *   - Early-exit here typically fires only 3–6 requests (1–2 days) instead of
 *     21, saving DB load for the common case where today or tomorrow has slots.
 *
 * Worst case (no slots in 7 days): 7 × 3 = 21 requests, identical to the old
 * approach but in 7 batches of ~200ms each ≈ 1.4s, vs the old ~4.2s sequential.
 */
async function findSuggestions(
  instructorId: string,
  count = 3
): Promise<Suggestion[]> {
  const now = new Date();
  const durations = [60, 90, 120];
  const suggestions: Suggestion[] = [];
  const seen = new Set<string>();

  for (let dayOffset = 0; dayOffset <= 6; dayOffset++) {
    // Bail early once we have enough
    if (suggestions.length >= count) break;

    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    const dateStr = toDateStr(d);

    // Fetch all 3 durations for this day in parallel — 3 connections max
    const dayResults = await Promise.all(
      durations.map(async duration => ({
        duration,
        slots: await fetchSlotsForDate(instructorId, dateStr, duration),
      }))
    );

    // Process shortest-duration first (60 → 90 → 120)
    for (const { duration, slots } of dayResults) {
      if (suggestions.length >= count) break;

      for (const time of slots) {
        if (suggestions.length >= count) break;
        const key = `${dateStr}:${time}`;
        if (seen.has(key)) continue;

        // Skip slots already in the past (same-day)
        const gap = minutesUntil(dateStr, time);
        if (gap < 0) continue;

        seen.add(key);
        suggestions.push({
          date:        dateStr,
          time,
          displayDate: formatDateLabel(dateStr),
          displayTime: formatTimeDisplay(time),
          duration,
          gapMinutes:  gap,
        });
        break; // one slot per duration per day — spread suggestions across days
      }
    }
  }

  return suggestions;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FindNextSlot({ instructorId, onSelect }: Props) {
  const [suggestions, setSuggestions]   = useState<Suggestion[]>([]);
  const [loading, setLoading]           = useState(false);
  const [loaded, setLoaded]             = useState(false);
  const [expanded, setExpanded]         = useState(true);
  const [selectedKey, setSelectedKey]   = useState<string | null>(null);

  async function handleFind() {
    setLoading(true);
    setLoaded(false);
    setSuggestions([]);
    setSelectedKey(null);
    try {
      const results = await findSuggestions(instructorId, 3);
      setSuggestions(results);
      setLoaded(true);
      setExpanded(true);
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(s: Suggestion) {
    setSelectedKey(`${s.date}:${s.time}`);
    onSelect(s.date, s.time, s.duration);
  }

  return (
    <div className="rounded-2xl border border-sky-500/20 bg-sky-950/20 p-4 mb-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="text-sm font-semibold text-sky-300">Find Next Available Slot</span>
        </div>
        <div className="flex items-center gap-2">
          {loaded && suggestions.length > 0 && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1 text-slate-500 hover:text-white transition-colors"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
          <button
            onClick={handleFind}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition-colors disabled:opacity-50"
          >
            {loading ? 'Searching…' : loaded ? 'Refresh' : 'Find Slots'}
          </button>
        </div>
      </div>

      {/* Suggestions */}
      {loaded && expanded && (
        <div className="mt-3 space-y-2">
          {suggestions.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-2">
              No available slots found in the next 7 days.
            </p>
          ) : (
            <>
              <p className="text-xs text-slate-500 mb-2">
                Tap a slot to pre-fill the booking form:
              </p>
              {suggestions.map(s => {
                const key = `${s.date}:${s.time}`;
                const isSelected = selectedKey === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleSelect(s)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                      isSelected
                        ? 'bg-sky-600 text-white border border-sky-500'
                        : 'bg-slate-800/60 hover:bg-slate-800 border border-white/5 hover:border-sky-500/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-center min-w-[52px]">
                        <p className={`text-xs font-semibold ${isSelected ? 'text-sky-100' : 'text-sky-400'}`}>
                          {s.displayDate}
                        </p>
                        <p className={`text-base font-bold leading-tight ${isSelected ? 'text-white' : 'text-slate-100'}`}>
                          {s.displayTime}
                        </p>
                      </div>
                      <div className={`text-xs ${isSelected ? 'text-sky-100' : 'text-slate-400'}`}>
                        {s.duration} min
                        {' · '}
                        <span className={isSelected ? 'text-sky-200' : 'text-slate-500'}>
                          {formatGap(s.gapMinutes)}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-xs font-semibold text-sky-100 shrink-0">✓ Selected</span>
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
