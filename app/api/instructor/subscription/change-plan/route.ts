import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SUBSCRIPTION_PLANS, getStripePriceId } from '@/lib/config/subscriptions';
import { logSubscriptionAction, AuditAction } from '@/lib/services/auditLogger';
import Stripe from 'stripe';


export const dynamic = 'force-dynamic';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
});

/**
 * Change Subscription Plan (Upgrade/Downgrade)
 * 
 * Handles:
 * - Upgrading (BASIC → PRO → BUSINESS)
 * - Downgrading (BUSINESS → PRO → BASIC)
 * - Changing billing cycle (monthly ↔ annual)
 * - Proration (charge/credit difference)
 * 
 * CRITICAL: Updates existing subscription, doesn't create duplicate
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body with error handling
    let body;
    try {
      const text = await req.text();
      if (!text || text.trim() === '') {
        return NextResponse.json(
          { error: 'Request body is empty' },
          { status: 400 }
        );
      }
      body = JSON.parse(text);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { newTier, billingCycle = 'monthly' } = body;

    // Validate tier
    if (!newTier || !['BASIC', 'PRO', 'BUSINESS'].includes(newTier)) {
      return NextResponse.json(
        { error: 'Invalid subscription tier' },
        { status: 400 }
      );
    }

    // Get instructor
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { instructor: true }
    });

    if (!user?.instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    // Get current subscription
    const currentSubscription = await prisma.subscription.findFirst({
      where: {
        instructorId: user.instructor.id,
        status: { in: ['ACTIVE', 'TRIAL'] }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Check if already on this tier
    if (user.instructor.subscriptionTier === newTier) {
      return NextResponse.json({
        error: 'Already on this plan',
        current: user.instructor.subscriptionTier
      }, { status: 400 });
    }

    const newPlan = SUBSCRIPTION_PLANS[newTier as keyof typeof SUBSCRIPTION_PLANS];
    const newPriceId = getStripePriceId(newTier as any, billingCycle);

    // If no Stripe subscription (trial user), just update database
    if (!currentSubscription?.stripeSubscriptionId) {
      // Update database only for trial users
      await prisma.$transaction(async (tx) => {
        if (!user.instructor) return;
        
        // Update subscription record
        if (currentSubscription) {
          await tx.subscription.update({
            where: { id: currentSubscription.id },
            data: {
              tier: newTier as any,
              monthlyAmount: newPlan.monthlyPrice,
              billingCycle
            }
          });
        }

        // Update instructor
        await tx.instructor.update({
          where: { id: user.instructor.id },
          data: {
            subscriptionTier: newTier as any,
            commissionRate: newPlan.commissionRate,
            newStudentBonus: newPlan.newStudentBonus,
            maxInstructors: newPlan.limits.instructors
          }
        });

        // Log the change
        await logSubscriptionAction({
          subscriptionId: currentSubscription?.id || 'trial',
          instructorId: user.instructor.id,
          action: AuditAction.SUBSCRIPTION_UPDATED,
          metadata: {
            oldTier: user.instructor.subscriptionTier,
            newTier,
            oldCommissionRate: user.instructor.commissionRate,
            newCommissionRate: newPlan.commissionRate,
            billingCycle,
            changeType: getChangeType(user.instructor.subscriptionTier || 'BASIC', newTier),
            isTrial: true
          }
        });
      });

      return NextResponse.json({
        success: true,
        message: `Successfully ${getChangeType(user.instructor.subscriptionTier, newTier)}d to ${newPlan.name} plan`,
        subscription: {
          tier: newTier,
          commissionRate: newPlan.commissionRate,
          newStudentBonus: newPlan.newStudentBonus,
          monthlyAmount: newPlan.monthlyPrice,
          billingCycle,
          isTrial: true
        }
      });
    }

    // Update existing Stripe subscription
    const stripeSubscription = await stripe.subscriptions.retrieve(
      currentSubscription.stripeSubscriptionId
    );

    // Get the subscription item ID
    const subscriptionItemId = stripeSubscription.items.data[0].id;

    // Update subscription with proration
    const updatedSubscription = await stripe.subscriptions.update(
      currentSubscription.stripeSubscriptionId,
      {
        items: [{
          id: subscriptionItemId,
          price: newPriceId,
        }],
        proration_behavior: 'create_prorations', // Charge/credit difference immediately
        metadata: {
          instructorId: user.instructor.id,
          tier: newTier,
          billingCycle
        }
      }
    );

    // Update database
    await prisma.$transaction(async (tx) => {
      if (!user.instructor) return; // Type guard
      
      // Update subscription record
      await tx.subscription.update({
        where: { id: currentSubscription.id },
        data: {
          tier: newTier as any,
          monthlyAmount: newPlan.monthlyPrice,
          billingCycle
        }
      });

      // Update instructor
      await tx.instructor.update({
        where: { id: user.instructor.id },
        data: {
          subscriptionTier: newTier as any,
          commissionRate: newPlan.commissionRate,
          newStudentBonus: newPlan.newStudentBonus,
          maxInstructors: newPlan.limits.instructors
        }
      });

      // Log the change
      await logSubscriptionAction({
        subscriptionId: currentSubscription.stripeSubscriptionId || 'unknown',
        instructorId: user.instructor.id,
        action: AuditAction.SUBSCRIPTION_UPDATED,
        metadata: {
          oldTier: user.instructor.subscriptionTier,
          newTier,
          oldCommissionRate: user.instructor.commissionRate,
          newCommissionRate: newPlan.commissionRate,
          billingCycle,
          changeType: getChangeType(user.instructor.subscriptionTier || 'BASIC', newTier)
        }
      });
    });

    return NextResponse.json({
      success: true,
      message: `Successfully ${getChangeType(user.instructor.subscriptionTier, newTier)}d to ${newPlan.name} plan`,
      subscription: {
        tier: newTier,
        commissionRate: newPlan.commissionRate,
        newStudentBonus: newPlan.newStudentBonus,
        monthlyAmount: newPlan.monthlyPrice,
        billingCycle
      }
    });

  } catch (error: any) {
    console.error('Change plan error:', error);
    return NextResponse.json(
      { error: 'Failed to change plan', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * Create new subscription (for instructors without Stripe subscription)
 */
