import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { appendLedgerEntry, incrementLedger } from '@/lib/services/ledger-service';

export const dynamic = 'force-dynamic';

type ResolveAction =
  | 'refund_client'
  | 'approve_for_payout'   // canonical name
  | 'pay_instructor'        // legacy alias — treated as approve_for_payout
  | 'charge_instructor'
  | 'void';

/**
 * POST /api/admin/payouts/resolve
 *
 * Resolves a withheld or disputed transaction.
 *
 * Actions:
 *   refund_client      — refund full amount to client wallet; mark REFUNDED
 *   approve_for_payout — mark transaction SETTLED so it enters next payout run
 *                        (no Stripe call here — payout layer handles that)
 *   pay_instructor     — legacy alias for approve_for_payout (backward compat)
 *   charge_instructor  — mark CANCELLED + create a negative ADJUSTMENT ledger entry
 *   void               — write off; mark CANCELLED, no money moves
 *
 * Idempotency: terminal states (REFUNDED, CANCELLED, SETTLED) return 409.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session?.user ||
      (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { transactionId, action: rawAction, reason } = body as {
      transactionId: string;
      action: ResolveAction;
      reason?: string;
    };

    if (!transactionId || !rawAction) {
      return NextResponse.json(
        { error: 'transactionId and action are required' },
        { status: 400 },
      );
    }

    // Normalise legacy alias
    const action: ResolveAction =
      rawAction === 'pay_instructor' ? 'approve_for_payout' : rawAction;

    const validActions: ResolveAction[] = [
      'refund_client',
      'approve_for_payout',
      'charge_instructor',
      'void',
    ];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: `Unknown action: ${rawAction}` }, { status: 400 });
    }

    // Load transaction
    const txn = await (prisma as any).transaction.findUnique({
      where: { id: transactionId },
      include: {
        booking: {
          include: {
            client: { include: { wallet: true } },
          },
        },
      },
    });

    if (!txn) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // ── Idempotency guard — terminal states ──────────────────────────────────
    const TERMINAL = ['REFUNDED', 'CANCELLED', 'COMPLETED'];
    // SETTLED is terminal for approve_for_payout (already approved)
    if (txn.status === 'SETTLED' && action === 'approve_for_payout') {
      return NextResponse.json(
        { error: 'Transaction already approved for payout', status: txn.status },
        { status: 409 },
      );
    }
    if (TERMINAL.includes(txn.status)) {
      return NextResponse.json(
        { error: `Transaction already resolved (status: ${txn.status})`, status: txn.status },
        { status: 409 },
      );
    }

    const adminId = session.user.id;
    const now = new Date();

    // ── Execute action ───────────────────────────────────────────────────────

    if (action === 'refund_client') {
      // Refund to client wallet
      const wallet = txn.booking?.client?.wallet;
      if (!wallet) {
        return NextResponse.json(
          { error: 'Client wallet not found — cannot refund' },
          { status: 422 },
        );
      }

      await (prisma as any).$transaction([
        // Mark transaction refunded
        (prisma as any).transaction.update({
          where: { id: transactionId },
          data: { status: 'REFUNDED', updatedAt: now },
        }),
        // Credit client wallet
        (prisma as any).wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: txn.amount } },
        }),
        // Wallet transaction record
        (prisma as any).walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount: txn.amount,
            type: 'REFUND',
            status: 'CONFIRMED',
            description: `Dispute refund — booking ${txn.bookingId}`,
            referenceId: transactionId,
          },
        }),
        // Audit log
        (prisma as any).auditLog.create({
          data: {
            action: 'DISPUTE_RESOLVED_REFUND_CLIENT',
            actorId: adminId,
            actorRole: 'ADMIN',
            targetType: 'TRANSACTION',
            targetId: transactionId,
            success: true,
            metadata: { amount: txn.amount, reason, bookingId: txn.bookingId },
          },
        }),
      ]);

      // Ledger — money out (refund)
      await Promise.all([
        appendLedgerEntry({
          type: 'REFUND_ISSUED',
          amount: -txn.amount,
          referenceId: transactionId,
          referenceType: 'TRANSACTION',
          instructorId: txn.instructorId,
          description: `Dispute refund to client — booking ${txn.bookingId}`,
          metadata: { reason, resolvedBy: adminId },
        }),
        incrementLedger({ totalRefunded: txn.amount }),
      ]);

      return NextResponse.json({
        success: true,
        message: `Refunded $${txn.amount.toFixed(2)} to client wallet`,
        action: 'refund_client',
      });
    }

    if (action === 'approve_for_payout') {
      // Mark SETTLED — transaction becomes eligible for next payout run.
      // No Stripe call here. Payout layer (process/route.ts) handles execution.
      await (prisma as any).$transaction([
        (prisma as any).transaction.update({
          where: { id: transactionId },
          data: { status: 'SETTLED', updatedAt: now },
        }),
        (prisma as any).auditLog.create({
          data: {
            action: 'DISPUTE_RESOLVED_APPROVE_FOR_PAYOUT',
            actorId: adminId,
            actorRole: 'ADMIN',
            targetType: 'TRANSACTION',
            targetId: transactionId,
            success: true,
            metadata: {
              instructorPayout: txn.instructorPayout,
              reason,
              bookingId: txn.bookingId,
              note: 'Approved for payout — funds will be sent during next payout run',
            },
          },
        }),
      ]);

      return NextResponse.json({
        success: true,
        message: `Instructor approved for payout ($${txn.instructorPayout.toFixed(2)}). Funds will be sent during payout processing.`,
        action: 'approve_for_payout',
        pendingPayout: true,
      });
    }

    if (action === 'charge_instructor') {
      // Mark CANCELLED + create negative adjustment ledger entry.
      // Deducted from instructor's next payout via ADJUSTMENT entries.
      await (prisma as any).$transaction([
        (prisma as any).transaction.update({
          where: { id: transactionId },
          data: { status: 'CANCELLED', updatedAt: now },
        }),
        (prisma as any).auditLog.create({
          data: {
            action: 'DISPUTE_RESOLVED_CHARGE_INSTRUCTOR',
            actorId: adminId,
            actorRole: 'ADMIN',
            targetType: 'TRANSACTION',
            targetId: transactionId,
            success: true,
            metadata: {
              penaltyAmount: txn.instructorPayout,
              reason,
              bookingId: txn.bookingId,
            },
          },
        }),
      ]);

      // Ledger adjustment — recovered from next payout
      await appendLedgerEntry({
        type: 'ADJUSTMENT',
        amount: -txn.instructorPayout,
        referenceId: transactionId,
        referenceType: 'ADJUSTMENT',
        instructorId: txn.instructorId,
        description: `Instructor penalty — booking ${txn.bookingId} (recovered from next payout)`,
        metadata: { reason, resolvedBy: adminId },
      });

      return NextResponse.json({
        success: true,
        message: `Instructor penalty of $${txn.instructorPayout.toFixed(2)} applied — deducted from next payout`,
        action: 'charge_instructor',
      });
    }

    if (action === 'void') {
      // Write off — no money moves, transaction closed
      await (prisma as any).$transaction([
        (prisma as any).transaction.update({
          where: { id: transactionId },
          data: { status: 'CANCELLED', updatedAt: now },
        }),
        (prisma as any).auditLog.create({
          data: {
            action: 'DISPUTE_RESOLVED_VOID',
            actorId: adminId,
            actorRole: 'ADMIN',
            targetType: 'TRANSACTION',
            targetId: transactionId,
            success: true,
            metadata: { reason, bookingId: txn.bookingId, amount: txn.amount },
          },
        }),
      ]);

      return NextResponse.json({
        success: true,
        message: 'Transaction voided — no money moved',
        action: 'void',
      });
    }

    // Should never reach here
    return NextResponse.json({ error: 'Unhandled action' }, { status: 500 });
  } catch (error) {
    console.error('Resolve error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to resolve transaction' },
      { status: 500 },
    );
  }
}
