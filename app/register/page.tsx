'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UserPlus, Loader2 } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [instructorTermsAccepted, setInstructorTermsAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!instructorTermsAccepted || !privacyAccepted) {
      setError('You must accept the Instructor Terms and Privacy Policy to register.')
      setLoading(false)
      return
    }

    const formData = new FormData(e.currentTarget)

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.get('email'),
          password: formData.get('password'),
          name: formData.get('name'),
          phone: formData.get('phone'),
          baseAddress: formData.get('baseAddress'),
          baseLatitude: -33.8688,
          baseLongitude: 151.2093,
          hourlyRate: Number(formData.get('hourlyRate')),
          vehicleTypes: [formData.get('vehicleType')],
          serviceRadiusKm: Number(formData.get('serviceRadius')),
          termsAccepted: true,
          termsVersion: '1.0',
        })
      })

      if (response.ok) {
        const data = await response.json()
        router.push(data.redirectTo ?? '/login')
      } else {
        const data = await response.json()
        setError(data.error || 'Registration failed')
      }
    } catch (err) {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    'w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 focus:bg-white/15 transition-all backdrop-blur-sm'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center py-8 sm:py-12 px-4">
      <div className="max-w-md w-full">

        {/* Icon + title — matches login pattern */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-600/30 border border-purple-500/40 mb-4">
            <UserPlus className="w-7 h-7 text-purple-300" aria-hidden="true" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-violet-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">
            Register as Instructor
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Already have an account?{' '}
            <Link href="/login" className="text-purple-400 hover:text-purple-300 font-semibold transition-colors">
              Login
            </Link>
          </p>
        </div>

        {/* Card */}
        <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-2xl shadow-2xl shadow-purple-900/50 border border-white/20 p-6 sm:p-8 backdrop-blur-xl">
          {error && (
            <div className="bg-red-500/20 text-red-300 p-3 rounded-lg mb-4 text-sm border border-red-500/50 backdrop-blur-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-white/90">Full Name</label>
              <input type="text" name="name" required placeholder="Jane Smith" className={inputCls} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-white/90">Email</label>
              <input type="email" name="email" required placeholder="you@example.com" className={inputCls} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-white/90">Password</label>
              <input type="password" name="password" required minLength={8} placeholder="At least 8 characters" className={inputCls} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-white/90">Phone</label>
              <input type="tel" name="phone" required placeholder="04XX XXX XXX" className={inputCls} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-white/90">Base Address</label>
              <input type="text" name="baseAddress" required placeholder="e.g. Maylands WA 6051" className={inputCls} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-white/90">Hourly Rate ($)</label>
              <input type="number" name="hourlyRate" required min="0" step="0.01" placeholder="65" className={inputCls} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-white/90">Vehicle Type</label>
              <select name="vehicleType" required className={inputCls}>
                <option value="AUTO" className="bg-slate-900 text-white">Automatic</option>
                <option value="MANUAL" className="bg-slate-900 text-white">Manual</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-white/90">Service Radius (km)</label>
              <input type="number" name="serviceRadius" required min="5" max="100" defaultValue="20" className={inputCls} />
            </div>

            {/* Terms */}
            <div className="space-y-3 pt-3 border-t border-white/10">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={instructorTermsAccepted}
                  onChange={(e) => setInstructorTermsAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded accent-purple-500"
                />
                <span className="text-sm text-white/70">
                  I agree to the{' '}
                  <Link href="/instructor-terms" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
                    Instructor Terms and Conditions
                  </Link>
                  . I confirm I am an independent contractor, not an employee of DriveBook.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded accent-purple-500"
                />
                <span className="text-sm text-white/70">
                  I agree to the{' '}
                  <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
                    Privacy Policy
                  </Link>
                  . I consent to DriveBook collecting and using my information as described.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || !instructorTermsAccepted || !privacyAccepted}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold shadow-lg shadow-purple-900/50 hover:from-purple-500 hover:to-pink-500 hover:shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create instructor account'
              )}
            </button>

            <p className="text-xs text-white/50 text-center">
              By registering, you confirm you hold a valid WA driving instructor accreditation and current insurance.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
