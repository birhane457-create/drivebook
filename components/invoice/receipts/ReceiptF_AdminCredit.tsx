'use client';

/**
 * Receipt F — Admin Manual Credit
 * Sent when admin adds wallet credits to a student's account.
 */

import ReceiptShell from './ReceiptShell';
import ReceiptMeta from './ReceiptMeta';
import LineItems from './LineItems';
import WalletBox from './WalletBox';

interface Props { isDemo?: boolean }

export default function ReceiptF_AdminCredit({ isDemo }: Props) {
  return (
    <ReceiptShell
      receiptNumber="DB-2026-F6G7H8"
      accentColor="#1d4ed8"
      subtitle="Wallet Credit — Issued by Support"
      status="CREDITED"
      isDemo={isDemo ?? true}
    >
      <ReceiptMeta rows={[
        { label: 'Date', value: '22 Jul 2026' },
        { label: 'Account', value: 'Sophie Anderson' },
        { label: 'Issued by', value: 'DriveBook Support' },
      ]} />

      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Credit Details</p>
        <LineItems
          lines={[
            { label: 'Credits added', value: '+$50.00', color: 'green', bold: true },
            { label: 'Reason', value: 'Goodwill — lesson ran 30 min short', color: 'muted' },
          ]}
          total={{ label: 'Total Credited', value: '$50.00', accentColor: '#1d4ed8' }}
        />
      </div>

      <WalletBox
        rows={[
          { label: 'Previous balance', value: '$180.00' },
          { label: 'Credit added', value: '+$50.00', color: 'green' },
        ]}
        balanceLabel="New balance"
        balanceValue="$230.00"
      />

      <p className="text-xs text-slate-500 text-center">
        Credits never expire and can be used with any instructor on DriveBook.
      </p>
    </ReceiptShell>
  );
}
