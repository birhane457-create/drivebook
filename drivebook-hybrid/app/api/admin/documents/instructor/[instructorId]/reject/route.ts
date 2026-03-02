import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { smsService } from '@/lib/services/sms';


export const dynamic = 'force-dynamic';
export async function POST(
  req: NextRequest,
  { params }: { params: { instructorId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { documentKey, reason } = await req.json();

    if (!documentKey || !reason) {
      return NextResponse.json(
        { error: 'Document key and reason are required' },
        { status: 400 }
      );
    }

    const instructor: any = await prisma.instructor.findUnique({
      where: { id: params.instructorId },
      select: { phone: true, name: true }
    });

    // Clear the rejected document
    const updateData: any = {};
    updateData[documentKey] = null;
    updateData.documentsVerified = false;

    await prisma.instructor.update({
      where: { id: params.instructorId },
      data: updateData,
    });

    // Send SMS notification
    if (instructor?.phone) {
      const docLabels: { [key: string]: string } = {
        licenseImageFront: "Driver's License (Front)",
        licenseImageBack: "Driver's License (Back)",
        insurancePolicyDoc: 'Insurance Policy',
        policeCheckDoc: 'Police Check',
        wwcCheckDoc: 'WWC Check',
        photoIdDoc: 'Photo ID',
        certificationDoc: 'Instructor Certification',
        vehicleRegistrationDoc: 'Vehicle Registration',
      };

      await smsService.sendSMS({
        to: instructor.phone,
        message: `DriveBook: Your ${docLabels[documentKey]} was rejected. Reason: ${reason}. Please re-upload the correct document.`
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reject document error:', error);
    return NextResponse.json(
      { error: 'Failed to reject document' },
      { status: 500 }
    );
  }
}
