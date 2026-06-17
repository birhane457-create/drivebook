import Link from 'next/link'
import { Car } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import InstructorCard from '@/components/InstructorCard'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const revalidate = 0

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

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <nav className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="flex items-center gap-2 no-underline">
              <Car className="h-6 w-6 text-blue-400" />
              <span className="text-lg font-bold bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">DriveBook</span>
            </Link>
            <div className="flex gap-3">
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
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-white">Find Your Driving Instructor</h1>
          <p className="text-lg text-white/60">Choose from our qualified instructors and book your lesson today</p>
        </div>

        {instructors.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-white/50">No instructors available at the moment.</p>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  )
}
