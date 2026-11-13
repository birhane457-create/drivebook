'use client'

// components/mobile/BiometricLoginButton.tsx
// Shows a fingerprint / face-ID button on the login page when:
//   1. Running in the Capacitor native app
//   2. The device supports biometric authentication
//   3. The user has previously saved credentials
//
// First-time setup: after a successful normal login the user is prompted
// "Use fingerprint / Face ID next time?" — if they agree, credentials are saved.

import { useState, useEffect } from 'react'
import { Fingerprint } from 'lucide-react'
import {
  isBiometricAvailable,
  isBiometricEnabled,
  getBiometricCredentials,
  saveBiometricCredentials,
  clearBiometricCredentials,
} from '@/lib/capacitor/biometric'

interface BiometricLoginButtonProps {
  /** Called with email + password when biometric succeeds — parent triggers signIn */
  onCredentials: (email: string, password: string) => void
  /** Pass true while the parent login form is submitting */
  disabled?: boolean
}

export default function BiometricLoginButton({ onCredentials, disabled }: BiometricLoginButtonProps) {
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Check capability + saved credentials asynchronously
    async function check() {
      const available = await isBiometricAvailable()
      if (available && isBiometricEnabled()) {
        setShow(true)
      }
    }
    check()
  }, [])

  if (!show) return null

  const handleBiometric = async () => {
    setLoading(true)
    setError('')
    try {
      const creds = await getBiometricCredentials()
      if (!creds) {
        setError('Biometric not recognised. Please log in with your password.')
        setShow(false)
        clearBiometricCredentials()
        return
      }
      onCredentials(creds.email, creds.password)
    } catch {
      setError('Biometric failed. Please log in with your password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-4 space-y-2">
      <div className="relative flex items-center">
        <div className="flex-grow border-t border-gray-200" />
        <span className="mx-3 text-xs text-gray-400 shrink-0">or</span>
        <div className="flex-grow border-t border-gray-200" />
      </div>

      <button
        type="button"
        onClick={handleBiometric}
        disabled={disabled || loading}
        className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-700 font-medium text-sm transition-all disabled:opacity-50"
      >
        <Fingerprint className="w-5 h-5" />
        {loading ? 'Verifying...' : 'Sign in with Fingerprint / Face ID'}
      </button>

      {error && (
        <p className="text-xs text-red-500 text-center">{error}</p>
      )}
    </div>
  )
}

// ── Setup prompt (shown after successful login) ──────────────────────────────

interface BiometricSetupPromptProps {
  email: string
  password: string
  onDone: () => void
}

export function BiometricSetupPrompt({ email, password, onDone }: BiometricSetupPromptProps) {
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function check() {
      const available = await isBiometricAvailable()
      // Only show if biometric is available AND not already set up
      if (available && !isBiometricEnabled()) {
        setVisible(true)
      } else {
        onDone()
      }
    }
    check()
  }, [onDone])

  if (!visible) return null

  const handleEnable = async () => {
    setSaving(true)
    const saved = await saveBiometricCredentials(email, password)
    setSaving(false)
    if (!saved) {
      // Biometric cancelled or failed — just continue
    }
    setVisible(false)
    onDone()
  }

  const handleSkip = () => {
    setVisible(false)
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-t-3xl p-6 pb-10 space-y-4 shadow-2xl">
        <div className="flex justify-center">
          <div className="w-12 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center shrink-0">
            <Fingerprint className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Enable Biometric Login?</h3>
            <p className="text-sm text-gray-500">Use fingerprint or Face ID to sign in faster next time</p>
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <button
            onClick={handleEnable}
            disabled={saving}
            className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 transition-colors disabled:opacity-60"
          >
            {saving ? 'Setting up...' : 'Enable Biometric Login'}
          </button>
          <button
            onClick={handleSkip}
            className="w-full py-3 text-gray-500 rounded-xl font-medium text-sm hover:bg-gray-50 transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
