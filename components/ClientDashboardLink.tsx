'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';

export default function ClientDashboardLink() {
  const { data: session } = useSession();

  if (!session) {
    return null;
  }

  return (
    <Link
      href="/client-dashboard"
      className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all"
    >
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4z" />
        <path fillRule="evenodd" d="M3 10a1 1 0 011-1h6v-2a1 1 0 011-1h3a1 1 0 011 1v2h1a1 1 0 011 1v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5zm11-3v2H8v-2h6z" clipRule="evenodd" />
      </svg>
      My Dashboard
    </Link>
  );
}
