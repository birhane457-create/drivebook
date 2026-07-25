'use client';

/**
 * /dashboard/marketing — Printable Flyer + QR Code
 *
 * Identity hierarchy matches the platform's subscription tiers:
 *   BASIC / PRO  → instructor's preferred display name (sells the person)
 *   STUDIO       → brand name as hero, instructor name underneath
 *   BUSINESS     → business name is everything, personal name secondary
 *
 * Layout optimised for distance legibility — large text first, QR prominent,
 * price + CTA visible at a glance from across a waiting room desk.
 */

import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Copy, Check, RefreshCw, Star } from 'lucide-react';
// ── Types ─────────────────────────────────────────────────────────────────────

interface InstructorProfile {
  id: string;
  name: string;
  businessName: string | null;
  displayName: string | null;        // set in branding page — instructor's preferred name
  profileImage: string | null;
  phone: string;
  hourlyRate: number;
  averageRating: number | null;
  totalReviews: number;
  baseAddress: string | null;
  vehicleTypes: string | null;
  yearsExperience: number | null;
  subscriptionTier: string;
  customSlug: string | null;
  accountType: string | null;        // INDIVIDUAL | BUSINESS
}

// ── Name resolution (mirrors platform identity hierarchy) ─────────────────────

function resolveFlyer(instructor: InstructorProfile): {
  headline: string;
  subline: string | null;
  isBrand: boolean;
} {
  const tier = instructor.subscriptionTier?.toUpperCase() ?? 'BASIC';
  const accountType = instructor.accountType ?? 'INDIVIDUAL';

  if (tier === 'BUSINESS' || accountType === 'BUSINESS') {
    // Business: school name is the whole brand. Personal name optional.
    return {
      headline: instructor.businessName || instructor.name,
      subline: null,
      isBrand: true,
    };
  }

  if (tier === 'STUDIO') {
    // Studio: brand name prominent, instructor name underneath for trust.
    return {
      headline: instructor.businessName || instructor.displayName || instructor.name,
      subline: instructor.businessName
        ? `Instructor: ${instructor.displayName || instructor.name}`
        : null,
      isBrand: !!instructor.businessName,
    };
  }

  // BASIC / PRO: sell the person — preferred display name, not legal name.
  // displayName is whatever the instructor set in branding (e.g. "Debesay B." or "Debesay Driving Lessons").
  return {
    headline: instructor.displayName || instructor.name,
    subline: null,
    isBrand: false,
  };
}

function buildBookingUrl(instructor: InstructorProfile): string {
  const slug = instructor.customSlug || instructor.id;
  return `https://${slug}.drivebook.com.au`;
}

function formatSuburb(address: string | null): string | null {
  if (!address) return null;
  const m = address.match(/,\s*([A-Za-z][A-Za-z\s'-]+?)\s+(?:WA|NSW|VIC|QLD|SA|TAS|NT|ACT)\s+\d{4}/i);
  if (m) return m[1].trim();
  const parts = address.split(',');
  return parts[parts.length - 1].trim() || null;
}

// ── Star row ──────────────────────────────────────────────────────────────────

function Stars({ rating, count }: { rating: number; count: number }) {
  const rounded = Math.round(rating);
  return (
    <div className="flex items-center justify-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`w-4 h-4 ${i <= rounded ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'}`}
        />
      ))}
      {count > 0 && (
        <span className="ml-1 text-xs text-gray-500">({count})</span>
      )}
    </div>
  );
}

// ── Flyer component ───────────────────────────────────────────────────────────

