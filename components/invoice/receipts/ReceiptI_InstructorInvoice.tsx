'use client';

/**
 * Receipt I — Instructor Per-Lesson Tax Invoice
 * Visual version of the per-transaction invoice (replaces the .txt download).
 * Shows one completed lesson with full payout breakdown.
 */

import ReceiptShell from './ReceiptShell';
import ReceiptMeta from './ReceiptMeta';
import LineItems from './LineItems';

interface Props { isDemo?: boolean }

export default function ReceiptI_InstructorInvoice({ isDemo }: Props) {
  return (
    <ReceiptShell
      receiptNumber="INV-2026-A1B2C3D4"
      accentColor="#6366f1"
      subtitle="Tax Invoice — Lesson Payout"
      status="PAID"
      isDemo={isDemo ?? true}
    >
      <ReceiptMeta rows={[
        { label: 'Date issued', value: '22 Jul 2026' },
        { label: 'Status', value: 'PAID — processed 22 Jul 2026' },
      ]} />

      {/* From / To */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-950 rounded-xl border border-slate-800 px-4 py-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">From (Instructor)</p>
          <p className="font-semibold text-slate-100">Nguyen Drive Training</p>
          <p className="text-xs text-slate-400">James Nguyen</p>
          <p className="text-xs text-slate-400">james@nguyendrive.com.au</p>
          <p className="text-xs text-slate-400">0412 345 678</p>
          <p className="text-xs text-slate-600 italic mt-1">ABN not set — update in Profile</p>
          <p className="text-xs text-slate-600 mt-0.5">via DriveBook</p>
        </div>
        <div className="bg-slate-950 rounded-xl border border-slate-800 px-4 py-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">To (Student)</p>
          <p className="font-semibold text-slate-100">Sophie Anderson</p>
          <p className="text-xs text-slate-400">sophie@email.com</p>
          <p className="text-xs text-slate-400">0432 100 200</p>
        </div>
      </div>

      {/* Lesson line item */}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Lesson Details</p>
        <div className="bg-slate-950 rounded-xl border border-slate-800 px-4 py-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-slate-100">Standard Lesson</p>
              <p className="text-xs text-slate-400 mt-0.5">Tuesday, 22 July 2026</p>
              <p className="text-xs text-slate-400">09:00 AM – 11:00 AM AWST · 2 hrs</p>
              <p className="text-xs text-slate-400 mt-0.5">📍 14 Stirling Hwy, Claremont WA 6010</p>
              <p className="text-xs text-slate-600 mt-0.5">Booking ref: BK-2026-A1B2C3</p>
            </div>
            <div className="text-right shrink-0 ml-4">
              <p className="text-xs text-slate-500">$90.00/hr × 2h</p>
              <p className="font-semibold text-slate-100">$180.00</p>
            </div>
          </div>
        </div>
      </div>

      {/* Payout breakdown */}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Payout Breakdown</p>
        <LineItems
          lines={[
            { label: 'Lesson total', value: '$180.00' },
            { label: 'Platform commission (12%)', value: '−$21.60', color: 'red' },
            { label: 'Processing fees', value: '$0.00', color: 'muted' },
          ]}
          total={{ label: 'Your Payout', value: '$158.40', accentColor: '#6366f1' }}
        />
      </div>

      {/* Payment meta */}
      <div className="bg-slate-950 rounded-xl border border-slate-800 px-4 py-3">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-slate-500 uppercase tracking-wide">Payment method</p>
            <p className="text-slate-300 mt-0.5 font-medium">Visa •••• 4242</p>
          </div>
          <div>
            <p className="text-slate-500 uppercase tracking-wide">Paid at</p>
            <p className="text-slate-300 mt-0.5 font-medium">22 Jul 2026, 9:02 AM AWST</p>
          </div>
          <div className="col-span-2">
            <p className="text-slate-500 uppercase tracking-wide">Stripe Payment ID</p>
            <p className="font-mono text-slate-500 mt-0.5 text-xs">pi_3PxDemo00000000001</p>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center leading-relaxed">
        Tax invoice issued by DriveBook (ABN 12 345 678 901) on behalf of Nguyen Drive Training.<br />
        Questions: support@drivebook.com.au · drivebook.com.au
      </p>
    </ReceiptShell>
  );
}
