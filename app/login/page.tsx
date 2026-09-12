'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { LogIn, Loader2, Mail, ShieldCheck, RefreshCw } from 'lucide-react'

function ResendVerificationButton({ email }: { email: string }) {
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const resend = async () => {
    if (!email) return
    setSending(true)
    try {
      await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } catch { /* ignore */ }
    setSent(true)
    setSending(false)
  }
  if (sent) return (
    <p className="text-emerald-400 text-xs flex items-center gap-1">
      <Mail className="w-3 h-3" /> Verification email sent — check your inbox
    </p>
  )
  return (
    <button onClick={resend} disabled={sending || !email}
      className="text-xs text-purple-300 underline hover:text-purple-200 disabled:opacity-50">
      {sending ? 'Sending…' : 'Resend verification email'}
    </button>
  )
}

// ── OTP modal — blocks navigation until verified on new-device instructor logins ──

interface OtpModalProps {
  email: string
  verificationId: string
  redirectTo: string
}

function OtpModal({ email, verificationId, redirectTo }: OtpModalProps) {
  const [code, setCode]           = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState('')
  const [currentVId, setCurrentVId] = useState(verificationId)

  const maskedEmail = email.replace(/^(.{1,2})(.*)(@.*)$/, (_, a, b, c) =>
    a + b.replace(/./g, '*') + c
  )

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== 6) { setError('Enter the 6-digit code'); return }
    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/verifications/otp/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationId: currentVId, code, email }),
      })
      const data = await res.json()
      if (res.ok && data.valid) {
        window.location.href = redirectTo
      } else if (data.locked) {
        setError('Too many failed attempts. Please log in again and try a fresh code.')
      } else {
        setError(data.error || 'Incorrect code. Please try again.')
      }
    } catch { setError('Network error. Please try again.') }
    finally   { setLoading(false) }
  }

  const handleResend = async () => {
    setResending(true); setResendMsg(''); setError('')
    try {
      const res  = await fetch('/api/verifications/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose: 'login' }),
      })
      const data = await res.json()
      if (res.ok) {
        setCurrentVId(data.verificationId)
        setCode('')
        setResendMsg('New code sent — check your inbox.')
      } else if (res.status === 429) {
        setResendMsg(`Wait ${data.retryAfter ?? 60}s before requesting another code.`)
      } else {
        setResendMsg('Could not resend. Please try again.')
      }
    } catch { setResendMsg('Network error.') }
    finally   { setResending(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-7">
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-primary/20 border border-sky-500/30 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-foreground text-center mb-1">Verify it&apos;s you</h2>
        <p className="text-sm text-foreground/55 text-center mb-5">
          New browser detected. A 6-digit code was sent to{' '}
          <span className="text-foreground/80 font-medium">{maskedEmail}</span>
        </p>

        {error    && <div className="mb-4 bg-red-500/15 border border-red-500/30 text-destructive text-sm px-4 py-2.5 rounded-xl">{error}</div>}
        {resendMsg && <div className="mb-4 bg-sky-500/10 border border-sky-500/20 text-primary text-xs px-4 py-2.5 rounded-xl">{resendMsg}</div>}

        <form onSubmit={handleConfirm} className="space-y-4">
          <input
            type="text" inputMode="numeric" pattern="[0-9]*"
            maxLength={6} value={code} autoFocus
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="w-full text-center text-2xl font-bold tracking-[0.5em] px-4 py-3 rounded-xl bg-secondary border-2 border-border text-foreground placeholder-white/20 focus:outline-none focus:border-sky-500 transition-colors"
          />
          <button type="submit" disabled={loading || code.length !== 6}
            className="w-full py-3 rounded-xl font-semibold text-foreground bg-primary hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
              : 'Verify & continue'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button onClick={handleResend} disabled={resending}
            className="text-xs text-foreground/40 hover:text-foreground/70 transition-colors flex items-center gap-1.5 mx-auto">
            <RefreshCw className={`w-3 h-3 ${resending ? 'animate-spin' : ''}`} />
            {resending ? 'Sending…' : 'Resend code'}
          </button>
        </div>
        <p className="mt-5 text-center text-[11px] text-foreground/25">
          This browser will be remembered after verification.
        </p>
      </div>
    </div>
  )
}

