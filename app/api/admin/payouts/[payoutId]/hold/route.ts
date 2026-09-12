import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { holdPayout, releasePayout } from '@/lib/services/payout-service';
import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { payoutId: string } }) {
  const session = await getServerSession(authOptions);
  const deny = await requirePermission(session, PERM.FINANCE_PAYOUTS_HOLD);
  if (deny) return deny;
  const { reason } = await req.json();
  if (!reason) return NextResponse.json({ error: 'reason required' }, { status: 400 });
  await holdPayout(params.payoutId, session!.user!.id!, reason);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { payoutId: string } }) {
  const session = await getServerSession(authOptions);
  const deny = await requirePermission(session, PERM.FINANCE_PAYOUTS_HOLD);
  if (deny) return deny;
  await releasePayout(params.payoutId, session!.user!.id!);
  return NextResponse.json({ success: true });
}
