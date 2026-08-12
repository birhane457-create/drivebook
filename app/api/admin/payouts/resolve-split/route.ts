import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { appendLedgerEntry, incrementLedger } from '@/lib/services/ledger-service';
import crypto from 'crypto';

import { requirePermission } from '@/lib/auth/requireRole';
import { PERM } from '@/lib/rbac/permissions';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/payouts/resolve-split
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const deny = await requirePermission(session, PERM.FINANCE_PAYOUTS_RESOLVE);
    if (deny) return deny;

    const body = await req.json();
    const { transactionId, refundAmount, payoutAmount, reason } = body as {
      transactionId: string;
      refundAmount: number;
      payoutAmount: number;
      reason?: string;
    };

    // ── Input validation ─────────────────────────────────────────────────────
    if (!transactionId) {
      return NextResponse.json({ error: 'transactionId is required' }, { status: 400 });
    }
    if (typeof refundAmount !== 'number' || refundAmount < 0) {
      return NextResponse.json({ error: 'refundAmount must be a non-negative number' }, { status: 400 });
    }
    if (typeof payoutAmount !== 'number' || payoutAmount < 0) {
      return NextResponse.json({ error: 'payoutAmount must be a non-negative number' }, { status: 400 });
    }
    if (refundAmount === 0 && payoutAmount === 0) {
      return NextResponse.json({ error: 'At least one of refundAmount or payoutAmount must be > 0' }, { status: 400 });
    }

    // ── Load transaction ─────────────────────────────────────────────────────
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

    // ── Idempotency — already resolved ───────────────────────────────────────
    if (txn.resolutionStatus === 'COMPLETED') {
      return NextResponse.json(
        {
          error: 'Split resolution already completed',
          resolutionGroupId: txn.resolutionGroupId,
          resolutionStatus: txn.resolutionStatus,
        },
        { status: 409 },
      );
    }

    const TERMINAL = ['REFUNDED', 'CANCELLED', 'COMPLETED'];
    if (TERMINAL.includes(txn.status) && txn.resolutionStatus !== 'PARTIAL') {
      return NextResponse.json(
        { error: `Transaction already resolved (status: ${txn.status})` },
        { status: 409 },
      );
    }

    // ── Amount guards ────────────────────────────────────────────────────────
    if (refundAmount > txn.amount + 0.001) {
      return NextResponse.json(
        { error: `refundAmount (${refundAmount}) exceeds transaction amount (${txn.amount})` },
        { status: 422 },
      );
    }
    if (payoutAmount > txn.instructorPayout + 0.001) {
      return NextResponse.json(
        { error: `payoutAmount (${payoutAmount}) exceeds instructor payout (${txn.instructorPayout})` },
        { status: 422 },
      );
    }

    const wallet = txn.booking?.client?.wallet;
    if (refundAmount > 0 && !wallet) {
      return NextResponse.json(
        { error: 'Client wallet not found — cannot issue refund' },
        { status: 422 },
      );
    }

    const adminId = session.user.id;
    const now = new Date();

    // ── Generate or reuse resolutionGroupId ──────────────────────────────────
    const resolutionGroupId =
      txn.resolutionGroupId ??
      `RES-GRP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // ── Atomic DB transaction ────────────────────────────────────────────────
    // Both legs (refund + approve) commit together or not at all.
    // Stripe is NOT called here — payout layer handles execution.
    await (prisma as any).$transaction(async (tx: any) => {
      // 1. Refund to client wallet
      if (refundAmount > 0) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: refundAmount } },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount: refundAmount,
            type: 'REFUND',
            status: 'CONFIRMED',
            description: `Split resolution refund — booking ${txn.bookingId} (group: ${resolutionGroupId})`,
            referenceId: transactionId,
          },
        });
      }

      // 2. Mark transaction SETTLED (payout-eligible) with resolution tracking
      await tx.transaction.update({
        where: { id: transactionId },
        data: {
          // SETTLED = eligible for payout run; instructorPayout capped to approved amount
          status: 'SETTLED',
          instructorPayout: payoutAmount,
          resolutionGroupId,
          resolutionStatus: 'COMPLETED',
          updatedAt: now,
        },
      });

      // 3. Audit log — single entry covering both legs
      await tx.auditLog.create({
        data: {
          action: 'DISPUTE_RESOLVED_SPLIT',
          actorId: adminId,
          actorRole: 'ADMIN',
          targetType: 'TRANSACTION',
          targetId: transactionId,
          success: true,
          metadata: {
            resolutionGroupId,
            refundAmount,
            payoutAmount,
            originalAmount: txn.amount,
            originalInstructorPayout: txn.instructorPayout,
            reason,
            bookingId: txn.bookingId,
            note: 'Atomic split — refund issued + instructor approved for payout in one operation',
          },
        },
      });
    });

    // ── Ledger updates (outside DB tx — append-only, non-blocking) ───────────
    const ledgerOps: Promise<unknown>[] = [];

    if (refundAmount > 0) {
      ledgerOps.push(
        appendLedgerEntry({
          type: 'REFUND_ISSUED',
          amount: -refundAmount,
          referenceId: transactionId,
          referenceType: 'TRANSACTION',
          instructorId: txn.instructorId,
          description: `Split refund to client — booking ${txn.bookingId} (group: ${resolutionGroupId})`,
          metadata: { resolutionGroupId, reason, resolvedBy: adminId },
        }),
        incrementLedger({ totalRefunded: refundAmount }),
      );
    }

    if (payoutAmount > 0) {
      ledgerOps.push(
        appendLedgerEntry({
          type: 'ADJUSTMENT',
          amount: payoutAmount,
          referenceId: transactionId,
          referenceType: 'TRANSACTION',
          instructorId: txn.instructorId,
          description: `Split payout approved — booking ${txn.bookingId} (group: ${resolutionGroupId})`,
          metadata: { resolutionGroupId, reason, resolvedBy: adminId },
        }),
      );
    }

    await Promise.all(ledgerOps);

    return NextResponse.json({
      success: true,
      resolutionGroupId,
      resolutionStatus: 'COMPLETED',
      refundAmount,
      payoutAmount,
      pendingPayout: payoutAmount > 0,
      message: [
        refundAmount > 0 ? `$${refundAmount.toFixed(2)} refunded to client wallet` : null,
        payoutAmount > 0 ? `$${payoutAmount.toFixed(2)} approved for instructor payout` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    });
  } catch (error) {
    console.error('Resolve-split error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to resolve split' },
      { status: 500 },
    );
  }
}
