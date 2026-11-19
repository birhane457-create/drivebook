import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { walletRateLimit, checkRateLimit, getRateLimitIdentifier } from '@/lib/ratelimit';
import { recordWalletCredit } from '@/lib/services/ledger-operations';
import { getAccountBalance, buildAccount, AccountType } from '@/lib/services/ledger';
import { getWalletBalance, getOrCreateWallet } from '@/lib/services/wallet-helpers';
import { sendWalletTopUpReceipt } from '@/lib/services/receipt-bridge';
import { parseTopupMetadata } from '@/lib/services/wallet-topup-fee';
import { getPlatformPricing } from '@/lib/services/platform-pricing';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { stripeService } from '@/lib/services/stripe';


export const dynamic = 'force-dynamic';

// Input validation — amount here is the chargeAmount (topupAmount + platformFee).
// Min/max are validated against PlatformSettings after Stripe verification, not here,
// because wallet-add receives the charge total, not the requested top-up amount.
// We keep a wide upper bound to avoid rejecting valid charges.
const walletAddSchema = z.object({
  amount: z.number()
    .positive('Amount must be positive')
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
    let paymentIntent: any;
    try {
      paymentIntent = await stripeService.retrievePaymentIntent(paymentIntentId);
      
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

      // Amount validation: compare against chargeAmount (topupAmount + platformFee),
      // not the topupAmount alone. For legacy top-ups with no fee metadata, fall back
      // to the submitted amount.
      const metaChargeAmount = paymentIntent.metadata?.chargeAmount
        ? parseFloat(paymentIntent.metadata.chargeAmount)
        : null;
      const expectedChargeAmount = (metaChargeAmount !== null && Number.isFinite(metaChargeAmount))
        ? metaChargeAmount
        : amount;
      const expectedCents = Math.round(expectedChargeAmount * 100);
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
    
    // Idempotency: check if the original PENDING transaction has already been confirmed.
    // The unique index on metadata->>'stripePaymentIntentId' prevents duplicate CONFIRMED
    // CREDIT rows, but the PENDING row (created by wallet-topup-intent) doesn't have this
    // field set yet — the update path below is the atomic guard.
    const pendingTxId = paymentIntent.metadata?.transactionId ?? null;

    const existingConfirmed = await prisma.walletTransaction.findFirst({
      where: {
        walletId: wallet.id,
        status: 'CONFIRMED',
        type: 'CREDIT',
        metadata: { path: ['stripePaymentIntentId'], equals: paymentIntentId }
      }
    });

    if (existingConfirmed) {
      console.warn(`Duplicate wallet-add call for paymentIntentId=${paymentIntentId} — already confirmed`);
      const newBalance = await getWalletBalance(user.id);
      return NextResponse.json({
        success: true,
        duplicate: true,
        wallet: { balance: newBalance.balance, totalPaid: newBalance.totalPaid, creditsRemaining: newBalance.balance },
        transaction: { id: existingConfirmed.id, amount: existingConfirmed.amount, createdAt: existingConfirmed.createdAt }
      });
    }

    // Parse fee split from PI metadata using shared helper
    const piAmountReceived = paymentIntent.amount_received / 100;
    const topupMeta = parseTopupMetadata(paymentIntent.metadata, piAmountReceived);
    const { topupAmount: creditAmount, platformFee: platformFeeAmount, chargeAmount: actualCharge, feePercent: metaFeePercent } = topupMeta;

    const previousBalance = await getWalletBalance(user.id);

    const result = await prisma.$transaction(async (tx) => {
      const { getWalletCreditValidityMonths } = await import('@/lib/services/platform-pricing');
      const months = await getWalletCreditValidityMonths();
      const paymentDate = new Date(paymentIntent.created * 1000);
      paymentDate.setMonth(paymentDate.getMonth() + months);
      const expiresAt = paymentDate;

      let walletTx: any;

      if (pendingTxId) {
        // PRIMARY PATH: confirm the specific PENDING row created by wallet-topup-intent.
        // updateMany with status:'PENDING' as a WHERE condition is atomic —
        // if the webhook races and confirms it first, count=0 and we read the
        // already-confirmed row without writing a duplicate.
        const updated = await tx.walletTransaction.updateMany({
          where: { id: pendingTxId, walletId: wallet.id, status: 'PENDING' },
          data: {
            status: 'CONFIRMED',
            expiresAt,
            metadata: {
              topupAmount: creditAmount,
              chargeAmount: actualCharge,
              platformFee: platformFeeAmount,
              feePercent: metaFeePercent,
              stripePaymentIntentId: paymentIntentId,
              type: 'wallet_topup',
              verifiedAmount: true,
            },
          }
        });

        walletTx = await tx.walletTransaction.findUnique({ where: { id: pendingTxId } });
        if (!walletTx) throw new Error('Wallet transaction not found');
        if (updated.count === 0) {
          // Webhook already confirmed it — not an error, just return it as-is
          console.info(`wallet-add: PENDING tx ${pendingTxId} already confirmed by webhook`);
        }
      } else {
        // LEGACY FALLBACK: PI has no transactionId metadata (created before this fix).
        walletTx = await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'CREDIT',
            amount: creditAmount,
            status: 'CONFIRMED',
            description: `Wallet top-up $${creditAmount.toFixed(2)} (legacy)`,
            expiresAt,
            metadata: {
              stripePaymentIntentId: paymentIntentId,
              type: 'wallet_topup',
              verifiedAmount: true,
              topupAmount: creditAmount,
              chargeAmount: actualCharge,
              platformFee: platformFeeAmount,
              feePercent: metaFeePercent,
            }
          }
        });
      }

      // Record PLATFORM_FEE if not already written (guard by PI id + type lookup)
      let feeTx = null;
      if (topupMeta.hasFeeSplit && platformFeeAmount > 0) {
        const existingFee = await tx.walletTransaction.findFirst({
          where: {
            walletId: wallet.id,
            type: 'PLATFORM_FEE',
            metadata: { path: ['stripePaymentIntentId'], equals: paymentIntentId },
          },
          select: { id: true },
        });
        if (!existingFee) {
          feeTx = await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              type: 'PLATFORM_FEE',
              amount: platformFeeAmount,
              status: 'CONFIRMED',
              description: `DriveBook platform fee — ${metaFeePercent}% on $${creditAmount.toFixed(2)} top-up`,
              metadata: {
                stripePaymentIntentId: paymentIntentId,
                type: 'wallet_topup_fee',
                topupWalletTxId: walletTx.id,
                creditAmount,
                chargeAmount: actualCharge,
                feePercent: metaFeePercent,
                nonRefundable: true,
              },
            }
          });
        }
      }

      return { walletTx, feeTx };
    });

    // Ledger entry records creditAmount (what the student receives in their wallet),
    // not the charge total. The platform fee is a separate revenue line.
    // recordWalletCredit is idempotent via paymentIntentId-based idempotency key.
    await recordWalletCredit({
      walletTransactionId: result.walletTx.id,
      userId: user.id,
      amount: creditAmount,                     // FIX: was `amount` (chargeAmount) — now creditAmount
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
        amountAdded: creditAmount,              // what goes into the wallet
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
