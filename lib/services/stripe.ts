import Stripe from 'stripe';
import { Decimal } from '@prisma/client/runtime/library';
import {
  toDecimal,
  toNumber,
  calculatePercentage,
  subtractAmounts,
  roundAmount,
  toFixed,
} from '@/lib/utils/decimal-helpers';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
});

export { stripe };

interface CreatePaymentIntentParams {
  amount: number | Decimal; // in dollars - accepts Decimal for precision
  providerId?: string; // Optional for wallet purchases
  bookingId?: string; // For booking payments
  transactionId?: string; // For wallet purchases
  walletId?: string; // For wallet purchases
  customerEmail: string;
  description: string;
  commissionRate?: number; // Per-tier rate from DB — falls back to env if not provided
}

interface CreateConnectAccountParams {
  providerId: string;
  email: string;
  name: string;
  phone: string;
}

export class StripeService {
  // commissionRate instance property removed — rate is always passed per-call
  // from getCommissionRate() (DB-backed PlatformSettings). No env var fallback needed.

  /**
   * Create a payment intent for a booking or wallet purchase.
   * commissionRate must be passed from getCommissionRate() — never rely on a default.
   */
  async createPaymentIntent(params: CreatePaymentIntentParams) {
    const { amount, providerId, bookingId, transactionId, walletId, customerEmail, description, commissionRate } = params;

    // Rate must come from DB via getCommissionRate(). If somehow omitted, fetch it now.
    let rate = commissionRate;
    if (rate === undefined && providerId) {
      const { getCommissionRate } = await import('@/lib/services/platform-pricing');
      const instructor = await import('@/lib/prisma').then(m =>
        m.prisma.provider.findUnique({ where: { id: providerId }, select: { subscriptionTier: true } })
      );
      rate = await getCommissionRate(instructor?.subscriptionTier ?? 'BASIC');
    }
    rate = rate ?? 0;

    // Calculate platform fee using Decimal for exact precision
    const amountDecimal = toDecimal(amount);
    const rateDecimal = toDecimal(rate);
    
    const platformFeeDecimal = providerId 
      ? roundAmount(calculatePercentage(amountDecimal, rateDecimal), 2)
      : toDecimal(0);
    
    const providerPayoutDecimal = providerId 
      ? roundAmount(subtractAmounts(amountDecimal, platformFeeDecimal), 2)
      : toDecimal(0);

    // Convert to numbers for Stripe (cents conversion)
    const amountNum = toNumber(amountDecimal);
    const platformFeeNum = toNumber(platformFeeDecimal);
    const providerPayoutNum = toNumber(providerPayoutDecimal);

    // Convert to cents for Stripe (no floating point errors with Decimal)
    const amountInCents = Math.round(amountNum * 100);

    // Build metadata based on payment type
    const metadata: any = {};
    
    if (bookingId) {
      // Booking payment - use toFixed for exact string representation
      metadata.bookingId = bookingId;
      metadata.providerId = providerId;
      metadata.platformFee = toFixed(platformFeeDecimal, 2);
      metadata.providerPayout = toFixed(providerPayoutDecimal, 2);
      metadata.commissionRate = rate.toFixed(2);
    } else if (transactionId || walletId) {
      // Wallet/package purchase
      if (transactionId) metadata.transactionId = transactionId;
      if (walletId) metadata.walletId = walletId;
      metadata.type = 'wallet_purchase';
    }

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: 'aud',
        capture_method: 'automatic',
        ...(customerEmail && customerEmail !== 'customer@example.com' ? { receipt_email: customerEmail } : {}),
        description,
        metadata,
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: amountNum,
        platformFee: platformFeeNum,
        providerPayout: providerPayoutNum,
      };
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw new Error('Failed to create payment intent');
    }
  }

  /**
   * Create a Stripe Connect account for an instructor
   */
  async createConnectAccount(params: CreateConnectAccountParams) {
    const { providerId, email, name, phone } = params;

    try {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'AU',
        email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        metadata: {
          providerId,
        },
      });

      return {
        accountId: account.id,
        onboardingUrl: await this.createAccountLink(account.id),
      };
    } catch (error) {
      console.error('Error creating Connect account:', error);
      throw new Error('Failed to create Connect account');
    }
  }

  /**
   * Create an account link for onboarding
   */
  async createAccountLink(accountId: string) {
    try {
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${process.env.NEXTAUTH_URL}/dashboard/profile`,
        return_url: `${process.env.NEXTAUTH_URL}/dashboard/profile?stripe_onboarding=success`,
        type: 'account_onboarding',
      });

      return accountLink.url;
    } catch (error) {
      console.error('Error creating account link:', error);
      throw new Error('Failed to create account link');
    }
  }

  /**
   * Create a payout to instructor's Stripe Connect account
   */
  async createPayout(accountId: string, amount: number | Decimal, description: string) {
    // Convert to Decimal for exact calculation, then to cents
    const amountDecimal = toDecimal(amount);
    const amountNum = toNumber(amountDecimal);
    const amountInCents = Math.round(amountNum * 100);

    try {
      const transfer = await stripe.transfers.create({
        amount: amountInCents,
        currency: 'aud',
        destination: accountId,
        description,
      });

      return {
        transferId: transfer.id,
        amount: amountNum,
        status: 'completed', // Transfers are immediate
      };
    } catch (error) {
      console.error('Error creating payout:', error);
      throw new Error('Failed to create payout');
    }
  }

  /**
   * Retrieve payment intent
   */
  async getPaymentIntent(paymentIntentId: string) {
    try {
      return await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      console.error('Error retrieving payment intent:', error);
      throw new Error('Failed to retrieve payment intent');
    }
  }

  /**
   * Retrieve payment intent (alias for getPaymentIntent)
   */
  async retrievePaymentIntent(paymentIntentId: string) {
    return this.getPaymentIntent(paymentIntentId);
  }

  /**
   * Create a refund
   */
  async createRefund(paymentIntentId: string, amount?: number | Decimal) {
    try {
      // Convert amount to cents if provided
      let amountInCents: number | undefined;
      if (amount !== undefined) {
        const amountDecimal = toDecimal(amount);
        const amountNum = toNumber(amountDecimal);
        amountInCents = Math.round(amountNum * 100);
      }

      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amountInCents,
      });

      return {
        refundId: refund.id,
        amount: refund.amount / 100,
        status: refund.status,
      };
    } catch (error) {
      console.error('Error creating refund:', error);
      throw new Error('Failed to create refund');
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): Stripe.Event {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    
    try {
      return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw new Error('Invalid webhook signature');
    }
  }
}

export const stripeService = new StripeService();