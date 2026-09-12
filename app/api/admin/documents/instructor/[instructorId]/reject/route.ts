import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { smsService } from '@/lib/services/sms';
import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';
import { upsertDrivingProfile } from '@/lib/extensions/driving/providerProfile';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { providerId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const deny = await requirePermission(session, PERM.OPERATIONS_DOCUMENTS_VERIFY);
    if (deny) return deny;

    const { documentKey, reason } = await req.json();

    if (!documentKey || !reason) {
      return NextResponse.json(
        { error: 'Document key and reason are required' },
        { status: 400 }
      );
    }

    const instructor: any = await (prisma as any).provider.findUnique({
      where: { id: params.providerId },
      select: { phone: true, name: true }
    });

    // Clear the rejected document — dual-write to extension table + Instructor col
    const updateData: any = {};
    updateData[documentKey] = null;
    updateData.documentsVerified = false;

    await (prisma as any).provider.update({
      where: { id: params.providerId },
      data: updateData,
    });

    // Also clear in extension table
    const drivingDocFields = [
      'licenseImageFront', 'licenseImageBack', 'insurancePolicyDoc',
      'policeCheckDoc', 'wwcCheckDoc', 'photoIdDoc', 'certificationDoc', 'vehicleRegistrationDoc',
      'licenseNumber', 'licenseExpiry', 'insuranceNumber', 'insuranceExpiry',
      'insurancePolicyDoc', 'policeCheckExpiry', 'wwcCheckExpiry',
    ];
    if (drivingDocFields.includes(documentKey)) {
      await upsertDrivingProfile(params.providerId, { [documentKey]: null } as any);
    }

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

    // Log audit entry
    await prisma.auditLog.create({
      data: {
        action: 'DOCUMENT_REJECTED',
        actorId: session!.user!.id,
        actorRole: session!.user!.role,
        targetType: 'provider',
        targetId: params.providerId,
        metadata: {
          instructorName: instructor?.name,
          documentKey,
          rejectionReason: reason,
        },
        success: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reject document error:', error);
    return NextResponse.json(
      { error: 'Failed to reject document' },
      { status: 500 }
    );
  }
}
