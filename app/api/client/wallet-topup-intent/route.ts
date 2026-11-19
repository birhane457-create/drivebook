import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { stripeService } from '@/lib/services/stripe';
import { prisma } from '@/lib/prisma';
import { getOrCreateWallet } from '@/lib/services/wallet-helpers';
import { walletRateLimit, checkRateLimit, getRateLimitIdentifier } from '@/lib/ratelimit';
import { getPlatformPricing } from '@/lib/services/platform-pricing';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// MM-03 FIX: Validate amount against platform-configured walletTopUpMin/Max.
// Previous code used hardcoded min($10)/max($10,000), ignoring admin-configured
// bounds. An admin setting walletTopUpMax=$200 had no effect on this route.
//
// This schema validates only type/format. Business bounds are checked at runtime
// after loading platform settings so admin changes take effect immediately.
const schema = z.object({
  amount: z.number()
    .positive('Amount must be positive')
    .multipleOf(0.01, 'Amount must have at most 2 decimal places'),
});

export async function GET(req: NextRequest) {
  // Returns the current platform fee rate so the frontend can show the
  // breakdown before the student submits payment.
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const pricing = await getPlatformPricing();
    return NextResponse.json({ feePercent: pricing.platformFeePercentage });
  } catch (error: any) {
    console.error('Wallet fee-rate error:', error);
    return NextResponse.json({ error: 'Failed to retrieve fee rate' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session!.user!.role !== 'CLIENT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // P0 FIX #6: Rate limiting - max 5 top-up intents per minute per user
    // Prevents abuse: rapid creation of payment intents could spam Stripe API
    const rateLimitId = getRateLimitIdentifier(
      session!.user!.id,
      req.headers.get('x-forwarded-for'),
      'wallet-topup-intent'
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

    const { amount } = schema.parse(await req.json());

    // MM-03 FIX: Enforce platform-configured top-up bounds
    const pricing = await getPlatformPricing();
    if (amount < pricing.walletTopUpMin) {
      return NextResponse.json(
        { error: `Minimum top-up is $${pricing.walletTopUpMin}` },
        { status: 400 }
      );
    }
    if (amount > pricing.walletTopUpMax) {
      return NextResponse.json(
        { error: `Maximum top-up is $${pricing.walletTopUpMax} per transaction` },
        { status: 400 }
      );
    }

    // PLATFORM FEE: charged on every wallet funding event (policy 2026-11-05).
    // The student pays `amount + platformFee`; the wallet is credited with `amount` only.
    // The fee is non-refundable and recorded separately in financial reporting.
    const platformFee = parseFloat((amount * pricing.platformFeePercentage / 100).toFixed(2));
    const chargeAmount = parseFloat((amount + platformFee).toFixed(2));

    const user = await prisma.user.findUnique({ where: { email: session!.user!.email } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Create a PENDING wallet transaction for the top-up amount only (not chargeAmount).
    // The webhook will confirm it when payment_intent.succeeded fires.
    // The platform fee is recorded as a separate PLATFORM_FEE transaction in the webhook.
    const wallet = await getOrCreateWallet(user.id);
    const pendingTx = await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'CREDIT',
        amount,                                   // wallet credit = requested amount only
        description: `Wallet top-up — $${amount.toFixed(2)}`,
        status: 'PENDING',
        metadata: {
          topupAmount: amount,                    // amount to credit to wallet
          platformFee,                            // fee kept by DriveBook
          chargeAmount,                           // total charged to card
          feePercent: pricing.platformFeePercentage,
        },
      }
    });

    // Charge the student amount + fee.
    // Metadata carries topupAmount and platformFee so the webhook can:
    //   1. confirm the CREDIT for topupAmount
    //   2. write a separate PLATFORM_FEE record for platformFee
    let paymentIntent;
    try {
      paymentIntent = await stripeService.createPaymentIntent({
        amount: chargeAmount,                     // total charged to card
        transactionId: pendingTx.id,
        walletId: wallet.id,
        userId: user.id,
        customerEmail: session!.user!.email,
        description: `Wallet top-up $${amount.toFixed(2)} + $${platformFee.toFixed(2)} DriveBook fee`,
      });
    } catch (stripeError) {
      await prisma.walletTransaction.delete({ where: { id: pendingTx.id } }).catch(() => {});
      throw stripeError;
    }

    return NextResponse.json({
      clientSecret: paymentIntent.clientSecret,
      // Return breakdown so the frontend can display it
      topupAmount: amount,
      platformFee,
      chargeAmount,
      feePercent: pricing.platformFeePercentage,
    });
  } catch (error: any) {
    console.error('Wallet top-up intent error:', error);
    // Return 400 for validation errors (Zod), 500 for unexpected errors
    const isValidationError = error?.name === 'ZodError' || error?.issues;
    return NextResponse.json(
      { error: isValidationError ? (error.issues?.[0]?.message ?? error.message) : (error.message || 'Failed to create payment intent') },
      { status: isValidationError ? 400 : 500 }
    );
  }
}
