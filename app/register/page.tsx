'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { UserPlus, Loader2, CheckCircle, Car, Wrench, Zap, Sparkles, Calculator } from 'lucide-react'
import { SAAS_TERMS_PUBLISHED, SAAS_TERMS_URL } from '@/lib/config/registration-constants'

// Business type configuration
const businessTypeConfig: Record<string, {
  name: string
  icon: React.ComponentType<{ className?: string }>
  onboardingSteps: string[]
  legalDisclaimer: string
}> = {
  driving: {
    name: 'Driving Instructor',
    icon: Car,
    onboardingSteps: [
      'Set your suburb, rate & availability in your dashboard',
      'Upload your licence, insurance & certifications',
      'Go live once admin approves your documents',
    ],
    legalDisclaimer: 'By registering, you confirm you hold a valid driving instructor accreditation and current insurance.',
  },
  plumber: {
    name: 'Plumber',
    icon: Wrench,
    onboardingSteps: [
      'Complete your business profile and service areas',
      'Upload your licence and insurance documents',
      'Set your service rates and availability',
    ],
    legalDisclaimer: 'By registering, you confirm you hold a valid plumbing licence and current public liability insurance.',
  },
  electrician: {
    name: 'Electrician',
    icon: Zap,
    onboardingSteps: [
      'Complete your business profile and service areas',
      'Upload your electrical licence and insurance',
      'Set your rates and service offerings',
    ],
    legalDisclaimer: 'By registering, you confirm you hold a valid electrical licence and current public liability insurance.',
  },
  beauty: {
    name: 'Beauty Professional',
    icon: Sparkles,
    onboardingSteps: [
      'Set up your service menu and pricing',
      'Configure your booking availability',
      'Upload any required certifications',
    ],
    legalDisclaimer: 'By registering, you confirm you hold any required certifications for your services and current insurance.',
  },
  tax: {
    name: 'Tax Professional',
    icon: Calculator,
    onboardingSteps: [
      'Complete your professional profile',
      'Set your consultation availability',
      'Upload your registration and credentials',
    ],
    legalDisclaimer: 'By registering, you confirm you are a registered tax agent or BAS agent with current professional indemnity insurance.',
  },
}

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  // SaaS Terms — kept for when SaaS path is re-enabled
  const [saasTermsAccepted, setSaasTermsAccepted] = useState(false)
  void saasTermsAccepted; void setSaasTermsAccepted

  // Business model — pre-set to MARKETPLACE; SaaS disabled until payment gateway active
  // TODO: restore setter call in SaaS button when re-enabling
  const [selectedModel, setSelectedModel] = useState<'MARKETPLACE' | 'SAAS' | null>('MARKETPLACE')
  void setSelectedModel

  // Organisation type — driving instructors only, always INDIVIDUAL_INSTRUCTOR for now
  const [selectedOrgType, setSelectedOrgType] = useState<'INDIVIDUAL_INSTRUCTOR'>('INDIVIDUAL_INSTRUCTOR')

  // Business structure — for non-driving providers only (path disabled until payment gate)
  const [selectedStructure, setSelectedStructure] = useState<'SOLE_TRADER' | 'REGISTERED_BUSINESS'>('SOLE_TRADER')
  void selectedStructure; void setSelectedStructure

  // Get business type from URL params, default to driving
  const businessType = searchParams.get('businessType') || 'driving'
  const config = businessTypeConfig[businessType] || businessTypeConfig.driving
  const Icon = config.icon
  const isDriving = businessType === 'driving'

  // Redirect to business type selection if no type specified
  useEffect(() => {
    if (!searchParams.get('businessType')) {
      router.push('/register/business-type')
    }
  }, [searchParams, router])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    // Privacy is always required. Terms are only required for marketplace providers.
    if (!privacyAccepted) {
      setError('Please accept the Privacy Policy to continue.')
      return
    }
    if (isDriving && selectedModel === 'MARKETPLACE' && !termsAccepted) {
      setError('Please accept the Instructor Terms & Conditions to continue.')
      return
    }

    setLoading(true)
    const formData = new FormData(e.currentTarget)

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:          formData.get('name'),
          email:         formData.get('email'),
          password:      formData.get('password'),
          phone:         formData.get('phone'),
          businessType:  businessType,
          // Only send businessModel for driving instructors; the API defaults
          // omitted values to MARKETPLACE. For non-driving, the API forces SAAS
          // regardless of what is sent here.
          ...(isDriving && selectedModel ? { businessModel: selectedModel } : {}),
          // organisationType — driving instructors always INDIVIDUAL_INSTRUCTOR;
          // non-driving providers send SOLE_TRADER or REGISTERED_BUSINESS.
          ...(isDriving
            ? { organisationType: selectedOrgType }
            : selectedStructure ? { organisationType: selectedStructure } : {}),
          // Privacy policy acceptance — required. The API validates this as literal true.
          privacyAccepted: true as const,
          // termsAccepted — only sent for Marketplace providers who ticked the checkbox.
          // SaaS providers: do not send this field.
          ...(isDriving && selectedModel === 'MARKETPLACE' && termsAccepted
            ? { termsAccepted: true as const }
            : {}),
          // saasTermsAccepted — only sent when SaaS Terms are published AND the
          // provider is on the SaaS path (driving+SaaS or non-driving).
          // While terms are unpublished, this field is never sent.
          ...(SAAS_TERMS_PUBLISHED && (isDriving ? selectedModel === 'SAAS' : true) && saasTermsAccepted
            ? { saasTermsAccepted: true as const }
            : {}),
        }),
      })

      if (response.ok) {
        router.push('/login?registered=1')
      } else {
        const data = await response.json()
        setError(data.error || 'Registration failed — please try again.')
      }
    } catch {
      setError('Something went wrong — please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = [
    'w-full px-4 py-3 rounded-xl text-sm',
    'bg-white border border-gray-200 text-gray-900 placeholder-gray-400',
    'focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20',
    'transition-all',
  ].join(' ')

  return (
    <div className="light min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center py-10 px-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-100 border border-violet-300 mb-4">
            <Icon className="w-7 h-7 text-violet-600" aria-hidden="true" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-violet-600 via-pink-600 to-purple-600 bg-clip-text text-transparent">
            Join as a {config.name}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="text-violet-600 hover:text-violet-700 font-semibold transition-colors">
              Log in
            </Link>
          </p>
        </div>

        {/* Card */}
        <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border shadow-2xl shadow-violet-900/20 p-6 sm:p-8">

          {/* Business model — Marketplace only (SaaS disabled until payment gateway active) */}
          {isDriving && (
            <div className="mb-6 p-4 rounded-xl bg-violet-50 border border-violet-200">
              <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide mb-1">Registration type</p>
              <p className="text-sm font-semibold text-gray-900">DriveBook Marketplace</p>
              <p className="text-xs text-gray-600 mt-1">
                Students discover and book lessons through DriveBook. Payments are managed by the platform and paid to you weekly.
              </p>
              {/* SaaS option — commented out until payment gateway is active
              <button onClick={() => setSelectedModel('SAAS')} ...>
                DriveBook SaaS — you bring your own students
              </button>
              */}
            </div>
          )}

          {/* Organisation type — driving instructors only */}
          {isDriving && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">What is your organisation type?</h2>
              <div className="space-y-3">
                {/* Individual instructor — available */}
                <div
                  className="w-full text-left p-4 rounded-xl border-2 border-violet-500 bg-violet-50 cursor-default"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full border-2 mt-0.5 shrink-0 border-violet-500 bg-violet-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">Independent instructor</p>
                      <p className="text-xs text-gray-600 mt-1">
                        One provider operating independently under your own name or business name.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Driving school — coming soon */}
                <div
                  className="w-full text-left p-4 rounded-xl border-2 border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
                  aria-disabled="true"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full border-2 mt-0.5 shrink-0 border-gray-300" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-700">Driving school</p>
                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-medium">Coming soon</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Organisation with multiple instructors operating under a school identity. Not yet available.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Business structure — non-driving providers only
              Commented out: other trades path is disabled until payment gateway is active.
          {!isDriving && (
            <div className="mb-6">
              ...
            </div>
          )}
          */}

          {/* What happens next */}
          <div className="mb-6 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 space-y-1.5">
            <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">After you sign up</p>
            <ul className="space-y-1">
              {config.onboardingSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                  <CheckCircle className="w-3.5 h-3.5 text-violet-600 shrink-0 mt-0.5" />
                  {step}
                </li>
              ))}
            </ul>
          </div>

          {error && (
            <div className="mb-4 bg-red-500/15 border border-red-500/40 text-destructive text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <input
                id="name" type="text" name="name" required
                autoComplete="name" placeholder="Jane Smith"
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                id="email" type="email" name="email" required
                autoComplete="email" placeholder="you@example.com"
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input
                id="password" type="password" name="password" required
                minLength={8} autoComplete="new-password"
                placeholder="At least 8 characters"
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">Mobile Number</label>
              <input
                id="phone" type="tel" name="phone" required
                autoComplete="tel" placeholder="04XX XXX XXX"
                className={inputCls}
              />
              <p className="mt-1 text-xs text-gray-800">Used for booking notifications and customer contact</p>
            </div>

            {/* Legal checkboxes */}
            <div className="space-y-3 pt-2 border-t border-gray-200">
              {/* Commercial agreement checkbox — Marketplace driving instructors only.
                  SaaS providers do not see this: SaaS Terms are not yet published.
                  Non-driving (SAAS) providers also have no terms to accept. */}
              {isDriving && selectedModel === 'MARKETPLACE' && (
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="mt-0.5 shrink-0">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={e => setTermsAccepted(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 bg-white accent-violet-600 cursor-pointer"
                    />
                  </div>
                  <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors leading-relaxed">
                    I agree to the{' '}
                    <Link href="/instructor-terms" target="_blank" rel="noopener noreferrer"
                      className="text-violet-600 hover:text-violet-700 font-medium underline underline-offset-2">
                      Instructor Terms &amp; Conditions
                    </Link>{' '}
                    and confirm I am an independent contractor.
                  </span>
                </label>
              )}

              {/* SaaS terms notice — commented out until SaaS path is re-enabled
              {((isDriving && selectedModel === 'SAAS') || !isDriving) && (
                SAAS_TERMS_PUBLISHED ? ( ... ) : ( ... )
              )}
              */}

              {/* Privacy policy — always required, all providers */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="mt-0.5 shrink-0">
                  <input
                    type="checkbox"
                    checked={privacyAccepted}
                    onChange={e => setPrivacyAccepted(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 bg-white accent-violet-600 cursor-pointer"
                  />
                </div>
                <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors leading-relaxed">
                  I agree to the{' '}
                  <Link href="/privacy" target="_blank" rel="noopener noreferrer"
                    className="text-violet-600 hover:text-violet-700 font-medium underline underline-offset-2">
                    Privacy Policy
                  </Link>
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={
                loading ||
                !privacyAccepted ||
                (isDriving && selectedModel === 'MARKETPLACE' && !termsAccepted)
                // SaaS conditions removed — SaaS path disabled until payment gateway active
              }
              className={[
                'w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2',
                'bg-gradient-to-r from-violet-600 to-purple-600 text-white',
                'hover:from-violet-500 hover:to-purple-500 shadow-lg shadow-violet-900/40',
                'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none',
              ].join(' ')}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating your account…
                </>
              ) : (
                'Create account'
              )}
            </button>

            <p className="text-xs text-gray-500 text-center pt-1">
              {config.legalDisclaimer}
            </p>
          </form>
        </div>

        <div className="text-center mt-6">
          <button
            onClick={() => router.push('/register/business-type')}
            className="text-xs text-foreground/80 hover:text-foreground/60 transition-colors"
          >
            ← Change business type
          </button>
        </div>
      </div>
    </div>
  )
}