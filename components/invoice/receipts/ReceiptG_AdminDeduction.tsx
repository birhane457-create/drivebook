'use client';

/**
 * Receipt G — Admin Manual Deduction
 * Sent when admin removes wallet credits from a student's account.
 */

import ReceiptShell from './ReceiptShell';
import ReceiptMeta from './ReceiptMeta';
import LineItems from './LineItems';
import WalletBox from './WalletBox';

interface Props { isDemo?: boolean }

export default function ReceiptG_AdminDeduction({ isDemo }: Props) {
  return (
    <ReceiptShell
      receiptNumber="DB-2026-G7H8I9"
      accentColor="#b45309"
      subtitle="Wallet Adjustment — Credit Deducted"
      status="DEDUCTED"
      isDemo={isDemo ?? true}
    >
      <ReceiptMeta rows={[
        { label: 'Date', value: '22 Jul 2026 at 11:30 AM' },
        { label: 'Account', value: 'Sophie Anderson' },
        { label: 'Issued by', value: 'DriveBook Support' },
        { label: 'Transaction ID', value: 'wt_demo_G7H8I9J0', mono: true },
      ]} />

      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Deduction Details</p>
        <LineItems
          lines={[
            { label: 'Amount deducted', value: '-$45.00', color: 'red', bold: true },
            { label: 'Reason', value: 'Correction — duplicate credit issued 21 Jul', color: 'muted' },
          ]}
          total={{ label: 'Amount Removed', value: '$45.00', accentColor: '#ef4444' }}
        />
      </div>

      <WalletBox
        rows={[
          { label: 'Previous balance', value: '$275.00' },
          { label: 'Deduction', value: '-$45.00', color: 'red' },
        ]}
        balanceLabel="New balance"
        balanceValue="$230.00"
      />

      <p className="text-xs text-slate-500 text-center">
        If you believe this was in error, contact support@drivebook.com.au and quote Transaction ID <span className="font-mono">wt_demo_G7H8I9J0</span>.
      </p>
    </ReceiptShell>
  );
}
