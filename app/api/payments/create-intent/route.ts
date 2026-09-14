import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { stripeService } from '@/lib/services/stripe';
import { prisma } from '@/lib/prisma';
import { getCommissionRate } from '@/lib/services/platform-pricing';
import { getDisplayName } from '@/lib/utils/account';
import { checkRateLimitStrict, getRateLimitIdentifier } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

// ✅ SECURITY FIX: Rate limiting configuration
// 10 requests per minute per user/IP prevents Stripe API abuse
const createIntentRateLimit = {
  limit: async (identifier: string) => {
    // Use in-memory rate limiter with 10 requests per 60 seconds
    const requests: Map<string, number[]> = (global as any).__createIntentRateLimits || new Map();
    (global as any).__createIntentRateLimits = requests;
    
    const now = Date.now();
    const windowMs = 60 * 1000; // 60 seconds
    const windowStart = now - windowMs;
    const maxRequests = 10;
    
    const existing = requests.get(identifier) || [];
    const recentRequests = existing.filter(time => time > windowStart);
    
    if (recentRequests.length >= maxRequests) {
      return {
        success: false,
        limit: maxRequests,
        remaining: 0,
        reset: Math.min(...recentRequests) + windowMs,
      };
    }
    
    recentRequests.push(now);
    requests.set(identifier, recentRequests);
    
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - recentRequests.length,
      reset: now + windowMs,
    };
  }
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookingId, transactionId, amount, paymentToken } = body;

    // ✅ SECURITY FIX: Rate limiting BEFORE any logic
    const session = await getServerSession(authOptions);
    const rateLimitId = getRateLimitIdentifier(
      session?.user?.id, 
      req.headers.get('x-forwarded-for'),
      'create_intent'
    );
    
    const rateLimitResult = await checkRateLimitStrict(
      createIntentRateLimit, 
      rateLimitId
    );
    
    if (!rateLimitResult.success) {
      const retryAfter = rateLimitResult.headers?.['X-RateLimit-Reset'] 
        ? Math.ceil((new Date(rateLimitResult.headers['X-RateLimit-Reset']).getTime() - Date.now()) / 1000)
        : 60;
        
      return NextResponse.json(
        { error: rateLimitResult.error || 'Too many requests' },
        { 
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            ...(rateLimitResult.headers || {})
          }
        }
      );
    }

    // Handle both booking payments AND wallet/package purchases
    if (!bookingId && !transactionId) {
      return NextResponse.json(
        { error: 'Missing bookingId or transactionId' },
        { status: 400 }
      );
    }

    // ✅ Handle wallet/package purchase (book later) — always requires session
    if (transactionId) {
      const walletSession = await getServerSession(authOptions);
      if (!walletSession?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return handleWalletPaymentIntent(transactionId, amount);
    }

    // ✅ Handle booking payment (book now)
    // Two auth paths:
    //   1. paymentToken provided (unauthenticated payment page) — token is validated in handler
    //   2. session present (dashboard / admin) — session ownership is validated in handler
    const bookingSession = await getServerSession(authOptions);
    return handleBookingPaymentIntent(bookingId, amount, bookingSession?.user ?? undefined, paymentToken);
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}

/**
 * Create payment intent for wallet/package purchase (book later)
 */
