'use client'

import { Phone, Copy, CheckCircle, AlertCircle, Lock } from 'lucide-react'
import { useState } from 'react'

interface VoiceLineDisplayProps {
  voiceLine: string | null
  voiceLineStatus: 'NONE' | 'ACTIVE' | 'SUSPENDED'
  subscriptionTier: string
}

const DEDICATED_LINE_TIERS = ['PRO', 'STUDIO', 'BUSINESS']

/**
 * VoiceLineDisplay — dark navy theme
 * Shown in instructor settings. Read-only — assignment is done by admin.
 */
export default function VoiceLineDisplay({
  voiceLine,
  voiceLineStatus,
  subscriptionTier,
}: VoiceLineDisplayProps) {
  const [copied, setCopied] = useState(false)
  const hasDedicatedLine = DEDICATED_LINE_TIERS.includes(subscriptionTier?.toUpperCase())

  function formatAU(e164: string): string {
    const digits = e164.replace(/^\+61/, '0')
    if (digits.length === 10) {
      return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`
    }
    return e164
  }

  async function handleCopy() {
    if (!voiceLine) return
    try {
      await navigator.clipboard.writeText(formatAU(voiceLine))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard API not available
    }
  }

  // BASIC/TRIAL — not eligible
  if (!hasDedicatedLine) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-slate-800 p-2 shrink-0">
            <Lock className="h-5 w-5 text-slate-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">AI Receptionist Line</h3>
            <p className="mt-1 text-sm text-slate-400">
              A dedicated booking phone number is available on the{' '}
              <strong className="text-slate-200">PRO plan</strong> and above. Upgrade to get
              your own number that students can call 24/7 — the AI handles bookings,
              cancellations, and reschedules automatically.
            </p>
            <a
              href="/dashboard/settings?tab=subscription"
              className="mt-3 inline-block rounded-lg bg-sky-600 hover:bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition-colors"
            >
              Upgrade to PRO
            </a>
          </div>
        </div>
      </div>
    )
  }

  // PRO+ but no number assigned yet
  if (!voiceLine || voiceLineStatus === 'NONE') {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-amber-500/10 p-2 shrink-0">
            <AlertCircle className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">AI Receptionist Line</h3>
            <p className="mt-1 text-sm text-slate-300">
              Your dedicated number is being set up. This usually takes less than a day.
              You'll receive a notification once it's ready.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Until then, students can still book through drivebook.com.au or call the
              DriveBook general line.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Suspended
  if (voiceLineStatus === 'SUSPENDED') {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-red-500/10 p-2 shrink-0">
            <AlertCircle className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">AI Receptionist Line — Suspended</h3>
            <p className="mt-1 text-sm text-slate-300">
              Your dedicated number{' '}
              <span className="font-mono font-medium text-slate-200">{formatAU(voiceLine)}</span>{' '}
              is temporarily suspended. Calls will reach the DriveBook general line until
              this is resolved. Contact support if you need assistance.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Active — show the number
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-emerald-500/10 p-2 shrink-0">
          <Phone className="h-5 w-5 text-emerald-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white">AI Receptionist Line</h3>
            <span className="flex items-center gap-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 text-xs font-semibold text-emerald-300">
              <CheckCircle className="h-3 w-3" />
              Active
            </span>
          </div>

          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <span className="text-2xl font-bold tracking-wide text-white font-mono">
              {formatAU(voiceLine)}
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:text-white transition-colors"
            >
              {copied ? (
                <>
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy
                </>
              )}
            </button>
          </div>

          <p className="mt-2 text-sm text-slate-400">
            Share this number with your students or add it to your website. The AI
            receptionist answers 24/7, handles new bookings, reschedules, and
            cancellations on your behalf.
          </p>

          <div className="mt-3 rounded-lg bg-slate-900 border border-white/8 p-3 text-xs text-slate-500 space-y-1">
            <p>
              <strong className="text-slate-400">Greeting callers hear:</strong>{' '}
              "Hi, you've reached your instructor's booking line. I'm the DriveBook assistant…"
            </p>
            <p>
              <strong className="text-slate-400">Want to use your own number?</strong>{' '}
              Set it to forward calls to{' '}
              <span className="font-mono text-slate-300">{formatAU(voiceLine)}</span> — students
              call your number, the AI answers automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
