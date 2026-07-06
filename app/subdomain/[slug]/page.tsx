import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Car, Star, Phone, Globe, Clock, CheckCircle, MessageCircle, Instagram, Facebook, Users, Award, Calendar, ShieldCheck, ChevronDown, AlertTriangle } from 'lucide-react';
import SubdomainClientFeatures from '@/components/subdomain/SubdomainClientFeatures';
import SubdomainDesktopNav from '@/components/subdomain/SubdomainDesktopNav';
import SubdomainBookingEntry from '@/components/subdomain/SubdomainBookingEntry';
import SubdomainPricingBooking from '@/components/subdomain/SubdomainPricingBooking';
import { getPlatformPricing } from '@/lib/services/platform-pricing';
import type { Metadata } from 'next';

export const revalidate = 300; // cache 5 minutes — instructor profiles don't change by the second

// ── SEO Meta Tags ─────────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const instructor = await prisma.instructor.findFirst({
    where: {
      OR: [
        { customSlug: params.slug },
        { id: params.slug },
      ],
    },
    select: {
      name: true,
      bio: true,
      serviceAreas: true,
      averageRating: true,
      totalReviews: true,
      hourlyRate: true,
      profileImage: true,
    },
  });

  if (!instructor) {
    return { title: 'Instructor Not Found' };
  }

  const title = `Book Driving Lessons with ${instructor.name}`;
  const description = instructor.bio
    ? instructor.bio.slice(0, 155)
    : `Book driving lessons with ${instructor.name}${instructor.serviceAreas ? ` in ${instructor.serviceAreas}` : ''}. From $${instructor.hourlyRate}/hr. Easy online booking, no account needed.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: instructor.profileImage ? [{ url: instructor.profileImage, width: 400, height: 400, alt: instructor.name }] : [],
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: instructor.profileImage ? [instructor.profileImage] : [],
    },
    alternates: {
      // Canonical points to the subdomain URL, not the internal /subdomain/ rewrite path
      canonical: `https://${params.slug}.drivebook.com.au`,
    },
  };
}

