import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { holdPayout, releasePayout } from '@/lib/services/payout-service';

export const dynamic = 'force-dynamic';

// POST /api/admin/payouts/[payoutId]/hold  { reason }  → put ON_HOLD
// DELETE /api/admin/payouts/[payoutId]/hold             → release back to ELIGIBLE

export async function POST(req: NextRequest, { params }: { params: { payoutId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { reason } = await req.json();
  if (!reason) return NextResponse.json({ error: 'reason required' }, { status: 400 });
  await holdPayout(params.payoutId, session.user.id, reason);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { payoutId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await releasePayout(params.payoutId, session.user.id);
  return NextResponse.json({ success: true });
}
