'use client';

/**
 * Receipt A — Package Purchase (Stripe payment)
 * Sent to student after buying a lesson package.
 */

import ReceiptShell from './ReceiptShell';
import ReceiptMeta from './ReceiptMeta';
import LineItems from './LineItems';
import WalletBox from './WalletBox';
import CancellationPolicy from './CancellationPolicy';

interface Props {
  isDemo?: boolean;
  data?: {
    receiptNumber: string;
    paidAt: string;
    clientName: string;
    clientEmail: string;
    instructorName: string;
    instructorLocation: string;
    packageHours: number;
    hourlyRate: number;
    subtotal: number;
    discountPercent: number;
    discount: number;
    platformFee: number;
    total: number;
    firstLessonDate: string;
    firstLessonDuration: number;
    pickupAddress: string;
    walletLoaded: number;
    firstLessonDebit: number;
    walletBalance: number;
    paymentMethod: string;
    stripeRef: string;
    bookingRef: string;
  };
}

const DEMO = {
  receiptNumber: 'DB-2026-A1B2C3',
  paidAt: 'Monday, 22 July 2026 at 09:02 AM',
  clientName: 'Sophie Anderson',
  clientEmail: 'sophie@email.com',
  instructorName: 'James Nguyen',
  instructorLocation: 'Claremont, WA',
  packageHours: 10,
  hourlyRate: 90.00,
  subtotal: 900.00,
  discountPercent: 10,
  discount: 90.00,
  platformFee: 29.16,
  total: 839.16,
  firstLessonDate: 'Tuesday, 23 July 2026 at 09:00 AM',
  firstLessonDuration: 2,
  pickupAddress: '14 Stirling Hwy, Claremont WA 6010',
  walletLoaded: 810.00,
  firstLessonDebit: 180.00,
  walletBalance: 630.00,
  paymentMethod: 'Visa •••• 4242',
  stripeRef: 'pi_3PxDemo00000000001',
  bookingRef: 'BK-2026-A1B2C3',
};

export default function ReceiptA_PackagePurchase({ isDemo, data }: Props) {
  const d = data ?? DEMO;
  return (
    <ReceiptShell
      receiptNumber={d.receiptNumber}
      accentColor="#1d4ed8"
      subtitle="Package Purchase — Tax Receipt"
      status="PAID"
      isDemo={isDemo ?? !data}
    >
      <ReceiptMeta rows={[
        { label: 'Date', value: d.paidAt },
        { label: 'Paid by', value: d.clientName },
        { label: 'Email', value: d.clientEmail },
      ]} />

      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">What You Purchased</p>
        <p className="font-semibold text-slate-100">{d.packageHours}-Hour Driving Lesson Package</p>
        <p className="text-sm text-slate-400 mt-0.5">with {d.instructorName} · {d.instructorLocation}</p>
        <p className="text-sm text-slate-300 mt-2">
          <span className="font-medium">First lesson:</span> {d.firstLessonDate}
        </p>
        <p className="text-xs text-slate-400">📍 {d.pickupAddress}</p>
        <p className="text-xs text-slate-400">Duration: {d.firstLessonDuration} hours</p>
      </div>

      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Payment Breakdown</p>
        <LineItems
          lines={[
            { label: `${d.packageHours} hrs × $${d.hourlyRate.toFixed(2)}/hr`, value: `$${d.subtotal.toFixed(2)}` },
            { label: `Package discount (${d.discountPercent}%)`, value: `-$${d.discount.toFixed(2)}`, color: 'green' },
            { label: 'Platform fee (3.6%)', value: `+$${d.platformFee.toFixed(2)}` },
          ]}
          total={{ label: 'Total Charged', value: `$${d.total.toFixed(2)}`, accentColor: '#1d4ed8' }}
        />
        <p className="text-xs text-slate-500 mt-2">Payment method: {d.paymentMethod}</p>
        <p className="text-xs font-mono text-slate-600 mt-0.5">Ref: {d.stripeRef}</p>
      </div>

      <WalletBox
        rows={[
          { label: 'Credits loaded', value: `+$${d.walletLoaded.toFixed(2)}`, color: 'green' },
          { label: 'First lesson debit', value: `-$${d.firstLessonDebit.toFixed(2)}`, color: 'red' },
        ]}
        balanceLabel="Remaining balance"
        balanceValue={`$${d.walletBalance.toFixed(2)}`}
      />

      <CancellationPolicy />

      <p className="text-xs text-slate-600 text-center">
        Questions? support@drivebook.com.au · Booking ref: {d.bookingRef}
      </p>
    </ReceiptShell>
  );
}
