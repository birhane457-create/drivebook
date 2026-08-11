import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildPayout, executePayout } from '@/lib/services/payout-service';
import { z } from 'zod';

import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';
export const dynamic = 'force-dynamic';

// P1-10 FIX: Validate request body — transactionIds must be cuid strings, capped at 500,
// and no unbounded findMany risk. Cross-instructor check is handled in buildPayout which
// filters by instructorId, but explicit validation here prevents DB amplification.
const processPayoutSchema = z.object({
  instructorId: z.string().cuid(),
  transactionIds: z.array(z.string().cuid()).max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = processPayoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', issues: parsed.error.issues }, { status: 400 });
    }
    const { instructorId, transactionIds } = parsed.data;

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
