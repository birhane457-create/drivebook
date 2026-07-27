'use client';

/**
 * Receipt C — Single Lesson (direct Stripe payment)
 * Sent to student after paying for a single lesson.
 */

import ReceiptShell from './ReceiptShell';
import ReceiptMeta from './ReceiptMeta';
import LineItems from './LineItems';
import CancellationPolicy from './CancellationPolicy';

interface Props { isDemo?: boolean }

export default function ReceiptC_SingleLesson({ isDemo }: Props) {
  return (
    <ReceiptShell
      receiptNumber="DB-2026-C3D4E5"
      accentColor="#1d4ed8"
      subtitle="Single Lesson — Tax Receipt"
      status="PAID"
      isDemo={isDemo ?? true}
    >
      <ReceiptMeta rows={[
        { label: 'Date', value: '22 Jul 2026 at 09:02 AM' },
        { label: 'Paid by', value: 'Sophie Anderson' },
        { label: 'Email', value: 'sophie@email.com' },
      ]} />

      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Lesson Details</p>
        <p className="font-semibold text-slate-100">Wednesday, 24 July 2026 at 09:00 AM</p>
        <p className="text-sm text-slate-400 mt-0.5">Duration: 2 hours · Instructor: James Nguyen</p>
        <p className="text-xs text-slate-400 mt-0.5">📍 14 Stirling Hwy, Claremont WA 6010</p>
      </div>

      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Payment Breakdown</p>
        <LineItems
          lines={[
            { label: '2 hrs × $90.00/hr', value: '$180.00' },
            { label: 'Platform fee (3.6%)', value: '+$6.48' },
          ]}
          total={{ label: 'Total Charged', value: '$186.48', accentColor: '#1d4ed8' }}
        />
        <p className="text-xs text-slate-500 mt-2">Payment method: Visa •••• 4242</p>
        <p className="text-xs font-mono text-slate-600 mt-0.5">Ref: pi_3PxDemo00000000003</p>
      </div>

      {/* Package upsell hint */}
      <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-xl px-4 py-3">
        <p className="text-xs text-emerald-400">
          💡 <strong>Save with a package:</strong> Buy 10 hours and save $90 — only $810.
          Book a package →
        </p>
      </div>

      <CancellationPolicy />
    </ReceiptShell>
  );
}
