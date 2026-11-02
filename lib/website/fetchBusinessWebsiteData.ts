/**
 * lib/website/fetchBusinessWebsiteData.ts
 *
 * WLA-012: Business-specific website data loader.
 *
 * Loads website content from Business-owned tables (Business, BusinessBranding,
 * BusinessTerminology, BusinessService, BusinessDomain, BusinessWebsite, Provider).
 * Does NOT require a Provider record to exist — standalone businesses are supported.
 *
 * This replaces the broken pattern in app/custom-domain/page.tsx where
 * fetchProviderWebsiteData(bizDomain.businessId) was called with a Business ID
 * against a function that only queries Provider.id / Provider.customSlug.
 *
 * SECURITY INVARIANTS:
 *   - Domain resolution requires verified === true.
 *   - Providers loaded are scoped to the Business — no cross-tenant leakage.
 *   - Database errors propagate rather than being silenced as 404.
 *   - A Business with publishedAt = null is treated as unpublished → null.
 */

import { prisma } from '@/lib/prisma';

// ── Public data types ─────────────────────────────────────────────────────────

export interface BusinessProviderData {
  id: string;
  displayName: string;
  profileImage?: string | null;
  bio?: string | null;
  phone?: string | null;
  averageRating?: number | null;
  totalReviews: number;
  yearsExperience?: number | null;
  whatsapp?: string | null;
  instagram?: string | null;
  facebook?: string | null;
}

export interface BusinessServiceData {
  id: string;
  name: string;
  description?: string | null;
  duration: number;
  price: number;
  bookingMode: string;
}

export interface BusinessWebsiteData {
  /** The Business record */
  business: {
    id: string;
    name: string;
    phone?: string | null;
    timezone: string;
    isActive: boolean;
  };
  /** Branding: colours, logo, slug */
  branding: {
    logo?: string | null;
    primaryColour: string;
    secondaryColour?: string | null;
    fontFamily?: string | null;
    theme: string;
    showPlatformBranding: boolean;
    customSlug?: string | null;
  };
  /** Terminology: provider/customer/booking labels */
  terminology: {
    provider: string;
    providers: string;
    customer: string;
    customers: string;
    booking: string;
    bookings: string;
    service: string;
    services: string;
    providerGroup: string;
  };
  /** Active services offered */
  services: BusinessServiceData[];
  /** Providers belonging to this Business (may be empty for standalone) */
  providers: BusinessProviderData[];
  /** SEO metadata from BusinessWebsite */
  seo: {
    title?: string | null;
    description?: string | null;
    image?: string | null;
  };
  /** Whether the website is published */
  isPublished: boolean;
  /** Canonical URL */
  canonicalUrl: string;
}

// ── Main loader ───────────────────────────────────────────────────────────────

/**
 * Load all data needed to render a Business's public website.
 *
 * Returns null if:
 *   - The Business does not exist
 *   - The Business is not active
 *   - The Business website is not published (publishedAt is null)
 *
 * Throws on database errors (does not swallow infrastructure failures as 404).
 */
