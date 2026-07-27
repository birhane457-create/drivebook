'use client';

/**
 * /dashboard/invoice/gallery
 * ─────────────────────────────────────────────
 * All receipt & invoice types rendered side-by-side with demo data.
 * Uses the exact same components and styles as production.
 * No restyling for demo — what you see here is what users get.
 *
 * Visit: http://localhost:3000/dashboard/invoice/gallery
 */

import { useState } from 'react';
import ReceiptA_PackagePurchase  from '@/components/invoice/receipts/ReceiptA_PackagePurchase';
import ReceiptB_WalletLesson     from '@/components/invoice/receipts/ReceiptB_WalletLesson';
import ReceiptC_SingleLesson     from '@/components/invoice/receipts/ReceiptC_SingleLesson';
import ReceiptD_WalletTopUp      from '@/components/invoice/receipts/ReceiptD_WalletTopUp';
import ReceiptE_Cancellation     from '@/components/invoice/receipts/ReceiptE_Cancellation';
import ReceiptF_AdminCredit      from '@/components/invoice/receipts/ReceiptF_AdminCredit';
import ReceiptG_AdminDeduction   from '@/components/invoice/receipts/ReceiptG_AdminDeduction';
import ReceiptH_WeeklyEarnings   from '@/components/invoice/receipts/ReceiptH_WeeklyEarnings';
import ReceiptI_InstructorInvoice from '@/components/invoice/receipts/ReceiptI_InstructorInvoice';

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  {
    id: 'A',
    label: 'Package Purchase',
    audience: 'Student',
    trigger: 'Stripe — buys a lesson package',
    color: '#1d4ed8',
  },
  {
    id: 'B',
    label: 'Wallet Lesson',
    audience: 'Student',
    trigger: 'Instructor books from wallet credits',
    color: '#1d4ed8',
  },
  {
    id: 'C',
    label: 'Single Lesson',
    audience: 'Student',
    trigger: 'Stripe — pays for one lesson',
    color: '#1d4ed8',
  },
  {
    id: 'D',
    label: 'Wallet Top-Up',
    audience: 'Student',
    trigger: 'Stripe — adds credits to wallet',
    color: '#1d4ed8',
  },
  {
    id: 'E',
    label: 'Cancellation',
    audience: 'Student',
    trigger: 'Booking cancelled — shows refund',
    color: '#dc2626',
  },
  {
    id: 'F',
    label: 'Admin Credit',
    audience: 'Student',
    trigger: 'Admin manually adds wallet credits',
    color: '#1d4ed8',
  },
  {
    id: 'G',
    label: 'Admin Deduction',
    audience: 'Student',
    trigger: 'Admin removes wallet credits',
    color: '#b45309',
  },
  {
    id: 'H',
    label: 'Weekly Earnings',
    audience: 'Instructor',
    trigger: 'Downloaded from Earnings page',
    color: '#16a34a',
  },
  {
    id: 'I',
    label: 'Lesson Invoice',
    audience: 'Instructor',
    trigger: 'Per-transaction tax invoice',
    color: '#6366f1',
  },
] as const;

type TabId = typeof TABS[number]['id'];

// Cancellation has 3 sub-variants
const CANCEL_VARIANTS = [
  { key: 'full',    label: 'Full refund (48+ hrs)' },
  { key: 'partial', label: '50% refund (24–48 hrs)' },
  { key: 'none',    label: 'No refund (<24 hrs)' },
] as const;

type CancelVariant = 'full' | 'partial' | 'none';

