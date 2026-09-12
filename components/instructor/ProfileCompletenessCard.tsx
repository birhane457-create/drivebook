/**
 * ProfileCompletenessCard
 *
 * Shows a profile completeness score to the instructor on their dashboard.
 * Each incomplete field links to the exact settings/profile page that fixes it.
 *
 * Collapsible behaviour:
 *   - score < 60%  → expanded by default (new instructors can't miss it)
 *   - score ≥ 60%  → collapsed by default (experienced instructors get their space back)
 *   - Collapse state persisted in localStorage so it survives navigation
 *
 * Hidden at 100% so it doesn't clutter the dashboard once complete.
 */

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface InstructorFields {
  bio:              string | null | undefined;
  profileImage:     string | null | undefined;
  baseAddress:      string | null | undefined;
  serviceRadiusKm:  number | null | undefined;
  vehicleTypes:     string | null | undefined;
  workingHours:     unknown;
  carMake:          string | null | undefined;
  carModel:         string | null | undefined;
  languages:        string | null | undefined;
  hourlyRate:       number | null | undefined;
  phone:            string | null | undefined;
  averageRating:    number | null | undefined;
  totalReviews:     number;
  businessType?:    string | null | undefined;
}

interface CheckItem {
  key:        string;
  label:      string;
  done:       boolean;
  href:       string;
  weight:     number;
  tip:        string;
}

export function computeProfileCompleteness(inst: InstructorFields): {
  score: number;
  items: CheckItem[];
} {
  const isDriving = (inst.businessType ?? 'driving') === 'driving';
  const customerLabel = isDriving ? 'clients' : 'customers';

  const items: CheckItem[] = [
    {
      key:    'bio',
      label:  'Add a bio',
      done:   !!inst.bio && inst.bio.trim().split(/\s+/).filter(Boolean).length >= 75,
      href:   '/dashboard/profile',
      weight: 20,
      tip:    `A bio of at least 75 words appears in search results and builds trust with ${customerLabel}.`,
    },
    {
      key:    'photo',
      label:  'Upload a profile photo',
      done:   !!inst.profileImage,
      href:   '/dashboard/profile',
      weight: 15,
      tip:    'Profiles with a photo get significantly more bookings.',
    },
    {
      key:    'baseAddress',
      label:  'Set your base address',
      done:   !!inst.baseAddress && inst.baseAddress.trim().length > 5,
      href:   '/dashboard/settings',
      weight: 15,
      tip:    'Required for location-based search and the suburb pages.',
    },
    {
      key:    'serviceRadius',
      label:  'Set your service area',
      done:   !!inst.baseAddress && inst.baseAddress.trim().length > 5 && ((inst as any).serviceRadiusKm ?? 0) > 0,
      href:   '/dashboard/settings',
      weight: 15,
      tip:    `Set your base address and service radius so ${customerLabel} in your area can find you.`,
    },
    {
      key:    'workingHours',
      label:  'Configure working hours',
      done:   (() => {
        if (!inst.workingHours || typeof inst.workingHours !== 'object') return false;
        const wh = inst.workingHours as Record<string, unknown>;
        return Object.values(wh as any).some((v: any) => Array.isArray(v) && v.length > 0);
      })(),
      href:   '/dashboard/availability',
      weight: 15,
      tip:    `${customerLabel.charAt(0).toUpperCase() + customerLabel.slice(1)} can only book slots during your working hours.`,
    },
  ];

  if (isDriving) {
    items.push(
      {
        key:    'vehicleTypes',
        label:  'Set transmission types (auto / manual)',
        done:   !!inst.vehicleTypes && inst.vehicleTypes.trim().length > 0,
        href:   '/dashboard/settings',
        weight: 10,
        tip:    `Filters in search — ${customerLabel} search by transmission type.`,
      },
      {
        key:    'car',
        label:  'Add your car details',
        done:   !!inst.carMake && !!inst.carModel,
        href:   '/dashboard/profile',
        weight: 5,
        tip:    'Learners want to know what car they will be driving.',
      },
      {
        key:    'languages',
        label:  'List languages you teach in',
        done:   !!inst.languages && inst.languages.trim().length > 0,
        href:   '/dashboard/profile',
        weight: 5,
        tip:    `Opens up non-English speaking ${customerLabel} who filter by language.`,
      }
    );
  } else {
    items.push({
      key:    'services',
      label:  'Add your services',
      done:   !!inst.hourlyRate && inst.hourlyRate > 0,
      href:   '/dashboard/settings',
      weight: 15,
      tip:    'Set your service rate so customers know what to expect before booking.',
    });
  }

  const totalWeight  = items.reduce((s: any, i: any) => s + i.weight, 0);
  const earnedWeight = items.filter(i => i.done).reduce((s: any, i: any) => s + i.weight, 0);
  const score        = Math.round((earnedWeight / totalWeight) * 100);

  return { score, items };
}

