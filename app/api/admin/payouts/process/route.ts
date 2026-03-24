import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildPayout, executePayout } from '@/lib/services/payout-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { instructorId, transactionIds } = await req.json();
    if (!instructorId) return NextResponse.json({ error: 'instructorId required' }, { status: 400 });

    // Layer 4: ABN verification gate
    // Payout blocked if instructor has an ABN on file but it hasn't been verified yet.
    // Instructors with no ABN proceed (47% withholding applies).
    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
      select: { abn: true, abnVerified: true, abnStatus: true },
    });

    if (instructor?.abn && !instructor.abnVerified) {
      return NextResponse.json({
        error: 'ABN not verified — payout blocked until admin verifies the ABN',
        code: 'ABN_NOT_VERIFIED',
        abnStatus: instructor.abnStatus,
      }, { status: 403 });
    }

    // Phase 1: validate + create payout record (no Stripe)
    const { payoutId, alreadyPaid } = await buildPayout(instructorId, session.user.id, transactionIds);
    if (alreadyPaid) {
      return NextResponse.json({ success: true, status: 'PAID', payoutId, message: 'Already paid' });
    }

    // Phase 2: acquire lock + execute Stripe transfer
    const result = await executePayout(payoutId, session.user.id);

    if (result.status === 'FAILED') {
      return NextResponse.json({ error: result.failureReason ?? 'Payout failed', ...result }, { status: 502 });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Payout process error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
