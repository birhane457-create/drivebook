import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const deny = await requirePermission(session, PERM.USERS_INSTRUCTORS_VIEW);
  if (deny) return deny;

  const instructors = await prisma.instructor.findMany({
    where: { approvalStatus: 'APPROVED' },
    select: { id: true, name: true, hourlyRate: true, serviceAreas: true, baseAddress: true },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ instructors });
}
