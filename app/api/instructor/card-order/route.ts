// app/api/instructor/card-order/route.ts
//
// Submit a physical card print request.
// Stores the order and emails the admin.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/services/auditLogger'

const CreateOrderSchema = z.object({
  quantity: z.number().int().min(50).max(500),
  suburbs:  z.string().max(80).optional(),
  notes:    z.string().max(300).optional(),
})

// ── POST — create a new card order ───────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.instructorId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = CreateOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }

  const { quantity, suburbs, notes } = parsed.data

  // Prevent duplicate pending orders
  const existing = await prisma.cardOrder.findFirst({
    where: {
      instructorId: session.user.instructorId,
      status: { in: ['PENDING', 'APPROVED', 'PRINTING'] },
    },
  })

  if (existing) {
    return NextResponse.json(
      { error: 'You already have an active card order in progress. Please wait until it is delivered before requesting more.' },
      { status: 409 },
    )
  }

  const order = await prisma.cardOrder.create({
    data: {
      instructorId: session.user.instructorId,
      quantity,
      suburbs:  suburbs ?? null,
      notes:    notes   ?? null,
      status:   'PENDING',
    },
  })

  await logAuditEvent({
    actorId:      session.user.id,
    actorRole:    'INSTRUCTOR',
    action:       'CARD_ORDER_REQUESTED',
    resourceType: 'BOOKING', // closest available type
    req,
  } as any)

  // Notify admin — best-effort (don't fail the request if email fails)
  try {
    const displayName = (session.user as any).name ?? session.user.email?.split('@')[0] ?? 'An instructor'
    await notifyAdmin(displayName, quantity, order.id)
  } catch (err) {
    console.error('[card-order] admin notification failed:', err)
  }

  return NextResponse.json({ success: true, orderId: order.id }, { status: 201 })
}

// ── GET — fetch current instructor's orders ───────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.instructorId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orders = await prisma.cardOrder.findMany({
    where: { instructorId: session.user.instructorId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  return NextResponse.json(orders)
}

// ── Admin email ───────────────────────────────────────────────────────────────
async function notifyAdmin(instructorName: string, quantity: number, orderId: string) {
  try {
    const { emailService } = await import('@/lib/services/email')
    await emailService.sendGenericEmail({
      to: process.env.ADMIN_EMAIL ?? 'admin@drivebook.com.au',
      subject: `New Card Order — ${instructorName} (${quantity} cards)`,
      html: `
        <p><strong>Instructor:</strong> ${instructorName}</p>
        <p><strong>Quantity:</strong> ${quantity} cards</p>
        <p><strong>Order ID:</strong> ${orderId}</p>
        <p><a href="https://drivebook.com.au/admin/card-orders">Review order</a></p>
      `,
    })
  } catch {
    // Email failure should not break the order flow
  }
}
