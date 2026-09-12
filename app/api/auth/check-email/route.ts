import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeEmail } from '@/lib/auth-email'
import { authRateLimit, checkRateLimitStrict, getRateLimitIdentifier } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')
    const rateLimitId = getRateLimitIdentifier(undefined, ip, 'check-email')
    const rateLimitResult = await checkRateLimitStrict(authRateLimit, rateLimitId)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const normalizedEmail = normalizeEmail(email)

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    return NextResponse.json({
      exists: !!existingUser,
      email: normalizedEmail,
    })
  } catch (error) {
    console.error('Error checking email:', error)
    return NextResponse.json({ error: 'Failed to check email' }, { status: 500 })
  }
}
