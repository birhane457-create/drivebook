import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  otp:   z.string().length(6),
});

const MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, otp } = schema.parse(body);

    const user = await (prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        ownershipOtpToken: true,
        ownershipOtpExpiry: true,
        ownershipOtpAttempts: true,
      },
    }) as any);

    if (!user || !user.ownershipOtpToken || !user.ownershipOtpExpiry) {
      return NextResponse.json(
        { error: 'No verification code found. Please request a new code.', code: 'OTP_NOT_FOUND' },
        { status: 400 }
      );
    }

    if (new Date(user.ownershipOtpExpiry) <= new Date()) {
      return NextResponse.json(
        { error: 'This code has expired. Please request a new one.', code: 'OTP_EXPIRED' },
        { status: 400 }
      );
    }

    // Enforce failed-attempt lockout (server-side)
    if ((user.ownershipOtpAttempts ?? 0) >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: 'Too many incorrect attempts. Please request a new code.', code: 'OTP_LOCKED' },
        { status: 429 }
      );
    }

    if (user.ownershipOtpToken !== otp) {
      // Increment and persist the attempt counter
      await (prisma.user.update({
        where: { id: user.id },
        data: { ownershipOtpAttempts: { increment: 1 } },
      }) as any);
      const remaining = MAX_ATTEMPTS - ((user.ownershipOtpAttempts ?? 0) + 1);
      return NextResponse.json(
        {
          error: remaining > 0
            ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
            : 'Too many incorrect attempts. Please request a new code.',
          code: 'OTP_WRONG',
        },
        { status: 400 }
      );
    }

    // Correct — consume the OTP and issue a single-use session token
    const sessionToken  = crypto.randomUUID();
    const sessionExpiry = new Date(Date.now() + 15 * 60_000); // 15 minutes

    // Atomically: consume the 6-digit code, write the session token, reset attempts.
    // Storing the session token in the same ownershipOtp field chain keeps it
    // single-use — the bulk route consumes it on link.
    await (prisma.user.update({
      where: {
        id: user.id,
        // Guard: only succeed if the code hasn't changed (prevents race)
        ownershipOtpToken: otp,
      },
      data: {
        ownershipOtpToken:    sessionToken,
        ownershipOtpExpiry:   sessionExpiry,
        ownershipOtpAttempts: 0,
      },
    }) as any);

    return NextResponse.json({ success: true, token: sessionToken });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
