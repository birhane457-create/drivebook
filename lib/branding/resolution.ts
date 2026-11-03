/**
 * lib/branding/resolution.ts
 *
 * WLA-014 FIX: Canonical branding resolution service.
 *
 * Architectural contract (approved in WLA-014 review):
 *   - BusinessBranding is the single authoritative store for public branding.
 *   - Provider branding fields (brandLogo, brandColorPrimary, etc.) are
 *     compatibility fields during migration — not independent authorities.
 *   - Both renderers (subdomain + custom-domain) use this service.
 *
 * Business identity resolution order (WLA-014 v3):
 *   1. Provider.businessId (explicit FK relationship — canonical for new records)
 *   2. Legacy biz_${providerId} convention (migration fallback for existing records)
 *
 * The biz_ convention is TRANSITIONAL only. New Business records should use
 * independently generated IDs persisted via Provider.businessId.
 *
 * Branding resolution order:
 *   1. BusinessBranding via resolved businessId — canonical.
 *   2. Provider fields as fallback ONLY when no BusinessBranding record exists.
 *      This handles pre-migration providers where BusinessBranding was never populated.
 *   3. Defaults from the driving template.
 */

import { prisma } from '@/lib/prisma'

// ── Resolved branding type ────────────────────────────────────────────────────

export interface ResolvedBranding {
  logo: string | null
  primaryColour: string
  secondaryColour: string | null
  fontFamily: string | null
  theme: 'light' | 'dark'
  showPlatformBranding: boolean
  customSlug: string | null
  /** Identifies the origin of the resolved branding. */
  source: 'businessBranding' | 'provider' | 'default'
  /** The businessId used to resolve branding (for diagnostic/logging). */
  resolvedBusinessId: string | null
}

const DEFAULT_PRIMARY = '#3B82F6'

// ── Business identity resolution ──────────────────────────────────────────────

/**
 * Resolve the canonical Business ID for a given Provider.
 *
 * Uses Provider.businessId (explicit FK) first.
 * Falls back to biz_${providerId} ONLY for existing migrated records.
 *
 * The biz_ convention is TRANSITIONAL. New Business records must not use it
 * as the permanent identity rule.
 */
export async function resolveBusinessId(providerId: string): Promise<string | null> {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    select: { businessId: true } as any,
  }) as any

  // 1. Explicit FK relationship (canonical for new records)
  if (provider?.businessId) {
    return provider.businessId
  }

  // 2. Legacy biz_ convention (fallback for existing migrated records only)
  const legacyBizId = `biz_${providerId}`
  const legacyBusiness = await (prisma as any).business.findUnique({
    where: { id: legacyBizId },
    select: { id: true },
  })
  if (legacyBusiness) {
    return legacyBizId
  }

  return null
}

// ── Main resolver ─────────────────────────────────────────────────────────────

/**
 * Resolve public branding for a given Provider.
 *
 * Uses BusinessBranding as the authoritative source.
 * Falls back to Provider fields only when no BusinessBranding record exists
 * (pre-migration providers).
 */
export async function resolveProviderBranding(providerId: string): Promise<ResolvedBranding> {
  const businessId = await resolveBusinessId(providerId)

  // 1. Try BusinessBranding (canonical)
  if (businessId) {
    const biz = await (prisma as any).businessBranding.findUnique({
      where: { businessId },
      select: {
        logo: true,
        primaryColour: true,
        secondaryColour: true,
        fontFamily: true,
        theme: true,
        showPlatformBranding: true,
        customSlug: true,
      },
    }) as {
      logo: string | null
      primaryColour: string
      secondaryColour: string | null
      fontFamily: string | null
      theme: string
      showPlatformBranding: boolean
      customSlug: string | null
    } | null

    if (biz) {
      return {
        logo: biz.logo ?? null,
        primaryColour: biz.primaryColour ?? DEFAULT_PRIMARY,
        secondaryColour: biz.secondaryColour ?? null,
        fontFamily: biz.fontFamily ?? null,
        theme: (biz.theme === 'dark' ? 'dark' : 'light'),
        showPlatformBranding: biz.showPlatformBranding ?? true,
        customSlug: biz.customSlug ?? null,
        source: 'businessBranding',
        resolvedBusinessId: businessId,
      }
    }
  }

  // 2. Fall back to Provider legacy fields (pre-migration only)
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    select: {
      brandLogo: true,
      brandColorPrimary: true,
      brandColorSecondary: true,
      showBrandingOnBookingPage: true,
      customSlug: true,
    },
  }) as {
    brandLogo: string | null
    brandColorPrimary: string | null
    brandColorSecondary: string | null
    showBrandingOnBookingPage: boolean
    customSlug: string | null
  } | null

  if (provider) {
    return {
      logo: provider.brandLogo ?? null,
      primaryColour: provider.brandColorPrimary ?? DEFAULT_PRIMARY,
      secondaryColour: provider.brandColorSecondary ?? null,
      fontFamily: null,
      theme: 'light',
      // Inverted: showBrandingOnBookingPage = true means "show branding" = NOT showPlatformBranding
      showPlatformBranding: !provider.showBrandingOnBookingPage,
      customSlug: provider.customSlug ?? null,
      source: 'provider',
      resolvedBusinessId: businessId,
    }
  }

  // 3. Defaults
  return {
    logo: null,
    primaryColour: DEFAULT_PRIMARY,
    secondaryColour: null,
    fontFamily: null,
    theme: 'light',
    showPlatformBranding: true,
    customSlug: null,
    source: 'default',
    resolvedBusinessId: null,
  }
}

