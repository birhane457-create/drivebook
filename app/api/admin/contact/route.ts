import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services/email';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const schema = z.object({
  userId: z.string(),
  subject: z.string().min(3),
  message: z.string().min(10),
  type: z.enum(['email', 'notification', 'both']).default('both'),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const data = schema.parse(body);

    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const adminName = session.user.name || 'DriveBook Support';
    const results: string[] = [];

    // Send email
    if (data.type === 'email' || data.type === 'both') {
      await emailService.sendGenericEmail({
        to: user.email,
        subject: data.subject,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111827">
            <div style="background:#1d4ed8;color:white;padding:24px 32px;border-radius:8px 8px 0 0">
              <h2 style="margin:0;font-size:20px">Message from DriveBook Support</h2>
            </div>
            <div style="background:#f9fafb;padding:24px 32px;border-radius:0 0 8px 8px">
              <p>Hi ${user.name || user.email.split('@')[0]},</p>
              <div style="background:white;border-radius:8px;padding:16px;margin:16px 0;border-left:4px solid #1d4ed8">
                ${data.message.replace(/\n/g, '<br>')}
              </div>
              <p style="color:#6b7280;font-size:13px;margin-top:24px">
                This message was sent by ${adminName} from the DriveBook admin team.<br>
                If you have questions, reply to this email or contact support.
              </p>
            </div>
          </div>
        `,
      });
      results.push('email sent');
    }

    // Send in-app notification
    if (data.type === 'notification' || data.type === 'both') {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: 'NEW_MESSAGE',
          title: data.subject,
          message: data.message.substring(0, 200),
          isRead: false,
        },
      });
      results.push('notification sent');
    }

    // Audit log
    await (prisma as any).auditLog.create({
      data: {
        action: 'ADMIN_CONTACT_SENT',
        actorId: session.user.id!,
        actorRole: session.user.role,
        targetType: 'USER',
        targetId: user.id,
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        metadata: { subject: data.subject, type: data.type, recipientEmail: user.email },
      },
    });

    return NextResponse.json({ success: true, results });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Admin contact error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
