import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * Email verification (single-use).
 *
 * Instructor verification is enforced at login time; this endpoint only
 * marks the user verified and redirects back to login.
 *
 * Security: Token is single-use and expires in 24 hours.
 *
 * NOTE: Always use NEXTAUTH_URL as redirect base — req.url can be
 * http://0.0.0.0:3000 (Next.js internal bind address) which browsers
 * cannot resolve.
 */

function redirectTo(path: string): NextResponse {
  const base = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
  return NextResponse.redirect(`${base}${path}`)
}

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')

    if (!token) {
      return redirectTo('/login?error=invalid_token')
    }

    // Find user with valid token
    const user = await prisma.user.findFirst({
      where: {
        verificationToken: token,
        verificationTokenExpiry: { gt: new Date() }
      }
    })

    if (!user) {
      return redirectTo('/login?error=expired_token&message=Verification+link+expired')
    }

    // ✅ Verify email and clear token (single-use)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        verificationToken: null,
        verificationTokenExpiry: null
      }
    })

    logger.info('email verified', { userId: user.id })

    return redirectTo('/login?verified=true')
  } catch (error) {
    logger.error('email verification failed', { error: String(error) })
    return redirectTo('/login?error=verification_failed')
  }
}