interface Props {
  instructor: InstructorFields;
}

export default function ProfileCompletenessCard({ instructor }: Props) {
  const { score, items } = computeProfileCompleteness(instructor);

  const STORAGE_KEY = 'profile-completeness-collapsed';
  const defaultCollapsed = score >= 60;
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setCollapsed(stored === 'true');
    } catch { /* localStorage may be unavailable */ }
  }, []);

  if (score === 100) return null;

  const incomplete = items.filter(i => !i.done);
  const complete   = items.filter(i => i.done);

  const scoreColor =
    score >= 80 ? 'text-emerald-400' :
    score >= 50 ? 'text-amber-400'   :
                  'text-rose-400';

  const barColor =
    score >= 80 ? 'bg-emerald-500' :
    score >= 50 ? 'bg-amber-500'   :
                  'bg-rose-500';

  const borderColor =
    score >= 80 ? 'border-emerald-500/20' :
    score >= 50 ? 'border-amber-500/20'   :
                  'border-rose-500/20';

  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const isCollapsed = mounted ? collapsed : defaultCollapsed;

  return (
    <div className={`mb-5 rounded-xl border ${borderColor} bg-card/80`}>
      <button
        onClick={toggle}
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
        aria-expanded={!isCollapsed}
        aria-label="Toggle profile completeness"
      >
        {isCollapsed
          ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronDown  className="h-4 w-4 text-muted-foreground shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Profile completeness
            </p>
            {incomplete.length > 0 && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                score >= 80 ? 'bg-emerald-500/15 text-emerald-400' :
                score >= 50 ? 'bg-amber-500/15 text-amber-400' :
                              'bg-destructive/15 text-destructive'
              }`}>
                {incomplete.length} to&nbsp;do
              </span>
            )}
          </div>
          <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${barColor}`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
        <span className={`text-2xl font-bold tabular-nums shrink-0 ${scoreColor}`}>
          {score}%
        </span>
      </button>

      {!isCollapsed && (
        <div className="px-5 pb-5">
          <p className="text-sm text-muted-foreground mb-4 -mt-1">
            Complete your profile to appear higher in search and get more bookings.
          </p>
          {incomplete.length > 0 && (
            <div className="space-y-2 mb-3">
              {incomplete.map(item => (
                <Link
                  key={item.key}
                  href={item.href}
                  className="flex items-start gap-3 rounded-xl border border-border bg-background/40 px-4 py-2.5 hover:bg-background/70 hover:border-border/80 transition-colors no-underline group"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-border">
                    <span className="block h-1.5 w-1.5 rounded-full" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.tip}</p>
                  </div>
                  <span className="shrink-0 text-xs text-primary font-medium self-center">Fix →</span>
                </Link>
              ))}
            </div>
          )}
          {complete.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {complete.map(item => (
                <span
                  key={item.key}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs text-emerald-400"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {item.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
