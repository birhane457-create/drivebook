import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services/email';
import { logAuditAction } from '@/lib/services/audit';
import { z } from 'zod';


export const dynamic = 'force-dynamic';
// FIXED: Add input validation
const rejectSchema = z.object({
  reason: z.string()
    .min(10, 'Rejection reason must be at least 10 characters')
    .max(500, 'Rejection reason cannot exceed 500 characters')
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
    const { reason } = rejectSchema.parse(body);

    // FIXED: Use transaction wrapper with audit logging
    const instructor = await prisma.$transaction(async (tx) => {
      // Get current state
      const currentInstructor = await tx.instructor.findUnique({
        where: { id: params.id },
        select: { approvalStatus: true, name: true }
      });

      if (!currentInstructor) {
        throw new Error('Instructor not found');
      }

      // Update instructor - store rejection reason in audit log only
      const updatedInstructor = await tx.instructor.update({
        where: { id: params.id },
        data: {
          approvalStatus: 'REJECTED',
          isActive: false,
        },
        include: {
          user: true,
        },
      }) as any;

      // Log the action
      await logAuditAction(tx, {
        action: 'REJECT_INSTRUCTOR',
        adminId: session.user.id,
        targetType: 'INSTRUCTOR',
        targetId: params.id,
        metadata: {
          instructorName: currentInstructor.name,
          previousStatus: currentInstructor.approvalStatus,
          rejectionReason: reason,
          adminEmail: session.user.email,
        },
        req,
      });

      return updatedInstructor;
    });

    // Send rejection email
    try {
      if (instructor.user?.email) {
        await emailService.sendGenericEmail({
          to: instructor.user.email,
        subject: 'Application Status Update',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .info-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #6b7280; }
              .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">Application Status Update</h1>
              </div>
              <div class="content">
                <p>Dear ${instructor.name},</p>
                
                <p>Thank you for your interest in joining ${process.env.PLATFORM_NAME || 'DriveBook'} as a driving instructor.</p>
                
                <p>After careful review of your application, we regret to inform you that we are unable to approve your registration at this time.</p>
                
                <div class="info-box">
                  <h3 style="margin-top: 0;">Reason:</h3>
                  <p>${reason}</p>
                </div>
                
                <p><strong>What you can do:</strong></p>
                <ul>
                  <li>Review the requirements for becoming an instructor on our platform</li>
                  <li>Address any issues mentioned above</li>
                  <li>Contact us if you have questions or need clarification</li>
                  <li>Reapply in the future once requirements are met</li>
                </ul>
                
                <p>If you believe this decision was made in error or if you have additional information to share, please don't hesitate to contact us.</p>
                
                <div style="text-align: center;">
                  <a href="mailto:${process.env.ADMIN_EMAIL || 'support@drivebook.com'}" class="button">Contact Support</a>
                </div>
                
                <p><strong>Support Contact:</strong><br>
                Email: ${process.env.ADMIN_EMAIL || 'support@drivebook.com'}</p>
                
                <p>We appreciate your understanding and wish you the best in your endeavors.</p>
                
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
      } else {
        console.log('Instructor has no user email, skipping rejection email');
      }
    } catch (emailError) {
      console.error('Failed to send rejection email:', emailError);
      // Don't fail the rejection if email fails
    }

    return NextResponse.json({ success: true, instructor });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error rejecting instructor:', error);
    return NextResponse.json(
      { error: 'Failed to reject instructor' },
      { status: 500 }
    );
  }
}
