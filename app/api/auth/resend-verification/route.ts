import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { normalizeEmail } from '@/lib/auth-email'
import { authRateLimit, checkRateLimitStrict, getRateLimitIdentifier } from '@/lib/ratelimit'
import { emailService } from '@/lib/services/email'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/resend-verification
 *
 * Instructor-only email verification resend.
 * Always returns success to prevent enumeration.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')
    const rateLimitId = getRateLimitIdentifier(undefined, ip, 'resend-verification')
    const rateLimitResult = await checkRateLimitStrict(authRateLimit, rateLimitId)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const body = await req.json().catch(() => ({}))
    const emailRaw = typeof body?.email === 'string' ? body.email : ''
    if (!emailRaw) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const email = normalizeEmail(emailRaw)

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerified: true,
      },
    })

    // Always succeed (anti-enumeration)
    if (!user || user.role !== 'INSTRUCTOR' || user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: 'If your account requires verification, a verification email has been sent.',
      })
    }

    const verificationToken = crypto.randomBytes(32).toString('hex')
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken,
        verificationTokenExpiry,
      } as any,
    })

    const verifyUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${verificationToken}`

    // If SMTP is not configured, we still return success (avoid blocking onboarding).
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        await emailService.sendGenericEmail({
          to: user.email,
          subject: 'Verify your DriveBook instructor email',
          html: `
            <h2>Verify your email</h2>
            <p>Please verify your email to access the instructor dashboard.</p>
            <p><a href="${verifyUrl}" style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Verify Email →</a></p>
            <p style="color:#6b7280;font-size:13px;">This link expires in 24 hours.</p>
          `,
        })
      } catch {
        // non-blocking
      }
    }

    return NextResponse.json({
      success: true,
      message: 'If your account requires verification, a verification email has been sent.',
    })
  } catch (error) {
    console.error('Resend verification error:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}

