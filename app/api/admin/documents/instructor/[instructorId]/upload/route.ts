import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cloudinaryService } from '@/lib/services/cloudinary';
import { validateUpload, DOCUMENT_ALLOWED_TYPES, MAX_DOCUMENT_BYTES } from '@/lib/uploads/validateUpload';
import { requireAdmin } from '@/lib/auth/requireRole';

export const dynamic = 'force-dynamic';

const ALLOWED_FIELDS = [
  'licenseImageFront', 'licenseImageBack', 'insurancePolicyDoc',
  'policeCheckDoc', 'wwcCheckDoc', 'photoIdDoc',
  'certificationDoc', 'vehicleRegistrationDoc',
];

export async function POST(
  req: NextRequest,
  { params }: { params: { instructorId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    // FIX #3: Re-verify admin role from DB — don't trust JWT alone
    const auth = await requireAdmin(session);
    if (auth.error) return auth.error;

    const contentType = req.headers.get('content-type') || '';

    // Handle remove (JSON body)
    if (contentType.includes('application/json')) {
      const { field, remove } = await req.json();
      if (!field || !ALLOWED_FIELDS.includes(field)) {
        return NextResponse.json({ error: 'Invalid field' }, { status: 400 });
      }
      if (remove) {
        await prisma.instructor.update({
          where: { id: params.instructorId },
          data: { [field]: null },
        });
        return NextResponse.json({ success: true });
      }
    }

    // Handle upload (multipart)
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const field = formData.get('field') as string | null;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!field || !ALLOWED_FIELDS.includes(field)) {
      return NextResponse.json({ error: 'Invalid document field' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validate MIME type and magic bytes before sending to Cloudinary
    const uploadValidation = validateUpload(buffer, file.type, DOCUMENT_ALLOWED_TYPES, MAX_DOCUMENT_BYTES);
    if (!uploadValidation.valid) {
      return NextResponse.json({ error: uploadValidation.error }, { status: uploadValidation.status });
    }

    const result = await cloudinaryService.uploadInstructorDocument(
      params.instructorId,
      field,
      buffer
    );

    await prisma.instructor.update({
      where: { id: params.instructorId },
      data: { [field]: result.url },
    });

    return NextResponse.json({ success: true, url: result.url, publicId: result.publicId });
  } catch (error) {
    console.error('Admin doc upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
