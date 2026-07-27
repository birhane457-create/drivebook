'use client';

/**
 * InvoiceLayout
 * ─────────────────────────────────────────────
 * Shared visual invoice/receipt component.
 * Used by the demo page and the real invoice page.
 *
 * Print-friendly: Cmd/Ctrl + P → Save as PDF gives a clean A4 invoice.
 * Screen view: max-w-3xl centered card with DriveBook dark theme.
 */

import { CheckCircle, Clock, XCircle, Printer, Download, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export interface InvoiceData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: 'PAID' | 'PENDING' | 'FAILED';

  instructor: {
    name: string;
    businessName: string | null;
    email: string;
    phone: string;
    abn: string | null;
    brandColor: string;
    logoUrl: string | null;
  };

  platform: {
    name: string;
    email: string;
    website: string;
    abn: string;
  };

  client: {
    name: string;
    email: string;
    phone: string;
  };

  lesson: {
    date: string;
    startTime: string;
    endTime: string;
    durationHours: number;
    type: string;
    pickupAddress: string;
    bookingRef: string;
    isPackage: boolean;
  };

  payment: {
    grossAmount: number;
    platformFee: number;
    commissionRate: number;
    instructorPayout: number;
    paymentMethod: string;
    stripePaymentId: string | null;
    paidAt: string;
  };
}

interface Props {
  data: InvoiceData;
  isDemo?: boolean;
}

