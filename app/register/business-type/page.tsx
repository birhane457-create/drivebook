'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Car, 
  Wrench, 
  Zap, 
  Sparkles, 
  Calculator,
  ArrowRight,
  Check,
  Building2
} from 'lucide-react'

interface BusinessType {
  id: string
  name: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  features: string[]
  color: string
  gradient: string
}

const businessTypes: BusinessType[] = [
  {
    id: 'driving',
    name: 'Driving School',
    icon: Car,
    description: 'Driving instruction and learner driver services',
    features: [
      'Student booking management',
      'Lesson scheduling & payments',
      'Progress tracking & assessments',
      'Test preparation packages',
    ],
    color: 'violet',
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    id: 'plumber',
    name: 'Plumbing Services',
    icon: Wrench,
    description: 'Residential and commercial plumbing',
    features: [
      'Quote-based job requests',
      'Emergency call-out support',
      'Job tracking & invoicing',
      'Customer communication',
    ],
    color: 'blue',
    gradient: 'from-blue-500 to-cyan-600',
  },
  {
    id: 'electrician',
    name: 'Electrical Services',
    icon: Zap,
    description: 'Licensed electrical installation and repair',
    features: [
      'Job request management',
      'Quote & invoice system',
      'Safety compliance tracking',
      'Customer notifications',
    ],
    color: 'amber',
    gradient: 'from-amber-500 to-orange-600',
  },
  {
    id: 'beauty',
    name: 'Beauty & Wellness',
    icon: Sparkles,
    description: 'Beauty treatments, spa, and wellness services',
    features: [
      'Appointment scheduling',
      'Service menu management',
      'Customer profiles',
      'Package deals & memberships',
    ],
    color: 'pink',
    gradient: 'from-pink-500 to-rose-600',
  },
  {
    id: 'tax',
    name: 'Tax & Accounting',
    icon: Calculator,
    description: 'Tax preparation and accounting services',
    features: [
      'Client appointment booking',
      'Document collection',
      'Consultation scheduling',
      'Secure client portal',
    ],
    color: 'emerald',
    gradient: 'from-emerald-500 to-teal-600',
  },
]

export default function BusinessTypePage() {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)

  const handleContinue = () => {
    if (selected) {
      router.push(`/register?businessType=${selected}`)
    }
  }

  return (
    <div className="light min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-100 border border-violet-300 mb-6">
            <Building2 className="w-8 h-8 text-violet-600" />
          </div>
          
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-violet-600 via-pink-600 to-purple-600 bg-clip-text text-transparent mb-4">
            What type of business are you?
          </h1>
          
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Choose your industry to get started. We'll customize your experience with the right features for your business.
          </p>
        </div>

        {/* Business Type Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {businessTypes.map((type) => {
            const Icon = type.icon
            const isSelected = selected === type.id
            
            return (
              <button
                key={type.id}
                onClick={() => setSelected(type.id)}
                className={`
                  relative group text-left p-6 rounded-2xl border-2 transition-all duration-300
                  ${isSelected 
                    ? `border-${type.color}-500 bg-${type.color}-50 shadow-xl shadow-${type.color}-500/20` 
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                  }
                `}
              >
                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute top-4 right-4">
                    <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${type.gradient} flex items-center justify-center`}>
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}

                  <div className={`
                  inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4
                  bg-gradient-to-br ${type.gradient} group-hover:scale-105 transition-transform
                `}>
                  <Icon className="w-7 h-7 text-white" />
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {type.name}
                </h3>

                {/* Description */}
                <p className="text-sm text-gray-600 mb-4">
                  {type.description}
                </p>

                {/* Features */}
                <ul className="space-y-2">
                  {type.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-gray-600">
                      <Check className={`w-4 h-4 shrink-0 mt-0.5 text-${type.color}-500`} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login"
            className="text-gray-600 hover:text-gray-700 transition-colors text-sm"
          >
            Already have an account? Log in
          </Link>

          <button
            onClick={handleContinue}
            disabled={!selected}
            className={`
              group flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-white transition-all
              ${selected
                ? 'bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 shadow-xl shadow-violet-500/30 hover:shadow-violet-500/50'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            Continue to Registration
            <ArrowRight className={`w-5 h-5 transition-transform ${selected ? 'group-hover:translate-x-1' : ''}`} />
          </button>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-500 mt-8">
          Not sure which to choose? You can contact support after registration to change your business type.
        </p>
      </div>
    </div>
  )
}
