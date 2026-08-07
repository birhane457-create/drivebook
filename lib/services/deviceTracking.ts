// lib/services/deviceTracking.ts
//
// Device identity and login tracking for security notifications.
//
// IDENTITY STRATEGY:
// Device identity = SHA-256 of a UUID stored in browser localStorage.
// IP and User-Agent = stored as login context only, never used for identity.
//
// This means network changes (Wi-Fi → mobile data → VPN) never produce
// false "new device" alerts. Only a different browser or cleared storage does.
//
// SECURITY NOTE on localStorage:
// The device token is not an authentication credential. It must never be used
// to bypass MFA, grant permissions, or authenticate a user. Its sole purpose
// is triggering a notification email so the account holder is aware of a new
// browser being used.

import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

export const DEVICE_STORAGE_KEY = 'drivebook_device_id'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// ── Browser helper ────────────────────────────────────────────────────────────

export function getOrCreateDeviceToken(): string {
  if (typeof window === 'undefined') {
    throw new Error('getOrCreateDeviceToken must be called in the browser')
  }
  let token = localStorage.getItem(DEVICE_STORAGE_KEY)
  if (!token || !UUID_PATTERN.test(token)) {
    token = window.crypto.randomUUID()
    localStorage.setItem(DEVICE_STORAGE_KEY, token)
  }
  return token
}

// ── Server helpers ────────────────────────────────────────────────────────────

export function validateDeviceToken(deviceToken: unknown): deviceToken is string {
  return typeof deviceToken === 'string' && UUID_PATTERN.test(deviceToken)
}

export function generateFingerprint(deviceToken: string): string {
  return crypto.createHash('sha256').update(deviceToken).digest('hex')
}

export function getClientIP(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return headers.get('x-real-ip') || '0.0.0.0'
}

export async function recordDeviceLogin(
  userId: string,
  deviceToken: string,
  ipAddress: string,
  userAgent: string,
): Promise<{ isNewDevice: boolean; deviceId: string }> {
  if (!validateDeviceToken(deviceToken)) {
    console.warn('[DeviceTracking] Invalid device token format — skipping')
    return { isNewDevice: false, deviceId: 'invalid-token' }
  }

  const fingerprint = generateFingerprint(deviceToken)

  try {
    const existing = await prisma.loginDevice.findUnique({
      where: { userId_fingerprint: { userId, fingerprint } },
    })

    const device = await prisma.loginDevice.upsert({
      where: { userId_fingerprint: { userId, fingerprint } },
      create: { userId, fingerprint, ipAddress, userAgent },
      update: { lastUsedAt: new Date(), ipAddress, userAgent },
    })

    return { isNewDevice: !existing, deviceId: device.id }

  } catch (err: any) {
    if (err?.code === 'P2021' || err?.message?.includes('does not exist')) {
      console.warn('[DeviceTracking] LoginDevice table not found — run migration')
      return { isNewDevice: false, deviceId: 'pending-migration' }
    }
    throw err
  }
}

export function parseUserAgent(userAgent: string): string {
  const ua = userAgent || ''
  let browser = 'Unknown Browser'
  let os = 'Unknown OS'

  if (ua.includes('Edg/')) browser = 'Microsoft Edge'
  else if (ua.includes('OPR/') || ua.includes('Opera/')) browser = 'Opera'
  else if (ua.includes('Firefox/')) browser = 'Firefox'
  else if (ua.includes('Chrome/')) browser = 'Chrome'
  else if (ua.includes('Safari/')) browser = 'Safari'

  if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iPod')) os = 'iOS'
  else if (ua.includes('Android')) os = 'Android'
  else if (ua.includes('Windows NT')) os = 'Windows'
  else if (ua.includes('Mac OS X')) os = 'macOS'
  else if (ua.includes('Linux')) os = 'Linux'

  return `${browser} on ${os}`
}

export async function getUserDevices(userId: string, limit = 10) {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 50)
  try {
    return await prisma.loginDevice.findMany({
      where: { userId },
      orderBy: { lastUsedAt: 'desc' },
      take: safeLimit,
    })
  } catch (error) {
    console.error('[DeviceTracking] Failed to get user devices', error)
    return []
  }
}

export async function trustDevice(deviceId: string, userId: string) {
  await prisma.loginDevice.updateMany({
    where: { id: deviceId, userId },
    data: { trusted: true },
  })
}

export async function cleanupOldDevices(daysInactive = 90): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysInactive)
  try {
    const result = await prisma.loginDevice.deleteMany({
      where: { lastUsedAt: { lt: cutoff }, trusted: false },
    })
    return result.count
  } catch (error) {
    console.error('[DeviceTracking] Failed to clean old devices', error)
    return 0
  }
}
