import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';


export const dynamic = 'force-dynamic';
export async function GET(
  req: NextRequest,
  { params }: { params: { instructorId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const instructor: any = await (prisma.instructor.findUnique as any)({
      where: { id: params.instructorId },
      select: {
        id: true,
        name: true,
        phone: true,
        licenseImageFront: true,
        licenseImageBack: true,
        insurancePolicyDoc: true,
        policeCheckDoc: true,
        wwcCheckDoc: true,
        photoIdDoc: true,
        certificationDoc: true,
        vehicleRegistrationDoc: true,
        licenseExpiry: true,
        insuranceExpiry: true,
        policeCheckExpiry: true,
        wwcCheckExpiry: true,
        documentsVerified: true,
        documentsVerifiedAt: true,
        user: {
          select: {
            email: true,
          }
        }
      }
    });

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...instructor,
      email: instructor.user.email,
    });
  } catch (error) {
    console.error('Get instructor documents error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
