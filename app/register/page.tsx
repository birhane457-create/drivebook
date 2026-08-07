'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UserPlus, Loader2, CheckCircle } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [instructorTermsAccepted, setInstructorTermsAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    if (!instructorTermsAccepted || !privacyAccepted) {
      setError('Please accept both the Instructor Terms and Privacy Policy to continue.')
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
          termsAccepted: true,
          termsVersion:  '1.0',
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
    'bg-slate-800/60 border border-white/10 text-white placeholder-white/30',
    'focus:outline-none focus:border-violet-500/70 focus:ring-2 focus:ring-violet-500/20',
    'transition-all',
  ].join(' ')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center py-10 px-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-600/20 border border-violet-500/30 mb-4">
            <UserPlus className="w-7 h-7 text-violet-300" aria-hidden="true" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-violet-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">
            Join as an Instructor
          </h1>
          <p className="mt-2 text-sm text-white/50">
            Already have an account?{' '}
            <Link href="/login" className="text-violet-400 hover:text-violet-300 font-semibold transition-colors">
              Log in
            </Link>
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl shadow-violet-900/20 p-6 sm:p-8">

          {/* What happens next */}
          <div className="mb-6 bg-violet-950/40 border border-violet-700/30 rounded-xl px-4 py-3 space-y-1.5">
            <p className="text-xs font-semibold text-violet-300 uppercase tracking-wide">After you sign up</p>
            <ul className="space-y-1">
              {[
                'Set your suburb, rate & availability in your dashboard',
                'Upload your licence, insurance & certifications',
                'Go live once admin approves your documents',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                  <CheckCircle className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                  {step}
                </li>
              ))}
            </ul>
          </div>

          {error && (
            <div className="mb-4 bg-red-500/15 border border-red-500/40 text-red-300 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-white/80 mb-1.5">Full Name</label>
              <input
                id="name" type="text" name="name" required
                autoComplete="name" placeholder="Jane Smith"
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white/80 mb-1.5">Email</label>
              <input
                id="email" type="email" name="email" required
                autoComplete="email" placeholder="you@example.com"
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white/80 mb-1.5">Password</label>
              <input
                id="password" type="password" name="password" required
                minLength={8} autoComplete="new-password"
                placeholder="At least 8 characters"
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-white/80 mb-1.5">Mobile Number</label>
              <input
                id="phone" type="tel" name="phone" required
                autoComplete="tel" placeholder="04XX XXX XXX"
                className={inputCls}
              />
              <p className="mt-1 text-xs text-white/30">Used for booking notifications and student contact</p>
            </div>

            {/* Legal checkboxes */}
            <div className="space-y-3 pt-2 border-t border-white/8">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="mt-0.5 shrink-0">
                  <input
                    type="checkbox"
                    checked={instructorTermsAccepted}
                    onChange={e => setInstructorTermsAccepted(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-slate-800 accent-violet-500 cursor-pointer"
                  />
                </div>
                <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors leading-relaxed">
                  I agree to the{' '}
                  <Link href="/instructor-terms" target="_blank" rel="noopener noreferrer"
                    className="text-violet-400 hover:text-violet-300 font-medium underline underline-offset-2">
                    Instructor Terms &amp; Conditions
                  </Link>{' '}
                  and confirm I am an independent contractor, not an employee of DriveBook.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="mt-0.5 shrink-0">
                  <input
                    type="checkbox"
                    checked={privacyAccepted}
                    onChange={e => setPrivacyAccepted(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-slate-800 accent-violet-500 cursor-pointer"
                  />
                </div>
                <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors leading-relaxed">
                  I agree to the{' '}
                  <Link href="/privacy" target="_blank" rel="noopener noreferrer"
                    className="text-violet-400 hover:text-violet-300 font-medium underline underline-offset-2">
                    Privacy Policy
                  </Link>{' '}
                  and consent to DriveBook collecting and using my information as described.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || !instructorTermsAccepted || !privacyAccepted}
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
                'Create instructor account'
              )}
            </button>

            <p className="text-xs text-white/25 text-center pt-1">
              By registering, you confirm you hold a valid driving instructor accreditation and current insurance.
            </p>
          </form>
        </div>

        <p className="text-center text-xs text-white/25 mt-6">
          Looking to book lessons instead?{' '}
          <Link href="/driving-lessons" className="text-violet-400/70 hover:text-violet-300 transition-colors">
            Find an instructor →
          </Link>
        </p>
      </div>
    </div>
  )
}
