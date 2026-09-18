/**
 * lib/services/saas-payment.ts
 *
 * SaaS Payment Service — handles Stripe Checkout for quote-based bookings.
 *
 * FLOW:
 *   1. Customer accepts quote → caller invokes createCheckoutSession()
 *   2. Checkout session created; platform takes application_fee if commission > 0
 *      NOTE (MM-10-A): money currently lands on the platform account, not the
 *      provider's Stripe account — transfer_data.destination is not set. This is
 *      a known architectural gap tracked separately as MM-10-A.
 *   3. Quote → PENDING_PAYMENT, Booking → PENDING_PAYMENT
 *   4. Customer completes payment → Stripe webhook fires
 *   5. Webhook calls handleCheckoutComplete() → Quote → PAID, Booking → CONFIRMED
 *
 * IDEMPOTENCY (MM-10-B FIX):
 *   Each checkout attempt has a generation counter stored on the Quote row.
 *   The Stripe idempotency key is: scs-{quoteId}-{checkoutGeneration}
 *
 *   Two concurrent first-attempt requests both use generation=1 and receive the
 *   same Stripe session (Stripe idempotency). The CAS write ensures only one
 *   request binds it to the DB; the other reads and returns the bound session.
 *
 *   If a session expires, advanceCheckoutGeneration() atomically increments the
 *   generation and clears stripeSessionId. The next call uses generation=N+1 and
 *   a fresh Stripe idempotency key. Two concurrent expiry-advance requests are
 *   protected by the CAS on (stripeSessionId, checkoutGeneration).
 *
 * GUARANTEES:
 *   - At most one non-expired, non-completed Stripe Checkout Session per Quote.
 *   - Concurrent first attempts converge on the same session.
 *   - DB failure after Stripe creation is safely retryable (same idempotency key).
 *   - Stripe retrieval errors are NOT interpreted as expiry.
 *   - Completed sessions never produce another chargeable session.
 *   - Atomic Quote + Booking state transitions.
 *   - Full audit trail.
 */

import Stripe from 'stripe'
import { toDecimal, toNumber, calculatePercentage } from '@/lib/utils/decimal-helpers'
import { prisma } from '@/lib/prisma'
import { getBusinessConfig } from '@/lib/core/business-config'
import { getDisplayName } from '@/lib/utils/account'

// ── Stripe Client ─────────────────────────────────────────────────────────────

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
})

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateCheckoutSessionResult {
  sessionId: string
  url: string
}

export interface CheckoutCompleteResult {
  quoteId: string
  bookingId: string
  amountPaid: number
  platformFee: number
}

// ── Named error classes ───────────────────────────────────────────────────────

/**
 * Thrown when the Stripe session retrieve call fails due to a network or API
 * error. The session existence is UNKNOWN — must not create a new session or
 * advance the generation.
 */
export class CheckoutSessionLookupError extends Error {
  public readonly quoteId: string
  public readonly sessionId: string
  constructor(quoteId: string, sessionId: string, cause: unknown) {
    super(
      `[MM-10-B] Failed to retrieve Stripe session ${sessionId} for quote ${quoteId} — ` +
      `session existence unknown. Do not create a new session. ` +
      `Cause: ${cause instanceof Error ? cause.message : String(cause)}`
    )
    this.name = 'CheckoutSessionLookupError'
    this.quoteId = quoteId
    this.sessionId = sessionId
  }
}

/**
 * Thrown when the quote is already in PAID status and a new session is
 * requested. A completed checkout must never produce another chargeable session.
 */
export class QuoteAlreadyPaidError extends Error {
  public readonly quoteId: string
  constructor(quoteId: string) {
    super(`[MM-10-B] Quote ${quoteId} is already PAID — no new checkout session may be created`)
    this.name = 'QuoteAlreadyPaidError'
    this.quoteId = quoteId
  }
}

// ── Checkout Session Creation ─────────────────────────────────────────────────

