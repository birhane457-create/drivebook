/**
 * lib/utils/timezone.ts
 *
 * Timezone utilities for national expansion.
 *
 * Australia has 5 time zones relevant to driving providers:
 *   Australia/Perth        AWST  UTC+8    (no DST)
 *   Australia/Adelaide     ACST  UTC+9:30 (DST: +10:30)
 *   Australia/Darwin       ACST  UTC+9:30 (no DST)
 *   Australia/Brisbane     AEST  UTC+10   (no DST)
 *   Australia/Sydney       AEST  UTC+10   (DST: +11)
 *   Australia/Melbourne    AEST  UTC+10   (DST: +11)
 *   Australia/Hobart       AEST  UTC+10   (DST: +11)
 *
 * Strategy:
 * - Instructors have a `timezone` field in the DB (e.g. "Australia/Perth").
 * - All times stored in DB are UTC.
 * - Local display uses the instructor's timezone (or user's browser TZ for students).
 * - When an instructor submits a local date+time (e.g. from a form), we convert it
 *   to UTC using their timezone before storing.
 * - Default fallback is "Australia/Perth" for the initial WA market.
 *
 * IMPORTANT: This module uses the Intl.DateTimeFormat API (available in all
 * modern browsers and Node.js 13+). No external library needed.
 */

/** Platform default — used when instructor has no timezone set */
export const DEFAULT_TIMEZONE = 'Australia/Perth';

/** All valid Australian instructor timezones */
export const AU_TIMEZONES = [
  { value: 'Australia/Perth',     label: 'Perth (AWST)',          state: 'WA' },
  { value: 'Australia/Adelaide',  label: 'Adelaide (ACST)',       state: 'SA' },
  { value: 'Australia/Darwin',    label: 'Darwin (ACST)',         state: 'NT' },
  { value: 'Australia/Brisbane',  label: 'Brisbane (AEST)',       state: 'QLD' },
  { value: 'Australia/Sydney',    label: 'Sydney (AEST)',         state: 'NSW' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEST)',      state: 'VIC' },
  { value: 'Australia/Hobart',    label: 'Hobart (AEST)',         state: 'TAS' },
] as const;

export type AuTimezone = typeof AU_TIMEZONES[number]['value'];

/**
 * Validate that a timezone string is a valid IANA timezone.
 * Returns the timezone if valid, or the default if not.
 */
