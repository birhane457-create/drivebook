import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { markPayoutSent, confirmPayoutReceived } from '@/lib/services/payout-service';
import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { payoutId: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    const deny = await requirePermission(session, PERM.FINANCE_PAYOUTS_RESOLVE);
    if (deny) return deny;

    const { payoutId } = params;
    const body = await req.json();
    const { action, bankReference } = body as { action: 'sent' | 'confirm'; bankReference?: string };

    if (action === 'sent') {
      if (!bankReference?.trim()) {
        return NextResponse.json({ error: 'bankReference is required' }, { status: 400 });
      }
      await markPayoutSent(payoutId, session!.user.id, bankReference.trim());
      return NextResponse.json({ success: true, status: 'SENT', message: 'Payout marked as sent' });
    }

    if (action === 'confirm') {
      await confirmPayoutReceived(payoutId, session!.user.id);
      return NextResponse.json({ success: true, status: 'PAID', message: 'Payout confirmed — ledger updated' });
    }

    return NextResponse.json({ error: 'action must be "sent" or "confirm"' }, { status: 400 });
  } catch (error) {
    console.error('[mark-sent] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 },
    );
  }
}
