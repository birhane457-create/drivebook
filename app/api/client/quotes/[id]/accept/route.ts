import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { acceptQuote } from '@/lib/services/booking-service'
import {
  createCheckoutSession,
  CheckoutSessionLookupError,
  QuoteAlreadyPaidError,
} from '@/lib/services/saas-payment'

export const dynamic = 'force-dynamic'

/**
 * POST /api/client/quotes/[id]/accept
 *
 * Customer accepts a quote. Flow:
 * 1. acceptQuote() → Quote→ACCEPTED, Booking→QUOTE_ACCEPTED  (skipped if already ACCEPTED/PENDING_PAYMENT)
 * 2. createCheckoutSession() → Stripe Checkout created, Quote→PENDING_PAYMENT
 * 3. Returns checkout URL for customer to complete payment
 *
 * MM-10-B: PENDING_PAYMENT is now an allowed re-entry status. This handles the
 * case where the client network failed after the session was created but before
 * the URL was returned. createCheckoutSession() retrieves the existing open
 * session and returns its URL without creating a new Stripe Checkout Session.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const quoteId = params.id

    // Verify quote belongs to this customer
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        booking: {
          include: {
            provider: true,
          },
        },
      },
    })

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    if (quote.customerId !== session!.user!.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // MM-10-B: allow PENDING_PAYMENT for re-entry after client network failure.
    // createCheckoutSession() will retrieve the existing open session and return
    // its URL without creating a new Stripe Checkout Session.
    if (
      quote.status !== 'PENDING' &&
      quote.status !== 'ACCEPTED' &&
      quote.status !== 'PENDING_PAYMENT'
    ) {
      return NextResponse.json({
        error: `Quote cannot be accepted (current status: ${quote.status})`,
      }, { status: 400 })
    }

    // Accept the quote if not already past that step
    if (quote.status === 'PENDING') {
      await acceptQuote(quoteId, session!.user!.id, 'CLIENT')
    }

    // Get business ID from provider
    const businessId = `biz_${quote.providerId}`

    // Create or retrieve Stripe Checkout session for payment
    const checkoutResult = await createCheckoutSession(quoteId, businessId)

    return NextResponse.json({
      success: true,
      quote: {
        id: quote.id,
        quoteNumber: (quote as any).quoteNumber,
        status: quote.status === 'PENDING_PAYMENT' ? 'PENDING_PAYMENT' : 'ACCEPTED',
        totalAmount: (quote as any).totalAmount,
      },
      payment: {
        sessionId: checkoutResult.sessionId,
        checkoutUrl: checkoutResult.url,
      },
    })
  } catch (error: any) {
    // MM-10-B: surface named error types with appropriate HTTP codes.

    if (error instanceof QuoteAlreadyPaidError) {
      // Quote is already paid — no new checkout session is permitted.
      return NextResponse.json(
        { error: 'This quote has already been paid', code: 'QUOTE_ALREADY_PAID' },
        { status: 409 }
      )
    }

    if (error instanceof CheckoutSessionLookupError) {
      // Stripe retrieval failed; session existence is unknown. Safe to retry.
      // Return 503 so the client knows to retry rather than assuming failure.
      return NextResponse.json(
        {
          error: 'Payment service temporarily unavailable — please try again',
          code: 'CHECKOUT_SESSION_LOOKUP_FAILED',
        },
        { status: 503 }
      )
    }

    console.error('[POST /api/client/quotes/[id]/accept] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to accept quote' },
      { status: 500 }
    )
  }
}
