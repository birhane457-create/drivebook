/**
 * GET    /api/business/services/[id]  — get a service
 * PUT    /api/business/services/[id]  — update a service
 * DELETE /api/business/services/[id]  — delete a service
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSchema = z.object({
  name:             z.string().min(1).max(80).optional(),
  description:      z.string().max(500).optional().nullable(),
  duration:         z.number().int().min(0).max(480).optional(),
  price:            z.number().min(0).optional(),
  sortOrder:        z.number().int().optional(),
  isActive:         z.boolean().optional(),
  bookingMode:      z.enum(['appointment', 'request', 'package']).optional(),
  locationMode:     z.enum(['provider_travels', 'customer_travels', 'remote', 'flexible']).optional(),
  providerRequired: z.boolean().optional(),
  depositPercent:   z.number().min(0).max(100).optional().nullable(),
  payOnBooking:     z.boolean().optional(),
  payOnCompletion:  z.boolean().optional(),
  quoteRequired:    z.boolean().optional(),
  freeCancellationHours: z.number().int().min(0).optional(),
  refundPercent:    z.number().min(0).max(100).optional(),
  minAdvanceHours:  z.number().int().min(0).optional(),
  maxAdvanceDays:   z.number().int().min(1).optional(),
  aiCanBook:        z.boolean().optional(),
  aiCanQuote:       z.boolean().optional(),
})

async function getOwnedService(serviceId: string, providerId: string) {
  const bizId = `biz_${providerId}`
  return (prisma as any).businessService.findFirst({
    where: { id: serviceId, businessId: bizId },
  })
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.providerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = await getOwnedService(params.id, session!.user!.providerId)
  if (!service) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(service)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.providerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = await getOwnedService(params.id, session!.user!.providerId)
  if (!service) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const updated = await (prisma as any).businessService.update({
    where: { id: params.id },
    data: parsed.data,
  })
  return NextResponse.json({ success: true, service: updated })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.providerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = await getOwnedService(params.id, session!.user!.providerId)
  if (!service) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await (prisma as any).businessService.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
