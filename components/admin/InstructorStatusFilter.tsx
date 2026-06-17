'use client'

import { useRouter } from 'next/navigation'

interface InstructorStatusFilterProps {
  currentStatus: string
  pendingCount?: number
}

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
]

export default function InstructorStatusFilter({ currentStatus, pendingCount = 0 }: InstructorStatusFilterProps) {
  const router = useRouter()

  return (
    <div className="mb-6">
      {/* Mobile select */}
      <div className="sm:hidden">
        <select
          className="block w-full rounded-md border-slate-700 focus:border-blue-500 focus:ring-blue-500"
          value={currentStatus}
          onChange={(e) => router.push(`/admin/instructors?status=${e.target.value}`)}
        >
          {TABS.map(t => (
            <option key={t.value} value={t.value}>
              {t.label}{t.value === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Desktop tabs */}
      <div className="hidden sm:block">
        <nav className="flex space-x-2">
          {TABS.map((t) => (
            <a
              key={t.value}
              href={`/admin/instructors?status=${t.value}`}
              className={`relative px-4 py-2 font-medium text-sm rounded-lg transition-colors ${
                currentStatus === t.value
                  ? 'bg-blue-900/40 text-blue-300'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-slate-900'
              }`}
            >
              {t.label}
              {t.value === 'pending' && pendingCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold rounded-full bg-amber-500 text-white min-w-[1.25rem]">
                  {pendingCount}
                </span>
              )}
            </a>
          ))}
        </nav>
      </div>
    </div>
  )
}