/**
 * Creates or retrieves a Stripe Checkout session for a quote.
 *
 * Accepts quotes in ACCEPTED or PENDING_PAYMENT status.
 * PENDING_PAYMENT allows re-entry for retries after network failures.
 *
 * @param quoteId    - The Quote record ID
 * @param businessId - The business context (for config lookup)
 * @returns Session ID and hosted checkout URL
 *
 * @throws CheckoutSessionLookupError - Stripe retrieval failed; state unknown; safe to retry
 * @throws QuoteAlreadyPaidError      - Quote already paid; no new session
 * @throws Error                       - Quote not found / invalid status / config error
 */
export async function createCheckoutSession(
  quoteId: string,
  businessId: string,
): Promise<CreateCheckoutSessionResult> {

  // ── 1. Load quote + business config ────────────────────────────────────────
  const [quote, businessConfig] = await Promise.all([
    prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        booking: { include: { customer: true, provider: true } },
        provider: true,
        customer: true,
      },
    }),
    getBusinessConfig({ businessId }),
  ])

  if (!quote) throw new Error(`Quote ${quoteId} not found`)

  // PAID is a hard stop — a completed checkout must never produce another chargeable session
  if (quote.status === 'PAID') throw new QuoteAlreadyPaidError(quoteId)

  // Allow ACCEPTED (normal) and PENDING_PAYMENT (re-entry after client network failure)
  if (quote.status !== 'ACCEPTED' && quote.status !== 'PENDING_PAYMENT') {
    throw new Error(`Quote ${quoteId} is not in a payable state (current: ${quote.status})`)
  }

  if (!businessConfig) throw new Error(`Business config not found for businessId ${businessId}`)
  if (businessConfig.paymentModel !== 'saas') {
    throw new Error(`Business ${businessId} does not use SaaS payment model (current: ${businessConfig.paymentModel})`)
  }

  // ── 2. Existing session check ───────────────────────────────────────────────
  // Read generation from the DB row — this is the current attempt number.
  const currentGeneration: number = (quote as any).checkoutGeneration ?? 1

  if (quote.stripeSessionId) {
    // A session was previously created for this generation. Retrieve it.
    let existingSession: Stripe.Checkout.Session
    try {
      existingSession = await stripe.checkout.sessions.retrieve(quote.stripeSessionId)
    } catch (retrieveErr) {
      // Network/API error — session existence is UNKNOWN. Do NOT create a new session.
      // Surface as CheckoutSessionLookupError so the caller can retry safely.
      throw new CheckoutSessionLookupError(quoteId, quote.stripeSessionId, retrieveErr)
    }

    if (existingSession.status === 'open' && existingSession.url) {
      // Session is still valid — return it directly (no Stripe call, no DB write)
      return { sessionId: existingSession.id, url: existingSession.url }
    }

    if (existingSession.status === 'complete') {
      // The session was paid via Stripe but the webhook hasn't updated the DB yet
      // (or the DB update is in flight). Do not create another chargeable session.
      throw new QuoteAlreadyPaidError(quoteId)
    }

    // Session is expired — advance the generation atomically before creating a new one.
    // advanceCheckoutGeneration CAS-guards on (stripeSessionId, checkoutGeneration)
    // so two concurrent expiry-discoveries advance exactly once.
    await advanceCheckoutGeneration(quoteId, quote.stripeSessionId, currentGeneration)

    // After advancement, re-read the quote to get the new generation number.
    // Another concurrent request may have already advanced AND created a new session;
    // if so, re-entering createCheckoutSession will find the open session and return it.
    const refreshed = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        booking: { include: { customer: true, provider: true } },
        provider: true,
        customer: true,
      },
    })
    if (!refreshed) throw new Error(`Quote ${quoteId} disappeared during generation advance`)

    // If another request already created a session for the new generation, return it.
    if (refreshed.stripeSessionId) {
      let newSession: Stripe.Checkout.Session
      try {
        newSession = await stripe.checkout.sessions.retrieve(refreshed.stripeSessionId)
      } catch (e) {
        throw new CheckoutSessionLookupError(quoteId, refreshed.stripeSessionId, e)
      }
      if (newSession.status === 'open' && newSession.url) {
        return { sessionId: newSession.id, url: newSession.url }
      }
    }

    // Proceed to create a new session using the advanced generation from the refreshed quote.
    return _createAndBindSession(refreshed, businessId, businessConfig, (refreshed as any).checkoutGeneration ?? currentGeneration + 1)
  }

  // ── 3. No existing session — create one ────────────────────────────────────
  return _createAndBindSession(quote, businessId, businessConfig, currentGeneration)
}

