/**
 * ProfileCompletenessCard
 *
 * Shows a profile completeness score to the instructor on their dashboard.
 * Each incomplete field links to the exact settings/profile page that fixes it.
 *
 * Score is computed server-side from the Instructor record — no extra DB query
 * needed when called from the dashboard (pass the already-fetched instructor).
 *
 * Scoring weights are chosen to reflect search-ranking impact:
 *   - Fields that directly affect discoverability (bio, photo, serviceAreas, baseAddress) weight higher
 *   - Operational fields (workingHours, vehicleTypes) are required for booking to work
 *   - Nice-to-have (car details, languages) weight lower
 *
 * Hidden at 100% so it doesn't clutter the dashboard once complete.
 */

import Link from 'next/link';

interface InstructorFields {
  bio:           string | null | undefined;
  profileImage:  string | null | undefined;
  baseAddress:   string | null | undefined;
  serviceAreas:  string | null | undefined;
  vehicleTypes:  string | null | undefined;
  workingHours:  unknown;
  carMake:       string | null | undefined;
  carModel:      string | null | undefined;
  languages:     string | null | undefined;
  hourlyRate:    number | null | undefined;
  phone:         string | null | undefined;
  averageRating: number | null | undefined;
  totalReviews:  number;
}

interface CheckItem {
  key:        string;
  label:      string;
  done:       boolean;
  href:       string;
  weight:     number;   // contribution to score (all weights sum to 100)
  tip:        string;
}

export function computeProfileCompleteness(inst: InstructorFields): {
  score: number;
  items: CheckItem[];
} {
  const items: CheckItem[] = [
    {
      key:    'bio',
      label:  'Add a bio',
      done:   !!inst.bio && inst.bio.trim().length > 30,
      href:   '/dashboard/profile',
      weight: 20,
      tip:    'A bio appears in search results and builds trust with learners.',
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
      key:    'serviceAreas',
      label:  'Set your service areas',
      done:   !!inst.serviceAreas && inst.serviceAreas.trim().length > 2,
      href:   '/dashboard/settings',
      weight: 15,
      tip:    'Helps learners find you and improves your listing in suburb searches.',
    },
    {
      key:    'workingHours',
      label:  'Configure working hours',
      done:   (() => {
        if (!inst.workingHours || typeof inst.workingHours !== 'object') return false;
        const wh = inst.workingHours as Record<string, unknown>;
        return Object.values(wh).some(v => Array.isArray(v) && v.length > 0);
      })(),
      href:   '/dashboard/availability',
      weight: 15,
      tip:    'Learners and the AI receptionist can only book slots during your working hours.',
    },
    {
      key:    'vehicleTypes',
      label:  'Set transmission types (auto / manual)',
      done:   !!inst.vehicleTypes && inst.vehicleTypes.trim().length > 0,
      href:   '/dashboard/settings',
      weight: 10,
      tip:    'Filters in search — learners search by transmission type.',
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
      tip:    'Opens up non-English speaking learners who filter by language.',
    },
  ];

  const totalWeight  = items.reduce((s, i) => s + i.weight, 0);
  const earnedWeight = items.filter(i => i.done).reduce((s, i) => s + i.weight, 0);
  const score        = Math.round((earnedWeight / totalWeight) * 100);

  return { score, items };
}

interface Props {
  instructor: InstructorFields;
}

export default function ProfileCompletenessCard({ instructor }: Props) {
  const { score, items } = computeProfileCompleteness(instructor);

  // Hide once fully complete — no point showing 100%
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

  return (
    <div className={`mb-5 rounded-3xl border ${borderColor} bg-slate-900/80 p-5`}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-0.5">
            Profile completeness
          </p>
          <p className="text-sm text-slate-400">
            Complete your profile to appear higher in search and get more bookings.
          </p>
        </div>
        <span className={`text-3xl font-bold tabular-nums ${scoreColor}`}>
          {score}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-slate-800 mb-4 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Incomplete items */}
      {incomplete.length > 0 && (
        <div className="space-y-2 mb-3">
          {incomplete.map(item => (
            <Link
              key={item.key}
              href={item.href}
              className="flex items-start gap-3 rounded-2xl border border-white/5 bg-slate-950/40 px-4 py-2.5 hover:bg-slate-950/70 hover:border-white/10 transition-colors no-underline group"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-slate-600 text-slate-600 group-hover:border-slate-400">
                <span className="block h-1.5 w-1.5 rounded-full" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-200 group-hover:text-white">{item.label}</p>
                <p className="text-xs text-slate-500">{item.tip}</p>
              </div>
              <span className="shrink-0 text-xs text-sky-400 font-medium self-center">Fix →</span>
            </Link>
          ))}
        </div>
      )}

      {/* Completed items — collapsed summary */}
      {complete.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1">
          {complete.map(item => (
            <span
              key={item.key}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/40 border border-emerald-500/20 px-2.5 py-1 text-xs text-emerald-400"
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
  );
}
