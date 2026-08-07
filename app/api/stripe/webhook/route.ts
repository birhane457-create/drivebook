import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services/email';
import { sendSingleLessonReceipt, sendPackagePurchaseReceipt, sendWalletTopUpReceipt } from '@/lib/services/receipt-email';
import { SUBSCRIPTION_PLANS } from '@/lib/config/subscriptions';
import { logSubscriptionAction, AuditAction } from '@/lib/services/auditLogger';
import { webhookRateLimit, checkRateLimitStrict, getRateLimitIdentifier } from '@/lib/ratelimit';
import { notifyPaymentReceived } from '@/lib/services/notifications';
import { getNotifChannels } from '@/lib/config/platform-settings';
import { recordPaymentCollected } from '@/lib/services/payout-service';
import { logger } from '@/lib/logger';
import { appendLedgerEntry, incrementLedger } from '@/lib/services/ledger-service';
import { sendAlert } from '@/lib/services/alert-service';
import Stripe from 'stripe';
import { getDisplayName } from '@/lib/utils/account';
import { DEFAULT_TIMEZONE } from '@/lib/utils/timezone';


export const dynamic = 'force-dynamic';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
});

/**
 * UNIFIED Stripe Webhook Handler
 * 
 * Handles ALL Stripe events:
 * - Booking payments (payment_intent.*)
 * - Subscription events (customer.subscription.*)
 * - Invoice events (invoice.*)
 * 
 * Security Features:
 * ✅ Webhook signature verification
 * ✅ Idempotency protection
 * ✅ Rate limiting
 * ✅ Audit logging
 * ✅ Atomic operations
 */
export async function POST(req: NextRequest) {
  try {
    // SECURITY: Rate limiting
    const rateLimitId = getRateLimitIdentifier(
      undefined,
      req.headers.get('x-forwarded-for'),
      'webhook'
    );
    
    const rateLimitResult = await checkRateLimitStrict(webhookRateLimit, rateLimitId);
    
    if (!rateLimitResult.success) {
      logger.error('🚨 Webhook rate limit exceeded', { rateLimitId });
      return NextResponse.json(
        { error: 'Too many webhook requests' },
        { status: 429, headers: rateLimitResult.headers }
      );
    }

    // SECURITY: Verify webhook signature
    const event = await verifyStripeWebhook(req);
    
    // SECURITY: Idempotency check
    const idempotencyKey = `${event.type}_${event.id}_${event.created}`;
    
    try {
      const existingEvent = await prisma.webhookEvent.findUnique({
        where: { idempotencyKey }
      });
      
      if (existingEvent) {
        logger.info('✅ Webhook already processed (idempotent)', { idempotencyKey });
        return NextResponse.json({ received: true, duplicate: true });
      }
    } catch (idempotencyErr) {
      // DB error during duplicate check — MUST reject rather than continue.
      // If we process anyway and Stripe retries, we risk double-crediting a wallet.
      // Returning 500 tells Stripe to retry later when the DB is healthy.
      // The original "non-fatal" comment was written before the WebhookEvent table
      // existed; the table is now fully migrated and this path should never be hit
      // in normal operation.
      logger.error('🚨 Idempotency check failed — rejecting webhook to prevent duplicate processing', {
        idempotencyKey,
        error: idempotencyErr instanceof Error ? idempotencyErr.message : String(idempotencyErr),
      });
      return NextResponse.json(
        { error: 'Idempotency check failed — will retry' },
        { status: 500 }
      );
    }

    // Process event based on type — errors here are caught below
    try {
      await handleStripeEvent(event, idempotencyKey);
    } catch (handlerErr) {
      logger.error(`🚨 Webhook handler error for ${event.type}`, {
        error: handlerErr instanceof Error ? handlerErr.message : String(handlerErr),
      });
      // Return 500 so Stripe retries delivery for transient errors (DB blips, network issues).
      // Stripe will retry with exponential backoff for up to 3 days.
      // Non-retryable errors (e.g. amount mismatch, invalid state) are logged above and should
      // be investigated via Stripe dashboard event logs.
      return NextResponse.json(
        { error: 'Webhook handler failed — will retry', handlerError: true },
        { status: 500 }
      );
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    logger.error('🚨 Webhook error', {
      error: error instanceof Error ? error.message : String(error),
    });
    
    // Signature verification failure — return 400 (not 500) so Stripe knows it's a bad request
    if (error.message?.includes('signature') || error.message?.includes('Invalid webhook')) {
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 400 }
      );
    }
    
    // Log security events
    if (error.message?.includes('signature')) {
      try {
        await logSubscriptionAction({
          subscriptionId: 'unknown',
          instructorId: 'unknown',
          action: AuditAction.WEBHOOK_VERIFICATION_FAILED,
          ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
          success: false,
          errorMessage: error.message
        });
      } catch { /* audit log failure is non-fatal */ }
    }
    
    return NextResponse.json(
      { error: 'Webhook handler failed', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * Verify Stripe webhook signature
 * CRITICAL: This prevents unauthorized webhook calls
 */
async function verifyStripeWebhook(req: NextRequest): Promise<Stripe.Event> {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  
  if (!sig) {
    throw new Error('Missing stripe-signature header');
  }
  
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    // Never process unsigned events. Without this secret, any caller could forge
    // payment success events and mutate bookings/wallets.
    logger.error('STRIPE_WEBHOOK_SECRET not set - rejecting webhook (fail closed)')
    throw new Error('Invalid webhook: STRIPE_WEBHOOK_SECRET not configured')
  }
  
  try {
    return stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    logger.error('🚨 Webhook verification failed', { error: err?.message ?? String(err) });
    throw new Error(`Invalid webhook signature: ${err.message}`);
  }
}

/**
 * Route events to appropriate handlers
 */
async function handleStripeEvent(event: Stripe.Event, idempotencyKey: string): Promise<void> {
  logger.info(`📥 Processing webhook: ${event.type}`);
  
  // Stripe's TS union may lag behind some event types; treat as string for routing.
  switch (event.type as string) {
    // CHECKOUT EVENTS
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, idempotencyKey);
      break;

    // BOOKING PAYMENTS
    case 'payment_intent.succeeded':
      await handleBookingPaymentSuccess(event.data.object as Stripe.PaymentIntent, idempotencyKey);
      break;

    case 'payment_intent.payment_failed':
      await handleBookingPaymentFailed(event.data.object as Stripe.PaymentIntent, idempotencyKey);
      break;

    // SUBSCRIPTION EVENTS
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdate(event.data.object as Stripe.Subscription, idempotencyKey);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionCancelled(event.data.object as Stripe.Subscription, idempotencyKey);
      break;

    case 'customer.subscription.trial_will_end':
      await handleTrialEnding(event.data.object as Stripe.Subscription, idempotencyKey);
      break;

    // INVOICE EVENTS
    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice, idempotencyKey);
      break;

    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice, idempotencyKey);
      break;

    // STRIPE CONNECT EVENTS
    case 'account.updated':
      await handleConnectAccountUpdated(event.data.object as Stripe.Account, idempotencyKey);
      break;

    // Sprint A: Dispute / chargeback handling
    case 'charge.dispute.created':
    case 'charge.dispute.updated':
      await handleDisputeOpened(event.data.object as Stripe.Dispute, idempotencyKey);
      break;

    case 'charge.dispute.closed':
      await handleDisputeClosed(event.data.object as Stripe.Dispute, idempotencyKey);
      break;

    // Sprint B: Out-of-band refund sync (refunded directly from Stripe Dashboard)
    case 'charge.refunded':
      await handleChargeRefunded(event.data.object as Stripe.Charge, idempotencyKey);
      break;

    // Sprint C: Stripe Connect transfer failure recovery
    case 'transfer.failed':
      await handleTransferFailed(event.data.object as Stripe.Transfer, idempotencyKey);
      break;

    default:
      logger.info(`ℹ️ Unhandled event type: ${event.type}`);
      // Still record it for idempotency
      await recordWebhookEvent(idempotencyKey, event.type, event.id, {});
  }
}

// ============================================================================
// CHECKOUT HANDLERS
// ============================================================================

