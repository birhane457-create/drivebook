import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { walletRateLimit, checkRateLimit, getRateLimitIdentifier } from '@/lib/ratelimit';
import { logAuditAction } from '@/lib/services/audit';
import { recordWalletCredit } from '@/lib/services/ledger-operations';
import { getAccountBalance, buildAccount, AccountType } from '@/lib/services/ledger';
import { getWalletBalance, getOrCreateWallet } from '@/lib/services/wallet-helpers';
import { z } from 'zod';


export const dynamic = 'force-dynamic';
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
    const wallet = await getOrCreateWallet(user.id);
    
    // Get current balance before transaction
    const previousBalance = await getWalletBalance(user.id);

    // FIXED: Use transaction wrapper for atomicity + LEDGER (DUAL-WRITE)
    const result = await prisma.$transaction(async (tx) => {
      // NEW: Record in double-entry ledger
      await recordWalletCredit({
        walletTransactionId: `manual-${Date.now()}`,
        userId: user.id,
        amount,
        stripePaymentIntentId: paymentIntentId,
        createdBy: session.user.id
      });
      
      // ✅ P0 FIX #2: Create transaction record (no stored balance update)
      const walletTx = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'CREDIT',
          amount: amount,
          status: 'CONFIRMED',
          description: `Added ${amount.toFixed(2)} credits via ${paymentIntentId ? 'Stripe' : 'manual'}`
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
          previousBalance: previousBalance.balance,
          userEmail: session.user.email,
        },
        req,
      });
      
      return { walletTx };
    });
    
    // Get updated balance after transaction
    const newBalance = await getWalletBalance(user.id);
    
    // Verify ledger balance matches
    const ledgerBalance = await getAccountBalance(
      buildAccount(AccountType.CLIENT_WALLET, user.id)
    );
    
    if (Math.abs(ledgerBalance - newBalance.balance) > 0.01) {
      console.error(
        `[LEDGER MISMATCH] User ${user.id}: Ledger=${ledgerBalance}, Calculated=${newBalance.balance}`
      );
    }

    return NextResponse.json({
      success: true,
      wallet: {
        balance: newBalance.balance,
        totalPaid: newBalance.totalPaid,
        creditsRemaining: newBalance.balance
      },
      transaction: {
        id: result.walletTx.id,
        amount: result.walletTx.amount,
        createdAt: result.walletTx.createdAt
      },
      ledger: {
        balance: ledgerBalance,
        verified: Math.abs(ledgerBalance - newBalance.balance) < 0.01
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