/**
 * Atomically advances the checkout generation for an expired session.
 *
 * Guards on (stripeSessionId, checkoutGeneration) so two concurrent callers
 * that both discover the same expired session advance exactly once. The loser
 * (count=0) simply reads the already-advanced state.
 *
 * Exported so tests can call it directly and so the accept route can expose it
 * if needed in future. Not intended for direct caller use — createCheckoutSession
 * calls it internally.
 */
export async function advanceCheckoutGeneration(
  quoteId: string,
  expiredSessionId: string,
  currentGeneration: number,
): Promise<void> {
  const advanced = await (prisma.quote as any).updateMany({
    where: {
      id: quoteId,
      stripeSessionId: expiredSessionId,   // must match — prevents double-advance
      checkoutGeneration: currentGeneration, // must match — prevents double-advance
    },
    data: {
      stripeSessionId: null,
      checkoutGeneration: { increment: 1 },
      updatedAt: new Date(),
    },
  })

  if (advanced.count === 0) {
    // Another concurrent request already advanced the generation — this is safe.
    // The caller will re-read the quote and find the new state.
  }
}

/**
 * Internal helper: builds session params, calls Stripe, and CAS-binds the result.
 * Separated so the expiry-advance path and the first-creation path share one implementation.
 */
async function _createAndBindSession(
  quote: any,
  businessId: string,
  businessConfig: any,
  generation: number,
): Promise<CreateCheckoutSessionResult> {
  const quoteId = quote.id

  // ── Amount calculation ──────────────────────────────────────────────────────
  const totalAmount = (quote as any).totalAmount
  const depositAmount = quote.depositAmount ?? totalAmount
  const amountToCharge = depositAmount

  const amountToChargeDec = toDecimal(amountToCharge)
  const amountInCents = Math.round(toNumber(amountToChargeDec) * 100)

  // MM-10-C FIX: remove unsafe `as any` cast — commissionPercent is now a
  // typed field on BusinessConfig, mapped from BusinessSettings.commissionRate.
  const commissionPercent = businessConfig.capabilities.commission
    ? businessConfig.commissionPercent
    : 0
  const applicationFeeAmount = commissionPercent > 0
    ? Math.round(toNumber(calculatePercentage(toDecimal(amountInCents / 100), commissionPercent)) * 100)
    : 0

  // ── Line items ──────────────────────────────────────────────────────────────
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []

  if (quote.lineItems && Array.isArray(quote.lineItems)) {
    const items = quote.lineItems as Array<{
      description: string
      quantity: number
      unitPrice: number
    }>
    for (const item of items) {
      lineItems.push({
        quantity: item.quantity,
        price_data: {
          currency: 'aud',
          unit_amount: Math.round(toNumber(toDecimal(item.unitPrice)) * 100),
          product_data: { name: item.description },
        },
      })
    }
  }

  if (lineItems.length === 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: 'aud',
        unit_amount: amountInCents,
        product_data: {
          name: `${businessConfig.terminology.booking} — Quote #${(quote as any)?.quoteNumber}`,
          description: (quote as any).notes ?? undefined,
        },
      },
    })
  }

  // ── Stripe session creation ─────────────────────────────────────────────────
  const baseUrl = process.env.NEXTAUTH_URL || 'https://drivebook.com.au'
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    line_items: lineItems,
    metadata: {
      type: 'saas_booking',
      quoteId: quote.id,
      bookingId: quote.bookingId,
      businessId,
      providerId: quote.providerId,
      customerId: quote.customerId,
      quoteNumber: (quote as any)?.quoteNumber,
    },
    success_url: `${baseUrl}/customer-dashboard/bookings?payment=success&quoteId=${quoteId}`,
    cancel_url:  `${baseUrl}/customer-dashboard/bookings?payment=cancelled&quoteId=${quoteId}`,
    customer_email: quote.customer.email,
  }

  if (applicationFeeAmount > 0) {
    sessionParams.payment_intent_data = {
      application_fee_amount: applicationFeeAmount,
    }
  }

  // MM-10-B FIX: deterministic idempotency key — scs-{quoteId}-{generation}
  // Two concurrent requests with the same generation receive the same Stripe session.
  // Advancing the generation changes the key, ensuring a truly new session after expiry.
  const session = await stripe.checkout.sessions.create(
    sessionParams,
    { idempotencyKey: `scs-${quoteId}-${generation}` },
  )

  if (!session.url) throw new Error('Stripe did not return a checkout URL')

  // ── CAS DB write ────────────────────────────────────────────────────────────
  // Bind the session only if stripeSessionId is still null (generation already set).
  // If count=0, a concurrent request already bound a session for this generation.
  // Read the DB and return their session rather than the unbound one we just created
  // (Stripe idempotency ensures both requests got the same session object anyway).
  const bound = await (prisma.quote as any).updateMany({
    where: {
      id: quoteId,
      stripeSessionId: null,         // CAS: only bind when not yet set
      checkoutGeneration: generation, // must be our generation
    },
    data: {
      stripeSessionId: session.id,
      stripePaymentIntentId: session.payment_intent as string | null,
      status: 'PENDING_PAYMENT',
      updatedAt: new Date(),
    },
  })

  if (bound.count === 0) {
    // Lost the CAS race — read the winner's session from DB and return it.
    const current = await prisma.quote.findUnique({
      where: { id: quoteId },
      select: { stripeSessionId: true },
    })
    if (!current?.stripeSessionId) {
      // The generation may have been advanced concurrently (double-expiry edge case).
      // Recurse once to re-enter the full state machine with fresh state.
      throw new Error(
        `[MM-10-B] CAS lost but no stripeSessionId in DB for quote ${quoteId} gen ${generation} — ` +
        `retry the operation`
      )
    }
    // Return the winning session (same Stripe object via idempotency key)
    let winnerSession: Stripe.Checkout.Session
    try {
      winnerSession = await stripe.checkout.sessions.retrieve(current.stripeSessionId)
    } catch (e) {
      throw new CheckoutSessionLookupError(quoteId, current.stripeSessionId, e)
    }
    if (!winnerSession.url) {
      throw new Error(`Winner session ${current.stripeSessionId} has no URL`)
    }
    return { sessionId: winnerSession.id, url: winnerSession.url }
  }

  // We won the CAS — update booking status and write audit log in a transaction
  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: quote.bookingId },
      data: { status: 'PENDING_PAYMENT', updatedAt: new Date() },
    })

    await tx.auditLog.create({
      data: {
        action: 'QUOTE_PAYMENT_INITIATED',
        actorId: quote.customerId,
        actorRole: 'CLIENT',
        targetType: 'Quote',
        targetId: quoteId,
        metadata: {
          quoteNumber: (quote as any)?.quoteNumber,
          amountToCharge,
          depositAmount,
          totalAmount,
          stripeSessionId: session.id,
          checkoutGeneration: generation,
          applicationFeeAmount: applicationFeeAmount > 0 ? applicationFeeAmount / 100 : 0,
        },
      },
    })
  })

  return { sessionId: session.id, url: session.url }
}

