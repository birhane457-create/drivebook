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
    include: {
      serviceAreas: {
        where: { isActive: true }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="flex items-center">
              <Car className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
              <span className="ml-2 text-lg sm:text-xl font-bold text-gray-900">DriveBook</span>
            </Link>
            <div className="flex gap-2 sm:gap-4">
              <Link href="/login" className="text-gray-700 hover:text-blue-600 text-sm sm:text-base">
                Login
              </Link>
              <Link href="/register" className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 text-sm sm:text-base">
                Become Instructor
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">Find Your Driving Instructor</h1>
          <p className="text-lg text-gray-600">Choose from our qualified instructors and book your lesson today</p>
        </div>

        {instructors.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No instructors available at the moment.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {instructors.map((instructor) => (
              <InstructorCard key={instructor.id} instructor={instructor} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
