import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cloudinaryService } from '@/lib/services/cloudinary';

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
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    const url = await cloudinaryService.uploadInstructorDocument(
      params.instructorId,
      field,
      buffer
    );

    await prisma.instructor.update({
      where: { id: params.instructorId },
      data: { [field]: url },
    });

    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error('Admin doc upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
