/**
 * Booking status configuration — single source of truth for colours and labels.
 * Import this wherever status needs to be displayed: dashboard, bookings list,
 * calendar views, admin pages.
 *
 * Colours use Tailwind classes (bg, text, border) so they tree-shake correctly.
 */

export type BookingStatus =
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'PENDING'
  | 'PENDING_PAYMENT'
  | 'NO_SHOW'
  | 'EXPIRED';

export interface StatusConfig {
  label:       string;
  dot:         string;   // Tailwind bg class for the colour dot
  badge:       string;   // Tailwind classes for the full badge
  border:      string;   // Tailwind left-border accent for timeline rows
  text:        string;   // Tailwind text colour
}

export const BOOKING_STATUS: Record<BookingStatus, StatusConfig> = {
  CONFIRMED: {
    label:  'Confirmed',
    dot:    'bg-emerald-400',
    badge:  'bg-emerald-950/40 text-emerald-300 border border-emerald-700/50',
    border: 'border-l-emerald-400',
    text:   'text-emerald-400',
  },
  COMPLETED: {
    label:  'Completed',
    dot:    'bg-sky-400',
    badge:  'bg-sky-950/40 text-sky-300 border border-sky-700/50',
    border: 'border-l-sky-400',
    text:   'text-sky-400',
  },
  PENDING: {
    label:  'Pending Approval',
    dot:    'bg-amber-400',
    badge:  'bg-amber-950/40 text-amber-300 border border-amber-700/50',
    border: 'border-l-amber-400',
    text:   'text-amber-400',
  },
  PENDING_PAYMENT: {
    label:  'Awaiting Payment',
    dot:    'bg-violet-400',
    badge:  'bg-violet-950/40 text-violet-300 border border-violet-700/50',
    border: 'border-l-violet-400',
    text:   'text-violet-400',
  },
  CANCELLED: {
    label:  'Cancelled',
    dot:    'bg-rose-400',
    badge:  'bg-rose-950/40 text-rose-300 border border-rose-700/50',
    border: 'border-l-rose-400',
    text:   'text-rose-400',
  },
  NO_SHOW: {
    label:  'No Show',
    dot:    'bg-orange-400',
    badge:  'bg-orange-950/40 text-orange-300 border border-orange-700/50',
    border: 'border-l-orange-400',
    text:   'text-orange-400',
  },
  EXPIRED: {
    label:  'Expired',
    dot:    'bg-slate-500',
    badge:  'bg-slate-800/60 text-slate-400 border border-slate-700/50',
    border: 'border-l-slate-500',
    text:   'text-slate-400',
  },
};

/** Fallback for unknown/past statuses */
export const DEFAULT_STATUS_CONFIG: StatusConfig = {
  label:  'Unknown',
  dot:    'bg-slate-600',
  badge:  'bg-slate-800/60 text-slate-400 border border-slate-700/50',
  border: 'border-l-slate-600',
  text:   'text-slate-400',
};

export function getStatusConfig(status: string): StatusConfig {
  return BOOKING_STATUS[status as BookingStatus] ?? DEFAULT_STATUS_CONFIG;
}

/** Returns true for statuses that count as "active" (not done, not cancelled) */
export function isActiveStatus(status: string): boolean {
  return ['CONFIRMED', 'PENDING', 'PENDING_PAYMENT'].includes(status);
}

/** Returns true for statuses that count as "done" */
export function isDoneStatus(status: string): boolean {
  return ['COMPLETED', 'NO_SHOW'].includes(status);
}
