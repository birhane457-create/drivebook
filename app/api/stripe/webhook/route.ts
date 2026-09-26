import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services/email';
import { sendSingleLessonReceipt, sendPackagePurchaseReceipt, sendWalletTopUpReceipt } from '@/lib/services/receipt-email';
import { SUBSCRIPTION_PLANS } from '@/lib/config/subscriptions';
import { logSubscriptionAction, AuditAction } from '@/lib/services/auditLogger';
import { writeAuditLogSafe } from '@/lib/services/audit';
import { webhookRateLimit, checkRateLimitStrict, getRateLimitIdentifier } from '@/lib/ratelimit';
import { notifyPaymentReceived } from '@/lib/services/notifications';
import { getNotifChannels } from '@/lib/config/platform-settings';
import { recordPaymentCollected } from '@/lib/services/payout-service';
import { logger } from '@/lib/logger';
import { appendLedgerEntry, incrementLedger } from '@/lib/services/ledger-service';
import { sendAlert } from '@/lib/services/alert-service';
import { withSerializableRetry } from '@/lib/utils/transaction-retry';
import Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { getDisplayName } from '@/lib/utils/account';
import { DEFAULT_TIMEZONE } from '@/lib/utils/timezone';


export const dynamic = 'force-dynamic';

class DuplicateWebhookEventError extends Error {
  constructor(public readonly idempotencyKey: string) {
    super(`Webhook event already claimed: ${idempotencyKey}`);
    this.name = 'DuplicateWebhookEventError';
  }
}

class ExpiredBookingError extends Error {
  constructor(
    public readonly bookingId: string,
    public readonly paymentIntentId: string
  ) {
    super(`Booking ${bookingId} expired before payment confirmed`);
    this.name = 'ExpiredBookingError';
    
    // Maintains proper stack trace in V8 environments (like Node.js)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ExpiredBookingError);
    }
  }
}



const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
});

/**
 * Serializable transaction config for all financial operations
 * Prevents race conditions on wallet credits, booking payments, refunds
 */
const SERIALIZABLE_TX = {
  isolationLevel: 'Serializable' as const,
  maxWait: 5000,
  timeout: 10000,
};

/**
 * UNIFIED Stripe Webhook Handler
 * 
 * Handles ALL Stripe events:
 * - Booking payments (payment_intent.*)
 * - Subscription events (customer.subscription.*)
 * - Invoice events (invoice.*)
 * 
 * Security Features:
 * âœ… Webhook signature verification (FIRST, before rate limiting)
 * âœ… Idempotency protection (atomic within transaction)
 * âœ… Rate limiting (by event ID, not IP)
 * âœ… Audit logging
 * âœ… Atomic operations with Serializable isolation
 */
