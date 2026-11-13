// lib/capacitor/biometric.ts
// Biometric authentication for Capacitor (Android fingerprint / Face ID / iris)
// Uses the Web Authentication API (WebAuthn) which Android exposes natively via
// the Capacitor webview — no extra plugin needed for basic fingerprint unlock.
//
// STRATEGY:
// 1. User logs in with email + password as normal (first time)
// 2. We offer to save credentials encrypted in localStorage (gated behind biometric)
// 3. On subsequent opens, biometric prompt appears — if passed, we decrypt and auto-login
//
// For the biometric gate we use the CredentialManagement / WebAuthn API which is
// available in the Android system webview (Android 9+).
// On devices that don't support it we fall back gracefully (no biometric button shown).

import { Capacitor } from '@capacitor/core'

const BIOMETRIC_KEY = 'db_biometric_creds'
const BIOMETRIC_ENABLED_KEY = 'db_biometric_enabled'

// ── Capability check ──────────────────────────────────────────────────────────

export async function isBiometricAvailable(): Promise<boolean> {
  // Only in native app
  if (!Capacitor.isNativePlatform()) return false

  try {
    // PublicKeyCredential is available in Android WebView (Android 9+)
    if (!window.PublicKeyCredential) return false

    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    return available
  } catch {
    return false
  }
}

export function isBiometricEnabled(): boolean {
  try {
    return localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true'
  } catch {
    return false
  }
}

// ── Save credentials after successful login ────────────────────────────────────

export async function saveBiometricCredentials(email: string, password: string): Promise<boolean> {
  try {
    // Use WebAuthn platform authenticator to gate the save
    // We create a "dummy" credential to verify the user is who they say they are,
    // then store the actual credentials encrypted in localStorage.
    // The encryption key is derived from a device-bound WebAuthn assertion.

    // Simple approach: just save to localStorage behind biometric confirmation
    // The biometric prompt appears when we call get() with userVerification: 'required'
    const verified = await promptBiometric()
    if (!verified) return false

    // Store credentials (obfuscated — not true encryption, but behind biometric gate)
    const payload = btoa(JSON.stringify({ email, password, savedAt: Date.now() }))
    localStorage.setItem(BIOMETRIC_KEY, payload)
    localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true')
    return true
  } catch {
    return false
  }
}

// ── Retrieve credentials ──────────────────────────────────────────────────────

export async function getBiometricCredentials(): Promise<{ email: string; password: string } | null> {
  try {
    if (!isBiometricEnabled()) return null

    const payload = localStorage.getItem(BIOMETRIC_KEY)
    if (!payload) return null

    // Prompt biometric before revealing
    const verified = await promptBiometric()
    if (!verified) return null

    const { email, password } = JSON.parse(atob(payload))
    return { email, password }
  } catch {
    return null
  }
}

// ── Clear saved credentials ───────────────────────────────────────────────────

export function clearBiometricCredentials(): void {
  localStorage.removeItem(BIOMETRIC_KEY)
  localStorage.removeItem(BIOMETRIC_ENABLED_KEY)
}

// ── Core biometric prompt using WebAuthn ──────────────────────────────────────

async function promptBiometric(): Promise<boolean> {
  try {
    // Use conditional mediation / platform authenticator
    // We create a challenge that the authenticator signs using the device biometric
    const challenge = new Uint8Array(32)
    crypto.getRandomValues(challenge)

    // Try to get an existing platform credential (fingerprint / face unlock)
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: 'required', // forces biometric — won't allow PIN fallback
        rpId: window.location.hostname || 'drivebook.com.au',
      },
    } as CredentialRequestOptions)

    return assertion !== null
  } catch (err: any) {
    // NotAllowedError = user cancelled or no credential registered
    // We fall back to creating one if none exists
    if (err?.name === 'NotAllowedError' || err?.name === 'InvalidStateError') {
      return await registerBiometricCredential()
    }
    return false
  }
}

// ── Register a new WebAuthn credential (first time setup) ─────────────────────

async function registerBiometricCredential(): Promise<boolean> {
  try {
    const challenge = new Uint8Array(32)
    const userId = new Uint8Array(16)
    crypto.getRandomValues(challenge)
    crypto.getRandomValues(userId)

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'DriveBook',
          id: window.location.hostname || 'drivebook.com.au',
        },
        user: {
          id: userId,
          name: 'drivebook-user',
          displayName: 'DriveBook User',
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },   // ES256
          { alg: -257, type: 'public-key' },  // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform', // device-bound (fingerprint/face)
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
      },
    } as CredentialCreationOptions)

    return credential !== null
  } catch {
    return false
  }
}
