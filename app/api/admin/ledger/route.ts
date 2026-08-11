import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getPlatformLedger } from '@/lib/services/ledger-service';

import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const take = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);
  const type = searchParams.get('type'); // optional filter

  const [ledger, entries] = await Promise.all([
    getPlatformLedger(),
    prisma.ledgerEntry.findMany({
      where: type ? { type } : undefined,
      orderBy: { createdAt: 'desc' },
      take,
    }),
  ]);

  return NextResponse.json({ ledger, entries });
}