export async function POST(req: NextRequest) {
  try {
    // SECURITY: Verify webhook signature FIRST
    // This is cryptographic and cheap â€” do it before any DB operations
    const event = await verifyStripeWebhook(req);

    // SECURITY: Rate limiting by event ID (not IP)
    // Prevents duplicate processing of same Stripe event
    const rateLimitId = `stripe_webhook_${event.id}`;
    const rateLimitResult = await checkRateLimitStrict(webhookRateLimit, rateLimitId);

    if (!rateLimitResult.success) {
      logger.error('ðŸš¨ Webhook rate limit exceeded', { rateLimitId });
      return NextResponse.json(
        { error: 'Too many webhook requests' },
        { status: 429, headers: rateLimitResult.headers }
      );
    }

    // F-10 FIX: Atomic idempotency claim moved INSIDE transaction
    const idempotencyKey = `${event.type}_${event.id}_${event.created}`;

    // The idempotency check now happens atomically within each handler's SERIALIZABLE
    // transaction via recordWebhookEvent(). This prevents the race condition where two
    // concurrent deliveries both passed the pre-check before either recorded the event.
    //
    // recordWebhookEvent() uses WebhookEvent.idempotencyKey @unique constraint.
    // If a concurrent delivery claims the same event, Prisma throws P2002, which
    // recordWebhookEvent catches and converts to DuplicateWebhookEventError.

    // Process event based on type
    try {
      await handleStripeEvent(event, idempotencyKey);
    } catch (handlerErr) {
      if (handlerErr instanceof DuplicateWebhookEventError) {
        logger.info('âœ… Concurrent webhook delivery lost the idempotency race', {
          idempotencyKey,
        });
        return NextResponse.json({ received: true, duplicate: true });
      }

      logger.error(`ðŸš¨ Webhook handler error for ${event.type}`, {
        error: handlerErr instanceof Error ? handlerErr.message : String(handlerErr),
      });
      // Return 500 so Stripe retries delivery for transient errors (DB blips, network issues).
      // Stripe will retry with exponential backoff for up to 3 days.
      // Non-retryable errors (e.g. amount mismatch, invalid state) are logged above and should
      // be investigated via Stripe dashboard event logs.
      return NextResponse.json(
        { error: 'Webhook handler failed â€” will retry', handlerError: true },
        { status: 500 }
      );
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    logger.error('ðŸš¨ Webhook error', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Signature verification failure â€” return 400 (not 500) so Stripe knows it's a bad request
    if (error.message?.includes('signature') || error.message?.includes('Invalid webhook')) {
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 400 }
      );
    }

    // Log security events
    if (error.message?.includes('signature')) {
      await writeAuditLogSafe({
        action:       AuditAction.WEBHOOK_VERIFICATION_FAILED,
        actorId:      'unknown',
        actorRole:    'SYSTEM',
        targetType:   'TRANSACTION',
        targetId:     'unknown',
        ipAddress:    req.headers.get('x-forwarded-for') ?? null,
        success:      false,
        errorMessage: error.message,
      });
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
    logger.error('ðŸš¨ Webhook verification failed', { error: err?.message ?? String(err) });
    throw new Error(`Invalid webhook signature: ${err.message}`);
  }
}

/**
 * Route events to appropriate handlers
 */
async function handleStripeEvent(event: Stripe.Event, idempotencyKey: string): Promise<void> {
  logger.info(`ðŸ“¥ Processing webhook: ${event.type}`);

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
      await handleDisputeOpened(event.data.object as Stripe.Dispute, idempotencyKey);
      break;

    case 'charge.dispute.updated':
      await handleDisputeUpdated(event.data.object as Stripe.Dispute, idempotencyKey);
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
      logger.info(`â„¹ï¸ Unhandled event type: ${event.type}`);
      // Still record it for idempotency
      await recordWebhookEvent(prisma, idempotencyKey, event.type, event.id, {});
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
  const { type, providerId, userId, hours, packageType } = metadata || {};

  // â”€â”€ Wallet credit (Book Later flow) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // These sessions are created by POST /api/public/bookings/bulk with bookingType="later".
  // Metadata contains type="wallet_credit", userId, providerId, hours, packageType.
  // We credit the wallet here instead of in payment_intent.succeeded because Checkout
  // Sessions embed the PaymentIntent internally and fire this event on success.
  if (type === 'wallet_credit') {
    if (!userId) {
      logger.error('âŒ wallet_credit checkout missing userId in metadata', { sessionId: checkoutSession.id });
      await recordWebhookEvent(prisma, idempotencyKey, 'checkout.session.completed', checkoutSession.id, {
        error: 'Missing userId for wallet_credit'
      });
      return;
    }

    // A completed Checkout Session is not sufficient by itself for every payment method.
    // Never credit the wallet unless Stripe reports the session as paid.
    if (checkoutSession.payment_status !== 'paid') {
      logger.warn('âš ï¸ Wallet checkout completed but payment is not settled', {
        sessionId: checkoutSession.id,
        paymentStatus: checkoutSession.payment_status,
        userId,
      });
      throw new Error(`Wallet Checkout Session ${checkoutSession.id} is not paid`);
    }

    const amountPaid = checkoutSession.amount_total ? checkoutSession.amount_total / 100 : 0;
    logger.info(`ðŸ’° Wallet credit checkout completed: userId=${userId} amount=${amountPaid}`);

    // SECURITY: expectedTotal is server-generated metadata. Treat its absence as a
    // validation failure rather than silently accepting an unvalidated amount.
    const expectedTotal = metadata?.expectedTotal ? parseFloat(metadata.expectedTotal) : null;
    if (expectedTotal === null || !Number.isFinite(expectedTotal) || expectedTotal < 0) {
      logger.error('âŒ Wallet credit checkout missing/invalid expectedTotal', {
        sessionId: checkoutSession.id,
        userId,
        expectedTotal: metadata?.expectedTotal,
      });
      throw new Error('Wallet credit checkout missing valid expectedTotal');
    }

    const expectedCents = Math.round(expectedTotal * 100);
    const receivedCents = checkoutSession.amount_total ?? 0;

    if (receivedCents !== expectedCents) {
      logger.error('âŒ Wallet credit amount mismatch', {
        sessionId: checkoutSession.id,
        expected: expectedCents,
        received: receivedCents,
        userId,
      });
      // Do not persist the event as processed. Stripe should retry so the
      // discrepancy remains visible until reconciled.
      throw new Error(`Wallet credit amount mismatch: expected ${expectedCents} cents, received ${receivedCents} cents`);
    }

    logger.info(`âœ… Amount validation passed: ${receivedCents} cents`);

    // â”€â”€ 3DS & Prepaid Card Validation (Book Later fraud protection) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (metadata?.require_3ds_validation === 'true') {
      try {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' });

        const paymentIntentId = typeof payment_intent === 'string' ? payment_intent : checkoutSession.payment_intent;
        if (!paymentIntentId) {
          throw new Error('3DS validation required but Checkout Session has no PaymentIntent');
        }

        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId as string, {
            expand: ['charges.data.payment_method_details', 'payment_method'],
          }) as unknown as Stripe.PaymentIntent & { charges: Stripe.ApiList<Stripe.Charge> };
          const charge = paymentIntent.charges?.data?.[0];
          const paymentMethodId = typeof paymentIntent.payment_method === 'string'
            ? paymentIntent.payment_method
            : paymentIntent.payment_method?.id;

          // Check if card is prepaid
          let isPrepaid = false;
          if (paymentMethodId) {
            const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
            if (paymentMethod.card?.funding === 'prepaid') {
              isPrepaid = true;
            }
          }

          // Check if 3DS was completed or not required by issuer
          const threeDSecure = charge?.payment_method_details?.card?.three_d_secure;
          // If threeDSecure is null/undefined, 3DS was not required by issuer
          // If present, check for successful authentication states
          const is3DSAuthenticated = 
            !threeDSecure || 
            threeDSecure.result === 'authenticated' ||
            threeDSecure.result === 'attempt_acknowledged' ||
            threeDSecure.result === 'exempted';

          // Block prepaid cards or cards where 3DS was attempted and failed
          if (isPrepaid || threeDSecure?.result === 'failed') {
            logger.warn('ðŸš« Payment blocked: prepaid card or 3DS failed', {
              sessionId: checkoutSession.id,
              userId,
              isPrepaid,
              threeDSecureResult: threeDSecure?.result,
            });

            // MM-05-D FIX (corrected): Use Stripe's own idempotency key as the
            // primary duplicate-refund guard. recordWebhookEvent() is written AFTER
            // the refund succeeds so that a transient Stripe failure (network error,
            // timeout) leaves no committed WebhookEvent — the next webhook retry can
            // attempt the Stripe call again and Stripe returns the same refund object
            // via the idempotency key.
            //
            // Invariant 1 (no duplicate refund):
            //   stripe.refunds.create() with a stable idempotencyKey means every
            //   delivery that reaches Stripe results in the same refund object.
            //
            // Invariant 2 (no duplicate processing after success):
            //   recordWebhookEvent() is written only after Stripe confirms the refund.
            //   A subsequent retry sees DuplicateWebhookEventError and returns early.
            //
            // Invariant 3 (failed Stripe call remains retryable):
            //   If stripe.refunds.create() throws, the catch block re-throws so the
            //   outer webhook handler returns a non-200 status → Stripe retries.
            //   No WebhookEvent was committed, so the next retry can attempt again.
            let blockRefund: Awaited<ReturnType<typeof stripe.refunds.create>>;
            try {
              blockRefund = await stripe.refunds.create(
                {
                  payment_intent: paymentIntentId as string,
                  metadata: {
                    drivebookReason: isPrepaid
                      ? 'prepaid_card_not_supported'
                      : 'required_3ds_authentication_failed',
                    drivebookCheckoutSessionId: checkoutSession.id,
                  },
                },
                { idempotencyKey: `checkout-refund-block-${checkoutSession.id}` },
              );
            } catch (refundErr: any) {
              // Stripe call failed — throw so the webhook returns non-200
              // and Stripe will retry. No WebhookEvent committed yet.
              logger.error('[3DS-BLOCK] Stripe refund failed — webhook will be retried', {
                sessionId: checkoutSession.id,
                error: refundErr.message,
              });
              throw refundErr;
            }

            // Refund confirmed — now claim the idempotency key permanently.
            // A duplicate delivery after this point will see DuplicateWebhookEventError
            // and return early without calling Stripe again.
            try {
              await recordWebhookEvent(prisma, idempotencyKey, 'checkout.session.completed', checkoutSession.id, {
                type: 'wallet_credit_blocked',
                userId,
                reason: isPrepaid ? 'prepaid_card_not_supported' : 'required_3ds_authentication_failed',
                stripeRefundId: blockRefund.id,
              });
            } catch (idemErr: any) {
              if (idemErr?.name === 'DuplicateWebhookEventError') {
                // Concurrent delivery already wrote the event — refund already issued.
                // Stripe idempotency key guarantees both deliveries got the same refund.
                logger.info('[3DS-BLOCK] Concurrent delivery — refund already issued, skipping', {
                  sessionId: checkoutSession.id,
                });
                return;
              }
              throw idemErr;
            }

            // Send email
            const customerEmail = metadata?.accountEmail || checkoutSession.customer_email;
            if (customerEmail) {
              const { emailService } = await import('@/lib/services/email');
              await emailService.sendGenericEmail({
                to: customerEmail,
                subject: 'Payment Declined - Card Not Supported',
                html: `
                  <p>Hi there,</p>
                  <p>Your payment of $${amountPaid.toFixed(2)} was declined because:</p>
                  <p><strong>${isPrepaid ? 'Prepaid/gift cards are not accepted.' : 'Your card failed 3D Secure authentication.'}</strong></p>
                  <p><strong>What to do:</strong></p>
                  <ul>
                    <li>Try a different card (personal credit/debit from your bank)</li>
                    <li>Contact us: support@drivebook.com.au</li>
                  </ul>
                  <p>Your payment has been refunded (5-10 business days).</p>
                  <p>Thanks,<br/>DriveBook Team</p>
                `,
              });
            }

            return; // Don't credit wallet
          }

          logger.info('âœ… 3DS validation passed');
      } catch (validationErr) {
        logger.error('ðŸš¨ 3DS validation failed â€” payment NOT credited', {
          sessionId: checkoutSession.id,
          userId,
          error: validationErr instanceof Error ? validationErr.message : String(validationErr),
        });
        void sendAlert({
          type: 'RECONCILIATION_ISSUES',
          severity: 'CRITICAL',
          message: `Wallet payment ${checkoutSession.id} could not complete required 3DS/prepaid validation. No wallet credit was issued. Manual review/retry may be required.`,
          entityId: checkoutSession.id,
          metadata: {
            userId,
            paymentIntentId: typeof payment_intent === 'string' ? payment_intent : null,
            error: validationErr instanceof Error ? validationErr.message : String(validationErr),
          },
        });
        throw validationErr;
      }
    }

    await withSerializableRetry(async () => {
      await prisma.$transaction(async (tx) => {
            await recordWebhookEvent(tx, idempotencyKey, 'checkout.session.completed', checkoutSession.id, {
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
                description: `Package purchase – ${hours ?? '?'} hours via Stripe Checkout`,
                status: 'CONFIRMED',
                // F-12 FIX: Store PaymentIntent ID for explicit correlation
                metadata: {
                  stripePaymentIntentId: typeof payment_intent === 'string' ? payment_intent : payment_intent?.id,
                  stripeCheckoutSessionId: checkoutSession.id,
                  packageType: packageType ?? 'unknown',
                },
              },
            });
      
            logger.info(`âœ… Wallet credited: +$${amountPaid} for userId=${userId}`);
          }, SERIALIZABLE_TX);
    }, { operationName: 'webhook-checkout-session-1' });

    // Send wallet top-up receipt (non-critical)
    try {
      const { sendWalletTopUpReceipt } = await import('@/lib/services/receipt-email');
      const { getWalletBalance } = await import('@/lib/services/wallet-helpers');
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user?.email) {
        const balanceResult = await getWalletBalance(userId);
        await sendWalletTopUpReceipt({
          customerName: user.name || user.email,
          customerEmail: user.email,
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

  // â”€â”€ SaaS booking (Quote-based payment) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // These sessions are created by createCheckoutSession() in saas-payment.ts.
  // Metadata contains type="saas_booking", quoteId, bookingId, businessId, providerId, customerId.
  // Delegates to handleCheckoutComplete() which updates Quoteâ†’PAID + Bookingâ†’CONFIRMED.
  if (type === 'saas_booking') {
    logger.info(`ðŸ’³ SaaS booking checkout completed: sessionId=${checkoutSession.id}`);

    try {
      const { handleCheckoutComplete } = await import('@/lib/services/saas-payment');
      const result = await handleCheckoutComplete(checkoutSession.id);

      logger.info('âœ… SaaS booking payment processed', {
        quoteId: result.quoteId,
        bookingId: result.bookingId,
        amountPaid: result.amountPaid,
        platformFee: result.platformFee,
      });

      // Record webhook event
      await recordWebhookEvent(prisma, idempotencyKey, 'checkout.session.completed', checkoutSession.id, {
        type: 'saas_booking',
        quoteId: result.quoteId,
        bookingId: result.bookingId,
        amountPaid: result.amountPaid,
        platformFee: result.platformFee,
      });
    } catch (err) {
      logger.error('âŒ SaaS booking payment handler failed', {
        sessionId: checkoutSession.id,
        error: err instanceof Error ? err.message : String(err),
      });

      // Record failure for debugging
      await recordWebhookEvent(prisma, idempotencyKey, 'checkout.session.completed', checkoutSession.id, {
        type: 'saas_booking',
        error: err instanceof Error ? err.message : String(err),
      });

      throw err; // Re-throw so Stripe retries
    }

    return;
  }

  // â”€â”€ Instructor subscription checkout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (!providerId || !customer) {
    logger.error('âŒ Missing providerId or customer in checkout session');
    await recordWebhookEvent(prisma, idempotencyKey, 'checkout.session.completed', checkoutSession.id, {
      error: 'Missing providerId or customer'
    });
    return;
  }

  await withSerializableRetry(async () => {
    await prisma.$transaction(async (tx) => {
        // Record webhook event
        await recordWebhookEvent(tx, idempotencyKey, 'checkout.session.completed', checkoutSession.id, {
          providerId,
          customerId: customer
        });
    
        const tier = metadata?.tier;
        const billingCycle = metadata?.billingCycle ?? 'monthly';
        const stripeSubId = checkoutSession.subscription as string | null;
    
        // Update instructor with Stripe customer ID and â€” if tier is known â€” tier/status/stripeSubscriptionId atomically
        await tx.provider.update({
          where: { id: providerId },
          data: {
            stripeCustomerId: customer as string,
            ...(tier && stripeSubId && {
              subscriptionTier: tier as any,
              subscriptionStatus: 'ACTIVE',
              stripeSubscriptionId: stripeSubId,
            }),
          } as any
        });
    
        // Update subscription row: link customer ID and â€” if tier is known â€” tier/status/stripeSubscriptionId atomically
        if (tier && stripeSubId) {
          // F-13 FIX: Atomic conditional update using stripeCustomerId correlation
          // This prevents race condition where multiple webhooks try to claim the same trial row
          const claimResult = await tx.subscription.updateMany({
            where: {
              providerId,
              stripeCustomerId: customer as string,  // F-13: Authoritative correlation
              stripeSubscriptionId: null,            // F-13: Atomic claim condition
              // status filter as additional safety, but stripeSubscriptionId IS NULL is the key invariant
              status: { in: ['TRIAL', 'ACTIVE'] },
            },
            data: {
              tier: tier as any,
              status: 'ACTIVE',
              stripeCustomerId: customer as string,  // Ensure it's set (idempotent)
              stripeSubscriptionId: stripeSubId,     // Atomic claim
            },
          });
    
          if (claimResult.count === 0) {
            // No trial row claimed - check if already linked by another webhook
            const existingSubscription = await tx.subscription.findFirst({
              where: { stripeSubscriptionId: stripeSubId }
            });
    
            if (existingSubscription) {
              // Already linked by concurrent webhook - update it (idempotent)
              logger.info(`Subscription ${stripeSubId} already linked by another webhook - updating existing row`);
              await tx.subscription.update({
                where: { id: existingSubscription.id },
                data: {
                  tier: tier as any,
                  status: 'ACTIVE',
                  stripeCustomerId: customer as string,
                },
              });
            } else {
              // No trial row exists and not yet linked - use broad update as fallback
              // This handles legacy data or edge cases
              logger.warn(`No trial row found for providerId=${providerId} customerId=${customer} - using fallback`);
              await tx.subscription.updateMany({
                where: { providerId },
                data: {
                  tier: tier as any,
                  status: 'ACTIVE',
                  stripeCustomerId: customer as string,
                  stripeSubscriptionId: stripeSubId,
                },
              });
            }
          } else {
            logger.info(`✓ Successfully claimed trial row for subscription ${stripeSubId} (count: ${claimResult.count})`);
          }
        } else {
          // No tier in metadata yet â€” just update customer ID for now
          await tx.subscription.updateMany({
            where: { providerId },
            data: { stripeCustomerId: customer as string }
          });
        }
    
        // AUDIT-01/02 fix (Tier 3): replace logSubscriptionAction (used module-level prisma)
        // with tx.auditLog.create — now actually atomic with the subscription state change.
        await tx.auditLog.create({
          data: {
            action:     AuditAction.SUBSCRIPTION_UPDATED,
            actorId:    providerId,
            actorRole:  'SYSTEM',
            targetType: 'TRANSACTION',
            targetId:   checkoutSession.id,
            ipAddress:  'stripe-webhook',
            userAgent:  'stripe-webhook',
            metadata:   {
              event: 'checkout_completed',
              customerId: typeof customer === 'string' ? customer : customer.id,
              tier: tier ?? 'unknown',
              stripeSubscriptionId: typeof checkoutSession.subscription === 'string' ? checkoutSession.subscription : checkoutSession.subscription?.id ?? null,
            },
            success:    true,
          },
        });
      }, SERIALIZABLE_TX);
  }, { operationName: 'webhook-checkout-session-subscription' });

  // â”€â”€ Stamp metadata onto the Stripe subscription (non-fatal, best-effort) â”€â”€
  // Ensures future webhooks (renewal, upgrade, cancel) have providerId + tier in metadata.
  const tier = metadata?.tier;
  const billingCycle = metadata?.billingCycle;
  if (checkoutSession.subscription && providerId && tier) {
    try {
      await stripe.subscriptions.update(checkoutSession.subscription as string, {
        metadata: { providerId, tier, billingCycle: billingCycle ?? 'monthly' },
      });
      logger.info(`âœ… Stamped metadata on subscription ${checkoutSession.subscription}: providerId=${providerId} tier=${tier}`);
    } catch (metadataErr) {
      logger.error('Failed to stamp subscription metadata (non-fatal)', {
        error: metadataErr instanceof Error ? metadataErr.message : String(metadataErr),
        subscriptionId: checkoutSession.subscription,
      });
    }
  }

  logger.info(`âœ… Checkout completed: Synced customer ${customer} for instructor ${providerId}`);
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
  logger.info(`ðŸ’° Processing wallet payment: transactionId=${transactionId}, walletId=${walletId}`);

  let confirmedTransactions: any[] = [];

  await withSerializableRetry(async () => {
    await prisma.$transaction(async (tx) => {
        // Record webhook event
        await recordWebhookEvent(tx, idempotencyKey, 'payment_intent.succeeded', paymentIntent.id, {
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
          // F-12 FIX: Match by PaymentIntent ID in metadata (explicit correlation)
          // Fallback to time window only if no PaymentIntent ID match found
          const paymentIntentId = paymentIntent.id;
          
          // Try explicit match first
          const explicitMatch = await tx.walletTransaction.findFirst({
            where: {
              walletId,
              status: 'PENDING',
              metadata: {
                path: ['stripePaymentIntentId'],
                equals: paymentIntentId
              }
            }
          });
          
          if (explicitMatch) {
            transactions = [explicitMatch];
          } else {
            // Fallback: Find recent PENDING transactions (legacy behavior)
            // NOTE: This time-window approach is ambiguous if multiple purchases occur
            // within 10 minutes. Explicit PaymentIntent ID matching (above) prevents this.
            transactions = await tx.walletTransaction.findMany({
              where: {
                walletId,
                status: 'PENDING',
                createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) }
              }
            });
          }
        }
    
        if (transactions.length === 0) {
          logger.error('âŒ No wallet transactions found to confirm');
          throw new Error('No wallet transactions found');
        }
    
        // âœ… Validate payment amount matches transaction total (prevents underpayment fraud)
        const expectedCents = Math.round(
          transactions.filter((t: any) => t.type === 'CREDIT').reduce((s: number, t: any) => s + t.amount, 0) * 100
        );
        const receivedCents = paymentIntent.amount_received;
        if (receivedCents !== expectedCents) {
          logger.error('âŒ Wallet payment amount mismatch:', { expected: expectedCents, received: receivedCents });
          throw new Error(`Wallet payment amount mismatch: expected ${expectedCents} cents, received ${receivedCents} cents`);
        }
    
        // âœ… Confirm all PENDING wallet transactions
        for (const transaction of transactions) {
          await tx.walletTransaction.update({
            where: { id: transaction.id },
            data: { status: 'CONFIRMED' }
          });
    
          logger.info(`âœ… Wallet transaction confirmed: ${transaction.id} (${transaction.type} ${transaction.amount})`);
        }
    
        // Get wallet details for logging
        const wallet = await tx.clientWallet.findUnique({
          where: { id: transactions[0].walletId },
          include: { user: true }
        });
    
        logger.info(`âœ… Wallet payment processed: ${wallet?.user.email} - ${transactions.length} transaction(s) confirmed`);
        confirmedTransactions = transactions;
      }, SERIALIZABLE_TX);
  }, { operationName: 'webhook-wallet-payment' });

  // AUDIT-01/02 fix (Tier 4): wallet payment — financial tx already committed above.
  // writeAuditLogSafe documents this as explicitly non-critical (receipt/notification path).
  {
    const confirmedTx = confirmedTransactions[0];
    if (confirmedTx) {
      await writeAuditLogSafe({
        action:     AuditAction.WALLET_PAYMENT_SUCCEEDED,
        actorId:    'SYSTEM',
        actorRole:  'SYSTEM',
        targetType: 'TRANSACTION',
        targetId:   confirmedTx.id,
        metadata:   {
          stripePaymentIntentId: paymentIntent.id,
          walletId: confirmedTx.walletId,
          transactionCount: confirmedTransactions.length,
          amountCents: paymentIntent.amount_received,
        },
      });
    }
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

        // FinancialLedger â€” record wallet credit (double-entry)
        // Idempotency key: `wallet-credit-${paymentIntentId}` â€” deterministic
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
          customerName: walletRecord.user.name || walletRecord.user.email,
          customerEmail: walletRecord.user.email,
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
  const { bookingId, transactionId, walletId, type } = metadata;

  // Wallet Checkout is financially credited by checkout.session.completed.
  // If this PaymentIntent is only the embedded PaymentIntent for that flow and
  // has no DriveBook wallet transaction linkage, do not invent a second credit.
  if (type === 'wallet_credit' && !transactionId && !walletId) {
    logger.info(`â„¹ï¸ Ignoring embedded wallet_credit PaymentIntent ${paymentIntent.id}; Checkout Session is authoritative`);
    return;
  }

  // Handle both booking payments AND wallet/package purchases
  if (!bookingId && !transactionId && !walletId) {
    logger.error('âŒ No bookingId, transactionId, or walletId in payment intent metadata');
    await recordWebhookEvent(prisma, idempotencyKey, 'payment_intent.succeeded', paymentIntent.id, {
      error: 'Missing bookingId, transactionId, or walletId'
    });
    return;
  }

  // âœ… Handle wallet/package purchase (book later)
  if (transactionId || walletId) {
    await handleWalletPaymentSuccess(paymentIntent, idempotencyKey, transactionId, walletId);
    return;
  }

  try {
    await withSerializableRetry(async () => {
      await prisma.$transaction(async (tx) => {
            // Claim the webhook inside the same DB transaction as the booking mutation.
            await recordWebhookEvent(tx, idempotencyKey, 'payment_intent.succeeded', paymentIntent.id, {
              bookingId,
              amount: paymentIntent.amount / 100
            });
      
          // Fetch booking to validate
          const booking = await tx.booking.findUnique({
            where: { id: bookingId },
            include: { customer: true, provider: { include: { user: true } } }
          });
      
          if (!booking) {
            logger.error('âŒ Booking not found', { bookingId });
            throw new Error(`Booking not found: ${bookingId}`);
          }
      
          // â”€â”€ Handle EXPIRED booking â€” DO NOT revive, issue refund instead â”€â”€â”€â”€â”€â”€â”€â”€â”€
          // If the booking expired before Stripe confirmed payment, the slot may have been
          // released and taken by another student. Reviving the booking risks a double-booking.
          // Safe policy: issue a full refund via Stripe and flag for admin review.
          // ── Handle EXPIRED booking – DO NOT revive, issue refund instead ────────
          // If the booking expired before Stripe confirmed payment, the slot may have been
          // released and taken by another student. Reviving the booking risks a double-booking.
          // Safe policy: issue a full refund via Stripe and flag for admin review.
          // IMPORTANT: Throw error here so refund happens OUTSIDE transaction (P2034 retry-safe)
          if (booking.status === 'EXPIRED') {
            logger.error(`🚨 Delayed payment on expired booking ${bookingId} – will issue refund outside transaction`);
            
            // Mark booking as cancelled INSIDE transaction
            await tx.booking.update({
              where: { id: bookingId },
              data: {
                status: 'CANCELLED',
                notes: `EXPIRED_PAYMENT: Stripe charged after slot expiry. Refund pending. PaymentIntent: ${paymentIntent.id}. Admin review required.`,
              } as any,
            });
      
            // Throw error to trigger refund OUTSIDE transaction (safe for P2034 retry)
            throw new ExpiredBookingError(bookingId, paymentIntent.id);
          }
      
          // â”€â”€ Already confirmed (idempotent replay) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          if (booking.status === 'CONFIRMED' || booking.status === 'COMPLETED') {
            logger.info(`â„¹ï¸ Booking ${bookingId} already ${booking.status} â€” skipping wallet ops`);
            return;
          }
      
          // â”€â”€ Strict state machine: only PENDING_PAYMENT â†’ CONFIRMED â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          if (booking.status !== 'PENDING_PAYMENT') {
            logger.error(`ðŸš¨ Webhook rejected: booking ${bookingId} is in status '${booking.status}' â€” cannot confirm`);
            return;
          }
      
          // âœ… Validate payment amount matches what was charged
          // For packages: Stripe charged packageTotalPaid. For single lessons: booking.price.
          const chargedAmount = (booking as any).packageTotalPaid || booking.price;
          const expectedAmount = Math.round(chargedAmount * 100); // Convert to cents
          const receivedAmount = paymentIntent.amount_received;
      
          if (receivedAmount !== expectedAmount) {
            logger.error('âŒ Payment amount mismatch:', {
              expected: expectedAmount,
              received: receivedAmount,
              bookingId
            });
            throw new Error(
              `Payment amount mismatch: expected ${expectedAmount} cents, received ${receivedAmount} cents`
            );
          }
      
          // Get userId from client relation â€” try multiple fallbacks
          let userId = booking.customer?.userId;
      
          if (!userId && booking.customerId) {
            // Direct lookup by customerId (most reliable)
            const client = await tx.customer.findUnique({ where: { id: booking.customerId } });
            userId = client?.userId ?? undefined;
          }
      
          if (!userId && booking.customerPhone) {
            const client = await tx.customer.findFirst({
              where: { phone: booking.customerPhone }
            });
            userId = client?.userId ?? undefined;
          }
      
          if (!userId) {
            logger.warn(`âš ï¸ Could not resolve userId for booking ${bookingId} â€” wallet ops skipped`);
          }
      
          // REMOVED: P0 FIX â€” Backwards customer validation compared paymentIntent.customer (student)
          // against instructor.stripeCustomerId (instructor's SaaS subscription). These are never the same.
          // The amount validation above is sufficient security. Do not re-add without understanding
          // the Stripe customer model: paymentIntent.customer = student, provider.stripeCustomerId = instructor.
      
          // âœ… All validations passed - Update booking
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
      
          // Update transaction â€” SETTLED means eligible for payout
          await (tx as any).transaction.updateMany({
            where: { stripePaymentIntentId: paymentIntentId },
            data: {
              status: 'SETTLED',
              processedAt: new Date(),
              stripeChargeId: (paymentIntent as any).charges?.data[0]?.id,
            }
          });
      
          // â”€â”€ Wallet: credit full package amount, debit first lesson â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          // Per financial doctrine (PATH 2: STRIPE BOOKING):
          //   CREDIT wallet = full package amount paid via Stripe (packageTotalPaid)
          //   DEBIT  wallet = first lesson price (booking.price = 1hr Ã— hourlyRate)
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
                  description: `Package purchase â€” ${(booking as any).packageHours} hours (Stripe)`,
                  status: 'CONFIRMED',
                }
              });
      
              // DEBIT: first lesson already scheduled (booking.price = 1hr Ã— hourlyRate)
              await tx.walletTransaction.create({
                data: {
                  walletId: wallet.id,
                  type: 'DEBIT',
                  amount: booking.price,
                  description: `Lesson: ${booking.provider?.user?.name || "Instructor"} â€” ${new Date(booking.startTime!).toLocaleDateString('en-AU', { timeZone: DEFAULT_TIMEZONE })} ${new Date(booking.startTime!).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: DEFAULT_TIMEZONE })} (${Number(booking.duration ?? 60)}min) #${bookingId.slice(0,8)}`,
                  status: 'CONFIRMED',
                }
              });
      
              const remaining = packageTotalPaid - Number(booking.price);
              logger.info(`âœ… Package wallet: +${packageTotalPaid} CREDIT / -${booking.price} DEBIT = ${remaining.toFixed(2)} remaining for userId=${userId}`);
            } else {
              // Single lesson â€” confirm any pending wallet transactions
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
        }, SERIALIZABLE_TX);
    }, { operationName: 'webhook-booking-payment' });
  } catch (err) {
    // Handle expired booking error - issue refund OUTSIDE transaction (P2034 retry-safe)
    if (err instanceof ExpiredBookingError) {
      const { bookingId: expiredBookingId, paymentIntentId: expiredPaymentIntentId } = err;
      logger.info(`Handling expired booking refund outside transaction for ${expiredBookingId}`);

      // ── Step 1: Stripe refund — external side effect first ──────────────────
      // Stable idempotency key means retries get the same refund object.
      // If this throws, the catch block below returns non-200 → Stripe retries.
      // No DB state is written yet so the retry is safe to attempt Stripe again.
      let expiredRefund: Awaited<ReturnType<typeof stripe.refunds.create>>;
      try {
        expiredRefund = await stripe.refunds.create({
          payment_intent: expiredPaymentIntentId,
          reason: 'duplicate', // closest Stripe reason code
          metadata: {
            bookingId: expiredBookingId,
            reason: 'Booking expired before payment confirmed — automatic refund',
          },
        }, {
          idempotencyKey: `expired-booking-refund-${expiredBookingId}-${expiredPaymentIntentId}`
        });
        logger.info(`Auto-refund issued for expired booking ${expiredBookingId}: ${expiredRefund.id}`);
      } catch (refundErr) {
        // Refund failed — must flag for manual admin action
        logger.error(`CRITICAL: Auto-refund FAILED for expired booking ${expiredBookingId}. Manual action required.`, {
          error: refundErr instanceof Error ? refundErr.message : String(refundErr),
        });
        void sendAlert({
          type: 'RECONCILIATION_ISSUES',
          severity: 'CRITICAL',
          message: `Auto-refund FAILED for expired booking ${expiredBookingId}. Student was charged but refund could not be issued. MANUAL REFUND REQUIRED via Stripe Dashboard. PaymentIntent: ${expiredPaymentIntentId}`,
          entityId: expiredBookingId,
          metadata: {
            bookingId: expiredBookingId,
            stripePaymentIntentId: expiredPaymentIntentId,
            error: refundErr instanceof Error ? refundErr.message : String(refundErr),
            outcome: 'auto_refund_failed',
            action: 'Manual refund required via Stripe Dashboard',
          },
        });
        // Re-throw so the outer handler returns HTTP 500 → Stripe retries
        throw refundErr;
      }

      // ── Step 2: Durable DB state — SERIALIZABLE transaction ─────────────────
      // MM-05-E-R / MM-05-E-S FIX:
      // Refund is confirmed. Now write durable application state atomically.
      //
      // The booking transition uses updateMany with status='EXPIRED' guard (CAS).
      // We then inspect the booking to verify correctness:
      //
      //   EXPIRED → CANCELLED  (count=1): normal path — write succeeded.
      //   count=0 → booking is not EXPIRED. Read current state and verify:
      //     CANCELLED + same refund ID  → already complete; idempotent.
      //     CANCELLED + null refund ID  → prior partial write; repair refundId.
      //     CANCELLED + different ID    → integrity error; alert, do not overwrite.
      //     any other status            → unexpected; alert and fail.
      //
      // WebhookEvent is written inside the same tx. DuplicateWebhookEventError
      // is only safe to ignore after the booking state is verified as correct.
      try {
        await withSerializableRetry(async () => {
          await prisma.$transaction(async (tx) => {
            // CAS: only transition if still EXPIRED
            const transitioned = await tx.booking.updateMany({
              where: { id: expiredBookingId, status: 'EXPIRED' },
              data: {
                status: 'CANCELLED',
                stripeRefundId: expiredRefund.id,
                notes: `EXPIRED_PAYMENT_REFUNDED: Auto-refund ${expiredRefund.id} issued. Original payment expired before confirmation.`,
              },
            });

            if (transitioned.count === 0) {
              // Booking not EXPIRED — inspect current state before deciding
              const current = await tx.booking.findUnique({
                where: { id: expiredBookingId },
                select: { status: true, stripeRefundId: true },
              });

              if (!current) {
                throw new Error(`[MM-05-E] Booking ${expiredBookingId} not found during post-refund state repair`);
              }

              if (current.status === 'CANCELLED') {
                if (current.stripeRefundId === expiredRefund.id) {
                  // Already in the correct terminal state — this is an idempotent retry
                  logger.info(`[MM-05-E] Booking ${expiredBookingId} already CANCELLED with correct refundId — idempotent`);
                  // Continue to WebhookEvent write below (may also be duplicate — handled there)
                } else if (current.stripeRefundId === null) {
                  // Partial prior write: CANCELLED but refundId not persisted — repair it
                  logger.warn(`[MM-05-E] Repairing missing stripeRefundId on CANCELLED booking ${expiredBookingId}`);
                  await tx.booking.update({
                    where: { id: expiredBookingId },
                    data: { stripeRefundId: expiredRefund.id },
                  });
                } else {
                  // CANCELLED with a DIFFERENT refundId — integrity error; do not overwrite
                  void sendAlert({
                    type: 'RECONCILIATION_ISSUES',
                    severity: 'CRITICAL',
                    message: `[MM-05-E] INTEGRITY ERROR: Booking ${expiredBookingId} is CANCELLED with refundId=${current.stripeRefundId} but incoming refundId=${expiredRefund.id}. Two refunds may exist. Manual investigation required.`,
                    entityId: expiredBookingId,
                    metadata: {
                      bookingId: expiredBookingId,
                      existingRefundId: current.stripeRefundId,
                      incomingRefundId: expiredRefund.id,
                      stripePaymentIntentId: expiredPaymentIntentId,
                    },
                  });
                  throw new Error(`[MM-05-E] Integrity error: booking ${expiredBookingId} CANCELLED with different refundId (${current.stripeRefundId} vs ${expiredRefund.id})`);
                }
              } else {
                // Unexpected status — fail loudly; do not silently accept
                void sendAlert({
                  type: 'RECONCILIATION_ISSUES',
                  severity: 'CRITICAL',
                  message: `[MM-05-E] Unexpected booking status '${current.status}' for ${expiredBookingId} after refund ${expiredRefund.id}. Expected EXPIRED or CANCELLED. Manual investigation required.`,
                  entityId: expiredBookingId,
                  metadata: { bookingId: expiredBookingId, status: current.status, refundId: expiredRefund.id },
                });
                throw new Error(`[MM-05-E] Unexpected booking status '${current.status}' for ${expiredBookingId} after successful refund`);
              }
            }

            // WebhookEvent — written inside the same tx as the booking transition.
            // Only safe to treat as duplicate if the booking state above is already correct.
            await recordWebhookEvent(tx, idempotencyKey, 'payment_intent.succeeded', paymentIntentId, {
              expiredBooking: true,
              bookingId: expiredBookingId,
              stripeRefundId: expiredRefund.id,
              outcome: 'expired_booking_refunded',
            });
          }, SERIALIZABLE_TX);
        }, { operationName: 'webhook-expired-booking-post-refund' });
      } catch (dbErr: any) {
        // DuplicateWebhookEventError is only safe to swallow if we already verified
        // the booking is in the correct terminal state above (inside the tx).
        // If the tx itself threw DuplicateWebhookEventError, the booking checks
        // passed (or the tx rolled back), so the state is consistent.
        if (dbErr?.name === 'DuplicateWebhookEventError') {
          logger.info(`[MM-05-E] Duplicate WebhookEvent for expired booking ${expiredBookingId} — booking state already verified consistent`);
        } else {
          // DB write failed after Stripe succeeded — throw so webhook returns non-200
          // and Stripe retries. The retry will use the same Stripe idempotency key
          // (returns same refund object) and re-attempt this DB transaction.
          logger.error(`[MM-05-E] Post-refund DB write failed for ${expiredBookingId} — webhook will be retried`, {
            error: dbErr instanceof Error ? dbErr.message : String(dbErr),
          });
          void sendAlert({
            type: 'RECONCILIATION_ISSUES',
            severity: 'CRITICAL',
            message: `[MM-05-E] Stripe refund succeeded (${expiredRefund.id}) but durable DB state write failed for booking ${expiredBookingId}. Stripe will retry. If retries exhausted, manual state repair required.`,
            entityId: expiredBookingId,
            metadata: {
              bookingId: expiredBookingId,
              stripeRefundId: expiredRefund.id,
              error: dbErr instanceof Error ? dbErr.message : String(dbErr),
            },
          });
          throw dbErr;
        }
      }

      // Alert ops — non-critical, fire-and-forget
      void sendAlert({
        type: 'RECONCILIATION_ISSUES',
        severity: 'WARNING',
        message: `Delayed payment on expired booking ${expiredBookingId} — auto-refund issued successfully. Student was charged after slot expired. Admin review recommended.`,
        entityId: expiredBookingId,
        metadata: {
          bookingId: expiredBookingId,
          stripePaymentIntentId: expiredPaymentIntentId,
          stripeRefundId: expiredRefund.id,
          outcome: 'auto_refund_succeeded',
        },
      });

      // Expired booking fully handled
      return;
    }

    // Re-throw other errors
    throw err;
  }

  logger.info(`âœ… Booking payment processed with validations: ${bookingId}`);

  // â”€â”€ Audit log: Stripe payment event â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // This closes the audit blind spot â€” Stripe payment events are now in AuditLog
  // AUDIT-01/02 fix (Tier 4): payment success — financial tx already committed.
  {
    const txRecord = await prisma.transaction.findFirst({
      where: { stripePaymentIntentId: paymentIntent.id },
      select: { id: true },
    });
    await writeAuditLogSafe({
      action:     AuditAction.PAYMENT_SUCCEEDED,
      actorId:    'SYSTEM',
      actorRole:  'SYSTEM',
      targetType: 'TRANSACTION',
      targetId:   txRecord?.id ?? bookingId,
      metadata:   {
        stripePaymentIntentId: paymentIntent.id,
        bookingId,
        amountCents: paymentIntent.amount_received,
      },
    });
  }

  // â”€â”€ Ledger: record payment collected â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // This populates totalCollected + totalReserved so payout balance checks work.
  // Also writes to FinancialLedger (double-entry) for reconciliation/reporting.
  // Non-critical: if either fails, booking is still confirmed. Alert is sent.
  try {
    const ledgerBooking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        price: true,
        platformFee: true,
        providerPayout: true,
        commissionRate: true,
        providerId: true,
        customer: { select: { userId: true } },
      },
    }) as any;
    if (ledgerBooking) {
      const instrPayout = (ledgerBooking as any).providerPayout
        ?? ledgerBooking.price * (1 - ((ledgerBooking as any).commissionRate ?? 15) / 100);
      const platFee = (ledgerBooking as any).platformFee
        ?? ledgerBooking.price - instrPayout;

      // Existing payout-service ledger (totalCollected/totalReserved)
      await recordPaymentCollected(bookingId, ledgerBooking.price, instrPayout);
      logger.info(`âœ… Ledger updated: collected=${ledgerBooking.price} reserved=${instrPayout}`);

      // FinancialLedger â€” double-entry via ledger-operations
      // Idempotency key: `booking-${bookingId}-payment` â€” deterministic, safe to retry
      const { recordBookingPayment: recordLedgerPayment } = await import('@/lib/services/ledger-operations');
      const clientUserId = ledgerBooking.customer?.userId;
      if (clientUserId) {
        await recordLedgerPayment({
          bookingId,
          userId: clientUserId,
          providerId: ledgerBooking.providerId,
          totalAmount: ledgerBooking.price,
          platformFee: platFee,
          providerPayout: instrPayout,
          createdBy: 'STRIPE_WEBHOOK',
        }).catch((err: Error) => {
          // Duplicate idempotencyKey = already recorded â€” not an error
          if (!err.message?.includes('idempotency')) {
            logger.error('[FinancialLedger] recordBookingPayment failed (non-critical):', { bookingId, error: err.message });
          }
        });
      }
    }
  } catch (ledgerErr) {
    logger.error('ðŸš¨ LEDGER UPDATE FAILED â€” booking confirmed but ledger not updated:', {
      bookingId,
      error: ledgerErr instanceof Error ? ledgerErr.message : String(ledgerErr),
    });
    // Send structured alert so this is visible in monitoring â€” never silent
    void sendAlert({
      type: 'RECONCILIATION_ISSUES',
      severity: 'WARNING',
      message: `FinancialLedger write failed for confirmed booking ${bookingId} â€” reconciliation cron will backfill`,
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
        provider: { select: { id: true, userId: true, name: true, businessName: true, accountType: true, hourlyRate: true } },
        customer: true,
      },
    }) as any;
    const payChannels = getNotifChannels('PAYMENT_RECEIVED');
    if (payChannels.inApp && booking?.provider?.userId) {
      await notifyPaymentReceived(
        booking.provider.userId,
        booking.price,
        booking.customer?.name || booking.customerName || 'Client',
        bookingId
      );
    }

    // Send receipt to student
    if (booking?.customer?.email) {
      const isPackage = (booking as any).isPackageBooking && (booking as any).packageHours > 1;
      const packageTotalPaid = (booking as any).packageTotalPaid as number | null;
      const durationHours = booking.duration ? booking.duration / 60 : 1;
      const instructor = booking.provider;

      if (isPackage && packageTotalPaid) {
        const packageHours = (booking as any).packageHours as number;
        const lockedDiscountPct = (booking as any).lockedDiscountPct as number ?? 0;
        const lockedHourlyRate = (booking as any).lockedHourlyRate as number ?? instructor.hourlyRate;
        const subtotalBeforeDiscount = packageHours * lockedHourlyRate;
        const discountAmount = (subtotalBeforeDiscount * lockedDiscountPct) / 100;

        await sendPackagePurchaseReceipt({
          customerName: (booking as any).customer.name,
          customerEmail: (booking as any).customer.email,
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
          firstLessonDate: (booking as any).startTime!,
          firstLessonDurationHours: durationHours,
          pickupAddress: (booking as any).pickupAddress ?? undefined,
          walletLoaded: packageTotalPaid,
          firstLessonDebit: booking.price,
          walletBalance: packageTotalPaid - booking.price,
          stripeRef: paymentIntent.id,
          paymentMethod: 'Card',
          bookingId,
        }).catch(e => logger.error('Package receipt email failed', { error: e instanceof Error ? e.message : String(e) }));
      } else {
        await sendSingleLessonReceipt({
          customerName: (booking as any).customer.name,
          customerEmail: (booking as any).customer.email,
          receiptId: bookingId,
          paidAt: new Date(),
          instructorName: getDisplayName(instructor),
          lessonDate: (booking as any).startTime!,
          durationHours,
          hourlyRate: instructor.hourlyRate,
          lessonCost: booking.price,
          platformFee: (booking as any).platformFee ?? 0,
          total: booking.price + ((booking as any).platformFee ?? 0),
          pickupAddress: (booking as any).pickupAddress ?? undefined,
          stripeRef: paymentIntent.id,
          paymentMethod: 'Card',
          bookingId,
        }).catch(e => logger.error('Single lesson receipt email failed', { error: e instanceof Error ? e.message : String(e) }));
      }
    }

    // SMS booking confirmation â€” student only (non-critical)
    // Instructor gets in-app notification; SMS confirmation only goes to the student
    try {
      const { smsService } = await import('@/lib/services/sms');
      if (booking?.customer?.phone && booking?.provider && booking.startTime) {
        await smsService.sendBookingConfirmation({
          customerPhone: (booking as any).customer.phone,
          customerName: (booking as any).customer.name || booking.customerName || 'Student',
          instructorName: getDisplayName(booking.provider),
          startTime: (booking as any).startTime,
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
    await recordWebhookEvent(prisma, idempotencyKey, 'payment_intent.payment_failed', paymentIntent.id, {
      error: 'Missing bookingId'
    });
    return;
  }

  await withSerializableRetry(async () => {
    await prisma.$transaction(async (tx) => {
        await recordWebhookEvent(tx, idempotencyKey, 'payment_intent.payment_failed', paymentIntent.id, {
          bookingId
        });
    
        await tx.booking.update({
          where: { id: bookingId },
          data: {
            status: 'PENDING',
            paymentCaptured: false,
          } as any
        });
      }, SERIALIZABLE_TX);
  }, { operationName: 'webhook-booking-payment-failed' });

  logger.info(`âŒ Booking payment failed: ${bookingId}`);

  // AUDIT-01/02 fix (Tier 4): payment failed — informational, booking state already reverted.
  await writeAuditLogSafe({
    action:     AuditAction.PAYMENT_FAILED,
    actorId:    'SYSTEM',
    actorRole:  'SYSTEM',
    targetType: 'TRANSACTION',
    targetId:   bookingId,
    metadata:   {
      stripePaymentIntentId: paymentIntent.id,
      bookingId,
      failureMessage: paymentIntent.last_payment_error?.message,
      failureCode:    paymentIntent.last_payment_error?.code,
    },
    success: false,
  });
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
  const { providerId } = metadata;

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
      [process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID || '']: 'PREMIUM',
      [process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID || '']: 'PREMIUM',
    };
    tier = priceToTier[priceId] || undefined;
    if (tier) {
      logger.info(`â„¹ï¸ Derived tier '${tier}' from price ID ${priceId} (metadata was missing)`);
    }
  }

  if (!providerId || !tier) {
    logger.error('âŒ Missing metadata in subscription', { subscriptionId: subscription.id });
    await recordWebhookEvent(prisma, idempotencyKey, 'subscription.updated', subscription.id, {
      error: 'Missing providerId or tier'
    });
    return;
  }

  const plan = SUBSCRIPTION_PLANS[tier as keyof typeof SUBSCRIPTION_PLANS];
  if (!plan) {
    logger.error('âŒ Invalid tier', { tier });
    return;
  }

  // Verify instructor exists before proceeding
  const instructorExists = await prisma.provider.findUnique({
    where: { id: providerId },
    select: { id: true },
  });
  if (!instructorExists) {
    logger.error(`âŒ Instructor not found in DB: "${providerId}" â€” subscription ${subscription.id} NOT synced.`);
    logger.error('   Check Stripe subscription metadata for typos in providerId.');
    await recordWebhookEvent(prisma, idempotencyKey, 'subscription.updated', subscription.id, {
      error: `Instructor not found: ${providerId}`,
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

  // SUB-22 P2002 handling: wrap transaction in try-catch to handle constraint violations OUTSIDE transaction
  try {
    await withSerializableRetry(async () => {
      await prisma.$transaction(async (tx) => {
        // Record webhook event
        await recordWebhookEvent(tx, idempotencyKey, 'subscription.updated', subscription.id, {
          providerId,
          tier,
          status
        });
    
        // Update instructor
        await tx.provider.update({
          where: { id: providerId },
          data: {
            subscriptionTier: tier as any,
            subscriptionStatus: normalizeStatus(status) as any,
            trialEndsAt: trial_end ? new Date(trial_end * 1000) : null,
            stripeCustomerId: subscription.customer as string,
          } as any
        });
    
        // Update or create subscription record
        // Priority: find by stripeSubscriptionId first (renewal/update).
        // If not found, find the most-recent non-stripe trial row for this instructor
        // (race condition: customer.subscription.created fires before checkout.session.completed
        // stamps the stripeSubscriptionId â€” so we link it rather than create a duplicate).
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
          // Atomically claim an existing trial subscription without a stripeSubscriptionId.
          // Use updateMany() with affected-row count to prevent race conditions (SUB-22 Step 5).
          try {
            const updateResult = await tx.subscription.updateMany({
              where: {
                providerId,
                stripeSubscriptionId: null,
                status: { in: ['TRIAL', 'ACTIVE'] },
              },
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

            if (updateResult.count === 1) {
              // Successfully claimed trial row
              logger.info(`Linked Stripe subscription ${subscription.id} to existing trial row for instructor ${providerId}`);
            } else if (updateResult.count === 0) {
              // No trial row found - create new subscription record
              const current_period_start = (subscription as any).current_period_start;
              await tx.subscription.create({
                data: {
                  providerId,
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
            } else {
              // count > 1: Multiple trial rows updated (should never happen with proper data)
              logger.error(`SUB-22 CRITICAL: updateMany affected ${updateResult.count} rows for providerId ${providerId} - expected 0 or 1`);
              throw new Error(`Multiple trial subscriptions found for provider ${providerId}`);
            }
          } catch (err: any) {
            // SUB-22: Re-throw P2002/23505 to abort transaction - handle outside with fresh query
            // PostgreSQL aborts transactions on constraint violations (error 25P02),
            // so we cannot query tx after P2002. Let it propagate and handle externally.
            throw err;
          }
        }
    
        // AUDIT-01/02 fix (Tier 3): atomic with subscription update
        await tx.auditLog.create({
          data: {
            action:     AuditAction.SUBSCRIPTION_UPDATED,
            actorId:    providerId,
            actorRole:  'SYSTEM',
            targetType: 'TRANSACTION',
            targetId:   subscription.id,
            ipAddress:  'stripe-webhook',
            userAgent:  'stripe-webhook',
            metadata:   {
              tier,
              status,
              commissionRate: plan.commissionRate,
              amount: subscription.items.data[0].price.unit_amount! / 100,
            },
            success:    true,
          },
        });
      }, SERIALIZABLE_TX);
  }, { operationName: 'webhook-subscription-updated' });
  } catch (err: any) {
    // SUB-22: Handle P2002/23505 OUTSIDE transaction (PostgreSQL aborts on constraint violations)
    if (err.code === 'P2002' || err.code === '23505') {
      // Another webhook won the race - verify Stripe subscription ID with fresh query
      const existingRow = await prisma.subscription.findFirst({
        where: {
          providerId,
          status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE'] }
        },
        select: { id: true, stripeSubscriptionId: true }
      });

      if (existingRow?.stripeSubscriptionId === subscription.id) {
        // Same Stripe ID - idempotent success
        logger.info(`Idempotent: Stripe subscription ${subscription.id} already linked for instructor ${providerId}`);
        // Don't throw - this is a successful idempotent operation
      } else {
        // Different Stripe ID - conflict must not be silently accepted
        logger.error(`SUB-22 CONFLICT: Provider ${providerId} already has subscription ${existingRow?.stripeSubscriptionId}, cannot overwrite with ${subscription.id}`);
        throw new Error(`Stripe subscription ID conflict for provider ${providerId}: existing=${existingRow?.stripeSubscriptionId}, incoming=${subscription.id}`);
      }
    } else {
      // Re-throw other errors (including serialization failures)
      throw err;
    }
  }

  // Send email if active
  if (status === 'active') {
    const instructor = await prisma.provider.findUnique({
      where: { id: providerId },
      select: { id: true, name: true, user: { select: { email: true, name: true } } },
    });

    if (instructor?.user) {
      try {
        await emailService.sendGenericEmail({
        from: 'DriveBook Payments <payments@drivebook.com.au>',
        to: instructor.user.email,
        subject: `${plan.name} subscription activated â€” DriveBook`,
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
      } catch (emailErr: any) {
        // Email failure should not fail the webhook - log and continue
        logger.error(`Failed to send subscription activation email to ${instructor.user.email}`, {
          error: emailErr.message,
          providerId,
          subscriptionId: subscription.id
        });
      }
    }
  }

  logger.info(`âœ… Subscription updated: ${subscription.id} (${tier}, ${status})`);
}

async function handleSubscriptionCancelled(
  subscription: Stripe.Subscription,
  idempotencyKey: string
): Promise<void> {
  const { metadata } = subscription;
  const { providerId } = metadata;

  if (!providerId) {
    await recordWebhookEvent(prisma, idempotencyKey, 'subscription.cancelled', subscription.id, {
      error: 'Missing providerId'
    });
    return;
  }

  await withSerializableRetry(async () => {
    await prisma.$transaction(async (tx) => {
        await recordWebhookEvent(tx, idempotencyKey, 'subscription.cancelled', subscription.id, {
          providerId
        });
    
        await tx.provider.update({
          where: { id: providerId },
          data: { subscriptionStatus: 'CANCELLED' as any }
        });
    
        await tx.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: 'CANCELLED',
          }
        });
    
        // AUDIT-01/02 fix (Tier 3): atomic with cancellation state change
        await tx.auditLog.create({
          data: {
            action:     AuditAction.SUBSCRIPTION_CANCELLED,
            actorId:    providerId,
            actorRole:  'SYSTEM',
            targetType: 'TRANSACTION',
            targetId:   subscription.id,
            ipAddress:  'stripe-webhook',
            userAgent:  'stripe-webhook',
            metadata:   {},
            success:    true,
          },
        });
      }, SERIALIZABLE_TX);
  }, { operationName: 'webhook-subscription-cancelled' });

  logger.info(`âœ… Subscription cancelled: ${subscription.id}`);
}

async function handleTrialEnding(
  subscription: Stripe.Subscription,
  idempotencyKey: string
): Promise<void> {
  const { metadata } = subscription;
  const trial_end = (subscription as any).trial_end;
  const { providerId } = metadata;

  if (!providerId) return;

  await withSerializableRetry(async () => {
    await prisma.$transaction(async (tx) => {
        await recordWebhookEvent(tx, idempotencyKey, 'subscription.trial_ending', subscription.id, {
          providerId,
          trialEnd: trial_end
        });
      }, SERIALIZABLE_TX);
  }, { operationName: 'webhook-trial-ending' });

  const instructor = await prisma.provider.findUnique({
    where: { id: providerId },
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

    // AUDIT-01/02 fix (Tier 4): trial-ending is informational, not a financial state change.
    await writeAuditLogSafe({
      action:     AuditAction.SUBSCRIPTION_TRIAL_ENDING,
      actorId:    providerId,
      actorRole:  'SYSTEM',
      targetType: 'TRANSACTION',
      targetId:   subscription.id,
      metadata:   { daysLeft },
    });
  }

  logger.info(`âœ… Trial ending notification sent: ${subscription.id}`);
}

async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
  idempotencyKey: string
): Promise<void> {
  const subscription = (invoice as any).subscription;

  if (!subscription) {
    await recordWebhookEvent(prisma, idempotencyKey, 'invoice.payment_succeeded', invoice.id, {});
    return;
  }

  await withSerializableRetry(async () => {
    await prisma.$transaction(async (tx) => {
        await recordWebhookEvent(tx, idempotencyKey, 'invoice.payment_succeeded', invoice.id, {
          subscriptionId: subscription
        });
    
        // Update subscription record
        await tx.subscription.updateMany({
          where: { stripeSubscriptionId: subscription as string },
          data: { status: 'ACTIVE' }
        });
    
        // â”€â”€ Also update instructor.subscriptionStatus â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // This is the critical step that was missing â€” without it, the instructor
        // stays stuck at TRIAL after their first real payment or monthly renewal.
        const subscriptionRecord = await tx.subscription.findFirst({
          where: { stripeSubscriptionId: subscription as string },
          select: { providerId: true }
        });
    
        if (subscriptionRecord?.providerId) {
          await tx.provider.update({
            where: { id: subscriptionRecord.providerId },
            data: {
              subscriptionStatus: 'ACTIVE' as any,
              trialEndsAt: null, // Clear trial end date â€” they're now a paying customer
            }
          });
          logger.info(`âœ… Instructor ${subscriptionRecord.providerId} status â†’ ACTIVE (invoice paid)`);
        }
      }, SERIALIZABLE_TX);
  }, { operationName: 'webhook-invoice-payment-succeeded' });

  logger.info(`âœ… Invoice payment succeeded: ${invoice.id}`);
}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  idempotencyKey: string
): Promise<void> {
  const subscription = (invoice as any).subscription;

  if (!subscription) {
    await recordWebhookEvent(prisma, idempotencyKey, 'invoice.payment_failed', invoice.id, {});
    return;
  }

  await withSerializableRetry(async () => {
    await prisma.$transaction(async (tx) => {
        await recordWebhookEvent(tx, idempotencyKey, 'invoice.payment_failed', invoice.id, {
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
          await tx.provider.update({
            where: { id: subscriptionRecord.providerId },
            data: { subscriptionStatus: 'PAST_DUE' as any }
          });
        }
      }, SERIALIZABLE_TX);
  }, { operationName: 'webhook-invoice-payment-failed' });

  // Send payment failed email
  const subscriptionRecord = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription as string },
    include: { 
      provider: {
        include: { user: true }
      }
    }
  });

  if (subscriptionRecord?.provider?.user) {
    await emailService.sendGenericEmail({
      from: 'DriveBook Payments <payments@drivebook.com.au>',
      to: subscriptionRecord.provider.user.email,
      subject: 'Payment Failed',
      html: `
        <h2>Payment Failed</h2>
        <p>We were unable to process your payment.</p>
        <p>Please update your payment method to continue using DriveBook.</p>
      `
    });
  }

  logger.info(`âŒ Invoice payment failed: ${invoice.id}`);
}

// ============================================================================
// SPRINT A â€” DISPUTE / CHARGEBACK HANDLING
// ============================================================================

/**
 * charge.dispute.created
 *
 * Actions:
 *  1. Create LedgerEntry(DISPUTE_OPENED) â€” marks the disputed amount as at-risk
 *  2. Freeze payout eligibility for this instructor (disputeHold flag)
 *  3. Create admin alert + audit log
 */
async function handleDisputeOpened(
  dispute: Stripe.Dispute,
  idempotencyKey: string,
): Promise<void> {
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;
  const amount = dispute.amount / 100;
  const reason = dispute.reason;
  const status = dispute.status;

  // Try to resolve via charge â†’ payment intent â†’ booking
  let bookingId: string | null = null;
  let providerId: string | null = null;
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
          select: { providerId: true, customerName: true },
        }) as any;
        providerId = b?.providerId ?? null;
      }
    }
  } catch (lookupErr) {
    logger.error('[DISPUTE] charge lookup failed (non-critical)', {
      error: lookupErr instanceof Error ? lookupErr.message : String(lookupErr),
    });
  }

  await recordWebhookEvent(prisma, idempotencyKey, 'charge.dispute.created', dispute.id, {
    chargeId,
    bookingId,
    providerId,
    amount,
    reason,
    status,
  });

  // Persist StripeDispute record â€” gives admin a dedicated dispute queue.
  // A dispute ID is globally unique in Stripe. If the record already exists,
  // this event must not create another DISPUTE_OPENED ledger entry.
  const existingDispute = await prisma.stripeDispute.findUnique({
    where: { stripeDisputeId: dispute.id },
    select: { id: true },
  });

  if (existingDispute) {
    await prisma.stripeDispute.update({
      where: { stripeDisputeId: dispute.id },
      data: { status, payoutFrozen: !!providerId },
    });
    logger.info(`â„¹ï¸ Dispute ${dispute.id} already exists â€” no duplicate opening ledger entry`);
    return;
  }

  try {
    await prisma.stripeDispute.upsert({
      where: { stripeDisputeId: dispute.id },
      update: { status, payoutFrozen: !!providerId },
      create: {
        stripeDisputeId: dispute.id,
        stripeChargeId: chargeId,
        bookingId,
        providerId,
        amount,
        reason,
        status,
        payoutFrozen: !!providerId,
      },
    });
  } catch (dbErr) {
    logger.error('[DISPUTE] StripeDispute upsert failed (non-critical)', {
      error: dbErr instanceof Error ? dbErr.message : String(dbErr),
    });
  }

  // Append ledger entry â€” amount at risk
  await appendLedgerEntry({
    type: 'DISPUTE_OPENED',
    amount: -amount, // negative = platform liability
    referenceId: bookingId ?? dispute.id,
    referenceType: 'BOOKING',
    providerId: providerId ?? undefined,
    description: `Stripe dispute ${dispute.id} â€” ${reason} â€” $${amount.toFixed(2)} at risk`,
    metadata: {
      stripeDisputeId: dispute.id,
      chargeId,
      reason,
      status,
      bookingId,
    },
  });

  // Freeze payout eligibility for this instructor
  if (providerId) {
    try {
      await prisma.provider.update({
        where: { id: providerId },
        data: { payoutHold: true, payoutHoldReason: `Stripe dispute ${dispute.id} opened` }  as any,
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
        metadata: { stripeDisputeId: dispute.id, amount, reason, chargeId, providerId },
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
    message: `Chargeback filed: $${amount.toFixed(2)} â€” reason: ${reason}. Instructor payout frozen.`,
    entityId: dispute.id,
    metadata: {
      stripeDisputeId: dispute.id,
      chargeId,
      bookingId,
      providerId,
      amount,
      reason,
      status,
    },
  });

  logger.info(`ðŸš¨ Dispute opened: ${dispute.id} â€” $${amount.toFixed(2)} â€” ${reason}`);
}

/**
 * charge.dispute.updated
 *
 * An update is a state synchronisation event, not a second financial opening.
 * Never append another DISPUTE_OPENED ledger entry here.
 */
async function handleDisputeUpdated(
  dispute: Stripe.Dispute,
  idempotencyKey: string,
): Promise<void> {
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;

  // An update is a state synchronisation event, not a second financial opening.
  // Never append another DISPUTE_OPENED ledger entry here.
  const existing = await prisma.stripeDispute.findUnique({
    where: { stripeDisputeId: dispute.id },
    select: { id: true },
  });

  if (!existing) {
    // Event ordering is not guaranteed. Do not manufacture a second financial
    // opening entry from an update event; record the anomaly for reconciliation.
    await recordWebhookEvent(prisma, idempotencyKey, 'charge.dispute.updated', dispute.id, {
      chargeId,
      status: dispute.status,
      warning: 'Dispute update received before dispute.created was persisted',
    });

    void sendAlert({
      type: 'RECONCILIATION_ISSUES',
      severity: 'CRITICAL',
      message: `Stripe dispute.updated received before dispute.created was persisted: ${dispute.id}. Manual reconciliation required.`,
      entityId: dispute.id,
      metadata: { stripeDisputeId: dispute.id, chargeId, status: dispute.status },
    });
    return;
  }

  await prisma.stripeDispute.update({
    where: { stripeDisputeId: dispute.id },
    data: {
      status: dispute.status,
      amount: dispute.amount / 100,
    },
  });

  await recordWebhookEvent(prisma, idempotencyKey, 'charge.dispute.updated', dispute.id, {
    chargeId,
    status: dispute.status,
    amount: dispute.amount / 100,
  });

  logger.info(`â„¹ï¸ Dispute updated without new financial opening entry: ${dispute.id}`);
}

/**
 * charge.dispute.closed
 *
 * Stripe fires this when the bank makes a final decision.
 * status = 'won'  â†’ platform keeps the money â€” release the payout hold
 * status = 'lost' â†’ chargeback confirmed â€” create ADJUSTMENT to recover from instructor's
 *                   next payout (same mechanism as post-payout refunds)
 */
async function handleDisputeClosed(
  dispute: Stripe.Dispute,
  idempotencyKey: string,
): Promise<void> {
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;
  const amount = dispute.amount / 100;
  const status = dispute.status; // 'won' | 'lost' | 'needs_response' etc

  // Resolve bookingId + providerId the same way as handleDisputeOpened
  let bookingId: string | null = null;
  let providerId: string | null = null;
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
          select: { providerId: true },
        }) as any;
        providerId = b?.providerId ?? null;
      }
    }
  } catch (lookupErr) {
    logger.error('[DISPUTE CLOSED] charge lookup failed', {
      error: lookupErr instanceof Error ? lookupErr.message : String(lookupErr),
    });
  }

  await recordWebhookEvent(prisma, idempotencyKey, 'charge.dispute.closed', dispute.id, {
    chargeId, bookingId, providerId, amount, status,
  });

  const existingDispute = await prisma.stripeDispute.findUnique({
    where: { stripeDisputeId: dispute.id },
    select: { status: true, resolvedAt: true, adjustmentCreated: true },
  });

  // If this dispute has already been resolved, do not append another financial
  // resolution entry. Stripe can emit multiple updates around final resolution.
  if (existingDispute?.resolvedAt) {
    logger.info(`â„¹ï¸ Dispute ${dispute.id} already resolved â€” skipping duplicate financial resolution`);
    return;
  }

  if (status === 'won') {
    // Dispute resolved in our favour â€” reverse the DISPUTE_OPENED ledger entry
    await appendLedgerEntry({
      type: 'DISPUTE_WON',
      amount: amount, // positive = risk removed
      referenceId: bookingId ?? dispute.id,
      referenceType: 'BOOKING',
      providerId: providerId ?? undefined,
      description: `Dispute ${dispute.id} WON â€” $${amount.toFixed(2)} liability cleared`,
      metadata: { stripeDisputeId: dispute.id, chargeId, bookingId },
    });

    // Release the payout hold
    if (providerId) {
      try {
        await prisma.provider.update({
          where: { id: providerId },
          data: { payoutHold: false, payoutHoldReason: null }  as any,
        });
      } catch { /* field may not exist */ }
    }

    void sendAlert({
      type: 'DISPUTE_OPENED',
      severity: 'WARNING',
      message: `Dispute ${dispute.id} WON â€” $${amount.toFixed(2)} recovered. Payout hold released.`,
      entityId: dispute.id,
      metadata: { stripeDisputeId: dispute.id, bookingId, providerId, amount },
    });

    logger.info(`âœ… Dispute WON: ${dispute.id} â€” $${amount.toFixed(2)} recovered`);

  } else if (status === 'lost') {
    // Chargeback confirmed â€” platform absorbs the loss
    // Stripe also charges a dispute fee (~$15â€“$25 AUD); use dispute.balance_transactions
    const stripeFee = dispute.balance_transactions?.reduce(
      (sum, bt) => sum + Math.abs(bt.fee) / 100, 0
    ) ?? 0;
    const totalLoss = amount + stripeFee;

    await appendLedgerEntry({
      type: 'DISPUTE_LOST',
      amount: -totalLoss, // confirmed outflow
      referenceId: bookingId ?? dispute.id,
      referenceType: 'BOOKING',
      providerId: providerId ?? undefined,
      description: `Dispute ${dispute.id} LOST â€” $${amount.toFixed(2)} + $${stripeFee.toFixed(2)} fee`,
      metadata: { stripeDisputeId: dispute.id, chargeId, bookingId, amount, stripeFee, totalLoss },
    });

    // If the instructor was already paid out, create an ADJUSTMENT to recover from next payout
    if (providerId && bookingId) {
      try {
        // Check if payout was actually PAID (not just SETTLED)
        const payoutRecord = await (prisma as any).providerPayout.findFirst({
          where: { 
            providerId,
            status: 'PAID',
            bookings: { some: { id: bookingId } }
          },
          select: { id: true, amount: true },
        });

        if (payoutRecord) {
          await appendLedgerEntry({
            type: 'ADJUSTMENT',
            amount: -payoutRecord.amount,
            referenceId: bookingId,
            referenceType: 'ADJUSTMENT',
            providerId,
            description: `Dispute ${dispute.id} LOST â€” recovering instructor payout from future earnings`,
            metadata: { stripeDisputeId: dispute.id, postPayout: true, payoutId: payoutRecord.id },
          });
          logger.info(`âœ… Recovery adjustment created for paid-out booking ${bookingId}`);
        } else {
          logger.info(`â„¹ï¸ No paid payout found for booking ${bookingId} â€” no recovery adjustment needed`);
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
      message: `Dispute ${dispute.id} LOST â€” $${totalLoss.toFixed(2)} cash loss (inc. $${stripeFee.toFixed(2)} Stripe fee). Recovery adjustment created.`,
      entityId: dispute.id,
      metadata: { stripeDisputeId: dispute.id, bookingId, providerId, amount, stripeFee, totalLoss },
    });

    logger.info(`ðŸš¨ Dispute LOST: ${dispute.id} â€” $${totalLoss.toFixed(2)} total loss`);
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
        adjustmentCreated: status === 'lost' && !!providerId && !!bookingId,
      },
    });
  } catch (dbErr) {
    logger.error('[DISPUTE CLOSED] StripeDispute update failed (non-critical)', {
      error: dbErr instanceof Error ? dbErr.message : String(dbErr),
    });
  }
}

