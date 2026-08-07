'use client'

// components/marketing/cards/BusinessCardPreview.tsx
//
// Visual preview of both card sides at ~3× screen scale.
// Does NOT know about auth — receives CardData and renders it.
// Used by: dashboard card page, future public page.

import { CardData } from './types'
import { CardQRCode } from './CardQRCode'

// Aspect ratio: 85mm × 55mm = 1.545:1
// At 320px wide → 207px tall
const W = 320
const H = 207

interface Props {
  data: CardData
  side: 'front' | 'back'
}

export function BusinessCardPreview({ data, side }: Props) {
  if (side === 'front') return <CardFront data={data} />
  return <CardBack data={data} />
}

function CardFront({ data }: { data: CardData }) {
  const transmissionLabel =
    data.transmission === 'BOTH'
      ? 'Auto & Manual'
      : data.transmission === 'AUTOMATIC'
      ? 'Automatic'
      : 'Manual'

  return (
    <div
      style={{ width: W, height: H }}
      className="relative bg-slate-900 rounded-xl overflow-hidden shadow-xl flex flex-col select-none"
    >
      {/* Top accent bar */}
      <div className="h-1 bg-gradient-to-r from-sky-500 to-blue-600 shrink-0" />

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Left column — text */}
        <div className="flex flex-col justify-between p-4 flex-1 min-w-0">
          {/* Brand */}
          <div>
            <p className="text-[9px] font-bold tracking-[0.2em] text-sky-400 uppercase mb-0.5">
              DriveBook
            </p>
            <p className="text-base font-extrabold text-white leading-tight truncate">
              {data.instructorName || 'Instructor Name'}
            </p>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">
              Driving Instructor
            </p>
          </div>

          {/* Details */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide w-5 shrink-0">Ph</span>
              <span className="text-[11px] text-slate-200 font-medium">
                {data.phone || '04XX XXX XXX'}
              </span>
            </div>
            {data.suburbs && (
              <div className="flex items-start gap-1.5">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide w-5 shrink-0 mt-0.5">Loc</span>
                <span className="text-[10px] text-slate-300 leading-tight line-clamp-2">
                  {data.suburbs}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide w-5 shrink-0">Car</span>
              <span className="text-[10px] text-sky-300 font-semibold">
                {data.carLabel ? `${data.carLabel} · ${transmissionLabel}` : transmissionLabel}
              </span>
            </div>
          </div>

          {/* Footer branding */}
          {data.showDriveBookFooter && (
            <p className="text-[8px] text-slate-600 mt-1">
              {data.footerDomain || 'drivebook.com.au'}
            </p>
          )}
        </div>

        {/* Right column — QR */}
        <div className="flex flex-col items-center justify-center px-4 gap-1.5 shrink-0">
          <div className="bg-white rounded-lg p-1.5">
            <CardQRCode url={data.bookingUrl} size={72} variant="dark" />
          </div>
          <p className="text-[8px] text-slate-500 text-center">Scan to book</p>
        </div>
      </div>
    </div>
  )
}

function CardBack({ data }: { data: CardData }) {
  const rows = 6
  return (
    <div
      style={{ width: W, height: H }}
      className="relative bg-white rounded-xl overflow-hidden shadow-xl flex flex-col select-none"
    >
      {/* Top accent bar */}
      <div className="h-1 bg-gradient-to-r from-sky-500 to-blue-600 shrink-0" />

      <div className="flex flex-col flex-1 px-4 py-3 gap-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-bold tracking-[0.2em] text-sky-600 uppercase">
              DriveBook
            </p>
            <p className="text-[11px] font-bold text-slate-800">Your Driving Progress</p>
          </div>
          <p className="text-[8px] text-slate-400">Book next lesson online</p>
        </div>

        {/* Progress table */}
        <div className="flex-1">
          {/* Column headers */}
          <div className="grid grid-cols-[52px_1fr_52px] gap-x-1 mb-0.5">
            <p className="text-[8px] font-semibold text-slate-500 uppercase tracking-wide">Date</p>
            <p className="text-[8px] font-semibold text-slate-500 uppercase tracking-wide">Focus / Skill</p>
            <p className="text-[8px] font-semibold text-slate-500 uppercase tracking-wide text-right">Signed</p>
          </div>

          {/* Rows */}
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[52px_1fr_52px] gap-x-1 border-b border-slate-200 py-1"
            >
              <div className="h-2.5 border-b border-dashed border-slate-300" />
              <div className="h-2.5 border-b border-dashed border-slate-300" />
              <div className="h-2.5 border-b border-dashed border-slate-300" />
            </div>
          ))}
        </div>

        {/* Footer */}
        {data.showDriveBookFooter && (
          <p className="text-[7px] text-slate-400 text-center">
            {data.footerDomain || 'drivebook.com.au'} — Book 24/7 online
          </p>
        )}
      </div>
    </div>
  )
}