export default function InvoiceGalleryPage() {
  const [active, setActive] = useState<TabId>('A');
  const [cancelVariant, setCancelVariant] = useState<CancelVariant>('full');

  const activeTab = TABS.find(t => t.id === active)!;

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-container { max-width: 100% !important; box-shadow: none !important; border: none !important; background: white !important; color: #111 !important; }
          .print-light { background: #f9fafb !important; }
          .print-border { border-color: #e5e7eb !important; }
          .print-text-dark { color: #111827 !important; }
          .print-text-muted { color: #6b7280 !important; }
        }
        @page { size: A4; margin: 12mm 14mm; }
      `}</style>

      <div className="min-h-screen bg-slate-950 py-8 px-4">

        {/* ── Header ── */}
        <div className="no-print max-w-2xl mx-auto mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-100 mb-1">Receipt & Invoice Gallery</h1>
          <p className="text-sm text-slate-400">
            Every document type in DriveBook — rendered with demo data in production styles.
          </p>
          <p className="text-xs text-amber-500 mt-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5 inline-block">
            All data is demo only. These are the exact layouts users see.
          </p>
        </div>

        {/* ── Tab bar ── */}
        <div className="no-print max-w-3xl mx-auto mb-6 overflow-x-auto">
          <div className="flex gap-2 min-w-max pb-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap ${
                  active === tab.id
                    ? 'bg-slate-700 border-slate-500 text-slate-100 shadow'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ background: tab.color }}
                />
                <span className="font-bold text-slate-500">{tab.id}</span>
                {tab.label}
                <span className={`px-1.5 py-0.5 rounded text-xs font-normal ${
                  tab.audience === 'Instructor'
                    ? 'bg-green-900/40 text-green-400'
                    : 'bg-blue-900/40 text-blue-400'
                }`}>
                  {tab.audience}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Active tab description ── */}
        <div className="no-print max-w-3xl mx-auto mb-4 flex items-center gap-3 bg-slate-900 rounded-xl border border-slate-800 px-4 py-3">
          <span
            className="h-3 w-3 rounded-full shrink-0"
            style={{ background: activeTab.color }}
          />
          <div>
            <p className="text-sm font-semibold text-slate-100">
              Type {active} — {activeTab.label}
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-normal ${
                activeTab.audience === 'Instructor'
                  ? 'bg-green-900/40 text-green-400'
                  : 'bg-blue-900/40 text-blue-400'
              }`}>
                → {activeTab.audience}
              </span>
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Triggered: {activeTab.trigger}</p>
          </div>
        </div>

        {/* ── Cancellation variant switcher ── */}
        {active === 'E' && (
          <div className="no-print max-w-3xl mx-auto mb-4 flex gap-2">
            {CANCEL_VARIANTS.map(v => (
              <button
                key={v.key}
                onClick={() => setCancelVariant(v.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  cancelVariant === v.key
                    ? 'bg-red-900/40 border-red-700 text-red-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Receipt render area ── */}
        <div className="max-w-3xl mx-auto">
          {active === 'A' && <ReceiptA_PackagePurchase isDemo />}
          {active === 'B' && <ReceiptB_WalletLesson    isDemo />}
          {active === 'C' && <ReceiptC_SingleLesson    isDemo />}
          {active === 'D' && <ReceiptD_WalletTopUp     isDemo />}
          {active === 'E' && <ReceiptE_Cancellation    isDemo variant={cancelVariant} />}
          {active === 'F' && <ReceiptF_AdminCredit     isDemo />}
          {active === 'G' && <ReceiptG_AdminDeduction  isDemo />}
          {active === 'H' && <ReceiptH_WeeklyEarnings  isDemo />}
          {active === 'I' && <ReceiptI_InstructorInvoice isDemo />}
        </div>

        {/* ── All receipts overview ── */}
        <div className="no-print max-w-3xl mx-auto mt-10 mb-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">All receipt types at a glance</p>
          <div className="grid grid-cols-3 gap-2">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                className={`text-left px-3 py-2.5 rounded-xl border transition-all ${
                  active === tab.id
                    ? 'border-slate-500 bg-slate-800'
                    : 'border-slate-800 bg-slate-900 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: tab.color }} />
                  <span className="text-xs font-bold text-slate-400">{tab.id}</span>
                </div>
                <p className="text-xs font-semibold text-slate-200">{tab.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{tab.trigger}</p>
              </button>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}