async function createNewSubscription(
  user: any,
  tier: string,
  billingCycle: string,
  priceId: string
) {
  if (!user.instructor) {
    throw new Error('Instructor not found');
  }

  const plan = SUBSCRIPTION_PLANS[tier as keyof typeof SUBSCRIPTION_PLANS];

  // Create Stripe checkout session
  const checkoutSession = await stripe.checkout.sessions.create({
    customer_email: user.email,
    line_items: [{
      price: priceId,
      quantity: 1,
    }],
    mode: 'subscription',
    success_url: `${process.env.NEXTAUTH_URL}/dashboard/subscription?success=true`,
    cancel_url: `${process.env.NEXTAUTH_URL}/dashboard/subscription?cancelled=true`,
    metadata: {
      instructorId: user.instructor.id,
      tier,
      billingCycle,
    },
    subscription_data: {
      trial_period_days: plan.trialDays,
      metadata: {
        instructorId: user.instructor.id,
        tier,
      },
    },
  });

  return NextResponse.json({
    success: true,
    requiresCheckout: true,
    checkoutUrl: checkoutSession.url,
    message: 'Please complete checkout to activate new plan'
  });
}

/**
 * Determine if upgrade or downgrade
 */
function getChangeType(oldTier: string, newTier: string): string {
  const tierOrder = { BASIC: 1, PRO: 2, BUSINESS: 3 };
  const oldOrder = tierOrder[oldTier as keyof typeof tierOrder] || 0;
  const newOrder = tierOrder[newTier as keyof typeof tierOrder] || 0;
  
  return newOrder > oldOrder ? 'upgrade' : 'downgrade';
}
