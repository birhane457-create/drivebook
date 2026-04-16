import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services/email';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpiry: expiry } as any,
    });

    const baseUrl = process.env.NEXTAUTH_URL || 'https://drivebook.com.au';
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    await emailService.sendGenericEmail({
      to: user.email,
      subject: 'Password Reset — DriveBook Support',
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111827">
          <div style="background:#1d4ed8;color:white;padding:24px 32px;border-radius:8px 8px 0 0">
            <h2 style="margin:0">Password Reset Request</h2>
          </div>
          <div style="background:#f9fafb;padding:24px 32px;border-radius:0 0 8px 8px">
            <p>Hi ${user.name || user.email.split('@')[0]},</p>
            <p>A password reset was initiated for your DriveBook account by our support team.</p>
            <p>Click the button below to set a new password. This link expires in 24 hours.</p>
            <div style="text-align:center;margin:24px 0">
              <a href="${resetUrl}" style="background:#1d4ed8;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px">
                Reset My Password
              </a>
            </div>
            <p style="color:#6b7280;font-size:13px">
              If you didn't request this, you can ignore this email — your password won't change.<br>
              Link: ${resetUrl}
            </p>
          </div>
        </div>
      `,
    });

    // Audit log
    await (prisma as any).auditLog.create({
      data: {
        action: 'ADMIN_PASSWORD_RESET_SENT',
        actorId: session.user.id!,
        actorRole: session.user.role,
        targetType: 'USER',
        targetId: user.id,
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        metadata: { recipientEmail: user.email },
      },
    });

    return NextResponse.json({ success: true, message: `Password reset email sent to ${user.email}` });
  } catch (error) {
    console.error('Admin reset password error:', error);
    return NextResponse.json({ error: 'Failed to send reset email' }, { status: 500 });
  }
}
