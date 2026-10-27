import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import SubdomainBookingPage from '@/app/subdomain/[slug]/page';
import BusinessWebsitePage from '@/components/website/BusinessWebsitePage';
import { fetchProviderWebsiteData } from '@/lib/website/fetchProviderWebsiteData';

export const dynamic = 'force-dynamic';

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
 * Resolution order:
 *   1. Read the Host header (TLS-verified, not spoofable)
 *   2. Strip port if present
 *   3. Verify it's NOT an own domain (defensive — if it is, return 404)
 *   4. Find provider by their customDomain field
 *   5. If they have custom BusinessConfig → render with generic BusinessWebsitePage
 *   6. Otherwise → render with the driving-specific SubdomainBookingPage (fallback)
 */
export default async function CustomDomainPage({
  searchParams,
}: {
  searchParams: { location?: string };
}) {
  const headersList = headers();

  // WLA-017 FIX: Use the Host header (TLS-verified) instead of the
  // client-controllable x-custom-domain header. The Host header is set by
  // the browser and verified by the TLS certificate — it cannot be spoofed
  // on a secure connection. The x-custom-domain header is ignored.
  const hostHeader = headersList.get('host');
  if (!hostHeader) notFound();

  // Strip port if present (e.g. "example.com:443" → "example.com")
  const customDomain = hostHeader.split(':')[0];
  if (!customDomain) notFound();

  // WLA-017 FIX: Verify the host is NOT an own domain. If someone visits
  // /custom-domain directly on drivebook.com.au, the Host would be an own
  // domain — return 404. This prevents direct access to the page outside
  // of the middleware's custom-domain rewrite flow.
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'drivebook.com.au';
  const isOwnDomain =
    customDomain.includes(rootDomain) ||
    customDomain.includes('localhost') ||
    customDomain.endsWith('vercel.app');
  if (isOwnDomain) notFound();

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

  if (!instructor) {
    // Also check BusinessDomain table (for businesses set up via Business Config)
    const bizDomain = await (prisma as any).businessDomain?.findFirst?.({
      where: { host: customDomain, verified: true },
      select: { businessId: true, business: { select: { id: true } } },
    }).catch(() => null)

    if (!bizDomain) notFound()

    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'drivebook.com.au'
    const websiteData = await fetchProviderWebsiteData(bizDomain.businessId, rootDomain)
    if (!websiteData) notFound()

    return <BusinessWebsitePage {...websiteData} canonicalUrl={`https://${customDomain}`} />
  }

  // Try generic renderer first
  try {
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'drivebook.com.au'
    const slug = instructor.customSlug ?? instructor.id
    const websiteData = await fetchProviderWebsiteData(slug, rootDomain)

    if (websiteData) {
      const { config } = websiteData
      const isCustomised =
        config.terminology.provider !== 'provider' ||
        config.terminology.booking !== 'Lesson'
      if (isCustomised) {
        return <BusinessWebsitePage {...websiteData} canonicalUrl={`https://${customDomain}`} />
      }
    }
  } catch { /* fall through */ }

  // Fall back to driving-specific page
  return SubdomainBookingPage({
    params: { slug: instructor.customSlug ?? instructor.id },
    searchParams,
  });
}
