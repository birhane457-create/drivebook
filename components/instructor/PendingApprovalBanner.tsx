'use client';

import Link from 'next/link';
import { Clock, FileText, CheckCircle } from 'lucide-react';

interface PendingApprovalBannerProps {
  approvalStatus: string; // 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'REJECTED'
}

/**
 * Shown at the top of the instructor dashboard when the account is PENDING approval.
 * Instructors can set up their profile and upload documents while waiting.
 * They cannot create bookings until APPROVED.
 */
export default function PendingApprovalBanner({ approvalStatus }: PendingApprovalBannerProps) {
  if (approvalStatus === 'APPROVED') return null;

  if (approvalStatus === 'REJECTED') {
    return (
      <div className="bg-red-50 border-b-2 border-red-400 px-4 py-3 flex items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-900">Application not approved</p>
          <p className="text-xs text-red-800 mt-0.5">
            Your application was not approved. Please contact support for more information.
          </p>
        </div>
        <a
          href="mailto:support@drivebook.com.au"
          className="shrink-0 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
        >
          Contact Support
        </a>
      </div>
    );
  }

  // PENDING (default)
  return (
    <div className="bg-blue-50 border-b-2 border-blue-400 px-4 py-3">
      <div className="flex items-start gap-3">
        <Clock className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-blue-900">Account pending approval</p>
          <p className="text-xs text-blue-800 mt-0.5">
            Our team will review your application within 24–48 hours. While you wait, complete your setup:
          </p>
          <div className="flex flex-wrap gap-3 mt-2">
            <Link
              href="/dashboard/profile"
              className="flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 bg-white border border-blue-200 px-2.5 py-1 rounded-lg"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Complete Profile
            </Link>
            <Link
              href="/dashboard/documents"
              className="flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 bg-white border border-blue-200 px-2.5 py-1 rounded-lg"
            >
              <FileText className="h-3.5 w-3.5" />
              Upload Documents
            </Link>
            <Link
              href="/dashboard/availability"
              className="flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 bg-white border border-blue-200 px-2.5 py-1 rounded-lg"
            >
              <Clock className="h-3.5 w-3.5" />
              Set Availability
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