function Flyer({ instructor, url, style }: {
  instructor: InstructorProfile;
  url: string;
  style: 'dark' | 'light' | 'minimal';
}) {
  const { headline, subline, isBrand } = resolveFlyer(instructor);
  const suburb = formatSuburb(instructor.baseAddress);
  const transmissions = instructor.vehicleTypes
    ? instructor.vehicleTypes.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  // ── DARK ──────────────────────────────────────────────────────────────────
  if (style === 'dark') {
    return (
      <div
        id="flyer-print-area"
        className="bg-slate-900 text-white rounded-2xl overflow-hidden shadow-2xl w-[320px] mx-auto print:shadow-none"
        style={{ colorScheme: 'dark' }}
      >
        {/* Accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-sky-500 to-blue-600" />

        {/* Photo + name block */}
        <div className="px-6 pt-6 pb-4 text-center">
          {instructor.profileImage && (
            <img
              src={instructor.profileImage}
              alt={headline}
              className="w-20 h-20 rounded-full object-cover mx-auto mb-4 ring-4 ring-sky-500/30"
            />
          )}

          {/* Headline — the hero identity */}
          <h1 className="text-2xl font-extrabold text-white leading-tight tracking-tight">
            {headline}
          </h1>

          {/* Subline — only for Studio (brand + instructor name) */}
          {subline && (
            <p className="text-sm text-sky-300 mt-1">{subline}</p>
          )}

          {/* Stars */}
          {instructor.averageRating && instructor.totalReviews > 0 && (
            <div className="mt-2">
              <Stars rating={instructor.averageRating} count={instructor.totalReviews} />
            </div>
          )}

          {/* Role + transmission */}
          <p className="text-sm text-slate-300 font-medium mt-2">
            {isBrand ? 'Driving School' : 'Driving Instructor'}
            {transmissions.length > 0 && (
              <> · <span className="text-sky-300">{transmissions.join(' + ')} Lessons</span></>
            )}
          </p>

          {/* Suburb */}
          {suburb && (
            <p className="text-xs text-slate-500 mt-1">{suburb}</p>
          )}
        </div>

        {/* QR code — centred, prominent */}
        <div className="flex justify-center py-4 bg-slate-800/60">
          <div className="bg-white rounded-xl p-3">
            <QRCodeSVG
              value={url}
              size={160}
              bgColor="#ffffff"
              fgColor="#0c1a2e"
              level="M"
              includeMargin={false}
            />
          </div>
        </div>

        {/* CTA + price */}
        <div className="px-6 py-5 text-center space-y-1">
          <p className="text-lg font-bold text-sky-400 tracking-wide">Book Online 24/7</p>
          <p className="text-2xl font-extrabold text-white">${instructor.hourlyRate}<span className="text-sm font-normal text-slate-400">/hr</span></p>
          <p className="text-[10px] text-slate-600 break-all mt-1">{url}</p>
        </div>

        <div className="bg-slate-950 py-2 text-center">
          <p className="text-[10px] text-slate-600 tracking-wide">drivebook.com.au</p>
        </div>
      </div>
    );
  }

  // ── LIGHT ─────────────────────────────────────────────────────────────────
  if (style === 'light') {
    return (
      <div
        id="flyer-print-area"
        className="bg-white text-gray-900 rounded-2xl overflow-hidden shadow-xl w-[320px] mx-auto border border-gray-100 print:shadow-none print:border print:border-gray-300"
      >
        {/* Top colour strip */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-6 pt-6 pb-5 text-white text-center">
          {instructor.profileImage && (
            <img
              src={instructor.profileImage}
              alt={headline}
              className="w-20 h-20 rounded-full object-cover mx-auto mb-3 ring-4 ring-white/30"
            />
          )}
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight">{headline}</h1>
          {subline && <p className="text-sm text-blue-200 mt-1">{subline}</p>}

          {instructor.averageRating && instructor.totalReviews > 0 && (
            <div className="mt-2 flex items-center justify-center gap-0.5">
              {[1,2,3,4,5].map(i => (
                <Star key={i} className={`w-4 h-4 ${i <= Math.round(instructor.averageRating!) ? 'fill-amber-300 text-amber-300' : 'fill-white/20 text-white/20'}`} />
              ))}
              <span className="ml-1 text-xs text-blue-200">({instructor.totalReviews})</span>
            </div>
          )}

          <p className="text-sm text-blue-100 font-medium mt-2">
            {isBrand ? 'Driving School' : 'Driving Instructor'}
            {transmissions.length > 0 && ` · ${transmissions.join(' + ')} Lessons`}
          </p>
          {suburb && <p className="text-xs text-blue-200/70 mt-0.5">{suburb}</p>}
        </div>

        {/* QR */}
        <div className="flex justify-center py-5 bg-gray-50">
          <div className="bg-white rounded-xl p-2 shadow-sm border border-gray-100">
            <QRCodeSVG
              value={url}
              size={155}
              bgColor="#ffffff"
              fgColor="#1e3a5f"
              level="M"
              includeMargin={false}
            />
          </div>
        </div>

        {/* CTA + price */}
        <div className="px-6 py-4 text-center">
          <p className="text-base font-bold text-blue-700">Book Online 24/7</p>
          <p className="text-3xl font-extrabold text-gray-900 mt-1">${instructor.hourlyRate}<span className="text-sm font-normal text-gray-400">/hr</span></p>
          <p className="text-[10px] text-gray-400 break-all mt-2">{url}</p>
        </div>

        <div className="bg-blue-600 py-2 text-center">
          <p className="text-[10px] text-white/80 tracking-wide">drivebook.com.au</p>
        </div>
      </div>
    );
  }

  // ── MINIMAL (ink-saving) ──────────────────────────────────────────────────
  return (
    <div
      id="flyer-print-area"
      className="bg-white text-gray-900 rounded-2xl overflow-hidden shadow-sm w-[320px] mx-auto border-2 border-gray-900 print:shadow-none"
    >
      {/* Name block */}
      <div className="px-6 pt-5 pb-3 text-center border-b-2 border-gray-900">
        <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-gray-900">{headline}</h1>
        {subline && <p className="text-sm text-gray-600 mt-0.5">{subline}</p>}

        {instructor.averageRating && instructor.totalReviews > 0 && (
          <div className="mt-1.5 flex items-center justify-center gap-0.5">
            {[1,2,3,4,5].map(i => (
              <Star key={i} className={`w-3.5 h-3.5 ${i <= Math.round(instructor.averageRating!) ? 'fill-gray-800 text-gray-800' : 'fill-gray-200 text-gray-200'}`} />
            ))}
          </div>
        )}

        <p className="text-sm font-semibold text-gray-700 mt-1.5">
          {isBrand ? 'Driving School' : 'Driving Instructor'}
          {transmissions.length > 0 && ` · ${transmissions.join(' + ')}`}
        </p>
        {suburb && <p className="text-xs text-gray-500 mt-0.5">{suburb}</p>}
      </div>

      {/* QR */}
      <div className="flex justify-center py-4">
        <QRCodeSVG
          value={url}
          size={155}
          bgColor="#ffffff"
          fgColor="#111111"
          level="M"
          includeMargin={false}
        />
      </div>

      {/* CTA + price */}
      <div className="px-6 py-4 text-center border-t-2 border-gray-900">
        <p className="text-base font-bold text-gray-900">Book Online 24/7</p>
        <p className="text-3xl font-extrabold text-gray-900 mt-1">${instructor.hourlyRate}<span className="text-sm font-normal text-gray-500">/hr</span></p>
        <p className="text-[10px] text-gray-400 break-all mt-2">{url}</p>
      </div>
    </div>
  );
}

// ── Printable versions (A5, real CSS units, no Tailwind fixed widths) ─────────
// These are used only in the #print-page div, never shown on screen.

function PrintableFlyerInstructor({ instructor, url, style }: {
  instructor: InstructorProfile;
  url: string;
  style: 'dark' | 'light' | 'minimal';
}) {
  const { headline, subline, isBrand } = resolveFlyer(instructor);
  const suburb = formatSuburb(instructor.baseAddress);
  const transmissions = instructor.vehicleTypes
    ? instructor.vehicleTypes.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const isDark = style === 'dark';
  const isMinimal = style === 'minimal';

  const bg = isDark ? '#0f172a' : isMinimal ? '#ffffff' : '#1d4ed8';
  const cardBg = isDark ? '#0f172a' : '#ffffff';
  const textPrimary = isDark ? '#ffffff' : isMinimal ? '#111827' : '#111827';
  const textSecondary = isDark ? '#94a3b8' : '#6b7280';
  const accentColor = isDark ? '#38bdf8' : isMinimal ? '#111827' : '#1d4ed8';
  const qrFg = isDark ? '#0c1a2e' : '#1e3a5f';
  const borderStyle = isMinimal ? '3px solid #111827' : 'none';

  return (
    <div style={{
      width: '148mm',
      minHeight: '210mm',
      background: bg,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Arial, sans-serif',
      border: borderStyle,
      boxSizing: 'border-box',
    }}>
      {/* Accent bar */}
      {!isMinimal && (
        <div style={{ height: '4px', background: isDark ? 'linear-gradient(to right, #0ea5e9, #2563eb)' : 'white' }} />
      )}

      {/* Photo + name */}
      <div style={{ padding: '8mm 8mm 4mm', textAlign: 'center', background: isDark ? '#0f172a' : isMinimal ? 'white' : '#1d4ed8' }}>
        {instructor.profileImage && (
          <img src={instructor.profileImage} alt={headline}
            style={{ width: '22mm', height: '22mm', borderRadius: '50%', objectFit: 'cover', margin: '0 auto 4mm', display: 'block', border: isDark ? '2px solid #38bdf8' : '2px solid rgba(255,255,255,0.4)' }} />
        )}
        <div style={{ fontSize: '18pt', fontWeight: '900', color: isDark || !isMinimal ? '#ffffff' : '#111827', lineHeight: 1.1, marginBottom: '2mm' }}>{headline}</div>
        {subline && <div style={{ fontSize: '9pt', color: isDark ? '#7dd3fc' : isMinimal ? '#6b7280' : '#bfdbfe', marginBottom: '2mm' }}>{subline}</div>}

        {instructor.averageRating && instructor.totalReviews > 0 && (
          <div style={{ color: '#fbbf24', fontSize: '12pt', marginBottom: '2mm' }}>
            {'★'.repeat(Math.round(instructor.averageRating))}{'☆'.repeat(5 - Math.round(instructor.averageRating))}
          </div>
        )}

        <div style={{ fontSize: '10pt', color: isDark ? '#94a3b8' : isMinimal ? '#374151' : '#bfdbfe', fontWeight: '600' }}>
          {isBrand ? 'Driving School' : 'Driving Instructor'}
          {transmissions.length > 0 && ` · ${transmissions.join(' + ')} Lessons`}
        </div>
        {suburb && <div style={{ fontSize: '9pt', color: isDark ? '#64748b' : isMinimal ? '#9ca3af' : '#93c5fd', marginTop: '1mm' }}>{suburb}</div>}
      </div>

      {/* QR code */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6mm', background: isDark ? '#1e293b' : '#f9fafb' }}>
        <div style={{ background: 'white', padding: '4mm', borderRadius: '4mm' }}>
          <QRCodeSVG value={url} size={160} bgColor="#ffffff" fgColor={qrFg} level="M" includeMargin={false} />
        </div>
      </div>

      {/* CTA + price */}
      <div style={{ padding: '5mm 8mm', textAlign: 'center', background: isDark ? '#0f172a' : isMinimal ? 'white' : '#1d4ed8', borderTop: isMinimal ? '2px solid #111827' : 'none' }}>
        <div style={{ fontSize: '14pt', fontWeight: '900', color: isDark ? '#38bdf8' : isMinimal ? '#111827' : 'white', marginBottom: '2mm' }}>Book Online 24/7</div>
        <div style={{ fontSize: '22pt', fontWeight: '900', color: isDark || !isMinimal ? '#ffffff' : '#111827' }}>
          ${instructor.hourlyRate}<span style={{ fontSize: '10pt', fontWeight: '400', color: textSecondary }}>/hr</span>
        </div>
        <div style={{ fontSize: '7pt', color: textSecondary, marginTop: '2mm', wordBreak: 'break-all' }}>{url}</div>
      </div>

      {/* Footer */}
      <div style={{ background: isDark ? '#020617' : isMinimal ? '#f3f4f6' : '#1e40af', padding: '2mm', textAlign: 'center' }}>
        <div style={{ fontSize: '7pt', color: isDark ? '#475569' : isMinimal ? '#9ca3af' : 'rgba(255,255,255,0.6)', letterSpacing: '0.05em' }}>drivebook.com.au</div>
      </div>
    </div>
  );
}

function PrintableFlyerPlatform({ style }: { style: 'dark' | 'light' | 'minimal' }) {
  const isDark = style === 'dark';
  const isMinimal = style === 'minimal';
  const bg = isDark ? '#0f172a' : '#ffffff';
  const headerBg = isDark ? '#0f172a' : isMinimal ? '#ffffff' : '#059669';
  const qrFg = isDark ? '#0c1a2e' : '#064e3b';
  const borderStyle = isMinimal ? '3px solid #111827' : 'none';

  return (
    <div style={{
      width: '148mm',
      minHeight: '210mm',
      background: bg,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Arial, sans-serif',
      border: borderStyle,
      boxSizing: 'border-box',
    }}>
      {!isMinimal && <div style={{ height: '4px', background: isDark ? 'linear-gradient(to right, #10b981, #14b8a6)' : 'white' }} />}

      <div style={{ padding: '8mm 8mm 4mm', textAlign: 'center', background: headerBg }}>
        <div style={{ fontSize: '10pt', marginBottom: '3mm' }}>🚗</div>
        <div style={{ fontSize: '18pt', fontWeight: '900', color: isDark ? '#ffffff' : isMinimal ? '#111827' : '#ffffff', lineHeight: 1.1, marginBottom: '2mm' }}>
          Grow Your Driving Business
        </div>
        <div style={{ fontSize: '12pt', fontWeight: '700', color: isDark ? '#34d399' : isMinimal ? '#374151' : '#d1fae5', marginBottom: '2mm' }}>
          with DriveBook
        </div>
        <div style={{ fontSize: '9pt', color: isDark ? '#94a3b8' : isMinimal ? '#6b7280' : 'rgba(255,255,255,0.8)' }}>
          Spend more time teaching. Less time on admin.
        </div>
      </div>

      <div style={{ padding: '4mm 8mm', flex: 1 }}>
        {PLATFORM_BENEFITS.map(({ icon, text }) => (
          <div key={text} style={{
            display: 'flex', alignItems: 'center', gap: '3mm',
            padding: '2mm 3mm', marginBottom: '1.5mm',
            background: isDark ? '#1e293b' : isMinimal ? '#f9fafb' : '#ecfdf5',
            borderRadius: '2mm',
          }}>
            <span style={{ fontSize: '11pt', flexShrink: 0 }}>{icon}</span>
            <span style={{ fontSize: '9pt', color: isDark ? '#e2e8f0' : '#374151', fontWeight: '500' }}>{text}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', padding: '5mm', background: isDark ? '#1e293b' : '#f9fafb' }}>
        <div style={{ background: 'white', padding: '3mm', borderRadius: '4mm' }}>
          <QRCodeSVG value={PLATFORM_URL} size={155} bgColor="#ffffff" fgColor={qrFg} level="M" includeMargin={false} />
        </div>
      </div>

      <div style={{ padding: '4mm 8mm', textAlign: 'center', background: isDark ? '#0f172a' : isMinimal ? 'white' : '#059669', borderTop: isMinimal ? '2px solid #111827' : 'none' }}>
        <div style={{ fontSize: '14pt', fontWeight: '900', color: isDark ? '#34d399' : isMinimal ? '#111827' : 'white', marginBottom: '1mm' }}>Scan to Join Free</div>
        <div style={{ fontSize: '7pt', color: isDark ? '#475569' : '#9ca3af', wordBreak: 'break-all' }}>{PLATFORM_URL}</div>
      </div>

      <div style={{ background: isDark ? '#020617' : isMinimal ? '#f3f4f6' : '#047857', padding: '2mm', textAlign: 'center' }}>
        <div style={{ fontSize: '7pt', color: isDark ? '#475569' : isMinimal ? '#9ca3af' : 'rgba(255,255,255,0.6)', letterSpacing: '0.05em' }}>drivebook.com.au</div>
      </div>
    </div>
  );
}

// ── Platform Flyer (DriveBook recruits instructors) ───────────────────────────
const PLATFORM_URL = 'https://drivebook.com.au/teach-with-drivebook';

const PLATFORM_BENEFITS = [
  { icon: '🤖', text: 'AI Receptionist — answers calls 24/7' },
  { icon: '📅', text: 'Online bookings while you teach' },
  { icon: '💳', text: 'Weekly payouts, no chasing invoices' },
  { icon: '📱', text: 'Automated SMS reminders to students' },
  { icon: '📈', text: 'More students find you online' },
  { icon: '🎁', text: 'Free trial — no credit card needed' },
];

function PlatformFlyer({ style }: { style: 'dark' | 'light' | 'minimal' }) {
  if (style === 'dark') {
    return (
      <div
        id="flyer-print-area-platform"
        className="bg-slate-900 text-white rounded-2xl overflow-hidden shadow-2xl w-[320px] mx-auto print:shadow-none"
        style={{ colorScheme: 'dark' }}
      >
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500" />

        <div className="px-6 pt-6 pb-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
            <span className="text-2xl">🚗</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white leading-tight">
            Grow Your Driving Business
          </h1>
          <p className="text-sm text-emerald-400 font-semibold mt-1">with DriveBook</p>
          <p className="text-xs text-slate-400 mt-2">
            Spend more time teaching. Less time on admin.
          </p>
        </div>

        <div className="px-5 pb-4 space-y-1.5">
          {PLATFORM_BENEFITS.map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-2.5 bg-slate-800/60 rounded-lg px-3 py-2">
              <span className="text-base shrink-0">{icon}</span>
              <p className="text-xs text-slate-200 font-medium">{text}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-center py-4 bg-slate-800/40">
          <div className="bg-white rounded-xl p-3">
            <QRCodeSVG value={PLATFORM_URL} size={140} bgColor="#ffffff" fgColor="#0c1a2e" level="M" includeMargin={false} />
          </div>
        </div>

        <div className="px-6 py-4 text-center">
          <p className="text-base font-bold text-emerald-400">Scan to Join Free</p>
          <p className="text-[10px] text-slate-600 mt-1 break-all">{PLATFORM_URL}</p>
        </div>

        <div className="bg-slate-950 py-2 text-center">
          <p className="text-[10px] text-slate-600 tracking-wide">drivebook.com.au</p>
        </div>
      </div>
    );
  }

  if (style === 'light') {
    return (
      <div
        id="flyer-print-area-platform"
        className="bg-white text-gray-900 rounded-2xl overflow-hidden shadow-xl w-[320px] mx-auto border border-gray-100 print:shadow-none print:border print:border-gray-300"
      >
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 px-6 pt-6 pb-5 text-white text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">🚗</span>
          </div>
          <h1 className="text-2xl font-extrabold leading-tight">Grow Your Driving Business</h1>
          <p className="text-sm font-semibold text-emerald-100 mt-0.5">with DriveBook</p>
          <p className="text-xs text-emerald-100/70 mt-1">Spend more time teaching. Less time on admin.</p>
        </div>

        <div className="px-5 py-3 space-y-1.5">
          {PLATFORM_BENEFITS.map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-2.5 bg-emerald-50 rounded-lg px-3 py-2">
              <span className="text-base shrink-0">{icon}</span>
              <p className="text-xs text-gray-700 font-medium">{text}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-center py-4 bg-gray-50">
          <div className="bg-white rounded-xl p-2 shadow-sm border border-gray-100">
            <QRCodeSVG value={PLATFORM_URL} size={140} bgColor="#ffffff" fgColor="#064e3b" level="M" includeMargin={false} />
          </div>
        </div>

        <div className="px-6 py-4 text-center">
          <p className="text-base font-bold text-emerald-700">Scan to Join Free</p>
          <p className="text-[10px] text-gray-400 mt-1 break-all">{PLATFORM_URL}</p>
        </div>

        <div className="bg-emerald-600 py-2 text-center">
          <p className="text-[10px] text-white/80 tracking-wide">drivebook.com.au</p>
        </div>
      </div>
    );
  }

  // Minimal
  return (
    <div
      id="flyer-print-area-platform"
      className="bg-white text-gray-900 rounded-2xl overflow-hidden shadow-sm w-[320px] mx-auto border-2 border-gray-900 print:shadow-none"
    >
      <div className="px-6 pt-5 pb-3 text-center border-b-2 border-gray-900">
        <h1 className="text-2xl font-extrabold leading-tight">Grow Your Driving Business</h1>
        <p className="text-sm font-bold text-gray-600 mt-0.5">with DriveBook</p>
        <p className="text-xs text-gray-500 mt-1">Less admin. More teaching.</p>
      </div>

      <div className="px-5 py-3 space-y-1">
        {PLATFORM_BENEFITS.map(({ icon, text }) => (
          <p key={text} className="text-xs text-gray-700 flex items-center gap-2">
            <span className="shrink-0">{icon}</span>{text}
          </p>
        ))}
      </div>

      <div className="flex justify-center py-3 border-t border-b border-gray-300">
        <QRCodeSVG value={PLATFORM_URL} size={145} bgColor="#ffffff" fgColor="#111111" level="M" includeMargin={false} />
      </div>

      <div className="px-6 py-4 text-center">
        <p className="text-base font-bold text-gray-900">Scan to Join Free</p>
        <p className="text-[10px] text-gray-400 mt-1 break-all">{PLATFORM_URL}</p>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MarketingPage() {
  const [instructor, setInstructor] = useState<InstructorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [style, setStyle] = useState<'dark' | 'light' | 'minimal'>('dark');
  const [platformStyle, setPlatformStyle] = useState<'dark' | 'light' | 'minimal'>('dark');
  const [printTarget, setPrintTarget] = useState<'instructor' | 'platform'>('instructor');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/instructor/profile').then(r => r.json()),
      fetch('/api/instructor/branding').then(r => r.json()),
    ]).then(([profile, branding]) => {
      setInstructor({
        id: profile.id,
        name: profile.name,
        businessName: branding.businessName || null,
        // displayName from branding is the instructor's preferred short name
        displayName: branding.businessName
          ? null  // if businessName is set, branding handles the headline
          : (profile.displayName || null),
        profileImage: profile.profileImage || null,
        phone: profile.phone,
        hourlyRate: profile.hourlyRate,
        averageRating: profile.averageRating,
        totalReviews: profile.totalReviews || 0,
        baseAddress: profile.baseAddress || null,
        vehicleTypes: profile.vehicleTypes || null,
        yearsExperience: profile.yearsExperience || null,
        subscriptionTier: profile.subscriptionTier || 'BASIC',
        customSlug: branding.customSlug || null,
        accountType: branding.accountType || profile.accountType || 'INDIVIDUAL',
      });
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 animate-spin text-sky-400" />
      </div>
    );
  }

  if (!instructor) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center text-slate-400">
        <p>Failed to load your profile. Please refresh.</p>
      </div>
    );
  }

  const bookingUrl = buildBookingUrl(instructor);
  const { headline, subline } = resolveFlyer(instructor);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Marketing Flyer</h1>
        <p className="text-sm text-slate-400 mt-1">
          Print and leave at tax agents, GPs, mechanics, schools — anywhere your future students visit.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">

        {/* Left: controls */}
        <div className="space-y-5">

          {/* Identity preview */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Flyer identity</p>
            <p className="text-lg font-bold text-white">{headline}</p>
            {subline && <p className="text-sm text-sky-400 mt-0.5">{subline}</p>}
            <p className="text-xs text-slate-500 mt-2">
              {instructor.subscriptionTier === 'BUSINESS' || instructor.accountType === 'BUSINESS'
                ? 'Business tier — business name is the brand'
                : instructor.subscriptionTier === 'STUDIO'
                ? 'Studio tier — brand name with instructor credit'
                : 'Basic/Pro tier — your preferred display name'
              }
              {' · '}
              <a href="/dashboard/branding" className="text-sky-500 hover:text-sky-400 underline">
                Change in Branding →
              </a>
            </p>
          </div>

          {/* Booking URL */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">QR code destination</p>
            <div className="flex items-center gap-2">
              <p className="flex-1 text-sm text-sky-400 font-mono break-all bg-slate-950 rounded-lg px-3 py-2 border border-slate-800">
                {bookingUrl}
              </p>
              <button
                onClick={handleCopyUrl}
                className="shrink-0 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
                title="Copy URL"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
              </button>
            </div>
          </div>

          {/* Style picker */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Style</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: 'dark',    label: 'Dark',    desc: 'High contrast' },
                { key: 'light',   label: 'Light',   desc: 'Colourful' },
                { key: 'minimal', label: 'Minimal', desc: 'Ink-saving' },
              ] as const).map(({ key, label, desc }) => (
                <button
                  key={key}
                  onClick={() => setStyle(key)}
                  className={`px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition-all text-left ${
                    style === key
                      ? 'border-sky-500 bg-sky-950/40 text-sky-300'
                      : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <p className="font-semibold">{label}</p>
                  <p className="text-[10px] opacity-70">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Print instructions */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">How to print</p>
            <ol className="space-y-2 text-sm text-slate-300">
              <li className="flex items-start gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-sky-600 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">1</span>
                Click <strong className="text-white">Print Flyer</strong> below
              </li>
              <li className="flex items-start gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-sky-600 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">2</span>
                Choose <strong className="text-white">Save as PDF</strong> or your printer
              </li>
              <li className="flex items-start gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-sky-600 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">3</span>
                Print A5 card stock — laminate for longevity
              </li>
              <li className="flex items-start gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-sky-600 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">4</span>
                Leave at tax agents, GPs, mechanics, schools
              </li>
            </ol>

            <button
              onClick={() => {
                setPrintTarget('instructor');
                setTimeout(() => window.print(), 100);
              }}
              className="mt-4 w-full flex items-center justify-center gap-2 px-5 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-semibold text-sm transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print Flyer
            </button>
          </div>

          <div className="bg-amber-950/30 border border-amber-700/40 rounded-2xl p-4 text-sm text-amber-200">
            <p className="font-semibold mb-1">💡 Placement tip</p>
            <p className="text-xs text-amber-300/80">
              Tax agents and accountants are gold — parents bringing their teen's tax return are exactly your audience. Ask the front desk to keep one on display. Most local businesses are happy to help.
            </p>
          </div>
        </div>

        {/* Right: live preview */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4 text-center">Preview</p>
          <Flyer instructor={instructor} url={bookingUrl} style={style} />
        </div>
      </div>

      {/* ── PLATFORM FLYER SECTION ──────────────────────────────────────── */}
      <div className="mt-12 pt-10 border-t border-slate-800">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white">Recruit Instructors for DriveBook</h2>
          <p className="text-sm text-slate-400 mt-1">
            Print this flyer and leave it at driving school offices, instructor associations, or hand it to colleagues.
            QR code goes to <span className="text-sky-400 font-mono">drivebook.com.au/teach-with-drivebook</span>.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Platform flyer preview — fixed content, no customisation needed */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4 text-center">Preview</p>
            <PlatformFlyer style={platformStyle} />
          </div>

          {/* Controls */}
          <div className="space-y-5">
            {/* Style picker */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Style</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: 'dark',    label: 'Dark',    desc: 'High contrast' },
                  { key: 'light',   label: 'Light',   desc: 'Colourful' },
                  { key: 'minimal', label: 'Minimal', desc: 'Ink-saving' },
                ] as const).map(({ key, label, desc }) => (
                  <button
                    key={key}
                    onClick={() => setPlatformStyle(key)}
                    className={`px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition-all text-left ${
                      platformStyle === key
                        ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300'
                        : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <p className="font-semibold">{label}</p>
                    <p className="text-[10px] opacity-70">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">How to use</p>
              <ol className="space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">1</span>
                  Click <strong className="text-white">Print Flyer</strong> and save as PDF
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">2</span>
                  Leave at driving schools, instructor offices, or NDIS providers
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">3</span>
                  Hand to colleagues — instructors who sign up help build the platform you use
                </li>
              </ol>
              <button
                onClick={() => {
                  setPrintTarget('platform');
                  setTimeout(() => window.print(), 100);
                }}
                className="mt-4 w-full flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-sm transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print Platform Flyer
              </button>
            </div>
          </div>
        </div>
      </div>

      {/*
       * PRINT LAYOUT — hidden on screen, shown in print
       * Uses visibility:hidden (not display:none) so the element is rendered
       * and can be made visible in @media print without layout issues.
       */}
      <div id="print-page" style={{ visibility: 'hidden', position: 'absolute', top: 0, left: 0, zIndex: -1, pointerEvents: 'none' }}>
        {printTarget === 'instructor' && instructor ? (
          <PrintableFlyerInstructor instructor={instructor} url={bookingUrl} style={style} />
        ) : (
          <PrintableFlyerPlatform style={platformStyle} />
        )}
      </div>

      {/* Print-only styles */}
      <style jsx global>{`
        @media print {
          /* White background — overrides dark dashboard */
          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Hide everything */
          body {
            visibility: hidden !important;
          }

          /* Show only the print page */
          #print-page {
            visibility: visible !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 148mm !important;
            min-height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            z-index: 99999 !important;
          }

          /* All descendants must be visible */
          #print-page * {
            visibility: visible !important;
          }

          /* Force background colours */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* A4 page, zero margins */
          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}