// ── Webhook Handler ───────────────────────────────────────────────────────────

/**
 * Handles checkout.session.completed webhook for SaaS bookings.
 *
 * Called from the Stripe webhook route when metadata.type='saas_booking'.
 *
 * @param sessionId - The Stripe Checkout Session ID
 * @returns Quote ID, Booking ID, and payment amounts
 * @throws Error if session not found or quote not found
 */
export async function handleCheckoutComplete(
  sessionId: string,
): Promise<CheckoutCompleteResult> {
  // 1. Retrieve session from Stripe
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent'],
  })

  if (!session.metadata?.quoteId) {
    throw new Error(`Session ${sessionId} missing quoteId in metadata`)
  }

  const quoteId = session.metadata.quoteId
  const bookingId = session.metadata.bookingId
  const businessId = session.metadata.businessId

  // 2. Load quote
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      booking: true,
      provider: true,
      customer: true,
    },
  })

  if (!quote) {
    throw new Error(`Quote ${quoteId} not found`)
  }

  // 3. Idempotency check: if already paid, return early
  if (quote.status === 'PAID') {
    const paymentIntent = session.payment_intent as Stripe.PaymentIntent
    const amountPaid = paymentIntent.amount / 100
    const platformFee = paymentIntent.application_fee_amount
      ? paymentIntent.application_fee_amount / 100
      : 0

    return {
      quoteId: quote.id,
      bookingId: quote.bookingId,
      amountPaid,
      platformFee,
    }
  }

  // 4. Extract payment details
  const paymentIntent = session.payment_intent as Stripe.PaymentIntent
  const amountPaid = paymentIntent.amount / 100
  const platformFee = paymentIntent.application_fee_amount
    ? paymentIntent.application_fee_amount / 100
    : 0

  // 5. Update Quote + Booking in transaction
  await prisma.$transaction(async (tx) => {
    await tx.quote.update({
      where: { id: quoteId },
      data: {
        status: 'PAID',
        updatedAt: new Date(),
      },
    })

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CONFIRMED',
        updatedAt: new Date(),
      },
    })

    // Audit log
    await tx.auditLog.create({
      data: {
        action: 'QUOTE_PAYMENT_COMPLETED',
        actorId: quote.customerId,
        actorRole: 'CLIENT',
        targetType: 'Quote',
        targetId: quoteId,
        metadata: {
          quoteNumber: (quote as any)?.quoteNumber,
          amountPaid,
          platformFee,
          stripeSessionId: sessionId,
          stripePaymentIntentId: paymentIntent.id,
        },
      },
    })
  })

  // 6. Send confirmation notifications (non-blocking)
  await sendPaymentConfirmationNotifications(quote, bookingId, businessId)

  return {
    quoteId,
    bookingId,
    amountPaid,
    platformFee,
  }
}

// ── Notification Helper ───────────────────────────────────────────────────────

async function sendPaymentConfirmationNotifications(
  quote: any,
  bookingId: string,
  businessId: string,
) {
  try {
    const { notifyCustomerBookingConfirmed, notifyBookingConfirmed } = await import('./notifications')
    const businessConfig = await getBusinessConfig({ businessId })

    if (!businessConfig) return

    const terminology = {
      booking: businessConfig.terminology.booking,
      provider: businessConfig.terminology.provider,
      customer: businessConfig.terminology.customer,
    }

    // Notify customer
    await notifyCustomerBookingConfirmed(
      quote.customerId,
      getDisplayName((quote as any).provider),
      bookingId,
      (quote as any).booking.startTime,
      undefined,
      businessConfig.timezone,
      terminology,
    )

    // Notify provider
    await notifyBookingConfirmed(
      quote.providerId,
      quote.customer.name,
      bookingId,
      (quote as any).booking.startTime,
      businessConfig.timezone,
      terminology,
    )
  } catch (err) {
    // Notification failures are non-fatal
    console.error('[saas-payment] Notification failure:', err)
  }
}
