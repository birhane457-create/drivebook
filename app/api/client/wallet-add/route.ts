import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { walletRateLimit, checkRateLimit, getRateLimitIdentifier } from '@/lib/ratelimit';
import { recordWalletCredit } from '@/lib/services/ledger-operations';
import { getAccountBalance, buildAccount, AccountType } from '@/lib/services/ledger';
import { getWalletBalance, getOrCreateWallet } from '@/lib/services/wallet-helpers';
import { sendWalletTopUpReceipt } from '@/lib/services/receipt-bridge';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { stripeService } from '@/lib/services/stripe';


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
      session!.user!.id,
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
      where: { email: session!.user!.email },
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

      // ═══════════════════════════════════════════════════════════════════════════
      // P0-01 FIX: Wallet Ownership Enforcement
      // ═══════════════════════════════════════════════════════════════════════════
      //
      // VULNERABILITY (baseline):
      //   Any authenticated user could call this endpoint with ANY succeeded PaymentIntent
      //   and credit their wallet, even if the payment was made by a different user.
      //
      // ATTACK SCENARIO:
      //   1. Attacker creates PaymentIntent for $100, completes payment
      //   2. Victim also creates PaymentIntent for $100, completes payment
      //   3. Attacker calls /api/client/wallet-add with VICTIM's paymentIntentId
      //   4. Attacker receives $100 wallet credit (one payment → two credits)
      //
      // INVARIANT ENFORCED:
      //   A PaymentIntent can ONLY credit the wallet belonging to the user who created it.
      //   We verify ownership via PaymentIntent.metadata.userId (set during creation).
      //
      // DEFENSE IN DEPTH:
      //   - Primary: metadata.userId must match session.user.id (REQUIRED)
      //   - Secondary: metadata.walletId must match user's wallet (belt-and-braces)
      //   - Fail-closed: Reject if metadata is missing/malformed (no fail-open path)
      //
      // ═══════════════════════════════════════════════════════════════════════════

      const metaUserId  = paymentIntent.metadata?.userId;
      const metaWalletId = paymentIntent.metadata?.walletId;

      // PRIMARY OWNERSHIP CHECK: userId must match
      if (!metaUserId) {
        // PaymentIntent has no userId metadata → fail closed
        console.error(
          `[P0-01] PaymentIntent ${paymentIntentId} missing userId metadata — REJECTING`
        );
        return NextResponse.json(
          { error: 'Payment intent is not linked to your account' },
          { status: 403 }
        );
      }

      if (metaUserId !== user.id) {
        // userId mismatch → attacker attempting cross-user credit
        console.error(
          `[P0-01] Ownership violation: intent=${paymentIntentId} ` +
          `meta.userId=${metaUserId} caller=${user.id} — REJECTING`
        );
        return NextResponse.json(
          { error: 'Payment intent belongs to a different account' },
          { status: 403 }
        );
      }

      // SECONDARY OWNERSHIP CHECK: walletId must match (if present)
      if (metaWalletId && metaWalletId !== wallet.id) {
        // WalletId mismatch (shouldn't happen if userId matched, but belt-and-braces)
        console.error(
          `[P0-01] Wallet mismatch: intent=${paymentIntentId} ` +
          `meta.walletId=${metaWalletId} callerWallet=${wallet.id} — REJECTING`
        );
        return NextResponse.json(
          { error: 'Payment intent linked to different wallet' },
          { status: 403 }
        );
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // Ownership verified: PaymentIntent.metadata.userId matches authenticated user
      // Safe to proceed with wallet credit
      // ═══════════════════════════════════════════════════════════════════════════
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
      createdBy: session!.user!.id
    });
    
    // Get updated balance after transaction
    const newBalance = await getWalletBalance(user.id);

    // Send wallet top-up receipt — uses WalletTransaction.id as the traceable receipt reference
    try {
      await sendWalletTopUpReceipt({
        customerName: user.name || user.email,
        customerEmail: user.email,
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
    // P0-01B: Unique constraint violation — concurrent request already credited this PaymentIntent.
    // The database unique index on metadata->>'stripePaymentIntentId' rejected the second insert.
    // Return 409 so the caller knows the payment was already processed, not a server fault.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      console.warn(`[P0-01B] Concurrent duplicate wallet credit blocked by DB constraint: ${error.meta?.target}`);
      return NextResponse.json(
        { error: 'Payment already processed', code: 'PAYMENT_ALREADY_CREDITED' },
        { status: 409 }
      );
    }

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
