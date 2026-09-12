/**
 * GET /api/business/branding   — get branding config
 * PUT /api/business/branding   — update branding config
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const hexColour = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a hex colour (#RRGGBB)')

const brandingSchema = z.object({
  logo:                 z.string().url().optional().nullable(),
  primaryColour:        hexColour.optional(),
  secondaryColour:      hexColour.optional().nullable(),
  fontFamily:           z.string().max(60).optional().nullable(),
  theme:                z.enum(['light', 'dark']).optional(),
  showPlatformBranding: z.boolean().optional(),
  customSlug:           z.string()
                         .regex(/^[a-z0-9-]{3,40}$/, 'Use lowercase letters, numbers and hyphens (3–40 chars)')
                         .optional()
                         .nullable(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.providerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const bizId = `biz_${session!.user!.providerId}`
    const branding = await (prisma as any).businessBranding.findUnique({ where: { businessId: bizId } })
    return NextResponse.json(branding ?? {})
  } catch (err) {
    console.error('[GET /api/business/branding]', err)
    return NextResponse.json({ error: 'Failed to load branding' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.providerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = brandingSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const bizId = `biz_${session!.user!.providerId}`

    // Slug uniqueness check
    if (parsed.data.customSlug) {
      const existing = await (prisma as any).businessBranding.findFirst({
        where: { customSlug: parsed.data.customSlug, NOT: { businessId: bizId } },
      })
      if (existing) {
        return NextResponse.json({ error: 'This URL slug is already taken. Please choose another.' }, { status: 400 })
      }
    }

    const branding = await (prisma as any).businessBranding.upsert({
      where: { businessId: bizId },
      create: { businessId: bizId, ...parsed.data },
      update: parsed.data,
    })

    // Mirror back to Instructor for backward compatibility
    await prisma.provider.updateMany({
      where: { id: session!.user!.providerId },
      data: {
        brandLogo:            parsed.data.logo          ?? undefined,
        brandColorPrimary:    parsed.data.primaryColour ?? undefined,
        brandColorSecondary:  parsed.data.secondaryColour ?? undefined,
        customSlug:           parsed.data.customSlug    ?? undefined,
        showBrandingOnBookingPage: parsed.data.showPlatformBranding === false,
      },
    })

    return NextResponse.json({ success: true, branding })
  } catch (err) {
    console.error('[PUT /api/business/branding]', err)
    return NextResponse.json({ error: 'Failed to update branding' }, { status: 500 })
  }
}
