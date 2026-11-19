import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getPlatformLedger } from '@/lib/services/ledger-service';

import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';
import { getPdaFundsHeldReconciliation } from '@/lib/services/pda-financial-operations';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const deny = await requirePermission(session, PERM.FINANCE_REVENUE_VIEW);
  if (deny) return deny;

  const { searchParams } = new URL(req.url);
  const take = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);
  const type = searchParams.get('type'); // optional filter

  const [ledger, entries, pdaFundsHeld] = await Promise.all([
    getPlatformLedger(),
    prisma.ledgerEntry.findMany({
      where: type ? { type } : undefined,
      orderBy: { createdAt: 'desc' },
      take,
    }),
    getPdaFundsHeldReconciliation(),
  ]);

  return NextResponse.json({ ledger, entries, pdaFundsHeld });
}
