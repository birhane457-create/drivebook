'use client';

/**
 * Receipt B — Wallet Lesson Booking
 * Sent to student when a lesson is booked from wallet credits.
 */

import ReceiptShell from './ReceiptShell';
import ReceiptMeta from './ReceiptMeta';
import LineItems from './LineItems';
import WalletBox from './WalletBox';
import CancellationPolicy from './CancellationPolicy';

interface Props { isDemo?: boolean }

export default function ReceiptB_WalletLesson({ isDemo }: Props) {
  return (
    <ReceiptShell
      receiptNumber="DB-2026-B2C3D4"
      accentColor="#1d4ed8"
      subtitle="Lesson Booked — Wallet Receipt"
      status="PAID"
      isDemo={isDemo ?? true}
    >
      <ReceiptMeta rows={[
        { label: 'Date', value: '22 Jul 2026' },
        { label: 'Paid by', value: 'Sophie Anderson' },
        { label: 'Booked by', value: 'Your instructor (James Nguyen)' },
      ]} />

      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Lesson Booked</p>
        <p className="font-semibold text-slate-100">Wednesday, 24 July 2026 at 10:00 AM</p>
        <p className="text-sm text-slate-400 mt-0.5">Duration: 2 hours · Instructor: James Nguyen</p>
      </div>

      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Payment</p>
        <LineItems
          lines={[
            { label: '2 hrs × $90.00/hr', value: '$180.00' },
            { label: 'Paid from wallet', value: '-$180.00', color: 'green' },
          ]}
          total={{ label: 'Charged to card', value: '$0.00', accentColor: '#1d4ed8' }}
        />
      </div>

      <WalletBox
        rows={[
          { label: 'Before booking', value: '$630.00' },
          { label: 'Lesson debit', value: '-$180.00', color: 'red' },
        ]}
        balanceLabel="After booking"
        balanceValue="$450.00 (approx. 5.0 hrs)"
      />

      <CancellationPolicy />
    </ReceiptShell>
  );
}
