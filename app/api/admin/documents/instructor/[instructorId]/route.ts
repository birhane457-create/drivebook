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

    // Get basic instructor info (document fields don't exist in simplified schema)
    const instructor = await prisma.instructor.findUnique({
      where: { id: params.instructorId },
      select: {
        id: true,
        name: true,
        phone: true,
      }
    });

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    // Return instructor with empty document fields since they don't exist in schema
    return NextResponse.json({
      ...instructor,
      email: 'N/A',
      licenseImageFront: null,
      licenseImageBack: null,
      insurancePolicyDoc: null,
      policeCheckDoc: null,
      wwcCheckDoc: null,
      photoIdDoc: null,
      certificationDoc: null,
      vehicleRegistrationDoc: null,
      documentsVerified: false,
      documentsVerifiedAt: null,
    });
  } catch (error) {
    console.error('Get instructor documents error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
