import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cloudinaryService } from '@/lib/services/cloudinary';
import { validateUpload, DOCUMENT_ALLOWED_TYPES, MAX_DOCUMENT_BYTES } from '@/lib/uploads/validateUpload';


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

    // Validate MIME type and magic bytes before sending to Cloudinary
    const uploadValidation = validateUpload(buffer, file.type, DOCUMENT_ALLOWED_TYPES, MAX_DOCUMENT_BYTES);
    if (!uploadValidation.valid) {
      return NextResponse.json({ error: uploadValidation.error }, { status: uploadValidation.status });
    }

    // Upload to Cloudinary
    const result = await cloudinaryService.uploadInstructorDocument(
      session.user.instructorId,
      documentType,
      buffer
    );

    // Store the URL in the existing field (backward-compatible).
    // Also store the publicId if the schema has a companion field (e.g. licenseImageFrontPublicId).
    // For now we store the URL for display and the publicId is derivable from it.
    // Phase 2 migration will switch the field to store publicId only.
    const updateData: any = {};
    updateData[documentType] = result.url;

    await prisma.instructor.update({
      where: { id: session.user.instructorId },
      data: updateData,
    });

    return NextResponse.json({ success: true, url: result.url, publicId: result.publicId });
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

    const instructor: any = await (prisma.instructor.findUnique as any)({
      where: { id: session.user.instructorId },
      select: {
        licenseImageFront:     true,
        licenseImageBack:      true,
        insurancePolicyDoc:    true,
        policeCheckDoc:        true,
        wwcCheckDoc:           true,
        photoIdDoc:            true,
        certificationDoc:      true,
        vehicleRegistrationDoc:true,
        profileImage:          true,
        carImage:              true,
        documentsVerified:     true,
        documentsVerifiedAt:   true,
        // Expiry dates — needed for the expiry badges on the documents page
        licenseExpiry:         true,
        insuranceExpiry:       true,
        policeCheckExpiry:     true,
        wwcCheckExpiry:        true,
      },
    });

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    // Return an explicit shape — no extra fields that could pollute client-side
    // document presence checks (e.g. workingHours is a truthy object for active instructors).
    return NextResponse.json({
      licenseImageFront:      instructor.licenseImageFront      ?? null,
      licenseImageBack:       instructor.licenseImageBack       ?? null,
      insurancePolicyDoc:     instructor.insurancePolicyDoc     ?? null,
      policeCheckDoc:         instructor.policeCheckDoc         ?? null,
      wwcCheckDoc:            instructor.wwcCheckDoc            ?? null,
      photoIdDoc:             instructor.photoIdDoc             ?? null,
      certificationDoc:       instructor.certificationDoc       ?? null,
      vehicleRegistrationDoc: instructor.vehicleRegistrationDoc ?? null,
      profileImage:           instructor.profileImage           ?? null,
      carImage:               instructor.carImage               ?? null,
      documentsVerified:      instructor.documentsVerified      ?? false,
      documentsVerifiedAt:    instructor.documentsVerifiedAt?.toISOString() ?? null,
      licenseExpiry:          instructor.licenseExpiry?.toISOString()       ?? null,
      insuranceExpiry:        instructor.insuranceExpiry?.toISOString()     ?? null,
      policeCheckExpiry:      instructor.policeCheckExpiry?.toISOString()   ?? null,
      wwcCheckExpiry:         instructor.wwcCheckExpiry?.toISOString()      ?? null,
    });
  } catch (error) {
    console.error('Get documents error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
