import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services/email';
import { logAuditAction } from '@/lib/services/audit';


export const dynamic = 'force-dynamic';
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // FIXED: Use transaction wrapper with audit logging
    const instructor = await prisma.$transaction(async (tx) => {
      // Get current state for audit log
      const currentInstructor = await tx.instructor.findUnique({
        where: { id: params.id },
        select: { approvalStatus: true, name: true }
      });

      if (!currentInstructor) {
        throw new Error('Instructor not found');
      }

      // Update instructor
      const updatedInstructor = await tx.instructor.update({
        where: { id: params.id },
        data: {
          approvalStatus: 'APPROVED',
          isActive: true,
        },
        include: {
          user: true,
        },
      }) as any;

      // Log the action
      await logAuditAction(tx, {
        action: 'APPROVE_INSTRUCTOR',
        adminId: session.user.id,
        targetType: 'INSTRUCTOR',
        targetId: params.id,
        metadata: {
          instructorName: currentInstructor.name,
          previousStatus: currentInstructor.approvalStatus,
          newStatus: 'APPROVED',
          adminEmail: session.user.email,
        },
        req,
      });

      return updatedInstructor;
    });

    // Send approval email
    try {
      await emailService.sendGenericEmail({
        to: instructor.user.email,
        subject: `🎉 Your Instructor Account is Approved!`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .success-box { background: #d1fae5; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 8px; }
              .button { display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
              .feature-list { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">🎉 Congratulations!</h1>
                <p style="margin: 10px 0 0 0; font-size: 18px;">Your account has been approved!</p>
              </div>
              <div class="content">
                <p>Hi ${instructor.name},</p>
                
                <div class="success-box">
                  <h3 style="margin-top: 0; color: #059669;">✅ You're all set!</h3>
                  <p>Your instructor account has been approved and is now active. You can start accepting bookings right away!</p>
                </div>
                
                <div class="feature-list">
                  <h3 style="margin-top: 0;">What you can do now:</h3>
                  <ul style="line-height: 2;">
                    <li>✅ <strong>Accept Bookings</strong> - Students can now book lessons with you</li>
                    <li>✅ <strong>Manage Schedule</strong> - Set your availability and working hours</li>
                    <li>✅ <strong>Track Earnings</strong> - View your revenue and upcoming payouts</li>
                    <li>✅ <strong>Sync Calendar</strong> - Connect your Google Calendar</li>
                    <li>✅ <strong>Mobile App</strong> - Download our instructor app</li>
                    <li>✅ <strong>Upload Documents</strong> - Keep your certifications up to date</li>
                  </ul>
                </div>
                
                <p><strong>Next Steps:</strong></p>
                <ol>
                  <li>Complete your profile with photos and bio</li>
                  <li>Set your working hours and service areas</li>
                  <li>Upload required documents (license, insurance)</li>
                  <li>Configure your pricing and packages</li>
                  <li>Start accepting bookings!</li>
                </ol>
                
                <div style="text-align: center;">
                  <a href="${process.env.NEXTAUTH_URL}/dashboard" class="button">Go to Dashboard</a>
                </div>
                
                <p><strong>Need Help?</strong><br>
                Check out our instructor guide or contact support at ${process.env.ADMIN_EMAIL || 'support@drivebook.com'}</p>
                
                <p>We're excited to have you on board!</p>
                
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
      console.error('Failed to send approval email:', emailError);
      // Don't fail the approval if email fails
    }

    return NextResponse.json({ success: true, instructor });
  } catch (error) {
    console.error('Error approving instructor:', error);
    return NextResponse.json(
      { error: 'Failed to approve instructor' },
      { status: 500 }
    );
  }
}
