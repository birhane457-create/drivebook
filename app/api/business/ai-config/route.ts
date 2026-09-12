/**
 * GET /api/business/ai-config   — get AI receptionist config
 * PUT /api/business/ai-config   — update AI receptionist config
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const faqEntry = z.object({
  question: z.string().min(1).max(200),
  answer:   z.string().min(1).max(800),
})

const aiConfigSchema = z.object({
  businessDescription: z.string().min(10).max(1000).optional(),
  openingHours:        z.string().max(200).optional(),
  greetingScript:      z.string().max(300).optional().nullable(),
  personality:         z.enum(['professional', 'friendly', 'concise']).optional(),
  faq:                 z.array(faqEntry).max(20).optional(),
  allowedActions:      z.array(
    z.enum(['book', 'reschedule', 'cancel', 'quote', 'message', 'payment'])
  ).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.providerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const bizId = `biz_${session!.user!.providerId}`
    const config = await (prisma as any).businessAIConfig.findUnique({ where: { businessId: bizId } })
    return NextResponse.json(config ?? {})
  } catch (err) {
    console.error('[GET /api/business/ai-config]', err)
    return NextResponse.json({ error: 'Failed to load AI config' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.providerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check subscription — AI receptionist requires PRO+
    const instructor = await prisma.provider.findUnique({
      where: { id: session!.user!.providerId },
      select: { subscriptionTier: true },
    })
    const tier = instructor?.subscriptionTier ?? 'BASIC'
    if (!['PRO', 'STUDIO', 'PREMIUM'].includes(tier)) {
      return NextResponse.json({
        error: 'AI receptionist configuration requires a Pro subscription or higher.',
        upgrade: true,
      }, { status: 403 })
    }

    const body = await req.json()
    const parsed = aiConfigSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const bizId = `biz_${session!.user!.providerId}`
    const config = await (prisma as any).businessAIConfig.upsert({
      where: { businessId: bizId },
      create: { businessId: bizId, ...parsed.data },
      update: parsed.data,
    })

    return NextResponse.json({ success: true, aiConfig: config })
  } catch (err) {
    console.error('[PUT /api/business/ai-config]', err)
    return NextResponse.json({ error: 'Failed to update AI config' }, { status: 500 })
  }
}
