'use client'

// app/dashboard/marketing/cards/page.tsx
//
// Instructor business card builder — dashboard version.
// Profile data is pre-filled and locked. Only suburbs + transmission are editable.
// Instructor can download a print-ready PDF or request a physical 100-pack.

import { useState, useEffect } from 'react'
import { CreditCard, Download, Package, RefreshCw, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { BusinessCardPreview } from '@/components/marketing/cards/BusinessCardPreview'
import { BusinessCardForm } from '@/components/marketing/cards/BusinessCardForm'
import type { CardData, CardOrder } from '@/components/marketing/cards/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildBookingUrl(profile: any): string {
  const slug = profile.customSlug || profile.id
  return `https://${slug}.drivebook.com.au`
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return 'drivebook.com.au'
  }
}

function guessTransmission(vehicleTypes: string | null) {
  if (!vehicleTypes) return 'AUTOMATIC' as const
  const v = vehicleTypes.toLowerCase()
  if (v.includes('manual') && v.includes('auto')) return 'BOTH' as const
  if (v.includes('manual')) return 'MANUAL' as const
  return 'AUTOMATIC' as const
}

function extractSuburbs(profile: any): string {
  // Use the already-parsed suburb field first
  if (profile.suburb) return profile.suburb
  // Fall back to extracting from baseAddress string
  const address = profile.baseAddress
  if (!address) return ''
  const m = address.match(/,\s*([A-Za-z][A-Za-z\s'-]+?)\s+(?:WA|NSW|VIC|QLD|SA|TAS|NT|ACT)\s+\d{4}/i)
  return m ? m[1].trim() : ''
}

function buildCarLabel(profile: any): string {
  const parts = [profile.carMake, profile.carModel].filter(Boolean)
  return parts.join(' ')
}

const STATUS_BADGE: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING:   { label: 'Pending',   color: 'text-amber-400 bg-amber-400/10 border-amber-400/30',   icon: <Clock className="w-3 h-3" /> },
  APPROVED:  { label: 'Approved',  color: 'text-sky-400 bg-sky-400/10 border-sky-400/30',         icon: <CheckCircle className="w-3 h-3" /> },
  PRINTING:  { label: 'Printing',  color: 'text-purple-400 bg-purple-400/10 border-purple-400/30',icon: <RefreshCw className="w-3 h-3 animate-spin" /> },
  READY:     { label: 'Ready',     color: 'text-green-400 bg-green-400/10 border-green-400/30',   icon: <CheckCircle className="w-3 h-3" /> },
  DELIVERED: { label: 'Delivered', color: 'text-slate-400 bg-slate-400/10 border-slate-400/30',   icon: <CheckCircle className="w-3 h-3" /> },
  CANCELLED: { label: 'Cancelled', color: 'text-red-400 bg-red-400/10 border-red-400/30',         icon: <AlertCircle className="w-3 h-3" /> },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BusinessCardsPage() {
  const [loading, setLoading] = useState(true)
  const [cardData, setCardData] = useState<CardData>({
    instructorName: '',
    phone: '',
    suburbs: '',
    transmission: 'AUTOMATIC',
    bookingUrl: '',
    showDriveBookFooter: true,
  })
  const [side, setSide] = useState<'front' | 'back'>('front')
  const [generating, setGenerating] = useState(false)
  const [pdfError, setPdfError] = useState('')
  const [orders, setOrders] = useState<CardOrder[]>([])
  const [requesting, setRequesting] = useState(false)
  const [requestQty, setRequestQty] = useState(100)
  const [requestNotes, setRequestNotes] = useState('')
  const [requestError, setRequestError] = useState('')
  const [requestSuccess, setRequestSuccess] = useState(false)

  // ── Load profile ────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch('/api/instructor/profile').then(r => r.json()),
      fetch('/api/instructor/branding').then(r => r.json()),
      fetch('/api/instructor/card-order').then(r => r.json()).catch(() => []),
    ]).then(([profile, branding, orders]) => {
      const bookingUrl = buildBookingUrl({ ...profile, customSlug: branding.customSlug })
      // Footer shows custom domain if verified, else the subdomain
      const footerDomain = (branding.domainVerified && branding.customDomain)
        ? branding.customDomain
        : extractDomain(bookingUrl)

      setCardData({
        instructorName: profile.displayName || profile.name || '',
        phone: profile.phone || '',
        suburbs: extractSuburbs(profile),
        transmission: guessTransmission(profile.vehicleTypes),
        carLabel: buildCarLabel(profile),
        bookingUrl,
        footerDomain,
        showDriveBookFooter: true,
      })
      setOrders(Array.isArray(orders) ? orders : [])
    }).catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // ── PDF download ────────────────────────────────────────────────────────────
  async function handleDownload() {
    setGenerating(true)
    setPdfError('')
    try {
      const { generateBusinessCardPDF } = await import('@/components/marketing/cards/BusinessCardPDF')
      await generateBusinessCardPDF(cardData, 'download', 10)
    } catch (err) {
      console.error('PDF generation failed:', err)
      setPdfError('Could not generate PDF. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  // ── Print request ───────────────────────────────────────────────────────────
  async function handleRequest() {
    setRequesting(true)
    setRequestError('')
    try {
      const res = await fetch('/api/instructor/card-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: requestQty, suburbs: cardData.suburbs, notes: requestNotes }),
      })
      if (!res.ok) {
        const err = await res.json()
        setRequestError(err.error || 'Request failed. Please try again.')
        return
      }
      setRequestSuccess(true)
      const updated = await fetch('/api/instructor/card-order').then(r => r.json()).catch(() => [])
      setOrders(Array.isArray(updated) ? updated : [])
    } catch {
      setRequestError('Network error. Please try again.')
    } finally {
      setRequesting(false)
    }
  }

  // ── Active order guard ──────────────────────────────────────────────────────
  const activeOrder = orders.find(o => ['PENDING','APPROVED','PRINTING'].includes(o.status))

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-7 h-7 animate-spin text-sky-400" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-sky-400" />
          Business Cards
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Download a print-ready PDF (10 cards per A4 sheet, front + back) or request a printed pack.
        </p>
      </div>

      {/* ── Main grid ───────────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-8 items-start">

        {/* LEFT — Preview ─────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setSide('front')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition-all ${
                side === 'front'
                  ? 'bg-sky-600 border-sky-500 text-white'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-sky-600'
              }`}
            >
              Front
            </button>
            <button
              onClick={() => setSide('back')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition-all ${
                side === 'back'
                  ? 'bg-sky-600 border-sky-500 text-white'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-sky-600'
              }`}
            >
              Back
            </button>
          </div>

          <BusinessCardPreview data={cardData} side={side} />

          <p className="text-[11px] text-slate-600 text-center">
            Preview at 85×55 mm — Australian standard business card size
          </p>

          {/* Download button */}
          <button
            onClick={handleDownload}
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-3 rounded-xl transition-all"
          >
            {generating ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Generating PDF…</>
            ) : (
              <><Download className="w-4 h-4" /> Download Print-Ready PDF</>
            )}
          </button>
          {pdfError && (
            <div className="flex items-center gap-2 text-red-400 text-xs font-medium bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2 -mt-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {pdfError}
            </div>
          )}
          <p className="text-[11px] text-slate-500 text-center -mt-2">
            A4 sheet · 10 cards (2×5) · front page + back page · with crop marks
          </p>
        </div>

        {/* RIGHT — Form + Print Request ───────────────────────────────────── */}
        <div className="space-y-6">

          {/* Edit fields */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
            <h2 className="text-sm font-bold text-slate-200 mb-4 uppercase tracking-wide">
              Card Details
            </h2>
            <BusinessCardForm data={cardData} onChange={setCardData} locked />
          </div>

          {/* Print request */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
            <h2 className="text-sm font-bold text-slate-200 mb-1 uppercase tracking-wide flex items-center gap-2">
              <Package className="w-4 h-4 text-sky-400" />
              Request Printed Cards
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              We'll print and deliver them to you. Turnaround ~3–5 business days.
            </p>

            {requestSuccess ? (
              <div className="flex items-center gap-2 text-green-400 text-sm font-semibold">
                <CheckCircle className="w-5 h-5" />
                Request submitted — you'll hear from us within 1 business day.
              </div>
            ) : activeOrder ? (
              <div className="flex items-start gap-2 text-amber-400 text-sm">
                <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  You already have an active order ({activeOrder.quantity} cards,{' '}
                  <span className="font-semibold">{activeOrder.status}</span>).
                  It will be fulfilled soon.
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Quantity</label>
                  <select
                    value={requestQty}
                    onChange={e => setRequestQty(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                  >
                    <option value={50}>50 cards</option>
                    <option value={100}>100 cards</option>
                    <option value={200}>200 cards</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Notes <span className="text-slate-600 font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={requestNotes}
                    onChange={e => setRequestNotes(e.target.value)}
                    maxLength={300}
                    rows={2}
                    placeholder="Delivery address or any special requests…"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 resize-none"
                  />
                </div>

                {requestError && (
                  <p className="text-xs text-red-400">{requestError}</p>
                )}

                <button
                  onClick={handleRequest}
                  disabled={requesting}
                  className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-all"
                >
                  {requesting ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Sending…</>
                  ) : (
                    <><Package className="w-4 h-4" /> Request {requestQty} Printed Cards</>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Order history */}
          {orders.length > 0 && (
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
              <h2 className="text-sm font-bold text-slate-200 mb-3 uppercase tracking-wide">
                Order History
              </h2>
              <div className="space-y-2">
                {orders.map(order => {
                  const badge = STATUS_BADGE[order.status] ?? STATUS_BADGE.PENDING
                  return (
                    <div
                      key={order.id}
                      className="flex items-center justify-between text-xs text-slate-400"
                    >
                      <span>
                        {order.quantity} cards ·{' '}
                        {new Date(order.createdAt).toLocaleDateString('en-AU', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </span>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${badge.color}`}>
                        {badge.icon}
                        {badge.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
