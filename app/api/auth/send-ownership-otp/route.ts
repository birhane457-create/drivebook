import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
});

const OTP_COOLDOWN_MS = 60_000;      // 1 minute between sends
const OTP_EXPIRY_MS   = 10 * 60_000; // 10-minute code window

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = schema.parse(body);

    const user = await (prisma.user.findUnique({
      where: { email },
      select: { id: true, ownershipOtpToken: true, ownershipOtpExpiry: true },
    }) as any);

    // No account — return 200 silently (no information leak)
    if (!user) return NextResponse.json({ success: true });

    // Server-enforced cooldown: reject if a code was sent within the last 60 s
    if (
      user.ownershipOtpToken &&
      user.ownershipOtpExpiry &&
      new Date(user.ownershipOtpExpiry) > new Date() &&
      new Date(user.ownershipOtpExpiry).getTime() - OTP_EXPIRY_MS + OTP_COOLDOWN_MS > Date.now()
    ) {
      return NextResponse.json(
        { error: 'Please wait before requesting another code.', code: 'OTP_COOLDOWN' },
        { status: 429 }
      );
    }

    // Cryptographically secure 6-digit OTP
    // randomBytes(3) gives 3 bytes = 0..16777215; modulo 900000 + 100000 gives 100000..999999
    const otpNum = (randomBytes(3).readUIntBE(0, 3) % 900000) + 100000;
    const otp    = String(otpNum);
    const expiry = new Date(Date.now() + OTP_EXPIRY_MS);

    // Store in dedicated ownershipOtp fields — does not touch resetToken or verificationToken
    await (prisma.user.update({
      where: { id: user.id },
      data: {
        ownershipOtpToken:    otp,
        ownershipOtpExpiry:   expiry,
        ownershipOtpAttempts: 0, // reset attempt counter on new code
      },
    }) as any);

    try {
      const { emailService } = await import('@/lib/services/email');
      await emailService.sendGenericEmail({
        from: process.env.EMAIL_FROM || process.env.SMTP_FROM || 'DriveBook <hello@drivebook.com.au>',
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
      console.log('[send-ownership-otp] OTP email sent to:', email);
    } catch (emailErr) {
      // Log the actual error so it surfaces in dev server output
      console.error('[send-ownership-otp] Email send failed:', emailErr instanceof Error ? emailErr.message : emailErr);
      // Non-fatal — still return 200 so the client shows the OTP input
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to send code' }, { status: 500 });
  }
}
