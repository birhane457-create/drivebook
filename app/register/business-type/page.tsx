'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Car, Wrench, Zap, Sparkles, Calculator,
  ArrowRight, Check, ChevronLeft, Building2, Grid3X3
} from 'lucide-react'

// ── Industry sub-options for "Other trades and services" ───────────────────
// These map directly to the businessType enum values accepted by the API:
// z.enum(['driving', 'plumber', 'electrician', 'beauty', 'tax'])
const OTHER_INDUSTRIES = [
  {
    id: 'plumber',
    name: 'Plumbing Services',
    icon: Wrench,
    description: 'Residential and commercial plumbing',
  },
  {
    id: 'electrician',
    name: 'Electrical Services',
    icon: Zap,
    description: 'Licensed electrical installation and repair',
  },
  {
    id: 'beauty',
    name: 'Beauty & Personal Care',
    icon: Sparkles,
    description: 'Beauty treatments, spa, and wellness services',
  },
  {
    id: 'tax',
    name: 'Tax & Accounting',
    icon: Calculator,
    description: 'Tax preparation and accounting services',
  },
]

type Step = 'main' | 'other-industry'

export default function BusinessTypePage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('main')
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null)

  const handleDrivingSelect = () => {
    // Driving instructors proceed to registration with businessType=driving;
    // the registration form will then ask for MARKETPLACE or SAAS model
    router.push('/register?businessType=driving')
  }

  const handleOtherSelect = () => {
    // Show the industry sub-selection for other trades
    setStep('other-industry')
  }

  const handleIndustryContinue = () => {
    if (selectedIndustry) {
      // Non-driving providers are always SAAS — no model selection needed
      router.push(`/register?businessType=${selectedIndustry}`)
    }
  }

  // ── Industry sub-selection step ─────────────────────────────────────────
  if (step === 'other-industry') {
    return (
      <div className="light min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">

          {/* Back button */}
          <button
            onClick={() => setStep('main')}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors mb-8"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-100 border border-blue-300 mb-4">
              <Grid3X3 className="w-7 h-7 text-blue-600" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-3">
              What is your trade or service?
            </h1>
            <p className="text-sm text-gray-600">
              Select the category that best describes your business.
            </p>
          </div>

          {/* Industry options */}
          <div className="space-y-3 mb-8">
            {OTHER_INDUSTRIES.map(industry => {
              const Icon = industry.icon
              const isSelected = selectedIndustry === industry.id
              return (
                <button
                  key={industry.id}
                  onClick={() => setSelectedIndustry(industry.id)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-blue-500' : 'bg-gray-100'
                  }`}>
                    <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-gray-600'}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{industry.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{industry.description}</p>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-blue-500 shrink-0" />}
                </button>
              )
            })}
          </div>

          {/* SaaS note */}
          <div className="mb-8 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-xs text-amber-800">
              <strong>Note:</strong> Trade and service businesses use DriveBook SaaS. You bring your own customers and use DriveBook to manage bookings and your business. Online payments are not yet available for SaaS providers.
            </p>
          </div>

          <button
            onClick={handleIndustryContinue}
            disabled={!selectedIndustry}
            className={`w-full group flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-white transition-all ${
              selectedIndustry
                ? 'bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-400 hover:to-cyan-500 shadow-xl shadow-blue-500/30'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Continue to Registration
            <ArrowRight className={`w-5 h-5 transition-transform ${selectedIndustry ? 'group-hover:translate-x-1' : ''}`} />
          </button>

          <p className="text-center text-xs text-gray-500 mt-6">
            <Link href="/login" className="hover:text-gray-700">Already have an account? Log in</Link>
          </p>
        </div>
      </div>
    )
  }

  // ── Main selection step ─────────────────────────────────────────────────
  return (
    <div className="light min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-100 border border-violet-300 mb-4">
            <Building2 className="w-7 h-7 text-violet-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-violet-600 via-pink-600 to-purple-600 bg-clip-text text-transparent mb-3">
            What type of business are you registering?
          </h1>
          <p className="text-sm text-gray-600">
            Choose the category that describes your business.
          </p>
        </div>

        {/* Two main choices */}
        <div className="space-y-4 mb-8">

          {/* Driving instruction */}
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
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">SaaS</span>
                </div>
              </div>
            </div>
          </button>

          {/* Other trades and services */}
          <button
            onClick={handleOtherSelect}
            className="w-full text-left p-6 rounded-2xl border-2 border-gray-200 bg-white hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/10 transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Grid3X3 className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-gray-900">Other trades and services</h2>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Plumbers, electricians, beauty professionals, tax professionals and other service businesses.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">SaaS only</span>
                </div>
              </div>
            </div>
          </button>
        </div>

        <p className="text-center text-xs text-gray-500">
          <Link href="/login" className="hover:text-gray-700">Already have an account? Log in</Link>
        </p>
      </div>
    </div>
  )
}
