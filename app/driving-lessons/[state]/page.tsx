import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AU_STATES, getStateBySlug } from '@/lib/data/au-locations';
import { prisma } from '@/lib/prisma';

export const revalidate = 3600; // ISR: regenerate hourly

const BASE_URL = process.env.NEXTAUTH_URL || 'https://drivebook.com.au';

// ── Static params ─────────────────────────────────────────────────────────────
export async function generateStaticParams() {
  return AU_STATES.map(s => ({ state: s.slug }));
}

// ── Metadata ──────────────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: { state: string };
}): Promise<Metadata> {
  const stateData = getStateBySlug(params.state);
  if (!stateData) return { title: 'Not Found' };

  const title = `Driving Lessons in ${stateData.displayName} | DriveBook`;
  const description = `Find qualified driving instructors in ${stateData.displayName}. Compare profiles, check availability, and book lessons online or by phone 24/7. Manual and automatic available.`;

  return {
    title,
    description,
    alternates: { canonical: `${BASE_URL}/driving-lessons/${params.state}` },
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/driving-lessons/${params.state}`,
      type: 'website',
    },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function StateDrivingLessonsPage({
  params,
}: {
  params: { state: string };
}) {
  const stateData = getStateBySlug(params.state);
  if (!stateData) notFound();

  // Count live instructors per suburb for this state
  const instructorCounts = await prisma.instructor.groupBy({
    by: ['suburb'],
    where: {
      state: stateData.code,
      approvalStatus: 'APPROVED',
      isActive: true,
      suburb: { not: null },
    },
    _count: { id: true },
  }).catch(() => []);

  const countMap = new Map<string, number>(
    instructorCounts.map(r => [r.suburb!.toLowerCase(), r._count.id])
  );

  // Total instructors in this state
  const totalInstructors = instructorCounts.reduce((sum, r) => sum + r._count.id, 0);

  // Suburbs in our list that have at least one instructor, sorted by count desc
  const suburbsWithInstructors = stateData.suburbs
    .map(s => ({
      ...s,
      count: countMap.get(s.displayName.toLowerCase()) ?? 0,
    }))
    .sort((a, b) => b.count - a.count);

  const hasSuburbs = suburbsWithInstructors.some(s => s.count > 0);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Driving Instructors in ${stateData.displayName}`,
    description: `Qualified driving instructors servicing ${stateData.displayName}`,
    url: `${BASE_URL}/driving-lessons/${params.state}`,
    numberOfItems: suburbsWithInstructors.filter(s => s.count > 0).length,
    itemListElement: suburbsWithInstructors
      .filter(s => s.count > 0)
      .slice(0, 20)
      .map((s, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: `Driving Lessons in ${s.displayName}`,
        url: `${BASE_URL}/driving-lessons/${params.state}/${s.slug}`,
      })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="bg-blue-700 text-white py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <nav className="text-blue-200 text-sm mb-4">
              <Link href="/" className="hover:text-white">Home</Link>
              {' › '}
              <span>Driving Lessons</span>
              {' › '}
              <span className="text-white">{stateData.displayName}</span>
            </nav>
            <h1 className="text-4xl font-bold mb-4">
              Driving Lessons in {stateData.displayName}
            </h1>
            <p className="text-blue-100 text-lg max-w-2xl">
              {totalInstructors > 0
                ? `${totalInstructors} qualified driving instructor${totalInstructors !== 1 ? 's' : ''} available across ${stateData.displayName}.`
                : `Find qualified driving instructors across ${stateData.displayName}.`}
              {' '}Book online or call 24/7. Manual and automatic available.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/book`}
                className="bg-white text-blue-700 font-semibold px-6 py-3 rounded-lg hover:bg-blue-50 transition-colors"
              >
                Find an Instructor →
              </Link>
            </div>
          </div>
        </div>

        {/* Suburb grid */}
        <div className="max-w-4xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Suburbs we service in {stateData.displayName}
          </h2>
          <p className="text-gray-500 mb-8">
            Select a suburb to see available instructors and book your first lesson.
          </p>

          {hasSuburbs ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {suburbsWithInstructors.map(suburb => (
                <Link
                  key={suburb.slug}
                  href={`/driving-lessons/${params.state}/${suburb.slug}`}
                  className={`group border rounded-xl px-4 py-3 transition-colors text-sm font-medium ${
                    suburb.count > 0
                      ? 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100'
                      : 'border-gray-200 bg-gray-50 text-gray-400 cursor-default pointer-events-none'
                  }`}
                >
                  <span className="block">{suburb.displayName}</span>
                  {suburb.count > 0 && (
                    <span className="text-xs text-blue-500 font-normal">
                      {suburb.count} instructor{suburb.count !== 1 ? 's' : ''}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">Instructors coming soon to {stateData.displayName}.</p>
              <p className="text-sm mt-2">
                Currently serving Western Australia.{' '}
                <Link href="/book" className="text-blue-600 hover:underline">
                  Search all instructors →
                </Link>
              </p>
            </div>
          )}
        </div>

        {/* Trust signals */}
        <div className="border-t border-gray-100 bg-gray-50 py-12 px-4">
          <div className="max-w-4xl mx-auto grid sm:grid-cols-3 gap-6 text-center">
            {[
              { icon: '✅', title: 'Verified instructors', desc: 'All instructors are licensed and background-checked.' },
              { icon: '📅', title: 'Book online or by phone', desc: 'Our AI receptionist answers calls 24/7 and books your lesson instantly.' },
              { icon: '💳', title: 'Flexible packages', desc: '6, 10, or 15-hour lesson packages with discounts included.' },
            ].map(item => (
              <div key={item.title}>
                <div className="text-3xl mb-2">{item.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
