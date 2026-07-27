'use client';

/**
 * ReceiptShell
 * Shared wrapper for all receipt/invoice types.
 * Provides the dark-card container, status badge, print/save button.
 * Individual receipt body components render as children.
 */

import { CheckCircle, Clock, XCircle, AlertTriangle, Printer } from 'lucide-react';

export type ReceiptStatus = 'PAID' | 'PENDING' | 'CANCELLED' | 'CREDITED' | 'DEDUCTED' | 'REFUNDED';

const STATUS = {
  PAID:      { label: 'PAID',      Icon: CheckCircle,   cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  PENDING:   { label: 'PENDING',   Icon: Clock,         cls: 'bg-amber-500/10   text-amber-400   border-amber-500/30'   },
  CANCELLED: { label: 'CANCELLED', Icon: XCircle,       cls: 'bg-red-500/10     text-red-400     border-red-500/30'     },
  CREDITED:  { label: 'CREDITED',  Icon: CheckCircle,   cls: 'bg-sky-500/10     text-sky-400     border-sky-500/30'     },
  DEDUCTED:  { label: 'DEDUCTED',  Icon: AlertTriangle, cls: 'bg-orange-500/10  text-orange-400  border-orange-500/30'  },
  REFUNDED:  { label: 'REFUNDED',  Icon: CheckCircle,   cls: 'bg-violet-500/10  text-violet-400  border-violet-500/30'  },
};

interface Props {
  /** Receipt number shown top-right, e.g. "DB-2026-A1B2C3" */
  receiptNumber: string;
  /** Coloured top bar. Defaults to indigo. */
  accentColor?: string;
  /** Subheading under "DriveBook" in the header */
  subtitle: string;
  status: ReceiptStatus;
  isDemo?: boolean;
  children: React.ReactNode;
}

export default function ReceiptShell({
  receiptNumber,
  accentColor = '#6366f1',
  subtitle,
  status,
  isDemo,
  children,
}: Props) {
  const s = STATUS[status];
  const StatusIcon = s.Icon;

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden print-container">

      {/* ── Coloured header ── */}
      <div
        className="invoice-header px-6 py-5 flex items-center justify-between"
        style={{ background: accentColor }}
      >
        <div>
          <p className="text-white/60 text-xs uppercase tracking-widest mb-0.5">DriveBook</p>
          <h2 className="text-white font-bold text-lg leading-tight">{subtitle}</h2>
        </div>
        <div className="text-right">
          <p className="text-white/60 text-xs mb-0.5">Receipt</p>
          <p className="text-white font-mono text-sm font-semibold">{receiptNumber}</p>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-6 py-5 space-y-5">

        {/* Status + demo badge */}
        <div className="flex items-center justify-between">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${s.cls}`}>
            <StatusIcon className="h-3.5 w-3.5" />
            {s.label}
          </div>
          {isDemo && (
            <span className="text-xs text-amber-500 font-semibold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
              DEMO
            </span>
          )}
        </div>

        {children}

        {/* Print hint */}
        <button
          onClick={() => window.print()}
          className="no-print w-full flex items-center justify-center gap-2 px-4 py-2 text-xs text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-800 hover:text-slate-200 transition-colors mt-2"
        >
          <Printer className="h-3.5 w-3.5" />
          Print / Save as PDF
        </button>
      </div>

      {/* ── Bottom accent strip ── */}
      <div className="h-1" style={{ background: accentColor }} />
    </div>
  );
}
