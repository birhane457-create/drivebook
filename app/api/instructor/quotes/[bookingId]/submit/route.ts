import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { submitQuote } from '@/lib/services/booking-service'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const lineItemSchema = z.object({
  description: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
})

const submitQuoteSchema = z.object({
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item required'),
  totalAmount: z.number().positive(),
  depositAmount: z.number().positive().optional(),
  notes: z.string().optional(),
  validDays: z.number().positive().default(7), // Match form field name
})

/**
 * POST /api/instructor/quotes/[bookingId]/submit
 * 
 * Provider submits a quote for a job request.
 * Can also be used to revise an existing quote (creates a new quote, marks old as REVISED).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { bookingId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.providerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const bookingId = params.bookingId
    const body = await req.json()
    const data = submitQuoteSchema.parse(body)

    // Verify booking belongs to this provider
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }) as any

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.providerId !== session!.user!.providerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (booking.status !== 'REQUEST_PENDING' && booking.status !== 'QUOTE_SENT') {
      return NextResponse.json({
        error: `Cannot submit quote for booking with status: ${booking.status}`,
      }, { status: 400 })
    }

    // Submit the quote
    const quote = await submitQuote(
      {
        bookingId,
        providerId: session!.user!.providerId,
        customerId: booking.customerId!,
        lineItems: data.lineItems as any,
        totalAmount: data.totalAmount,
        depositAmount: data.depositAmount,
        notes: data.notes,
        validityDays: data.validDays,
      } as any,
      session!.user!.id,
      'INSTRUCTOR' as any,
    )

    return NextResponse.json({
      success: true,
      quote: {
        id: (quote as any).id ?? (quote as any).quote?.id,
        quoteNumber: (quote as any).quoteNumber ?? (quote as any).quote?.quoteNumber,
        status: (quote as any).status ?? (quote as any).quote?.status,
        totalAmount: (quote as any).totalAmount ?? (quote as any).quote?.totalAmount,
        depositAmount: (quote as any).depositAmount ?? (quote as any).quote?.depositAmount,
        lineItems: (quote as any).lineItems ?? (quote as any).quote?.lineItems,
        expiresAt: (quote as any).expiresAt ?? (quote as any).quote?.expiresAt,
      },
    }, { status: 201 })
  } catch (error: any) {
    console.error('[POST /api/instructor/quotes/[bookingId]/submit] Error:', error)

    if (error.name === 'ZodError') {
      return NextResponse.json({
        error: 'Validation error',
        details: error.errors,
      }, { status: 400 })
    }

    return NextResponse.json({
      error: error.message || 'Failed to submit quote',
    }, { status: 500 })
  }
}
