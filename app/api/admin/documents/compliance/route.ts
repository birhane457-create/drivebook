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

    // Get all instructors with basic info (only fields that exist in schema)
    const instructors = await prisma.instructor.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
      }
    });

    // Return compliance data with "expired" status for all instructors
    // since they have no documents uploaded (fields don't exist in schema)
    const compliance = instructors.map((instructor) => ({
      instructorId: instructor.id,
      name: instructor.name,
      email: 'N/A',
      phone: instructor.phone,
      status: 'expired' as const, // Red - no documents uploaded
      issues: ['No documents uploaded - document fields not in schema'],
      isActive: true,
      documentsVerified: false,
    }));

    return NextResponse.json(compliance);
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
