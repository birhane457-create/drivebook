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

    const instructor: any = await prisma.instructor.findUnique({
      where: { id: params.instructorId },
      select: { phone: true, name: true }
    });

    await prisma.instructor.update({
      where: { id: params.instructorId },
      data: {
        documentsVerified: true,
        documentsVerifiedAt: new Date(),
        documentsVerifiedBy: session.user.id,
      },
    });

    // Send SMS notification
    if (instructor?.phone) {
      await smsService.sendSMS({
        to: instructor.phone,
        message: `DriveBook: Your documents have been verified and approved! You can now accept bookings.`
      });
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
