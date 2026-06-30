import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services/email';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/requireRole';
import { enqueueNotification, drainRetryQueueAsync } from '@/lib/services/notificationRetry';

export const dynamic = 'force-dynamic';

const suspendSchema = z.object({
  reason: z.string()
    .min(10, 'Suspension reason must be at least 10 characters')
    .max(500, 'Suspension reason cannot exceed 500 characters')
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    // FIX #3: Re-verify admin role from DB
    const auth = await requireAdmin(session);
    if (auth.error) return auth.error;

    const body = await req.json();
    const { reason } = suspendSchema.parse(body);

    const instructor = await prisma.instructor.update({
      where: { id: params.id },
      data: {
        approvalStatus: 'SUSPENDED',
        isActive: false,
      },
      include: {
        user: true,
      },
    });

    // Send suspension email
    try {
      if (instructor.user?.email) {
        await emailService.sendGenericEmail({
          to: instructor.user.email,
          subject: 'Account Suspension Notice',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                .info-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #ef4444; }
                .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1 style="margin: 0;">⚠️ Account Suspended</h1>
                </div>
                <div class="content">
                  <p>Dear ${instructor.name},</p>
                  
                  <p>We regret to inform you that your instructor account on ${process.env.PLATFORM_NAME || 'DriveBook'} has been temporarily suspended.</p>
                  
                  <div class="info-box">
                    <h3 style="margin-top: 0;">Reason for Suspension:</h3>
                    <p>${reason}</p>
                  </div>
                  
                  <p><strong>What this means:</strong></p>
                  <ul>
                    <li>Your profile is no longer visible to students</li>
                    <li>You cannot accept new bookings</li>
                    <li>Existing bookings may be affected</li>
                    <li>Access to your dashboard is restricted</li>
                  </ul>
                  
                  <p><strong>Next Steps:</strong></p>
                  <ul>
                    <li>Review the reason for suspension carefully</li>
                    <li>Contact our support team to discuss the situation</li>
                    <li>Provide any additional information or clarification</li>
                    <li>Work with us to resolve the issue</li>
                  </ul>
                  
                  <div style="text-align: center;">
                    <a href="mailto:${process.env.ADMIN_EMAIL || 'support@drivebook.com'}" class="button">Contact Support</a>
                  </div>
                  
                  <p><strong>Support Contact:</strong><br>
                  Email: ${process.env.ADMIN_EMAIL || 'support@drivebook.com'}</p>
                  
                  <p>We take these matters seriously and are committed to maintaining a safe and professional platform for all users.</p>
                  
                  <p>Best regards,<br>The ${process.env.PLATFORM_NAME || 'DriveBook'} Team</p>
                  
                  <div class="footer">
                    <p>${process.env.PLATFORM_NAME || 'DriveBook'} - Your Driving Instructor Platform</p>
                  </div>
                </div>
              </div>
            </body>
            </html>
          `
        });
      }
    } catch (emailError) {
      console.error('Failed to send suspension email:', emailError);
      if (instructor.user?.email) {
        await enqueueNotification({
          channel: 'EMAIL',
          recipient: instructor.user.email,
          subject: 'Account Suspension Notice',
          body: `<p>Dear ${instructor.name}, your instructor account has been suspended. Reason: ${reason}. Please contact support at ${process.env.ADMIN_EMAIL || 'support@drivebook.com'}.</p>`,
          idempotencyKey: `instructor-suspend-email-${params.id}`,
        })
        drainRetryQueueAsync()
      }
      // Don't fail the suspension if email fails
    }

    return NextResponse.json({ success: true, instructor });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error suspending instructor:', error);
    return NextResponse.json(
      { error: 'Failed to suspend instructor' },
      { status: 500 }
    );
  }
}
