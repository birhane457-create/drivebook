import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import SubdomainBookingPage from '@/app/subdomain/[slug]/page';
import BusinessWebsitePage from '@/components/website/BusinessWebsitePage';
import BusinessPublicPage from '@/components/website/BusinessPublicPage';
import { fetchProviderWebsiteData } from '@/lib/website/fetchProviderWebsiteData';
import { fetchBusinessWebsiteData, resolveBusinessDomain } from '@/lib/website/fetchBusinessWebsiteData';
import { isOwnDomain, normalizeHostname } from '@/lib/utils/host-classification';

export const dynamic = 'force-dynamic';

/**
 * WLA-013 FIX: Custom-domain metadata isolation.
 *
 * generateMetadata resolves the tenant by the Host header and returns
 * tenant-specific metadata. Only verified domain records are used.
 * Unverified or unknown domains return minimal metadata without
 * DriveBook branding leakage.
 *
 * Resolution order matches the page rendering:
 *   1. Provider with verified customDomain (STUDIO/PREMIUM)
 *   2. Verified BusinessDomain
 *   3. Fallback: generic "Website" title (no DriveBook branding)
 */
export async function generateMetadata(): Promise<Metadata> {
  const headersList = headers();
  const hostHeader = headersList.get('host');
  if (!hostHeader) return { title: 'Website' };

  const customDomain = normalizeHostname(hostHeader);
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'drivebook.com.au';

  // Defensive: if the host is an own domain, this page should not be reached
  // (middleware would not rewrite it). Return minimal metadata.
  if (isOwnDomain(customDomain, rootDomain)) return { title: 'Website' };

  // Path 1: Provider with verified custom domain
  const instructor = await prisma.provider.findFirst({
    where: {
      customDomain,
      domainVerified: true,
      subscriptionTier: { in: ['STUDIO', 'PREMIUM'] },
    },
    orderBy: { domainVerifiedAt: 'desc' },
    select: {
      name: true,
      businessName: true,
      bio: true,
      serviceAreas: true,
      averageRating: true,
      totalReviews: true,
      profileImage: true,
      customSlug: true,
    },
  });

  if (instructor) {
    const { getDisplayName } = await import('@/lib/utils/account');
    const displayName = getDisplayName(instructor as any);
    const title = `${displayName} | Book Online`;
    const description = instructor.bio
      ? instructor.bio.slice(0, 155)
      : `Book online with ${displayName}${instructor.serviceAreas ? ` in ${instructor.serviceAreas}` : ''}.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        siteName: displayName,
        images: instructor.profileImage
          ? [{ url: instructor.profileImage, width: 400, height: 400, alt: displayName }]
          : [],
      },
      twitter: {
        card: 'summary',
        title,
        description,
        images: instructor.profileImage ? [instructor.profileImage] : [],
      },
      alternates: {
        canonical: `https://${customDomain}`,
      },
    };
  }

  // Path 2: Verified BusinessDomain
  const businessId = await resolveBusinessDomain(customDomain);
  if (!businessId) return { title: 'Website' };

  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      name: true,
      website: {
        select: { seoTitle: true, seoDesc: true, seoImage: true },
      },
    },
  }) as any;

  if (!biz) return { title: 'Website' };

  const title = biz.website?.seoTitle ?? biz.name;
  const description = biz.website?.seoDesc ?? undefined;
  const ogImage = biz.website?.seoImage ?? undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: biz.name,
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630, alt: biz.name }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImage ? [ogImage] : [],
    },
    alternates: {
      canonical: `https://${customDomain}`,
    },
  };
}

/**
 * Custom domain booking page (Studio tier).
 * Middleware rewrites requests from custom domains to /custom-domain.
 *
 * WLA-017 FIX: The page previously read `x-custom-domain` from request headers,
 * which is client-controllable and can be spoofed. The page now reads the
 * `Host` header directly — this is set by the browser and verified by TLS,
 * so it cannot be spoofed on a secure connection. The `x-custom-domain`
 * header is ignored for tenant resolution.
 *
 * WLA-012 FIX: BusinessDomain fallback now uses fetchBusinessWebsiteData()
 * which loads Business-owned data directly. The previous code passed a
 * Business ID to fetchProviderWebsiteData(), which only queries Provider.id /
 * Provider.customSlug — those never match a Business ID.
 *
 * Also fixed: the .catch(() => null) that silently converted database errors
 * to 404 responses has been replaced with explicit error propagation.
 *
 * Resolution order:
 *   1. Read the Host header (TLS-verified, not spoofable)
 *   2. Normalize and verify it's NOT an own domain
 *   3. Find Provider by customDomain (STUDIO/PREMIUM only)
 *   4. If found → render with BusinessWebsitePage (Provider path, unchanged)
 *   5. If not found → resolve via BusinessDomain table
 *   6. If Business found → render with BusinessPublicPage (Business path)
 *   7. Otherwise → 404
 */
export default async function CustomDomainPage({
  searchParams,
}: {
  searchParams: { location?: string };
}) {
  const headersList = headers();

  // WLA-017 FIX: Use the Host header (TLS-verified, not spoofable)
  const hostHeader = headersList.get('host');
  if (!hostHeader) notFound();

  // WLA-011 FIX: normalize hostname (lowercase, strip port, strip trailing dot)
  const customDomain = normalizeHostname(hostHeader);
  if (!customDomain) notFound();

  // WLA-011 FIX: exact hostname-boundary matching (was: unsafe .includes())
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'drivebook.com.au';
  if (isOwnDomain(customDomain, rootDomain)) notFound();

  // ── Path 1: Provider-owned custom domain ────────────────────────────────────
  // Find the provider who owns this verified custom domain.
  // orderBy domainVerifiedAt DESC ensures deterministic resolution if two providers
  // somehow share a customDomain (legacy data). The ownership check in the verify
  // endpoint (V-01 fix) prevents new collisions from entering the DB.
  const instructor = await prisma.provider.findFirst({
    where: {
      customDomain,
      domainVerified: true,
      subscriptionTier: { in: ['STUDIO', 'PREMIUM'] },
    },
    orderBy: { domainVerifiedAt: 'desc' },
    select: { id: true, customSlug: true },
  });

  if (instructor) {
    // Try generic Business renderer first (customised config)
    try {
      const slug = instructor.customSlug ?? instructor.id;
      const websiteData = await fetchProviderWebsiteData(slug, rootDomain);
      if (websiteData) {
        const { config } = websiteData;
        const isCustomised =
          config.terminology.provider !== 'provider' ||
          config.terminology.booking !== 'Lesson';
        if (isCustomised) {
          return (
            <BusinessWebsitePage {...websiteData} canonicalUrl={`https://${customDomain}`} />
          );
        }
      }
    } catch {
      // Fall through to driving-specific page on loader error
    }

    // Fall back to driving-specific page
    return SubdomainBookingPage({
      params: { slug: instructor.customSlug ?? instructor.id },
      searchParams,
    });
  }

  // ── Path 2: Business-owned custom domain (WLA-012 FIX) ──────────────────────
  // resolveBusinessDomain throws on DB errors (does not swallow as null).
  // Returns null only when no verified BusinessDomain record exists for the host.
  const businessId = await resolveBusinessDomain(customDomain);
  if (!businessId) notFound();

  // Load Business website data — throws on DB errors, returns null for
  // not-found, inactive Business, or unpublished website.
  const businessData = await fetchBusinessWebsiteData(
    businessId,
    `https://${customDomain}`
  );

  if (!businessData) notFound();

  return <BusinessPublicPage data={businessData} />;
}
