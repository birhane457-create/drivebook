'use client';

import Link from 'next/link';
import { Clock, FileText, CheckCircle, AlertTriangle } from 'lucide-react';

interface PendingApprovalBannerProps {
  approvalStatus: string; // 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'REJECTED'
}

/**
 * Shown at the top of the instructor dashboard when the account is not APPROVED.
 * Each status gets its own banner with the correct message and actions.
 */
export default function PendingApprovalBanner({ approvalStatus }: PendingApprovalBannerProps) {
  if (approvalStatus === 'APPROVED') return null;

  if (approvalStatus === 'REJECTED') {
    return (
      <div className="rounded-2xl border border-red-500/25 bg-slate-900/95 px-4 py-3 flex items-center gap-3 shadow-lg shadow-red-500/10 backdrop-blur-xl mb-4">
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-200">Application not approved</p>
          <p className="text-xs text-red-300 mt-0.5">
            Your application was not approved. Please contact support for more information.
          </p>
        </div>
        <a
          href="mailto:support@drivebook.com.au"
          className="shrink-0 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
        >
          Contact Support
        </a>
      </div>
    );
  }

  // FIX UX-4: SUSPENDED was falling through to the PENDING banner, showing wrong message
  if (approvalStatus === 'SUSPENDED') {
    return (
      <div className="rounded-2xl border border-amber-500/25 bg-slate-900/95 px-4 py-3 flex items-center gap-3 shadow-lg shadow-amber-500/10 backdrop-blur-xl mb-4">
        <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-200">Account suspended</p>
          <p className="text-xs text-amber-300 mt-0.5">
            Your account has been temporarily suspended. Contact support for more information.
          </p>
        </div>
        <a
          href="mailto:support@drivebook.com.au"
          className="shrink-0 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
        >
          Contact Support
        </a>
      </div>
    );
  }

  // PENDING (default for any other non-APPROVED status)
  return (
    <div className="rounded-2xl border border-blue-500/25 bg-slate-900/95 px-4 py-3 shadow-lg shadow-blue-500/10 backdrop-blur-xl mb-4">
      <div className="flex items-start gap-3">
        <Clock className="h-5 w-5 text-blue-300 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Account pending approval</p>
          <p className="text-xs text-slate-300 mt-0.5">
            Our team will review your application within 24–48 hours. While you wait, complete your setup:
          </p>
          <div className="flex flex-wrap gap-3 mt-2">
            <Link
              href="/dashboard/profile"
              className="flex items-center gap-1.5 text-xs font-medium text-slate-100 bg-slate-900/80 border border-white/10 px-2.5 py-1 rounded-lg hover:bg-slate-900"
            >
              <CheckCircle className="h-3.5 w-3.5 text-blue-300" />
              Complete Profile
            </Link>
            <Link
              href="/dashboard/documents"
              className="flex items-center gap-1.5 text-xs font-medium text-slate-100 bg-slate-900/80 border border-white/10 px-2.5 py-1 rounded-lg hover:bg-slate-900"
            >
              <FileText className="h-3.5 w-3.5 text-blue-300" />
              Upload Documents
            </Link>
            <Link
              href="/dashboard/availability"
              className="flex items-center gap-1.5 text-xs font-medium text-slate-100 bg-slate-900/80 border border-white/10 px-2.5 py-1 rounded-lg hover:bg-slate-900"
            >
              <Clock className="h-3.5 w-3.5 text-blue-300" />
              Set Availability
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
