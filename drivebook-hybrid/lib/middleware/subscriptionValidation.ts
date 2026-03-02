/**
 * Subscription Validation Middleware
 * 
 * Ensures instructors have active subscriptions before accessing platform features
 * 
 * CRITICAL: Prevents free access after trial expires or payment fails
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function validateSubscription(req: NextRequest): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  
  // Only check for instructors
  if (session?.user?.role !== 'INSTRUCTOR') {
    return null; // Not an instructor, skip validation
  }

  try {
    const instructor = await prisma.instructor.findUnique({
      where: { userId: session.user.id },
      select: {
        subscriptionStatus: true,
        trialEndsAt: true,
        subscriptionTier: true
      }
    });

    if (!instructor) {
      return null; // No instructor record, let other middleware handle
    }

    // Check if trial expired
    const trialExpired = instructor.trialEndsAt && 
      new Date(instructor.trialEndsAt) < new Date();

    // Allow access if:
    // 1. Status is ACTIVE
    // 2. Status is TRIAL and trial not expired
    const hasAccess = 
      instructor.subscriptionStatus === 'ACTIVE' ||
      (instructor.subscriptionStatus === 'TRIAL' && !trialExpired);

    if (!hasAccess) {
      // Redirect to subscription page
      const url = new URL('/dashboard/subscription', req.url);
      url.searchParams.set('reason', instructor.subscriptionStatus);
      return NextResponse.redirect(url);
    }

    return null; // Has access, continue
  } catch (error) {
    console.error('Subscription validation error:', error);
    // Fail open - don't block on error
    return null;
  }
}

/**
 * Check if instructor has active subscription
 * Use this in API routes
 */
export async function requireActiveSubscription(userId: string): Promise<{
  valid: boolean;
  status?: string;
  message?: string;
}> {
  try {
    const instructor = await prisma.instructor.findUnique({
      where: { userId },
      select: {
        subscriptionStatus: true,
        trialEndsAt: true
      }
    });

    if (!instructor) {
      return {
        valid: false,
        message: 'Instructor not found'
      };
    }

    // Check if trial expired
    const trialExpired = instructor.trialEndsAt && 
      new Date(instructor.trialEndsAt) < new Date();

    // Check if has access
    const hasAccess = 
      instructor.subscriptionStatus === 'ACTIVE' ||
      (instructor.subscriptionStatus === 'TRIAL' && !trialExpired);

    if (!hasAccess) {
      return {
        valid: false,
        status: instructor.subscriptionStatus,
        message: getSubscriptionMessage(instructor.subscriptionStatus, trialExpired)
      };
    }

    return { valid: true };
  } catch (error) {
    console.error('Subscription check error:', error);
    // Fail open - allow access on error
    return { valid: true };
  }
}

function getSubscriptionMessage(status: string, trialExpired: boolean | null): string {
  if (status === 'TRIAL' && trialExpired === true) {
    return 'Your free trial has expired. Please subscribe to continue.';
  }
  
  if (status === 'PAST_DUE') {
    return 'Your payment failed. Please update your payment method.';
  }
  
  if (status === 'CANCELLED') {
    return 'Your subscription has been cancelled. Please resubscribe to continue.';
  }
  
  if (status === 'EXPIRED') {
    return 'Your subscription has expired. Please renew to continue.';
  }
  
  return 'Active subscription required to access this feature.';
}