async function handleCheckoutCompleted(
  checkoutSession: Stripe.Checkout.Session,
  idempotencyKey: string
): Promise<void> {
  const { customer, metadata, payment_intent } = checkoutSession;
  const { type, instructorId, userId, hours, packageType } = metadata || {};

  // ── Wallet credit (Book Later flow) ─────────────────────────────────────────
  // These sessions are created by POST /api/public/bookings/bulk with bookingType="later".
  // Metadata contains type="wallet_credit", userId, instructorId, hours, packageType.
  // We credit the wallet here instead of in payment_intent.succeeded because Checkout
  // Sessions embed the PaymentIntent internally and fire this event on success.
  if (type === 'wallet_credit') {
    if (!userId) {
      logger.error('❌ wallet_credit checkout missing userId in metadata', { sessionId: checkoutSession.id });
      await recordWebhookEvent(idempotencyKey, 'checkout.session.completed', checkoutSession.id, {
        error: 'Missing userId for wallet_credit'
      });
      return;
    }

    const amountPaid = checkoutSession.amount_total ? checkoutSession.amount_total / 100 : 0;
    logger.info(`💰 Wallet credit checkout completed: userId=${userId} amount=${amountPaid}`);

    await prisma.$transaction(async (tx) => {
      await recordWebhookEvent(idempotencyKey, 'checkout.session.completed', checkoutSession.id, {
        type: 'wallet_credit',
        userId,
        amount: amountPaid,
      });

      // Find or create wallet
      let wallet = await tx.clientWallet.findUnique({ where: { userId } });
      if (!wallet) {
        wallet = await tx.clientWallet.create({ data: { userId } });
      }

      // Credit the wallet
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'CREDIT',
          amount: amountPaid,
          description: `Package purchase — ${hours ?? '?'} hours via Stripe Checkout`,
          status: 'CONFIRMED',
        },
      });

      logger.info(`✅ Wallet credited: +$${amountPaid} for userId=${userId}`);
    });

    // Send wallet top-up receipt (non-critical)
    try {
      const { sendWalletTopUpReceipt } = await import('@/lib/services/receipt-email');
      const { getWalletBalance } = await import('@/lib/services/wallet-helpers');
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user?.email) {
        const balanceResult = await getWalletBalance(userId);
        await sendWalletTopUpReceipt({
          clientName: user.name || user.email,
          clientEmail: user.email,
          receiptId: checkoutSession.id,
          paidAt: new Date(),
          amountAdded: amountPaid,
          walletBalanceBefore: balanceResult.balance - amountPaid,
          walletBalanceAfter: balanceResult.balance,
          stripeRef: typeof payment_intent === 'string' ? payment_intent : checkoutSession.id,
          paymentMethod: 'Card',
        });
      }
    } catch (receiptErr) {
      logger.error('Wallet top-up receipt failed (non-critical)', {
        error: receiptErr instanceof Error ? receiptErr.message : String(receiptErr),
      });
    }

    return;
  }

  // ── Instructor subscription checkout ─────────────────────────────────────────
  if (!instructorId || !customer) {
    logger.error('❌ Missing instructorId or customer in checkout session');
    await recordWebhookEvent(idempotencyKey, 'checkout.session.completed', checkoutSession.id, {
      error: 'Missing instructorId or customer'
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    // Record webhook event
    await recordWebhookEvent(idempotencyKey, 'checkout.session.completed', checkoutSession.id, {
      instructorId,
      customerId: customer
    });

    const tier = metadata?.tier;
    const billingCycle = metadata?.billingCycle ?? 'monthly';
    const stripeSubId = checkoutSession.subscription as string | null;

    // Update instructor with Stripe customer ID and — if tier is known — tier/status/stripeSubscriptionId atomically
    await tx.instructor.update({
      where: { id: instructorId },
      data: {
        stripeCustomerId: customer as string,
        ...(tier && stripeSubId && {
          subscriptionTier: tier as any,
          subscriptionStatus: 'ACTIVE',
          stripeSubscriptionId: stripeSubId,
        }),
      } as any
    });

    // Update subscription row: link customer ID and — if tier is known — tier/status/stripeSubscriptionId atomically
    if (tier && stripeSubId) {
      // Find the trial row without a stripeSubscriptionId first (race condition safe)
      const trialRow = await tx.subscription.findFirst({
        where: {
          instructorId,
          stripeSubscriptionId: null,
          status: { in: ['TRIAL', 'ACTIVE'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (trialRow) {
        await tx.subscription.update({
          where: { id: trialRow.id },
          data: {
            tier: tier as any,
            status: 'ACTIVE',
            stripeCustomerId: customer as string,
            stripeSubscriptionId: stripeSubId,
          },
        });
      } else {
        await tx.subscription.updateMany({
          where: { instructorId },
          data: {
            tier: tier as any,
            status: 'ACTIVE',
            stripeCustomerId: customer as string,
            stripeSubscriptionId: stripeSubId,
          },
        });
      }
    } else {
      // No tier in metadata yet — just update customer ID for now
      await tx.subscription.updateMany({
        where: { instructorId },
        data: { stripeCustomerId: customer as string }
      });
    }

    // Audit log
    await logSubscriptionAction({
      subscriptionId: checkoutSession.id,
      instructorId,
      action: AuditAction.SUBSCRIPTION_UPDATED,
      metadata: {
        event: 'checkout_completed',
        customerId: customer,
        tier: tier ?? 'unknown',
        stripeSubscriptionId: checkoutSession.subscription ?? null,
      }
    });
  });

  // ── Stamp metadata onto the Stripe subscription (non-fatal, best-effort) ─────
  // Ensures future webhooks (renewal, upgrade, cancel) have instructorId + tier in metadata.
  const tier = metadata?.tier;
  const billingCycle = metadata?.billingCycle;
  if (checkoutSession.subscription && instructorId && tier) {
    try {
      await stripe.subscriptions.update(checkoutSession.subscription as string, {
        metadata: { instructorId, tier, billingCycle: billingCycle ?? 'monthly' },
      });
      logger.info(`✅ Stamped metadata on subscription ${checkoutSession.subscription}: instructorId=${instructorId} tier=${tier}`);
    } catch (metadataErr) {
      logger.error('Failed to stamp subscription metadata (non-fatal)', {
        error: metadataErr instanceof Error ? metadataErr.message : String(metadataErr),
        subscriptionId: checkoutSession.subscription,
      });
    }
  }

  logger.info(`✅ Checkout completed: Synced customer ${customer} for instructor ${instructorId}`);
}

// ============================================================================
// BOOKING PAYMENT HANDLERS
// ============================================================================

/**
 * Handle wallet/package purchase payment success (book later)
 */
async function handleWalletPaymentSuccess(
  paymentIntent: Stripe.PaymentIntent,
  idempotencyKey: string,
  transactionId?: string,
  walletId?: string
): Promise<void> {
  logger.info(`💰 Processing wallet payment: transactionId=${transactionId}, walletId=${walletId}`);

  let confirmedTransactions: any[] = [];

  await prisma.$transaction(async (tx) => {
    // Record webhook event
    await recordWebhookEvent(idempotencyKey, 'payment_intent.succeeded', paymentIntent.id, {
      transactionId,
      walletId,
      amount: paymentIntent.amount / 100,
      type: 'wallet_purchase'
    });

    // Find wallet transaction(s) to confirm
    let transactions: any[] = [];
    
    if (transactionId) {
      // Specific transaction ID provided
      const transaction = await tx.walletTransaction.findUnique({
        where: { id: transactionId }
      });
      if (transaction) {
        transactions = [transaction];
      }
    } else if (walletId) {
      // Find recent PENDING transactions for this wallet
      transactions = await tx.walletTransaction.findMany({
        where: {
          walletId,
          status: 'PENDING',
          createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } // Last 10 minutes
        }
      });
    }

    if (transactions.length === 0) {
      logger.error('❌ No wallet transactions found to confirm');
      throw new Error('No wallet transactions found');
    }

    // ✅ Validate payment amount matches transaction total (prevents underpayment fraud)
    const expectedCents = Math.round(
      transactions.filter((t: any) => t.type === 'CREDIT').reduce((s: number, t: any) => s + t.amount, 0) * 100
    );
    const receivedCents = paymentIntent.amount_received;
    if (receivedCents !== expectedCents) {
      logger.error('❌ Wallet payment amount mismatch:', { expected: expectedCents, received: receivedCents });
      throw new Error(`Wallet payment amount mismatch: expected ${expectedCents} cents, received ${receivedCents} cents`);
    }

    // ✅ Confirm all PENDING wallet transactions
    for (const transaction of transactions) {
      await tx.walletTransaction.update({
        where: { id: transaction.id },
        data: { status: 'CONFIRMED' }
      });
      
      logger.info(`✅ Wallet transaction confirmed: ${transaction.id} (${transaction.type} ${transaction.amount})`);
    }

    // Get wallet details for logging
    const wallet = await tx.clientWallet.findUnique({
      where: { id: transactions[0].walletId },
      include: { user: true }
    });

    logger.info(`✅ Wallet payment processed: ${wallet?.user.email} - ${transactions.length} transaction(s) confirmed`);
    confirmedTransactions = transactions;
  });

  // Send wallet top-up receipt (non-critical)
  try {
    const { logFinancialAction, AuditAction, ActorRole } = await import('@/lib/services/auditLogger');
    const confirmedTx = confirmedTransactions[0];
    if (confirmedTx) {
      await logFinancialAction({
        transactionId: confirmedTx.id,
        action: AuditAction.WALLET_PAYMENT_SUCCEEDED,
        actorId: 'SYSTEM',
        actorRole: ActorRole.SYSTEM,
        amount: paymentIntent.amount_received / 100,
        metadata: {
          stripePaymentIntentId: paymentIntent.id,
          walletId: confirmedTx.walletId,
          transactionCount: confirmedTransactions.length,
          amountCents: paymentIntent.amount_received,
        },
      });
    }
  } catch (auditErr) {
    logger.error('AuditLog for wallet payment (non-critical)', {
      error: auditErr instanceof Error ? auditErr.message : String(auditErr),
    });
  }

  try {
    const confirmedTx = confirmedTransactions[0];
    if (confirmedTx) {
      const walletRecord = await prisma.clientWallet.findUnique({
        where: { id: confirmedTx.walletId },
        include: { user: true },
      });
      if (walletRecord?.user?.email) {
        const { getWalletBalance } = await import('@/lib/services/wallet-helpers');
        const amountAdded = confirmedTransactions
          .filter((t: any) => t.type === 'CREDIT')
          .reduce((sum: number, t: any) => sum + t.amount, 0);
        const balanceResult = await getWalletBalance(walletRecord.userId);
        const balanceAfter = balanceResult.balance;
        const balanceBefore = balanceAfter - amountAdded;

        // FinancialLedger — record wallet credit (double-entry)
        // Idempotency key: `wallet-credit-${paymentIntentId}` — deterministic
        try {
          const { recordWalletCredit } = await import('@/lib/services/ledger-operations');
          await recordWalletCredit({
            walletTransactionId: confirmedTx.id,
            userId: walletRecord.userId,
            amount: amountAdded,
            stripePaymentIntentId: paymentIntent.id,
            createdBy: 'STRIPE_WEBHOOK',
          });
        } catch (ledgerErr: any) {
          if (!ledgerErr?.message?.includes('idempotency')) {
            logger.error('[FinancialLedger] recordWalletCredit failed (non-critical):', { error: ledgerErr?.message });
          }
        }

        await sendWalletTopUpReceipt({
          clientName: walletRecord.user.name || walletRecord.user.email,
          clientEmail: walletRecord.user.email,
          receiptId: confirmedTx.id,
          paidAt: new Date(),
          amountAdded,
          walletBalanceBefore: balanceBefore,
          walletBalanceAfter: balanceAfter,
          stripeRef: paymentIntent.id,
          paymentMethod: 'Card',
        });
      }
    }
  } catch (receiptErr) {
    logger.error('Wallet top-up receipt email failed', {
      error: receiptErr instanceof Error ? receiptErr.message : String(receiptErr),
    });
  }
}

async function handleBookingPaymentSuccess(
  paymentIntent: Stripe.PaymentIntent,
  idempotencyKey: string
): Promise<void> {
  const { id: paymentIntentId, metadata } = paymentIntent;
  const { bookingId, transactionId, walletId } = metadata;

  // Handle both booking payments AND wallet/package purchases
  if (!bookingId && !transactionId && !walletId) {
    logger.error('❌ No bookingId, transactionId, or walletId in payment intent metadata');
    await recordWebhookEvent(idempotencyKey, 'payment_intent.succeeded', paymentIntent.id, {
      error: 'Missing bookingId, transactionId, or walletId'
    });
    return;
  }

  // ✅ Handle wallet/package purchase (book later)
  if (transactionId || walletId) {
    await handleWalletPaymentSuccess(paymentIntent, idempotencyKey, transactionId, walletId);
    return;
  }

  await prisma.$transaction(async (tx) => {
    // Record webhook event
    await recordWebhookEvent(idempotencyKey, 'payment_intent.succeeded', paymentIntent.id, {
      bookingId,
      amount: paymentIntent.amount / 100
    });

    // Fetch booking to validate
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { client: true }
    });

    if (!booking) {
      logger.error('❌ Booking not found', { bookingId });
      throw new Error(`Booking not found: ${bookingId}`);
    }

    // ── Handle EXPIRED booking — DO NOT revive, issue refund instead ────────────
    // If the booking expired before Stripe confirmed payment, the slot may have been
    // released and taken by another student. Reviving the booking risks a double-booking.
    // Safe policy: issue a full refund via Stripe and flag for admin review.
    if (booking.status === 'EXPIRED') {
      logger.error(`🚨 Delayed payment on expired booking ${bookingId} — issuing automatic refund`);
      
      // Issue automatic full refund via Stripe
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' });
        await stripe.refunds.create({
          payment_intent: paymentIntent.id,
          reason: 'duplicate', // closest Stripe reason code
          metadata: {
            bookingId,
            reason: 'Booking expired before payment confirmed — automatic refund',
          },
        });
        logger.info(`✅ Auto-refund issued for expired booking ${bookingId}`);

        // Alert ops — admin should know a payment hit an expired slot even when refund succeeded
        void sendAlert({
          type: 'RECONCILIATION_ISSUES',
          severity: 'WARNING',
          message: `Delayed payment on expired booking ${bookingId} — auto-refund issued successfully. Student was charged after slot expired. Admin review recommended.`,
          entityId: bookingId,
          metadata: {
            bookingId,
            stripePaymentIntentId: paymentIntent.id,
            outcome: 'auto_refund_succeeded',
          },
        });
      } catch (refundErr) {
        // Refund failed — must flag for manual admin action
        logger.error(`🚨 CRITICAL: Auto-refund FAILED for expired booking ${bookingId}. Manual action required.`, {
          error: refundErr instanceof Error ? refundErr.message : String(refundErr),
        });

        // Alert ops — this requires immediate manual intervention via Stripe Dashboard
        void sendAlert({
          type: 'RECONCILIATION_ISSUES',
          severity: 'CRITICAL',
          message: `Auto-refund FAILED for expired booking ${bookingId}. Student was charged $${(paymentIntent.amount / 100).toFixed(2)} but refund could not be issued. MANUAL REFUND REQUIRED via Stripe Dashboard. PaymentIntent: ${paymentIntent.id}`,
          entityId: bookingId,
          metadata: {
            bookingId,
            stripePaymentIntentId: paymentIntent.id,
            amountCharged: paymentIntent.amount / 100,
            error: refundErr instanceof Error ? refundErr.message : String(refundErr),
            outcome: 'auto_refund_failed',
            action: 'Manual refund required via Stripe Dashboard',
          },
        });
      }

      // Mark booking as requiring admin review regardless of refund success
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'CANCELLED',
          notes: `EXPIRED_PAYMENT: Stripe charged after slot expiry. Auto-refund attempted at ${new Date().toISOString()}. PaymentIntent: ${paymentIntent.id}. Admin review required.`,
        } as any,
      });

      await recordWebhookEvent(idempotencyKey, 'payment_intent.succeeded', paymentIntent.id, {
        bookingId,
        outcome: 'expired_auto_refunded',
        note: 'Booking was EXPIRED when payment arrived — refund issued, booking cancelled',
      });

      // Non-fatal: transaction will complete, booking is cancelled
      return;
    }

    // ── Already confirmed (idempotent replay) ────────────────────────────────
    if (booking.status === 'CONFIRMED' || booking.status === 'COMPLETED') {
      logger.info(`ℹ️ Booking ${bookingId} already ${booking.status} — skipping wallet ops`);
      await recordWebhookEvent(idempotencyKey, 'payment_intent.succeeded', paymentIntent.id, {
        bookingId, note: 'already_confirmed'
      });
      return;
    }

    // ── Strict state machine: only PENDING_PAYMENT → CONFIRMED ───────────────
    if (booking.status !== 'PENDING_PAYMENT') {
      logger.error(`🚨 Webhook rejected: booking ${bookingId} is in status '${booking.status}' — cannot confirm`);
      await recordWebhookEvent(idempotencyKey, 'payment_intent.succeeded', paymentIntent.id, {
        bookingId, error: `Rejected: invalid source status '${booking.status}'`
      });
      return;
    }

    // ✅ Validate payment amount matches what was charged
    // For packages: Stripe charged packageTotalPaid. For single lessons: booking.price.
    const chargedAmount = (booking as any).packageTotalPaid || booking.price;
    const expectedAmount = Math.round(chargedAmount * 100); // Convert to cents
    const receivedAmount = paymentIntent.amount_received;
    
    if (receivedAmount !== expectedAmount) {
      logger.error('❌ Payment amount mismatch:', {
        expected: expectedAmount,
        received: receivedAmount,
        bookingId
      });
      throw new Error(
        `Payment amount mismatch: expected ${expectedAmount} cents, received ${receivedAmount} cents`
      );
    }

    // Get userId from client relation — try multiple fallbacks
    let userId = booking.client?.userId;
    
    if (!userId && booking.clientId) {
      // Direct lookup by clientId (most reliable)
      const client = await tx.client.findUnique({ where: { id: booking.clientId } });
      userId = client?.userId ?? undefined;
    }

    if (!userId && booking.clientPhone) {
      const client = await tx.client.findFirst({
        where: { phone: booking.clientPhone }
      });
      userId = client?.userId ?? undefined;
    }

    if (!userId) {
      logger.warn(`⚠️ Could not resolve userId for booking ${bookingId} — wallet ops skipped`);
    }

    // ✅ P0 FIX #5: Verify payment customer matches instructor
    if (paymentIntent.customer) {
      const instructor = await tx.instructor.findUnique({ 
        where: { id: booking.instructorId },
        select: { id: true, stripeCustomerId: true },
      });
      
      if (instructor?.stripeCustomerId && instructor.stripeCustomerId !== paymentIntent.customer) {
        logger.error('❌ Payment customer mismatch:', {
          instructorId: booking.instructorId,
          instructorStripeCustomerId: instructor.stripeCustomerId,
          paymentCustomerId: paymentIntent.customer
        });
        throw new Error('Payment customer does not match instructor');
      }
    }

    // ✅ All validations passed - Update booking
    await tx.booking.update({
      where: { id: bookingId },
      data: {
        isPaid: true,
        paidAt: new Date(),
        status: 'CONFIRMED',
        paymentCaptured: true,
        paymentCapturedAt: new Date(),
      } as any
    });

    // Update transaction — SETTLED means eligible for payout
    await (tx as any).transaction.updateMany({
      where: { stripePaymentIntentId: paymentIntentId },
      data: {
        status: 'SETTLED',
        processedAt: new Date(),
        stripeChargeId: (paymentIntent as any).charges?.data[0]?.id,
      }
    });

    // ── Wallet: credit full package amount, debit first lesson ──────────────
    // Per financial doctrine (PATH 2: STRIPE BOOKING):
    //   CREDIT wallet = full package amount paid via Stripe (packageTotalPaid)
    //   DEBIT  wallet = first lesson price (booking.price = 1hr × hourlyRate)
    // Remaining balance = credits available for future lessons from this package.
    // For single lessons: just confirm any pending wallet transactions.
    if (userId) {
      let wallet = await tx.clientWallet.findUnique({ where: { userId } });
      if (!wallet) {
        wallet = await tx.clientWallet.create({ data: { userId } });
      }

      const packageTotalPaid = (booking as any).packageTotalPaid as number | null;
      const isPackage = (booking as any).isPackageBooking && (booking as any).packageHours > 1;

      if (isPackage && packageTotalPaid) {
        // CREDIT: full package amount the client paid via Stripe
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'CREDIT',
            amount: packageTotalPaid,
            description: `Package purchase — ${(booking as any).packageHours} hours (Stripe)`,
            status: 'CONFIRMED',
          }
        });

        // DEBIT: first lesson already scheduled (booking.price = 1hr × hourlyRate)
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'DEBIT',
            amount: booking.price,
            description: `First lesson — ${new Date(booking.startTime!).toLocaleDateString('en-AU', { timeZone: DEFAULT_TIMEZONE })} (booking #${bookingId})`,
            status: 'CONFIRMED',
          }
        });

        const remaining = packageTotalPaid - booking.price;
        logger.info(`✅ Package wallet: +${packageTotalPaid} CREDIT / -${booking.price} DEBIT = ${remaining.toFixed(2)} remaining for userId=${userId}`);
      } else {
        // Single lesson — confirm any pending wallet transactions
        await tx.walletTransaction.updateMany({
          where: {
            walletId: wallet.id,
            status: 'PENDING',
            createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) }
          },
          data: { status: 'CONFIRMED' }
        });
      }
    }
  });

  logger.info(`✅ Booking payment processed with validations: ${bookingId}`);

  // ── Audit log: Stripe payment event ──────────────────────────────────────
  // This closes the audit blind spot — Stripe payment events are now in AuditLog
  try {
    const { logFinancialAction, AuditAction, ActorRole } = await import('@/lib/services/auditLogger');
    const txRecord = await prisma.transaction.findFirst({
      where: { stripePaymentIntentId: paymentIntent.id },
      select: { id: true, amount: true },
    });
    await logFinancialAction({
      transactionId: txRecord?.id ?? bookingId,
      action: AuditAction.PAYMENT_SUCCEEDED,
      actorId: 'SYSTEM',
      actorRole: ActorRole.SYSTEM,
      amount: paymentIntent.amount_received / 100,
      metadata: {
        stripePaymentIntentId: paymentIntent.id,
        bookingId,
        amountCents: paymentIntent.amount_received,
      },
    });
  } catch (auditErr) {
    logger.error('AuditLog for payment_succeeded failed (non-critical)', {
      error: auditErr instanceof Error ? auditErr.message : String(auditErr),
    });
  }

  // ── Ledger: record payment collected ─────────────────────────────────────
  // This populates totalCollected + totalReserved so payout balance checks work.
  // Also writes to FinancialLedger (double-entry) for reconciliation/reporting.
  // Non-critical: if either fails, booking is still confirmed. Alert is sent.
  try {
    const ledgerBooking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        price: true,
        platformFee: true,
        instructorPayout: true,
        commissionRate: true,
        instructorId: true,
        client: { select: { userId: true } },
      },
    });
    if (ledgerBooking) {
      const instrPayout = (ledgerBooking as any).instructorPayout
        ?? ledgerBooking.price * (1 - ((ledgerBooking as any).commissionRate ?? 15) / 100);
      const platFee = (ledgerBooking as any).platformFee
        ?? ledgerBooking.price - instrPayout;

      // Existing payout-service ledger (totalCollected/totalReserved)
      await recordPaymentCollected(bookingId, ledgerBooking.price, instrPayout);
      logger.info(`✅ Ledger updated: collected=${ledgerBooking.price} reserved=${instrPayout}`);

      // FinancialLedger — double-entry via ledger-operations
      // Idempotency key: `booking-${bookingId}-payment` — deterministic, safe to retry
      const { recordBookingPayment: recordLedgerPayment } = await import('@/lib/services/ledger-operations');
      const clientUserId = ledgerBooking.client?.userId;
      if (clientUserId) {
        await recordLedgerPayment({
          bookingId,
          userId: clientUserId,
          instructorId: ledgerBooking.instructorId,
          totalAmount: ledgerBooking.price,
          platformFee: platFee,
          instructorPayout: instrPayout,
          createdBy: 'STRIPE_WEBHOOK',
        }).catch((err: Error) => {
          // Duplicate idempotencyKey = already recorded — not an error
          if (!err.message?.includes('idempotency')) {
            logger.error('[FinancialLedger] recordBookingPayment failed (non-critical):', { bookingId, error: err.message });
          }
        });
      }
    }
  } catch (ledgerErr) {
    logger.error('🚨 LEDGER UPDATE FAILED — booking confirmed but ledger not updated:', {
      bookingId,
      error: ledgerErr instanceof Error ? ledgerErr.message : String(ledgerErr),
    });
    // Send structured alert so this is visible in monitoring — never silent
    void sendAlert({
      type: 'RECONCILIATION_ISSUES',
      severity: 'WARNING',
      message: `FinancialLedger write failed for confirmed booking ${bookingId} — reconciliation cron will backfill`,
      entityId: bookingId,
      metadata: {
        bookingId,
        stripePaymentIntentId: paymentIntentId,
        error: ledgerErr instanceof Error ? ledgerErr.message : String(ledgerErr),
        idempotencyKey: `booking-${bookingId}-payment`,
      },
    });
  }

  // Notify instructor of payment received (outside transaction - non-critical)
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        instructor: { select: { id: true, userId: true, name: true, businessName: true, accountType: true, hourlyRate: true } },
        client: true,
      },
    });
    const payChannels = getNotifChannels('PAYMENT_RECEIVED');
    if (payChannels.inApp && booking?.instructor?.userId) {
      await notifyPaymentReceived(
        booking.instructor.userId,
        booking.price,
        booking.client?.name || booking.clientName || 'Client',
        bookingId
      );
    }

    // Send receipt to student
    if (booking?.client?.email) {
      const isPackage = (booking as any).isPackageBooking && (booking as any).packageHours > 1;
      const packageTotalPaid = (booking as any).packageTotalPaid as number | null;
      const durationHours = booking.duration ? booking.duration / 60 : 1;
      const instructor = booking.instructor;

      if (isPackage && packageTotalPaid) {
        const packageHours = (booking as any).packageHours as number;
        const lockedDiscountPct = (booking as any).lockedDiscountPct as number ?? 0;
        const lockedHourlyRate = (booking as any).lockedHourlyRate as number ?? instructor.hourlyRate;
        const subtotalBeforeDiscount = packageHours * lockedHourlyRate;
        const discountAmount = (subtotalBeforeDiscount * lockedDiscountPct) / 100;

        await sendPackagePurchaseReceipt({
          clientName: booking.client.name,
          clientEmail: booking.client.email,
          receiptId: bookingId,
          paidAt: new Date(),
          instructorName: getDisplayName(instructor),
          packageHours,
          hourlyRate: lockedHourlyRate,
          discountPercent: lockedDiscountPct,
          subtotal: subtotalBeforeDiscount,
          discount: discountAmount,
          platformFee: (booking as any).platformFee ?? 0,
          total: packageTotalPaid,
          firstLessonDate: booking.startTime!,
          firstLessonDurationHours: durationHours,
          pickupAddress: booking.pickupAddress ?? undefined,
          walletLoaded: packageTotalPaid,
          firstLessonDebit: booking.price,
          walletBalance: packageTotalPaid - booking.price,
          stripeRef: paymentIntent.id,
          paymentMethod: 'Card',
          bookingId,
        }).catch(e => logger.error('Package receipt email failed', { error: e instanceof Error ? e.message : String(e) }));
      } else {
        await sendSingleLessonReceipt({
          clientName: booking.client.name,
          clientEmail: booking.client.email,
          receiptId: bookingId,
          paidAt: new Date(),
          instructorName: getDisplayName(instructor),
          lessonDate: booking.startTime!,
          durationHours,
          hourlyRate: instructor.hourlyRate,
          lessonCost: booking.price,
          platformFee: (booking as any).platformFee ?? 0,
          total: booking.price + ((booking as any).platformFee ?? 0),
          pickupAddress: booking.pickupAddress ?? undefined,
          stripeRef: paymentIntent.id,
          paymentMethod: 'Card',
          bookingId,
        }).catch(e => logger.error('Single lesson receipt email failed', { error: e instanceof Error ? e.message : String(e) }));
      }
    }

    // SMS booking confirmation — student only (non-critical)
    // Instructor gets in-app notification; SMS confirmation only goes to the student
    try {
      const { smsService } = await import('@/lib/services/sms');
      if (booking?.client?.phone && booking?.instructor && booking.startTime) {
        await smsService.sendBookingConfirmation({
          clientPhone: booking.client.phone,
          clientName: booking.client.name || booking.clientName || 'Student',
          instructorName: getDisplayName(booking.instructor),
          startTime: booking.startTime,
          price: booking.price,
        });
      }
    } catch (smsErr) {
      logger.error('SMS confirmation failed (non-critical)', {
        error: smsErr instanceof Error ? smsErr.message : String(smsErr),
      });
    }
  } catch (notifError) {
    logger.error('Failed to create payment notification', {
      error: notifError instanceof Error ? notifError.message : String(notifError),
    });
  }
}

