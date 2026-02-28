'use client'

import { useRouter } from 'next/navigation'

interface InstructorStatusFilterProps {
  currentStatus: string
}

export default function InstructorStatusFilter({ currentStatus }: InstructorStatusFilterProps) {
  const router = useRouter()

  return (
    <div className="mb-6">
      <div className="sm:hidden">
        <select
          className="block w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
          value={currentStatus}
          onChange={(e) => router.push(`/admin/instructors?status=${e.target.value}`)}
        >
          <option value="all">All Instructors</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>
      <div className="hidden sm:block">
        <nav className="flex space-x-4">
          {['all', 'pending', 'approved', 'rejected', 'suspended'].map((s) => (
            <a
              key={s}
              href={`/admin/instructors?status=${s}`}
              className={`px-3 py-2 font-medium text-sm rounded-md ${
                currentStatus === s
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </a>
          ))}
        </nav>
      </div>
    </div>
  )
}
