// app/api/instructor/devices/route.ts
//
// GET  — list recognised devices for the current instructor
// DELETE — remove all devices except the current one ("remove all others")

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  getUserDevices,
  generateFingerprint,
  validateDeviceToken,
  parseUserAgent,
} from '@/lib/services/deviceTracking'
import { prisma } from '@/lib/prisma'

// ── GET — list devices ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Identify the current device from the token sent in the X-Device-Token header
  const currentFingerprint = resolveCurrentFingerprint(req)

  const devices = await getUserDevices(session.user.id, 20)

  const response = devices.map((d: any) => ({
    id: d.id,
    deviceName: parseUserAgent(d.userAgent),
    lastUsedAt: d.lastUsedAt,
    firstSeenAt: d.firstSeenAt,
    trusted: d.trusted,
    // Server compares fingerprints — raw fingerprint is never sent to the client
    isCurrentDevice: currentFingerprint !== null && d.fingerprint === currentFingerprint,
  }))

  return NextResponse.json(response)
}

// ── DELETE — remove all devices except current ────────────────────────────────

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Current device is determined server-side — never trust a client-supplied ID
  const currentFingerprint = resolveCurrentFingerprint(req)

  try {
    // Find the current device ID so we can exclude it from deletion
    const currentDevice = await prisma.loginDevice.findFirst({
      where: {
        userId: session.user.id,
        fingerprint: currentFingerprint ?? '__no_match__',
      },
      select: { id: true },
    })

    const currentDeviceId = currentDevice?.id ?? null

    const result = await prisma.loginDevice.deleteMany({
      where: {
        userId: session.user.id,
        ...(currentDeviceId ? { id: { not: currentDeviceId } } : {}),
      },
    })

    return NextResponse.json({ success: true, removed: result.count })

  } catch (err: any) {
    if (err?.code === 'P2021' || err?.message?.includes('does not exist')) {
      return NextResponse.json({ error: 'Device table not yet migrated' }, { status: 503 })
    }
    throw err
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Extract and hash the device token from X-Device-Token request header.
 * Returns null if missing or invalid — caller treats null as "unknown device".
 */
function resolveCurrentFingerprint(req: NextRequest): string | null {
  const token = req.headers.get('x-device-token')
  if (!token || !validateDeviceToken(token)) return null
  return generateFingerprint(token)
}
