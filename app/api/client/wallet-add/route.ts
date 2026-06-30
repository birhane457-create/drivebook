import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { walletRateLimit, checkRateLimit, getRateLimitIdentifier } from '@/lib/ratelimit';
import { recordWalletCredit } from '@/lib/services/ledger-operations';
import { getAccountBalance, buildAccount, AccountType } from '@/lib/services/ledger';
import { getWalletBalance, getOrCreateWallet } from '@/lib/services/wallet-helpers';
import { sendWalletTopUpReceipt } from '@/lib/services/receipt-email';
import { z } from 'zod';


export const dynamic = 'force-dynamic';
// FIXED: Input validation
const walletAddSchema = z.object({
  amount: z.number()
    .positive('Amount must be positive')
    .min(10, 'Minimum top-up is $10')
    .max(10000, 'Maximum amount is $10,000 per transaction')
    .multipleOf(0.01, 'Amount must have at most 2 decimal places'),
  paymentIntentId: z.string()
    .min(3, 'Invalid payment intent')
    .startsWith('pi_', 'Invalid payment intent format')
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

    // P0 FIX #3: Verify paymentIntentId actually succeeded via Stripe API
    // Don't accept any paymentIntentId without Stripe confirmation
    // This prevents fraud where attacker could call wallet-add with a fake/pending intent ID
    try {
      const stripeService = require('@/lib/services/stripe').stripeService;
      const paymentIntent = await stripeService.retrievePaymentIntent(paymentIntentId);
      
      if (!paymentIntent) {
        return NextResponse.json(
          { error: 'Payment intent not found' },
          { status: 400 }
        );
      }

      if (paymentIntent.status !== 'succeeded') {
        return NextResponse.json(
          { error: `Payment not confirmed (status: ${paymentIntent.status})` },
          { status: 400 }
        );
      }

      // Verify amount matches what Stripe has
      const expectedCents = Math.round(amount * 100);
      if (paymentIntent.amount_received !== expectedCents) {
        return NextResponse.json(
          { error: 'Payment amount mismatch' },
          { status: 400 }
        );
      }
    } catch (stripeErr) {
      console.error('Stripe verification failed:', stripeErr);
      return NextResponse.json(
        { error: 'Payment verification failed' },
        { status: 400 }
      );
    }
    
    // HIGH-2 FIX: Improved idempotency check using metadata instead of description
    // Store paymentIntentId in metadata for reliable duplicate detection
    const existingTransaction = await prisma.walletTransaction.findFirst({
      where: {
        walletId: wallet.id,
        status: 'CONFIRMED',
        type: 'CREDIT',
        metadata: {
          path: ['stripePaymentIntentId'],
          equals: paymentIntentId
        }
      }
    });

    if (existingTransaction) {
      // Already credited this payment intent
      console.warn(`Duplicate wallet-add call for paymentIntentId=${paymentIntentId}`);
      const newBalance = await getWalletBalance(user.id);
      return NextResponse.json({
        success: true,
        duplicate: true,
        wallet: {
          balance: newBalance.balance,
          totalPaid: newBalance.totalPaid,
          creditsRemaining: newBalance.balance
        },
        transaction: {
          id: existingTransaction.id,
          amount: existingTransaction.amount,
          createdAt: existingTransaction.createdAt
        }
      });
    }
    
    // Get current balance before transaction
    const previousBalance = await getWalletBalance(user.id);

    // P0-4 FIX: recordWalletCredit uses the global prisma client (not tx) — calling it
    // inside $transaction creates a split-brain: if walletTransaction.create rolls back,
    // the ledger entry is already committed via a different DB connection. Move the
    // ledger write outside the transaction and derive a stable idempotency key from
    // paymentIntentId (not Date.now()) so it is truly idempotent on retry.
    // Also store the walletTx id upfront for the ledger call below.
    const result = await prisma.$transaction(async (tx) => {
      // ✅ P0 FIX #2: Create transaction record (no stored balance update)
      const walletTx = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'CREDIT',
          amount: amount,
          status: 'CONFIRMED',
          description: `Added ${amount.toFixed(2)} credits via ${paymentIntentId ? 'Stripe' : 'manual'}`,
          metadata: {
            stripePaymentIntentId: paymentIntentId,
            type: 'wallet_topup',
            verifiedAmount: true
          }
        }
      });

      // Note: Audit logging removed - AuditLog model not in schema
      
      return { walletTx };
    });

    // P0-4 FIX: Ledger write happens AFTER the transaction commits, using the committed
    // walletTx.id as the idempotency key so it is safe to retry.
    await recordWalletCredit({
      walletTransactionId: result.walletTx.id,
      userId: user.id,
      amount,
      stripePaymentIntentId: paymentIntentId,
      createdBy: session.user.id
    });
    
    // Get updated balance after transaction
    const newBalance = await getWalletBalance(user.id);

    // Send wallet top-up receipt — uses WalletTransaction.id as the traceable receipt reference
    try {
      await sendWalletTopUpReceipt({
        clientName: user.name || user.email,
        clientEmail: user.email,
        receiptId: result.walletTx.id,
        paidAt: new Date(),
        amountAdded: amount,
        walletBalanceBefore: previousBalance.balance,
        walletBalanceAfter: newBalance.balance,
        stripeRef: paymentIntentId,
        paymentMethod: paymentIntentId ? 'Card' : undefined,
      });
    } catch (receiptErr) {
      console.error('Wallet top-up receipt email failed:', receiptErr);
    }

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
