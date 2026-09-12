/**
 * GET /api/business/capabilities   — get capabilities config
 * PUT /api/business/capabilities   — update capabilities config
 *
 * Subscription tier guards what can be enabled.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const capabilitiesSchema = z.object({
  onlineBooking:        z.boolean().optional(),
  onlinePayments:       z.boolean().optional(),
  quotes:               z.boolean().optional(),
  packages:             z.boolean().optional(),
  waitingList:          z.boolean().optional(),
  reviews:              z.boolean().optional(),
  aiReceptionist:       z.boolean().optional(),
  voiceLine:            z.boolean().optional(),
  mobileApp:            z.boolean().optional(),
  googleCalendar:       z.boolean().optional(),
  documentVerification: z.boolean().optional(),
  travelTime:           z.boolean().optional(),
  assessmentTracking:   z.boolean().optional(),
  websiteBuilder:       z.boolean().optional(),
})

// Capabilities gated behind PRO+
const PRO_CAPABILITIES = new Set([
  'waitingList', 'aiReceptionist', 'voiceLine',
  'documentVerification', 'travelTime', 'assessmentTracking',
])

// Capabilities gated behind STUDIO+
const STUDIO_CAPABILITIES = new Set<string>()

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.providerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const bizId = `biz_${session!.user!.providerId}`
    const caps = await (prisma as any).businessCapabilities.findUnique({ where: { businessId: bizId } })
    return NextResponse.json(caps ?? {})
  } catch (err) {
    console.error('[GET /api/business/capabilities]', err)
    return NextResponse.json({ error: 'Failed to load capabilities' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.providerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = capabilitiesSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    // Check subscription tier
    const instructor = await prisma.provider.findUnique({
      where: { id: session!.user!.providerId },
      select: { subscriptionTier: true },
    })
    const tier = instructor?.subscriptionTier ?? 'BASIC'
    const isPro = ['PRO', 'STUDIO', 'PREMIUM'].includes(tier)

    // Gate PRO capabilities
    const data = { ...parsed.data }
    for (const [key, value] of Object.entries(data)) {
      if (value === true && PRO_CAPABILITIES.has(key) && !isPro) {
        return NextResponse.json({
          error: `The "${key}" capability requires a Pro subscription or higher.`,
          upgrade: true,
        }, { status: 403 })
      }
    }

    const bizId = `biz_${session!.user!.providerId}`
    const capabilities = await (prisma as any).businessCapabilities.upsert({
      where: { businessId: bizId },
      create: { businessId: bizId, ...data },
      update: data,
    })

    return NextResponse.json({ success: true, capabilities })
  } catch (err) {
    console.error('[PUT /api/business/capabilities]', err)
    return NextResponse.json({ error: 'Failed to update capabilities' }, { status: 500 })
  }
}
