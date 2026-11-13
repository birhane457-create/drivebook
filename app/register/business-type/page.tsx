'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Car, ArrowRight, Building2 } from 'lucide-react'

// ── COMMENTED OUT until payment gateway is active ──────────────────────────
// Other trades (SaaS) path: plumber, electrician, beauty, tax
// To re-enable:
//   1. Restore OTHER_INDUSTRIES list and 'other-industry' step
//   2. Add back the "Other trades" card in the main step
//   3. Remove the redirect-to-driving shortcut below
//
// import { Wrench, Zap, Sparkles, Calculator, Grid3X3 } from 'lucide-react'
// const OTHER_INDUSTRIES = [
//   { id: 'plumber',     name: 'Plumbing Services',     icon: Wrench    },
//   { id: 'electrician', name: 'Electrical Services',    icon: Zap       },
//   { id: 'beauty',      name: 'Beauty & Personal Care', icon: Sparkles  },
//   { id: 'tax',         name: 'Tax & Accounting',       icon: Calculator},
// ]
// ───────────────────────────────────────────────────────────────────────────

export default function BusinessTypePage() {
  const router = useRouter()

  const handleDrivingSelect = () => {
    router.push('/register?businessType=driving')
  }

  return (
    <div className="light min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-100 border border-violet-300 mb-4">
            <Building2 className="w-7 h-7 text-violet-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-violet-600 via-pink-600 to-purple-600 bg-clip-text text-transparent mb-3">
            Register as a Driving Instructor
          </h1>
          <p className="text-sm text-gray-600">
            Join the DriveBook Marketplace and get discovered by students.
          </p>
        </div>

        {/* Driving instruction — only active option */}
        <div className="mb-8">
          <button
            onClick={handleDrivingSelect}
            className="w-full text-left p-6 rounded-2xl border-2 border-gray-200 bg-white hover:border-violet-400 hover:shadow-lg hover:shadow-violet-500/10 transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Car className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-gray-900">Driving instruction</h2>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-violet-600 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  For independent driving instructors and driving schools.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">Marketplace</span>
                </div>
              </div>
            </div>
          </button>

          {/* Other trades — commented out until payment gateway is active
          <button onClick={handleOtherSelect} ...>
            Other trades and services (SaaS)
          </button>
          */}
        </div>

        <p className="text-center text-xs text-gray-500">
          <Link href="/login" className="hover:text-gray-700">Already have an account? Log in</Link>
        </p>
      </div>
    </div>
  )
}
