/**
 * Subscription Validation Middleware
 *
 * Policy:
 * - ACTIVE or TRIAL (not expired) → full access
 * - TRIAL expired / CANCELLED / EXPIRED / PAST_DUE → READ-ONLY access
 *   Instructors can view all their historical data but cannot create or modify anything.
 *   This is required by Australian Privacy Act principles — data must remain accessible.
 * - No instructor record → fail open (let other middleware handle)
 *
 * "Read-only" means:
 *   ✅ GET all dashboard pages (bookings, clients, earnings, analytics, documents)
 *   ✅ Download receipts and exports
 *   ❌ POST/PUT/PATCH/DELETE on any instructor resource
 *   ❌ Public booking page hidden from search
 *   ❌ New bookings, new clients, settings changes
 */

import { prisma } from '@/lib/prisma';

export type SubscriptionAccess =
  | { valid: true; readOnly: false }
  | { valid: true; readOnly: true; reason: string; status: string }
  | { valid: false; message: string; status?: string };

/**
 * Check subscription access for an instructor user.
 * Returns full access, read-only access, or no access.
 */
export async function checkSubscriptionAccess(userId: string): Promise<SubscriptionAccess> {
  try {
    const instructor = await prisma.instructor.findUnique({
      where: { userId },
      select: {
        subscriptionStatus: true,
        trialEndsAt: true,
      },
    });

    if (!instructor) {
      // No instructor record — fail open, let page-level auth handle it
      return { valid: true, readOnly: false };
    }

    const { subscriptionStatus, trialEndsAt } = instructor;

    // Active trial — check expiry
    if (subscriptionStatus === 'TRIAL') {
      const trialExpired = trialEndsAt && new Date(trialEndsAt) < new Date();
      if (!trialExpired) {
        return { valid: true, readOnly: false };
      }
      // Trial expired → read-only
      return {
        valid: true,
        readOnly: true,
        reason: 'Your free trial has expired. Subscribe to create new bookings and accept students.',
        status: 'TRIAL_EXPIRED',
      };
    }

    // Paid active subscription
    if (subscriptionStatus === 'ACTIVE') {
      return { valid: true, readOnly: false };
    }

    // All other states → read-only (not blocked)
    const reasons: Record<string, string> = {
      PAST_DUE:  'Your payment is past due. Update your payment method to resume full access.',
      CANCELLED: 'Your subscription is cancelled. Resubscribe to create new bookings.',
      EXPIRED:   'Your subscription has expired. Renew to resume full access.',
    };

    return {
      valid: true,
      readOnly: true,
      reason: reasons[subscriptionStatus] ?? 'Your subscription is inactive. Subscribe to resume full access.',
      status: subscriptionStatus,
    };
  } catch (error) {
    console.error('Subscription check error:', error);
    // Fail open — never block on a DB error
    return { valid: true, readOnly: false };
  }
}

/**
 * Convenience: returns true if the instructor has full (non-read-only) access.
 * Use this in API route POST/PUT/PATCH/DELETE handlers.
 * NOTE: This checks subscription only. For booking creation, also check approvalStatus separately.
 *
 * Usage:
 *   const access = await requireActiveSubscription(session.user.id)
 *   if (!access.valid) return NextResponse.json({ error: access.message }, { status: 403 })
 */
export async function requireActiveSubscription(userId: string): Promise<{
  valid: boolean;
  status?: string;
  message?: string;
}> {
  const access = await checkSubscriptionAccess(userId);

  if (!access.valid) {
    return { valid: false, message: (access as any).message };
  }

  if (access.readOnly) {
    return {
      valid: false,
      status: access.status,
      message: access.reason,
    };
  }

  return { valid: true };
}

/**
 * Legacy: kept for backward compatibility with the old redirect-based approach.
 * Now returns null (no redirect) — read-only is handled at the layout level.
 */
export async function validateSubscription(): Promise<null> {
  return null;
}