async function handleBookingPaymentFailed(
  paymentIntent: Stripe.PaymentIntent,
  idempotencyKey: string
): Promise<void> {
  const { metadata } = paymentIntent;
  const { bookingId } = metadata;

  if (!bookingId) {
    await recordWebhookEvent(idempotencyKey, 'payment_intent.payment_failed', paymentIntent.id, {
      error: 'Missing bookingId'
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await recordWebhookEvent(idempotencyKey, 'payment_intent.payment_failed', paymentIntent.id, {
      bookingId
    });

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: 'PENDING',
        paymentCaptured: false,
      } as any
    });
  });

  logger.info(`❌ Booking payment failed: ${bookingId}`);

  // Audit log: Stripe payment failure
  try {
    const { logFinancialAction, AuditAction, ActorRole } = await import('@/lib/services/auditLogger');
    await logFinancialAction({
      transactionId: bookingId,
      action: AuditAction.PAYMENT_FAILED,
      actorId: 'SYSTEM',
      actorRole: ActorRole.SYSTEM,
      amount: paymentIntent.amount / 100,
      metadata: {
        stripePaymentIntentId: paymentIntent.id,
        bookingId,
        failureMessage: paymentIntent.last_payment_error?.message,
        failureCode: paymentIntent.last_payment_error?.code,
      },
    });
  } catch (auditErr) {
    logger.error('AuditLog for payment_failed (non-critical)', {
      error: auditErr instanceof Error ? auditErr.message : String(auditErr),
    });
  }
}

