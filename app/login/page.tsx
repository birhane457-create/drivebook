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
    <p className="text-green-300 text-xs flex items-center gap-1">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm bg-slate-900 border border-white/15 rounded-2xl shadow-2xl p-7">
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-sky-600/20 border border-sky-500/30 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-sky-300" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-white text-center mb-1">Verify it&apos;s you</h2>
        <p className="text-sm text-white/55 text-center mb-5">
          New browser detected. A 6-digit code was sent to{' '}
          <span className="text-white/80 font-medium">{maskedEmail}</span>
        </p>

        {error    && <div className="mb-4 bg-red-500/15 border border-red-500/30 text-red-300 text-sm px-4 py-2.5 rounded-xl">{error}</div>}
        {resendMsg && <div className="mb-4 bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs px-4 py-2.5 rounded-xl">{resendMsg}</div>}

        <form onSubmit={handleConfirm} className="space-y-4">
          <input
            type="text" inputMode="numeric" pattern="[0-9]*"
            maxLength={6} value={code} autoFocus
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="w-full text-center text-2xl font-bold tracking-[0.5em] px-4 py-3 rounded-xl bg-slate-800 border-2 border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-sky-500 transition-colors"
          />
          <button type="submit" disabled={loading || code.length !== 6}
            className="w-full py-3 rounded-xl font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
              : 'Verify & continue'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button onClick={handleResend} disabled={resending}
            className="text-xs text-white/40 hover:text-white/70 transition-colors flex items-center gap-1.5 mx-auto">
            <RefreshCw className={`w-3 h-3 ${resending ? 'animate-spin' : ''}`} />
            {resending ? 'Sending…' : 'Resend code'}
          </button>
        </div>
        <p className="mt-5 text-center text-[11px] text-white/25">
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
      const sessionRes = await fetch('/api/auth/session')
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
        : role === 'INSTRUCTOR'                       ? `${mainDomain}/dashboard`
        : role === 'CLIENT'                           ? `${mainDomain}/client-dashboard`
        :                                               `${mainDomain}/dashboard`

      // ── Device check + conditional OTP ────────────────────────────────────
      // OTP gate applies to INSTRUCTOR only — they control bank payout details.
      // For other roles we still do device tracking (notification email) but never block.
      try {
        const { getOrCreateDeviceToken } = await import('@/lib/services/deviceTracking')
        const deviceToken = getOrCreateDeviceToken()

        const deviceRes  = await fetch('/api/auth/device-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceToken }),
        })
        const deviceData = deviceRes.ok ? await deviceRes.json() : {}

        if (deviceData.isNewDevice && role === 'INSTRUCTOR') {
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
      } catch (err) {
        // Device check must never block login
        console.error('[Login] Device check error (non-fatal):', err)
      }

      // Known device, non-instructor, or OTP unavailable → navigate immediately
      window.location.href = redirectTo

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

      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center py-8 sm:py-12 px-4">
        <div className="max-w-md w-full">

          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-600/30 border border-purple-500/40 mb-4">
              <LogIn className="w-7 h-7 text-purple-300" aria-hidden="true" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-violet-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-white/60">Log in to your account</p>
          </div>

          <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-2xl shadow-2xl shadow-purple-900/50 border border-white/20 p-6 sm:p-8 backdrop-blur-xl">
            {error && (
              <div className="bg-red-500/20 text-red-300 p-3 rounded-lg mb-4 border border-red-500/50 backdrop-blur-sm text-sm">
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
                <label className="block text-sm font-medium mb-2 text-white/90">Email</label>
                <input type="email" name="email" required autoComplete="email"
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
                <input type="password" name="password" required autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 focus:bg-white/15 transition-all backdrop-blur-sm"
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

          <p className="text-center mt-6 text-sm text-white/60">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-purple-400 hover:text-purple-300 font-semibold transition-colors">
              Register
            </Link>
          </p>
        </div>
      </div>
    </>
  )
}
