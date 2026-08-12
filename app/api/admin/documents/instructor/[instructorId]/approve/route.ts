import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { smsService } from '@/lib/services/sms';
import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { instructorId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const deny = await requirePermission(session, PERM.OPERATIONS_DOCUMENTS_VERIFY);
    if (deny) return deny;

    const instructor: any = await prisma.instructor.findUnique({
      where: { id: params.instructorId },
      select: { phone: true, name: true }
    });

    await prisma.instructor.update({
      where: { id: params.instructorId },
      data: {
        documentsVerified: true,
        documentsVerifiedAt: new Date(),
      },
    });

    // Send SMS notification
    if (instructor?.phone) {
      await smsService.sendSMS({
        to: instructor.phone,
        message: `DriveBook: Your documents have been verified and approved! You can now accept bookings.`
      });
    }

    // Log audit entry
    await prisma.auditLog.create({
      data: {
        action: 'DOCUMENTS_APPROVED',
        actorId: session.user.id,
        actorRole: session.user.role,
        targetType: 'Instructor',
        targetId: params.instructorId,
        metadata: {
          instructorName: instructor?.name,
          instructorPhone: instructor?.phone,
        },
        success: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Approve documents error:', error);
    return NextResponse.json(
      { error: 'Failed to approve documents' },
      { status: 500 }
    );
  }
}
