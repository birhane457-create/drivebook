import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SUBSCRIPTION_PLANS, getStripePriceId } from '@/lib/config/subscriptions';


export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { tier, billingCycle = 'monthly' } = body;

    if (!tier || !['BASIC', 'PRO', 'BUSINESS'].includes(tier)) {
      return NextResponse.json(
        { error: 'Invalid subscription tier' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { instructor: true },
    });

    if (!user?.instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      // If Stripe not configured, just start trial
      const plan = SUBSCRIPTION_PLANS[tier as keyof typeof SUBSCRIPTION_PLANS];
      const now = new Date();
      const trialEnd = new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000);

      await prisma.instructor.update({
        where: { id: user.instructor.id },
        data: {
          subscriptionTier: tier as any,
          subscriptionStatus: 'TRIAL',
          commissionRate: plan.commissionRate,
          newStudentBonus: plan.newStudentBonus,
          trialEndsAt: trialEnd,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Started ${plan.trialDays}-day free trial`,
        trialEndsAt: trialEnd,
      });
    }

    // Stripe is configured - create checkout session
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const priceId = getStripePriceId(tier as any, billingCycle);

    const checkoutSession = await stripe.checkout.sessions.create({
      customer_email: user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXTAUTH_URL}/dashboard/subscription?success=true`,
      cancel_url: `${process.env.NEXTAUTH_URL}/dashboard/subscription?cancelled=true`,
      metadata: {
        instructorId: user.instructor.id,
        tier,
        billingCycle,
      },
      subscription_data: {
        trial_period_days: SUBSCRIPTION_PLANS[tier as keyof typeof SUBSCRIPTION_PLANS].trialDays,
        metadata: {
          instructorId: user.instructor.id,
          tier,
        },
      },
    });

    return NextResponse.json({
      success: true,
      checkoutUrl: checkoutSession.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
