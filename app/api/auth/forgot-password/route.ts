import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emailService } from '@/lib/services/email'
import { normalizeEmail } from '@/lib/auth-email'
import { authRateLimit, checkRateLimitStrict, getRateLimitIdentifier } from '@/lib/ratelimit'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')
    const rateLimitId = getRateLimitIdentifier(undefined, ip, 'forgot-password')
    const rateLimitResult = await checkRateLimitStrict(authRateLimit, rateLimitId)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const { email } = await req.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const normalizedEmail = normalizeEmail(email)

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists with that email, a password reset link has been sent.',
      })
    }

    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetTokenExpiry = new Date(Date.now() + 3600000)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      } as any,
    })

    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${resetToken}`

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        await (emailService as any).sendPasswordResetEmail({
          email: user.email,
          resetUrl,
          userName: user.email,
        })
      } catch (emailError) {
        console.error('Failed to send reset email:', emailError)
      }
    } else if (process.env.NODE_ENV === 'development') {
      console.log('SMTP not configured (dev only): password reset email skipped')
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists with that email, a password reset link has been sent.',
      ...(process.env.NODE_ENV === 'development' && { resetUrl }),
    })
  } catch (error) {
    console.error('Forgot password error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Failed to process request'
    const errorDetails =
      process.env.NODE_ENV === 'development'
        ? { error: errorMessage, details: error }
        : { error: 'Failed to process request' }

    return NextResponse.json(errorDetails, { status: 500 })
  }
}
