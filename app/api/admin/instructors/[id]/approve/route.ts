import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services/email';

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

    const instructor = await prisma.instructor.update({
      where: { id: params.id },
      data: {
        approvalStatus: 'APPROVED',
        isActive: true,
        documentsVerified: true,
        documentsVerifiedAt: new Date(),
      },
      include: {
        user: true,
      },
    });

    // Send approval email
    try {
      if (instructor.user?.email) {
        await emailService.sendGenericEmail({
          to: instructor.user.email,
          subject: 'Congratulations! Your Instructor Application is Approved',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1 style="margin: 0;">🎉 Application Approved!</h1>
                </div>
                <div class="content">
                  <p>Dear ${instructor.name},</p>
                  
                  <p>Congratulations! We're excited to inform you that your application to join ${process.env.PLATFORM_NAME || 'DriveBook'} as a driving instructor has been approved!</p>
                  
                  <p><strong>What's Next?</strong></p>
                  <ul>
                    <li>Log in to your instructor dashboard</li>
                    <li>Complete your profile and set your availability</li>
                    <li>Start accepting bookings from students</li>
                    <li>Build your reputation with great reviews</li>
                  </ul>
                  
                  <div style="text-align: center;">
                    <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard" class="button">Go to Dashboard</a>
                  </div>
                  
                  <p><strong>Need Help?</strong><br>
                  Check out our instructor guide or contact support at ${process.env.ADMIN_EMAIL || 'support@drivebook.com'}</p>
                  
                  <p>We're thrilled to have you on board and look forward to your success!</p>
                  
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
