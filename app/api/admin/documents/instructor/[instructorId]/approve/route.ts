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
  { params }: { params: { providerId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const deny = await requirePermission(session, PERM.OPERATIONS_DOCUMENTS_VERIFY);
    if (deny) return deny;

    // Validate provider exists
    const instructor: any = await prisma.provider.findUnique({
      where: { id: params.providerId },
      select: { id: true, phone: true, name: true }
    });

    if (!instructor) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    // Update and audit in transaction to ensure consistency
    await prisma.$transaction(async (tx) => {
      await tx.provider.update({
        where: { id: params.providerId },
        data: {
          documentsVerified: true,
          documentsVerifiedAt: new Date(),
        },
      });

      // Log audit entry
      await tx.auditLog.create({
        data: {
          action: 'DOCUMENTS_APPROVED',
          actorId: session!.user!.id,
          actorRole: session!.user!.role,
          targetType: 'provider',
          targetId: params.providerId,
          metadata: {
            instructorName: instructor.name,
            instructorPhone: instructor.phone,
          },
          success: true,
        },
      });
    });

    // Send SMS notification (outside transaction - non-critical)
    if (instructor.phone) {
      try {
        await smsService.sendSMS({
          to: instructor.phone,
          message: `DriveBook: Your documents have been verified and approved! You can now accept bookings.`
        });
      } catch (smsError) {
        console.error('SMS notification failed:', smsError);
        // Don't fail the approval if SMS fails
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Approve documents error:', error);
    return NextResponse.json(
      { error: 'Failed to approve documents' },
      { status: 500 }
    );
  }
}
