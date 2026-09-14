import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cloudinaryService } from '@/lib/services/cloudinary';
import { validateUpload, DOCUMENT_ALLOWED_TYPES, MAX_DOCUMENT_BYTES } from '@/lib/uploads/validateUpload';
import { getDrivingProfile } from '@/lib/extensions/driving/providerProfile';


export const dynamic = 'force-dynamic';

// Document types that live in DrivingProviderProfile (D7: removed from Instructor)
const DRIVING_DOC_FIELDS = [
  'licenseImageFront', 'licenseImageBack', 'insurancePolicyDoc', 'policeCheckDoc',
  'wwcCheckDoc', 'photoIdDoc', 'certificationDoc', 'vehicleRegistrationDoc',
] as const;

// Generic provider fields that remain on Instructor
const INSTRUCTOR_DOC_FIELDS = ['profileImage', 'carImage'] as const;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.providerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = (formData as any).get('file') as File | null;
    const documentType = (formData as any).get('documentType') as string | null;

    if (!file || !documentType) {
      return NextResponse.json(
        { error: 'File and document type are required' },
        { status: 400 }
      );
    }

    const validTypes = [...DRIVING_DOC_FIELDS, ...INSTRUCTOR_DOC_FIELDS];
    if (!validTypes.includes(documentType as any)) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadValidation = validateUpload(buffer, file.type, DOCUMENT_ALLOWED_TYPES, MAX_DOCUMENT_BYTES);
    if (!uploadValidation.valid) {
      return NextResponse.json({ error: uploadValidation.error }, { status: uploadValidation.status });
    }

    const result = await cloudinaryService.uploadInstructorDocument(
      session!.user!.providerId,
      documentType,
      buffer
    );

    // Route write to the correct table (D7: driving fields removed from Instructor)
    if ((DRIVING_DOC_FIELDS as readonly string[]).includes(documentType)) {
      await (prisma as any).drivingProviderProfile.upsert({
        where: { providerId: session!.user!.providerId },
        create: { providerId: session!.user!.providerId, [documentType]: result.url },
        update: { [documentType]: result.url },
      });
    } else {
      // profileImage, carImage — stay on Instructor (generic provider fields)
      await (prisma as any).provider.update({
        where: { id: session!.user!.providerId },
        data: { [documentType]: result.url }  as any,
      });
    }

    return NextResponse.json({ success: true, url: result.url, publicId: result.publicId });
  } catch (error) {
    console.error('Document upload error:', error);
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.providerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // All driving doc fields come from DrivingProviderProfile (D7 migration)
    const drivingProfile = await getDrivingProfile(session!.user!.providerId);

    // documentsVerified + profileImage/carImage remain on Instructor
    const instructor = await (prisma as any).provider.findUnique({
      where: { id: session!.user!.providerId },
      select: {
        documentsVerified: true,
        documentsVerifiedAt: true,
        profileImage: true,
      },
    });

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    const p = (drivingProfile ?? {}) as any;
    const isoOrNull = (v: any) => (v instanceof Date ? v.toISOString() : v ?? null);

    return NextResponse.json({
      licenseImageFront:      p.licenseImageFront      ? true : null,
      licenseImageBack:       p.licenseImageBack        ? true : null,
      insurancePolicyDoc:     p.insurancePolicyDoc      ? true : null,
      policeCheckDoc:         p.policeCheckDoc          ? true : null,
      wwcCheckDoc:            p.wwcCheckDoc             ? true : null,
      photoIdDoc:             p.photoIdDoc              ? true : null,
      certificationDoc:       p.certificationDoc        ? true : null,
      vehicleRegistrationDoc: p.vehicleRegistrationDoc  ? true : null,
      profileImage:           instructor.profileImage   ?? null,
      carImage:               instructor.carImage       ?? null,
      documentsVerified:      instructor.documentsVerified ?? false,
      documentsVerifiedAt:    instructor.documentsVerifiedAt?.toISOString() ?? null,
      licenseExpiry:          isoOrNull(p.licenseExpiry),
      insuranceExpiry:        isoOrNull(p.insuranceExpiry),
      policeCheckExpiry:      isoOrNull(p.policeCheckExpiry),
      wwcCheckExpiry:         isoOrNull(p.wwcCheckExpiry),
    });
  } catch (error) {
    console.error('Get documents error:', error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}
