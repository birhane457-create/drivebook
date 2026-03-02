import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cloudinaryService } from '@/lib/services/cloudinary';


export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    // Type assertion to work around FormData type issues
    const file = (formData as any).get('file') as File | null;
    const documentType = (formData as any).get('documentType') as string | null;

    if (!file || !documentType) {
      return NextResponse.json(
        { error: 'File and document type are required' },
        { status: 400 }
      );
    }

    // Validate document type
    const validTypes = [
      'licenseImageFront',
      'licenseImageBack',
      'insurancePolicyDoc',
      'policeCheckDoc',
      'wwcCheckDoc',
      'photoIdDoc',
      'certificationDoc',
      'vehicleRegistrationDoc',
      'profileImage',
      'carImage',
    ];

    if (!validTypes.includes(documentType)) {
      return NextResponse.json(
        { error: 'Invalid document type' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Cloudinary
    const url = await cloudinaryService.uploadInstructorDocument(
      session.user.instructorId,
      documentType,
      buffer
    );

    // Update instructor record with dynamic field
    const updateData: any = {};
    updateData[documentType] = url;
    
    await prisma.instructor.update({
      where: { id: session.user.instructorId },
      data: updateData,
    });

    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error('Document upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get instructor documents - use any to avoid Prisma type issues with new fields
    const instructor: any = await (prisma.instructor.findUnique as any)({
      where: { id: session.user.instructorId },
      select: {
        licenseImageFront: true,
        licenseImageBack: true,
        insurancePolicyDoc: true,
        policeCheckDoc: true,
        wwcCheckDoc: true,
        photoIdDoc: true,
        certificationDoc: true,
        vehicleRegistrationDoc: true,
        profileImage: true,
        carImage: true,
        documentsVerified: true,
        documentsVerifiedAt: true,
      },
    });

    if (!instructor) {
      return NextResponse.json(
        { error: 'Instructor not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(instructor);
  } catch (error) {
    console.error('Get documents error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
