import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // R-02: use session.user.role from JWT — same pattern as every other admin route.
  // The old code did an extra DB lookup (prisma.user.findUnique) on every request just to read role,
  // when authOptions already embeds role in the JWT token.
  if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const instructors = await prisma.instructor.findMany({
    where: { approvalStatus: 'APPROVED' },
    select: { id: true, name: true, hourlyRate: true, serviceAreas: true, baseAddress: true },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ instructors });
}
