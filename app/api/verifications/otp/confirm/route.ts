/**
 * POST /api/verifications/otp/confirm
 *
 * Confirms an OTP code and returns a short-lived verification token.
 * The token can be used to authorize sensitive actions (cancel, reschedule).
 *
 * Max 3 failed attempts before lockout (per verificationId).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const schema = z.object({
  verificationId: z.string().uuid(),
  code: z.string().length(6),
  phone: z.string().optional(),
  email: z.string().email().optional(),
}).refine(d => d.phone || d.email, { message: 'phone or email required' });

// Track failed attempts per verificationId
const failedAttempts = new Map<string, number>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);

    // Check lockout
    const attempts = failedAttempts.get(data.verificationId) ?? 0;
    if (attempts >= 3) {
      return NextResponse.json(
        { error: 'Too many failed attempts. This verification is locked.', locked: true },
        { status: 429 }
      );
    }

    // Find user by phone or email
    let user = null;
    if (data.email) {
      user = await prisma.user.findUnique({ where: { email: data.email } });
    } else if (data.phone) {
      const client = await prisma.client.findFirst({
        where: { phone: data.phone.replace(/\s/g, '') },
        include: { user: true },
      });
      user = client?.user ?? null;
    }

    if (!user?.resetToken || !user.resetTokenExpiry) {
      failedAttempts.set(data.verificationId, attempts + 1);
      return NextResponse.json({ error: 'Invalid or expired verification code', valid: false }, { status: 400 });
    }

    // Check expiry
    if (new Date() > user.resetTokenExpiry) {
      failedAttempts.set(data.verificationId, attempts + 1);
      return NextResponse.json({ error: 'Verification code has expired', valid: false, expired: true }, { status: 400 });
    }

    // Parse stored OTP: format is "otp:{verificationId}:{code}"
    const parts = user.resetToken.split(':');
    if (parts.length !== 3 || parts[0] !== 'otp') {
      failedAttempts.set(data.verificationId, attempts + 1);
      return NextResponse.json({ error: 'Invalid verification code', valid: false }, { status: 400 });
    }

    const [, storedVerificationId, storedCode] = parts;

    if (storedVerificationId !== data.verificationId || storedCode !== data.code) {
      failedAttempts.set(data.verificationId, attempts + 1);
      const remaining = 3 - (attempts + 1);
      return NextResponse.json(
        { error: `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`, valid: false, attemptsRemaining: remaining },
        { status: 400 }
      );
    }

    // OTP is valid — clear it and generate a verification token
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: null, resetTokenExpiry: null },
    });

    // Clean up failed attempts
    failedAttempts.delete(data.verificationId);

    // Generate a short-lived verification token (valid for 10 minutes)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 10 * 60 * 1000);

    // Store token for use in cancel/reschedule
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: `verified:${verificationToken}`,
        resetTokenExpiry: tokenExpiry,
      },
    });

    return NextResponse.json({
      success: true,
      valid: true,
      verificationToken,
      expiresAt: tokenExpiry.toISOString(),
      message: 'Identity verified successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('OTP confirm error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
