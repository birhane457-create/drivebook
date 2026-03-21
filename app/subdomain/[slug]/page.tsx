import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Car, Star, Phone, Globe, Clock, CheckCircle, MessageCircle, Instagram, Facebook, Users, Award, Calendar, ShieldCheck, ChevronDown } from 'lucide-react';
import BulkBookingForm from '@/components/BulkBookingForm';
import SubdomainClientFeatures from '@/components/subdomain/SubdomainClientFeatures';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

// ── SEO Meta Tags ─────────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const instructor = await prisma.instructor.findFirst({
    where: { customDomain: params.slug },
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
  const instructor = await prisma.instructor.findFirst({
    where: { customDomain: params.slug },
  });

  if (!instructor) notFound();

  // Branding — colors apply for all tiers; logo/name white-labelling is PRO/BUSINESS only
  const isPro = instructor.subscriptionTier === 'PRO' || instructor.subscriptionTier === 'BUSINESS';
  const hasBranding = isPro && (instructor as any).showBrandingOnBookingPage;
  const brandLogo = hasBranding ? (instructor as any).brandLogo : null;
  // Colors apply regardless of tier — fall back to defaults if not set
  const primary = (instructor as any).brandColorPrimary || '#3B82F6';
  const secondary = (instructor as any).brandColorSecondary || '#10B981';

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

  const twoWeeksOut = new Date(now);
  twoWeeksOut.setDate(now.getDate() + 14);
  const upcomingBookings = await prisma.booking.findMany({
    where: {
      instructorId: instructor.id,
      status: { in: ['CONFIRMED', 'PENDING'] },
      startTime: { gte: now, lte: twoWeeksOut },
    },
    select: { startTime: true, endTime: true },
    orderBy: { startTime: 'asc' },
  });

  let nextAvailableLabel: string | null = null;
  for (let i = 0; i < 14 && !nextAvailableLabel; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const dayName = days[d.getDay()];
    const dayConfig = workingHours[dayName];
    if (!dayConfig?.enabled || !dayConfig?.start || !dayConfig?.end) continue;

    const [startH, startM] = dayConfig.start.split(':').map(Number);
    const [endH, endM] = dayConfig.end.split(':').map(Number);
    const dayStart = new Date(d);
    dayStart.setHours(startH, startM, 0, 0);
    const dayEnd = new Date(d);
    dayEnd.setHours(endH, endM, 0, 0);

    const slotStart = dayStart < now ? new Date(now.getTime() + 60 * 60 * 1000) : dayStart;
    let cursor = new Date(slotStart);
    cursor.setMinutes(0, 0, 0);
    while (cursor < dayEnd) {
      const slotEnd = new Date(cursor.getTime() + 60 * 60 * 1000);
      const blocked = upcomingBookings.some(b => {
        const bs = new Date(b.startTime!);
        const be = new Date(b.endTime!);
        return cursor < be && slotEnd > bs;
      });
      if (!blocked) {
        const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-AU', { weekday: 'long' });
        const timeStr = cursor.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
        nextAvailableLabel = `${label} at ${timeStr}`;
        break;
      }
      cursor = slotEnd;
    }
  }

  const activePackages = ((instructor.lessonPackages as any[]) || []).filter((p: any) => p.isActive !== false);
  const searchedLocation = searchParams.location || null;
  const languages = instructor.languages ? instructor.languages.split(',').map(l => l.trim()) : [];
  const vehicleTypes = instructor.vehicleTypes ? instructor.vehicleTypes.split(',').map(v => v.trim()) : [];

  const whatsapp = (instructor as any).whatsapp;
  const instagram = (instructor as any).instagram;
  const facebook = (instructor as any).facebook;
  const yearsExperience = (instructor as any).yearsExperience;

  // Trust badges — only show what we actually know is true
  const trustBadges = [
    instructor.isVerified && { icon: '✅', label: 'Verified Instructor' },
    yearsExperience && { icon: '🏆', label: `${yearsExperience}+ Years Experience` },
    instructor.totalReviews > 0 && {
      icon: '⭐',
      label: `${instructor.averageRating?.toFixed(1) || '5.0'} Rating (${instructor.totalReviews} reviews)`,
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
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`h-4 w-4 ${i < Math.round(instructor.averageRating || 5) ? 'fill-white text-white' : 'text-white/40'}`} />
                ))}
                <span className="ml-1 text-sm text-white/80">
                  {instructor.averageRating ? instructor.averageRating.toFixed(1) : '5.0'} · {instructor.totalReviews} reviews
                </span>
              </div>
              {instructor.serviceAreas && (
                <div className="flex items-center gap-1 mt-1 text-white/80 text-sm">
                  <MapPin className="h-3.5 w-3.5" />
                  {instructor.serviceAreas}
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
                    {nextAvailableLabel}
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
            {nextAvailableLabel && (
              <div className="rounded-xl p-4 border-2 flex items-center gap-3" style={{ backgroundColor: `${primary}10`, borderColor: `${primary}40` }}>
                <Calendar className="h-5 w-5 shrink-0" style={{ color: primary }} />
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Next Available</p>
                  <p className="font-semibold text-gray-900">{nextAvailableLabel}</p>
                </div>
              </div>
            )}

            {/* About */}
            {instructor.bio && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="font-semibold text-gray-900 mb-2">About</h2>
                <p className="text-sm text-gray-600 leading-relaxed">{instructor.bio}</p>
              </div>
            )}

            {/* Pricing */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-900 mb-3">Pricing</h2>
              <div className="space-y-2">
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-600">Single lesson</span>
                  <span className="font-bold text-lg" style={{ color: primary }}>${instructor.hourlyRate}/hr</span>
                </div>
                {activePackages.map((pkg: any) => (
                  <div key={pkg.id} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{pkg.name}</p>
                      {pkg.hours && <p className="text-xs text-gray-400">{pkg.hours} hours</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-bold" style={{ color: secondary }}>${pkg.price.toFixed(2)}</p>
                      {pkg.hours && (
                        <p className="text-xs text-green-600">
                          Save ${((instructor.hourlyRate * pkg.hours) - pkg.price).toFixed(0)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Details */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
              {vehicleTypes.length > 0 && (
                <div className="flex items-start gap-2">
                  <Car className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Vehicle types</p>
                    <div className="flex flex-wrap gap-1">
                      {vehicleTypes.map(v => (
                        <span key={v} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{v}</span>
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
                    <p className="text-sm text-gray-700">{languages.join(', ')}</p>
                  </div>
                </div>
              )}
              {instructor.bookingBufferMinutes && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400 shrink-0" />
                  <p className="text-sm text-gray-600">{instructor.bookingBufferMinutes} min buffer between lessons</p>
                </div>
              )}
              {instructor.isVerified && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                  <p className="text-sm text-gray-600">Verified instructor</p>
                </div>
              )}
              {instructor.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                  <a href={`tel:${instructor.phone}`} className="text-sm text-blue-600 hover:underline">{instructor.phone}</a>
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
                    <summary className="flex items-center justify-between py-3 cursor-pointer list-none text-sm font-medium text-gray-800 hover:text-gray-900 select-none">
                      {item.q}
                      <ChevronDown className="h-4 w-4 text-gray-400 shrink-0 ml-2 transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="pb-3 text-sm text-gray-600 leading-relaxed">{item.a}</p>
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
              <h2 className="text-xl font-bold text-gray-900 mb-1">Book a Lesson</h2>
              <p className="text-sm text-gray-500 mb-6">Choose your package and preferred time</p>
              <BulkBookingForm
                instructorId={instructor.id}
                instructorName={instructor.name}
                hourlyRate={instructor.hourlyRate}
                searchedLocation={searchedLocation}
                brandColorPrimary={primary}
                brandColorSecondary={secondary}
                lessonPackages={activePackages}
                serviceAreas={instructor.serviceAreas}
                baseAddress={instructor.baseAddress}
                serviceRadiusKm={instructor.serviceRadiusKm}
              />
            </div>

            {/* Reviews section */}
            {recentReviews.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Student Reviews</h2>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold text-gray-900">{instructor.averageRating?.toFixed(1) || '5.0'}</span>
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

      {/* Sticky mobile Book Now button */}
      <SubdomainClientFeatures primary={primary} />
    </div>
  );
}
