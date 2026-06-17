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
 * Security: Token is single-use and expires in 24 hours
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')
    
    if (!token) {
      return NextResponse.redirect(new URL('/login?error=invalid_token', req.url))
    }

    // Find user with valid token
    const user = await prisma.user.findFirst({
      where: {
        verificationToken: token,
        verificationTokenExpiry: { gt: new Date() }
      }
    })

    if (!user) {
      return NextResponse.redirect(
        new URL('/login?error=expired_token&message=Verification link expired', req.url)
      )
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

    return NextResponse.redirect(new URL('/login?verified=true', req.url))
  } catch (error) {
    logger.error('email verification failed', { error: String(error) })
    return NextResponse.redirect(
      new URL('/login?error=verification_failed', req.url)
    )
  }
}