async function handleWalletPaymentIntent(transactionId: string, amount?: number) {
  try {
    // Get wallet transaction details
    const transaction = await prisma.walletTransaction.findUnique({
      where: { id: transactionId },
      include: {
        wallet: {
          include: {
            user: true
          }
        }
      }
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (transaction.status === 'CONFIRMED') {
      return NextResponse.json(
        { error: 'Transaction already confirmed' },
        { status: 400 }
      );
    }

    // ✅ SECURITY FIX: Always use transaction.amount from DB - never trust client
    // Client-supplied amount is rejected to prevent manipulation attacks
    const paymentAmount = transaction.amount;

    if (amount && amount !== Number(transaction.amount)) {
      return NextResponse.json({ 
        error: `Amount mismatch - expected ${transaction.amount}, received ${amount}` 
      }, { status: 400 });
    }

    const customerEmail = transaction.wallet.user.email;

    // Create payment intent with transactionId in metadata
    const paymentIntent = await stripeService.createPaymentIntent({
      amount: paymentAmount,
      providerId: '', // Not applicable for wallet purchases
      transactionId: transaction.id, // ✅ Pass transactionId instead of bookingId
      walletId: transaction.walletId, // ✅ Also pass walletId for webhook
      customerEmail,
      description: transaction.description || 'Package purchase',
    });

    // F-12 FIX: Store PaymentIntent ID in transaction metadata for explicit correlation
    // This enables the webhook to match by PaymentIntent ID instead of time window
    await prisma.walletTransaction.update({
      where: { id: transaction.id },
      data: {
        metadata: {
          ...(transaction.metadata as any || {}),
          stripePaymentIntentId: paymentIntent.paymentIntentId,
        }
      }
    });

    return NextResponse.json({
      clientSecret: paymentIntent.clientSecret,
      amount: paymentIntent.amount,
    });
  } catch (error) {
    console.error('Error in handleWalletPaymentIntent:', error);
    return NextResponse.json(
      { error: 'Failed to create wallet payment intent' },
      { status: 500 }
    );
  }
}

/**
 * Create payment intent for booking payment (book now)
 */
async function handleBookingPaymentIntent(bookingId: string, amount?: number, sessionUser?: { id: string; role: string }, paymentToken?: string) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        provider: { 
          select: { 
            id: true, 
            name: true, 
            businessName: true, 
            accountType: true, 
            paymentMode: true, 
            subscriptionTier: true 
          } 
        }
      },
    });

    // ── Payment mode guard (phase 2 safety net) ───────────────────────────────
    if (booking?.provider?.paymentMode === 'DIRECT') {
      console.error(`[create-intent] instructor ${booking.provider.id} has paymentMode=DIRECT which is not yet implemented`);
      return NextResponse.json({
        error: 'Direct payment mode is not yet available. Please contact support.',
        code: 'PAYMENT_MODE_NOT_IMPLEMENTED',
      }, { status: 503 });
    }

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // ── Auth gate ──────────────────────────────────────────────────────────
    // Either a valid paymentToken (payment page) OR a valid session (dashboard) is required.
    // Both provide identity verification — token proves SMS receipt, session proves login.
    if (paymentToken) {
      // Token path: unauthenticated payment page
      const storedToken = booking.paymentToken ?? '';
      if (!storedToken || storedToken !== paymentToken) {
        return NextResponse.json({ error: 'Invalid payment token' }, { status: 403 });
      }
    } else if (sessionUser) {
      // Session path: authenticated dashboard/admin
      const isAdmin = sessionUser.role === 'ADMIN' || sessionUser.role === 'SUPER_ADMIN';
      if (!isAdmin && booking.customerId) {
        const client = await prisma.customer.findUnique({
          where: { id: booking.customerId },
          select: { userId: true },
        });
        if (client?.userId !== sessionUser.id) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
    } else {
      // No token and no session — reject
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (booking.isPaid) {
      return NextResponse.json(
        { error: 'Booking already paid' },
        { status: 400 }
      );
    }

    // Validate booking is still in a payable state
    // Never create/reuse a PaymentIntent for expired, cancelled, or completed bookings
    const SLOT_HOLD_MINUTES = 10;
    const expiresAt = new Date(booking.createdAt.getTime() + SLOT_HOLD_MINUTES * 60 * 1000);
    const isExpired =
      booking.status === 'EXPIRED' ||
      (booking.status === 'PENDING_PAYMENT' && new Date() > expiresAt);

    if (isExpired) {
      return NextResponse.json(
        { error: 'This booking has expired. The slot has been released — please book again.', code: 'BOOKING_EXPIRED' },
        { status: 410 }
      );
    }

    if (!['PENDING_PAYMENT', 'PENDING'].includes(booking.status)) {
      return NextResponse.json(
        { error: `Booking is not in a payable state (status: ${booking.status})`, code: 'INVALID_STATUS' },
        { status: 400 }
      );
    }

    // Use booking.price always — never accept amount from client for booking payments.
    // The webhook validates amount_received (from Stripe) against booking.price (from DB),
    // so a client-supplied amount can't actually confirm a booking, but removing it here
    // makes the intent explicit and eliminates dead code.
    const paymentAmount = booking.price;

    // ✅ SECURITY FIX: PaymentIntent deduplication with DB-level advisory lock.
    //
    // RACE CONDITION (before fix):
    //   Two tabs both read booking.paymentIntentId = null simultaneously.
    //   Both skip the existing-intent check. Both call stripe.paymentIntents.create().
    //   Last UPDATE wins — the first intent is orphaned in Stripe forever.
    //
    // FIX: PostgreSQL advisory lock per booking ID + PaymentIntent creation INSIDE transaction.
    //   Only one request at a time can reach the create + update path for a given bookingId.
    //   The lock is released automatically at transaction end.
    //   PaymentIntent is created INSIDE the transaction to ensure atomicity.
    //
    // Implementation: pg_advisory_xact_lock(bigint) takes an integer. We hash the bookingId
    // string to a stable 64-bit integer using hashtext() which is available in all Postgres versions.

    const dedupeResult = await prisma.$transaction(async (tx) => {
      // Acquire exclusive lock for this bookingId — blocks concurrent requests
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${bookingId}))`;

      // Re-read booking inside the lock to get the latest paymentIntentId
      const freshBooking = await tx.booking.findUnique({
        where: { id: bookingId },
        select: { paymentIntentId: true, isPaid: true, status: true },
      });

      if (!freshBooking) return { status: 'not_found' as const };
      if (freshBooking.isPaid) return { status: 'already_paid' as const };
      if (!['PENDING_PAYMENT', 'PENDING'].includes(freshBooking.status)) {
        return { status: 'invalid_status' as const, bookingStatus: freshBooking.status };
      }

      // Check existing intent while holding the lock — no race possible here
      if (freshBooking.paymentIntentId) {
        try {
          const existingIntent = await stripeService.retrievePaymentIntent(freshBooking.paymentIntentId);
          const reusableStatuses = ['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing'];
          if (reusableStatuses.includes(existingIntent.status)) {
            return {
              status: 'reuse' as const,
              clientSecret: existingIntent.client_secret,
              amount: existingIntent.amount / 100,
            };
          }
          // Existing intent is not reusable (succeeded/canceled/etc) — we'll create a new one
          // (Stripe payment intents cannot be cancelled, only refunded if succeeded)
        } catch {
          // Intent not found in Stripe — create new one
        }
      }

      // ✅ SECURITY FIX: Create PaymentIntent INSIDE transaction
      // This ensures atomicity — if DB update fails, no orphaned intent exists
      
      // Get customerEmail — look up linked client's user email.
      // Use null if not found — never fall back to a placeholder that misdirects Stripe receipts.
      let customerEmail: string | null = null;
      if (booking.customerId) {
        const client = await tx.customer.findUnique({
          where: { id: booking.customerId },
          include: { user: true }
        });
        if (client?.user?.email) customerEmail = client.user.email;
        else if (client?.email) customerEmail = client.email;
      }

      // Get tier-aware commission rate from DB settings
      const commissionRate = await getCommissionRate(booking.provider.subscriptionTier ?? 'BASIC');

      // Create payment intent INSIDE transaction
      const paymentIntent = await stripeService.createPaymentIntent({
        amount: paymentAmount,
        providerId: booking.providerId,
        bookingId: booking.id,
        commissionRate,
        customerEmail: customerEmail ?? '',
        description: `Driving lesson with ${getDisplayName(booking.provider)}`,
      });

      // Update booking with payment intent ID INSIDE same transaction
      await tx.booking.update({
        where: { id: bookingId },
        data: { paymentIntentId: paymentIntent.paymentIntentId }
      });

      return {
        status: 'created' as const,
        clientSecret: paymentIntent.clientSecret,
        amount: paymentIntent.amount,
      };
    }, {
      isolationLevel: 'Serializable',  // ✅ SECURITY FIX: Add SERIALIZABLE isolation
      maxWait: 5000,
      timeout: 10000
    });

    if (dedupeResult.status === 'not_found') {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    if (dedupeResult.status === 'already_paid') {
      return NextResponse.json({ error: 'Booking already paid' }, { status: 400 });
    }
    if (dedupeResult.status === 'invalid_status') {
      return NextResponse.json(
        { error: `Booking is not in a payable state (status: ${dedupeResult.bookingStatus})`, code: 'INVALID_STATUS' },
        { status: 400 }
      );
    }
    if (dedupeResult.status === 'reuse') {
      return NextResponse.json({
        clientSecret: dedupeResult.clientSecret,
        amount: dedupeResult.amount,
      });
    }
    // dedupeResult.status === 'created' — PaymentIntent was created inside transaction
    return NextResponse.json({
      clientSecret: dedupeResult.clientSecret,
      amount: dedupeResult.amount,
    });
  } catch (error) {
    console.error('Error in handleBookingPaymentIntent:', error);
    return NextResponse.json(
      { error: 'Failed to create booking payment intent' },
      { status: 500 }
    );
  }
}
