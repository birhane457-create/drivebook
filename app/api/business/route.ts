/**
 * GET  /api/business         — get the current provider's business config
 * POST /api/business         — create a new business (onboarding)
 * PUT  /api/business         — update business identity fields
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSchema = z.object({
  name:         z.string().min(1).max(80).optional(),
  legalName:    z.string().max(100).optional().nullable(),
  abn:          z.string().max(14).optional().nullable(),
  supportEmail: z.string().email().optional(),
  phone:        z.string().max(20).optional().nullable(),
  timezone:     z.string().optional(),
})

// Helper — resolve or create a Business record for the current provider
async function resolveOrCreateBusiness(providerId: string, session: any) {
  const bizId = `biz_${providerId}`
  const existing = await (prisma as any).business.findUnique({ where: { id: bizId } })
  if (existing) return existing

  // Auto-create from Instructor data (migration fallback)
  const instructor = await prisma.provider.findUnique({
    where: { id: providerId },
    include: { user: { select: { email: true } } },
  })
  if (!instructor) return null

  return (prisma as any).business.create({
    data: {
      id: bizId,
      name: instructor.businessName ?? instructor.name,
      legalName: instructor.businessName ?? instructor.name,
      abn: instructor.abn ?? undefined,
      supportEmail: instructor.user?.email ?? session!.user!.email,
      phone: instructor.phone,
      timezone: instructor.timezone ?? 'Australia/Perth',
      templateSlug: 'driving',
      subscriptionTier: instructor.subscriptionTier ?? 'BASIC',
      isActive: instructor.isActive,
    },
  })
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.providerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { getBusinessConfig } = await import('@/lib/core/business-config')
    const config = await getBusinessConfig({ providerId: session!.user!.providerId })
    return NextResponse.json(config)
  } catch (err) {
    console.error('[GET /api/business]', err)
    return NextResponse.json({ error: 'Failed to load business config' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.providerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const business = await resolveOrCreateBusiness(session!.user!.providerId, session)
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

    const updated = await (prisma as any).business.update({
      where: { id: business.id },
      data: parsed.data,
    })

    return NextResponse.json({ success: true, business: updated })
  } catch (err) {
    console.error('[PUT /api/business]', err)
    return NextResponse.json({ error: 'Failed to update business' }, { status: 500 })
  }
}
