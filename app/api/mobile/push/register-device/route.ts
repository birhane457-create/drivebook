/**
 * POST /api/mobile/push/register-device
 *
 * Registers (or refreshes) a Capacitor push notification device token for the
 * authenticated user.  Called by the mobile app on every launch and after the
 * OS grants / refreshes a push permission token.
 *
 * Auth: Bearer JWT (same secret as NextAuth — used by all /api/mobile/* routes)
 *
 * Body: { token: string, platform: "android" | "ios" | "web" }
 *
 * Behaviour:
 *  - If the token already exists for this user → update `active = true` and
 *    refresh `updatedAt`.
 *  - If the token exists but belongs to a DIFFERENT user (e.g. shared device
 *    after logout) → deactivate old record, create new one for current user.
 *  - Old tokens for the same user that haven't been seen in 90 days are soft-
 *    deactivated (active = false) in a background-safe way without blocking the
 *    response.
 *
 * DELETE /api/mobile/push/register-device
 *
 * Deregisters a token when the user logs out of the app, so they stop
 * receiving notifications on that device.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

const VALID_PLATFORMS = ['android', 'ios', 'web'] as const
type Platform = (typeof VALID_PLATFORMS)[number]

// ─── Auth helper ─────────────────────────────────────────────────────────────

function verifyMobileJwt(req: NextRequest): { userId: string } | null {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  try {
    const decoded = jwt.verify(
      authHeader.substring(7),
      process.env.NEXTAUTH_SECRET!
    ) as { sub?: string; userId?: string }
    const userId = decoded.sub ?? decoded.userId
    if (!userId) return null
    return { userId }
  } catch {
    return null
  }
}

// ─── POST — register / refresh a token ───────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = verifyMobileJwt(req)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { token?: unknown; platform?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { token, platform } = body

  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 })
  }

  if (!platform || !VALID_PLATFORMS.includes(platform as Platform)) {
    return NextResponse.json(
      { error: `platform must be one of: ${VALID_PLATFORMS.join(', ')}` },
      { status: 400 }
    )
  }

  const trimmedToken = token.trim()

  // Upsert: if the exact token string already exists, claim it for this user
  // and mark active.  This handles the "same device, same user re-launches app"
  // case without creating duplicate rows.
  await prisma.deviceToken.upsert({
    where: { token: trimmedToken },
    update: {
      userId: auth.userId,        // re-claim if device was shared
      platform: platform as string,
      active: true,
      updatedAt: new Date(),
    },
    create: {
      userId: auth.userId,
      token: trimmedToken,
      platform: platform as string,
      active: true,
    },
  })

  // Fire-and-forget: soft-deactivate tokens for this user that are stale
  // (not updated in 90 days). We don't await this — it's best-effort cleanup.
  const staleThreshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  prisma.deviceToken
    .updateMany({
      where: {
        userId: auth.userId,
        token: { not: trimmedToken },
        active: true,
        updatedAt: { lt: staleThreshold },
      },
      data: { active: false },
    })
    .catch((err) =>
      console.error('[push/register-device] stale token cleanup failed:', err)
    )

  return NextResponse.json({ success: true }, { status: 200 })
}

// ─── DELETE — deregister on logout ───────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const auth = verifyMobileJwt(req)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { token?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { token } = body
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'token is required' }, { status: 400 })
  }

  // Only deactivate if it belongs to this user — prevents another user from
  // remotely disabling someone else's notifications.
  await prisma.deviceToken.updateMany({
    where: {
      token: token.trim(),
      userId: auth.userId,
    },
    data: { active: false },
  })

  return NextResponse.json({ success: true }, { status: 200 })
}
