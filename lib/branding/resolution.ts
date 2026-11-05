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
 * Business identity resolution order (WLA-014 v4):
 *   1. Provider.businessId (explicit FK relationship — canonical for new records)
 *   2. Legacy biz_${providerId} convention (fallback for EXISTING migrated records only)
 *
 * The biz_ convention is TRANSITIONAL only. New Business records receive
 * independent auto-generated IDs (cuid) and are linked via Provider.businessId.
 * biz_ is never used for new record creation.
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
 * Business ID resolution (WLA-014 v4):
 *   1. Provider.businessId (explicit FK — use when present)
 *   2. biz_${providerId} legacy convention (fallback for EXISTING migrated records only)
 *   3. Create a new Business with an INDEPENDENT auto-generated ID (cuid).
 *      New Business records must NOT use the biz_ convention — that is TRANSITIONAL
 *      only, reserved for pre-existing legacy records. The new ID is persisted to
 *      Provider.businessId so future lookups use the explicit FK.
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
  },
  existingTx?: any  // WLA-014-SLUG v5: accept outer transaction to merge with Provider update
): Promise<void> {
  // Use the provided transaction client, or the global prisma if no tx is passed
  const db = existingTx ?? prisma

  // Resolve the Business ID via the explicit FK first, then legacy fallback
  let bizId = await resolveBusinessId(providerId)

  if (!bizId) {
    // No existing Business relationship — create one with an INDEPENDENT ID.
    // Do NOT use the biz_ convention for new records. That is TRANSITIONAL,
    // reserved for pre-existing legacy records only.
    const provider = await db.provider.findUnique({
      where: { id: providerId },
      select: {
        name: true,
        businessModel: true,    // "MARKETPLACE" or "SAAS"
        user: { select: { email: true } },
      },
    }) as any

    const SUPPORTED_MODELS = ['MARKETPLACE', 'SAAS', 'marketplace', 'saas']
    if (provider?.businessModel && !SUPPORTED_MODELS.includes(provider.businessModel)) {
      console.warn(`[WLA-014] Unexpected businessModel '${provider.businessModel}' for Provider ${providerId}; defaulting to 'saas'`)
    }
    const paymentModel = provider?.businessModel === 'MARKETPLACE' ? 'marketplace' : 'saas'

    // Create Business with auto-generated ID (no explicit id field — Prisma uses @default(cuid()))
    const newBusiness = await (db as any).business.create({
      data: {
        name: provider?.businessName ?? provider?.name ?? 'My Business',
        supportEmail: provider?.user?.email ?? `noreply@drivebook.local`,
        timezone: 'Australia/Perth',
        paymentModel,
        isActive: true,
      },
    })
    bizId = newBusiness.id

    // Link the Provider to its newly created Business via the explicit FK.
    // The WHERE "businessId" IS NULL clause ensures only the first concurrent
    // request wins; subsequent requests find the FK already set.
    const rowsAffected = await db.$executeRaw`
      UPDATE "Provider" SET "businessId" = ${bizId}
      WHERE id = ${providerId} AND "businessId" IS NULL
    `

    if (rowsAffected === 0) {
      // A concurrent request already set Provider.businessId — re-read to get the actual value.
      const reRead = await db.provider.findUnique({
        where: { id: providerId },
        select: { businessId: true } as any,
      }) as any

      if (reRead?.businessId) {
        // Clean up the orphaned Business we just created (the concurrent request's Business wins)
        await (db as any).business.delete({ where: { id: bizId } }).catch(() => {})
        bizId = reRead.businessId
      } else {
        // FK assignment failed without a concurrent setter — this is a data integrity
        // error. The Business was created but cannot be linked to the Provider.
        // Clean up the orphaned Business, then throw so the route can return a
        // failure or partial-write response. Logging alone is insufficient — the
        // invariant must be enforced, not merely observed.
        await (db as any).business.delete({ where: { id: bizId } })
          .catch(err => console.error(
            `[WLA-014] Failed to clean up orphaned Business ${bizId}:`,
            err instanceof Error ? err.message : String(err)
          ))
        throw new Error(
          `[WLA-014] Failed to link Business to Provider ${providerId}. ` +
          `The Business record was cleaned up. Please retry the branding save.`
        )
      }
    }
  }

  // Read existing BusinessBranding slug before the write so we can
  // maintain the registry atomically with the upsert.
  const existingBranding = bizId ? await (db as any).businessBranding.findUnique({
    where: { businessId: bizId },
    select: { customSlug: true },
  }) : null
  const oldSlug: string | null = existingBranding?.customSlug ?? null
  const slugIsBeingChanged = fields.customSlug !== undefined
  const newSlug: string | null = slugIsBeingChanged ? (fields.customSlug ?? null) : oldSlug

  // WLA-014-SLUG v5: If an outer transaction is provided, execute directly on it.
  // If no outer tx, create an inner transaction for atomicity.
  const doBrandingWrite = async (tx: any) => {
    if (slugIsBeingChanged && newSlug !== oldSlug) {
      const { updateSlugClaim } = await import('./slug-registry')
      await updateSlugClaim(tx, 'businessBranding', bizId!, oldSlug, newSlug)
    }

    await (tx as any).businessBranding.upsert({
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

  if (existingTx) {
    // Running inside an outer transaction — execute directly
    await doBrandingWrite(existingTx)
  } else {
    // No outer transaction — create an inner one for atomicity
    await prisma.$transaction(async (tx) => { await doBrandingWrite(tx) })
  }
}
