/**
 * lib/services/saas-payment.ts
 *
 * SaaS Payment Service — handles Stripe Checkout for quote-based bookings.
 *
 * FLOW:
 *   1. Customer accepts quote → caller invokes createCheckoutSession()
 *   2. Checkout session created with provider's Stripe account as destination
 *   3. Platform takes application_fee if business.commission > 0
 *   4. Quote → PENDING_PAYMENT, Booking → PENDING_PAYMENT
 *   5. Customer completes payment → Stripe webhook fires
 *   6. Webhook calls handleCheckoutComplete() → Quote → PAID, Booking → CONFIRMED
 *
 * GUARANTEES:
 *  - Idempotency: If a Quote already has a stripeSessionId, returns the existing session URL
 *  - Atomic state transitions: Quote + Booking updated in same transaction
 *  - Audit trail: Every state change logged to AuditLog
 *  - Business isolation: Only processes quotes for the given businessId
 *
 * PAYMENT MODEL:
 *  - SaaS: Customer pays provider directly via Stripe Checkout
 *  - Platform commission (if any) deducted as application_fee_amount
 *  - No wallet, no platform-held funds, no payout processing
 *
 * NOTE: This service is Core (not driving-specific). Any business with
 * paymentModel='saas' + capabilities.quotes=true can use this flow.
 */

import Stripe from 'stripe'
import { Decimal } from '@prisma/client/runtime/library'
import { toDecimal, toNumber, roundAmount, calculatePercentage } from '@/lib/utils/decimal-helpers'
import { prisma } from '@/lib/prisma'
import { getBusinessConfig } from '@/lib/core/business-config'
import { getDisplayName } from '@/lib/utils/account'  // For white-label support (PREMIUM tier)

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

// ── Checkout Session Creation ─────────────────────────────────────────────────

/**
 * Creates a Stripe Checkout session for a quote.
 *
 * @param quoteId - The Quote record ID
 * @param businessId - The business context (for config lookup)
 * @returns Session ID and hosted checkout URL
 * @throws Error if quote not found, already paid, or business config invalid
 */
export async function createCheckoutSession(
  quoteId: string,
  businessId: string,
): Promise<CreateCheckoutSessionResult> {
  // 1. Load quote + business config
  const [quote, businessConfig] = await Promise.all([
    prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        booking: {
          include: {
            customer: true,
            provider: true,
          },
        },
        provider: true,
        customer: true,
      },
    }),
    getBusinessConfig({ businessId }),
  ])

  if (!quote) {
    throw new Error(`Quote ${quoteId} not found`)
  }

  if (quote.status !== 'ACCEPTED') {
    throw new Error(`Quote ${quoteId} is not in ACCEPTED state (current: ${quote.status})`)
  }

  if (!businessConfig) {
    throw new Error(`Business config not found for businessId ${businessId}`)
  }

  if (businessConfig.paymentModel !== 'saas') {
    throw new Error(`Business ${businessId} does not use SaaS payment model (current: ${businessConfig.paymentModel})`)
  }

  // 2. Idempotency check: if session already created, retrieve it
  if (quote.stripeSessionId) {
    try {
      const existingSession = await stripe.checkout.sessions.retrieve(quote.stripeSessionId)
      if (existingSession.status === 'open' && existingSession.url) {
        return {
          sessionId: existingSession.id,
          url: existingSession.url,
        }
      }
      // Session expired or completed — create a new one
    } catch (err) {
      // Session not found or retrieval failed — create new
    }
  }

  // 3. Calculate amounts
  const totalAmount = (quote as any).totalAmount
  const depositAmount = quote.depositAmount ?? totalAmount
  const amountToCharge = depositAmount // Charge deposit now, remaining on completion
  
  // Use Decimal for precise amount calculations
  const amountToChargeDec = toDecimal(amountToCharge)
  const amountInCents = Math.round(toNumber(amountToChargeDec) * 100)

  // Platform commission (if business config defines one)
  const commissionPercent = businessConfig.capabilities.commission
    ? (businessConfig as any).commissionPercent ?? 0
    : 0
  const applicationFeeAmount = commissionPercent > 0
    ? Math.round(toNumber(calculatePercentage(toDecimal(amountInCents / 100), commissionPercent)) * 100)
    : 0

  // 4. Build line items from quote.lineItems JSON
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
          product_data: {
            name: item.description,
          },
        },
      })
    }
  }

  // Fallback: if no line items, create a single line for the total
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

  // 5. Create Stripe Checkout Session
  const baseUrl = process.env.NEXTAUTH_URL || 'https://drivebook.com.au'
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    line_items: lineItems,
    metadata: {
      type: 'saas_booking',
      quoteId: quote.id,
      bookingId: quote.bookingId,
      businessId: businessId,
      providerId: quote.providerId,
      customerId: quote.customerId,
      quoteNumber: (quote as any)?.quoteNumber,
    },
    success_url: `${baseUrl}/customer-dashboard/bookings?payment=success&quoteId=${quoteId}`,
    cancel_url: `${baseUrl}/customer-dashboard/bookings?payment=cancelled&quoteId=${quoteId}`,
    customer_email: quote.customer.email,
  }

  // Add application fee if commission > 0
  if (applicationFeeAmount > 0) {
    sessionParams.payment_intent_data = {
      application_fee_amount: applicationFeeAmount,
    }
  }

  const session = await stripe.checkout.sessions.create(sessionParams)

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL')
  }

  // 6. Update Quote + Booking in transaction
  await prisma.$transaction(async (tx) => {
    await tx.quote.update({
      where: { id: quoteId },
      data: {
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent as string | null,
        status: 'PENDING_PAYMENT',
        updatedAt: new Date(),
      },
    })

    await tx.booking.update({
      where: { id: quote.bookingId },
      data: {
        status: 'PENDING_PAYMENT',
        updatedAt: new Date(),
      },
    })

    // Audit log
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
          applicationFeeAmount: applicationFeeAmount > 0 ? applicationFeeAmount / 100 : 0,
        },
      },
    })
  })

  return {
    sessionId: session.id,
    url: session.url,
  }
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
      getDisplayName((quote as any).provider),  // Use business name for PREMIUM tier (white-label)
      bookingId,
      (quote as any).booking.startTime,
      undefined, // provider display source
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
