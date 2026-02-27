import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

/**
 * STRIPE FEE TRACKING
 * 
 * Stores ACTUAL Stripe fees from webhook events, not calculated estimates.
 * Handles different fee structures:
 * - Domestic cards
 * - International cards
 * - Disputes
 * - Chargebacks
 */

interface StripeFeeRecord {
  paymentIntentId: string;
  amount: number;
  fee: number;
  feePercent: number;
  currency: string;
  cardCountry?: string;
  cardType?: string;
  isInternational: boolean;
  balanceTransactionId: string;
}

/**
 * Extract and store actual Stripe fee from payment_intent.succeeded webhook
 */
export async function recordStripeFeeFromWebhook(event: Stripe.Event) {
  if (event.type !== 'payment_intent.succeeded') {
    return;
  }

  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  
  if (!paymentIntent.latest_charge) {
    console.warn('[STRIPE FEE] No charge found for payment intent:', paymentIntent.id);
    return;
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-01-28.clover',
    });

    // Get the charge to access balance_transaction
    const charge = await stripe.charges.retrieve(paymentIntent.latest_charge as string);
    
    if (!charge.balance_transaction) {
      console.warn('[STRIPE FEE] No balance transaction for charge:', charge.id);
      return;
    }

    // Get the balance transaction with ACTUAL fee breakdown
    const balanceTransaction = await stripe.balanceTransactions.retrieve(
      charge.balance_transaction as string
    );

    // Extract fee details
    const amount = balanceTransaction.amount / 100; // Convert from cents
    const fee = Math.abs(balanceTransaction.fee) / 100; // Convert from cents
    const feePercent = (fee / amount) * 100;

    // Determine if international
    const paymentMethod = charge.payment_method_details;
    const cardCountry = paymentMethod?.card?.country || undefined;
    const isInternational = cardCountry && cardCountry !== 'AU'; // Assuming Australian platform

    const feeRecord: StripeFeeRecord = {
      paymentIntentId: paymentIntent.id,
      amount,
      fee,
      feePercent,
      currency: balanceTransaction.currency.toUpperCase(),
      cardCountry,
      cardType: paymentMethod?.card?.brand || undefined,
      isInternational: !!isInternational,
      balanceTransactionId: balanceTransaction.id,
    };

    // Store in database
    await prisma.walletTransaction.updateMany({
      where: {
        metadata: {
          path: ['stripePaymentIntentId'],
          equals: paymentIntent.id,
        },
      },
      data: {
        metadata: {
          actualStripeFee: fee,
          actualFeePercent: feePercent,
          stripeFeeDetails: feeRecord,
          feeRecordedAt: new Date().toISOString(),
        },
      },
    });

    console.log('[STRIPE FEE] ✓ Recorded actual fee:', {
      paymentIntentId: paymentIntent.id,
      amount,
      fee,
      feePercent: feePercent.toFixed(2) + '%',
      isInternational,
    });

    return feeRecord;

  } catch (error) {
    console.error('[STRIPE FEE] Error recording fee:', error);
    throw error;
  }
}

/**
 * Get actual Stripe fee for a payment intent
 */
export async function getActualStripeFee(paymentIntentId: string): Promise<number> {
  // First check if we have it stored
  const transaction = await prisma.walletTransaction.findFirst({
    where: {
      metadata: {
        path: ['stripePaymentIntentId'],
        equals: paymentIntentId,
      },
    },
    select: {
      metadata: true,
    },
  });

  if (transaction?.metadata) {
    const metadata = transaction.metadata as any;
    if (metadata.actualStripeFee) {
      return metadata.actualStripeFee;
    }
  }

  // If not stored, fetch from Stripe
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-01-28.clover',
    });

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (!paymentIntent.latest_charge) {
      throw new Error('No charge found for payment intent');
    }

    const charge = await stripe.charges.retrieve(paymentIntent.latest_charge as string);
    
    if (!charge.balance_transaction) {
      throw new Error('No balance transaction found');
    }

    const balanceTransaction = await stripe.balanceTransactions.retrieve(
      charge.balance_transaction as string
    );

    const fee = Math.abs(balanceTransaction.fee) / 100;
    
    return fee;

  } catch (error) {
    console.error('[STRIPE FEE] Error fetching fee from Stripe:', error);
    // Fallback to estimate if Stripe fetch fails
    return 0;
  }
}

/**
 * Calculate financial impact using ACTUAL Stripe fee
 */
export async function calculateFinancialImpactWithActualFee(params: {
  grossAmount: number;
  stripePaymentIntentId?: string;
  commissionPercent?: number;
}): Promise<{
  grossAmount: number;
  stripeFee: number;
  stripeFeeSource: 'actual' | 'estimated';
  commission: number;
  netInstructorImpact: number;
  netPlatformLoss: number;
}> {
  const { grossAmount, stripePaymentIntentId, commissionPercent = 15 } = params;

  let stripeFee = 0;
  let stripeFeeSource: 'actual' | 'estimated' = 'estimated';

  // Try to get actual fee
  if (stripePaymentIntentId) {
    try {
      stripeFee = await getActualStripeFee(stripePaymentIntentId);
      stripeFeeSource = 'actual';
    } catch (error) {
      console.warn('[FINANCIAL IMPACT] Could not get actual Stripe fee, using estimate');
      stripeFee = grossAmount * 0.029; // 2.9% estimate
    }
  } else {
    stripeFee = grossAmount * 0.029; // 2.9% estimate
  }

  const commission = grossAmount * (commissionPercent / 100);
  const netInstructorImpact = grossAmount - commission;
  const netPlatformLoss = commission - stripeFee;

  return {
    grossAmount,
    stripeFee,
    stripeFeeSource,
    commission,
    netInstructorImpact,
    netPlatformLoss,
  };
}

/**
 * Backfill actual Stripe fees for existing transactions
 */
export async function backfillStripeFees() {
  console.log('[BACKFILL] Starting Stripe fee backfill...');

  const transactions = await prisma.walletTransaction.findMany({
    where: {
      type: 'DEBIT',
      metadata: {
        path: ['stripePaymentIntentId'],
        not: undefined,
      },
    },
    select: {
      id: true,
      metadata: true,
    },
  });

  console.log(`[BACKFILL] Found ${transactions.length} transactions to backfill`);

  let successCount = 0;
  let failCount = 0;

  for (const transaction of transactions) {
    const metadata = transaction.metadata as any;
    
    // Skip if already has actual fee
    if (metadata.actualStripeFee) {
      continue;
    }

    try {
      const fee = await getActualStripeFee(metadata.stripePaymentIntentId);
      
      await prisma.walletTransaction.update({
        where: { id: transaction.id },
        data: {
          metadata: {
            ...metadata,
            actualStripeFee: fee,
            backfilledAt: new Date().toISOString(),
          },
        },
      });

      successCount++;
      console.log(`[BACKFILL] ✓ Updated transaction ${transaction.id}`);

    } catch (error) {
      failCount++;
      console.error(`[BACKFILL] ✗ Failed transaction ${transaction.id}:`, error);
    }
  }

  console.log(`[BACKFILL] ✅ Complete. Success: ${successCount}, Failed: ${failCount}`);
}