// ============================================================================
// SUBSCRIPTION HANDLERS
// ============================================================================

async function handleSubscriptionUpdate(
  subscription: Stripe.Subscription,
  idempotencyKey: string
): Promise<void> {
  const { metadata, status } = subscription;
  const current_period_end = (subscription as any).current_period_end;
  const trial_end = (subscription as any).trial_end;
  const { instructorId } = metadata;

  // Derive tier from metadata first, then fall back to price ID lookup
  // This handles Billing Portal upgrades where metadata may not be updated
  let tier: string | undefined = metadata.tier || undefined;
  if (!tier && subscription.items?.data?.[0]?.price?.id) {
    const priceId = subscription.items.data[0].price.id;
    // Map price IDs to tiers
    const priceToTier: Record<string, string> = {
      [process.env.STRIPE_BASIC_MONTHLY_PRICE_ID || '']: 'BASIC',
      [process.env.STRIPE_BASIC_ANNUAL_PRICE_ID || '']: 'BASIC',
      [process.env.STRIPE_PRO_MONTHLY_PRICE_ID || '']: 'PRO',
      [process.env.STRIPE_PRO_ANNUAL_PRICE_ID || '']: 'PRO',
      [process.env.STRIPE_STUDIO_MONTHLY_PRICE_ID || '']: 'STUDIO',
      [process.env.STRIPE_STUDIO_ANNUAL_PRICE_ID || '']: 'STUDIO',
      [process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID || '']: 'BUSINESS',
      [process.env.STRIPE_BUSINESS_ANNUAL_PRICE_ID || '']: 'BUSINESS',
    };
    tier = priceToTier[priceId] || undefined;
    if (tier) {
      logger.info(`ℹ️ Derived tier '${tier}' from price ID ${priceId} (metadata was missing)`);
    }
  }

  if (!instructorId || !tier) {
    logger.error('❌ Missing metadata in subscription', { subscriptionId: subscription.id });
    await recordWebhookEvent(idempotencyKey, 'subscription.updated', subscription.id, {
      error: 'Missing instructorId or tier'
    });
    return;
  }

  const plan = SUBSCRIPTION_PLANS[tier as keyof typeof SUBSCRIPTION_PLANS];
  if (!plan) {
    logger.error('❌ Invalid tier', { tier });
    return;
  }

  // Verify instructor exists before proceeding
  const instructorExists = await prisma.instructor.findUnique({
    where: { id: instructorId },
    select: { id: true },
  });
  if (!instructorExists) {
    logger.error(`❌ Instructor not found in DB: "${instructorId}" — subscription ${subscription.id} NOT synced.`);
    logger.error('   Check Stripe subscription metadata for typos in instructorId.');
    await recordWebhookEvent(idempotencyKey, 'subscription.updated', subscription.id, {
      error: `Instructor not found: ${instructorId}`,
      subscriptionId: subscription.id,
    });
    return;
  }

  // Normalize Stripe status to our DB enum
  // Stripe uses "canceled" (US spelling), our DB uses "CANCELLED" (double-L)
  const normalizeStatus = (s: string): string => {
    const upper = s.toUpperCase();
    return upper === 'CANCELED' ? 'CANCELLED' : upper;
  };

  await prisma.$transaction(async (tx) => {
    // Record webhook event
    await recordWebhookEvent(idempotencyKey, 'subscription.updated', subscription.id, {
      instructorId,
      tier,
      status
    });

    // Update instructor
    await tx.instructor.update({
      where: { id: instructorId },
      data: {
        subscriptionTier: tier as any,
        subscriptionStatus: normalizeStatus(status) as any,
        trialEndsAt: trial_end ? new Date(trial_end * 1000) : null,
        stripeCustomerId: subscription.customer as string,
        stripeSubscriptionId: subscription.id,
      } as any
    });

    // Update or create subscription record
    // Priority: find by stripeSubscriptionId first (renewal/update).
    // If not found, find the most-recent non-stripe trial row for this instructor
    // (race condition: customer.subscription.created fires before checkout.session.completed
    // stamps the stripeSubscriptionId — so we link it rather than create a duplicate).
    const existingSubscription = await tx.subscription.findFirst({
      where: { stripeSubscriptionId: subscription.id }
    });

    if (existingSubscription) {
      await tx.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          tier: tier as any,
          status: normalizeStatus(status) as any,
          monthlyAmount: subscription.items.data[0].price.unit_amount! / 100,
          billingCycle: subscription.items.data[0].price.recurring?.interval === 'year' ? 'annual' : 'monthly',
          currentPeriodEnd: new Date(current_period_end * 1000),
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: subscription.customer as string,
        }
      });
    } else {
      // Look for an existing trial subscription record without a stripeSubscriptionId
      const trialRow = await tx.subscription.findFirst({
        where: {
          instructorId,
          stripeSubscriptionId: null,
          status: { in: ['TRIAL', 'ACTIVE'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (trialRow) {
        // Link the Stripe subscription to the existing trial row — prevents duplicate rows
        logger.info(`🔗 Linking Stripe subscription ${subscription.id} to existing trial row ${trialRow.id} for instructor ${instructorId}`);
        await tx.subscription.update({
          where: { id: trialRow.id },
          data: {
            tier: tier as any,
            status: normalizeStatus(status) as any,
            monthlyAmount: subscription.items.data[0].price.unit_amount! / 100,
            billingCycle: subscription.items.data[0].price.recurring?.interval === 'year' ? 'annual' : 'monthly',
            currentPeriodEnd: new Date(current_period_end * 1000),
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: subscription.customer as string,
          }
        });
      } else {
        const current_period_start = (subscription as any).current_period_start;
        await tx.subscription.create({
          data: {
            instructorId,
            tier: tier as any,
            status: normalizeStatus(status) as any,
            monthlyAmount: subscription.items.data[0].price.unit_amount! / 100,
            billingCycle: subscription.items.data[0].price.recurring?.interval === 'year' ? 'annual' : 'monthly',
            currentPeriodStart: new Date(current_period_start * 1000),
            currentPeriodEnd: new Date(current_period_end * 1000),
            stripeCustomerId: subscription.customer as string,
            stripeSubscriptionId: subscription.id,
          }
        });
      }
    }

    // Audit log
    await logSubscriptionAction({
      subscriptionId: subscription.id,
      instructorId,
      action: AuditAction.SUBSCRIPTION_UPDATED,
      metadata: {
        tier,
        status,
        commissionRate: plan.commissionRate,
        amount: subscription.items.data[0].price.unit_amount! / 100
      }
    });
  });

  // Send email if active
  if (status === 'active') {
    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
      select: { id: true, name: true, user: { select: { email: true, name: true } } },
    });

    if (instructor?.user) {
      await emailService.sendGenericEmail({
        from: 'DriveBook Payments <payments@drivebook.com.au>',
        to: instructor.user.email,
        subject: `${plan.name} subscription activated — DriveBook`,
        html: `
          <h2>Your ${plan.name} subscription is now active!</h2>
          <p>Thank you for subscribing to DriveBook.</p>
          <p><strong>Plan Details:</strong></p>
          <ul>
            <li>Tier: ${plan.name}</li>
            <li>Commission rate: ${plan.commissionRate}%</li>
            <li>Monthly price: $${plan.monthlyPrice}/month</li>
          </ul>
          <p>Your commission rate applies to all new bookings from today.</p>
        `
      });
    }
  }

  logger.info(`✅ Subscription updated: ${subscription.id} (${tier}, ${status})`);
}

