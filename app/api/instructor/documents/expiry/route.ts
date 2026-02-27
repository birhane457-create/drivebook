import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { licenseExpiry, insuranceExpiry, policeCheckExpiry, wwcCheckExpiry } = body;

    const updateData: any = {};
    
    if (licenseExpiry) updateData.licenseExpiry = new Date(licenseExpiry);
    if (insuranceExpiry) updateData.insuranceExpiry = new Date(insuranceExpiry);
    if (policeCheckExpiry) updateData.policeCheckExpiry = new Date(policeCheckExpiry);
    if (wwcCheckExpiry) updateData.wwcCheckExpiry = new Date(wwcCheckExpiry);

    await prisma.instructor.update({
      where: { id: session.user.instructorId },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update expiry error:', error);
    return NextResponse.json(
      { error: 'Failed to update expiry dates' },
      { status: 500 }
    );
  }
}
