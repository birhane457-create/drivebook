import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SignJWT } from 'jose';

export const dynamic = 'force-dynamic';

/**
 * Email Verification with Magic Link Auto-Login
 * 
 * This endpoint:
 * 1. Verifies the email
 * 2. Auto-logs in the user (magic link)
 * 3. Redirects to dashboard
 * 
 * Security: Token is single-use and expires in 24 hours
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');
    
    if (!token) {
      return NextResponse.redirect(new URL('/login?error=invalid_token', req.url));
    }

    // Find user with valid token
    const user = await prisma.user.findFirst({
      where: {
        verificationToken: token,
        verificationTokenExpiry: { gt: new Date() }
      }
    });

    if (!user) {
      return NextResponse.redirect(
        new URL('/login?error=expired_token&message=Verification link expired', req.url)
      );
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
    });

    // ✅ MAGIC LINK: Auto-login by creating session token
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'fallback-secret');
    const sessionToken = await new SignJWT({
      sub: user.id,
      email: user.email,
      role: user.role,
      emailVerified: true
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret);

    // Create response with session cookie
    const response = NextResponse.redirect(
      new URL('/client-dashboard?verified=true', req.url)
    );

    // Set session cookie — must match the name NextAuth uses for the environment
    // Production (https): __Secure-next-auth.session-token
    // Development (http):  next-auth.session-token
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieName = isProduction
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token';

    response.cookies.set(cookieName, sessionToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/'
    });

    console.log(`✅ Email verified + auto-login: ${user.email}`);

    return response;
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.redirect(
      new URL('/login?error=verification_failed', req.url)
    );
  }
}
