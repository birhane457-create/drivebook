/**
 * lib/services/pushNotification.ts
 *
 * Thin wrapper around the FCM HTTP v1 API for sending push notifications to
 * registered Capacitor devices.
 *
 * Prerequisites (add to Vercel env vars):
 *   FIREBASE_PROJECT_ID     — GCP project ID (e.g. "drivebook-prod")
 *   FIREBASE_CLIENT_EMAIL   — Service account email from the JSON key file
 *   FIREBASE_PRIVATE_KEY    — Service account private key (with \n as newlines)
 *
 * Usage:
 *   import { sendPushToUser } from '@/lib/services/pushNotification'
 *
 *   await sendPushToUser(userId, {
 *     title: 'Booking confirmed',
 *     body:  'Your lesson on Mon 30 Jun at 10:00 AM is confirmed.',
 *     data:  { bookingId: 'abc123', type: 'BOOKING_CONFIRMED' },
 *   })
 */

import { prisma } from '@/lib/prisma'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PushPayload {
  title: string
  body: string
  /** Optional key-value pairs passed through to the app */
  data?: Record<string, string>
  /** Deep-link or screen route for the app to navigate to on tap */
  link?: string
}

interface FcmMessage {
  message: {
    token: string
    notification: { title: string; body: string }
    data?: Record<string, string>
    android?: { notification: { click_action: string } }
    apns?: { payload: { aps: { category: string } } }
  }
}

// ─── OAuth2 token cache ───────────────────────────────────────────────────────
// We cache the Google OAuth2 access token in memory between invocations.
// Serverless functions are recycled often enough that stale tokens are
// unlikely, but we check expiry defensively.

let cachedToken: { value: string; expiresAt: number } | null = null

async function getGoogleAccessToken(): Promise<string> {
  const now = Date.now()
  // Reuse token if it has more than 5 minutes remaining
  if (cachedToken && cachedToken.expiresAt - now > 5 * 60 * 1000) {
    return cachedToken.value
  }

  const projectId    = process.env.FIREBASE_PROJECT_ID
  const clientEmail  = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey   = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase env vars not set. Add FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.'
    )
  }

  // Build a signed JWT for the service account
  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const iat     = Math.floor(now / 1000)
  const exp     = iat + 3600
  const payload = Buffer.from(JSON.stringify({
    iss:   clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud:   'https://oauth2.googleapis.com/token',
    iat,
    exp,
  })).toString('base64url')

  const { createSign } = await import('crypto')
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${payload}`)
  const signature = signer.sign(privateKey, 'base64url')
  const signedJwt = `${header}.${payload}.${signature}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  signedJwt,
    }),
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    throw new Error(`Failed to get Google access token: ${err}`)
  }

  const { access_token, expires_in } = await tokenRes.json() as {
    access_token: string
    expires_in: number
  }

  cachedToken = { value: access_token, expiresAt: now + expires_in * 1000 }
  return access_token
}

// ─── Send to a single FCM token ───────────────────────────────────────────────

async function sendToToken(
  fcmToken: string,
  payload: PushPayload,
  accessToken: string
): Promise<{ success: boolean; shouldDeactivate: boolean }> {
  const projectId = process.env.FIREBASE_PROJECT_ID!

  const message: FcmMessage = {
    message: {
      token: fcmToken,
      notification: { title: payload.title, body: payload.body },
      ...(payload.data && { data: payload.data }),
    },
  }

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method:  'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    }
  )

  if (res.ok) return { success: true, shouldDeactivate: false }

  const error = await res.json().catch(() => ({})) as { error?: { status?: string } }
  const status = error?.error?.status

  // UNREGISTERED or INVALID_ARGUMENT (bad token) → deactivate
  const shouldDeactivate =
    status === 'UNREGISTERED' ||
    status === 'INVALID_ARGUMENT' ||
    res.status === 404

  console.error(
    `[pushNotification] FCM send failed for token ${fcmToken.slice(0, 20)}...:`,
    status ?? res.status
  )

  return { success: false, shouldDeactivate }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Send a push notification to all active devices registered for a user.
 * Silently deactivates stale tokens that FCM reports as invalid.
 *
 * @returns number of devices successfully notified
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<number> {
  const devices = await prisma.deviceToken.findMany({
    where:  { userId, active: true },
    select: { id: true, token: true },
  })

  if (devices.length === 0) return 0

  let accessToken: string
  try {
    accessToken = await getGoogleAccessToken()
  } catch (err) {
    console.error('[pushNotification] Could not get FCM access token:', err)
    return 0
  }

  const results = await Promise.allSettled(
    devices.map((d) => sendToToken(d.token, payload, accessToken))
  )

  const toDeactivate: string[] = []
  let successCount = 0

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      if (result.value.success) successCount++
      if (result.value.shouldDeactivate) toDeactivate.push(devices[i].id)
    }
  })

  // Deactivate stale tokens in the background
  if (toDeactivate.length > 0) {
    prisma.deviceToken
      .updateMany({
        where: { id: { in: toDeactivate } },
        data:  { active: false },
      })
      .catch((err) =>
        console.error('[pushNotification] Failed to deactivate stale tokens:', err)
      )
  }

  return successCount
}

/**
 * Send a push notification to a list of userIds (e.g. all clients of an instructor).
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<void> {
  await Promise.allSettled(userIds.map((id) => sendPushToUser(id, payload)))
}
