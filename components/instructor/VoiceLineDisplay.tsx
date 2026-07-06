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
 * VoiceLineDisplay
 *
 * Shown in the instructor settings/dashboard.
 * Displays their assigned AI receptionist number or explains why they don't have one.
 * Read-only — assignment is done by admin only.
 */
export default function VoiceLineDisplay({
  voiceLine,
  voiceLineStatus,
  subscriptionTier,
}: VoiceLineDisplayProps) {
  const [copied, setCopied] = useState(false)
  const hasDedicatedLine = DEDICATED_LINE_TIERS.includes(subscriptionTier?.toUpperCase())

  function formatAU(e164: string): string {
    // Convert E.164 +61XXXXXXXXX to local AU format (0X XXXX XXXX)
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
      // clipboard API not available — ignore
    }
  }

  // BASIC/TRIAL — not eligible
  if (!hasDedicatedLine) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-gray-200 p-2">
            <Lock className="h-5 w-5 text-gray-500" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">AI Receptionist Line</h3>
            <p className="mt-1 text-sm text-gray-500">
              A dedicated booking phone number is available on the{' '}
              <strong>PRO plan</strong> and above. Upgrade to get your own number
              that students can call 24/7 — the AI handles bookings, cancellations,
              and reschedules automatically.
            </p>
            <a
              href="/dashboard/settings?tab=subscription"
              className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Upgrade to PRO
            </a>
          </div>
        </div>
      </div>
    )
  }

  // PRO+ but no number assigned yet (pool may be empty, admin will provision)
  if (!voiceLine || voiceLineStatus === 'NONE') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-amber-100 p-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">AI Receptionist Line</h3>
            <p className="mt-1 text-sm text-gray-600">
              Your dedicated number is being set up. This usually takes less than a day.
              You'll receive a notification once it's ready.
            </p>
            <p className="mt-2 text-xs text-gray-400">
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
      <div className="rounded-xl border border-red-200 bg-red-50 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-red-100 p-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">AI Receptionist Line — Suspended</h3>
            <p className="mt-1 text-sm text-gray-600">
              Your dedicated number{' '}
              <span className="font-mono font-medium">{formatAU(voiceLine)}</span> is
              temporarily suspended. Calls will reach the DriveBook general line until
              this is resolved. Contact support if you need assistance.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Active — show the number
  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-green-100 p-2">
          <Phone className="h-5 w-5 text-green-700" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-800">AI Receptionist Line</h3>
            <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              <CheckCircle className="h-3 w-3" />
              Active
            </span>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <span className="text-2xl font-bold tracking-wide text-gray-900">
              {formatAU(voiceLine)}
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              {copied ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-600" />
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

          <p className="mt-2 text-sm text-gray-600">
            Share this number with your students or add it to your website. The AI
            receptionist answers 24/7, handles new bookings, reschedules, and
            cancellations on your behalf.
          </p>

          <div className="mt-3 rounded-lg bg-white border border-green-100 p-3 text-xs text-gray-500 space-y-1">
            <p>
              <strong>Greeting callers hear:</strong> "Hi, you've reached{' '}
              {/* instructor name would be injected by the parent */}
              your instructor's booking line. I'm the DriveBook assistant…"
            </p>
            <p>
              <strong>Want to use your own number?</strong> Set it to forward calls to{' '}
              <span className="font-mono">{formatAU(voiceLine)}</span> — students call
              your number, the AI answers automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