export default async function SubdomainBookingPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { location?: string };
}) {
  // Look up by customSlug first, then fall back to instructor ID
  // Every instructor has a default URL at <id>.drivebook.com.au
  // even before they set a custom slug
  const instructor = await prisma.instructor.findFirst({
    where: {
      OR: [
        { customSlug: params.slug },
        { id: params.slug },
      ],
    },
    select: {
      id: true,
      name: true,
      bio: true,
      phone: true,
      profileImage: true,
      carImage: true,
      carMake: true,
      carModel: true,
      carYear: true,
      serviceAreas: true,
      baseAddress: true,
      serviceRadiusKm: true,
      hourlyRate: true,
      isVerified: true,
      averageRating: true,
      totalReviews: true,
      subscriptionTier: true,
      workingHours: true,
      bookingBufferMinutes: true,
      languages: true,
      vehicleTypes: true,
      customDomain: true,
      brandLogo: true,
      brandColorPrimary: true,
      brandColorSecondary: true,
      showBrandingOnBookingPage: true,
      whatsapp: true,
      instagram: true,
      facebook: true,
      yearsExperience: true,
      allowedDurations: true,
      offersTestPackage: true,
      testPackagePrice: true,
      testPackageDuration: true,
      testPackageIncludes: true,
      subscriptionStatus: true,
      trialEndsAt: true,
    },
  }) as any;

  // Fetch the two new fields separately — Prisma client types lag behind schema
  // until `prisma generate` runs; this avoids the TypeScript error.
  const instructorExtra = instructor
    ? await (prisma.instructor as any).findUnique({
        where: { id: (instructor as any).id },
        select: { videoUrl: true, specialties: true },
      })
    : null;
  if (instructor && instructorExtra) {
    (instructor as any).videoUrl = instructorExtra.videoUrl;
    (instructor as any).specialties = instructorExtra.specialties;
  }

  if (!instructor) notFound();

  // ── Subscription gate ─────────────────────────────────────────────────────
  // Inactive instructors' subdomain pages show a "not accepting bookings" message.
  // The page still renders (for SEO / existing links) but the booking form is hidden.
  const subStatus = (instructor as any).subscriptionStatus as string;
  const trialEndsAt = (instructor as any).trialEndsAt ? new Date((instructor as any).trialEndsAt) : null;
  const trialExpired = trialEndsAt && trialEndsAt < new Date();
  const isAcceptingBookings =
    subStatus === 'ACTIVE' ||
    (subStatus === 'TRIAL' && !trialExpired);

  // Branding — colors apply for all tiers; logo/name white-labelling is PRO/STUDIO/BUSINESS only
  const isPro = instructor.subscriptionTier === 'PRO' || instructor.subscriptionTier === 'STUDIO' || instructor.subscriptionTier === 'BUSINESS';
  const hasBranding = isPro && instructor.showBrandingOnBookingPage;
  const brandLogo = hasBranding ? instructor.brandLogo : null;
  // Colors apply regardless of tier — fall back to defaults if not set
  const primary = instructor.brandColorPrimary || '#3B82F6';
  const secondary = instructor.brandColorSecondary || '#10B981';

  // Recent reviews from completed bookings
  const recentReviews = await (prisma.booking as any).findMany({
    where: {
      instructorId: instructor.id,
      clientRating: { not: null },
      status: 'COMPLETED',
    },
    select: {
      clientName: true,
      clientRating: true,
      clientReview: true,
      reviewGivenAt: true,
      startTime: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  // Next available slot — find first future slot not blocked by existing bookings
  const workingHours = (instructor.workingHours as any) || {};
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const now = new Date();

  // Normalize workingHours: DB stores { day: { start, end, enabled } } but we need { day: [{ start, end }] }
  // Handle both formats gracefully
  function getDaySlots(wh: any, dayName: string): { start: string; end: string }[] {
    const val = wh[dayName];
    if (!val) return [];
    // Array format: [{ start, end }]
    if (Array.isArray(val)) return val.filter((s: any) => s.start && s.end);
    // Object format: { start, end, enabled }
    if (typeof val === 'object' && val.start && val.end && val.enabled !== false) {
      return [{ start: val.start, end: val.end }];
    }
    return [];
  }

  const upcomingBookings = await prisma.booking.findMany({
    where: {
      instructorId: instructor.id,
      status: { in: ['CONFIRMED', 'PENDING'] },
      startTime: {
        gte: now,
        lte: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14), // 14 days
      },
    },
    select: { startTime: true, endTime: true },
    orderBy: { startTime: 'asc' },
    take: 100,
  });

  let nextAvailableLabel: string | null = null;
  const nextAvailableSlots: string[] = [];

  // Minimum bookable time: 2 hours from now, rounded UP to the next whole hour.
  // This ensures we never show a slot that has already passed or is too imminent,
  // even when the page is served from a 5-minute ISR cache.
  const twoHrsFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  // Ceil to next whole hour: if already on the hour, keep it; otherwise advance
  const minBookableTime = new Date(twoHrsFromNow);
  if (minBookableTime.getMinutes() !== 0 || minBookableTime.getSeconds() !== 0) {
    minBookableTime.setHours(minBookableTime.getHours() + 1, 0, 0, 0);
  } else {
    minBookableTime.setSeconds(0, 0);
  }

  for (let i = 0; i < 14 && nextAvailableSlots.length < 3; i++) {
    // Build a clean date for this calendar day (midnight) to avoid time-of-day
    // contamination from 'now' when calling setHours below
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    d.setHours(0, 0, 0, 0); // reset to midnight so setHours for slot times is clean

    const dayName = days[d.getDay()];
    const daySlots = getDaySlots(workingHours, dayName);
    if (daySlots.length === 0) continue;

    for (const slot of daySlots) {
      if (nextAvailableSlots.length >= 3) break;
      const [startH, startM] = slot.start.split(':').map(Number);
      const [endH, endM] = slot.end.split(':').map(Number);

      const dayStart = new Date(d);
      dayStart.setHours(startH, startM, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(endH, endM, 0, 0);

      // Cursor starts at the later of: working hours start, or minBookableTime.
      // minBookableTime is already ceiled to a whole hour so no further rounding needed.
      let cursor = new Date(Math.max(dayStart.getTime(), minBookableTime.getTime()));
      // Ensure cursor is on a whole hour boundary (it should be, but guard against
      // edge cases where dayStart itself has non-zero minutes)
      if (cursor.getMinutes() !== 0 || cursor.getSeconds() !== 0) {
        cursor.setHours(cursor.getHours() + 1, 0, 0, 0);
      }

      while (cursor < dayEnd && nextAvailableSlots.length < 3) {
        const slotEnd = new Date(cursor.getTime() + 60 * 60 * 1000);
        const blocked = upcomingBookings.some(b => {
          const bs = new Date(b.startTime!);
          const be = new Date(b.endTime!);
          return cursor < be && slotEnd > bs;
        });
        if (!blocked) {
          // Re-derive day label from the clean midnight date
          const labelDate = new Date(d);
          const todayMidnight = new Date(now);
          todayMidnight.setHours(0, 0, 0, 0);
          const tomorrowMidnight = new Date(todayMidnight.getTime() + 86400000);
          const label =
            labelDate.getTime() === todayMidnight.getTime() ? 'Today' :
            labelDate.getTime() === tomorrowMidnight.getTime() ? 'Tomorrow' :
            labelDate.toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' });
          const timeStr = cursor.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
          nextAvailableSlots.push(`${label} ${timeStr}`);
        }
        cursor = slotEnd;
      }
    }
  }
  if (nextAvailableSlots.length > 0) nextAvailableLabel = nextAvailableSlots[0];

  // Working hours summary for display (e.g. "Mon–Fri 9am–5pm, Sat 9am–1pm")
  const workingHoursSummary = (() => {
    const dayAbbr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const orderedDays = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
    const lines: string[] = [];
    for (const day of orderedDays) {
      const slots = getDaySlots(workingHours, day);
      if (slots.length === 0) continue;
      const abbr = dayAbbr[orderedDays.indexOf(day) < 5 ? orderedDays.indexOf(day) + 1 : orderedDays.indexOf(day) === 5 ? 6 : 0];
      const times = slots.map(s => {
        const fmt = (t: string) => {
          const [h, m] = t.split(':').map(Number);
          const ampm = h >= 12 ? 'pm' : 'am';
          const h12 = h % 12 || 12;
          return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2,'0')}${ampm}`;
        };
        return `${fmt(s.start)}–${fmt(s.end)}`;
      }).join(', ');
      lines.push(`${abbr} ${times}`);
    }
    return lines;
  })();

  // Fetch platform pricing for live discount percentages
  const platformPricing = await getPlatformPricing();

  // Popular package — count completed/paid bookings by package size for this instructor
  const packageCounts = await prisma.booking.groupBy({
    by: ['packageHours'],
    where: {
      instructorId: instructor.id,
      isPackageBooking: true,
      isPaid: true,
      packageHours: { in: [6, 10, 15] },
    },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 1,
  });
  const popularPackageHours: number | null =
    packageCounts.length > 0 && (packageCounts[0]._count.id ?? 0) >= 3
      ? (packageCounts[0].packageHours as number)
      : null;

  // Test centres this instructor covers (via their PDA configs)
  const pdaConfigs = instructor.offersTestPackage
    ? await prisma.pDATestConfig.findMany({
        where: { instructorId: instructor.id, isActive: true },
        select: {
          testCentres: {
            select: { testCentre: { select: { name: true, suburb: true } } },
          },
        },
      })
    : [];
  const coveredTestCentres: string[] = Array.from(
    new Set(
      pdaConfigs.flatMap((c: any) =>
        c.testCentres.map((tc: any) => tc.testCentre.suburb || tc.testCentre.name)
      )
    )
  ) as string[];

  const searchedLocation = searchParams.location || null;
  const languages = instructor.languages ? instructor.languages.split(',').map((l: string) => l.trim()) : [];
  const vehicleTypes = instructor.vehicleTypes ? instructor.vehicleTypes.split(',').map((v: string) => v.trim()) : [];

  // Extract suburb from baseAddress — handles multiple formats:
  // "Maylands WA 6051", "12 Smith St, Maylands WA 6051", "Maylands"
  const baseSuburb = (() => {
    if (!instructor.baseAddress) return null;
    const addr = instructor.baseAddress.trim();
    // Split on commas first
    const commaParts = addr.split(',').map((s: string) => s.trim()).filter(Boolean);
    // Work through each part from the end to find a suburb-like token
    for (let i = commaParts.length - 1; i >= 0; i--) {
      // Strip state codes (2–3 uppercase letters) and postcodes (4 digits)
      const clean = commaParts[i]
        .replace(/\b[A-Z]{2,3}\b/g, '')
        .replace(/\b\d{4,}\b/g, '')
        .trim();
      if (clean && !/^\d/.test(clean)) return clean;
    }
    // No comma — try splitting on spaces and working backwards through tokens
    const tokens = addr.split(/\s+/);
    for (let i = tokens.length - 1; i >= 0; i--) {
      const t = tokens[i];
      // Skip state codes, postcodes, and pure numbers
      if (/^[A-Z]{2,3}$/.test(t)) continue;
      if (/^\d+$/.test(t)) continue;
      // First token with a capital letter and no digits is likely the suburb
      if (/[A-Za-z]/.test(t) && !/^\d/.test(t)) return t;
    }
    return null;
  })();

  // Allowed lesson durations set by instructor in settings
  const allowedDurations: number[] = Array.isArray(instructor.allowedDurations)
    ? (instructor.allowedDurations as number[])
    : [];

  function formatDuration(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (m === 0) return h === 1 ? '1 hr' : `${h} hrs`;
    return h > 0 ? `${h}h ${m}m` : `${m} min`;
  }

  const whatsapp = instructor.whatsapp;
  const instagram = instructor.instagram;
  const facebook = instructor.facebook;
  const yearsExperience = instructor.yearsExperience;

  // Bio word count — split on whitespace, exclude empty tokens so spaces don't inflate the count.
  // 75 words is the minimum for a bio to be considered substantive (avoids thin content).
  const bioWordCount = instructor.bio?.trim()
    ? instructor.bio.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const bioIsSubstantial = bioWordCount >= 75;

  // Parse specialties from comma-string
  const specialties: string[] = (instructor as any).specialties
    ? (instructor as any).specialties.split(',').map((s: string) => s.trim()).filter(Boolean)
    : [];

  // Extract video embed from videoUrl (YouTube or Vimeo)
  const videoUrl: string | null = (instructor as any).videoUrl || null;
  const videoEmbed = (() => {
    if (!videoUrl) return null;
    // Handles: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID, youtube.com/embed/ID
    const ytMatch = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([^&\s?/]+)/);
    if (ytMatch) return { type: 'youtube' as const, id: ytMatch[1] };
    const viMatch = videoUrl.match(/vimeo\.com\/(\d+)/);
    if (viMatch) return { type: 'vimeo' as const, id: viMatch[1] };
    return null;
  })();

  // Trust badges — only show what we actually know is true
  const trustBadges = [
    instructor.isVerified && { icon: '✅', label: 'Verified Instructor' },
    yearsExperience && { icon: '🏆', label: `${yearsExperience}+ Years Experience` },
    instructor.totalReviews > 0 && {
      icon: '⭐',
      label: `${instructor.averageRating?.toFixed(1)} Rating (${instructor.totalReviews} ${instructor.totalReviews === 1 ? 'review' : 'reviews'})`,
    },
    { icon: '🔒', label: 'Secure Online Booking' },
  ].filter(Boolean) as { icon: string; label: string }[];

  // FAQ items — static, based on platform policy
  const faqItems = [
    {
      q: 'What should I bring to my lesson?',
      a: "Your learner's permit (L plates), comfortable closed-toe shoes, and glasses or contacts if you need them for driving. That's it.",
    },
    {
      q: 'Where will you pick me up?',
      a: "You enter your pickup address during booking. Your instructor will come to you — home, work, or anywhere in the service area.",
    },
    {
      q: "What's the cancellation policy?",
      a: `100% refund if you cancel ${platformPricing.lateCancellationWindowHours * 2}+ hours before your lesson. 50% refund for ${platformPricing.lateCancellationWindowHours}–${platformPricing.lateCancellationWindowHours * 2} hours notice. No refund for cancellations under ${platformPricing.lateCancellationWindowHours} hours.`,
    },
    {
      q: "I've never driven before — is that okay?",
      a: 'Absolutely. Most students start with zero experience. Your instructor will tailor the lesson to your level from the very first session.',
    },
    {
      q: 'How do packages work?',
      a: "You pay for the full package upfront and the credit goes into your wallet. Your first lesson is booked now — you schedule the remaining lessons from your dashboard after payment.",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* JSON-LD structured data for Google rich results */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'LocalBusiness',
            name: instructor.name,
            image: instructor.profileImage ?? undefined,
            description: instructor.bio ?? undefined,
            areaServed: instructor.serviceAreas ?? undefined,
            priceRange: 'From $' + String(instructor.hourlyRate) + '/hr',
            ...(baseSuburb && {
              address: {
                '@type': 'PostalAddress',
                addressLocality: baseSuburb,
                addressCountry: 'AU',
              },
            }),
            ...(instructor.totalReviews > 0 && {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: instructor.averageRating,
                reviewCount: instructor.totalReviews,
              },
            }),
          }),
        }}
      />
      {/* Nav */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {brandLogo ? (
              <Image src={brandLogo} alt={instructor.name} width={36} height={36} className="object-contain" />
            ) : (
              <Car className="h-7 w-7" style={{ color: primary }} />
            )}
            <span className="font-bold text-gray-900 text-lg">
              {hasBranding ? instructor.name : 'DriveBook'}
            </span>
          </div>
          <SubdomainDesktopNav primary={primary} hasBio={!!instructor.bio?.trim()} />

          <div className="flex items-center gap-3">
            {!hasBranding && <span className="text-xs text-gray-400 hidden sm:block">Powered by DriveBook</span>}
            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100"
              >
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">WhatsApp</span>
              </a>
            )}
            <Link
              href="/login"
              className="text-sm font-medium px-4 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Login
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero banner */}
      <div className="relative h-48 sm:h-64 overflow-hidden" style={{ background: `linear-gradient(135deg, ${primary}dd, ${secondary}cc)` }}>
        {instructor.carImage && (
          <Image src={instructor.carImage} alt="Training vehicle" fill className="object-cover opacity-20" />
        )}
        <div className="relative z-10 h-full flex items-center">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-6">
            <div className="relative h-24 w-24 sm:h-32 sm:w-32 rounded-full overflow-hidden border-4 border-white shadow-lg shrink-0">
              {instructor.profileImage ? (
                <Image src={instructor.profileImage} alt={instructor.name} fill className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-white" style={{ background: primary }}>
                  {instructor.name.charAt(0)}
                </div>
              )}
            </div>
              <div className="text-white">
              <h1 className="text-2xl sm:text-3xl font-bold">{instructor.name}</h1>
              <div className="flex items-center gap-1 mt-1">
                {instructor.totalReviews > 0 ? (
                  <>
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`h-4 w-4 ${i < Math.round(instructor.averageRating ?? 5) ? 'fill-white text-white' : 'text-white/40'}`} />
                    ))}
                    <span className="ml-1 text-sm text-white/80">
                      {instructor.averageRating?.toFixed(1)} · {instructor.totalReviews} {instructor.totalReviews === 1 ? 'review' : 'reviews'}
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-white/70 bg-white/10 px-2 py-0.5 rounded-full">New instructor</span>
                )}
              </div>
              {instructor.serviceAreas && (
                <div className="flex items-center gap-1 mt-1 text-white/80 text-sm">
                  <MapPin className="h-3.5 w-3.5" />
                  {instructor.serviceAreas}
                </div>
              )}
              {!instructor.serviceAreas && baseSuburb && (
                <div className="flex items-center gap-1 mt-1 text-white/80 text-sm">
                  <MapPin className="h-3.5 w-3.5" />
                  {baseSuburb}{instructor.serviceRadiusKm ? ` & surrounding areas` : ''}
                </div>
              )}
              {!instructor.serviceAreas && !baseSuburb && instructor.serviceRadiusKm && (
                <div className="flex items-center gap-1 mt-1 text-white/80 text-sm">
                  <MapPin className="h-3.5 w-3.5" />
                  Serves up to {instructor.serviceRadiusKm} km radius
                </div>
              )}
              {vehicleTypes.length > 0 && (
                <div className="flex items-center gap-1 mt-1 text-white/70 text-xs">
                  <Car className="h-3.5 w-3.5" />
                  {vehicleTypes.join(' & ')} driving lessons
                </div>
              )}
              <div className="flex items-center gap-4 mt-2">
                {yearsExperience && (
                  <div className="flex items-center gap-1 text-white/90 text-xs">
                    <Award className="h-3.5 w-3.5" />
                    {yearsExperience}+ yrs experience
                  </div>
                )}
                {instructor.totalReviews > 0 && (
                  <div className="flex items-center gap-1 text-white/90 text-xs">
                    <Users className="h-3.5 w-3.5" />
                    {instructor.totalReviews} students
                  </div>
                )}
                {nextAvailableLabel && (
                  <div className="flex items-center gap-1 text-white/90 text-xs">
                    <Calendar className="h-3.5 w-3.5" />
                    {nextAvailableSlots[0]}
                  </div>
                )}
              </div>
              {/* Hero CTA — visible on all screen sizes, scrolls to booking form on desktop */}
              {isAcceptingBookings && (
                <div className="mt-4">
                  <a
                    href="#booking-form"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-white/15 hover:bg-white/25 border border-white/30 text-white transition-all"
                  >
                    <Calendar className="h-4 w-4" />
                    Book a lesson
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Trust badges strip */}
      {trustBadges.length > 0 && (
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            {trustBadges.map((badge, i) => (
              <div key={i} className="flex items-center gap-1.5 text-sm text-gray-700">
                <span>{badge.icon}</span>
                <span>{badge.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── How it works strip ───────────────────────────────────────────────
          Static, zero cost, reduces first-timer confusion about the flow.
          Only shown when the instructor is accepting bookings. */}
      {isAcceptingBookings && (
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4 text-center">How booking works</p>
            <div className="grid grid-cols-3 gap-4 sm:gap-8 max-w-2xl mx-auto">
              {[
                { step: '1', icon: '📦', title: 'Choose a package', desc: 'Pick hours that suit you — single lesson or a bundle' },
                { step: '2', icon: '💳', title: 'Pay once upfront', desc: 'Credit goes into your wallet — no card needed later' },
                { step: '3', icon: '📅', title: 'Book your lessons', desc: 'Schedule from your dashboard anytime, at your pace' },
              ].map(({ step, icon, title, desc }) => (
                <div key={step} className="flex flex-col items-center text-center gap-1.5">
                  <div className="text-2xl">{icon}</div>
                  <p className="text-sm font-semibold text-gray-800">{title}</p>
                  <p className="text-xs text-gray-400 leading-snug hidden sm:block">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">

          {/* Left: Profile card — on mobile renders second (order-2), desktop order restored */}
          <div className="lg:col-span-1 space-y-4 order-2 lg:order-1">

            {/* Next availability callout — max 2 slots */}
            {nextAvailableSlots.length > 0 && (
              <div className="rounded-xl p-4 border-2 flex items-start gap-3" style={{ backgroundColor: `${primary}10`, borderColor: `${primary}40` }}>
                <Calendar className="h-5 w-5 shrink-0 mt-0.5" style={{ color: primary }} />
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Next Available</p>
                  <div className="space-y-0.5">
                    {nextAvailableSlots.slice(0, 2).map((slot, i) => (
                      <p key={i} className={`font-semibold ${i === 0 ? 'text-gray-900' : 'text-gray-500 text-sm font-normal'}`}>{slot}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* About — only render if bio has real content */}
            {instructor.bio?.trim() && (
              <div id="section-about" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="font-semibold text-gray-900 mb-2 text-base">About</h2>
                <p className="text-base text-gray-600 leading-relaxed">{instructor.bio}</p>
                {/* Platform context — adds a sentence for SEO on substantial bios */}
                {bioIsSubstantial && (
                  <p className="text-sm text-gray-500 leading-relaxed mt-3 pt-3 border-t border-gray-50">
                    {instructor.name} is a verified DriveBook instructor
                    {baseSuburb ? ` based in ${baseSuburb}` : ''}
                    {vehicleTypes.length > 0 ? `, offering ${vehicleTypes.join(' and ')} driving lessons` : ''}.
                    {' '}All lessons are booked and paid online — no phone calls or bank transfers required.
                  </p>
                )}
                {specialties.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Teaching style</p>
                    <div className="flex flex-wrap gap-1.5">
                      {specialties.map((s: string) => (
                        <span key={s} className="text-xs bg-violet-50 text-violet-700 border border-violet-100 px-2.5 py-1 rounded-full font-medium">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Specialties without bio */}
            {!instructor.bio?.trim() && specialties.length > 0 && (
              <div id="section-about" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="font-semibold text-gray-900 mb-3 text-base">Teaching style</h2>
                <div className="flex flex-wrap gap-1.5">
                  {specialties.map((s: string) => (
                    <span key={s} className="text-xs bg-violet-50 text-violet-700 border border-violet-100 px-2.5 py-1 rounded-full font-medium">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Pricing / Services — also serves as about anchor if no bio */}
            <div id="section-services" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-900 mb-3 text-base">Services & Pricing</h2>
              <div className="space-y-2">

                {/* Single lesson row */}
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-base text-gray-600">Single lesson</span>
                  <span className="font-bold text-lg" style={{ color: primary }}>${instructor.hourlyRate}/hr</span>
                </div>

                {/* Booking durations */}
                {allowedDurations.length > 0 && (
                  <div className="py-2 border-b border-gray-50">
                    <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide font-medium">Available lesson lengths</p>
                    <div className="flex flex-wrap gap-1.5">
                      {allowedDurations.map((mins) => {
                        const cost = (instructor.hourlyRate * mins) / 60;
                        return (
                          <div key={mins} className="flex flex-col items-center px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-center">
                            <span className="text-sm font-semibold text-gray-800">{formatDuration(mins)}</span>
                            <span className="text-xs text-gray-500">${cost % 1 === 0 ? cost.toFixed(0) : cost.toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Service area */}
                {(instructor.serviceAreas || baseSuburb || instructor.serviceRadiusKm) && (
                  <div className="flex items-center gap-2 py-2 border-b border-gray-50">
                    <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-600">
                      {instructor.serviceAreas
                        ? instructor.serviceAreas
                        : baseSuburb
                          ? `Based in ${baseSuburb}${instructor.serviceRadiusKm ? ` · up to ${instructor.serviceRadiusKm} km radius` : ''}`
                          : `Serves up to ${instructor.serviceRadiusKm} km radius`}
                    </span>
                  </div>
                )}

                {/* Bulk packages + PDA test pack + CTA — interactive, handled by client component */}
                <SubdomainPricingBooking
                  instructor={{
                    id: instructor.id,
                    name: instructor.name,
                    profileImage: instructor.profileImage,
                    hourlyRate: instructor.hourlyRate,
                    averageRating: instructor.averageRating,
                    totalReviews: instructor.totalReviews,
                    offersTestPackage: instructor.offersTestPackage ?? false,
                    testPackagePrice: instructor.testPackagePrice ?? null,
                    testPackageDuration: instructor.testPackageDuration ?? null,
                    testPackageIncludes: (instructor.testPackageIncludes as string[]) ?? [],
                    allowedDurations: allowedDurations,
                  }}
                  primary={primary}
                  secondary={secondary}
                  packages={[
                    { packageType: 'PACKAGE_6',  hours: 6,  label: '6 hr package',  discountPct: platformPricing.package6Discount,  price: instructor.hourlyRate * 6  * (1 - platformPricing.package6Discount  / 100) },
                    { packageType: 'PACKAGE_10', hours: 10, label: '10 hr package', discountPct: platformPricing.package10Discount, price: instructor.hourlyRate * 10 * (1 - platformPricing.package10Discount / 100) },
                    { packageType: 'PACKAGE_15', hours: 15, label: '15 hr package', discountPct: platformPricing.package15Discount, price: instructor.hourlyRate * 15 * (1 - platformPricing.package15Discount / 100) },
                  ]}
                  pdaPackage={instructor.offersTestPackage && instructor.testPackagePrice ? { price: instructor.testPackagePrice } : null}
                  popularHours={popularPackageHours}
                />
              </div>
            </div>

            {/* Details */}
            <div id="section-contact" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
              {vehicleTypes.length > 0 && (
                <div className="flex items-start gap-2">
                  <Car className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Vehicle types</p>
                    <div className="flex flex-wrap gap-1">
                      {vehicleTypes.map((v: string) => (
                        <span key={v} className="text-sm bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{v}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {languages.length > 0 && (
                <div className="flex items-start gap-2">
                  <Globe className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Languages</p>
                    <p className="text-base text-gray-700">{languages.join(', ')}</p>
                  </div>
                </div>
              )}
              {instructor.bookingBufferMinutes && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400 shrink-0" />
                  <p className="text-base text-gray-600">{instructor.bookingBufferMinutes} min buffer between lessons</p>
                </div>
              )}
              {workingHoursSummary.length > 0 && (
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Availability</p>
                    <div className="space-y-0.5">
                      {workingHoursSummary.map((line, i) => (
                        <p key={i} className="text-sm text-gray-700">{line}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {instructor.isVerified && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                  <p className="text-base text-gray-600">Verified instructor</p>
                </div>
              )}
              {coveredTestCentres.length > 0 && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Test centres covered</p>
                    <div className="flex flex-wrap gap-1">
                      {coveredTestCentres.map(tc => (
                        <span key={tc} className="text-sm bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">{tc}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {instructor.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                  <a href={`tel:${instructor.phone}`} className="text-base text-blue-600 hover:underline">{instructor.phone}</a>
                </div>
              )}
            </div>

            {/* Social links */}
            {(whatsapp || instagram || facebook) && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="font-semibold text-gray-900 mb-3">Connect</h2>
                <div className="flex flex-col gap-2">
                  {whatsapp && (
                    <a href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-green-700 hover:text-green-800">
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </a>
                  )}
                  {instagram && (
                    <a href={`https://instagram.com/${instagram.replace('@','')}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-pink-600 hover:text-pink-700">
                      <Instagram className="h-4 w-4" />
                      @{instagram.replace('@','')}
                    </a>
                  )}
                  {facebook && (
                    <a href={facebook.startsWith('http') ? facebook : `https://facebook.com/${facebook}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700">
                      <Facebook className="h-4 w-4" />
                      Facebook
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Vehicle photo — hover expands the image */}
            {instructor.carImage && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden group">
                <div className="relative h-40 transition-all duration-300 ease-in-out group-hover:h-56 overflow-hidden">
                  <Image
                    src={instructor.carImage}
                    alt="Training vehicle"
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {/* Vehicle type badges overlay */}
                  {vehicleTypes.length > 0 && (
                    <div className="absolute top-2 left-2 flex gap-1">
                      {vehicleTypes.map((v: string) => (
                        <span key={v} className="text-xs font-semibold bg-black/50 text-white px-2 py-0.5 rounded-full backdrop-blur-sm">
                          {v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {(instructor.carMake || instructor.carModel) && (
                  <div className="px-4 py-2 text-sm text-gray-600">
                    {[instructor.carYear, instructor.carMake, instructor.carModel].filter(Boolean).join(' ')}
                  </div>
                )}
              </div>
            )}

            {/* About this instructor — shown when bio is absent or under 75 words.
                75-word minimum ensures every profile has substantive unique content
                for Google — short bios don't solve thin content on their own. */}
            {!bioIsSubstantial && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="font-semibold text-gray-900 mb-3 text-base">
                  About {instructor.name}
                </h2>
                <div className="space-y-2 text-sm text-gray-600 leading-relaxed">
                  <p>
                    {instructor.name} offers driving lessons
                    {instructor.serviceAreas
                      ? ` in ${instructor.serviceAreas}`
                      : baseSuburb
                      ? ` based in ${baseSuburb}${instructor.serviceRadiusKm ? `, servicing up to ${instructor.serviceRadiusKm} km` : ''}`
                      : ' in Western Australia'}
                    {vehicleTypes.length > 0 ? `, with ${vehicleTypes.join(' and ')} lessons available` : ''}.
                    {' '}Lessons start from ${instructor.hourlyRate}/hr, with discounted packages for students booking 6, 10, or 15 hours.
                  </p>
                  <p>
                    All DriveBook instructors hold a valid Driving Instructor Authorisation (DIA) from the Department of Transport WA and are background checked before being listed on the platform.
                    {' '}Booking is handled entirely online — choose your package, pay once, and schedule lessons from your student dashboard at any time.
                  </p>
                  {yearsExperience ? (
                    <p>
                      With {yearsExperience}+ years of teaching experience, {instructor.name} can guide students from their first lesson through to PDA preparation, tailoring each session to the student&apos;s current ability and learning pace.
                    </p>
                  ) : null}
                </div>
              </div>
            )}

            {/* FAQ Accordion */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-gray-400" />
                Before You Book
              </h2>
              <div className="space-y-1">
                {faqItems.map((item, i) => (
                  <details key={i} className="group border-b border-gray-50 last:border-0">
                    <summary className="flex items-center justify-between py-3 cursor-pointer list-none text-base font-medium text-gray-800 hover:text-gray-900 select-none">
                      {item.q}
                      <ChevronDown className="h-4 w-4 text-gray-400 shrink-0 ml-2 transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="pb-3 text-base text-gray-600 leading-relaxed">{item.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Reviews + Booking form — on mobile renders first (order-1) */}
          <div className="lg:col-span-2 space-y-6 order-1 lg:order-2">
            {searchedLocation && (
              <div className="rounded-xl p-4 border-2" style={{ backgroundColor: `${primary}10`, borderColor: `${primary}40` }}>
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 mt-0.5 shrink-0" style={{ color: primary }} />
                  <div>
                    <p className="font-semibold text-gray-900">Lessons near: {searchedLocation}</p>
                    <p className="text-sm text-gray-600 mt-0.5">{instructor.name} services this area. Enter your exact pickup address below.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Reviews — shown first so social proof is visible before the CTA */}
            {recentReviews.length > 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Student Reviews</h2>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold text-gray-900">{instructor.averageRating?.toFixed(1)}</span>
                    <span className="text-sm text-gray-500">({instructor.totalReviews})</span>
                  </div>
                </div>
                <div className="space-y-4">
                  {recentReviews.map((review: any, i: number) => (
                    <div key={i} className="border-b border-gray-50 last:border-0 pb-4 last:pb-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-gray-900 text-sm">{review.clientName || 'Student'}</p>
                        <div className="flex items-center gap-0.5">
                          {[...Array(5)].map((_, s) => (
                            <Star key={s} className={`h-3.5 w-3.5 ${s < review.clientRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
                          ))}
                        </div>
                      </div>
                      {review.clientReview && (
                        <p className="text-sm text-gray-600">{review.clientReview}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(review.reviewGivenAt || review.startTime).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Video intro — shown above the booking card when set */}
            {videoEmbed && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    src={
                      videoEmbed.type === 'youtube'
                        ? `https://www.youtube.com/embed/${videoEmbed.id}`
                        : `https://player.vimeo.com/video/${videoEmbed.id}`
                    }
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={`Meet ${instructor.name}`}
                  />
                </div>
                <div className="px-4 py-2.5 border-t border-gray-50">
                  <p className="text-xs text-gray-400">🎬 Meet your instructor</p>
                </div>
              </div>
            )}

            {/* Booking card — social proof + single CTA button only.
                Package rows are in the left column Services card. */}
            <div id="booking-form" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              {/* Social proof banner */}
              {instructor.totalReviews > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-sm text-gray-600">
                  <span>⭐ {instructor.averageRating?.toFixed(1) ?? '5.0'} from {instructor.totalReviews} reviews</span>
                  <span>🔒 No app install required</span>
                </div>
              )}
              <h2 className="text-xl font-bold text-gray-900 mb-0.5">Book Your Lesson</h2>
              <p className="text-sm text-gray-500 mb-6">Takes less than 60 seconds · No app install required</p>
              {isAcceptingBookings ? (
                <SubdomainBookingEntry
                  instructor={{
                    id: instructor.id,
                    name: instructor.name,
                    profileImage: instructor.profileImage,
                    hourlyRate: instructor.hourlyRate,
                    averageRating: instructor.averageRating,
                    totalReviews: instructor.totalReviews,
                    offersTestPackage: instructor.offersTestPackage ?? false,
                    testPackagePrice: instructor.testPackagePrice ?? null,
                    testPackageDuration: instructor.testPackageDuration ?? null,
                    testPackageIncludes: (instructor.testPackageIncludes as string[]) ?? [],
                    allowedDurations: allowedDurations,
                  }}
                  primary={primary}
                />
              ) : (
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-3" />
                  <p className="font-semibold text-gray-900 mb-1">{instructor.name} is not currently accepting bookings</p>
                  <p className="text-sm text-gray-500 mb-5">This instructor's account is temporarily inactive. Please check back later or find another instructor.</p>
                  <a href="/book" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors">
                    Find Another Instructor
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 border-t border-gray-200 bg-white py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-400">
          {hasBranding
            ? `© ${new Date().getFullYear()} ${instructor.name} · Powered by DriveBook`
            : `© ${new Date().getFullYear()} DriveBook`}
        </div>
      </footer>

      {/* Mobile bottom nav + full-screen booking drawer */}
      <SubdomainClientFeatures primary={primary} instructorName={instructor.name} isAcceptingBookings={isAcceptingBookings}>
        <div className="space-y-4">
          {isAcceptingBookings ? (
            <>
              <h2 className="text-xl font-bold text-gray-900">Book a Lesson</h2>
              <SubdomainPricingBooking
                instructor={{
                  id: instructor.id,
                  name: instructor.name,
                  profileImage: instructor.profileImage,
                  hourlyRate: instructor.hourlyRate,
                  averageRating: instructor.averageRating,
                  totalReviews: instructor.totalReviews,
                  offersTestPackage: instructor.offersTestPackage ?? false,
                  testPackagePrice: instructor.testPackagePrice ?? null,
                  testPackageDuration: instructor.testPackageDuration ?? null,
                  testPackageIncludes: (instructor.testPackageIncludes as string[]) ?? [],
                  allowedDurations: allowedDurations,
                }}
                primary={primary}
                secondary={secondary}
                packages={[
                  { packageType: 'PACKAGE_6',  hours: 6,  label: '6 hr package',  discountPct: platformPricing.package6Discount,  price: instructor.hourlyRate * 6  * (1 - platformPricing.package6Discount  / 100) },
                  { packageType: 'PACKAGE_10', hours: 10, label: '10 hr package', discountPct: platformPricing.package10Discount, price: instructor.hourlyRate * 10 * (1 - platformPricing.package10Discount / 100) },
                  { packageType: 'PACKAGE_15', hours: 15, label: '15 hr package', discountPct: platformPricing.package15Discount, price: instructor.hourlyRate * 15 * (1 - platformPricing.package15Discount / 100) },
                ]}
                pdaPackage={instructor.offersTestPackage && instructor.testPackagePrice ? { price: instructor.testPackagePrice } : null}
              />
            </>
          ) : (
            <div className="text-center py-8">
              <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
              <p className="font-semibold text-gray-900 mb-1">Not accepting bookings</p>
              <p className="text-sm text-gray-500 mb-4">This instructor's account is temporarily inactive.</p>
              <a href="/book" className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                Find Another Instructor
              </a>
            </div>
          )}
        </div>
      </SubdomainClientFeatures>
    </div>
  );
}
