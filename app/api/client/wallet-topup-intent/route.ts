import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { stripeService } from '@/lib/services/stripe';
import { prisma } from '@/lib/prisma';
import { getOrCreateWallet } from '@/lib/services/wallet-helpers';
import { walletRateLimit, checkRateLimit, getRateLimitIdentifier } from '@/lib/ratelimit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// P0 FIX #7: Add minimum $10 validation + maximum $10,000
const schema = z.object({
  amount: z.number()
    .positive('Amount must be positive')
    .min(10, 'Minimum top-up is $10')
    .max(10000, 'Maximum amount is $10,000 per transaction')
    .multipleOf(0.01, 'Amount must have at most 2 decimal places'),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'CLIENT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // P0 FIX #6: Rate limiting - max 5 top-up intents per minute per user
    // Prevents abuse: rapid creation of payment intents could spam Stripe API
    const rateLimitId = getRateLimitIdentifier(
      session.user.id,
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

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Create a PENDING wallet transaction BEFORE the Stripe intent.
    // The webhook will confirm it when payment_intent.succeeded fires.
    // Without this, the webhook has no transaction to confirm and the
    // wallet balance never increases after a successful top-up.
    const wallet = await getOrCreateWallet(user.id);
    const pendingTx = await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'CREDIT',
        amount,
        description: `Wallet top-up — $${amount.toFixed(2)}`,
        status: 'PENDING',
      }
    });

    // Pass transactionId + walletId in metadata so the webhook can find it.
    // If Stripe fails, delete the orphaned PENDING transaction so it doesn't
    // pollute the wallet history or confuse the webhook on retry.
    let paymentIntent;
    try {
      paymentIntent = await stripeService.createPaymentIntent({
        amount,
        instructorId: '',
        transactionId: pendingTx.id,
        walletId: wallet.id,
        clientEmail: session.user.email,
        description: `Wallet top-up $${amount.toFixed(2)}`,
      });
    } catch (stripeError) {
      await prisma.walletTransaction.delete({ where: { id: pendingTx.id } }).catch(() => {});
      throw stripeError;
    }

    return NextResponse.json({ clientSecret: paymentIntent.clientSecret });
  } catch (error: any) {
    console.error('Wallet top-up intent error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create payment intent' }, { status: 500 });
  }
}
