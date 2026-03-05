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
        insuranceNumber: true,
        licenseImageFront: true,
        licenseImageBack: true,
        insurancePolicyDoc: true,
        policeCheckDoc: true,
        wwcCheckDoc: true,
        photoIdDoc: true,
        certificationDoc: true,
        vehicleRegistrationDoc: true,
        documentsVerified: true,
        isActive: true,
        user: {
          select: {
            email: true,
          }
        }
      }
    });

    const compliance = instructors.map((instructor: any) => {
      const issues = [];
      let status: 'valid' | 'expiring' | 'expired' = 'valid';

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
      if (!instructor.photoIdDoc) {
        issues.push('Photo ID missing');
        status = 'expired';
      }
      if (!instructor.certificationDoc) {
        issues.push('Certification document missing');
        status = 'expired';
      }
      if (!instructor.vehicleRegistrationDoc) {
        issues.push('Vehicle registration missing');
        status = 'expired';
      }

      if (!instructor.documentsVerified && issues.length === 0) {
        issues.push('Documents pending verification');
        status = 'expiring';
      }

      return {
        instructorId: instructor.id,
        userId: instructor.userId,
        name: instructor.name,
        email: instructor.user?.email || 'No email',
        phone: instructor.phone,
        status,
        issues,
        isActive: instructor.isActive,
        documentsVerified: instructor.documentsVerified,
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
      // Auto-process all instructors - check for missing documents
      const instructors: any = await (prisma.instructor.findMany as any)({
        where: {
          approvalStatus: { in: ['APPROVED'] }
        },
        include: { user: true }
      });
      
      let deactivated = 0;
      let reminded = 0;

      for (const instructor of instructors) {
        const missingDocs = [];
        
        if (!instructor.licenseImageFront || !instructor.licenseImageBack) missingDocs.push('license');
        if (!instructor.insurancePolicyDoc) missingDocs.push('insurance');
        if (!instructor.policeCheckDoc) missingDocs.push('police check');
        if (!instructor.wwcCheckDoc) missingDocs.push('WWC');
        if (!instructor.photoIdDoc) missingDocs.push('photo ID');
        if (!instructor.certificationDoc) missingDocs.push('certification');
        if (!instructor.vehicleRegistrationDoc) missingDocs.push('vehicle registration');

        if (missingDocs.length > 0 && instructor.isActive) {
          // Deactivate if critical documents missing
          if (missingDocs.includes('license') || missingDocs.includes('insurance')) {
            await prisma.instructor.update({
              where: { id: instructor.id },
              data: { isActive: false }
            });
            deactivated++;

            // Send notification
            if (instructor.phone) {
              await smsService.sendSMS({
                to: instructor.phone,
                message: `DriveBook: Your account has been suspended due to missing documents: ${missingDocs.join(', ')}. Please upload them to reactivate.`
              });
            }
          } else {
            // Send reminder for non-critical documents
            if (instructor.phone) {
              await smsService.sendSMS({
                to: instructor.phone,
                message: `DriveBook Alert: Please upload missing documents: ${missingDocs.join(', ')}.`
              });
              reminded++;
            }
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
