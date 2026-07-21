import type { Metadata } from 'next';
import Link from 'next/link';
import { AU_STATES } from '@/lib/data/au-locations';
import { prisma } from '@/lib/prisma';

export const revalidate = 3600;

const BASE_URL = process.env.NEXTAUTH_URL || 'https://drivebook.com.au';

export const metadata: Metadata = {
  title: 'Driving Lessons in Australia | DriveBook',
  description:
    'Find qualified driving instructors near you across Australia. Book online or by phone 24/7. Manual and automatic lessons available in WA, NSW, VIC, QLD and SA.',
  alternates: { canonical: `${BASE_URL}/driving-lessons` },
  openGraph: {
    title: 'Driving Lessons in Australia | DriveBook',
    description: 'Find qualified local driving instructors. Book online or by phone 24/7.',
    url: `${BASE_URL}/driving-lessons`,
    type: 'website',
  },
};

export default async function DrivingLessonsIndexPage() {
  // Count instructors per state for display
  const stateCounts = await (prisma.instructor as any).groupBy({
    by: ['state'],
    where: { approvalStatus: 'APPROVED', isActive: true, state: { not: null } },
    _count: { id: true },
  }).catch(() => []) as Array<{ state: string; _count: { id: number } }>;

  const countMap = new Map(stateCounts.map(r => [r.state, r._count.id]));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Driving Lessons by State — Australia',
    url: `${BASE_URL}/driving-lessons`,
    itemListElement: AU_STATES.map((state, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: `Driving Lessons in ${state.displayName}`,
      url: `${BASE_URL}/driving-lessons/${state.slug}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-white">
        <div className="bg-blue-700 text-white py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl font-bold mb-4">Driving Lessons in Australia</h1>
            <p className="text-blue-100 text-lg max-w-2xl">
              Find a verified, local driving instructor in your state. Book online or by phone 24/7.
              Manual and automatic lessons available.
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Choose your state</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {AU_STATES.map(state => {
              const count = countMap.get(state.code) ?? 0;
              return (
                <Link
                  key={state.slug}
                  href={`/driving-lessons/${state.slug}`}
                  className="group border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all"
                >
                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 mb-1">
                    {state.displayName}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {count > 0
                      ? `${count} instructor${count !== 1 ? 's' : ''} · ${state.suburbs.length} suburbs`
                      : 'Coming soon'}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
