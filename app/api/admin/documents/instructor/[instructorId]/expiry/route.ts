import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    const { licenseExpiry, insuranceExpiry, policeCheckExpiry, wwcCheckExpiry } = await req.json();

    // Read existing workingHours to preserve other data
    const existing = await prisma.instructor.findUnique({
      where: { id: params.instructorId },
      select: { workingHours: true },
    });

    const wh = (existing?.workingHours as any) || {};
    const updatedExpiry: any = { ...(wh.expiry || {}) };

    if (licenseExpiry !== undefined) updatedExpiry.licenseExpiry = licenseExpiry || null;
    if (insuranceExpiry !== undefined) updatedExpiry.insuranceExpiry = insuranceExpiry || null;
    if (policeCheckExpiry !== undefined) updatedExpiry.policeCheckExpiry = policeCheckExpiry || null;
    if (wwcCheckExpiry !== undefined) updatedExpiry.wwcCheckExpiry = wwcCheckExpiry || null;

    await prisma.instructor.update({
      where: { id: params.instructorId },
      data: {
        workingHours: { ...wh, expiry: updatedExpiry },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update expiry error:', error);
    return NextResponse.json({ error: 'Failed to update expiry dates' }, { status: 500 });
  }
}
