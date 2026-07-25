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

    // Write directly to the dedicated DateTime columns — the schema has real columns for all four.
    // (Legacy code wrote into workingHours.expiry JSON, which caused compliance queries to miss
    //  the real columns. This route now writes both the dedicated columns AND the legacy JSON so
    //  existing reads of workingHours.expiry keep working during the transition.)
    const updateData: any = {};

    if (licenseExpiry !== undefined) updateData.licenseExpiry = licenseExpiry ? new Date(licenseExpiry) : null;
    if (insuranceExpiry !== undefined) updateData.insuranceExpiry = insuranceExpiry ? new Date(insuranceExpiry) : null;
    if (policeCheckExpiry !== undefined) updateData.policeCheckExpiry = policeCheckExpiry ? new Date(policeCheckExpiry) : null;
    if (wwcCheckExpiry !== undefined) updateData.wwcCheckExpiry = wwcCheckExpiry ? new Date(wwcCheckExpiry) : null;

    // Also keep workingHours.expiry in sync for any legacy readers
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
    updateData.workingHours = { ...wh, expiry: updatedExpiry };

    await prisma.instructor.update({
      where: { id: params.instructorId },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update expiry error:', error);
    return NextResponse.json({ error: 'Failed to update expiry dates' }, { status: 500 });
  }
}
