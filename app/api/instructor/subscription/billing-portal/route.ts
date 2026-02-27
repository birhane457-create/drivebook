import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';


export const dynamic = 'force-dynamic';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-01-28.clover',
});

/**
 * Validate return URL for security
 */
function isValidReturnUrl(url?: string) {
  if (!url) return false;
  try {
    const u = new URL(url);
    const allowed = process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL).host : null;
    return !allowed || u.host === allowed || u.origin === process.env.NEXTAUTH_URL;
  } catch {
    return false;
  }
}

/**
 * Create Stripe Billing Portal Session
 * 
 * Allows instructors to:
 * - Update payment method
 * - View invoices
 * - Download receipts
 * - Update billing address
 * - Cancel subscription
 * 
 * For TRIAL users without payment method: Creates checkout session to add payment
 * 
 * Security features:
 * - Environment validation
 * - Return URL validation
 * - Stripe Connect support
 * - Proper error handling
 */
export async function POST(req: NextRequest) {
  try {
    // Basic env checks
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('Missing STRIPE_SECRET_KEY');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse body safely
    let body: { return_url?: string } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const returnUrl = isValidReturnUrl(body.return_url) 
      ? body.return_url 
      : `${process.env.NEXTAUTH_URL}/dashboard/subscription`;

    // Find user + instructor
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { instructor: true }
    });

    if (!user || !user.instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    const instructor = user.instructor;

    // If no customer id, try to salvage from latest subscription
    if (!instructor.stripeCustomerId) {
      const subscription = await prisma.subscription.findFirst({
        where: {
          instructorId: instructor.id,
          status: { in: ['TRIAL', 'ACTIVE'] }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (subscription?.stripeCustomerId) {
        await prisma.instructor.update({
          where: { id: instructor.id },
          data: { stripeCustomerId: subscription.stripeCustomerId }
        });
        instructor.stripeCustomerId = subscription.stripeCustomerId;
      }
    }

    // If still no customer id -> generate checkout link for trial users
    if (!instructor.stripeCustomerId) {
      const subscription = await prisma.subscription.findFirst({
        where: { instructorId: instructor.id },
        orderBy: { createdAt: 'desc' }
      });

      const tier = subscription?.tier || 'BASIC';
      const billingCycle = subscription?.billingCycle || 'monthly';
      
      // Map tier to correct price ID based on billing cycle
      const priceIdMap: Record<string, Record<string, string>> = {
        'BASIC': {
          'monthly': process.env.STRIPE_BASIC_MONTHLY_PRICE_ID || '',
          'annual': process.env.STRIPE_BASIC_ANNUAL_PRICE_ID || ''
        },
        'PRO': {
          'monthly': process.env.STRIPE_PRO_MONTHLY_PRICE_ID || '',
          'annual': process.env.STRIPE_PRO_ANNUAL_PRICE_ID || ''
        },
        'BUSINESS': {
          'monthly': process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID || '',
          'annual': process.env.STRIPE_BUSINESS_ANNUAL_PRICE_ID || ''
        }
      };

      const priceId = priceIdMap[tier]?.[billingCycle];

      if (!priceId) {
        console.error(`Missing STRIPE_${tier}_${billingCycle.toUpperCase()}_PRICE_ID`);
        return NextResponse.json({
          error: 'Checkout configuration missing',
          code: 'missing_price_id',
          details: `Missing price ID for ${tier} ${billingCycle}`
        }, { status: 500 });
      }

      const checkoutSession = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.NEXTAUTH_URL}/dashboard/subscription?success=true`,
        cancel_url: `${process.env.NEXTAUTH_URL}/dashboard/subscription?canceled=true`,
        metadata: { instructorId: instructor.id }
      });

      return NextResponse.json({
        checkoutUrl: checkoutSession.url,
        reason: 'requires_payment_method',
        message: 'Please add a payment method to manage your subscription.'
      }, { status: 200 });
    }

    // Build stripe call options: support Connect accounts if instructor has a connected account id
    const stripeCallOptions = (instructor.stripeAccountId) 
      ? { stripeAccount: instructor.stripeAccountId } 
      : undefined;

    // Create billing portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: instructor.stripeCustomerId,
      return_url: returnUrl,
    }, stripeCallOptions);

    return NextResponse.json({ url: portalSession.url });

  } catch (err: any) {
    console.error('Billing portal error:', err);
    
    // If Stripe error, surface code/status in dev; return 502 for provider errors
    const isStripeError = err && (err.type || err.code || err.raw);
    return NextResponse.json(
      { 
        error: 'Failed to create billing portal session', 
        message: isStripeError ? err.message : 'Internal server error' 
      },
      { status: isStripeError ? 502 : 500 }
    );
  }
}
