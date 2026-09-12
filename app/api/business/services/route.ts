/**
 * GET  /api/business/services        — list all services
 * POST /api/business/services        — create a service
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const serviceSchema = z.object({
  name:             z.string().min(1).max(80),
  description:      z.string().max(500).optional().nullable(),
  duration:         z.number().int().min(0).max(480),
  price:            z.number().min(0),
  sortOrder:        z.number().int().optional(),
  bookingMode:      z.enum(['appointment', 'request', 'package']).default('appointment'),
  locationMode:     z.enum(['provider_travels', 'customer_travels', 'remote', 'flexible']).default('flexible'),
  providerRequired: z.boolean().default(true),
  depositPercent:   z.number().min(0).max(100).optional().nullable(),
  payOnBooking:     z.boolean().default(true),
  payOnCompletion:  z.boolean().default(false),
  quoteRequired:    z.boolean().default(false),
  freeCancellationHours: z.number().int().min(0).default(48),
  refundPercent:    z.number().min(0).max(100).default(100),
  minAdvanceHours:  z.number().int().min(0).default(2),
  maxAdvanceDays:   z.number().int().min(1).default(60),
  aiCanBook:        z.boolean().default(false),
  aiCanQuote:       z.boolean().default(false),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.providerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const bizId = `biz_${session!.user!.providerId}`
    const services = await (prisma as any).businessService.findMany({
      where: { businessId: bizId },
      orderBy: { sortOrder: 'asc' },
    })
    return NextResponse.json(services)
  } catch (err) {
    console.error('[GET /api/business/services]', err)
    return NextResponse.json({ error: 'Failed to load services' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.providerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = serviceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const bizId = `biz_${session!.user!.providerId}`

    // Default sortOrder to end of list
    if (parsed.data.sortOrder === undefined) {
      const count = await (prisma as any).businessService.count({ where: { businessId: bizId } })
      parsed.data.sortOrder = count
    }

    const service = await (prisma as any).businessService.create({
      data: { businessId: bizId, ...parsed.data },
    })

    return NextResponse.json({ success: true, service }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/business/services]', err)
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 })
  }
}
