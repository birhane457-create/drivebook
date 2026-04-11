import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
});

/**
 * POST /api/instructor/stripe-connect/onboard
 *
 * Creates or retrieves a Stripe Connect Express account for the instructor,
 * then generates a Stripe-hosted onboarding link.
 *
 * The instructor is redirected to Stripe's own page where they enter their
 * bank details directly — the platform never sees them.
 *
 * On completion, Stripe redirects back to /dashboard/settings/payout?stripe=success
 * On exit without completing, Stripe redirects to /dashboard/settings/payout?stripe=refresh
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.instructorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const instructor = await prisma.instructor.findUnique({
      where: { id: session.user.instructorId },
      select: {
        id: true,
        name: true,
        stripeAccountId: true,
        user: { select: { email: true } },
      },
    });
    if (!instructor) return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

    // Create a Stripe Connect Express account if one doesn't exist yet
    let stripeAccountId = instructor.stripeAccountId;
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'AU',
        email: instructor.user?.email,
        capabilities: {
          transfers: { requested: true },
        },
        business_type: 'individual',
        metadata: {
          instructorId: instructor.id,
          instructorName: instructor.name,
        },
      });
      stripeAccountId = account.id;

      // Save immediately so we can reuse it on refresh
      await prisma.instructor.update({
        where: { id: instructor.id },
        data: { stripeAccountId } as any,
      });
    }

    // Generate the onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${baseUrl}/dashboard/settings/payout?stripe=refresh`,
      return_url: `${baseUrl}/dashboard/settings/payout?stripe=success`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error: any) {
    console.error('Stripe Connect onboard error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create onboarding link' }, { status: 500 });
  }
}
