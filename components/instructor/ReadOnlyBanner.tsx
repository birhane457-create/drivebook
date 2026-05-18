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
    <div className="bg-amber-50 border-b-2 border-amber-400 px-4 py-3 flex items-center gap-3 sticky top-16 z-40">
      <Lock className="h-5 w-5 text-amber-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-900">Read-only mode</p>
        <p className="text-xs text-amber-800 mt-0.5 truncate">{reason}</p>
      </div>
      <Link
        href="/dashboard/subscription"
        className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
