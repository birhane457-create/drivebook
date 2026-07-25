/**
 * GET /api/instructor/documents/[type]
 *
 * Returns a short-lived signed Cloudinary URL for the instructor's own document.
 * Expires in 5 minutes.
 *
 * Access: the authenticated instructor only — their own documents.
 * Admins use /api/admin/instructors/[id]/documents/[type] instead.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateSignedUrl } from '@/lib/services/cloudinary';

export const dynamic = 'force-dynamic';

const ALLOWED_TYPES = new Set([
  'licenseImageFront', 'licenseImageBack', 'insurancePolicyDoc',
  'policeCheckDoc', 'wwcCheckDoc', 'photoIdDoc',
  'certificationDoc', 'vehicleRegistrationDoc',
]);

export async function GET(
  req: NextRequest,
  { params }: { params: { type: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type: docType } = params;

    if (!ALLOWED_TYPES.has(docType)) {
      return NextResponse.json({ error: 'Unknown document type' }, { status: 400 });
    }

    const instructor = await prisma.instructor.findUnique({
      where: { id: session.user.instructorId },
      select: { [docType]: true } as any,
    }) as any;

    if (!instructor) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const storedValue: string | null = instructor[docType];
    if (!storedValue) {
      return NextResponse.json({ error: 'Document not uploaded yet' }, { status: 404 });
    }

    // Resolve publicId from legacy URL or new publicId
    let publicId: string;
    if (storedValue.startsWith('http')) {
      const match = storedValue.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
      if (!match) {
        return NextResponse.json({ url: storedValue, legacy: true });
      }
      publicId = match[1];
    } else {
      publicId = storedValue;
    }

    const signedUrl = await generateSignedUrl(publicId, 300);

    return NextResponse.json({
      url: signedUrl,
      expiresIn: 300,
      documentType: docType,
    });
  } catch (error) {
    console.error('Instructor document URL error:', error);
    return NextResponse.json({ error: 'Failed to generate document URL' }, { status: 500 });
  }
}