async function handleSubscriptionCancelled(
  subscription: Stripe.Subscription,
  idempotencyKey: string
): Promise<void> {
  const { metadata } = subscription;
  const { instructorId } = metadata;

  if (!instructorId) {
    await recordWebhookEvent(idempotencyKey, 'subscription.cancelled', subscription.id, {
      error: 'Missing instructorId'
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await recordWebhookEvent(idempotencyKey, 'subscription.cancelled', subscription.id, {
      instructorId
    });

    await tx.instructor.update({
      where: { id: instructorId },
      data: { subscriptionStatus: 'CANCELLED' as any }
    });

    await tx.subscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: 'CANCELLED',
      }
    });

    await logSubscriptionAction({
      subscriptionId: subscription.id,
      instructorId,
      action: AuditAction.SUBSCRIPTION_CANCELLED
    });
  });

  logger.info(`✅ Subscription cancelled: ${subscription.id}`);
}

async function handleTrialEnding(
  subscription: Stripe.Subscription,
  idempotencyKey: string
): Promise<void> {
  const { metadata } = subscription;
  const trial_end = (subscription as any).trial_end;
  const { instructorId } = metadata;

  if (!instructorId) return;

  await recordWebhookEvent(idempotencyKey, 'subscription.trial_ending', subscription.id, {
    instructorId,
    trialEnd: trial_end
  });

  const instructor = await prisma.instructor.findUnique({
    where: { id: instructorId },
    select: { id: true, name: true, user: { select: { email: true, name: true } } },
  });

  if (instructor?.user && trial_end) {
    const daysLeft = Math.ceil((new Date(trial_end * 1000).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    await emailService.sendGenericEmail({
      from: 'DriveBook Payments <payments@drivebook.com.au>',
      to: instructor.user.email,
      subject: `Your trial ends in ${daysLeft} days`,
      html: `
        <h2>Your free trial is ending soon</h2>
        <p>Your trial will end on ${new Date(trial_end * 1000).toLocaleDateString('en-AU', { timeZone: DEFAULT_TIMEZONE })}.</p>
        <p>To continue using DriveBook, your payment method will be charged automatically.</p>
      `
    });

    await logSubscriptionAction({
      subscriptionId: subscription.id,
      instructorId,
      action: AuditAction.SUBSCRIPTION_TRIAL_ENDING,
      metadata: { daysLeft }
    });
  }

  logger.info(`✅ Trial ending notification sent: ${subscription.id}`);
}

async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
  idempotencyKey: string
): Promise<void> {
  const subscription = (invoice as any).subscription;

  if (!subscription) {
    await recordWebhookEvent(idempotencyKey, 'invoice.payment_succeeded', invoice.id, {});
    return;
  }

  await prisma.$transaction(async (tx) => {
    await recordWebhookEvent(idempotencyKey, 'invoice.payment_succeeded', invoice.id, {
      subscriptionId: subscription
    });

    // Update subscription record
    await tx.subscription.updateMany({
      where: { stripeSubscriptionId: subscription as string },
      data: { status: 'ACTIVE' }
    });

    // ── Also update instructor.subscriptionStatus ─────────────────────────
    // This is the critical step that was missing — without it, the instructor
    // stays stuck at TRIAL after their first real payment or monthly renewal.
    const subscriptionRecord = await tx.subscription.findFirst({
      where: { stripeSubscriptionId: subscription as string },
      select: { instructorId: true }
    });

    if (subscriptionRecord?.instructorId) {
      await tx.instructor.update({
        where: { id: subscriptionRecord.instructorId },
        data: {
          subscriptionStatus: 'ACTIVE' as any,
          trialEndsAt: null, // Clear trial end date — they're now a paying customer
        }
      });
      logger.info(`✅ Instructor ${subscriptionRecord.instructorId} status → ACTIVE (invoice paid)`);
    }
  });

  logger.info(`✅ Invoice payment succeeded: ${invoice.id}`);
}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  idempotencyKey: string
): Promise<void> {
  const subscription = (invoice as any).subscription;

  if (!subscription) {
    await recordWebhookEvent(idempotencyKey, 'invoice.payment_failed', invoice.id, {});
    return;
  }

  await prisma.$transaction(async (tx) => {
    await recordWebhookEvent(idempotencyKey, 'invoice.payment_failed', invoice.id, {
      subscriptionId: subscription
    });

    await tx.subscription.updateMany({
      where: { stripeSubscriptionId: subscription as string },
      data: { status: 'PAST_DUE' }
    });

    // Find instructor via subscription
    const subscriptionRecord = await tx.subscription.findFirst({
      where: { stripeSubscriptionId: subscription as string }
    });

    if (subscriptionRecord) {
      await tx.instructor.update({
        where: { id: subscriptionRecord.instructorId },
        data: { subscriptionStatus: 'PAST_DUE' as any }
      });
    }
  });

  // Send payment failed email
  const subscriptionRecord = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription as string },
    include: { 
      instructor: {
        include: { user: true }
      }
    }
  });

  if (subscriptionRecord?.instructor?.user) {
    await emailService.sendGenericEmail({
      from: 'DriveBook Payments <payments@drivebook.com.au>',
      to: subscriptionRecord.instructor.user.email,
      subject: 'Payment Failed',
      html: `
        <h2>Payment Failed</h2>
        <p>We were unable to process your payment.</p>
        <p>Please update your payment method to continue using DriveBook.</p>
      `
    });
  }

  logger.info(`❌ Invoice payment failed: ${invoice.id}`);
}

