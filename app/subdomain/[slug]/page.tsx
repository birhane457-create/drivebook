import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Car, Star, Phone, Globe, Clock, CheckCircle, MessageCircle, Instagram, Facebook, Users, Award, Calendar, ShieldCheck, ChevronDown, AlertTriangle } from 'lucide-react';
import BulkBookingForm from '@/components/BulkBookingForm';
import SubdomainClientFeatures from '@/components/subdomain/SubdomainClientFeatures';
import SubdomainDesktopNav from '@/components/subdomain/SubdomainDesktopNav';
import SubdomainBookingEntry from '@/components/subdomain/SubdomainBookingEntry';
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
      lessonPackages: true,
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
      // Test package fields — accessed via (instructor as any) until schema is pushed to production
    },
  });

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

  // Branding — colors apply for all tiers; logo/name white-labelling is PRO/BUSINESS only
  const isPro = instructor.subscriptionTier === 'PRO' || instructor.subscriptionTier === 'BUSINESS';
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
  const minBookableTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2hrs from now

  for (let i = 0; i < 14 && nextAvailableSlots.length < 3; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
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

      // Start cursor at the later of: slot start, or minBookableTime (rounded up to next hour)
      let cursor = new Date(Math.max(dayStart.getTime(), minBookableTime.getTime()));
      cursor.setMinutes(0, 0, 0);
      if (cursor < minBookableTime) cursor = new Date(cursor.getTime() + 60 * 60 * 1000);

      while (cursor < dayEnd && nextAvailableSlots.length < 3) {
        const slotEnd = new Date(cursor.getTime() + 60 * 60 * 1000);
        const blocked = upcomingBookings.some(b => {
          const bs = new Date(b.startTime!);
          const be = new Date(b.endTime!);
          return cursor < be && slotEnd > bs;
        });
        if (!blocked) {
          const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' });
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

  const activePackages = ((instructor.lessonPackages as any[]) || []).filter((p: any) => p.isActive !== false);
  const searchedLocation = searchParams.location || null;
  const languages = instructor.languages ? instructor.languages.split(',').map(l => l.trim()) : [];
  const vehicleTypes = instructor.vehicleTypes ? instructor.vehicleTypes.split(',').map(v => v.trim()) : [];

  // Extract suburb only from baseAddress — handles "Maylands WA 6051" or "12 Smith St, Maylands WA 6051"
  const baseSuburb = (() => {
    if (!instructor.baseAddress) return null;
    const parts = instructor.baseAddress.split(',').map((s: string) => s.trim());
    // Walk from the end — find the first part that contains a suburb (letters, no leading digit)
    for (let i = parts.length - 1; i >= 0; i--) {
      // Strip state code (2-3 uppercase letters) and postcode (4 digits)
      const clean = parts[i]
        .replace(/\b[A-Z]{2,3}\b/g, '')
        .replace(/\b\d{4}\b/g, '')
        .trim();
      if (clean && !/^\d/.test(clean)) return clean;
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
      a: '100% refund if you cancel 48+ hours before your lesson. 50% refund for 24–48 hours notice. No refund for cancellations under 24 hours.',
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
                    {nextAvailableSlots.slice(0, 2).join(' · ')}
                  </div>
                )}
              </div>
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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">

          {/* Left: Profile card */}
          <div className="lg:col-span-1 space-y-4">

            {/* Next availability callout */}
            {nextAvailableSlots.length > 0 && (
              <div className="rounded-xl p-4 border-2 flex items-start gap-3" style={{ backgroundColor: `${primary}10`, borderColor: `${primary}40` }}>
                <Calendar className="h-5 w-5 shrink-0 mt-0.5" style={{ color: primary }} />
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Next Available</p>
                  <div className="space-y-0.5">
                    {nextAvailableSlots.map((slot, i) => (
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
                {(baseSuburb || instructor.serviceRadiusKm) && (
                  <div className="flex items-center gap-2 py-2 border-b border-gray-50">
                    <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-600">
                      {baseSuburb ? `Based in ${baseSuburb}` : 'Local area'}
                      {instructor.serviceRadiusKm ? ` · up to ${instructor.serviceRadiusKm} km radius` : ''}
                    </span>
                  </div>
                )}

                {/* Packages */}
                {activePackages.map((pkg: any) => {
                  const pkgDuration = pkg.durationMinutes
                    ? formatDuration(pkg.durationMinutes)
                    : pkg.hours
                    ? `${pkg.hours} hrs`
                    : null;
                  const hourlyEquiv = pkg.durationMinutes
                    ? (instructor.hourlyRate * pkg.durationMinutes) / 60
                    : pkg.hours
                    ? instructor.hourlyRate * pkg.hours
                    : null;
                  const saving = hourlyEquiv ? hourlyEquiv - pkg.price : null;
                  return (
                    <div key={pkg.id} className="flex justify-between items-start py-2 border-b border-gray-50 last:border-0">
                      <div>
                        <p className="text-base font-medium text-gray-800">{pkg.name}</p>
                        {pkgDuration && <p className="text-sm text-gray-400">{pkgDuration}</p>}
                        {pkg.description && <p className="text-xs text-gray-400 mt-0.5">{pkg.description}</p>}
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="font-bold" style={{ color: secondary }}>${pkg.price.toFixed(2)}</p>
                        {/* No "save vs hourly" — instructor packages include extras beyond lesson time */}
                      </div>
                    </div>
                  );
                })}
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
                      {vehicleTypes.map(v => (
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

            {/* Vehicle photo */}
            {instructor.carImage && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="relative h-40">
                  <Image src={instructor.carImage} alt="Training vehicle" fill className="object-cover" />
                </div>
                {(instructor.carMake || instructor.carModel) && (
                  <div className="px-4 py-2 text-sm text-gray-600">
                    {[instructor.carYear, instructor.carMake, instructor.carModel].filter(Boolean).join(' ')}
                  </div>
                )}
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

          {/* Right: Booking form + reviews */}
          <div className="lg:col-span-2 space-y-6">
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

            <div id="booking-form" className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              {/* Social proof banner */}
              {(instructor.totalReviews > 0 || nextAvailableLabel) && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-sm text-gray-600">
                  {instructor.totalReviews > 0 && (
                    <span>⭐ {instructor.averageRating?.toFixed(1) ?? '5.0'} from {instructor.totalReviews} reviews</span>
                  )}
                  {nextAvailableLabel && (
                    <span>⏱ Next available: {nextAvailableSlots.slice(0, 2).join(' · ')}</span>
                  )}
                  <span>🔒 No account required</span>
                </div>
              )}
              <h2 className="text-xl font-bold text-gray-900 mb-0.5">Book Your Lesson</h2>
              <p className="text-sm text-gray-500 mb-6">Takes less than 60 seconds · No account required</p>
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
                    lessonPackages: activePackages,
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

            {/* Reviews section */}
            {recentReviews.length > 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
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
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
                <div className="flex justify-center gap-0.5 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-gray-200" />
                  ))}
                </div>
                <p className="text-sm font-medium text-gray-700">No reviews yet</p>
                <p className="text-xs text-gray-400 mt-1">Be the first to book and leave a review</p>
              </div>
            )}
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
                  lessonPackages: activePackages,
                }}
                primary={primary}
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
