import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  cancelPdaBooking,
  PdaRefundConflictError,
} from '@/lib/services/pda-financial-operations'

export const dynamic = 'force-dynamic'

const cancelSchema = z.object({
  reason: z.string().max(500).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const idempotencyKey = request.headers.get('Idempotency-Key')?.trim()
    if (!idempotencyKey || idempotencyKey.length > 128) {
      return NextResponse.json({ error: 'A valid Idempotency-Key is required' }, { status: 400 })
    }

    const parsedBody = cancelSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsedBody.success) {
      return NextResponse.json({ error: 'Invalid cancellation request' }, { status: 400 })
    }

    const result = await cancelPdaBooking({
      pdaBookingId: params.id,
      userId: user.id,
      idempotencyKey: `pda-cancel:${user.id}:${params.id}:${idempotencyKey}`,
      reason: parsedBody.data.reason,
    })

    return NextResponse.json({
      success: true,
      pdaBookingId: params.id,
      bookingStatus: result.status,
      financialStatus: result.financialStatus,
      refundAmount: result.refundAmount,
      replayed: result.replayed,
    })
  } catch (error) {
    if (error instanceof PdaRefundConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    if (error instanceof Error && error.message === 'PDA booking not found') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('[PDA cancellation] Failed to cancel PDA booking:', error)
    return NextResponse.json({ error: 'Failed to cancel PDA booking' }, { status: 500 })
  }
}
