import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getWalletBalance, getOrCreateWallet } from '@/lib/services/wallet-helpers';
import { sendAdminDeductionReceipt } from '@/lib/services/receipt-email';
import { checkPermission } from '@/lib/rbac/checkPermission';
import { PERM } from '@/lib/rbac/permissions';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const check = await checkPermission(session, PERM.USERS_CLIENTS_WALLET_DEDUCT);
    if (!check.allowed) return check.response;

    const { amount, reason } = await req.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    if (!reason || reason.trim().length < 3) {
      return NextResponse.json({ error: 'Reason is required for deductions' }, { status: 400 });
    }

    // Enforce per-staff deduction limit (maxRefundAmount)
    if (!check.isSuperAdmin && check.staffMember) {
      const limit = check.staffMember.maxRefundAmount;
      if (amount > limit) {
        return NextResponse.json(
          { error: `Amount exceeds your deduction limit of $${limit}` },
          { status: 403 }
        );
      }
    }

    // Resolve user — params.id can be a clientId or userId
    let userId: string | null = null;
    let userEmail: string | null = null;
    let userName: string | null = null;

    const client = await prisma.client.findUnique({
      where: { id: params.id },
      select: { userId: true, user: { select: { id: true, email: true, name: true } } },
    });

    if (client?.userId && client.user) {
      userId = client.userId;
      userEmail = client.user.email;
      userName = client.user.name;
    } else {
      // Try as userId directly
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

    // Get wallet and read balance BEFORE deduction
    const wallet = await getOrCreateWallet(userId);
    const balanceBefore = await getWalletBalance(userId);

    if (balanceBefore.balance < amount) {
      return NextResponse.json(
        {
          error: 'Insufficient balance',
          available: balanceBefore.balance,
          requested: amount,
        },
        { status: 400 }
      );
    }

    // Create debit transaction — the ID is the unique, DB-backed receipt reference
    const walletTx = await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount,
        type: 'DEBIT',
        status: 'CONFIRMED',
        description: reason.trim(),
      },
    });

    // Get updated balance
    const newBalance = await getWalletBalance(userId);

    // Audit log — every admin deduction must be traceable
    try {
      await prisma.auditLog.create({
        data: {
          action: 'WALLET_DEDUCTED',
          actorId: session!.user.id,
          actorRole: session!.user.role,
          targetType: 'WALLET',
          targetId: wallet.id,
          success: true,
          metadata: {
            transactionId: walletTx.id,
            userId,
            amount,
            reason: reason.trim(),
            balanceBefore: balanceBefore.balance,
            balanceAfter: newBalance.balance,
          } as any,
        },
      });
    } catch (auditErr) {
      console.error('Audit log failed for wallet deduction:', auditErr);
      // Non-critical — don't fail the request
    }

    // Send receipt to student — uses walletTx.id as the unique receipt reference
    try {
      await sendAdminDeductionReceipt({
        clientName: userName || userEmail,
        clientEmail: userEmail,
        transactionId: walletTx.id,
        deductedAt: new Date(),
        amountDeducted: amount,
        reason: reason.trim(),
        walletBalanceBefore: balanceBefore.balance,
        walletBalanceAfter: newBalance.balance,
      });
    } catch (e) {
      console.error('Admin deduction receipt email failed:', e);
    }

    return NextResponse.json({
      success: true,
      transactionId: walletTx.id,
      previousBalance: balanceBefore.balance,
      newBalance: newBalance.balance,
      deducted: amount,
    });
  } catch (error) {
    console.error('Deduct credit error:', error);
    return NextResponse.json({ error: 'Failed to deduct credit' }, { status: 500 });
  }
}