// ============================================================================
// SPRINT B â€” OUT-OF-BAND REFUND SYNC
// ============================================================================

/**
 * charge.refunded
 *
 * Fires when a refund is issued â€” either via the DriveBook refund route (already
 * handled) or directly from the Stripe Dashboard (previously invisible to the DB).
 *
 * We use the idempotency key to skip refunds already processed through the app.
 * For new out-of-band refunds we:
 *  1. Create LedgerEntry(REFUND_SYNCED)
 *  2. Update the booking status to CANCELLED if it was CONFIRMED
 *  3. Update the Transaction to REFUNDED
 *  4. Notify admin
 * 
 * CRITICAL: This entire flow is now wrapped in a Serializable transaction to prevent
 * partial state updates (e.g., ledger updated but booking not cancelled).
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
    await recordWebhookEvent(prisma, idempotencyKey, 'charge.refunded', chargeId, {
      note: 'No payment_intent on charge â€” skipped',
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
    // Wallet top-up refund or subscription â€” not a booking, still record it
    await recordWebhookEvent(prisma, idempotencyKey, 'charge.refunded', chargeId, {
      note: 'No bookingId in PI metadata â€” non-booking refund',
      piId,
      refundedAmount,
    });
    return;
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, status: true, providerId: true, price: true, providerPayout: true },
  }) as any;

  if (!booking) {
    await recordWebhookEvent(prisma, idempotencyKey, 'charge.refunded', chargeId, {
      note: 'Booking not found',
      bookingId,
    });
    return;
  }

  // â”€â”€ ATOMIC REFUND SYNC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // All operations must succeed or fail together to maintain consistency

  // Declare refundDelta outside transaction (needed for alert after transaction)
  let refundDelta = 0;

  await withSerializableRetry(async () => {
    await prisma.$transaction(async (tx) => {
        // Record webhook event inside transaction
        await recordWebhookEvent(tx, idempotencyKey, 'charge.refunded', chargeId, {
          bookingId,
          piId,
          refundedAmount,
          isFullRefund,
          bookingStatus: booking.status,
        });
    
        // charge.amount_refunded is cumulative. Calculate only the amount not already
        // represented locally, so multiple partial refunds cannot be double-counted.
        const existingRefunds = await tx.ledgerEntry.findMany({
          where: {
            referenceId: bookingId,
            type: { in: ['REFUND_ISSUED', 'REFUND_SYNCED', 'DISPUTE_LOST'] },
          },
          select: { amount: true },
        });
    
        const alreadyRecordedRefund = existingRefunds.reduce(
          (sum: number, entry: any) => sum + Math.abs(Number(entry.amount) || 0),
          0
        );
    
        refundDelta = Math.max(0, refundedAmount - alreadyRecordedRefund);
    
        if (refundDelta <= 0.000001) {
          logger.info(`â„¹ï¸ [REFUND SYNC] Charge ${chargeId} already fully represented locally`);
          return; // Exit transaction â€” nothing to do
        }
    
        // Out-of-band refund â€” sync only the new refund amount.
        await appendLedgerEntry({
          type: 'REFUND_SYNCED',
          amount: -refundDelta,
          referenceId: bookingId,
          referenceType: 'BOOKING',
          providerId: booking.providerId ?? undefined,
          description: `Out-of-band refund from Stripe Dashboard â€” $${refundedAmount.toFixed(2)} on charge ${chargeId}`,
          metadata: { stripeChargeId: chargeId, piId, refundedAmount, refundDelta, isFullRefund },
        });
    
        await incrementLedger({ totalRefunded: refundDelta });
    
        // Update booking status if it was CONFIRMED
        if (isFullRefund && (booking.status === 'CONFIRMED' || booking.status === 'PENDING_PAYMENT')) {
          await tx.booking.update({
            where: { id: bookingId },
            data: { status: 'CANCELLED' } as any,
          });
        }
    
        // Update transaction record
        await tx.transaction.updateMany({
          where: { bookingId, status: 'SETTLED' },
          data: { status: 'REFUNDED', processedAt: new Date() },
        });
    
        // Audit log
        try {
          await tx.auditLog.create({
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
      }, SERIALIZABLE_TX);
  }, { operationName: 'webhook-checkout-connect-account' });

  // Alert outside transaction (non-critical)
  void sendAlert({
    type: 'REFUND_SYNCED',
    severity: 'WARNING',
    message: `Out-of-band refund detected: $${refundDelta.toFixed(2)} new refund on booking ${bookingId} (issued directly in Stripe Dashboard)`,
    entityId: bookingId,
    metadata: { stripeChargeId: chargeId, piId, refundedAmount, isFullRefund, bookingStatus: booking.status },
  });

  logger.info(`âš ï¸ [REFUND SYNC] Out-of-band refund on booking ${bookingId}: $${refundDelta.toFixed(2)} new refund`);
}

// ============================================================================
// SPRINT C â€” STRIPE CONNECT TRANSFER FAILURE RECOVERY
// ============================================================================

/**
 * transfer.failed
 *
 * Fires when a Stripe Connect transfer to an instructor's account fails
 * (e.g. debit card transfer rejected, Connect account deactivated, etc.)
 *
 * Actions:
 *  1. Revert the Payout status from PAID â†’ FAILED
 *  2. Reverse the PAYOUT_PAID ledger entry (re-credit the platform)
 *  3. Alert operations + notify instructor
 */
