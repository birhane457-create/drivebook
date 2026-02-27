import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { cloudinaryService } from '@/lib/services/cloudinary';


export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  try {
    // JWT authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as {
      userId: string;
      instructorId?: string;
    };

    if (!decoded.instructorId) {
      return NextResponse.json({ error: 'Not an instructor' }, { status: 403 });
    }

    const body = await req.json();
    const { file, documentType } = body; // file is base64 string

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

    // Upload to Cloudinary (file is base64 string from mobile)
    const url = await cloudinaryService.uploadInstructorDocument(
      decoded.instructorId,
      documentType,
      file
    );

    // Update instructor record with dynamic field
    const updateData: any = {};
    updateData[documentType] = url;
    
    await prisma.instructor.update({
      where: { id: decoded.instructorId },
      data: updateData,
    });

    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error('Mobile document upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // JWT authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as {
      userId: string;
      instructorId?: string;
    };

    if (!decoded.instructorId) {
      return NextResponse.json({ error: 'Not an instructor' }, { status: 403 });
    }

    // Get instructor documents - use any to avoid Prisma type issues with new fields
    const instructor: any = await (prisma.instructor.findUnique as any)({
      where: { id: decoded.instructorId },
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
    console.error('Get mobile documents error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
