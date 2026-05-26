import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getWalletBalance, getOrCreateWallet } from '@/lib/services/wallet-helpers';
import { sendAdminCreditReceipt } from '@/lib/services/receipt-email';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { amount, reason } = await req.json();

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    // The ID could be either a client ID or user ID
    let userId: string | null = null;
    
    const client = await prisma.client.findUnique({
      where: { id: params.id },
      select: { userId: true }
    });
    
    if (client) {
      userId = client.userId;
    } else {
      // Maybe it's a user ID directly
      userId = params.id;
    }
    
    if (!userId) {
      return NextResponse.json({ error: 'Client has no associated user account' }, { status: 404 });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get or create wallet
    const wallet = await getOrCreateWallet(user.id);

    // Read balance BEFORE adding credit (for accurate receipt)
    const balanceBefore = await getWalletBalance(user.id);

    // Create wallet transaction — the ID becomes the traceable receipt reference
    const walletTx = await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'CREDIT',
        amount: amount,
        status: 'CONFIRMED',
        description: reason || `Manual credit added by admin`,
      }
    });

    // Get updated balance
    const newBalance = await getWalletBalance(user.id);

    // Audit log — every admin credit must be traceable
    try {
      await prisma.auditLog.create({
        data: {
          action: 'WALLET_CREDITED',
          actorId: session.user.id,
          actorRole: session.user.role,
          targetType: 'WALLET',
          targetId: wallet.id,
          success: true,
          metadata: {
            transactionId: walletTx.id,
            userId: user.id,
            amount,
            reason: reason || 'Manual credit added by admin',
            balanceBefore: balanceBefore.balance,
            balanceAfter: newBalance.balance,
          } as any,
        },
      });
    } catch (auditErr) {
      console.error('Audit log failed for wallet credit:', auditErr);
    }

    // Send receipt — uses walletTx.id as the unique, DB-backed receipt reference
    try {
      await sendAdminCreditReceipt({
        clientName: user.name || user.email,
        clientEmail: user.email,
        receiptId: walletTx.id,
        creditedAt: new Date(),
        amountAdded: amount,
        reason: reason || 'Manual credit added by admin',
        walletBalanceBefore: balanceBefore.balance,
        walletBalanceAfter: newBalance.balance,
      });
    } catch (e) {
      console.error('Admin credit receipt email failed:', e);
    }

    return NextResponse.json({
      success: true,
      message: `Added ${amount} to ${user?.email}'s wallet`,
      wallet: {
        id: wallet.id,
        balance: newBalance.balance
      }
    });
  } catch (error) {
    console.error('Add credit error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
