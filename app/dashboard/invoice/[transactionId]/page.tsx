'use client';

/**
 * /dashboard/invoice/[transactionId]
 * ─────────────────────────────────────────────
 * Real invoice page for a specific transaction.
 * Fetches structured data from the JSON endpoint
 * and renders it using the shared InvoiceLayout.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import InvoiceLayout, { InvoiceData } from '@/components/invoice/InvoiceLayout';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function InvoicePage() {
  const { transactionId } = useParams<{ transactionId: string }>();
  const [data, setData] = useState<InvoiceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!transactionId) return;
    fetch(`/api/instructor/invoices/${transactionId}/data`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
      .then(setData)
      .catch(() => setError('Failed to load invoice. Check the transaction ID or try again.'));
  }, [transactionId]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-400">{error}</p>
          <Link
            href="/dashboard/earnings"
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-100 transition-colors justify-center"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Earnings
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-500 text-sm animate-pulse">Loading invoice…</p>
      </div>
    );
  }

  return <InvoiceLayout data={data} />;
}