// ============================================================================
// SPRINT A — DISPUTE / CHARGEBACK HANDLING
// ============================================================================

/**
 * charge.dispute.created / charge.dispute.updated
 *
 * Actions:
 *  1. Create LedgerEntry(DISPUTE_OPENED) — marks the disputed amount as at-risk
 *  2. Freeze payout eligibility for this instructor (disputeHold flag)
 *  3. Create admin alert + audit log
 *
 * We handle both created and updated with the same handler because Stripe can
 * fire updated before created in rare retry scenarios.
 */
async function handleDisputeOpened(
  dispute: Stripe.Dispute,
  idempotencyKey: string,
): Promise<void> {
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;
  const amount = dispute.amount / 100;
  const reason = dispute.reason;
  const status = dispute.status;

  // Resolve booking from the charge
  const booking = await prisma.booking.findFirst({
    where: { paymentIntentId: { not: null } },
    select: { id: true, instructorId: true, price: true, clientName: true },
  });

  // Try to resolve via charge → payment intent → booking
  let bookingId: string | null = null;
  let instructorId: string | null = null;
  try {
    const charge = await stripe.charges.retrieve(chargeId);
    const piId = typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id;
    if (piId) {
      const pi = await stripe.paymentIntents.retrieve(piId);
      bookingId = pi.metadata?.bookingId ?? null;
      if (bookingId) {
        const b = await prisma.booking.findUnique({
          where: { id: bookingId },
          select: { instructorId: true, clientName: true },
        });
        instructorId = b?.instructorId ?? null;
      }
    }
  } catch (lookupErr) {
    logger.error('[DISPUTE] charge lookup failed (non-critical)', {
      error: lookupErr instanceof Error ? lookupErr.message : String(lookupErr),
    });
  }

  await recordWebhookEvent(idempotencyKey, 'charge.dispute.created', dispute.id, {
    chargeId,
    bookingId,
    instructorId,
    amount,
    reason,
    status,
  });

  // Persist StripeDispute record — gives admin a dedicated dispute queue
  try {
    await prisma.stripeDispute.upsert({
      where: { stripeDisputeId: dispute.id },
      update: { status, payoutFrozen: !!instructorId },
      create: {
        stripeDisputeId: dispute.id,
        stripeChargeId: chargeId,
        bookingId,
        instructorId,
        amount,
        reason,
        status,
        payoutFrozen: !!instructorId,
      },
    });
  } catch (dbErr) {
    logger.error('[DISPUTE] StripeDispute upsert failed (non-critical)', {
      error: dbErr instanceof Error ? dbErr.message : String(dbErr),
    });
  }

  // Append ledger entry — amount at risk
  await appendLedgerEntry({
    type: 'DISPUTE_OPENED',
    amount: -amount, // negative = platform liability
    referenceId: bookingId ?? dispute.id,
    referenceType: 'BOOKING',
    instructorId: instructorId ?? undefined,
    description: `Stripe dispute ${dispute.id} — ${reason} — $${amount.toFixed(2)} at risk`,
    metadata: {
      stripeDisputeId: dispute.id,
      chargeId,
      reason,
      status,
      bookingId,
    },
  });

  // Freeze payout eligibility for this instructor
  if (instructorId) {
    try {
      await prisma.instructor.update({
        where: { id: instructorId },
        data: { payoutHold: true, payoutHoldReason: `Stripe dispute ${dispute.id} opened` } as any,
      });
    } catch (holdErr) {
      logger.error('[DISPUTE] Could not set payoutHold (field may not exist)', {
        error: holdErr instanceof Error ? holdErr.message : String(holdErr),
      });
    }
  }

  // Audit log
  try {
    await prisma.auditLog.create({
      data: {
        action: 'DISPUTE_OPENED',
        actorId: 'STRIPE',
        actorRole: 'SYSTEM',
        targetType: 'BOOKING',
        targetId: bookingId ?? dispute.id,
        success: true,
        metadata: { stripeDisputeId: dispute.id, amount, reason, chargeId, instructorId },
      },
    });
  } catch (auditErr) {
    logger.error('[DISPUTE] Audit log failed (non-critical)', {
      error: auditErr instanceof Error ? auditErr.message : String(auditErr),
    });
  }

  // Alert operations
  void sendAlert({
    type: 'DISPUTE_OPENED',
    severity: 'CRITICAL',
    message: `Chargeback filed: $${amount.toFixed(2)} — reason: ${reason}. Instructor payout frozen.`,
    entityId: dispute.id,
    metadata: {
      stripeDisputeId: dispute.id,
      chargeId,
      bookingId,
      instructorId,
      amount,
      reason,
      status,
    },
  });

  logger.info(`🚨 Dispute opened: ${dispute.id} — $${amount.toFixed(2)} — ${reason}`);
}

