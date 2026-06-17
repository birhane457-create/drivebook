'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';

interface ReadOnlyBannerProps {
  reason: string;
  status: string;
}

/**
 * Shown at the top of every dashboard page when the instructor's subscription
 * is inactive. They can still view all their data (read-only) but cannot
 * create or modify anything until they resubscribe.
 */
export default function ReadOnlyBanner({ reason, status }: ReadOnlyBannerProps) {
  const ctaLabel =
    status === 'PAST_DUE' ? 'Update Payment' :
    status === 'CANCELLED' ? 'Resubscribe' :
    'Choose a Plan';

  return (
    <div className="sticky top-16 z-40 flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-slate-900/95 px-4 py-3 shadow-lg shadow-amber-600/10 backdrop-blur-xl">
      <Lock className="h-5 w-5 text-amber-300 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-100">Read-only mode</p>
        <p className="text-xs text-amber-200 mt-0.5 truncate">{reason}</p>
      </div>
      <Link
        href="/dashboard/subscription"
        className="shrink-0 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
