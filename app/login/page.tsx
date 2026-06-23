'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { LogIn, Loader2, Mail } from 'lucide-react'

function ResendVerificationButton({ email }: { email: string }) {
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  const resend = async () => {
    if (!email) return
    setSending(true)
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setSent(true)
      } else {
        // Show sent anyway — prevents email enumeration (don't reveal if email exists)
        setSent(true)
      }
    } catch {
      // Network error — show generic sent to avoid leaking info
      setSent(true)
    } finally {
      setSending(false)
    }
  }

  if (sent) return (
    <p className="text-green-300 text-xs flex items-center gap-1">
      <Mail className="w-3 h-3" /> Verification email sent — check your inbox
    </p>
  )

  return (
    <button
      onClick={resend}
      disabled={sending || !email}
      className="text-xs text-purple-300 underline hover:text-purple-200 disabled:opacity-50"
    >
      {sending ? 'Sending…' : 'Resend verification email'}
    </button>
  )
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pendingEmail, setPendingEmail] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const email = (formData.get('email') as string ?? '').trim().toLowerCase()
    const password = (formData.get('password') as string ?? '')

    if (!email || !password) {
      setError('Please enter both email and password')
      setLoading(false)
      return
    }

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false
      })

      if (result?.error) {
        // NextAuth wraps all credential errors as 'CredentialsSignin'
        // We use error codes in the thrown message to distinguish cases
        const rawError = result.error
        if (rawError.includes('EMAIL_NOT_VERIFIED')) {
          setPendingEmail(email)
          setError('EMAIL_NOT_VERIFIED')
        } else {
          setError('Invalid email or password')
        }
        setLoading(false)
      } else if (result?.ok) {
        const sessionRes = await fetch('/api/auth/session')

        if (!sessionRes.ok) {
          setError('Unable to load session after login. Please try again.')
          setLoading(false)
          return
        }

        const session = await sessionRes.json()

        if (session?.user?.role) {
          const role = session.user.role
          const hostname = window.location.hostname

          // Never treat *.vercel.app as a subdomain — the instructor slug
          // subdomains only apply to the real production domain (drivebook.com.au)
          const isVercelDomain = hostname.endsWith('vercel.app') || hostname === 'localhost' || hostname.startsWith('127.')
          const compoundTLDs = ['com.au', 'co.uk', 'co.nz', 'org.au', 'net.au', 'id.au']
          const tld2 = hostname.split('.').slice(-2).join('.')
          const minParts = compoundTLDs.includes(tld2) ? 4 : 3
          const isSubdomain = !isVercelDomain && hostname.split('.').length >= minParts && !hostname.startsWith('www.')
          const mainDomain = isSubdomain
            ? window.location.origin.replace(/^https?:\/\/[^.]+\./, 'https://')
            : ''

          if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
            window.location.href = `${mainDomain}/admin`
          } else if (role === 'INSTRUCTOR') {
            window.location.href = `${mainDomain}/dashboard`
          } else if (role === 'CLIENT') {
            window.location.href = `${mainDomain}/client-dashboard`
          } else {
            window.location.href = `${mainDomain}/dashboard`
          }
        } else {
          setError('Session error. Please try again.')
          setLoading(false)
        }
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center py-8 sm:py-12 px-4">
      <div className="max-w-md w-full">

        {/* Icon + title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-600/30 border border-purple-500/40 mb-4">
            <LogIn className="w-7 h-7 text-purple-300" aria-hidden="true" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-violet-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-white/60">Log in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-2xl shadow-2xl shadow-purple-900/50 border border-white/20 p-6 sm:p-8 backdrop-blur-xl">
          {error && (
            <div className="bg-red-500/20 text-red-300 p-3 rounded-lg mb-4 border border-red-500/50 backdrop-blur-sm text-sm">
              {error === 'EMAIL_NOT_VERIFIED' ? (
                <div>
                  <p className="font-semibold mb-1">Email not verified</p>
                  <p className="text-red-200/80 text-xs mb-2">
                    Please verify your email address before logging in.
                    Check your inbox for a verification link.
                  </p>
                  <ResendVerificationButton email={pendingEmail} />
                </div>
              ) : (
                error
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-white/90">Email</label>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 focus:bg-white/15 transition-all backdrop-blur-sm"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-white/90">Password</label>
                <Link href="/forgot-password" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 focus:bg-white/15 transition-all backdrop-blur-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold shadow-lg shadow-purple-900/50 hover:from-purple-500 hover:to-pink-500 hover:shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-sm text-white/60">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-purple-400 hover:text-purple-300 font-semibold transition-colors">
            Register
          </Link>
        </p>
      </div>
    </div>
  )
}