/**
 * charge.dispute.closed
 *
 * Stripe fires this when the bank makes a final decision.
 * status = 'won'  → platform keeps the money — release the payout hold
 * status = 'lost' → chargeback confirmed — create ADJUSTMENT to recover from instructor's
 *                   next payout (same mechanism as post-payout refunds)
 */
async function handleDisputeClosed(
  dispute: Stripe.Dispute,
  idempotencyKey: string,
): Promise<void> {
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;
  const amount = dispute.amount / 100;
  const status = dispute.status; // 'won' | 'lost' | 'needs_response' etc

  // Resolve bookingId + instructorId the same way as handleDisputeOpened
  let bookingId: string | null = null;
  let instructorId: string | null = null;
  try {
    const charge = await stripe.charges.retrieve(chargeId);
    const piId = typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id;
    if (piId) {
      const pi = await stripe.paymentIntents.retrieve(piId);
      bookingId = pi.metadata?.bookingId ?? null;
      if (bookingId) {
        const b = await prisma.booking.findUnique({
          where: { id: bookingId },
          select: { instructorId: true },
        });
        instructorId = b?.instructorId ?? null;
      }
    }
  } catch (lookupErr) {
    logger.error('[DISPUTE CLOSED] charge lookup failed', {
      error: lookupErr instanceof Error ? lookupErr.message : String(lookupErr),
    });
  }

  await recordWebhookEvent(idempotencyKey, 'charge.dispute.closed', dispute.id, {
    chargeId, bookingId, instructorId, amount, status,
  });

  if (status === 'won') {
    // Dispute resolved in our favour — reverse the DISPUTE_OPENED ledger entry
    await appendLedgerEntry({
      type: 'DISPUTE_WON',
      amount: amount, // positive = risk removed
      referenceId: bookingId ?? dispute.id,
      referenceType: 'BOOKING',
      instructorId: instructorId ?? undefined,
      description: `Dispute ${dispute.id} WON — $${amount.toFixed(2)} liability cleared`,
      metadata: { stripeDisputeId: dispute.id, chargeId, bookingId },
    });

    // Release the payout hold
    if (instructorId) {
      try {
        await prisma.instructor.update({
          where: { id: instructorId },
          data: { payoutHold: false, payoutHoldReason: null } as any,
        });
      } catch { /* field may not exist */ }
    }

    void sendAlert({
      type: 'DISPUTE_OPENED',
      severity: 'WARNING',
      message: `Dispute ${dispute.id} WON — $${amount.toFixed(2)} recovered. Payout hold released.`,
      entityId: dispute.id,
      metadata: { stripeDisputeId: dispute.id, bookingId, instructorId, amount },
    });

    logger.info(`✅ Dispute WON: ${dispute.id} — $${amount.toFixed(2)} recovered`);

  } else if (status === 'lost') {
    // Chargeback confirmed — platform absorbs the loss
    // Stripe also charges a dispute fee (~$15–$25 AUD); use dispute.balance_transactions
    const stripeFee = dispute.balance_transactions?.reduce(
      (sum, bt) => sum + Math.abs(bt.fee) / 100, 0
    ) ?? 0;
    const totalLoss = amount + stripeFee;

    await appendLedgerEntry({
      type: 'DISPUTE_LOST',
      amount: -totalLoss, // confirmed outflow
      referenceId: bookingId ?? dispute.id,
      referenceType: 'BOOKING',
      instructorId: instructorId ?? undefined,
      description: `Dispute ${dispute.id} LOST — $${amount.toFixed(2)} + $${stripeFee.toFixed(2)} fee`,
      metadata: { stripeDisputeId: dispute.id, chargeId, bookingId, amount, stripeFee, totalLoss },
    });

    // If the instructor was already paid out, create an ADJUSTMENT to recover from next payout
    if (instructorId && bookingId) {
      try {
        const tx = await prisma.transaction.findFirst({
          where: { bookingId, status: 'SETTLED' },
          select: { instructorPayout: true },
        });
        if (tx?.instructorPayout) {
          await appendLedgerEntry({
            type: 'ADJUSTMENT',
            amount: -tx.instructorPayout,
            referenceId: bookingId,
            referenceType: 'ADJUSTMENT',
            instructorId,
            description: `Dispute ${dispute.id} LOST — recovering instructor payout from future earnings`,
            metadata: { stripeDisputeId: dispute.id, postPayout: true },
          });
        }
      } catch (adjErr) {
        logger.error('[DISPUTE LOST] Could not create recovery adjustment', {
          error: adjErr instanceof Error ? adjErr.message : String(adjErr),
        });
      }
    }

    void sendAlert({
      type: 'DISPUTE_LOST',
      severity: 'CRITICAL',
      message: `Dispute ${dispute.id} LOST — $${totalLoss.toFixed(2)} cash loss (inc. $${stripeFee.toFixed(2)} Stripe fee). Recovery adjustment created.`,
      entityId: dispute.id,
      metadata: { stripeDisputeId: dispute.id, bookingId, instructorId, amount, stripeFee, totalLoss },
    });

    logger.info(`🚨 Dispute LOST: ${dispute.id} — $${totalLoss.toFixed(2)} total loss`);
  }

  // Always audit log the close
  try {
    await prisma.auditLog.create({
      data: {
        action: 'DISPUTE_CLOSED',
        actorId: 'STRIPE',
        actorRole: 'SYSTEM',
        targetType: 'BOOKING',
        targetId: bookingId ?? dispute.id,
        success: true,
        metadata: { stripeDisputeId: dispute.id, outcome: status, amount, chargeId },
      },
    });
  } catch (auditErr) {
    logger.error('[DISPUTE CLOSED] Audit log failed', {
      error: auditErr instanceof Error ? auditErr.message : String(auditErr),
    });
  }

  // Update the StripeDispute record with the outcome
  try {
    await prisma.stripeDispute.updateMany({
      where: { stripeDisputeId: dispute.id },
      data: {
        status,
        resolvedAt: new Date(),
        payoutFrozen: false,
        adjustmentCreated: status === 'lost' && !!instructorId && !!bookingId,
      },
    });
  } catch (dbErr) {
    logger.error('[DISPUTE CLOSED] StripeDispute update failed (non-critical)', {
      error: dbErr instanceof Error ? dbErr.message : String(dbErr),
    });
  }
}

// ============================================================================
// SPRINT B — OUT-OF-BAND REFUND SYNC
// ============================================================================

/**
 * charge.refunded
 *
 * Fires when a refund is issued — either via the DriveBook refund route (already
 * handled) or directly from the Stripe Dashboard (previously invisible to the DB).
 *
 * We use the idempotency key to skip refunds already processed through the app.
 * For new out-of-band refunds we:
 *  1. Create LedgerEntry(REFUND_SYNCED)
 *  2. Update the booking status to CANCELLED if it was CONFIRMED
 *  3. Update the Transaction to REFUNDED
 *  4. Notify admin
 */
