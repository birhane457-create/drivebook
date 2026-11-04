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
  // V-03 FIX: customDomain was previously absent from the Zod schema, causing
  // the field to be silently dropped when sent via /api/business/branding PUT.
  // Domain verification still goes through /api/instructor/domain/verify which
  // enforces DNS + ownership checks. This field is accepted here for persistence
  // but does NOT set domainVerified (that remains the verify endpoint's responsibility).
  customDomain:         z.string()
                         .regex(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i,
                           'Invalid domain format')
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
      // Check uniqueness in BusinessBranding table
      const existingBiz = await (prisma as any).businessBranding.findFirst({
        where: { customSlug: parsed.data.customSlug, NOT: { businessId: bizId } },
      })
      if (existingBiz) {
        return NextResponse.json({ error: 'This URL slug is already taken. Please choose another.' }, { status: 400 })
      }

      // V-16 FIX: Also check Provider.customSlug — the legacy branding PUT writes
      // slugs directly to Provider without going through BusinessBranding.
      // Without this check, a slug unique in BusinessBranding can collide with
      // an existing Provider.customSlug set via the legacy path.
      const existingProvider = await prisma.provider.findFirst({
        where: {
          customSlug: parsed.data.customSlug,
          id: { not: session!.user!.providerId },
        },
        select: { id: true },
      })
      if (existingProvider) {
        return NextResponse.json({ error: 'This URL slug is already taken. Please choose another.' }, { status: 400 })
      }
    }

    // V-03 FIX: customDomain is accepted by the Zod schema but BusinessBranding
    // table does not have a customDomain column. Extract it before upsert.
    const { customDomain: _domainForProvider, ...brandingData } = parsed.data;

    // WLA-014-SLUG: Read the current slug from BusinessBranding before the transaction
    // so we can release the old registry entry and claim the new one atomically.
    const currentBranding = await (prisma as any).businessBranding.findUnique({
      where: { businessId: bizId },
      select: { customSlug: true },
    })
    const oldSlug: string | null = currentBranding?.customSlug ?? null
    const newSlug: string | null = parsed.data.customSlug !== undefined ? (parsed.data.customSlug || null) : oldSlug

    // WLA-014-SLUG: Wrap the two writes + slug registry update in a transaction.
    // claimSlug() throws P2002 if the slug is already claimed by any owner
    // (Provider or BusinessBranding), making the cross-table race impossible.
    let branding: any
    await prisma.$transaction(async (tx) => {
      if (newSlug !== oldSlug) {
        const { updateSlugClaim } = await import('@/lib/branding/slug-registry')
        await updateSlugClaim(tx, 'businessBranding', bizId, oldSlug, newSlug)
      }

      branding = await (tx as any).businessBranding.upsert({
        where: { businessId: bizId },
        create: { businessId: bizId, ...brandingData },
        update: brandingData,
      })

      // Mirror back to Provider for backward compatibility
      await tx.provider.updateMany({
        where: { id: session!.user!.providerId },
        data: {
          brandLogo:            parsed.data.logo          ?? undefined,
          brandColorPrimary:    parsed.data.primaryColour ?? undefined,
          brandColorSecondary:  parsed.data.secondaryColour ?? undefined,
          customSlug:           parsed.data.customSlug    ?? undefined,
          // V-03 FIX: mirror customDomain to Provider (was previously dropped by Zod).
          // domainVerified is NOT set here — verification still requires DNS check
          // via /api/instructor/domain/verify.
          customDomain:         parsed.data.customDomain  ?? undefined,
          showBrandingOnBookingPage: parsed.data.showPlatformBranding === false,
        },
      })
    })

    return NextResponse.json({ success: true, branding })
  } catch (err) {
    // WLA-014-SLUG: P2002 on 'slug' means the SlugRegistry caught a concurrent
    // cross-table claim. P2002 on 'customSlug' means the per-table index caught
    // an in-table duplicate. Both surface as 409 Conflict.
    if ((err as any)?.code === 'P2002') {
      const target = (err as any)?.meta?.target?.toString() ?? ''
      if (target.includes('customSlug') || target.includes('slug')) {
        return NextResponse.json({ error: 'This URL slug is already taken. Please choose another.' }, { status: 409 })
      }
    }
    console.error('[PUT /api/business/branding]', err)
    return NextResponse.json({ error: 'Failed to update branding' }, { status: 500 })
  }
}
