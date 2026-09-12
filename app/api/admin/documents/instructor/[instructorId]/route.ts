import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';
import { mergeDrivingProfile } from '@/lib/extensions/driving/providerProfile';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { instructorId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const deny = await requirePermission(session, PERM.OPERATIONS_DOCUMENTS_VIEW);
    if (deny) return deny;

    const instructorBase = await (prisma as any).provider.findUnique({
      where: { id: params.instructorId },
      select: {
        id: true,
        name: true,
        phone: true,
        documentsVerified: true,
        documentsVerifiedAt: true,
        workingHours: true,
        user: { select: { email: true } },
      },
    });

    if (!instructorBase) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    // Merge all document fields from extension table (falls back to Instructor cols)
    const instructor = await mergeDrivingProfile(instructorBase.id, instructorBase as any) as any;

    // Prefer dedicated DateTime columns; fall back to workingHours.expiry for old records
    const wh = (instructorBase.workingHours as any) || {};
    const legacyExp = wh.expiry || {};

    return NextResponse.json({
      ...instructorBase,
      email: instructorBase.user?.email || 'N/A',
      licenseExpiry:     instructor.licenseExpiry instanceof Date ? instructor.licenseExpiry.toISOString() : instructor.licenseExpiry ?? legacyExp.licenseExpiry ?? null,
      insuranceExpiry:   instructor.insuranceExpiry instanceof Date ? instructor.insuranceExpiry.toISOString() : instructor.insuranceExpiry ?? legacyExp.insuranceExpiry ?? null,
      policeCheckExpiry: instructor.policeCheckExpiry instanceof Date ? instructor.policeCheckExpiry.toISOString() : instructor.policeCheckExpiry ?? legacyExp.policeCheckExpiry ?? null,
      wwcCheckExpiry:    instructor.wwcCheckExpiry instanceof Date ? instructor.wwcCheckExpiry.toISOString() : instructor.wwcCheckExpiry ?? legacyExp.wwcCheckExpiry ?? null,
    });
  } catch (error) {
    console.error('Get instructor documents error:', error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}
