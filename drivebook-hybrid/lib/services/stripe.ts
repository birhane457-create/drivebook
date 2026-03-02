import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
});

interface CreatePaymentIntentParams {
  amount: number; // in dollars
  instructorId: string;
  bookingId: string;
  clientEmail: string;
  description: string;
}

interface CreateConnectAccountParams {
  instructorId: string;
  email: string;
  name: string;
  phone: string;
}

export class StripeService {
  private commissionRate: number;

  constructor() {
    this.commissionRate = parseFloat(process.env.PLATFORM_COMMISSION_RATE || '12');
  }

  /**
   * Create a payment intent for a booking
   * Uses automatic capture for immediate payment
   */
  async createPaymentIntent(params: CreatePaymentIntentParams) {
    const { amount, instructorId, bookingId, clientEmail, description } = params;

    // Calculate platform fee
    const platformFee = (amount * this.commissionRate) / 100;
    const instructorPayout = amount - platformFee;

    // Convert to cents for Stripe
    const amountInCents = Math.round(amount * 100);

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: 'aud', // Australian dollars
        capture_method: 'automatic', // Immediate capture for booking payments
        receipt_email: clientEmail,
        description,
        metadata: {
          bookingId,
          instructorId,
          platformFee: platformFee.toFixed(2),
          instructorPayout: instructorPayout.toFixed(2),
        },
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount,
        platformFee,
        instructorPayout,
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
    const { instructorId, email, name, phone } = params;

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
          instructorId,
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
  async createPayout(accountId: string, amount: number, description: string) {
    const amountInCents = Math.round(amount * 100);

    try {
      const transfer = await stripe.transfers.create({
        amount: amountInCents,
        currency: 'aud',
        destination: accountId,
        description,
      });

      return {
        transferId: transfer.id,
        amount,
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
  async createRefund(paymentIntentId: string, amount?: number) {
    try {
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined,
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
