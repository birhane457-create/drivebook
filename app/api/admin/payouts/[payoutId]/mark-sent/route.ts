import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { markPayoutSent, confirmPayoutReceived } from '@/lib/services/payout-service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/payouts/[payoutId]/mark-sent
 *
 * Body: { action: 'sent', bankReference: string }
 *   -> PENDING_TRANSFER -> SENT
 *
 * Body: { action: 'confirm' }
 *   -> SENT -> PAID + ledger updated
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { payoutId: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { payoutId } = params;
    const body = await req.json();
    const { action, bankReference } = body as { action: 'sent' | 'confirm'; bankReference?: string };

    if (action === 'sent') {
      if (!bankReference?.trim()) {
        return NextResponse.json({ error: 'bankReference is required' }, { status: 400 });
      }
      await markPayoutSent(payoutId, session.user.id, bankReference.trim());
      return NextResponse.json({ success: true, status: 'SENT', message: 'Payout marked as sent' });
    }

    if (action === 'confirm') {
      await confirmPayoutReceived(payoutId, session.user.id);
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
