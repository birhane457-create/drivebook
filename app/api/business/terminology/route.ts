/**
 * GET /api/business/terminology   — get terminology config
 * PUT /api/business/terminology   — update terminology config
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const label = z.string().min(1).max(40)

const terminologySchema = z.object({
  provider:      label.optional(),
  providers:     label.optional(),
  customer:      label.optional(),
  customers:     label.optional(),
  booking:       label.optional(),
  bookings:      label.optional(),
  service:       label.optional(),
  services:      label.optional(),
  providerGroup: label.optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.providerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const bizId = `biz_${session!.user!.providerId}`
    const terminology = await (prisma as any).businessTerminology.findUnique({ where: { businessId: bizId } })
    return NextResponse.json(terminology ?? {})
  } catch (err) {
    console.error('[GET /api/business/terminology]', err)
    return NextResponse.json({ error: 'Failed to load terminology' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.providerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = terminologySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const bizId = `biz_${session!.user!.providerId}`
    const terminology = await (prisma as any).businessTerminology.upsert({
      where: { businessId: bizId },
      create: { businessId: bizId, ...parsed.data },
      update: parsed.data,
    })

    return NextResponse.json({ success: true, terminology })
  } catch (err) {
    console.error('[PUT /api/business/terminology]', err)
    return NextResponse.json({ error: 'Failed to update terminology' }, { status: 500 })
  }
}
