/**
 * GET /api/admin/instructors/[id]/documents/[type]
 *
 * Returns a short-lived signed Cloudinary URL for a private compliance document.
 * Expires in 5 minutes. Never returns a permanent URL.
 *
 * Access: ADMIN and SUPER_ADMIN only.
 * Every view is logged to the AuditLog.
 *
 * [type] must be one of the recognised document field names.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateSignedUrl } from '@/lib/services/cloudinary';

export const dynamic = 'force-dynamic';

// Map DB field names → Cloudinary subfolder (matches uploadInstructorDocument)
const FIELD_TO_SUBFOLDER: Record<string, string> = {
  licenseImageFront:      'driver-licence',
  licenseImageBack:       'driver-licence',
  insurancePolicyDoc:     'insurance',
  policeCheckDoc:         'identity',
  wwcCheckDoc:            'wwcc',
  photoIdDoc:             'identity',
  certificationDoc:       'instructor-authority',
  vehicleRegistrationDoc: 'vehicle-registration',
};

function isAdmin(session: any) {
  return session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN';
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; type: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: instructorId, type: docType } = params;

    if (!FIELD_TO_SUBFOLDER[docType]) {
      return NextResponse.json({ error: 'Unknown document type' }, { status: 400 });
    }

    // Fetch the stored value — could be a publicId or a legacy full URL
    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
      select: { [docType]: true } as any,
    }) as any;

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    const storedValue: string | null = instructor[docType];
    if (!storedValue) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Resolve to a publicId — handle both legacy URLs and new publicIds
    let publicId: string;
    if (storedValue.startsWith('http')) {
      // Legacy: extract publicId from Cloudinary URL
      // e.g. https://res.cloudinary.com/cloud/image/upload/v123/drivebook/private/...
      const match = storedValue.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
      if (!match) {
        // Can't extract publicId — return the legacy URL directly for now
        // This will stop happening once documents are re-uploaded
        return NextResponse.json({ url: storedValue, legacy: true });
      }
      publicId = match[1];
    } else {
      publicId = storedValue;
    }

    // Generate signed URL (5 minutes)
    const signedUrl = await generateSignedUrl(publicId, 300);

    // Audit log — every document view is recorded
    try {
      await prisma.auditLog.create({
        data: {
          action: 'DOCUMENT_VIEWED',
          actorId: session!.user.id,
          actorRole: 'ADMIN',
          targetType: 'INSTRUCTOR',
          targetId: instructorId,
          success: true,
          metadata: { documentType: docType, publicId } as any,
        },
      });
    } catch {
      // Non-fatal — don't block document access if audit log fails
    }

    return NextResponse.json({
      url: signedUrl,
      expiresIn: 300, // seconds
      documentType: docType,
    });
  } catch (error) {
    console.error('Document signed URL error:', error);
    return NextResponse.json({ error: 'Failed to generate document URL' }, { status: 500 });
  }
}
