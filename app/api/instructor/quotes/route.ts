import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/instructor/quotes
 * 
 * Provider lists all quotes for their bookings.
 * Includes pending requests, submitted quotes, accepted/declined quotes.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.providerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    const where: any = {
      providerId: session!.user!.providerId,
    }

    if (status) {
      where.status = status
    }

    const quotes = await prisma.quote.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        booking: {
          select: {
            id: true,
            status: true,
            serviceId: true,
            requestDescription: true,
            preferredDate: true,
            siteAddress: true,
            requestedAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      quotes: quotes.map(q => ({
        id: q.id,
        quoteNumber: (q as any)?.quoteNumber,
        status: q.status,
        totalAmount: (q as any).totalAmount,
        depositAmount: q.depositAmount,
        lineItems: q.lineItems,
        notes: (q as any).notes,
        expiresAt: (q as any).expiresAt,
        createdAt: q.createdAt,
        customer: q.customer,
        booking: q.booking,
      })),
    })
  } catch (error: any) {
    console.error('[GET /api/instructor/quotes] Error:', error)
    return NextResponse.json({
      error: 'Failed to fetch quotes',
    }, { status: 500 })
  }
}