const STATUS_CONFIG = {
  PAID: { label: 'PAID', icon: CheckCircle, bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  PENDING: { label: 'PENDING', icon: Clock, bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  FAILED: { label: 'FAILED', icon: XCircle, bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
};

function fmt(amount: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
}

export default function InvoiceLayout({ data, isDemo = false }: Props) {
  const { instructor, platform, client, lesson, payment } = data;
  const status = STATUS_CONFIG[data.status];
  const StatusIcon = status.icon;
  const displayName = instructor.businessName || instructor.name;
  const accent = instructor.brandColor;

  const handlePrint = () => window.print();

  return (
    <>
      {/* ── Print styles injected via style tag ── */}
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-container {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            background: white !important;
            color: #111 !important;
          }
          .print-container * { color-adjust: exact; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-light { background: #f9fafb !important; }
          .print-border { border-color: #e5e7eb !important; }
          .print-text-dark { color: #111827 !important; }
          .print-text-muted { color: #6b7280 !important; }
          .print-accent { color: ${accent} !important; }
          .invoice-header { background: ${accent} !important; }
        }
        @page { size: A4; margin: 12mm 14mm; }
      `}</style>

      {/* ── Screen wrapper ── */}
      <div className="min-h-screen bg-slate-950 py-8 px-4">

        {/* ── Toolbar (no-print) ── */}
        <div className="no-print max-w-3xl mx-auto mb-4 flex items-center justify-between">
          <Link
            href="/dashboard/earnings"
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Earnings
          </Link>
          <div className="flex items-center gap-2">
            {isDemo && (
              <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs font-semibold rounded border border-amber-500/30">
                DEMO — not a real invoice
              </span>
            )}
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 text-sm rounded-lg hover:bg-slate-700 transition-colors border border-slate-700"
            >
              <Printer className="h-4 w-4" />
              Print / Save PDF
            </button>
          </div>
        </div>

        {/* ── Invoice card ── */}
        <div className="print-container max-w-3xl mx-auto bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">

          {/* ── Header bar ── */}
          <div
            className="invoice-header px-8 py-6 flex items-start justify-between"
            style={{ background: accent }}
          >
            <div className="flex items-center gap-4">
              {instructor.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={instructor.logoUrl}
                  alt={`${displayName} logo`}
                  className="h-14 w-14 rounded-xl object-cover bg-white/20"
                />
              ) : (
                <div className="h-14 w-14 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-2xl">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">{displayName}</h1>
                {instructor.businessName && (
                  <p className="text-white/70 text-sm mt-0.5">{instructor.name}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-white/60 text-xs uppercase tracking-widest mb-1">Tax Invoice</p>
              <p className="text-white font-bold text-xl">{data.invoiceNumber}</p>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="px-8 py-6 space-y-6">

            {/* ── Meta row: dates + status ── */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Issue Date</p>
                    <p className="text-sm font-semibold text-slate-100 print-text-dark">{data.issueDate}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Payment</p>
                    <p className="text-sm font-semibold text-slate-100 print-text-dark">{data.dueDate}</p>
                  </div>
                </div>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${status.bg} ${status.border}`}>
                <StatusIcon className={`h-4 w-4 ${status.text}`} />
                <span className={`text-sm font-bold ${status.text}`}>{status.label}</span>
              </div>
            </div>

            {/* ── Divider ── */}
            <hr className="border-slate-800 print-border" />

            {/* ── From / To ── */}
            <div className="grid grid-cols-2 gap-6">
              {/* From: Instructor */}
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">From</p>
                <div className="space-y-1">
                  <p className="font-semibold text-slate-100 print-text-dark">{displayName}</p>
                  <p className="text-sm text-slate-400 print-text-muted">{instructor.email}</p>
                  <p className="text-sm text-slate-400 print-text-muted">{instructor.phone}</p>
                  {instructor.abn ? (
                    <p className="text-sm text-slate-400 print-text-muted">ABN: {instructor.abn}</p>
                  ) : (
                    <p className="text-xs text-slate-600 italic">ABN not set — update in Profile</p>
                  )}
                  <p className="text-xs text-slate-600 mt-1">via {platform.name}</p>
                </div>
              </div>

              {/* To: Client / Student */}
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">To</p>
                <div className="space-y-1">
                  <p className="font-semibold text-slate-100 print-text-dark">{client.name}</p>
                  <p className="text-sm text-slate-400 print-text-muted">{client.email}</p>
                  <p className="text-sm text-slate-400 print-text-muted">{client.phone}</p>
                </div>
              </div>
            </div>

            {/* ── Divider ── */}
            <hr className="border-slate-800 print-border" />

            {/* ── Lesson details ── */}
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Lesson Details</p>
              <div className="bg-slate-950 rounded-xl border border-slate-800 print-light print-border overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-12 px-4 py-2 border-b border-slate-800 print-border">
                  <p className="col-span-6 text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</p>
                  <p className="col-span-2 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Qty</p>
                  <p className="col-span-2 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Rate</p>
                  <p className="col-span-2 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Amount</p>
                </div>
                {/* Line item */}
                <div className="grid grid-cols-12 px-4 py-4 items-start">
                  <div className="col-span-6">
                    <p className="font-semibold text-slate-100 print-text-dark">
                      {lesson.type}
                      {lesson.isPackage && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 bg-purple-900/40 text-purple-300 border border-purple-700/40 rounded">Package</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400 print-text-muted mt-1">{lesson.date}</p>
                    <p className="text-xs text-slate-400 print-text-muted">{lesson.startTime} – {lesson.endTime} AWST</p>
                    <p className="text-xs text-slate-400 print-text-muted mt-1">📍 {lesson.pickupAddress}</p>
                    <p className="text-xs text-slate-600 mt-1">Booking ref: {lesson.bookingRef}</p>
                  </div>
                  <div className="col-span-2 text-center">
                    <p className="text-sm text-slate-100 print-text-dark">{lesson.durationHours}h</p>
                  </div>
                  <div className="col-span-2 text-right">
                    <p className="text-sm text-slate-100 print-text-dark">
                      {fmt(payment.grossAmount / lesson.durationHours)}/h
                    </p>
                  </div>
                  <div className="col-span-2 text-right">
                    <p className="text-sm font-semibold text-slate-100 print-text-dark">{fmt(payment.grossAmount)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Payment breakdown ── */}
            <div className="bg-slate-950 rounded-xl border border-slate-800 print-light print-border overflow-hidden">
              <div className="px-5 py-4 space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-slate-400 print-text-muted">Lesson total</p>
                  <p className="text-sm font-semibold text-slate-100 print-text-dark">{fmt(payment.grossAmount)}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-slate-400 print-text-muted">
                    Platform commission ({payment.commissionRate}%)
                  </p>
                  <p className="text-sm text-red-400">−{fmt(payment.platformFee)}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-slate-400 print-text-muted">Processing fees</p>
                  <p className="text-sm text-slate-400 print-text-muted">$0.00</p>
                </div>
                <hr className="border-slate-800 print-border my-2" />
                <div className="flex justify-between items-center">
                  <p className="text-base font-bold text-slate-100 print-text-dark">Your payout</p>
                  <p
                    className="text-xl font-bold print-accent"
                    style={{ color: accent }}
                  >
                    {fmt(payment.instructorPayout)}
                  </p>
                </div>
              </div>

              {/* Payment meta strip */}
              <div className="px-5 py-3 border-t border-slate-800 print-border bg-slate-900 print-light grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Payment method</p>
                  <p className="text-xs font-medium text-slate-300 print-text-muted mt-0.5">{payment.paymentMethod}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Paid at</p>
                  <p className="text-xs font-medium text-slate-300 print-text-muted mt-0.5">{payment.paidAt}</p>
                </div>
                {payment.stripePaymentId && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Payment ID</p>
                    <p className="text-xs font-mono text-slate-500 mt-0.5 break-all">{payment.stripePaymentId}</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Footer note ── */}
            <div className="border-t border-slate-800 print-border pt-4 space-y-1">
              <p className="text-xs text-slate-600 print-text-muted">
                This is a tax invoice generated by {platform.name} (ABN {platform.abn}) on behalf of {displayName}.
              </p>
              <p className="text-xs text-slate-600 print-text-muted">
                For questions contact {platform.email} or visit {platform.website}
              </p>
              {isDemo && (
                <p className="text-xs text-amber-600 print-text-muted mt-2 font-semibold">
                  ⚠ DEMO DATA ONLY — This is not a real invoice.
                </p>
              )}
            </div>

          </div>

          {/* ── Coloured bottom strip ── */}
          <div className="h-1.5" style={{ background: accent }} />
        </div>

        {/* ── Print CTA (no-print) ── */}
        <div className="no-print max-w-3xl mx-auto mt-4 flex justify-end">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <Download className="h-4 w-4" />
            Save as PDF
          </button>
        </div>

      </div>
    </>
  );
}