// ── Upsert helper for write paths ─────────────────────────────────────────────

/**
 * Upsert BusinessBranding for a given Provider.
 * Creates the record if it does not exist (replacing the V-07 conditional sync).
 * Also creates the parent Business record if absent (satisfies FK constraint).
 *
 * Business ID resolution (WLA-014 v3):
 *   1. Provider.businessId (explicit FK — use when present)
 *   2. biz_${providerId} legacy convention (fallback for existing migrated records)
 *   3. Create a new Business with biz_ ID only when no explicit relationship exists
 *      and no legacy record was found — this is the transitional creation path.
 *
 * Field name mapping (Provider → BusinessBranding):
 *   brandLogo              → logo
 *   brandColorPrimary      → primaryColour
 *   brandColorSecondary    → secondaryColour
 *   customSlug             → customSlug (same)
 *
 * NOTE ON INVERSION: This function accepts `showPlatformBranding` directly.
 * The CALLER is responsible for converting `showBrandingOnBookingPage` to
 * `showPlatformBranding` using the inversion:
 *   showPlatformBranding = !showBrandingOnBookingPage
 * Do NOT invert inside this helper — that would apply the inversion twice.
 */
export async function upsertBusinessBranding(
  providerId: string,
  fields: {
    logo?: string | null
    primaryColour?: string | null
    secondaryColour?: string | null
    fontFamily?: string | null
    theme?: 'light' | 'dark'
    showPlatformBranding?: boolean
    customSlug?: string | null
  }
): Promise<void> {
  // Resolve the Business ID via the explicit FK first, then legacy fallback
  let bizId = await resolveBusinessId(providerId)

  if (!bizId) {
    // No existing Business relationship — create one using the transitional biz_ convention.
    // This is the legacy creation path for providers without an explicit FK yet.
    //
    // IMPORTANT: paymentModel is derived from Provider.businessModel (the onboarding value).
    // A MARKETPLACE provider must NOT receive a 'saas' Business.
    // Supported mappings: MARKETPLACE → 'marketplace', SAAS/anything-else → 'saas'.
    // Unknown values (neither MARKETPLACE nor SAAS) also fall back to 'saas' with a warning.
    const provider = await prisma.provider.findUnique({
      where: { id: providerId },
      select: {
        name: true,
        businessModel: true,    // "MARKETPLACE" or "SAAS"
        user: { select: { email: true } },
      },
    }) as any

    const legacyBizId = `biz_${providerId}`

    const SUPPORTED_MODELS = ['MARKETPLACE', 'SAAS', 'marketplace', 'saas']
    if (provider?.businessModel && !SUPPORTED_MODELS.includes(provider.businessModel)) {
      console.warn(`[WLA-014] Unexpected businessModel '${provider.businessModel}' for Provider ${providerId}; defaulting to 'saas'`)
    }
    const paymentModel = provider?.businessModel === 'MARKETPLACE' ? 'marketplace' : 'saas'

    try {
      await (prisma as any).business.create({
        data: {
          id: legacyBizId,
          name: provider?.businessName ?? provider?.name ?? 'My Business',
          supportEmail: provider?.user?.email ?? `noreply@${legacyBizId}.local`,
          timezone: 'Australia/Perth',
          paymentModel,
          isActive: true,
        },
      })
    } catch (createErr: any) {
      if (createErr?.code === 'P2002') {
        // Duplicate key — Business was concurrently created. Re-read to confirm it exists.
        const existing = await (prisma as any).business.findUnique({
          where: { id: legacyBizId },
          select: { id: true },
        })
        if (!existing) {
          // Truly unexpected — creation failed and the record doesn't exist
          throw new Error(`[WLA-014] Business creation failed and record not found: ${legacyBizId}`)
        }
        // Concurrent creation race — safe to continue
      } else {
        throw createErr  // propagate non-duplicate errors
      }
    }

    bizId = legacyBizId

    // Link the Provider to its newly created Business via the explicit FK.
    // This ensures future lookups use Provider.businessId rather than the biz_ convention.
    await prisma.$executeRaw`
      UPDATE "Provider" SET "businessId" = ${bizId}
      WHERE id = ${providerId} AND "businessId" IS NULL
    `.catch(err => {
      // Non-fatal: if this fails, the biz_ convention still works as fallback
      console.warn(`[WLA-014] Could not set Provider.businessId for ${providerId}:`, err instanceof Error ? err.message : String(err))
    })
  }

  await (prisma as any).businessBranding.upsert({
    where: { businessId: bizId },
    create: {
      businessId: bizId,
      logo: fields.logo ?? null,
      primaryColour: fields.primaryColour ?? DEFAULT_PRIMARY,
      secondaryColour: fields.secondaryColour ?? null,
      fontFamily: fields.fontFamily ?? null,
      theme: fields.theme ?? 'light',
      showPlatformBranding: fields.showPlatformBranding ?? true,
      customSlug: fields.customSlug ?? null,
    },
    update: {
      ...(fields.logo !== undefined && { logo: fields.logo }),
      ...(fields.primaryColour !== undefined && { primaryColour: fields.primaryColour ?? DEFAULT_PRIMARY }),
      ...(fields.secondaryColour !== undefined && { secondaryColour: fields.secondaryColour }),
      ...(fields.fontFamily !== undefined && { fontFamily: fields.fontFamily }),
      ...(fields.theme !== undefined && { theme: fields.theme }),
      ...(fields.showPlatformBranding !== undefined && { showPlatformBranding: fields.showPlatformBranding }),
      ...(fields.customSlug !== undefined && { customSlug: fields.customSlug }),
    },
  })
}