export function resolveTimezone(tz: string | null | undefined): string {
  if (!tz) return DEFAULT_TIMEZONE;
  try {
    // If the timezone is invalid, Intl.DateTimeFormat will throw
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/**
 * Convert a local date string (YYYY-MM-DD) and time string (HH:MM)
 * to a UTC Date, using the instructor's timezone.
 *
 * This is used when an instructor submits an offline booking form —
 * they enter "9:00 AM" in their local timezone, and we need to store
 * the correct UTC equivalent.
 *
 * Example:
 *   localDateTimeToUTC('2026-08-03', '09:00', 'Australia/Perth')
 *   → new Date('2026-08-03T01:00:00.000Z')  (Perth = UTC+8)
 *
 *   localDateTimeToUTC('2026-08-03', '09:00', 'Australia/Sydney')
 *   → new Date('2026-08-02T23:00:00.000Z')  (Sydney = UTC+10)
 */
export function localDateTimeToUTC(date: string, time: string, timezone: string): Date {
  const tz = resolveTimezone(timezone);

  // Build an ISO-like string and find the UTC offset for that instant in the given TZ.
  // We do this by formatting a reference date with the target timezone offset,
  // then computing the delta from UTC.
  const localIso = `${date}T${time}:00`;

  // Parse as if it were UTC to get a reference point
  const referenceUtc = new Date(localIso + 'Z');

  // Format that UTC instant in the target timezone to see what local time it represents
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(referenceUtc);
  const p = Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  const tzLocalIso = `${p.year}-${p.month}-${p.day}T${p.hour === '24' ? '00' : p.hour}:${p.minute}:${p.second}Z`;
  const tzLocal = new Date(tzLocalIso);

  // The offset is how far the TZ-local time differs from our input
  const inputDate = new Date(localIso + 'Z');
  const offsetMs = inputDate.getTime() - tzLocal.getTime();

  const candidate = new Date(inputDate.getTime() + offsetMs);

  // ── DST-boundary verification (added for PB-SEC-02) ─────────────────────────
  // On spring-forward transition days the reference-derived offset can be the
  // post-transition offset while the input wall time falls before the transition
  // (00:00–02:00 window). Round-trip the candidate and check it reproduces the
  // input wall time in the target timezone. If it does not, try the offset one
  // hour earlier/later — one of the two candidates always round-trips.
  const roundTrip = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  });
  const fmt = (d: Date) => {
    const fp = roundTrip.formatToParts(d);
    const q = Object.fromEntries(fp.filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
    return `${q.year}-${q.month}-${q.day}T${q.hour === '24' ? '00' : q.hour}:${q.minute}`;
  };

  const targetWall = `${date}T${time}`;
  if (fmt(candidate) === targetWall) return candidate;

  // Try adjacent offsets (±1h) — covers both DST transition directions
  for (const delta of [-3600000, 3600000]) {
    const alt = new Date(candidate.getTime() + delta);
    if (fmt(alt) === targetWall) return alt;
  }

  // Nonexistent local time (inside the spring-forward gap): no candidate
  // round-trips. Map forward past the gap — consistent with how most systems
  // resolve nonexistent wall times. The advance-notice check tolerates this:
  // at worst the slot lands slightly later, which only makes it MORE available.
  return candidate;
}

/**
 * Format a UTC Date as a local time string in the given timezone.
 *
 * Example:
 *   formatLocalTime(new Date('2026-08-03T01:00:00Z'), 'Australia/Perth')
 *   → '09:00'
 */
export function formatLocalTime(utcDate: Date | string, timezone: string, opts?: Intl.DateTimeFormatOptions): string {
  const tz = resolveTimezone(timezone);
  const d = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  return d.toLocaleTimeString('en-AU', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...opts,
  });
}

/**
 * Format a UTC Date as a local date string in the given timezone.
 *
 * Example:
 *   formatLocalDate(new Date('2026-08-03T01:00:00Z'), 'Australia/Perth')
 *   → '3 Aug 2026'
 */
export function formatLocalDate(utcDate: Date | string, timezone: string, opts?: Intl.DateTimeFormatOptions): string {
  const tz = resolveTimezone(timezone);
  const d = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  return d.toLocaleDateString('en-AU', {
    timeZone: tz,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...opts,
  });
}

/**
 * Get the YYYY-MM-DD date string for a UTC timestamp in the given timezone.
 * Used for grouping bookings by local day.
 *
 * Example:
 *   getLocalDateKey(new Date('2026-08-03T01:00:00Z'), 'Australia/Perth')
 *   → '2026-08-03'
 *
 *   getLocalDateKey(new Date('2026-08-03T01:00:00Z'), 'Australia/Sydney')
 *   → '2026-08-03'  (Sydney 11:00am)
 *
 *   getLocalDateKey(new Date('2026-08-02T14:00:00Z'), 'Australia/Perth')
 *   → '2026-08-02'  (Perth 10pm is still Aug 2)
 *
 *   getLocalDateKey(new Date('2026-08-02T15:00:00Z'), 'Australia/Sydney')
 *   → '2026-08-03'  (Sydney 1am = next day)
 */
export function getLocalDateKey(utcDate: Date | string, timezone: string): string {
  const tz = resolveTimezone(timezone);
  const d = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  const formatter = new Intl.DateTimeFormat('en-CA', { // en-CA gives YYYY-MM-DD
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d); // returns "2026-08-03"
}

/**
 * Get the default timezone for a given Australian state code.
 * Used as a fallback when instructor hasn't set their timezone explicitly.
 */
export function timezoneFromState(state: string | null | undefined): string {
  const map: Record<string, string> = {
    WA:  'Australia/Perth',
    SA:  'Australia/Adelaide',
    NT:  'Australia/Darwin',
    QLD: 'Australia/Brisbane',
    NSW: 'Australia/Sydney',
    VIC: 'Australia/Melbourne',
    TAS: 'Australia/Hobart',
    ACT: 'Australia/Sydney',
  };
  return map[state?.toUpperCase() ?? ''] ?? DEFAULT_TIMEZONE;
}
