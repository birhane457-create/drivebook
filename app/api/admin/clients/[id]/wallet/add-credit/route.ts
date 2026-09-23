/**
 * POST /api/admin/clients/[id]/wallet/add-credit
 *
 * MM-12-D: Idempotency implementation (fixed in MM-12-D review).
 *
 * Requires header:  Idempotency-Key: <UUID v4>
 *
 * Claim-first flow (see MM-12-C_DESIGN_VERIFICATION.md §Q3):
 *   1. INSERT idempotency row with NULL response (claim key inside $transaction)
 *      ON CONFLICT -> replay completed response, or 409 if in-flight
 *   2. Calculate ledger balance using tx (NOT the global prisma client)
 *   3. Create WalletTransaction (CREDIT) using tx
 *   4. Update cached ClientWallet.balance using tx (cache only)
 *   5. Build response body
 *   6. UPDATE idempotency row with transactionId + response using tx
 *   All six steps are inside the same Prisma $transaction.
 *
 * Balance reads use tx.walletTransaction.findMany inside the transaction —
 * NOT getWalletBalance() which opens a separate connection on the global
 * prisma client. This ensures the balance calculation is consistent with
 * any in-flight writes on this wallet within the same transaction.
 *
 * ClientWallet.balance is a performance cache only — never the source of truth.
 * getWalletBalance() (ledger sum) remains authoritative for reads OUTSIDE
 * this transaction (audit log, receipt email).
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
    // All six steps execute inside the same Prisma $transaction so that the
    // idempotency key and the WalletTransaction row are committed atomically.
    // A failure at any step rolls back both writes; a retry finds no key and
    // executes cleanly.

    let responseBody: object;

    try {
      responseBody = await prisma.$transaction(async (tx) => {

        // ── Step 1: Claim idempotency key ─────────────────────────────────────
        // PostgreSQL locks the row on INSERT. A concurrent INSERT of the same
        // (key, walletId, operationType) tuple blocks until this tx commits or
        // rolls back, then observes the committed row and takes the replay branch.
        const claimed = await tx.$queryRaw<Array<{ key: string }>>`
          INSERT INTO "AdminWalletIdempotencyKey"
            ("key", "walletId", "operationType", "createdAt", "expiresAt")
          VALUES
            (${idempotencyKey}, ${wallet.id}, 'CREDIT', NOW(), ${expiresAt})
          ON CONFLICT ("key", "walletId", "operationType") DO NOTHING
          RETURNING "key"
        `;

        if (claimed.length === 0) {
          // Key already exists — determine state
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
            // Narrow race: claimed then deleted between our INSERT and this SELECT
            throw new Error('IDEMPOTENCY_RETRY');
          }

          const row = existing[0];

          if (row.expiresAt <= new Date()) {
            // Expired — delete stale row; caller should retry with same key
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

          // response IS NULL — a concurrent request holds the claim in-flight
          throw new Error('IDEMPOTENCY_IN_FLIGHT');
        }

        // ── Step 2: Calculate ledger balance via tx (NOT global prisma) ───────
        // Using tx.walletTransaction ensures we read from the same transaction
        // snapshot as the write we are about to make. Using getWalletBalance()
        // here would open a separate database connection on the global prisma
        // client, outside this transaction's isolation boundary.
        const confirmedTxRows = await tx.walletTransaction.findMany({
          where: { walletId: wallet.id, status: 'CONFIRMED' },
          select: { type: true, amount: true },
        });

        const balanceBefore = confirmedTxRows.reduce((acc, t) => {
          const v = Number(t.amount);
          return t.type === 'CREDIT' ? acc + v : acc - v;
        }, 0);

        // ── Step 3: Create credit transaction via tx ───────────────────────────
        const walletTx = await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'CREDIT',
            amount: amount,
            status: 'CONFIRMED',
            description: reason || 'Manual credit added by admin',
          },
        });

        // ── Step 4: Update cached balance via tx (cache only) ─────────────────
        await tx.clientWallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: amount } },
        });

        // ── Step 5: Build response body ───────────────────────────────────────
        const newBalance = balanceBefore + amount;
        const body = {
          success: true,
          message: `Added ${amount} to ${user.email}'s wallet`,
          wallet: { id: wallet.id, balance: newBalance },
          transactionId: walletTx.id,
          previousBalance: balanceBefore,
          newBalance,
        };

        // ── Step 6: Store completed response in idempotency row via tx ─────────
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
        return NextResponse.json(err.replay, { status: 200 });
      }
      if (err?.message === 'IDEMPOTENCY_IN_FLIGHT') {
        return NextResponse.json(
          { error: 'Request in progress — retry after a moment' },
          { status: 409 }
        );
      }
      if (err?.message === 'IDEMPOTENCY_EXPIRED' || err?.message === 'IDEMPOTENCY_RETRY') {
        return NextResponse.json(
          { error: 'Idempotency key expired or unavailable — please retry' },
          { status: 409 }
        );
      }
      throw err;
    }

    // ── Audit log (outside transaction — non-critical) ────────────────────────
    // getWalletBalance() is correct here: we are outside the transaction and
    // want the committed ledger state for the audit record.
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
            balanceBefore: (responseBody as any).previousBalance,
            balanceAfter: finalBalance.balance,
          } as any,
        },
      });
    } catch (auditErr) {
      console.error('Audit log failed for wallet credit:', auditErr);
    }

    // ── Receipt email (outside transaction — non-critical) ────────────────────
    try {
      await sendAdminCreditReceipt({
        customerName: user.name || user.email,
        customerEmail: user.email,
        receiptId: (responseBody as any).transactionId,
        creditedAt: new Date(),
        amountAdded: amount,
        reason: reason || 'Manual credit added by admin',
        walletBalanceBefore: (responseBody as any).previousBalance,
        walletBalanceAfter: (responseBody as any).newBalance,
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
