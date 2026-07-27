'use client';

/**
 * Receipt E — Cancellation / Refund
 * Sent to student when a booking is cancelled.
 * Shows three states: full refund / partial refund / no refund.
 */

import ReceiptShell from './ReceiptShell';
import ReceiptMeta from './ReceiptMeta';
import LineItems from './LineItems';
import WalletBox from './WalletBox';

interface Props {
  isDemo?: boolean;
  /** 'full' | 'partial' | 'none' — controls which variant renders */
  variant?: 'full' | 'partial' | 'none';
}

export default function ReceiptE_Cancellation({ isDemo, variant = 'full' }: Props) {
  const variants = {
    full: {
      label: '48+ hrs notice — Full refund',
      refundLine: { label: 'Refund (100%)', value: '+$180.00', color: 'green' as const },
      total: { label: 'Refunded to wallet', value: '$180.00', accentColor: '#10b981' },
      wallet: {
        rows: [
          { label: 'Refund credited', value: '+$180.00', color: 'green' as const },
          { label: 'Balance before', value: '$270.00' },
        ],
        balanceLabel: 'Current balance',
        balanceValue: '$450.00',
      },
    },
    partial: {
      label: '24–48 hrs notice — 50% refund',
      refundLine: { label: 'Refund (50%)', value: '+$90.00', color: 'green' as const },
      total: { label: 'Refunded to wallet', value: '$90.00', accentColor: '#10b981' },
      wallet: {
        rows: [
          { label: 'Refund credited', value: '+$90.00', color: 'green' as const },
          { label: 'Balance before', value: '$270.00' },
        ],
        balanceLabel: 'Current balance',
        balanceValue: '$360.00',
      },
    },
    none: {
      label: 'Under 24 hrs — No refund',
      refundLine: { label: 'Refund', value: 'None — under 24 hrs notice', color: 'red' as const },
      total: { label: 'Amount forfeited', value: '$180.00', accentColor: '#ef4444' },
      wallet: null,
    },
  };

  const v = variants[variant];

  return (
    <ReceiptShell
      receiptNumber="DB-2026-E5F6G7"
      accentColor="#dc2626"
      subtitle="Booking Cancelled — Refund Receipt"
      status="CANCELLED"
      isDemo={isDemo ?? true}
    >
      <ReceiptMeta rows={[
        { label: 'Cancelled', value: '22 Jul 2026 at 08:00 AM' },
        { label: 'Cancelled by', value: variant === 'none' ? 'You (under 24 hrs)' : 'You' },
        { label: 'Policy applied', value: v.label },
      ]} />

      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Cancelled Lesson</p>
        <p className="font-semibold text-slate-100">Wednesday, 24 July 2026 at 09:00 AM</p>
        <p className="text-sm text-slate-400 mt-0.5">Instructor: James Nguyen</p>
      </div>

      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Refund Summary</p>
        <LineItems
          lines={[
            { label: 'Lesson price', value: '$180.00' },
            v.refundLine,
          ]}
          total={v.total}
        />
      </div>

      {v.wallet && (
        <WalletBox
          rows={v.wallet.rows}
          balanceLabel={v.wallet.balanceLabel}
          balanceValue={v.wallet.balanceValue}
        />
      )}

      <p className="text-xs text-slate-500 text-center">
        Questions? support@drivebook.com.au
      </p>
    </ReceiptShell>
  );
}
