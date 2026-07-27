'use client';

/**
 * Receipt H — Instructor Weekly Earnings Receipt
 * Currently downloaded as .txt — this is the visual equivalent.
 * Shown in the gallery so the layout can be reviewed and approved.
 */

import ReceiptShell from './ReceiptShell';
import ReceiptMeta from './ReceiptMeta';
import LineItems from './LineItems';

interface Props { isDemo?: boolean }

const DEMO_DAYS = [
  {
    label: 'Mon 21 Jul',
    lessons: [
      { client: 'Sophie Anderson', time: '09:00', duration: 2, gross: 180.00, fee: 21.60, net: 158.40, pkg: false },
      { client: 'Marcus Webb',     time: '14:00', duration: 1, gross: 90.00,  fee: 10.80, net: 79.20,  pkg: true  },
    ],
  },
  {
    label: 'Wed 23 Jul',
    lessons: [
      { client: 'Priya Sharma',    time: '10:00', duration: 2, gross: 180.00, fee: 21.60, net: 158.40, pkg: false },
    ],
  },
  {
    label: 'Fri 25 Jul',
    lessons: [
      { client: 'Jake Morrison',   time: '08:00', duration: 1.5, gross: 135.00, fee: 16.20, net: 118.80, pkg: false },
      { client: 'Sophie Anderson', time: '11:00', duration: 2,   gross: 180.00, fee: 21.60, net: 158.40, pkg: true  },
    ],
  },
];

export default function ReceiptH_WeeklyEarnings({ isDemo }: Props) {
  const allLessons = DEMO_DAYS.flatMap(d => d.lessons);
  const totalGross  = allLessons.reduce((s, l) => s + l.gross, 0);
  const totalFee    = allLessons.reduce((s, l) => s + l.fee, 0);
  const totalNet    = allLessons.reduce((s, l) => s + l.net, 0);
  const totalHours  = allLessons.reduce((s, l) => s + l.duration, 0);

  return (
    <ReceiptShell
      receiptNumber="DB-2026-W21JUL"
      accentColor="#16a34a"
      subtitle="Weekly Earnings Receipt"
      status="PAID"
      isDemo={isDemo ?? true}
    >
      <ReceiptMeta rows={[
        { label: 'Instructor', value: 'James Nguyen' },
        { label: 'Period', value: 'Mon 21 Jul – Sun 27 Jul 2026' },
        { label: 'Email', value: 'james@nguyendrive.com.au' },
      ]} />

      {/* Day-by-day breakdown */}
      {DEMO_DAYS.map(day => (
        <div key={day.label}>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{day.label}</p>
            <p className="text-xs text-slate-500">
              {day.lessons.length} lesson{day.lessons.length !== 1 ? 's' : ''} ·{' '}
              net <span className="text-emerald-400 font-semibold">
                ${day.lessons.reduce((s, l) => s + l.net, 0).toFixed(2)}
              </span>
            </p>
          </div>
          <div className="bg-slate-950 rounded-xl border border-slate-800 divide-y divide-slate-800 overflow-hidden mb-1">
            {day.lessons.map((lesson, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-sm text-slate-100 font-medium">
                    {lesson.time} · {lesson.client}
                    {lesson.pkg && (
                      <span className="ml-1.5 text-xs px-1.5 py-0.5 bg-purple-900/40 text-purple-300 border border-purple-700/40 rounded">pkg</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {lesson.duration}h · Gross ${lesson.gross.toFixed(2)} · Fee -${lesson.fee.toFixed(2)}
                  </p>
                </div>
                <p className="text-sm font-semibold text-emerald-400">${lesson.net.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Weekly summary */}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Weekly Summary</p>
        <LineItems
          lines={[
            { label: `${allLessons.length} lessons · ${totalHours}h total`, value: `$${totalGross.toFixed(2)}` },
            { label: 'Platform commission (12%)', value: `-$${totalFee.toFixed(2)}`, color: 'red' },
            { label: 'Processing fees', value: '$0.00', color: 'muted' },
          ]}
          total={{ label: 'Net Earnings', value: `$${totalNet.toFixed(2)}`, accentColor: '#16a34a' }}
        />
      </div>

      <p className="text-xs text-slate-500 text-center">
        Keep for tax purposes · Payouts processed every Tuesday (AWST)
      </p>
    </ReceiptShell>
  );
}
