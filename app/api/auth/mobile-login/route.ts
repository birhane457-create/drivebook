import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { normalizeEmail } from '@/lib/auth-email'
import { authRateLimit, checkRateLimitStrict, getRateLimitIdentifier } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    const ip = req.headers.get('x-forwarded-for')
    const rateLimitId = getRateLimitIdentifier(undefined, ip, 'mobile-login')
    const rateLimitResult = await checkRateLimitStrict(authRateLimit, rateLimitId)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429, headers: rateLimitResult.headers }
      )
    }

    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const normalizedEmail = normalizeEmail(email)

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
            phone: true,
            profileImage: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // Instructor-only email verification enforcement
    if (user.role === 'INSTRUCTOR' && !user.emailVerified) {
      return NextResponse.json({ error: 'Please verify your email before logging in.' }, { status: 403 })
    }

    if (!user.password) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        instructorId: user.instructor?.id,
      },
      process.env.NEXTAUTH_SECRET!,
      { expiresIn: '30d' }
    )

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.instructor?.name || user.email,
        instructor: user.instructor,
      },
    })
  } catch (error) {
    logger.error('Mobile login error:', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
