import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/client/quotes
 * 
 * Customer lists all their quotes (pending, accepted, declined, etc.)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const quotes = await prisma.quote.findMany({
      where: {
        customerId: session!.user!.id,
      },
      include: {
        provider: {
          select: {
            id: true,
            name: true,
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
        provider: (q as any).provider,
        booking: (q as any).booking,
      })),
    })
  } catch (error: any) {
    console.error('[GET /api/client/quotes] Error:', error)
    return NextResponse.json({
      error: 'Failed to fetch quotes',
    }, { status: 500 })
  }
}
