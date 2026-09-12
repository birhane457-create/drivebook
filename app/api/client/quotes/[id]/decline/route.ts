import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { declineQuote } from '@/lib/services/booking-service'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const declineSchema = z.object({
  reason: z.string().optional(),
})

/**
 * POST /api/client/quotes/[id]/decline
 * 
 * Customer declines a quote.
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
    const body = await req.json()
    const data = declineSchema.parse(body)

    // Verify quote belongs to this customer
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
    })

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    if (quote.customerId !== session!.user!.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Decline the quote
    await declineQuote(
      quoteId,
      session!.user!.id,
      'CLIENT',
      data.reason
    )

    return NextResponse.json({
      success: true,
      quote: {
        id: quote.id,
        quoteNumber: (quote as any).quoteNumber,
        status: 'DECLINED',
      },
    })
  } catch (error: any) {
    console.error('[POST /api/client/quotes/[id]/decline] Error:', error)

    if (error.name === 'ZodError') {
      return NextResponse.json({
        error: 'Validation error',
        details: error.errors,
      }, { status: 400 })
    }

    return NextResponse.json({
      error: error.message || 'Failed to decline quote',
    }, { status: 500 })
  }
}
