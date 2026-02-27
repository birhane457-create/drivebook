import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { walletRateLimit, checkRateLimit, getRateLimitIdentifier } from '@/lib/ratelimit';
import { logAuditAction } from '@/lib/services/audit';
import { recordWalletAdd } from '@/lib/services/ledger-operations';
import { getAccountBalance, buildAccountName, AccountType } from '@/lib/services/ledger';
import { z } from 'zod';

// FIXED: Input validation
const walletAddSchema = z.object({
  amount: z.number()
    .positive('Amount must be positive')
    .max(10000, 'Maximum amount is $10,000 per transaction')
    .multipleOf(0.01, 'Amount must have at most 2 decimal places'),
  paymentIntentId: z.string().optional()
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // FIXED: Rate limiting
    const rateLimitId = getRateLimitIdentifier(
      session.user.id,
      req.headers.get('x-forwarded-for'),
      'wallet-add'
    );
    
    const rateLimitResult = await checkRateLimit(walletRateLimit, rateLimitId);
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { 
          status: 429,
          headers: rateLimitResult.headers 
        }
      );
    }

    // FIXED: Validate input
    const body = await req.json();
    const { amount, paymentIntentId } = walletAddSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { wallet: true }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Create wallet if it doesn't exist
    let wallet = user.wallet;
    if (!wallet) {
      wallet = await prisma.clientWallet.create({
        data: {
          userId: user.id,
          balance: 0
        }
      });
    }

    // FIXED: Use transaction wrapper for atomicity + LEDGER (DUAL-WRITE)
    const result = await prisma.$transaction(async (tx) => {
      // NEW: Record in double-entry ledger
      await recordWalletAdd(tx, {
        userId: user.id,
        amount,
        paymentIntentId: paymentIntentId || `manual-${Date.now()}`,
        createdBy: session.user.id
      });
      
      // OLD SYSTEM: Keep for now (dual-write during migration)
      // Update wallet balance
      const updatedWallet = await tx.clientWallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: amount }
        }
      });

      // Create transaction record
      const walletTx = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'CREDIT',
          amount: amount,
          description: `Added ${amount.toFixed(2)} credits`,
          metadata: {
            paymentIntentId: paymentIntentId || null,
            source: 'manual_add'
          }
        }
      });

      // Log the action
      await logAuditAction(tx, {
        action: 'ADD_WALLET_CREDIT',
        adminId: session.user.id,
        targetType: 'WALLET',
        targetId: wallet.id,
        metadata: {
          amount,
          paymentIntentId,
          previousBalance: wallet.balance,
          newBalance: updatedWallet.balance,
          userEmail: session.user.email,
        },
        req,
      });
      
      // NEW: Verify ledger balance matches old system
      const ledgerBalance = await getAccountBalance(
        buildAccountName(AccountType.CLIENT_WALLET, user.id)
      );
      
      if (Math.abs(ledgerBalance - updatedWallet.balance) > 0.01) {
        console.error(
          `[LEDGER MISMATCH] User ${user.id}: Ledger=${ledgerBalance}, Old=${updatedWallet.balance}`
        );
      }

      return { updatedWallet, walletTx, ledgerBalance };
    });

    return NextResponse.json({
      success: true,
      wallet: {
        balance: result.updatedWallet.balance,
        totalPaid: result.ledgerBalance, // Use ledger balance
        creditsRemaining: result.updatedWallet.balance
      },
      transaction: {
        id: result.walletTx.id,
        amount: result.walletTx.amount,
        createdAt: result.walletTx.createdAt
      },
      ledger: {
        balance: result.ledgerBalance,
        verified: Math.abs(result.ledgerBalance - result.updatedWallet.balance) < 0.01
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Add wallet credits error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
