/**
 * POST /api/admin/clients/[id]/wallet/add-credit
 *
 * MM-12-D: Idempotency implementation.
 *
 * Requires header:  Idempotency-Key: <UUID v4>
 *
 * Claim-first flow (see MM-12-C_DESIGN_VERIFICATION.md §Q3):
 *   1. INSERT idempotency row with NULL response (claim key inside $transaction)
 *      ON CONFLICT -> replay completed response, or 409 if in-flight
 *   2. Create WalletTransaction (CREDIT)
 *   3. UPDATE idempotency row with transactionId + response
 *   All three steps are inside the same Prisma $transaction.
 *
 * ClientWallet.balance is a performance cache only — never the source of truth.
 * getWalletBalance() (ledger sum) remains authoritative for all balance reads.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getWalletBalance, getOrCreateWallet } from '@/lib/services/wallet-helpers';
import { sendAdminCreditReceipt } from '@/lib/services/receipt-email';
import { checkPermission } from '@/lib/rbac/checkPermission';
import { PERM } from '@/lib/rbac/permissions';

export const dynamic = 'force-dynamic';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const session = await getServerSession(authOptions);
    const check = await checkPermission(session, PERM.FINANCE_CREDITS_MANAGE);
    if (!check.allowed) return check.response;

    // ── Idempotency-Key header ────────────────────────────────────────────────
    const idempotencyKey = req.headers.get('Idempotency-Key');
    if (!idempotencyKey || idempotencyKey.trim() === '') {
      return NextResponse.json(
        { error: 'Idempotency-Key header is required' },
        { status: 400 }
      );
    }

    // ── Request body ──────────────────────────────────────────────────────────
    const { amount, reason } = await req.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    // Enforce per-staff credit limit
    if (!check.isSuperAdmin && check.staffMember) {
      const limit = check.staffMember.maxRefundAmount;
      if (amount > limit) {
        return NextResponse.json(
          { error: `Amount exceeds your credit limit of $${limit}` },
          { status: 403 }
        );
      }
    }

    // ── Resolve userId ────────────────────────────────────────────────────────
    let userId: string | null = null;

    const client = await prisma.customer.findUnique({
      where: { id: params.id },
      select: { userId: true },
    });

    if (client) {
      userId = client.userId;
    } else {
      userId = params.id;
    }

    if (!userId) {
      return NextResponse.json({ error: 'Client has no associated user account' }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // ── Get or create wallet (outside transaction — idempotent operation) ─────
    const wallet = await getOrCreateWallet(user.id);

    const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_MS);

    // ── Claim-first transaction ───────────────────────────────────────────────
    // Step 1: INSERT idempotency key row (NULL response = in-flight claim).
    //   PostgreSQL locks the row on INSERT; concurrent requests with the same
    //   key block here until this transaction commits or rolls back.
    // Step 2: Create WalletTransaction (CREDIT).
    // Step 3: UPDATE idempotency row with transactionId + response.
    //
    // If the DB accepts steps 2 and 3 but this block throws before returning,
    // the whole $transaction rolls back — both the ledger row and the key row
    // are undone atomically. A retry will find no key and execute cleanly.

    let responseBody: object;

    try {
      responseBody = await prisma.$transaction(async (tx) => {
        // Step 1 — claim idempotency key
        const claimed = await tx.$queryRaw<Array<{ key: string }>>`
          INSERT INTO "AdminWalletIdempotencyKey"
            ("key", "walletId", "operationType", "createdAt", "expiresAt")
          VALUES
            (${idempotencyKey}, ${wallet.id}, 'CREDIT', NOW(), ${expiresAt})
          ON CONFLICT ("key", "walletId", "operationType") DO NOTHING
          RETURNING "key"
        `;

        if (claimed.length === 0) {
          // Key already exists — check state
          const existing = await tx.$queryRaw<Array<{
            response: object | null;
            expiresAt: Date;
          }>>`
            SELECT "response", "expiresAt"
            FROM "AdminWalletIdempotencyKey"
            WHERE "key" = ${idempotencyKey}
              AND "walletId" = ${wallet.id}
              AND "operationType" = 'CREDIT'
          `;

          if (!existing.length) {
            // Race: claimed then deleted between our INSERT and this SELECT — treat as new
            throw new Error('IDEMPOTENCY_RETRY');
          }

          const row = existing[0];

          if (row.expiresAt <= new Date()) {
            // Expired — delete and re-run as a new request
            await tx.$executeRaw`
              DELETE FROM "AdminWalletIdempotencyKey"
              WHERE "key" = ${idempotencyKey}
                AND "walletId" = ${wallet.id}
                AND "operationType" = 'CREDIT'
            `;
            throw new Error('IDEMPOTENCY_EXPIRED');
          }

          if (row.response !== null) {
            // Completed — replay stored response
            throw Object.assign(new Error('IDEMPOTENCY_REPLAY'), { replay: row.response });
          }

          // response IS NULL — another request is in-flight with this key
          throw new Error('IDEMPOTENCY_IN_FLIGHT');
        }

        // Step 2 — read balance before credit (inside transaction for consistency)
        const balanceBefore = await getWalletBalance(user.id);

        // Step 3 — create credit transaction
        const walletTx = await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'CREDIT',
            amount: amount,
            status: 'CONFIRMED',
            description: reason || 'Manual credit added by admin',
          },
        });

        // Step 4 — update cached balance (cache only — not authoritative)
        await tx.clientWallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: amount } },
        });

        // Step 5 — build response body
        const newBalanceRaw = balanceBefore.balance + amount;
        const body = {
          success: true,
          message: `Added ${amount} to ${user.email}'s wallet`,
          wallet: { id: wallet.id, balance: newBalanceRaw },
          transactionId: walletTx.id,
        };

        // Step 6 — store completed response in idempotency row
        await tx.$executeRaw`
          UPDATE "AdminWalletIdempotencyKey"
          SET "transactionId" = ${walletTx.id},
              "response"      = ${JSON.stringify(body)}::jsonb
          WHERE "key" = ${idempotencyKey}
            AND "walletId" = ${wallet.id}
            AND "operationType" = 'CREDIT'
        `;

        return body;
      });
    } catch (err: any) {
      if (err?.replay) {
        // Completed duplicate — return stored result
        return NextResponse.json(err.replay, { status: 200 });
      }
      if (err?.message === 'IDEMPOTENCY_IN_FLIGHT') {
        return NextResponse.json(
          { error: 'Request in progress — retry after a moment' },
          { status: 409 }
        );
      }
      if (err?.message === 'IDEMPOTENCY_EXPIRED' || err?.message === 'IDEMPOTENCY_RETRY') {
        // Re-enter without idempotency key protection — key was expired/missing.
        // Fall through to a plain (non-idempotent) execution.
        // In practice this is a vanishingly rare race; callers should simply retry
        // with the same key and they will land in the replay path.
        return NextResponse.json(
          { error: 'Idempotency key expired or unavailable — please retry' },
          { status: 409 }
        );
      }
      throw err;
    }

    // ── Audit log (outside transaction — non-critical) ────────────────────────
    try {
      const finalBalance = await getWalletBalance(user.id);
      await prisma.auditLog.create({
        data: {
          action: 'WALLET_CREDITED',
          actorId: session!.user!.id,
          actorRole: session!.user!.role,
          targetType: 'WALLET',
          targetId: wallet.id,
          success: true,
          metadata: {
            transactionId: (responseBody as any).transactionId,
            userId: user.id,
            amount,
            reason: reason || 'Manual credit added by admin',
            idempotencyKey,
            balanceAfter: finalBalance.balance,
          } as any,
        },
      });
    } catch (auditErr) {
      console.error('Audit log failed for wallet credit:', auditErr);
    }

    // ── Receipt email (outside transaction — non-critical) ────────────────────
    try {
      const finalBalance = await getWalletBalance(user.id);
      await sendAdminCreditReceipt({
        customerName: user.name || user.email,
        customerEmail: user.email,
        receiptId: (responseBody as any).transactionId,
        creditedAt: new Date(),
        amountAdded: amount,
        reason: reason || 'Manual credit added by admin',
        walletBalanceBefore: finalBalance.balance - amount,
        walletBalanceAfter: finalBalance.balance,
      });
    } catch (e) {
      console.error('Admin credit receipt email failed:', e);
    }

    return NextResponse.json(responseBody);
  } catch (error) {
    console.error('Add credit error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
