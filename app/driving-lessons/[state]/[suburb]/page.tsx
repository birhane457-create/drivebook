import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { AU_STATES, getStateBySlug, getSuburbBySlug } from '@/lib/data/au-locations';
import { prisma } from '@/lib/prisma';

export const revalidate = 3600; // ISR: regenerate hourly
// Build-time optimization: only pre-generate the top suburbs (most searched).
// All other suburbs are generated on first request and cached by ISR.
// This reduces build time from ~45 min to ~3 min on Vercel.
export const dynamicParams = true;

const BASE_URL = process.env.NEXTAUTH_URL || 'https://drivebook.com.au';

// ── Static params ─────────────────────────────────────────────────────────────
// Pre-render only the first 50 most-visited suburbs at build time.
// Remaining 17,800+ are generated on-demand (ISR) and cached at the CDN edge.
export async function generateStaticParams() {
  const TOP_SUBURBS_PER_STATE = 5;
  return AU_STATES.flatMap(state =>
    state.suburbs.slice(0, TOP_SUBURBS_PER_STATE).map(suburb => ({
      state:  state.slug,
      suburb: suburb.slug,
    }))
  );
}

// ── Metadata ──────────────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: { state: string; suburb: string };
}): Promise<Metadata> {
  const stateData = getStateBySlug(params.state);
  if (!stateData) return { title: 'Not Found' };
  const suburbData = getSuburbBySlug(stateData, params.suburb);
  if (!suburbData) return { title: 'Not Found' };

  const title = `Driving Lessons in ${suburbData.displayName}, ${stateData.code} | DriveBook`;
  const description = `Book driving lessons in ${suburbData.displayName} with verified local instructors. Compare profiles, check live availability, and book online or call 24/7. Manual and automatic.`;

  return {
    title,
    description,
    alternates: {
      canonical: `${BASE_URL}/driving-lessons/${params.state}/${params.suburb}`,
    },
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/driving-lessons/${params.state}/${params.suburb}`,
      type: 'website',
    },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function SuburbDrivingLessonsPage({
  params,
}: {
  params: { state: string; suburb: string };
}) {
  const stateData = getStateBySlug(params.state);
  if (!stateData) notFound();
  const suburbData = getSuburbBySlug(stateData, params.suburb);
  if (!suburbData) notFound();

  // Fetch live instructors for this suburb.
  // Match on suburb field (exact, case-insensitive via Prisma contains) OR
  // serviceAreas text contains the suburb name.
  const now = new Date();
  const instructors = await prisma.instructor.findMany({
    where: {
      approvalStatus: 'APPROVED',
      isActive: true,
      state: stateData.code,
      AND: [
        {
          OR: [
            { suburb: { equals: suburbData.displayName, mode: 'insensitive' } },
            { serviceAreas: { contains: suburbData.displayName, mode: 'insensitive' } },
          ],
        },
        {
          OR: [
            { subscriptionStatus: 'ACTIVE' },
            { subscriptionStatus: 'TRIAL', trialEndsAt: { gt: now } },
          ],
        },
      ],
    } as any,
    select: {
      id: true,
      name: true,
      bio: true,
      profileImage: true,
      hourlyRate: true,
      averageRating: true,
      totalReviews: true,
      vehicleTypes: true,
      languages: true,
      serviceAreas: true,
      customSlug: true,
    },
    orderBy: [
      { averageRating: 'desc' },
      { totalReviews: 'desc' },
    ],
    take: 20,
  }).catch(() => []);

  // Also fetch nearby instructors (same state, no suburb match) as fallback
  const hasLocal = instructors.length > 0;
  const nearby = hasLocal ? [] : await prisma.instructor.findMany({
    where: {
      approvalStatus: 'APPROVED',
      isActive: true,
      state: stateData.code,
      OR: [
        { subscriptionStatus: 'ACTIVE' },
        { subscriptionStatus: 'TRIAL', trialEndsAt: { gt: now } },
      ],
    },
    select: {
      id: true, name: true, bio: true, profileImage: true,
      hourlyRate: true, averageRating: true, totalReviews: true,
      vehicleTypes: true, serviceAreas: true, customSlug: true,
    },
    orderBy: [{ averageRating: 'desc' }, { totalReviews: 'desc' }],
    take: 6,
  }).catch(() => []);

  const displayInstructors = hasLocal ? instructors : nearby;

  // JSON-LD
  const jsonLd: object[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
        { '@type': 'ListItem', position: 2, name: 'Driving Lessons', item: `${BASE_URL}/driving-lessons` },
        { '@type': 'ListItem', position: 3, name: stateData.displayName, item: `${BASE_URL}/driving-lessons/${params.state}` },
        { '@type': 'ListItem', position: 4, name: suburbData.displayName, item: `${BASE_URL}/driving-lessons/${params.state}/${params.suburb}` },
      ],
    },
  ];

  if (displayInstructors.length > 0) {
    jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `Driving Instructors in ${suburbData.displayName}`,
      url: `${BASE_URL}/driving-lessons/${params.state}/${params.suburb}`,
      numberOfItems: displayInstructors.length,
      itemListElement: displayInstructors.map((inst, i) => {
        const slug = inst.customSlug || inst.id;
        return {
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'LocalBusiness',
            name: inst.name,
            url: `https://${slug}.drivebook.com.au`,
            image: inst.profileImage ?? undefined,
            description: inst.bio?.slice(0, 160) ?? undefined,
            priceRange: `From $${inst.hourlyRate}/hr`,
            address: {
              '@type': 'PostalAddress',
              addressLocality: suburbData.displayName,
              addressRegion: stateData.code,
              postalCode: suburbData.postcode,
              addressCountry: 'AU',
            },
            ...(inst.totalReviews > 0 && {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: inst.averageRating,
                reviewCount: inst.totalReviews,
              },
            }),
          },
        };
      }),
    });
  }

  return (
    <>
      {jsonLd.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}

      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="bg-blue-700 text-white py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <nav className="text-blue-200 text-sm mb-4 flex flex-wrap gap-1 items-center">
              <Link href="/" className="hover:text-white">Home</Link>
              <span>›</span>
              <Link href={`/driving-lessons/${params.state}`} className="hover:text-white">
                {stateData.displayName}
              </Link>
              <span>›</span>
              <span className="text-white">{suburbData.displayName}</span>
            </nav>
            <h1 className="text-4xl font-bold mb-4">
              Driving Lessons in {suburbData.displayName}
            </h1>
            <p className="text-blue-100 text-lg max-w-2xl">
              {displayInstructors.length > 0
                ? `${displayInstructors.length} qualified driving instructor${displayInstructors.length !== 1 ? 's' : ''} ${hasLocal ? `in ${suburbData.displayName}` : `across ${stateData.displayName}`}.`
                : `Driving lessons in ${suburbData.displayName}, ${stateData.code}.`}
              {' '}Book online or call 24/7. Manual and automatic available.
            </p>
            <div className="mt-6">
              <Link
                href={`/book?location=${encodeURIComponent(suburbData.displayName)}`}
                className="bg-white text-blue-700 font-semibold px-6 py-3 rounded-lg hover:bg-blue-50 transition-colors inline-block"
              >
                See All Instructors →
              </Link>
            </div>
          </div>
        </div>

        {/* Instructor cards */}
        <div className="max-w-4xl mx-auto px-4 py-12">
          {!hasLocal && displayInstructors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
              No instructors listed specifically in {suburbData.displayName} yet — showing nearby instructors in {stateData.displayName}.
            </div>
          )}

          {displayInstructors.length > 0 ? (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                {hasLocal
                  ? `Instructors in ${suburbData.displayName}`
                  : `Instructors near ${suburbData.displayName}`}
              </h2>
              <div className="space-y-4">
                {displayInstructors.map(inst => {
                  const slug = inst.customSlug || inst.id;
                  const transmissions = inst.vehicleTypes
                    ? inst.vehicleTypes.replace('AUTO', 'Automatic').replace('MANUAL', 'Manual')
                    : 'Manual & Automatic';

                  return (
                    <Link
                      key={inst.id}
                      href={`https://${slug}.drivebook.com.au`}
                      className="flex gap-4 border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all"
                    >
                      {inst.profileImage ? (
                        <Image
                          src={inst.profileImage}
                          alt={inst.name}
                          width={72}
                          height={72}
                          className="rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-[72px] h-[72px] rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xl font-bold shrink-0">
                          {inst.name[0]}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{inst.name}</h3>
                          {inst.averageRating && inst.totalReviews > 0 && (
                            <span className="text-sm text-amber-600 font-medium">
                              ★ {inst.averageRating.toFixed(1)} ({inst.totalReviews})
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-blue-700 font-medium mb-1">
                          From ${inst.hourlyRate}/hr · {transmissions}
                        </p>
                        {inst.bio && (
                          <p className="text-sm text-gray-500 line-clamp-2">{inst.bio}</p>
                        )}
                      </div>
                      <div className="shrink-0 ml-auto self-center">
                        <span className="text-blue-600 text-sm font-medium whitespace-nowrap">Book →</span>
                      </div>
                    </Link>
                  );
                })}
              </div>

              <div className="mt-8 text-center">
                <Link
                  href={`/book?location=${encodeURIComponent(suburbData.displayName)}`}
                  className="bg-blue-600 text-white font-semibold px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors inline-block"
                >
                  Search all instructors near {suburbData.displayName}
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center py-16">
              <p className="text-xl text-gray-600 mb-2">
                No instructors listed in {suburbData.displayName} yet.
              </p>
              <p className="text-gray-400 text-sm mb-6">
                We're expanding — new instructors sign up every week.
              </p>
              <Link
                href="/book"
                className="bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors inline-block"
              >
                Search all of {stateData.displayName}
              </Link>
            </div>
          )}
        </div>

        {/* FAQ — location-specific, good for long-tail search */}
        <div className="border-t border-gray-100 bg-gray-50 py-12 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              Frequently asked questions — driving lessons in {suburbData.displayName}
            </h2>
            <div className="space-y-5">
              {[
                {
                  q: `How much do driving lessons cost in ${suburbData.displayName}?`,
                  a: `Driving lessons in ${suburbData.displayName} typically range from $65–$95 per hour depending on the instructor and vehicle type. DriveBook instructors set their own hourly rates, which are displayed on their profile. Package bookings (6, 10, or 15 hours) include a discount.`,
                },
                {
                  q: `How do I book a driving lesson in ${suburbData.displayName}?`,
                  a: `You can book online via the instructor's DriveBook profile, or call 24/7 and our AI receptionist will check live availability and confirm your booking instantly by SMS.`,
                },
                {
                  q: `Are DriveBook instructors in ${suburbData.displayName} licensed?`,
                  a: `Yes. All instructors on DriveBook are verified — they must hold a current driver training licence and provide background check documents before being listed.`,
                },
                {
                  q: `Can I get automatic driving lessons in ${suburbData.displayName}?`,
                  a: `Yes. Most DriveBook instructors in ${stateData.displayName} offer both automatic and manual lessons. Filter by transmission type when searching.`,
                },
              ].map(faq => (
                <details key={faq.q} className="bg-white border border-gray-200 rounded-xl p-4">
                  <summary className="font-medium text-gray-900 cursor-pointer">{faq.q}</summary>
                  <p className="mt-3 text-sm text-gray-600">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
