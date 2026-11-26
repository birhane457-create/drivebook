import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  otp:   z.string().length(6),
});

// Max failed attempts before lockout (per unexpired OTP window)
const MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, otp } = schema.parse(body);

    const user = await (prisma.user.findUnique({
      where: { email },
      select: { id: true, resetToken: true, resetTokenExpiry: true },
    }) as any);

    if (!user || !user.resetToken || !user.resetTokenExpiry) {
      return NextResponse.json(
        { error: 'No verification code found. Please request a new code.', code: 'OTP_NOT_FOUND' },
        { status: 400 }
      );
    }

    if (new Date(user.resetTokenExpiry) <= new Date()) {
      return NextResponse.json(
        { error: 'This code has expired. Please request a new one.', code: 'OTP_EXPIRED' },
        { status: 400 }
      );
    }

    if (user.resetToken !== otp) {
      return NextResponse.json(
        { error: 'Incorrect code. Please check your email and try again.', code: 'OTP_WRONG' },
        { status: 400 }
      );
    }

    // Correct — consume the token (single-use)
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: null, resetTokenExpiry: null },
    });

    // Return a short-lived session token the client includes in the booking submission.
    // We reuse a fresh UUID written back to resetToken so the bulk route can verify it.
    // Expiry: 15 minutes (enough to complete the booking form).
    const sessionToken = crypto.randomUUID();
    const sessionExpiry = new Date(Date.now() + 15 * 60_000);

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: sessionToken, resetTokenExpiry: sessionExpiry },
    });

    return NextResponse.json({ success: true, token: sessionToken });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
