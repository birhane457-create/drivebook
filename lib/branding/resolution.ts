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
 * Resolution order:
 *   1. BusinessBranding record for `biz_${providerId}` — canonical.
 *   2. Provider fields as fallback ONLY when no BusinessBranding record exists.
 *      This handles pre-migration providers where BusinessBranding was never populated.
 *   3. Defaults from the driving template.
 *
 * The Provider-override shim in fetchProviderWebsiteData.ts that unconditionally
 * overwrote BusinessBranding colours has been replaced by this service.
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
  /** True when branding came from BusinessBranding (canonical). False = Provider fallback. */
  source: 'businessBranding' | 'provider' | 'default'
}

const DEFAULT_PRIMARY = '#3B82F6'

// ── Main resolver ─────────────────────────────────────────────────────────────

/**
 * Resolve public branding for a given Provider.
 *
 * Uses BusinessBranding as the authoritative source.
 * Falls back to Provider fields only when no BusinessBranding record exists
 * (pre-migration providers).
 */
export async function resolveProviderBranding(providerId: string): Promise<ResolvedBranding> {
  const bizId = `biz_${providerId}`

  // 1. Try BusinessBranding (canonical)
  const biz = await (prisma as any).businessBranding.findUnique({
    where: { businessId: bizId },
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
  }
}

// ── Upsert helper for write paths ─────────────────────────────────────────────

/**
 * Upsert BusinessBranding for a given Provider.
 * Creates the record if it does not exist (replacing the V-07 conditional sync).
 * Also creates the parent Business record if absent (satisfies FK constraint).
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
  const bizId = `biz_${providerId}`

  // Ensure the parent Business record exists before upserting BusinessBranding.
  // BusinessBranding has a FK to Business (BusinessBranding_businessId_fkey).
  // This is a no-op if the Business record already exists.
  const existingBusiness = await (prisma as any).business.findUnique({
    where: { id: bizId },
    select: { id: true },
  })
  if (!existingBusiness) {
    // Create a minimal Business record to satisfy the FK constraint.
    // This handles the case where the migration script has not yet been run for this Provider.
    //
    // IMPORTANT: paymentModel is derived from Provider.businessModel (the onboarding value),
    // NOT hardcoded to 'saas'. A MARKETPLACE provider must not receive a 'saas' Business.
    // paymentMode MARKETPLACE → Business.paymentModel 'marketplace'
    // paymentMode DIRECT/SAAS  → Business.paymentModel 'saas'
    const provider = await prisma.provider.findUnique({
      where: { id: providerId },
      select: {
        name: true,
        businessModel: true,     // "MARKETPLACE" or "SAAS"
        user: { select: { email: true } },
      },
    }) as any

    const paymentModel = provider?.businessModel === 'MARKETPLACE' ? 'marketplace' : 'saas'

    await (prisma as any).business.create({
      data: {
        id: bizId,
        name: provider?.businessName ?? provider?.name ?? 'My Business',
        supportEmail: provider?.user?.email ?? `noreply@${bizId}.local`,
        timezone: 'Australia/Perth',
        paymentModel,        // derived from Provider onboarding value, never hardcoded
        isActive: true,
      },
    }).catch(() => {}) // ignore if already created by concurrent call
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
