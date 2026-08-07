import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emailService } from '@/lib/services/email'
import { normalizeEmail } from '@/lib/auth-email'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/resend-verification
 *
 * Resends the email verification link to an unverified instructor account.
 * Always returns 200 to prevent email enumeration — the caller cannot tell
 * whether the email exists in the system.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const rawEmail = body.email?.trim()
    if (!rawEmail) {
      return NextResponse.json({ success: true }) // silent — no enumeration
    }

    const email = normalizeEmail(rawEmail)

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true, emailVerified: true, name: true },
    })

    // Only resend for unverified instructors — silently succeed for anything else
    if (!user || user.role !== 'INSTRUCTOR' || user.emailVerified) {
      return NextResponse.json({ success: true })
    }

    // Generate a new verification token (24h expiry)
    const token = crypto.randomUUID()
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken: token,
        verificationTokenExpiry: expiry,
      },
    })

    const verifyUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${token}`

    await emailService.sendGenericEmail({
      from: 'DriveBook Account Verification <verification@drivebook.com.au>',
      to: email,
      subject: 'Verify your DriveBook account',
      html: `
        <h2>Verify your email address</h2>
        <p>Hi ${user.name || 'there'},</p>
        <p>Click the button below to verify your email and activate your DriveBook instructor account.</p>
        <p style="margin:24px 0;">
          <a href="${verifyUrl}"
             style="background:#7c3aed;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;">
            Verify Email Address
          </a>
        </p>
        <p style="color:#6b7280;font-size:13px;">
          This link expires in 24 hours. If you didn't create a DriveBook account, ignore this email.
        </p>
        <p style="color:#9ca3af;font-size:12px;">
          Or copy this link: ${verifyUrl}
        </p>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Resend verification error:', error)
    // Still return 200 — never reveal internal errors on this endpoint
    return NextResponse.json({ success: true })
  }
}