async function handleTransferFailed(
  transfer: Stripe.Transfer,
  idempotencyKey: string,
): Promise<void> {
  const transferId = transfer.id;
  const amount = transfer.amount / 100;
  const providerId = transfer.metadata?.providerId ?? null;
  const payoutId = transfer.metadata?.payoutId ?? null;

  // MM-15-B FIX: recordWebhookEvent moved inside the SERIALIZABLE transaction so the
  // idempotency key is only committed if the full financial reversal also commits.
  // Previously the key was committed outside the transaction; a crash mid-reversal
  // consumed the key permanently, leaving the ledger inconsistent with no retry possible.
  //
  // MM-15-A FIX: stripeTransferId added to WHERE clause so a late transfer.failed event
  // for an original transfer cannot reverse a payout that was subsequently retried and
  // re-PAID with a different stripeTransferId.
  let reverted = { count: 0 };

  await withSerializableRetry(async () => {
    await prisma.$transaction(async (tx) => {
      // Claim this event atomically with the financial operations (MM-15-B)
      await recordWebhookEvent(tx, idempotencyKey, 'transfer.failed', transferId, {
        transferId,
        amount,
        providerId,
        payoutId,
        failureCode: (transfer as any).failure_code,
        failureMessage: (transfer as any).failure_message,
      });

      if (!payoutId) return;

      // MM-15-A: Filter on stripeTransferId so late events for superseded transfers
      // cannot reverse a payout that was successfully retried with a new transfer.
      reverted = await tx.payout.updateMany({
        where: { id: payoutId, status: 'PAID', stripeTransferId: transferId },
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
          providerId: providerId ?? undefined,
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

        logger.info(`[TRANSFER FAILED] Payout ${payoutId} reverted to FAILED — $${amount.toFixed(2)} re-credited to platform`);
      } else {
        // stripeTransferId did not match current PAID payout — late event for superseded transfer
        logger.info(`[TRANSFER FAILED] Transfer ${transferId} — no matching PAID payout with this transferId. No reversal applied (payout likely superseded by successful retry).`);
      }
    }, SERIALIZABLE_TX);
  }, { operationName: 'webhook-transfer-failed' });

  // Audit log (outside transaction — best-effort, non-critical)
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
          providerId,
          amount,
          failureCode: (transfer as any).failure_code,
          reversalApplied: reverted.count > 0,
        },
      },
    });
  } catch (auditErr) {
    logger.error('[TRANSFER FAILED] Audit log failed', {
      error: auditErr instanceof Error ? auditErr.message : String(auditErr),
    });
  }

  // Alert and instructor notification only when reversal was actually applied (MM-15-A)
  if (reverted.count > 0) {
    void sendAlert({
      type: 'TRANSFER_FAILED',
      severity: 'CRITICAL',
      message: `Stripe Connect transfer FAILED: $${amount.toFixed(2)} to instructor ${providerId ?? 'unknown'}. Payout ${payoutId ?? transferId} reverted to FAILED. Retry required.`,
      entityId: payoutId ?? transferId,
      metadata: {
        stripeTransferId: transferId,
        payoutId,
        providerId,
        amount,
        failureCode: (transfer as any).failure_code,
        failureMessage: (transfer as any).failure_message,
      },
    });

    if (providerId) {
      try {
        const instructor = await prisma.provider.findUnique({
          where: { id: providerId },
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
  }

  logger.info(`[TRANSFER FAILED] Transfer ${transferId} — $${amount.toFixed(2)} — instructor: ${providerId} — reversal: ${reverted.count > 0}`);
}


// ============================================================================

/**
 * Record webhook event for idempotency
 * CRITICAL: This prevents duplicate processing
 * 
 * @param db - Prisma client or transaction client. MUST be the transaction client
 *             when called inside a $transaction to ensure atomicity.
 */
async function recordWebhookEvent(
  db: Prisma.TransactionClient | typeof prisma,
  idempotencyKey: string,
  eventType: string,
  stripeEventId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    await db.webhookEvent.create({
      data: {
        idempotencyKey,
        eventType,
        stripeEventId,
        metadata: metadata as any, // Prisma InputJsonValue type
        processedAt: new Date(),
      },
    });
  } catch (error: any) {
    // The unique idempotencyKey constraint is the concurrency guard.
    // If another Stripe delivery already claimed the event, the current
    // transaction must roll back and the caller should return 200 duplicate.
    if (error?.code === 'P2002') {
      throw new DuplicateWebhookEventError(idempotencyKey);
    }
    throw error;
  }
}

// ============================================================================
// STRIPE CONNECT ACCOUNT HANDLER
// ============================================================================

/**
 * Handle Stripe Connect account.updated
 * Fired when an instructor completes (or updates) their Connect onboarding.
 * We mark payoutMethod as stripe_connect and record the account as active.
 * 
 * SECURITY: Verifies provider.stripeAccountId matches or is null before updating.
 * Prevents malicious account takeover via metadata spoofing.
 */
async function handleConnectAccountUpdated(
  account: Stripe.Account,
  idempotencyKey: string
): Promise<void> {
  const providerId = account.metadata?.providerId;
  if (!providerId) {
    await recordWebhookEvent(prisma, idempotencyKey, 'account.updated', account.id, {
      note: 'No providerId in metadata â€” skipped',
    });
    return;
  }

  const chargesEnabled = account.charges_enabled;
  const payoutsEnabled = account.payouts_enabled;
  const detailsSubmitted = account.details_submitted;

  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    select: { id: true, stripeAccountId: true },
  });

  if (!provider) {
    throw new Error(`Connect account references unknown provider: ${providerId}`);
  }

  if (provider.stripeAccountId && provider.stripeAccountId !== account.id) {
    void sendAlert({
      type: 'RECONCILIATION_ISSUES',
      severity: 'CRITICAL',
      message: `Stripe Connect account mismatch for provider ${providerId}. Existing=${provider.stripeAccountId}, received=${account.id}. Account association was NOT changed.`,
      entityId: providerId,
      metadata: {
        providerId,
        existingStripeAccountId: provider.stripeAccountId,
        receivedStripeAccountId: account.id,
      },
    });
    throw new Error(`Stripe Connect account mismatch for provider ${providerId}`);
  }

  await prisma.provider.update({
    where: { id: providerId },
    data: {
      stripeAccountId: account.id,
      // Store Connect onboarding state â€” used by buildPayout eligibility gate
      chargesEnabled,
      payoutsEnabled,
      // Persist detailsSubmitted for onboarding UI state
      detailsSubmitted,
      // Switch to stripe_connect automatically once onboarding is complete
      ...(chargesEnabled && payoutsEnabled ? { payoutMethod: 'stripe_connect' } : {}),
    } as any,
  });

  await recordWebhookEvent(prisma, idempotencyKey, 'account.updated', account.id, {
    providerId,
    chargesEnabled,
    payoutsEnabled,
    detailsSubmitted,
  });

  logger.info(`âœ… Connect account updated: instructor=${providerId} charges=${chargesEnabled} payouts=${payoutsEnabled}`);
}
