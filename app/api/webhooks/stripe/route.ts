import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-01-28.clover'
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature') || '';

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Handle payment intent succeeded
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      const { walletId, userEmail, type } = paymentIntent.metadata;

      if (type === 'wallet-credit-purchase' && walletId && userEmail) {
        const amountInDollars = paymentIntent.amount / 100;

        // Update wallet
        const wallet = await prisma.clientWallet.update({
          where: { id: walletId },
          data: {
            totalPaid: { increment: amountInDollars },
            creditsRemaining: { increment: amountInDollars },
            transactions: {
              create: {
                amount: amountInDollars,
                type: 'CREDIT',
                description: `Added $${amountInDollars} to wallet`,
                metadata: {
                  paymentIntentId: paymentIntent.id,
                  paymentMethod: typeof paymentIntent.payment_method === 'string' ? paymentIntent.payment_method : paymentIntent.payment_method?.id || null
                }
              }
            }
          },
          include: { transactions: true }
        });

        console.log(`Wallet ${walletId} successfully updated with $${amountInDollars}`);
      }
    }

    // Handle payment intent failed
    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.error(`Payment failed for intent ${paymentIntent.id}:`, paymentIntent.last_payment_error);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
