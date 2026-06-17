import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { logger } from '@/lib/logger'
import { authRateLimit, checkRateLimitStrict, getRateLimitIdentifier } from '@/lib/ratelimit'

const MIN_PASSWORD_LENGTH = 8

interface SetPasswordRequest {
  token: string
  password: string
}

interface SetPasswordResponse {
  success?: boolean
  error?: string
  message?: string
}

export async function POST(req: NextRequest): Promise<NextResponse<SetPasswordResponse>> {
  try {
    const ip = req.headers.get('x-forwarded-for')
    const rateLimitId = getRateLimitIdentifier(undefined, ip, 'set-password')
    const rateLimitResult = await checkRateLimitStrict(authRateLimit, rateLimitId)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const { token, password } = (await req.json()) as SetPasswordRequest

    if (!token || !password) {
      return NextResponse.json({ error: 'Missing token or password' }, { status: 400 })
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      )
    }

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date(),
        },
      },
    })

    if (!user) {
      logger.warn('Set password attempt with invalid or expired token')
      return NextResponse.json(
        { error: 'Setup link expired or invalid. Please request a new link.' },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    })

    logger.info(`User password set successfully via reset link: ${user.email}`)

    return NextResponse.json(
      {
        success: true,
        message: 'Password set successfully. You can now log in.',
      },
      { status: 200 }
    )
  } catch (error) {
    logger.error('Error in set-password endpoint', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'An error occurred. Please try again.' }, { status: 500 })
  }
}
