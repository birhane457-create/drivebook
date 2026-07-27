'use client';

/**
 * Receipt D — Wallet Top-Up (Stripe payment)
 * Sent to student after adding credits to their wallet.
 */

import ReceiptShell from './ReceiptShell';
import ReceiptMeta from './ReceiptMeta';
import LineItems from './LineItems';
import WalletBox from './WalletBox';

interface Props { isDemo?: boolean }

export default function ReceiptD_WalletTopUp({ isDemo }: Props) {
  return (
    <ReceiptShell
      receiptNumber="DB-2026-D4E5F6"
      accentColor="#1d4ed8"
      subtitle="Wallet Top-Up — Receipt"
      status="PAID"
      isDemo={isDemo ?? true}
    >
      <ReceiptMeta rows={[
        { label: 'Date', value: '22 Jul 2026 at 10:15 AM' },
        { label: 'Account', value: 'Sophie Anderson' },
        { label: 'Email', value: 'sophie@email.com' },
      ]} />

      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Wallet Top-Up</p>
        <LineItems
          lines={[
            { label: 'Credits added', value: '+$200.00', color: 'green', bold: true },
          ]}
          total={{ label: 'Total Charged', value: '$200.00', accentColor: '#1d4ed8' }}
        />
        <p className="text-xs text-slate-500 mt-2">Payment method: Visa •••• 4242</p>
        <p className="text-xs font-mono text-slate-600 mt-0.5">Ref: pi_3PxDemo00000000004</p>
      </div>

      <WalletBox
        rows={[
          { label: 'Previous balance', value: '$250.00' },
          { label: 'Top-up', value: '+$200.00', color: 'green' },
        ]}
        balanceLabel="New balance"
        balanceValue="$450.00 (approx. 5.0 hrs)"
      />

      <p className="text-xs text-slate-500 text-center">
        Credits never expire and can be used with any instructor on DriveBook.
      </p>
    </ReceiptShell>
  );
}
