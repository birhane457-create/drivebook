/**
 * Admin: manually mark an instructor's ABN as verified (or revoke verification).
 * Used when ABR API is unavailable or admin has confirmed via other means.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { verified, entityName, note } = await req.json();

  const instructor = await prisma.instructor.findUnique({
    where: { id: params.id },
    select: { id: true, abn: true, name: true },
  });
  if (!instructor) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!instructor.abn) return NextResponse.json({ error: 'No ABN on file' }, { status: 400 });

  await prisma.instructor.update({
    where: { id: params.id },
    data: {
      abnVerified: verified,
      abnStatus: verified ? 'ACTIVE' : 'REVIEW_REQUIRED',
      abnEntityName: entityName ?? undefined,
      abnVerifiedAt: verified ? new Date() : null,
      abnVerifiedBy: session.user.id,
      withholdingTaxRate: verified ? 0 : 47,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: verified ? 'ABN_VERIFIED' : 'ABN_VERIFICATION_REVOKED',
      actorId: session.user.id,
      actorRole: 'ADMIN',
      targetType: 'INSTRUCTOR',
      targetId: params.id,
      success: true,
      metadata: { abn: instructor.abn, entityName, note },
    },
  });

  return NextResponse.json({ success: true, abnVerified: verified });
}
