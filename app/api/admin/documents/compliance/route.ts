import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { smsService } from '@/lib/services/sms';


export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const instructors: any = await (prisma.instructor.findMany as any)({
      where: {
        // Show all instructors regardless of approval status
      },
      select: {
        id: true,
        userId: true,
        name: true,
        phone: true,
        licenseNumber: true,
        licenseExpiry: true,
        insuranceNumber: true,
        insuranceExpiry: true,
        policeCheckExpiry: true,
        wwcCheckExpiry: true,
        licenseImageFront: true,
        licenseImageBack: true,
        insurancePolicyDoc: true,
        policeCheckDoc: true,
        wwcCheckDoc: true,
        documentsVerified: true,
        isActive: true,
        user: {
          select: {
            email: true,
          }
        }
      }
    });

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const compliance = instructors.map((instructor: any) => {
      const issues = [];
      let status: 'valid' | 'expiring' | 'expired' = 'valid';

      // Check license
      if (!instructor.licenseExpiry) {
        issues.push('License expiry date not set');
        status = 'expired';
      } else if (new Date(instructor.licenseExpiry) < now) {
        issues.push('License expired');
        status = 'expired';
      } else if (new Date(instructor.licenseExpiry) < thirtyDaysFromNow) {
        issues.push('License expiring soon');
        if (status === 'valid') status = 'expiring';
      }

      // Check insurance
      if (!instructor.insuranceExpiry) {
        issues.push('Insurance expiry date not set');
        status = 'expired';
      } else if (new Date(instructor.insuranceExpiry) < now) {
        issues.push('Insurance expired');
        status = 'expired';
      } else if (new Date(instructor.insuranceExpiry) < thirtyDaysFromNow) {
        issues.push('Insurance expiring soon');
        if (status === 'valid') status = 'expiring';
      }

      // Check police check
      if (!instructor.policeCheckExpiry) {
        issues.push('Police check expiry date not set');
        status = 'expired';
      } else if (new Date(instructor.policeCheckExpiry) < now) {
        issues.push('Police check expired');
        status = 'expired';
      } else if (new Date(instructor.policeCheckExpiry) < thirtyDaysFromNow) {
        issues.push('Police check expiring soon');
        if (status === 'valid') status = 'expiring';
      }

      // Check WWC
      if (!instructor.wwcCheckExpiry) {
        issues.push('WWC check expiry date not set');
        status = 'expired';
      } else if (new Date(instructor.wwcCheckExpiry) < now) {
        issues.push('WWC check expired');
        status = 'expired';
      } else if (new Date(instructor.wwcCheckExpiry) < thirtyDaysFromNow) {
        issues.push('WWC check expiring soon');
        if (status === 'valid') status = 'expiring';
      }

      // Check documents uploaded
      if (!instructor.licenseImageFront || !instructor.licenseImageBack) {
        issues.push('License images missing');
        status = 'expired';
      }
      if (!instructor.insurancePolicyDoc) {
        issues.push('Insurance document missing');
        status = 'expired';
      }
      if (!instructor.policeCheckDoc) {
        issues.push('Police check document missing');
        status = 'expired';
      }
      if (!instructor.wwcCheckDoc) {
        issues.push('WWC check document missing');
        status = 'expired';
      }

      return {
        instructorId: instructor.id,
        userId: instructor.userId,
        name: instructor.name,
        email: instructor.user.email,
        phone: instructor.phone,
        status,
        issues,
        isActive: instructor.isActive,
        licenseExpiry: instructor.licenseExpiry,
        insuranceExpiry: instructor.insuranceExpiry,
        policeCheckExpiry: instructor.policeCheckExpiry,
        wwcCheckExpiry: instructor.wwcCheckExpiry,
      };
    });

    // Sort by status priority: expired > expiring > valid
    const sorted = compliance.sort((a: any, b: any) => {
      const priority: { [key: string]: number } = { expired: 0, expiring: 1, valid: 2 };
      return priority[a.status] - priority[b.status];
    });

    return NextResponse.json(sorted);
  } catch (error) {
    console.error('Compliance check error:', error);
    return NextResponse.json(
      { error: 'Failed to check compliance' },
      { status: 500 }
    );
  }
}

// Auto-deactivate expired instructors and send reminders
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, instructorId } = await req.json();

    if (action === 'deactivate') {
      // Deactivate instructor with expired documents
      await prisma.instructor.update({
        where: { id: instructorId },
        data: { isActive: false }
      });

      return NextResponse.json({ success: true, message: 'Instructor deactivated' });
    }

    if (action === 'sendReminder') {
      // Send SMS reminder about expiring documents
      const instructor: any = await (prisma.instructor.findUnique as any)({
        where: { id: instructorId },
        include: { user: true }
      });

      if (instructor?.phone) {
        await smsService.sendSMS({
          to: instructor.phone,
          message: `DriveBook Alert: Your documents (license/insurance/police check/WWC) are expiring soon. Please update them in the app to avoid account suspension.`
        });
      }

      return NextResponse.json({ success: true, message: 'Reminder sent' });
    }

    if (action === 'autoProcess') {
      // Auto-process all instructors
      const instructors: any = await (prisma.instructor.findMany as any)({
        where: {
          approvalStatus: { in: ['APPROVED'] }
        },
        include: { user: true }
      });

      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      let deactivated = 0;
      let reminded = 0;

      for (const instructor of instructors) {
        const hasExpired = 
          (instructor.licenseExpiry && instructor.licenseExpiry < now) ||
          (instructor.insuranceExpiry && instructor.insuranceExpiry < now) ||
          (instructor.policeCheckExpiry && instructor.policeCheckExpiry < now) ||
          (instructor.wwcCheckExpiry && instructor.wwcCheckExpiry < now);

        const isExpiringSoon = 
          (instructor.licenseExpiry && instructor.licenseExpiry < thirtyDaysFromNow) ||
          (instructor.insuranceExpiry && instructor.insuranceExpiry < thirtyDaysFromNow) ||
          (instructor.policeCheckExpiry && instructor.policeCheckExpiry < thirtyDaysFromNow) ||
          (instructor.wwcCheckExpiry && instructor.wwcCheckExpiry < thirtyDaysFromNow);

        if (hasExpired && instructor.isActive) {
          // Deactivate
          await prisma.instructor.update({
            where: { id: instructor.id },
            data: { isActive: false }
          });
          deactivated++;

          // Send notification
          if (instructor.phone) {
            await smsService.sendSMS({
              to: instructor.phone,
              message: `DriveBook: Your account has been suspended due to expired documents. Please update your license/insurance/police check/WWC to reactivate.`
            });
          }
        } else if (isExpiringSoon && instructor.isActive) {
          // Send reminder
          if (instructor.phone) {
            await smsService.sendSMS({
              to: instructor.phone,
              message: `DriveBook Alert: Your documents are expiring soon. Update them in the app to avoid suspension.`
            });
            reminded++;
          }
        }
      }

      return NextResponse.json({ 
        success: true, 
        deactivated, 
        reminded,
        message: `Processed: ${deactivated} deactivated, ${reminded} reminded`
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Compliance action error:', error);
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    );
  }
}
