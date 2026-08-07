/**
 * PermissionGate
 *
 * Wraps any action-triggering UI element. When the capability is denied,
 * renders the children as visually disabled with a tooltip explaining why
 * and linking to the relevant action (documents, subscription, etc.).
 *
 * Messaging lives here — the permission engine only returns booleans.
 *
 * Usage:
 *   <PermissionGate capability="canCreateBooking">
 *     <button onClick={createBooking}>New Booking</button>
 *   </PermissionGate>
 *
 * The gate never hides the UI element — it always renders. This is
 * intentional: instructors should see what they'll unlock, not a blank page.
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import type { Capabilities } from '@/lib/permissions/permissionEngine';

// ── Messaging config ──────────────────────────────────────────────────────────
// Add an entry here when adding a new capability to the engine.

interface CapabilityMessage {
  label: string;
  reason: string;
  cta: string;
  ctaHref: string;
}

const CAPABILITY_MESSAGES: Record<keyof Capabilities, CapabilityMessage> = {
  canCreateBooking: {
    label:   'Create booking',
    reason:  'Verify your account to create bookings',
    cta:     'Upload documents →',
    ctaHref: '/dashboard/documents',
  },
  canCreateOfflineBooking: {
    label:   'Log offline booking',
    reason:  'Verify your account to log offline bookings',
    cta:     'Upload documents →',
    ctaHref: '/dashboard/documents',
  },
  canSendClientReminder: {
    label:   'Send reminder',
    reason:  'Verify your account to send client reminders',
    cta:     'Upload documents →',
    ctaHref: '/dashboard/documents',
  },
  canCheckInOut: {
    label:   'Check in / out',
    reason:  'Verify your account to check in and out of lessons',
    cta:     'Upload documents →',
    ctaHref: '/dashboard/documents',
  },
  canPublishProfile: {
    label:   'Publish profile',
    reason:  'Verify your account to appear in student search',
    cta:     'Upload documents →',
    ctaHref: '/dashboard/documents',
  },
  canReceivePayments: {
    label:   'Receive payments',
    reason:  'Verify your account to receive lesson payments',
    cta:     'Upload documents →',
    ctaHref: '/dashboard/documents',
  },
  canEditSetup: {
    // Always allowed — this entry is a no-op but keeps the map complete
    label:   'Edit setup',
    reason:  '',
    cta:     '',
    ctaHref: '',
  },
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface PermissionGateProps {
  capability: keyof Capabilities;
  children?: React.ReactNode;
  /**
   * When true, renders a full locked card instead of wrapping the children.
   * Use this for buttons that are the primary CTA on a page (e.g. "New Booking").
   * children is optional when showLockCard is true.
   */
  showLockCard?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PermissionGate({
  capability,
  children,
  showLockCard = false,
}: PermissionGateProps) {
  const permissions = usePermissions();
  const allowed = permissions[capability];
  const [tooltipOpen, setTooltipOpen] = useState(false);

  // While loading, show children in loading/disabled state
  if (permissions.loading) {
    return children ? <>{children}</> : null;
  }

  // Allowed — render children as-is
  if (allowed) {
    return children ? <>{children}</> : null;
  }

  const msg = CAPABILITY_MESSAGES[capability];

  // Full lock card variant — for primary CTAs
  if (showLockCard) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-950/20">
        <Lock className="h-4 w-4 text-amber-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-200">{msg.reason}</p>
        </div>
        <Link
          href={msg.ctaHref}
          className="shrink-0 text-xs font-semibold text-amber-300 hover:text-amber-100 underline underline-offset-2 transition-colors"
        >
          {msg.cta}
        </Link>
      </div>
    );
  }

  // Inline lock wrapper — renders children visually disabled with a tooltip
  // Falls back to lock card if no children provided
  if (!children) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-950/20">
        <Lock className="h-4 w-4 text-amber-400 shrink-0" />
        <p className="text-sm font-medium text-amber-200 flex-1">{msg.reason}</p>
        <Link href={msg.ctaHref} className="shrink-0 text-xs font-semibold text-amber-300 hover:text-amber-100 underline underline-offset-2 transition-colors">{msg.cta}</Link>
      </div>
    );
  }

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setTooltipOpen(true)}
      onMouseLeave={() => setTooltipOpen(false)}
    >
      {/* Overlay that captures clicks and prevents interaction */}
      <div
        className="absolute inset-0 z-10 cursor-not-allowed rounded"
        aria-hidden="true"
      />
      {/* Children rendered with reduced opacity */}
      <div className="opacity-40 pointer-events-none select-none" aria-disabled="true">
        {children}
      </div>
      {/* Tooltip — state-driven so it stays open when moving mouse into it */}
      {tooltipOpen && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pb-1"
          onMouseEnter={() => setTooltipOpen(true)}
          onMouseLeave={() => setTooltipOpen(false)}
        >
          <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl px-3 py-2.5
                          text-xs text-slate-200 whitespace-nowrap max-w-[240px] mb-1">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Lock className="h-3 w-3 text-amber-400 shrink-0" />
              <span className="font-medium text-amber-300">{msg.reason}</span>
            </div>
            <Link
              href={msg.ctaHref}
              className="text-sky-400 hover:text-sky-300 underline underline-offset-2 transition-colors block"
            >
              {msg.cta}
            </Link>
          </div>
          {/* Arrow */}
          <div className="w-2 h-2 bg-slate-900 border-r border-b border-slate-700 rotate-45 -mt-1 shrink-0" />
        </div>
      )}
    </div>
  );
}
