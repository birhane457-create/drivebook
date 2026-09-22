/**
 * POST /api/admin/clients/[id]/wallet/deduct-credit
 *
 * MM-12-D: Idempotency + atomic deduction implementation.
 *
 * Requires header:  Idempotency-Key: <UUID v4>
 *
 * Claim-first flow with SELECT FOR UPDATE (see MM-12-C_DESIGN_VERIFICATION.md §Q3, §Q4):
 *   1. INSERT idempotency row with NULL response (claim key inside $transaction)
 *      ON CONFLICT -> replay completed response, or 409 if in-flight
 *   2. SELECT ... FOR UPDATE on ClientWallet — serialises concurrent deductions
 *   3. Recalculate authoritative ledger balance under the lock (getWalletBalance
 *      is NOT called here — we query WalletTransaction directly inside the tx)
 *   4. Balance check — safe because no concurrent write can occur under the lock
 *   5. Create WalletTransaction (DEBIT)
 *   6. UPDATE cached ClientWallet.balance (cache only — not authoritative)
 *   7. UPDATE idempotency row with transactionId + response
 *   All seven steps are inside the same Prisma $transaction.
 *
 * Acceptance invariants (MM-12-C §11):
 *   1. For any (Idempotency-Key, walletId, operationType), exactly one financial
 *      effect may be committed, regardless of sequential retries or concurrent
 *      first requests.
 *   2. No committed debit may cause the authoritative ledger-derived balance to
 *      fall below zero when the balance was non-negative and sufficient.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getWalletBalance, getOrCreateWallet } from '@/lib/services/wallet-helpers';
import { sendAdminDeductionReceipt } from '@/lib/services/receipt-email';
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
    const check = await checkPermission(session, PERM.USERS_CUSTOMERS_WALLET_DEDUCT);
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
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    if (!reason || reason.trim().length < 3) {
      return NextResponse.json({ error: 'Reason is required for deductions' }, { status: 400 });
    }

    // Enforce per-staff deduction limit
    if (!check.isSuperAdmin && check.staffMember) {
      const limit = check.staffMember.maxRefundAmount;
      if (amount > limit) {
        return NextResponse.json(
          { error: `Amount exceeds your deduction limit of $${limit}` },
          { status: 403 }
        );
      }
    }

    // ── Resolve userId ────────────────────────────────────────────────────────
    let userId: string | null = null;
    let userEmail: string | null = null;
    let userName: string | null = null;

    const client = await prisma.customer.findUnique({
      where: { id: params.id },
      select: { userId: true, user: { select: { id: true, email: true, name: true } } },
    });

    if (client?.userId && client.user) {
      userId = client.userId;
      userEmail = client.user.email;
      userName = client.user.name;
    } else {
      const user = await prisma.user.findUnique({
        where: { id: params.id },
        select: { id: true, email: true, name: true },
      });
      if (user) {
        userId = user.id;
        userEmail = user.email;
        userName = user.name;
      }
    }

    if (!userId || !userEmail) {
      return NextResponse.json({ error: 'User not found or has no account' }, { status: 404 });
    }

    // ── Get or create wallet (outside transaction — idempotent operation) ─────
    const wallet = await getOrCreateWallet(userId);

    const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_MS);

    // ── Claim-first + SELECT FOR UPDATE transaction ───────────────────────────
    let responseBody: object;

    try {
      responseBody = await prisma.$transaction(async (tx) => {
        // ── Step 1: Claim idempotency key ─────────────────────────────────────
        // PostgreSQL locks the row on INSERT. A concurrent INSERT of the same
        // (key, walletId, operationType) tuple blocks until this tx commits/rolls
        // back, then observes the committed row and takes the replay branch.
        const claimed = await tx.$queryRaw<Array<{ key: string }>>`
          INSERT INTO "AdminWalletIdempotencyKey"
            ("key", "walletId", "operationType", "createdAt", "expiresAt")
          VALUES
            (${idempotencyKey}, ${wallet.id}, 'DEBIT', NOW(), ${expiresAt})
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
              AND "operationType" = 'DEBIT'
          `;

          if (!existing.length) {
            throw new Error('IDEMPOTENCY_RETRY');
          }

          const row = existing[0];

          if (row.expiresAt <= new Date()) {
            await tx.$executeRaw`
              DELETE FROM "AdminWalletIdempotencyKey"
              WHERE "key" = ${idempotencyKey}
                AND "walletId" = ${wallet.id}
                AND "operationType" = 'DEBIT'
            `;
            throw new Error('IDEMPOTENCY_EXPIRED');
          }

          if (row.response !== null) {
            // Completed — replay stored response
            throw Object.assign(new Error('IDEMPOTENCY_REPLAY'), { replay: row.response });
          }

          // response IS NULL — concurrent in-flight request holds the key
          throw new Error('IDEMPOTENCY_IN_FLIGHT');
        }

        // ── Step 2: Lock the wallet row ───────────────────────────────────────
        // SELECT FOR UPDATE prevents any other transaction from modifying this
        // wallet row until this transaction commits or rolls back. Combined with
        // the idempotency claim above, two concurrent deduction requests will
        // serialise: the second waits here, then re-reads an updated balance.
        const walletRows = await tx.$queryRaw<Array<{
          id: string;
          balance: string; // Decimal comes back as string from queryRaw
        }>>`
          SELECT "id", "balance"
          FROM "ClientWallet"
          WHERE "id" = ${wallet.id}
          FOR UPDATE
        `;

        if (!walletRows.length) {
          throw new Error('Wallet not found under lock');
        }

        // ── Step 3: Recalculate authoritative ledger balance under the lock ───
        // Do NOT use getWalletBalance() here — it opens a separate connection
        // and would not see the uncommitted state of this transaction.
        // Query WalletTransaction directly inside the same tx.
        const txRows = await tx.walletTransaction.findMany({
          where: { walletId: wallet.id, status: 'CONFIRMED' },
          select: { type: true, amount: true },
        });

        const ledgerBalance = txRows.reduce((acc, t) => {
          const v = Number(t.amount);
          return t.type === 'CREDIT' ? acc + v : acc - v;
        }, 0);

        // ── Step 4: Balance check (safe — wallet row is locked) ───────────────
        if (ledgerBalance < amount) {
          // Release idempotency claim — this is a legitimate failure, not a
          // duplicate. The caller should not retry with this key for a deduction.
          await tx.$executeRaw`
            DELETE FROM "AdminWalletIdempotencyKey"
            WHERE "key" = ${idempotencyKey}
              AND "walletId" = ${wallet.id}
              AND "operationType" = 'DEBIT'
          `;
          throw Object.assign(new Error('INSUFFICIENT_BALANCE'), {
            available: ledgerBalance,
            requested: amount,
          });
        }

        // ── Step 5: Create debit transaction ──────────────────────────────────
        const walletTx = await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount,
            type: 'DEBIT',
            status: 'CONFIRMED',
            description: reason.trim(),
          },
        });

        // ── Step 6: Update cached balance (cache only — not authoritative) ────
        await tx.clientWallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: amount } },
        });

        // ── Step 7: Store completed response in idempotency row ───────────────
        const newBalance = ledgerBalance - amount;
        const body = {
          success: true,
          transactionId: walletTx.id,
          previousBalance: ledgerBalance,
          newBalance,
          deducted: amount,
        };

        await tx.$executeRaw`
          UPDATE "AdminWalletIdempotencyKey"
          SET "transactionId" = ${walletTx.id},
              "response"      = ${JSON.stringify(body)}::jsonb
          WHERE "key" = ${idempotencyKey}
            AND "walletId" = ${wallet.id}
            AND "operationType" = 'DEBIT'
        `;

        return body;
      }, {
        // Use READ COMMITTED (default) — SELECT FOR UPDATE provides the
        // necessary serialisation for the balance check without the retry
        // overhead of SERIALIZABLE isolation.
        isolationLevel: 'ReadCommitted',
        timeout: 15000,
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
      if (err?.message === 'INSUFFICIENT_BALANCE') {
        return NextResponse.json(
          {
            error: 'Insufficient balance',
            available: err.available,
            requested: err.requested,
          },
          { status: 400 }
        );
      }
      throw err;
    }

    // ── Audit log (outside transaction — non-critical) ────────────────────────
    try {
      await prisma.auditLog.create({
        data: {
          action: 'WALLET_DEDUCTED',
          actorId: session!.user!.id,
          actorRole: session!.user!.role,
          targetType: 'WALLET',
          targetId: wallet.id,
          success: true,
          metadata: {
            transactionId: (responseBody as any).transactionId,
            userId,
            amount,
            reason: reason.trim(),
            idempotencyKey,
            balanceBefore: (responseBody as any).previousBalance,
            balanceAfter: (responseBody as any).newBalance,
          } as any,
        },
      });
    } catch (auditErr) {
      console.error('Audit log failed for wallet deduction:', auditErr);
    }

    // ── Receipt email (outside transaction — non-critical) ────────────────────
    try {
      await sendAdminDeductionReceipt({
        customerName: userName || userEmail,
        customerEmail: userEmail,
        transactionId: (responseBody as any).transactionId,
        deductedAt: new Date(),
        amountDeducted: amount,
        reason: reason.trim(),
        walletBalanceBefore: (responseBody as any).previousBalance,
        walletBalanceAfter: (responseBody as any).newBalance,
      });
    } catch (e) {
      console.error('Admin deduction receipt email failed:', e);
    }

    return NextResponse.json(responseBody);
  } catch (error) {
    console.error('Deduct credit error:', error);
    return NextResponse.json({ error: 'Failed to deduct credit' }, { status: 500 });
  }
}