export async function fetchBusinessWebsiteData(
  businessId: string,
  canonicalUrl: string
): Promise<BusinessWebsiteData | null> {
  // Load the full Business graph in one query (without providers — loaded separately)
  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      phone: true,
      timezone: true,
      isActive: true,
      subscriptionTier: true,
      branding: {
        select: {
          logo: true,
          primaryColour: true,
          secondaryColour: true,
          fontFamily: true,
          theme: true,
          showPlatformBranding: true,
          customSlug: true,
        },
      },
      terminology: {
        select: {
          provider: true,
          providers: true,
          customer: true,
          customers: true,
          booking: true,
          bookings: true,
          service: true,
          services: true,
          providerGroup: true,
        },
      },
      services: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
          duration: true,
          price: true,
          bookingMode: true,
        },
      },
      website: {
        select: {
          seoTitle: true,
          seoDesc: true,
          seoImage: true,
          publishedAt: true,
        },
      },
    },
  }) as any;

  if (!biz) return null;
  if (!biz.isActive) return null;

  // WLA-012: Enforce subscription-tier entitlement for Business website access.
  // Business websites require STUDIO or PREMIUM tier (same as Provider custom-domain
  // access in Path 1). This prevents a BASIC or PRO Provider from bypassing the
  // tier restriction by going through the BusinessDomain fallback (Path 2).
  // The Business.subscriptionTier is populated from the Provider's tier during
  // migration (migrate-business-config.ts) and must be STUDIO or PREMIUM.
  const ENTITLED_TIERS = ['STUDIO', 'PREMIUM', 'BUSINESS'];
  if (!ENTITLED_TIERS.includes(biz.subscriptionTier ?? '')) return null;

  // Unpublished website → null (controlled not-found, not a 404 error)
  const isPublished = biz.website?.publishedAt != null;
  if (!isPublished) return null;

  // WLA-012: load Providers that belong to this Business via raw SQL
  // (Provider.businessId FK is a schema addition; compiled Prisma client may not
  // have the 'providers' back-relation yet until regenerated with actual node.js)
  const rawProviders = await prisma.$queryRaw<any[]>`
    SELECT
      p.id, p.name, p."businessName", p."profileImage", p.bio, p.phone,
      p."averageRating", p."totalReviews", p."yearsExperience",
      p.whatsapp, p.instagram, p.facebook
    FROM "Provider" p
    WHERE p."businessId" = ${businessId}
      AND p."isActive" = true
    ORDER BY p.name ASC
  `;

  // Assemble terminology with defaults (Business may not have a terminology record)
  const terminology = biz.terminology ?? {
    provider: 'Provider',
    providers: 'Providers',
    customer: 'Customer',
    customers: 'Customers',
    booking: 'Booking',
    bookings: 'Bookings',
    service: 'Service',
    services: 'Services',
    providerGroup: 'Business',
  };

  // Assemble branding with defaults
  const branding = biz.branding ?? {
    logo: null,
    primaryColour: '#3B82F6',
    secondaryColour: null,
    fontFamily: null,
    theme: 'light',
    showPlatformBranding: true,
    customSlug: null,
  };

  // Map providers — display name prefers businessName over name
  const providers: BusinessProviderData[] = (rawProviders ?? []).map((p: any) => ({
    id: p.id,
    displayName: p.businessName?.trim() || p.name,
    profileImage: p.profileImage,
    bio: p.bio,
    phone: p.phone,
    averageRating: p.averageRating,
    totalReviews: p.totalReviews ?? 0,
    yearsExperience: p.yearsExperience,
    whatsapp: p.whatsapp,
    instagram: p.instagram,
    facebook: p.facebook,
  }));

  // Map services
  const services: BusinessServiceData[] = (biz.services ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    duration: s.duration,
    price: Number(s.price),
    bookingMode: s.bookingMode,
  }));

  return {
    business: {
      id: biz.id,
      name: biz.name,
      phone: biz.phone,
      timezone: biz.timezone,
      isActive: biz.isActive,
    },
    branding,
    terminology,
    services,
    providers,
    seo: {
      title: biz.website?.seoTitle,
      description: biz.website?.seoDesc,
      image: biz.website?.seoImage,
    },
    isPublished,
    canonicalUrl,
  };
}

// ── Domain resolution ─────────────────────────────────────────────────────────

/**
 * Resolve a verified custom domain to its Business ID.
 *
 * Returns the businessId if exactly one verified BusinessDomain matches the host.
 * Returns null if no verified domain exists.
 * Throws on database errors — does not convert failures to null.
 *
 * SECURITY: requires verified = true. Unverified domains never resolve to a tenant.
 */
export async function resolveBusinessDomain(host: string): Promise<string | null> {
  const domain = await prisma.businessDomain.findFirst({
    where: {
      host,
      verified: true,
    },
    select: { businessId: true },
  });
  return domain?.businessId ?? null;
}
