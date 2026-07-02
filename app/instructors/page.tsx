import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import InstructorCard from '@/components/InstructorCard'
import Logo from '@/components/Logo'

const BASE_URL = process.env.NEXTAUTH_URL || 'https://drivebook.com.au'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Find a Driving Instructor Near You | DriveBook',
  description:
    'Browse verified, approved driving instructors across Australia. See rates, vehicle types, and reviews — then book your lesson instantly online.',
  openGraph: {
    title: 'Find a Driving Instructor Near You | DriveBook',
    description: 'Verified local driving instructors. Book online instantly. Manual & automatic available.',
    url: `${BASE_URL}/instructors`,
  },
  alternates: { canonical: `${BASE_URL}/instructors` },
}

export default async function InstructorsPage() {
  const instructors = await prisma.instructor.findMany({
    where: {
      isActive: true,
      approvalStatus: 'APPROVED'
    },
    orderBy: {
      id: 'desc'
    }
  })

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Find an Instructor', item: `${BASE_URL}/instructors` },
    ],
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      {/* Header */}
      <nav className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="no-underline"><Logo size={32} dark /></Link>
            <div className="flex items-center gap-2">
              <Link href="/learn-to-drive" className="text-white/70 hover:text-white text-sm font-medium no-underline px-3 py-2 rounded-lg hover:bg-white/10 transition-colors hidden md:block">
                Learn to Drive
              </Link>
              <Link href="/login" className="text-white/70 hover:text-white text-sm font-medium no-underline px-3 py-2 rounded-lg hover:bg-white/10 transition-colors">
                Login
              </Link>
              <Link href="/register" className="bg-gradient-to-r from-pink-500 to-violet-500 text-white px-4 py-2 rounded-xl font-bold text-sm hover:from-pink-400 hover:to-violet-400 transition-all no-underline">
                Become Instructor
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-white/40 mb-8">
          <Link href="/" className="hover:text-white no-underline transition-colors">Home</Link>
          <span>/</span>
          <span className="text-white/60">Find an Instructor</span>
        </nav>

        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-violet-400 uppercase tracking-wider mb-3">Verified Instructors</p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-white">Find Your Driving Instructor</h1>
          <p className="text-lg text-white/60 max-w-xl mx-auto">
            All instructors on DriveBook are verified, approved, and background-checked. Book your lesson instantly online.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            <Link href="/book" className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm no-underline transition-all hover:scale-105 shadow-lg shadow-violet-500/20">
              Search by Location →
            </Link>
            <Link href="/learn-to-drive" className="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-xl font-semibold text-sm no-underline transition-all border border-white/10">
              Learner Driver Guide →
            </Link>
          </div>
        </div>

        {instructors.length === 0 ? (
          <div className="text-center py-16 rounded-2xl bg-white/[0.03] border border-white/10">
            <p className="text-white/50 mb-4">No instructors listed yet.</p>
            <Link href="/book" className="text-violet-400 hover:text-violet-300 no-underline text-sm font-semibold">
              Search for instructors near you →
            </Link>
          </div>
        ) : (
          <>
            <p className="text-white/40 text-sm mb-6">{instructors.length} instructor{instructors.length !== 1 ? 's' : ''} available</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {instructors.map((instructor) => (
                <InstructorCard
                  key={instructor.id}
                  instructor={{
                    ...instructor,
                    vehicleTypes: instructor.vehicleTypes
                      ? instructor.vehicleTypes.split(',').map(v => v.trim()).filter(Boolean)
                      : ['Manual', 'Automatic'],
                    serviceRadiusKm: instructor.serviceRadiusKm ?? undefined,
                    averageRating: instructor.averageRating ?? undefined,
                  }}
                />
              ))}
            </div>
          </>
        )}

        {/* Bottom CTA */}
        <div className="mt-16 rounded-2xl bg-gradient-to-r from-violet-900/40 to-indigo-900/40 border border-violet-500/20 p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Looking for instructors in your suburb?</h2>
          <p className="text-white/60 text-sm mb-5">Use location search to find verified instructors near you with real-time availability.</p>
          <Link href="/book" className="inline-block bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-8 py-3 rounded-xl font-bold no-underline transition-all hover:scale-105 shadow-lg shadow-violet-500/20 text-sm">
            Search by Location →
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 py-10 mt-12 text-center text-white/40 text-sm">
        <p>
          © {new Date().getFullYear()} DriveBook ·{' '}
          <Link href="/privacy" className="hover:text-white/60 no-underline transition-colors">Privacy</Link> ·{' '}
          <Link href="/terms" className="hover:text-white/60 no-underline transition-colors">Terms</Link> ·{' '}
          <Link href="/learn-to-drive" className="hover:text-white/60 no-underline transition-colors">Learn to Drive</Link>
        </p>
      </footer>
    </div>
  )
}