async function handleChargeRefunded(
  charge: Stripe.Charge,
  idempotencyKey: string,
): Promise<void> {
  const chargeId = charge.id;
  const piId = typeof charge.payment_intent === 'string'
    ? charge.payment_intent
    : charge.payment_intent?.id;

  if (!piId) {
    await recordWebhookEvent(idempotencyKey, 'charge.refunded', chargeId, {
      note: 'No payment_intent on charge — skipped',
    });
    return;
  }

  // Total refunded amount across all refunds on this charge
  const refundedAmount = charge.amount_refunded / 100;
  const isFullRefund = charge.refunded; // true when fully refunded

  // Resolve booking
  let bookingId: string | null = null;
  try {
    const pi = await stripe.paymentIntents.retrieve(piId);
    bookingId = pi.metadata?.bookingId ?? null;
  } catch (lookupErr) {
    logger.error('[REFUND SYNC] PI lookup failed', {
      error: lookupErr instanceof Error ? lookupErr.message : String(lookupErr),
    });
  }

  if (!bookingId) {
    // Wallet top-up refund or subscription — not a booking, still record it
    await recordWebhookEvent(idempotencyKey, 'charge.refunded', chargeId, {
      note: 'No bookingId in PI metadata — non-booking refund',
      piId,
      refundedAmount,
    });
    return;
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, status: true, instructorId: true, price: true, instructorPayout: true },
  });

  if (!booking) {
    await recordWebhookEvent(idempotencyKey, 'charge.refunded', chargeId, {
      note: 'Booking not found',
      bookingId,
    });
    return;
  }

  await recordWebhookEvent(idempotencyKey, 'charge.refunded', chargeId, {
    bookingId,
    piId,
    refundedAmount,
    isFullRefund,
    bookingStatus: booking.status,
  });

  // Check if this refund was already processed through the app's refund route
  // (which creates a REFUND_ISSUED ledger entry). If so, skip — avoid double ledger.
  const existingLedger = await prisma.ledgerEntry.findFirst({
    where: { type: 'REFUND_ISSUED', referenceId: bookingId },
  });
  if (existingLedger) {
    logger.info(`ℹ️ [REFUND SYNC] Booking ${bookingId} already has REFUND_ISSUED entry — skipping duplicate`);
    return;
  }

  // Out-of-band refund — sync it
  await appendLedgerEntry({
    type: 'REFUND_SYNCED',
    amount: -refundedAmount,
    referenceId: bookingId,
    referenceType: 'BOOKING',
    instructorId: booking.instructorId ?? undefined,
    description: `Out-of-band refund from Stripe Dashboard — $${refundedAmount.toFixed(2)} on charge ${chargeId}`,
    metadata: { stripeChargeId: chargeId, piId, refundedAmount, isFullRefund },
  });

  await incrementLedger({ totalRefunded: refundedAmount });

  // Update booking status if it was CONFIRMED
  if (isFullRefund && (booking.status === 'CONFIRMED' || booking.status === 'PENDING_PAYMENT')) {
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED' } as any,
    });
  }

  // Update transaction record
  await prisma.transaction.updateMany({
    where: { bookingId, status: 'SETTLED' },
    data: { status: 'REFUNDED', processedAt: new Date() },
  });

  // Audit log
  try {
    await prisma.auditLog.create({
      data: {
        action: 'REFUND_SYNCED',
        actorId: 'STRIPE',
        actorRole: 'SYSTEM',
        targetType: 'BOOKING',
        targetId: bookingId,
        success: true,
        metadata: { stripeChargeId: chargeId, piId, refundedAmount, isFullRefund },
      },
    });
  } catch (auditErr) {
    logger.error('[REFUND SYNC] Audit log failed', {
      error: auditErr instanceof Error ? auditErr.message : String(auditErr),
    });
  }

  void sendAlert({
    type: 'REFUND_SYNCED',
    severity: 'WARNING',
    message: `Out-of-band refund detected: $${refundedAmount.toFixed(2)} on booking ${bookingId} (issued directly in Stripe Dashboard)`,
    entityId: bookingId,
    metadata: { stripeChargeId: chargeId, piId, refundedAmount, isFullRefund, bookingStatus: booking.status },
  });

  logger.info(`⚠️ [REFUND SYNC] Out-of-band refund on booking ${bookingId}: $${refundedAmount.toFixed(2)}`);
}

// ============================================================================
// SPRINT C — STRIPE CONNECT TRANSFER FAILURE RECOVERY
// ============================================================================

/**
 * transfer.failed
 *
 * Fires when a Stripe Connect transfer to an instructor's account fails
 * (e.g. debit card transfer rejected, Connect account deactivated, etc.)
 *
 * Actions:
 *  1. Revert the Payout status from PAID → FAILED
 *  2. Reverse the PAYOUT_PAID ledger entry (re-credit the platform)
 *  3. Alert operations + notify instructor
 */
async function handleTransferFailed(
  transfer: Stripe.Transfer,
  idempotencyKey: string,
): Promise<void> {
  const transferId = transfer.id;
  const amount = transfer.amount / 100;
  const instructorId = transfer.metadata?.instructorId ?? null;
  const payoutId = transfer.metadata?.payoutId ?? null;

  await recordWebhookEvent(idempotencyKey, 'transfer.failed', transferId, {
    transferId,
    amount,
    instructorId,
    payoutId,
    failureCode: (transfer as any).failure_code,
    failureMessage: (transfer as any).failure_message,
  });

  // Revert the Payout record back to FAILED
  if (payoutId) {
    const reverted = await prisma.payout.updateMany({
      where: { id: payoutId, status: 'PAID' },
      data: {
        status: 'FAILED',
        failureReason: `Transfer ${transferId} failed: ${(transfer as any).failure_message ?? 'unknown'}`,
        stripeTransferId: null,
      },
    });

    if (reverted.count > 0) {
      // Reverse the PAYOUT_PAID ledger entry — re-credit the platform balance
      await appendLedgerEntry({
        type: 'ADJUSTMENT',
        amount: amount, // positive = re-crediting the platform
        referenceId: payoutId,
        referenceType: 'PAYOUT',
        instructorId: instructorId ?? undefined,
        description: `Transfer ${transferId} FAILED — reversing PAYOUT_PAID for payout ${payoutId}`,
        metadata: {
          stripeTransferId: transferId,
          payoutId,
          failureCode: (transfer as any).failure_code,
          failureMessage: (transfer as any).failure_message,
        },
      });

      await incrementLedger({
        totalPaidOut: -amount,  // reverse the payout
        totalReserved: amount,  // return to reserved — still owed to instructor
      });

      logger.info(`🔄 [TRANSFER FAILED] Payout ${payoutId} reverted to FAILED — $${amount.toFixed(2)} re-credited to platform`);
    }
  }

  // Audit log
  try {
    await prisma.auditLog.create({
      data: {
        action: 'TRANSFER_FAILED',
        actorId: 'STRIPE',
        actorRole: 'SYSTEM',
        targetType: 'PAYOUT',
        targetId: payoutId ?? transferId,
        success: false,
        errorMessage: (transfer as any).failure_message ?? 'Transfer failed',
        metadata: {
          stripeTransferId: transferId,
          payoutId,
          instructorId,
          amount,
          failureCode: (transfer as any).failure_code,
        },
      },
    });
  } catch (auditErr) {
    logger.error('[TRANSFER FAILED] Audit log failed', {
      error: auditErr instanceof Error ? auditErr.message : String(auditErr),
    });
  }

  // Alert operations — this needs immediate human action
  void sendAlert({
    type: 'TRANSFER_FAILED',
    severity: 'CRITICAL',
    message: `Stripe Connect transfer FAILED: $${amount.toFixed(2)} to instructor ${instructorId ?? 'unknown'}. Payout ${payoutId ?? transferId} reverted to FAILED. Retry required.`,
    entityId: payoutId ?? transferId,
    metadata: {
      stripeTransferId: transferId,
      payoutId,
      instructorId,
      amount,
      failureCode: (transfer as any).failure_code,
      failureMessage: (transfer as any).failure_message,
    },
  });

  // Notify the instructor their payout failed
  if (instructorId) {
    try {
      const instructor = await prisma.instructor.findUnique({
        where: { id: instructorId },
        select: { phone: true, userId: true },
      });
      if (instructor?.phone) {
        const { smsService } = await import('@/lib/services/sms');
        await smsService.sendSMS({
          to: instructor.phone,
          message: `DriveBook: Your payout of $${amount.toFixed(2)} could not be processed. Our team has been alerted and will contact you shortly. Ref: ${payoutId ?? transferId}`,
        });
      }
    } catch (notifErr) {
      logger.error('[TRANSFER FAILED] Instructor notification failed', {
        error: notifErr instanceof Error ? notifErr.message : String(notifErr),
      });
    }
  }

  logger.info(`🚨 [TRANSFER FAILED] Transfer ${transferId} — $${amount.toFixed(2)} — instructor: ${instructorId}`);
}

// ============================================================================

/**
 * Record webhook event for idempotency
 * CRITICAL: This prevents duplicate processing
 */
async function recordWebhookEvent(
  idempotencyKey: string,
  eventType: string,
  stripeEventId: string,
  metadata: any
): Promise<void> {
  await prisma.webhookEvent.create({
    data: {
      idempotencyKey,
      eventType,
      stripeEventId,
      metadata,
      processedAt: new Date()
    }
  });
}

// ============================================================================
// STRIPE CONNECT ACCOUNT HANDLER
// ============================================================================

/**
 * Handle Stripe Connect account.updated
 * Fired when an instructor completes (or updates) their Connect onboarding.
 * We mark payoutMethod as stripe_connect and record the account as active.
 */
async function handleConnectAccountUpdated(
  account: Stripe.Account,
  idempotencyKey: string
): Promise<void> {
  const instructorId = account.metadata?.instructorId;
  if (!instructorId) {
    await recordWebhookEvent(idempotencyKey, 'account.updated', account.id, {
      note: 'No instructorId in metadata — skipped',
    });
    return;
  }

  const chargesEnabled = account.charges_enabled;
  const payoutsEnabled = account.payouts_enabled;
  const detailsSubmitted = account.details_submitted;

  await prisma.instructor.update({
    where: { id: instructorId },
    data: {
      stripeAccountId: account.id,
      // Store Connect onboarding state — used by buildPayout eligibility gate
      chargesEnabled,
      payoutsEnabled,
      // Switch to stripe_connect automatically once onboarding is complete
      ...(chargesEnabled && payoutsEnabled ? { payoutMethod: 'stripe_connect' } : {}),
    } as any,
  });

  await recordWebhookEvent(idempotencyKey, 'account.updated', account.id, {
    instructorId,
    chargesEnabled,
    payoutsEnabled,
    detailsSubmitted,
  });

  logger.info(`✅ Connect account updated: instructor=${instructorId} charges=${chargesEnabled} payouts=${payoutsEnabled}`);
}