// ── Main login page ───────────────────────────────────────────────────────────

export default function LoginPage() {
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [pendingEmail, setPendingEmail] = useState('')

  // OTP state — populated when a new-device instructor login is detected
  const [otpState, setOtpState] = useState<{
    email: string
    verificationId: string
    redirectTo: string
  } | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const email    = (formData.get('email')    as string ?? '').trim().toLowerCase()
    const password = (formData.get('password') as string ?? '')

    if (!email || !password) {
      setError('Please enter both email and password')
      setLoading(false)
      return
    }

    try {
      const result = await signIn('credentials', { email, password, redirect: false })

      if (result?.error) {
        const raw = result.error
        if (raw.includes('EMAIL_NOT_VERIFIED')) {
          setPendingEmail(email)
          setError('EMAIL_NOT_VERIFIED')
        } else if (raw.includes('INSTRUCTOR_NOT_APPROVED')) {
          setError('INSTRUCTOR_NOT_APPROVED')
        } else {
          setError('Invalid email or password')
        }
        setLoading(false)
        return
      }

      if (!result?.ok) {
        setError('An error occurred. Please try again.')
        setLoading(false)
        return
      }

      // ── Session ───────────────────────────────────────────────────────────
      // Fetch session to determine role-based redirect target.
      // signIn() with redirect:false sets the cookie but doesn't navigate.
      // We fetch the session immediately after to get the user role.
      const sessionRes = await fetch('/api/auth/session', { cache: 'no-store' })
      if (!sessionRes.ok) {
        setError('Unable to load session. Please try again.')
        setLoading(false)
        return
      }
      const session = await sessionRes.json()
      const role    = session?.user?.role

      // ── Resolve redirect target ───────────────────────────────────────────
      const hostname       = window.location.hostname
      const isVercelDomain = hostname.endsWith('vercel.app') || hostname === 'localhost' || hostname.startsWith('127.')
      const compoundTLDs   = ['com.au', 'co.uk', 'co.nz', 'org.au', 'net.au', 'id.au']
      const tld2           = hostname.split('.').slice(-2).join('.')
      const minParts       = compoundTLDs.includes(tld2) ? 4 : 3
      const isSubdomain    = !isVercelDomain && hostname.split('.').length >= minParts && !hostname.startsWith('www.')
      const mainDomain     = isSubdomain
        ? window.location.origin.replace(/^https?:\/\/[^.]+\./, 'https://')
        : ''

      const redirectTo =
        (role === 'SUPER_ADMIN' || role === 'ADMIN') ? `${mainDomain}/admin`
        : role === 'provider'                       ? `${mainDomain}/dashboard`
        : role === 'CLIENT'                           ? `${mainDomain}/client-dashboard`
        :                                               `${mainDomain}/dashboard`

      // ── Device check + conditional OTP ────────────────────────────────────
      // Only check device on:
      // 1. First login ever (no localStorage timestamp)
      // 2. After 24+ hours since last check (reduces unnecessary calls)
      // OTP gate applies to INSTRUCTOR only — they control bank payout details.
      // For other roles we still do device tracking (notification email) but never block.
      try {
        const { getOrCreateDeviceToken } = await import('@/lib/services/deviceTracking')
        const deviceToken = getOrCreateDeviceToken()
        
        // Check last device-check timestamp
        const lastCheckKey = `device-check-${email}`
        const lastCheck = localStorage.getItem(lastCheckKey)
        const now = Date.now()
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000
        
        // Skip device-check if we checked within the last 24 hours
        const shouldSkipCheck = lastCheck && (now - parseInt(lastCheck)) < TWENTY_FOUR_HOURS
        
        if (!shouldSkipCheck) {
          const deviceRes  = await fetch('/api/auth/device-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceToken }),
          })
          const deviceData = deviceRes.ok ? await deviceRes.json() : {}

          // Store timestamp of this check
          localStorage.setItem(lastCheckKey, now.toString())

          if (deviceData.isNewDevice && role === 'provider') {
            // Send OTP to the instructor's email and show the modal
            const otpRes  = await fetch('/api/verifications/otp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, purpose: 'login' }),
            })
            const otpData = otpRes.ok ? await otpRes.json() : {}

            if (otpData.verificationId) {
              // Hold navigation — OtpModal will navigate when code is confirmed
              setOtpState({ email, verificationId: otpData.verificationId, redirectTo })
              setLoading(false)
              return
            }
            // OTP send failed — log and allow login (availability > perfection)
            console.error('[Login] OTP send failed — allowing login without verification')
          }
        }
      } catch (err) {
        // Device check must never block login
        console.error('[Login] Device check error (non-fatal):', err)
      }

      // Known device, non-instructor, or OTP unavailable → navigate immediately
      // New instructors (registered < 10 min ago) go to onboarding first
      let finalRedirect = redirectTo
      if (role === 'provider') {
        try {
          const profileRes = await fetch('/api/instructor/profile', { cache: 'no-store' })
          if (profileRes.ok) {
            const profile = await profileRes.json()
            const createdAt = profile.createdAt ? new Date(profile.createdAt) : null
            const isNew = createdAt && (Date.now() - createdAt.getTime()) < 10 * 60 * 1000
            if (isNew) finalRedirect = `${mainDomain}/onboarding?from=register`
          }
        } catch { /* non-fatal — use default redirect */ }
      }
      window.location.replace(finalRedirect)

    } catch {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <>
      {otpState && (
        <OtpModal
          email={otpState.email}
          verificationId={otpState.verificationId}
          redirectTo={otpState.redirectTo}
        />
      )}

      <div className="light min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center py-8 sm:py-12 px-4">
        <div className="max-w-md w-full">

          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-100 border border-purple-300 mb-4">
              <LogIn className="w-7 h-7 text-purple-600" aria-hidden="true" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-violet-600 via-pink-600 to-purple-600 bg-clip-text text-transparent">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-gray-600">Log in to your account</p>
          </div>

          <div className="bg-gradient-to-br from-secondary to-secondary/50 rounded-2xl shadow-2xl shadow-purple-900/50 border border-white/20 p-6 sm:p-8 backdrop-blur-xl">
            {error && (
              <div className="bg-red-500/20 text-destructive p-3 rounded-lg mb-4 border border-destructive/40 backdrop-blur-sm text-sm">
                {error === 'EMAIL_NOT_VERIFIED' ? (
                  <div>
                    <p className="font-semibold mb-1">Email not verified</p>
                    <p className="text-red-200/80 text-xs mb-2">
                      Please verify your email before logging in. Check your inbox for the link.
                    </p>
                    <ResendVerificationButton email={pendingEmail} />
                  </div>
                ) : error === 'INSTRUCTOR_NOT_APPROVED' ? (
                  <div>
                    <p className="font-semibold mb-1">Account suspended</p>
                    <p className="text-red-200/80 text-xs">
                      Your instructor account has been suspended or rejected. Please contact{' '}
                      <a href="mailto:support@drivebook.com.au" className="underline">support@drivebook.com.au</a>{' '}
                      for more information.
                    </p>
                  </div>
                ) : error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Email</label>
                <input type="email" name="email" required autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <Link href="/forgot-password" className="text-xs text-violet-600 hover:text-violet-700 transition-colors">
                    Forgot password?
                  </Link>
                </div>
                <input type="password" name="password" required autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold shadow-lg shadow-purple-900/50 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Logging in…</>
                  : 'Login'}
              </button>
            </form>
          </div>

          <p className="text-center mt-6 text-sm text-gray-600">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-violet-600 hover:text-violet-700 font-semibold transition-colors">
              Register
            </Link>
          </p>
        </div>
      </div>
    </>
  )
}
