import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { instructorId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const deny = await requirePermission(session, PERM.OPERATIONS_DOCUMENTS_VIEW);
    if (deny) return deny;

    const instructor = await prisma.instructor.findUnique({
      where: { id: params.instructorId },
      select: {
        id: true,
        name: true,
        phone: true,
        licenseNumber: true,
        insuranceNumber: true,
        licenseImageFront: true,
        licenseImageBack: true,
        insurancePolicyDoc: true,
        policeCheckDoc: true,
        wwcCheckDoc: true,
        photoIdDoc: true,
        certificationDoc: true,
        vehicleRegistrationDoc: true,
        documentsVerified: true,
        documentsVerifiedAt: true,
        // Real DateTime columns (written since 2026-07-21)
        licenseExpiry: true,
        insuranceExpiry: true,
        policeCheckExpiry: true,
        wwcCheckExpiry: true,
        // Legacy JSON blob for fallback
        workingHours: true,
        user: { select: { email: true } },
      },
    });

    if (!instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    // Prefer dedicated DateTime columns; fall back to workingHours.expiry for old records
    const wh = (instructor.workingHours as any) || {};
    const legacyExp = wh.expiry || {};

    return NextResponse.json({
      ...instructor,
      email: instructor.user?.email || 'N/A',
      licenseExpiry:     instructor.licenseExpiry?.toISOString()    ?? legacyExp.licenseExpiry    ?? null,
      insuranceExpiry:   instructor.insuranceExpiry?.toISOString()   ?? legacyExp.insuranceExpiry   ?? null,
      policeCheckExpiry: instructor.policeCheckExpiry?.toISOString() ?? legacyExp.policeCheckExpiry ?? null,
      wwcCheckExpiry:    instructor.wwcCheckExpiry?.toISOString()    ?? legacyExp.wwcCheckExpiry    ?? null,
    });
  } catch (error) {
    console.error('Get instructor documents error:', error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}
