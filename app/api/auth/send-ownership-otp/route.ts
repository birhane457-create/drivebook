import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
});

// Rate limit: 1 OTP per 60 seconds per email (checked server-side)
const OTP_COOLDOWN_MS = 60_000;
const OTP_EXPIRY_MS   = 10 * 60_000; // 10 minutes

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = schema.parse(body);

    const user = await (prisma.user.findUnique({
      where: { email },
      select: { id: true, resetToken: true, resetTokenExpiry: true },
    }) as any);

    // If no account exists just return 200 — no information leak
    if (!user) return NextResponse.json({ success: true });

    // Enforce cooldown — if a valid unexpired OTP was sent within the last 60 s, refuse
    if (
      user.resetToken &&
      user.resetTokenExpiry &&
      new Date(user.resetTokenExpiry) > new Date() &&
      new Date(user.resetTokenExpiry).getTime() - OTP_EXPIRY_MS + OTP_COOLDOWN_MS > Date.now()
    ) {
      return NextResponse.json(
        { error: 'Please wait before requesting another code.', code: 'OTP_COOLDOWN' },
        { status: 429 }
      );
    }

    // Generate 6-digit OTP
    const otp    = String(Math.floor(100000 + Math.random() * 900000));
    const expiry = new Date(Date.now() + OTP_EXPIRY_MS);

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: otp, resetTokenExpiry: expiry },
    });

    // Send email
    try {
      const { emailService } = await import('@/lib/services/email');
      await emailService.sendGenericEmail({
        from: 'DriveBook <hello@drivebook.com.au>',
        to: email,
        subject: 'Your DriveBook verification code',
        html: `
          <p style="font-family:Arial,sans-serif;font-size:15px;color:#333">
            Someone is trying to connect a booking to your DriveBook account.
          </p>
          <p style="font-family:Arial,sans-serif;font-size:15px;color:#333">
            Your verification code is:
          </p>
          <p style="font-family:Arial,sans-serif;font-size:36px;font-weight:bold;
                     letter-spacing:8px;color:#1a1a1a;margin:16px 0">
            ${otp}
          </p>
          <p style="font-family:Arial,sans-serif;font-size:13px;color:#666">
            This code expires in 10 minutes.<br>
            If you did not start this booking, ignore this email —
            your account will not be affected.
          </p>
        `,
      });
    } catch {
      // Non-fatal — still return success so the client shows the input
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to send code' }, { status: 500 });
  }
}
