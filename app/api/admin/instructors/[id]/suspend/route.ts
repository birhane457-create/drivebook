import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services/email';
import { logAuditAction } from '@/lib/services/audit';
import { z } from 'zod';


export const dynamic = 'force-dynamic';
// FIXED: Add input validation
const suspendSchema = z.object({
  reason: z.string()
    .min(10, 'Suspension reason must be at least 10 characters')
    .max(500, 'Suspension reason cannot exceed 500 characters')
    .regex(/^[a-zA-Z0-9\s.,!?'\-()]+$/, 'Invalid characters in reason')
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // FIXED: Validate input
    const body = await req.json();
    const { reason } = suspendSchema.parse(body);

    // FIXED: Use transaction wrapper with audit logging
    const instructor = await prisma.$transaction(async (tx) => {
      // Get current state
      const currentInstructor = await tx.instructor.findUnique({
        where: { id: params.id },
        select: { approvalStatus: true, name: true, isActive: true }
      });

      if (!currentInstructor) {
        throw new Error('Instructor not found');
      }

      // Update instructor
      const updatedInstructor = await tx.instructor.update({
        where: { id: params.id },
        data: {
          approvalStatus: 'SUSPENDED',
          rejectionReason: reason,
          isActive: false,
        } as any,
        include: {
          user: true,
        },
      }) as any;

      // Log the action
      await logAuditAction(tx, {
        action: 'SUSPEND_INSTRUCTOR',
        adminId: session.user.id,
        targetType: 'INSTRUCTOR',
        targetId: params.id,
        metadata: {
          instructorName: currentInstructor.name,
          previousStatus: currentInstructor.approvalStatus,
          wasActive: currentInstructor.isActive,
          suspensionReason: reason,
          adminEmail: session.user.email,
        },
        req,
      });

      return updatedInstructor;
    });

    // Send suspension email
    try {
      await emailService.sendGenericEmail({
        to: instructor.user.email,
        subject: 'Account Suspended - Action Required',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .warning-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 20px 0; border-radius: 8px; }
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
                
                <div class="warning-box">
                  <h3 style="margin-top: 0; color: #dc2626;">Your instructor account has been suspended.</h3>
                  <p>This means you will not be able to:</p>
                  <ul>
                    <li>Accept new bookings</li>
                    <li>Access your instructor dashboard</li>
                    <li>Receive payments</li>
                  </ul>
                </div>
                
                <p><strong>What happens next?</strong></p>
                <p>Please contact our support team to discuss this matter and understand the steps needed to resolve this issue.</p>
                
                <div style="text-align: center;">
                  <a href="mailto:${process.env.ADMIN_EMAIL || 'support@drivebook.com'}" class="button">Contact Support</a>
                </div>
                
                <p>We take the quality and safety of our platform seriously. If you believe this suspension was made in error, please reach out to us immediately.</p>
                
                <p><strong>Support Contact:</strong><br>
                Email: ${process.env.ADMIN_EMAIL || 'support@drivebook.com'}</p>
                
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
    } catch (emailError) {
      console.error('Failed to send suspension email:', emailError);
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
