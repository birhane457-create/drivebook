import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { acceptQuote } from '@/lib/services/booking-service'
import { createCheckoutSession } from '@/lib/services/saas-payment'

export const dynamic = 'force-dynamic'

/**
 * POST /api/client/quotes/[id]/accept
 * 
 * Customer accepts a quote. Flow:
 * 1. acceptQuote() → Quote→ACCEPTED, Booking→QUOTE_ACCEPTED
 * 2. createCheckoutSession() → Stripe Checkout created, Quote→PENDING_PAYMENT
 * 3. Returns checkout URL for customer to complete payment
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

    if (quote.status !== 'PENDING' && quote.status !== 'ACCEPTED') {
      return NextResponse.json({
        error: `Quote cannot be accepted (current status: ${quote.status})`,
      }, { status: 400 })
    }

    // Accept the quote (if not already accepted)
    if (quote.status === 'PENDING') {
      await acceptQuote(
        quoteId,
        session!.user!.id,
        'CLIENT'
      )
    }

    // Get business ID from provider
    const businessId = `biz_${quote.providerId}`

    // Create Stripe Checkout session for payment
    const checkoutResult = await createCheckoutSession(quoteId, businessId)

    return NextResponse.json({
      success: true,
      quote: {
        id: quote.id,
        quoteNumber: (quote as any).quoteNumber,
        status: 'ACCEPTED',
        totalAmount: (quote as any).totalAmount,
      },
      payment: {
        sessionId: checkoutResult.sessionId,
        checkoutUrl: checkoutResult.url,
      },
    })
  } catch (error: any) {
    console.error('[POST /api/client/quotes/[id]/accept] Error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to accept quote',
    }, { status: 500 })
  }
}
